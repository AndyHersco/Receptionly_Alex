import { useEffect, useMemo, useState } from 'react';
import { AddMenuButton, BLOCK_TYPES, BlockTimeModal, NotWorkingBlocks, SlotTypePicker, UserBlockEvent, addBlock, deleteBlock, updateBlock } from './blocks';
import { effectiveBuffer, effectiveBusinessHours, timeFromY, validateApptSlot, validateBlockSlot } from './calendar-actions';
import { APPOINTMENTS, BLOCKS, BUSINESS, CUSTOMERS, SERVICES, dayName, fmt12, fromMin, localDayKey, parseDay, toMin, todayKey } from './data';
import { TIME_OFF_REQUESTS, appointmentsFor, getEmployee } from './employee-data';
import { I } from './icons';
import { LunchBreakModal, getLunchFor } from './lunch-break-modal';
import { Badge, Button, Card, DateInput, DatePill, Field, Modal, StaffAvatar, Tabs, TimePicker, cx, showToast } from './ui';

// Employee Calendar — personal week/day view for just THIS staff member.

export function EmployeeCalendar({ staffId, onOpenAppt, onUpdate, onAddAppointment }) {
  const me = getEmployee(staffId);
  const [view, setView] = useState('week');
  const [date, setDate] = useState(new Date());
  const [showTimeOff, setShowTimeOff] = useState(false);
  const [showSchedChange, setShowSchedChange] = useState(false);
  const [requests, setRequests] = useState(() => TIME_OFF_REQUESTS.map((r) => ({ kind: 'time_off', ...r })));
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  // Shared drag state — lifts the dragged appointment id above the day /
  // week views so all columns can render a ghost / dimmed state in sync.
  const [draggingId, setDraggingId] = useState(null);
  // Slot-type popover (Appointment / Break / Lunch Break).
  const [slotMenu, setSlotMenu] = useState(null);
  // Block create / edit state.
  const [creatingBlock, setCreatingBlock] = useState(null);
  const [editingBlock, setEditingBlock] = useState(null);
  // Bump after a block mutates so the column views re-derive.
  const [blocksTick, setBlocksTick] = useState(0);

  function pickSlotAction(action) {
    const p = slotMenu;
    setSlotMenu(null);
    if (!p) return;
    if (action === 'appointment') {
      onAddAppointment && onAddAppointment({ date: p.date, start: p.start, staffId: p.staffId });
    } else {
      setCreatingBlock({
        type: action,
        staffId: p.staffId,
        date: p.date,
        start: p.start,
        end: fromMin(toMin(p.start) + 30),
        note: '',
      });
    }
  }

  function saveNewBlock(draft) {
    addBlock(draft);
    setBlocksTick(n => n + 1);
    showToast({ title: BLOCK_TYPES[draft.type].label + ' added', body: `${parseDay(draft.day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${fmt12(draft.start)}–${fmt12(draft.end)}` });
  }

  function saveExistingBlock(draft) {
    updateBlock({ ...editingBlock, ...draft });
    setBlocksTick(n => n + 1);
  }

  function removeBlock(id) {
    deleteBlock(id);
    setBlocksTick(n => n + 1);
    showToast({ title: 'Block deleted', body: 'The slot is open for bookings again.' });
  }

  function moveBlock(block, target) {
    const duration = toMin(block.end) - toMin(block.start);
    updateBlock({
      ...block,
      staffId: target.staffId,
      day: target.day,
      start: fromMin(target.startMin),
      end: fromMin(target.startMin + duration),
    });
    setBlocksTick(n => n + 1);
  }
  // Lunch break edit: holds {dayKey} for the date being edited. The staff is
  // always `me`. Tick forces a re-render after the override mutation.
  const [editingLunch, setEditingLunch] = useState(null);
  const [lunchTick, setLunchTick] = useState(0);

  // Top-bar Add menu: opens the appointment modal scoped to this
  // employee, or seeds the block modal with today's date and a default
  // mid-day window. Matches the admin calendar's Add dropdown so the
  // two apps offer the same entry points.
  function topBarAdd(action) {
    const d = localDayKey(date);
    if (action === 'appointment') {
      onAddAppointment && onAddAppointment({ date: d, staffId: me.id });
      return;
    }
    setCreatingBlock({
      type: action,
      staffId: me.id,
      date: d,
      start: '14:00',
      end: '14:30',
      note: '',
    });
  }

  function shiftDate(days) {
    const d = new Date(date);d.setDate(d.getDate() + days);setDate(d);
  }

  const dayKey = localDayKey(date);
  const todayDk = todayKey();

  // Compute week (Mon-Sun)
  const weekStart = new Date(date);
  const dow = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - dow);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const dateLabel = view === 'day' ?
  date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) :
  view === 'month' ?
  date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) :
  `${weekDays[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – ${weekDays[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;

  // Week stats for THIS employee
  const weekAppts = APPOINTMENTS.filter((a) => {
    if (a.staffId !== staffId) return false;
    if (a.status === 'canceled') return false;
    const dk = a.day;
    return weekDays.some((d) => localDayKey(d) === dk);
  });
  const weekHoursBooked = Math.round(weekAppts.reduce((s, a) => s + a.duration, 0) / 60 * 10) / 10;
  const weekClients = new Set(weekAppts.map((a) => a.customerId)).size;

  // Month stats
  const monthAppts = APPOINTMENTS.filter((a) => {
    if (a.staffId !== staffId) return false;
    if (a.status === 'canceled') return false;
    const ad = parseDay(a.day);
    return ad.getMonth() === date.getMonth() && ad.getFullYear() === date.getFullYear();
  });
  const monthHoursBooked = Math.round(monthAppts.reduce((s, a) => s + a.duration, 0) / 60 * 10) / 10;
  const monthClients = new Set(monthAppts.map((a) => a.customerId)).size;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-[26px] leading-none text-ink">{dateLabel}</h1>
          <div className="text-[12.5px] text-muted mt-1">
            {view === 'week' && <>{weekAppts.length} appointments · {weekHoursBooked}h on the books · {weekClients} clients</>}
            {view === 'day' && <>{dayKey === todayDk ? 'Today · ' : ''}{appointmentsFor(staffId, dayKey).length} appointments</>}
            {view === 'month' && <>{monthAppts.length} appointments · {monthHoursBooked}h on the books · {monthClients} clients</>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DatePill
            date={date}
            label={dateLabel}
            onChange={setDate}
            isToday={dayKey === todayDk}
          />
          <Tabs value={view} onChange={setView} tabs={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
          <AddMenuButton onPick={topBarAdd} label="Add" align="right" />
        </div>
      </div>

      {view === 'day' && <EmpDayView date={date} staff={me} onOpen={onOpenAppt} onEditLunch={(dk) => setEditingLunch({ dayKey: dk })} lunchTick={lunchTick} onUpdate={onUpdate} onSlotClick={(p) => setSlotMenu(p)} onEditBlock={(b) => setEditingBlock(b)} onMoveBlock={moveBlock} draggingId={draggingId} setDraggingId={setDraggingId} blocksTick={blocksTick} />}
      {view === 'week' && <EmpWeekView weekDays={weekDays} staff={me} onOpen={onOpenAppt} onEditLunch={(dk) => setEditingLunch({ dayKey: dk })} lunchTick={lunchTick} onUpdate={onUpdate} onSlotClick={(p) => setSlotMenu(p)} onEditBlock={(b) => setEditingBlock(b)} onMoveBlock={moveBlock} draggingId={draggingId} setDraggingId={setDraggingId} blocksTick={blocksTick} />}
      {view === 'month' && <EmpMonthView date={date} staff={me} onOpen={onOpenAppt} onSelectDay={(d) => {setDate(d);setView('day');}} />}

      {/* Time off list */}
      <div className="mt-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-serif text-[22px] text-ink leading-tight">Time off & requests</h3>
              <div className="text-[12.5px] text-muted">Your submitted requests</div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setShowSchedChange(true)}><I.Clock size={14} /> Request schedule change</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowTimeOff(true)}><I.Plus size={14} /> Request time off</Button>
            </div>
          </div>
          <div className="divide-y divide-line">
            {requests.map((req) =>
            <div key={req.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                <div className="w-10 h-10 rounded-lg bg-bg flex items-center justify-center text-ink2 flex-shrink-0">
                  {req.kind === 'schedule_change' ? <I.Clock size={16} /> : <I.Calendar size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[13.5px] text-ink truncate">
                    {req.kind === 'schedule_change' ? fmtSCSummary(req) : fmtTORange(req.from, req.to)}
                  </div>
                </div>
                <div className="text-[11px] text-muted hidden md:block">Submitted {req.submitted}</div>
                {req.status === 'approved' && <Badge tone="accent"><I.Check size={10} /> Approved</Badge>}
                {req.status === 'pending' && <Badge tone="amber">Pending</Badge>}
                {req.status === 'denied' && <Badge tone="rose">Denied</Badge>}
                <div className="flex items-center gap-0.5">
                  <button
                  onClick={() => setEditing(req)}
                  title="Edit request"
                  aria-label="Edit request"
                  className="p-1.5 rounded-md text-muted hover:text-ink hover:bg-bg transition">
                    <I.Edit size={14} />
                  </button>
                  <button
                  onClick={() => setDeleting(req)}
                  title="Delete request"
                  aria-label="Delete request"
                  className="p-1.5 rounded-md text-muted hover:text-rose hover:bg-roseSoft/60 transition">
                    <I.Trash size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Modals */}
      <TimeOffModal
        open={showTimeOff}
        mode="create"
        onClose={() => setShowTimeOff(false)}
        onSubmit={(data) => {
          const id = 'to_' + Date.now();
          setRequests((rs) => [
          ...rs,
          { id, kind: 'time_off', ...data, status: 'pending', submitted: shortToday() }]
          );
        }} />
      
      <ScheduleChangeModal
        open={showSchedChange}
        mode="create"
        staff={me}
        onClose={() => setShowSchedChange(false)}
        onSubmit={(data) => {
          const id = 'sc_' + Date.now();
          setRequests((rs) => [
          ...rs,
          { id, kind: 'schedule_change', ...data, status: 'pending', submitted: shortToday() }]
          );
        }} />

      <TimeOffModal
        open={!!editing && editing.kind !== 'schedule_change'}
        mode="edit"
        initial={editing && editing.kind !== 'schedule_change' ? editing : null}
        onClose={() => setEditing(null)}
        onSubmit={(data) => {
          setRequests((rs) => rs.map((r) => r.id === editing.id ? { ...r, ...data } : r));
        }} />

      <ScheduleChangeModal
        open={!!editing && editing.kind === 'schedule_change'}
        mode="edit"
        staff={me}
        initial={editing && editing.kind === 'schedule_change' ? editing : null}
        onClose={() => setEditing(null)}
        onSubmit={(data) => {
          setRequests((rs) => rs.map((r) => r.id === editing.id ? { ...r, ...data } : r));
        }} />
      
      <DeleteRequestModal
        request={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          setRequests((rs) => rs.filter((r) => r.id !== target.id));
          setDeleting(null);
          showToast({
            title: target.kind === 'schedule_change' ? 'Schedule change request deleted' : 'Time off request deleted',
            body: 'Your request has been withdrawn.',
          });
        }} />
      
      {slotMenu && (
        <SlotTypePicker
          x={slotMenu.x}
          y={slotMenu.y}
          onPick={pickSlotAction}
          onClose={() => setSlotMenu(null)}
        />
      )}

      {creatingBlock && (
        <BlockTimeModal
          mode="create"
          initial={creatingBlock}
          staffOptions={[{ id: me.id, name: me.name }]}
          lockStaff
          onSave={saveNewBlock}
          onClose={() => setCreatingBlock(null)}
        />
      )}

      {editingBlock && (
        <BlockTimeModal
          mode="edit"
          initial={{
            type: editingBlock.type,
            staffId: editingBlock.staffId,
            date: editingBlock.day,
            start: editingBlock.start,
            end: editingBlock.end,
            note: editingBlock.note,
          }}
          block={editingBlock}
          staffOptions={[{ id: me.id, name: me.name }]}
          lockStaff
          onSave={saveExistingBlock}
          onDelete={removeBlock}
          onClose={() => setEditingBlock(null)}
        />
      )}

      {editingLunch && (
        <LunchBreakModal
          staff={me}
          dayKey={editingLunch.dayKey}
          onClose={() => setEditingLunch(null)}
          onSave={() => setLunchTick(n => n + 1)}
        />
      )}
    </div>);

}

// Day view — gutter + single column (this employee only)
export const D_START = 8 * 60;
export const D_END = 21 * 60;
export const PX = 1.4;

export function gridH() {return (D_END - D_START) * PX;}

export function TimeGutter({ width = 72 }) {
  const labels = [];
  for (let m = D_START; m <= D_END; m += 60) labels.push(m);
  return (
    <div className="relative pr-3 select-none" style={{ height: gridH(), width }}>
      {labels.map((m) =>
      <div key={m} className="absolute left-0 right-0 text-[11px] text-muted text-right" style={{ top: (m - D_START) * PX - 6 }}>
          {fmt12(fromMin(m))}
        </div>
      )}
    </div>);

}

export function HourLines() {
  const lines = [];
  for (let m = D_START; m <= D_END; m += 60) lines.push(m);
  return (
    <>
      {lines.map((m) =>
      <div key={m} className="absolute left-0 right-0 border-t border-line/80 pointer-events-none" style={{ top: (m - D_START) * PX }} />
      )}
      {lines.map((m) =>
      <div key={'h' + m} className="absolute left-0 right-0 border-t border-dashed border-line/50 pointer-events-none" style={{ top: (m - D_START + 30) * PX }} />
      )}
    </>);

}

export function NowLine({ visible }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {const t = setInterval(() => setNow(new Date()), 60_000);return () => clearInterval(t);}, []);
  if (!visible) return null;
  const m = now.getHours() * 60 + now.getMinutes();
  if (m < D_START || m > D_END) return null;
  const top = (m - D_START) * PX;
  return (
    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top }}>
      <div className="relative">
        <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-warm" />
        <div className="h-[2px] bg-warm/80" />
      </div>
    </div>);

}

// --- Closed-hours block (business-level) -----------------------------------
// Shades the parts of the grid that fall outside this location's business
// hours for `dayKey`. Distinct from "staff off" (which the surrounding
// stripe-bg already conveys) — this is the business itself being closed.
export function EmpClosedBlocks({ dayKey }) {
  const h = (typeof effectiveBusinessHours === 'function')
    ? effectiveBusinessHours(dayKey)
    : (BUSINESS && BUSINESS.hours && BUSINESS.hours[dayName(dayKey)]);
  if (!h) return null;
  const closureName = h.closureName || '';
  const blocks = [];
  if (h.closed) {
    blocks.push({ key: 'all', top: 0, height: gridH(), edge: null });
  } else {
    const openMin = toMin(h.open);
    const closeMin = toMin(h.close);
    if (openMin > D_START) {
      blocks.push({ key: 'before', top: 0, height: (openMin - D_START) * PX, edge: 'bottom' });
    }
    if (closeMin < D_END) {
      blocks.push({ key: 'after', top: (closeMin - D_START) * PX, height: (D_END - closeMin) * PX, edge: 'top' });
    }
  }
  if (blocks.length === 0) return null;
  return blocks.map(b => (
    <div
      key={b.key}
      aria-label="Closed"
      title={closureName ? `Closed \u2014 ${closureName}` : 'Closed \u2014 business is not open'}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={cx(
        'absolute inset-x-0 z-[6] overflow-hidden stripe-bg bg-bg/50 cursor-default select-none',
        b.edge === 'bottom' && 'border-b border-dashed border-ink/15',
        b.edge === 'top' && 'border-t border-dashed border-ink/15'
      )}
      style={{
        top: b.top,
        height: b.height,
      }}>
      {b.height >= 20 && (
        <div className="px-2 pt-1.5 text-[10px] uppercase tracking-[0.14em] text-muted font-medium leading-none">{closureName ? `Closed \u00b7 ${closureName}` : 'Closed'}</div>
      )}
    </div>
  ));
}

export function WorkingHoursBg({ staff, dn }) {
  const sched = staff.hours[dn];
  if (!Array.isArray(sched)) return null;
  const workStart = toMin(sched[0]);
  const workEnd = toMin(sched[1]);
  return (
    <div className="absolute inset-x-0 bg-surface pointer-events-none" style={{ top: (workStart - D_START) * PX, height: (workEnd - workStart) * PX }} />);

}

export function LunchBlock({ staff, dayKey, onEdit }) {
  const lunch = getLunchFor(staff, dayKey);
  if (!lunch) return null;
  const [ls, le] = lunch.replace('–', '-').split('-');
  const lunchStart = toMin(ls);
  const lunchEnd = toMin(le);
  const h = (lunchEnd - lunchStart) * PX;
  return (
    <button
      type="button"
      onClick={() => onEdit && onEdit(dayKey)}
      aria-label="Edit lunch break"
      title="Edit lunch break"
      className="absolute left-1 right-1 rounded-md border border-dashed border-line2 stripe-bg bg-bg/60 z-[5] select-none overflow-hidden text-left transition hover:bg-bg/80 hover:border-ink2/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
      style={{ top: (lunchStart - D_START) * PX, height: Math.max(h - 2, 14) }}>
      <div className="h-full px-2 py-1 flex flex-col leading-tight">
        <div className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium">{fmt12(ls)}</div>
        {h >= 38 && (
          <div className="text-[12px] font-semibold text-ink2 truncate">Lunch Break</div>
        )}
      </div>
    </button>);

}

export function EmpEventBlock({ appt, staff, onOpen, compact, isDragging, onDragStart, onDragEnd }) {
  const svc = SERVICES.find((s) => s.id === appt.serviceId);
  const cust = CUSTOMERS.find((c) => c.id === appt.customerId);
  const top = (toMin(appt.start) - D_START) * PX;
  const h = (toMin(appt.end) - toMin(appt.start)) * PX;
  const isShort = h < 50;
  const isCompleted = appt.status === 'completed';
  const isNoShow    = appt.status === 'no_show';

  // Buffer (optional) renders as a quieter striped strip attached after the
  // appointment. Not interactive, not counted as its own appointment.
  //
  // Hidden (buf=0) when the buffer would land at end of shift or directly
  // before a lunch/break — matching the validator so back-to-back
  // scheduling against those edges isn't blocked.
  const rawBuf = (svc && svc.bufferAfter) || 0;
  const buf = (typeof effectiveBuffer === 'function')
    ? effectiveBuffer({ staffId: appt.staffId, day: appt.day, endMin: toMin(appt.end), bufferAfter: rawBuf })
    : rawBuf;
  const bufHeight = buf * PX;

  // Match the admin calendar's vocabulary 1:1 so the appointment-block
  // surface is identical across both apps. See data.jsx::STATUS for the
  // matching pill colors.
  //   default (upcoming / confirmed) — solid slate blue, white text
  //   completed                      — solid forest green, white text
  //   no-show                        — light amber wash, ink text
  // Canceled appointments aren't rendered at all (filtered upstream).
  const bg     = isNoShow ? '#FBF4DD' : isCompleted ? '#3F5D43' : '#3D5A7C';
  const color  = isNoShow ? '#1A1815' : '#FFFFFF';
  const border = isNoShow
    ? '1px solid #D4B776'
    : isCompleted
      ? '1px solid #34503A'
      : '1px solid #2E486A';
  const dim    = isNoShow;
  // Closed states (completed / no-show) shouldn't be draggable — they're
  // historical. Confirmed/pending appointments can be moved.
  const draggable = !isCompleted && !isNoShow;

  function handleDragStart(e) {
    if (!draggable) return;
    e.dataTransfer.setData('text/plain', appt.id);
    e.dataTransfer.effectAllowed = 'move';
    try {
      const ghost = e.currentTarget.cloneNode(true);
      ghost.style.position = 'absolute';
      ghost.style.top = '-9999px';
      ghost.style.opacity = '0.85';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 20, 16);
      setTimeout(() => ghost.remove(), 0);
    } catch (_) {}
    onDragStart && onDragStart();
  }

  return (
    <>
      <button
        onClick={() => onOpen(appt)}
        draggable={draggable}
        onDragStart={handleDragStart}
        onDragEnd={() => onDragEnd && onDragEnd()}
        className={cx(
          'calendar-event absolute left-1 right-1 rounded-md text-left overflow-hidden z-10 transition',
          'hover:brightness-110 hover:shadow-md',
          draggable && 'cursor-grab active:cursor-grabbing',
          isDragging && 'opacity-40 ring-2 ring-accent/50'
        )}
        style={{
          top,
          height: Math.max(h - 2, 14),
          background: bg,
          color,
          border,
        }}>
        <div className="h-full px-2 py-1 flex flex-col leading-tight">
          <div className={cx('text-[11.5px] font-medium', dim ? 'text-ink2' : 'text-white/90')}>
            {fmt12(appt.start)}
            {isNoShow && <span className="ml-1.5 text-[10px] uppercase tracking-[0.12em] font-semibold" style={{ color: '#A07A1E' }}>· No-show</span>}
          </div>
          {!isShort && (
            <div className={cx('text-[12.5px] font-semibold truncate', dim ? 'text-ink' : 'text-white')}>
              {cust?.name || 'Walk-in'}
            </div>
          )}
          {h > 60 && (
            <div className={cx('text-[11px] truncate mt-auto', dim ? 'text-muted' : 'text-white/75')}>
              {svc?.name}
              {appt.source === 'ai' && (
                <span className={cx('ml-1.5 inline-block px-1 rounded text-[9px] uppercase tracking-wider font-semibold align-middle', dim ? 'bg-ink text-white' : 'bg-white/20 text-white')}>AI</span>
              )}
            </div>
          )}
        </div>
      </button>
      {buf > 0 && (
        <div
          aria-label={`${buf} minute buffer`}
          title={`${buf} min buffer · slot blocked`}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute left-1 right-1 buffer-bg rounded-b-md border border-t-0 border-line/60 bg-surface/80 z-[9] overflow-hidden cursor-default select-none"
          style={{ top: top + h, height: Math.max(bufHeight - 1, 8) }}>
          {bufHeight >= 18 && (
            <div className="h-full px-2 flex items-center text-[10px] uppercase tracking-[0.12em] text-muted font-medium leading-none">
              +{buf}m buffer
            </div>
          )}
        </div>
      )}
    </>);

}

export function EmpDayView({ date, staff, onOpen, onEditLunch, lunchTick, onUpdate, onSlotClick, onEditBlock, onMoveBlock, draggingId, setDraggingId, blocksTick }) {
  const dk = localDayKey(date);
  const isToday = dk === todayKey();
  const dn = dayName(dk);
  const sched = staff.hours[dn];
  const working = Array.isArray(sched);
  const apps = appointmentsFor(staff.id, dk);

  return (
    <Card className="overflow-hidden">
      <div className="overflow-auto relative" style={{ maxHeight: 'calc(100vh - 320px)' }}>
        {/* Sticky header — pins at top during vertical scroll. */}
        <div className="flex border-b border-line bg-bg/40 px-4 py-3 sticky top-0 z-30">
          <div className="w-[72px] shrink-0 sticky left-0 z-10 bg-bg/40" />
          <div className="flex-1 flex items-center gap-3">
            <StaffAvatar staff={staff} size={28} />
            <div>
              <div className="font-medium text-[13.5px] text-ink leading-tight">{staff.name}</div>
              <div className="text-[11.5px] text-muted">{working ? `${fmt12(sched[0])} – ${fmt12(sched[1])} · ${apps.filter((a) => a.status !== 'canceled').length} appts` : 'Day off'}</div>
            </div>
          </div>
        </div>
        <div className="flex">
          <div className="w-[72px] shrink-0 sticky left-0 z-20 bg-surface pt-2 relative">
            <TimeGutter />
          </div>
          <EmpDayColumn
            staff={staff} day={dk} dn={dn} working={working} isToday={isToday}
            onOpen={onOpen} onEditLunch={onEditLunch} lunchTick={lunchTick}
            onUpdate={onUpdate} onSlotClick={onSlotClick} onEditBlock={onEditBlock} onMoveBlock={onMoveBlock}
            draggingId={draggingId} setDraggingId={setDraggingId} blocksTick={blocksTick}
            className="flex-1 border-l border-line"
          />
        </div>
      </div>
    </Card>);

}

export function EmpWeekView({ weekDays, staff, onOpen, onEditLunch, lunchTick, onUpdate, onSlotClick, onEditBlock, onMoveBlock, draggingId, setDraggingId, blocksTick }) {
  return (
    <Card className="overflow-hidden">
      {/* Single scroll container wraps both header and body so all 7 day
          columns stay locked to their headers during horizontal scroll.
          Previously the header sat outside the scroller, which caused
          Saturday/Sunday to be cut off on narrow screens — the body could
          scroll horizontally but the header stayed pinned. */}
      <div className="overflow-auto relative" style={{ maxHeight: 'calc(100vh - 320px)' }}>
        <div className="flex border-b border-line bg-bg/40 sticky top-0 z-30">
          <div className="w-[72px] shrink-0 sticky left-0 z-40 bg-bg/40" />
          {weekDays.map((d) => {
            const dk = localDayKey(d);
            const isToday = dk === todayKey();
            const dn = dayName(d);
            const sched = staff.hours[dn];
            const working = Array.isArray(sched);
            const dayAppts = appointmentsFor(staff.id, dk).filter((a) => a.status !== 'canceled');
            return (
              <div key={dk} className="flex-1 min-w-[140px] shrink-0 border-l border-line px-3 py-3 text-center bg-bg/40">
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div className={cx('font-serif text-[22px] mt-0.5', isToday ? 'text-warm' : working ? 'text-ink' : 'text-muted')}>{d.getDate()}</div>
                <div className="text-[10.5px] text-muted mt-0.5">
                  {working ? `${dayAppts.length} appts` : 'Off'}
                </div>
              </div>);

          })}
        </div>
        <div className="flex">
          <div className="w-[72px] shrink-0 sticky left-0 z-20 bg-surface pt-2 relative">
            <TimeGutter />
          </div>
          <div className="flex flex-1 relative">
            {weekDays.map((d) => {
              const dk = localDayKey(d);
              const isToday = dk === todayKey();
              const dn = dayName(d);
              const sched = staff.hours[dn];
              const working = Array.isArray(sched);
              return (
                <EmpDayColumn
                  key={dk}
                  staff={staff} day={dk} dn={dn} working={working} isToday={isToday}
                  onOpen={onOpen} onEditLunch={onEditLunch} lunchTick={lunchTick}
                  onUpdate={onUpdate} onSlotClick={onSlotClick} onEditBlock={onEditBlock} onMoveBlock={onMoveBlock}
                  draggingId={draggingId} setDraggingId={setDraggingId} blocksTick={blocksTick}
                  className="flex-1 min-w-[140px] shrink-0 border-l border-line"
                  showDayOff
                />);

            })}
          </div>
        </div>
      </div>
    </Card>);

}

// Single-day column. Used as the body of EmpDayView and as each cell of
// EmpWeekView. Handles drag-to-reschedule + click-to-add for that day.
export function EmpDayColumn({ staff, day, dn, working, isToday, onOpen, onEditLunch, lunchTick, onUpdate, onSlotClick, onEditBlock, onMoveBlock, draggingId, setDraggingId, blocksTick, className, showDayOff }) {
  // eslint-disable-next-line no-unused-vars
  const _btick = blocksTick;
  // Canceled appointments shouldn't appear on the calendar — they're not
  // active bookings. Match the admin calendar's behavior.
  const apps = appointmentsFor(staff.id, day).filter(a => a.status !== 'canceled');
  const blocks = (typeof BLOCKS !== 'undefined' ? BLOCKS : [])
    .filter(b => b.staffId === staff.id && b.day === day);
  const [hoverMin, setHoverMin] = useState(null);

  function minutesFromEvent(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    return timeFromY(y, D_START, PX, 15);
  }

  function handleClick(e) {
    if (!onSlotClick) return;
    if (e.target.closest('button, a')) return;
    const min = minutesFromEvent(e);
    if (min < D_START || min >= D_END) return;
    // Validate the slot is actually available — rejects clicks on closed
    // hours, off-shift time, day off, lunch, an existing appointment, or
    // a manual block. Surfaces the reason as a red-X toast so it matches
    // the drag-error language.
    const v = validateApptSlot({
      staffId: staff.id, day,
      startMin: min, endMin: min + 1,
    });
    if (!v.ok) {
      showToast({ title: "Can't add here", body: v.reason, tone: 'error' });
      return;
    }
    onSlotClick({ x: e.clientX, y: e.clientY, date: day, start: fromMin(min), staffId: staff.id });
  }

  function handleDragOver(e) {
    if (!draggingId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setHoverMin(minutesFromEvent(e));
  }

  function handleDragLeave() { setHoverMin(null); }

  function handleDrop(e) {
    e.preventDefault();
    setHoverMin(null);
    const data = e.dataTransfer.getData('text/plain') || draggingId || '';
    setDraggingId && setDraggingId(null);

    // Block drag
    if (typeof data === 'string' && data.startsWith('block:')) {
      const blockId = data.slice(6);
      const block = (typeof BLOCKS !== 'undefined' ? BLOCKS : []).find(b => b.id === blockId);
      if (!block) return;
      const startMin = minutesFromEvent(e);
      const duration = toMin(block.end) - toMin(block.start);
      const endMin = startMin + duration;
      const v = validateBlockSlot({
        staffId: staff.id,
        day,
        startMin,
        endMin,
        excludeBlockId: block.id,
      });
      if (!v.ok) {
        showToast({ title: "Couldn't move block", body: v.reason, tone: 'error' });
        return;
      }
      if (block.staffId === staff.id && block.day === day && toMin(block.start) === startMin) return;
      onMoveBlock && onMoveBlock(block, { staffId: staff.id, day, startMin });
      const when = parseDay(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      showToast({ title: 'Block moved', body: `${when} · ${fmt12(fromMin(startMin))}` });
      return;
    }

    // Appointment drag
    const apptId = data;
    const appt = APPOINTMENTS.find(a => a.id === apptId);
    if (!appt) return;
    const startMin = minutesFromEvent(e);
    const duration = toMin(appt.end) - toMin(appt.start);
    const endMin = startMin + duration;
    const apptSvc = SERVICES.find(s => s.id === appt.serviceId);
    const apptBuf = (apptSvc && apptSvc.bufferAfter) || 0;
    const v = validateApptSlot({
      staffId: staff.id,
      day,
      startMin,
      endMin,
      bufferAfter: apptBuf,
      excludeId: appt.id,
    });
    if (!v.ok) {
      showToast({ title: "Couldn't move appointment", body: v.reason, tone: 'error' });
      return;
    }
    if (appt.staffId === staff.id && appt.day === day && toMin(appt.start) === startMin) return;
    onUpdate && onUpdate({
      ...appt,
      staffId: staff.id,
      day,
      start: fromMin(startMin),
      end: fromMin(endMin),
    });
    const when = parseDay(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    showToast({ title: 'Appointment moved', body: `${when} · ${fmt12(fromMin(startMin))}` });
  }

  // Ghost preview.
  let ghost = null;
  if (draggingId && hoverMin != null) {
    let dur = 0;
    if (typeof draggingId === 'string' && draggingId.startsWith('block:')) {
      const blockId = draggingId.slice(6);
      const dragged = (typeof BLOCKS !== 'undefined' ? BLOCKS : []).find(b => b.id === blockId);
      if (dragged) dur = toMin(dragged.end) - toMin(dragged.start);
    } else {
      const dragged = APPOINTMENTS.find(a => a.id === draggingId);
      if (dragged) dur = toMin(dragged.end) - toMin(dragged.start);
    }
    if (dur > 0) {
      ghost = (
        <div
          className="absolute left-1 right-1 rounded-md border-2 border-dashed border-accent/70 bg-accent/10 pointer-events-none z-[8]"
          style={{
            top: (hoverMin - D_START) * PX,
            height: Math.max(dur * PX - 2, 22),
          }}>
          <div className="px-2 py-1 text-[11px] font-medium text-accentInk">{fmt12(fromMin(hoverMin))}</div>
        </div>
      );
    }
  }

  return (
    <div
      className={cx(
        'relative',
        className,
        onSlotClick && 'cursor-copy',
        draggingId && 'bg-accentSoft/10'
      )}
      // Explicit height matches the gutter so the column's hit-test area
      // covers the entire grid. Without this, clicks below the scroll
      // container's fold (e.g. afternoon slots) miss the column box and
      // never trigger handleClick.
      style={{ height: gridH() }}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      title={onSlotClick ? 'Click an empty slot to book or block' : undefined}>
      <div className="absolute inset-x-0 stripe-bg pointer-events-none" style={{ top: 0, height: gridH() }} />
      <WorkingHoursBg staff={staff} dn={dn} />
      <EmpClosedBlocks dayKey={day} />
      <NotWorkingBlocks
        staff={staff}
        dayKey={day}
        dayStartMin={D_START}
        dayEndMin={D_END}
        pxPerMin={PX}
      />
      {working && <LunchBlock key={'lb:' + day + ':' + lunchTick} staff={staff} dayKey={day} onEdit={onEditLunch} />}
      <HourLines />
      <NowLine visible={isToday && working} />
      {ghost}
      {blocks.map((b) =>
        <UserBlockEvent
          key={b.id}
          block={b}
          pxPerMin={PX}
          dayStartMin={D_START}
          onEdit={onEditBlock}
          isDragging={draggingId === 'block:' + b.id}
          onDragStart={() => setDraggingId && setDraggingId('block:' + b.id)}
          onDragEnd={() => setDraggingId && setDraggingId(null)}
        />
      )}
      {apps.map((a) =>
        <EmpEventBlock
          key={a.id}
          appt={a}
          staff={staff}
          onOpen={onOpen}
          isDragging={draggingId === a.id}
          onDragStart={() => setDraggingId && setDraggingId(a.id)}
          onDragEnd={() => setDraggingId && setDraggingId(null)}
        />
      )}
    </div>
  );
}

export function EmpMonthView({ date, staff, onOpen, onSelectDay }) {
  // Rolling 6-week (42-day) grid starting at the selected date. The grid
  // is dynamic: column 0 always represents the weekday of the selected day.
  const gridStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
    return d;
  });
  // Day-of-week labels rotate so the first column matches the start day.
  const allDows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const startDow = gridStart.getDay();
  const dows = Array.from({ length: 7 }, (_, i) => allDows[(startDow + i) % 7]);
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <Card className="overflow-hidden">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-line bg-bg/40">
        {dows.map((d, i) =>
        <div key={i} className="px-3 py-2.5 text-[11px] uppercase tracking-[0.14em] text-muted text-center border-l border-line first:border-l-0">{d}</div>
        )}
      </div>
      {/* Cells */}
      <div className="grid grid-cols-7 grid-rows-6" style={{ minHeight: 540 }}>
        {cells.map((d, i) => {
          const dk = localDayKey(d);
          const isToday = dk === todayKey();
          const dn = dayName(d);
          const sched = staff.hours[dn];
          const working = Array.isArray(sched);
          const apps = appointmentsFor(staff.id, dk).
          filter((a) => a.status !== 'canceled').
          sort((a, b) => toMin(a.start) - toMin(b.start));
          const visibleApps = apps.slice(0, 3);
          const moreCount = apps.length - visibleApps.length;
          const rowIdx = Math.floor(i / 7);
          // A cell is a "month start" when it's the 1st of its month, OR
          // it's the very first cell in the grid (so the initial month is
          // labeled even if it starts mid-month).
          const isMonthStart = d.getDate() === 1 || i === 0;
          const monthLabel = MONTH_NAMES[d.getMonth()];
          // For month-shading: alternate background between consecutive months
          // so the user can see at a glance where one month ends and another
          // begins. Starting month = no tint; second month = subtle bg/40.
          const monthsSeen = new Set();
          // Walk forward from start to determine which "month index" this is
          // (0 = first visible month, 1 = second, ...). Simple but cheap for 42 cells.
          let monthIdx = 0;
          for (let k = 0; k <= i; k++) {
            const cd = cells[k];
            const key = `${cd.getFullYear()}-${cd.getMonth()}`;
            if (!monthsSeen.has(key)) {
              monthsSeen.add(key);
              if (k > 0) monthIdx++;
            }
          }
          const altShade = monthIdx % 2 === 1;
          return (
            <button
              key={dk}
              onClick={() => onSelectDay(d)}
              className={cx(
                'text-left p-2 border-l border-t border-line first:border-l-0 transition relative group',
                rowIdx === 0 && '!border-t-0',
                working && 'hover:bg-bg/60',
                !working && 'stripe-bg',
                altShade && 'bg-bg/30',
                isMonthStart && i !== 0 && '!border-t-2 !border-t-ink/40'
              )}
              style={{ minHeight: 90 }}>
              {isMonthStart && (
                <div className="absolute -top-px left-1.5 px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.14em] font-semibold text-ink bg-surface border border-line2 rounded-sm leading-none translate-y-[-50%]">
                  {monthLabel}
                </div>
              )}
              <div className="flex items-center justify-between mb-1">
                <span className={cx(
                  'inline-flex items-center justify-center text-[12.5px] font-medium',
                  isToday ? 'h-6 w-6 rounded-full bg-warm text-white' :
                  !working ? 'text-muted' : 'text-ink'
                )}>{d.getDate()}</span>
                {!working &&
                <span className="text-[10px] uppercase tracking-wider text-muted">Off</span>
                }
                {working && apps.length > 0 &&
                <span className="text-[10.5px] text-muted font-mono">{apps.length}</span>
                }
              </div>
              <div className="space-y-0.5">
                {visibleApps.map((a) => {
                  const cust = CUSTOMERS.find((c) => c.id === a.customerId);
                  const isComplete = a.status === 'completed';
                  const isNoShow = a.status === 'no_show';
                  // Mini-chips mirror the full-block color system:
                  // blue for upcoming, green for completed, amber for no-show.
                  const bg = isNoShow ? '#FBF4DD' : isComplete ? '#EAEFE8' : '#E4EAF1';
                  const borderColor = isNoShow ? '#D4B776' : isComplete ? '#B8C7B8' : '#B6C2D6';
                  const accentRule  = isNoShow ? '#A07A1E' : isComplete ? '#3F5D43' : '#3D5A7C';
                  return (
                    <div
                      key={a.id}
                      onClick={(e) => {e.stopPropagation();onOpen(a);}}
                      className="rounded px-1.5 py-0.5 text-[10.5px] truncate cursor-pointer hover:brightness-95"
                      style={{
                        background: bg,
                        border: `1px solid ${borderColor}`,
                        borderLeft: `2px solid ${accentRule}`,
                        color: '#1A1815'
                      }}>
                      <span className="font-mono text-muted mr-1">{fmt12(a.start).replace(' ', '')}</span>
                      <span className="font-medium">{cust.name.split(' ')[0]}</span>
                    </div>);

                })}
                {moreCount > 0 &&
                <div className="px-1.5 text-[10.5px] text-muted">+{moreCount} more</div>
                }
              </div>
            </button>);

        })}
      </div>
    </Card>);

}

export function parseISODate(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export const TO_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtTORange(from, to) {
  const f = parseISODate(from);const t = parseISODate(to);
  if (!f || !t) return '';
  if (from === to) return `${TO_MONTHS[f.getMonth()]} ${f.getDate()}, ${f.getFullYear()}`;
  const sameMonth = f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear();
  if (sameMonth) return `${TO_MONTHS[f.getMonth()]} ${f.getDate()} – ${t.getDate()}, ${t.getFullYear()}`;
  const sameYear = f.getFullYear() === t.getFullYear();
  if (sameYear) return `${TO_MONTHS[f.getMonth()]} ${f.getDate()} – ${TO_MONTHS[t.getMonth()]} ${t.getDate()}, ${t.getFullYear()}`;
  return `${TO_MONTHS[f.getMonth()]} ${f.getDate()}, ${f.getFullYear()} – ${TO_MONTHS[t.getMonth()]} ${t.getDate()}, ${t.getFullYear()}`;
}
export function daysBetweenISO(from, to) {
  const f = parseISODate(from);const t = parseISODate(to);
  if (!f || !t) return 0;
  return Math.max(1, Math.round((t - f) / 86400000) + 1);
}
export function shortToday() {
  const d = new Date();
  return `${TO_MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`;
}

export function TimeOffModal({ open, mode = 'create', initial, onClose, onSubmit }) {
  const isEdit = mode === 'edit';

  const seed = useMemo(() => {
    if (isEdit && initial) {
      return { from: initial.from, to: initial.to, type: initial.type || '', reason: initial.reason || '' };
    }
    return { from: '2026-07-03', to: '2026-07-07', type: '', reason: '' };
  }, [isEdit, initial]);

  const [from, setFrom] = useState(seed.from);
  const [to, setTo] = useState(seed.to);
  const [type, setType] = useState(seed.type);
  const [reason, setReason] = useState(seed.reason);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Reset when modal opens (or seed changes)
  useEffect(() => {
    if (open) {
      setFrom(seed.from);setTo(seed.to);setType(seed.type);setReason(seed.reason);
      setConfirmDiscard(false);
    }
  }, [open, seed]);

  const isDirty =
  from !== seed.from ||
  to !== seed.to ||
  type !== seed.type ||
  (reason || '') !== (seed.reason || '');

  const isValid = !!from && !!to && !!type;

  function attemptClose() {
    if (isDirty) setConfirmDiscard(true);else
    onClose();
  }

  function handleSubmit() {
    if (!isValid) return;
    if (isEdit && !isDirty) return;
    onSubmit?.({ from, to, type, reason });
    onClose();
  }

  if (!open) return null;

  const title = isEdit ? 'Edit time off request' : 'Request time off';
  const subtitle = isEdit ?
  'Update your request. Your manager will be notified of any changes.' :
  'Your manager will be notified for approval.';
  const primaryLabel = isEdit ? 'Save changes' : 'Submit request';
  const primaryDisabled = !isValid || isEdit && !isDirty;

  return (
    <>
      <Modal open={open} onClose={attemptClose} maxWidth="max-w-md">
        <div className="p-6">
          <div className="flex items-start justify-between mb-1">
            <h2 className="font-serif text-[28px] text-ink leading-tight">{title}</h2>
            <button onClick={attemptClose} className="text-muted hover:text-ink p-1 -mr-1"><I.X size={16} /></button>
          </div>
          <p className="text-[13px] text-muted mb-5">{subtitle}</p>
          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="From"><DateInput value={from} onChange={(v) => setFrom(v)} /></Field>
              <Field label="To"><DateInput value={to} min={from || undefined} onChange={(v) => setTo(v)} /></Field>
            </div>
            <Field label="Type">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={type ? undefined : { color: '#8A857B' }}>
                <option value="" disabled hidden>Select type</option>
                <option value="vacation">Vacation</option>
                <option value="sick">Sick leave</option>
                <option value="personal">Personal day</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Reason" optional>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional note for your manager…" rows={3} />
            </Field>
            <div className="rounded-lg border border-line bg-bg/50 p-3 flex items-start gap-2.5">
              <I.Bell size={14} className="text-ink2 mt-0.5 flex-shrink-0" />
              <div className="text-[12px] text-ink2">
                {isEdit ?
                <>This request covers <span className="font-medium text-ink">{daysBetweenISO(from, to)} {daysBetweenISO(from, to) === 1 ? 'day' : 'days'}</span>. Changes will be re-sent for approval.</> :
                <>You have <span className="font-medium text-ink">3 appointments</span> in that window. We'll automatically notify clients and offer rebooking.</>}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={attemptClose}>Cancel</Button>
            <Button variant="accent" onClick={handleSubmit} disabled={primaryDisabled}>{primaryLabel}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmDiscard} onClose={() => setConfirmDiscard(false)} maxWidth="max-w-sm">
        <div className="p-6">
          <h3 className="font-serif text-[22px] text-ink leading-tight mb-1">Discard unsaved changes?</h3>
          <p className="text-[13px] text-muted mb-5">You've made changes to this request that haven't been saved yet. If you leave now, those changes will be lost.</p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
            <Button variant="accent" onClick={() => {setConfirmDiscard(false);onClose();}}>Discard changes</Button>
          </div>
        </div>
      </Modal>
    </>);

}

export function DeleteRequestModal({ request, onClose, onConfirm }) {
  const isSC = request && request.kind === 'schedule_change';
  return (
    <Modal open={!!request} onClose={onClose} maxWidth="max-w-sm">
      {request &&
      <div className="p-6">
          <h3 className="font-serif text-[22px] text-ink leading-tight mb-1">
            {isSC ? 'Delete schedule change request?' : 'Delete time off request?'}
          </h3>
          <p className="text-[13px] text-muted mb-4">
            This will remove your request for{' '}
            <span className="font-medium text-ink">
              {isSC ? fmtSCSummary(request) : fmtTORange(request.from, request.to)}
            </span>. This can't be undone.
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="danger" onClick={onConfirm}>
              Delete request
            </Button>
          </div>
        </div>
      }
    </Modal>);

}

export const SC_TYPES = {
  late:   'Coming in late',
  early:  'Leaving early',
  custom: 'Custom schedule adjustment',
  other:  'Other',
};

export function fmtSCSummary(req) {
  const d = parseISODate(req.date);
  const day = d ? d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }) : '';
  const range = (req.startTime && req.endTime) ? `${fmt12(req.startTime)} – ${fmt12(req.endTime)}` : '';
  const label = SC_TYPES[req.type];
  return [day, label, range].filter(Boolean).join(' · ');
}

export function ScheduleChangeModal({ open, mode = 'create', initial, staff, onClose, onSubmit }) {
  const isEdit = mode === 'edit';

  const seed = useMemo(() => {
    if (isEdit && initial) {
      return {
        date: initial.date,
        type: initial.type || '',
        startTime: initial.startTime || '09:00',
        endTime:   initial.endTime   || '17:00',
        reason:    initial.reason    || '',
      };
    }
    return {
      date: todayKey(),
      type: '',
      startTime: '09:00',
      endTime: '17:00',
      reason: '',
    };
  }, [isEdit, initial]);

  const [date, setDate] = useState(seed.date);
  const [type, setType] = useState(seed.type);
  const [startTime, setStartTime] = useState(seed.startTime);
  const [endTime, setEndTime] = useState(seed.endTime);
  const [reason, setReason] = useState(seed.reason);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(seed.date);
      setType(seed.type);
      setStartTime(seed.startTime);
      setEndTime(seed.endTime);
      setReason(seed.reason);
      setConfirmDiscard(false);
    }
  }, [open, seed]);

  const isDirty =
    date !== seed.date ||
    type !== seed.type ||
    startTime !== seed.startTime ||
    endTime !== seed.endTime ||
    (reason || '') !== (seed.reason || '');

  const isValid = !!date && !!type && !!startTime && !!endTime;

  function attemptClose() {
    if (isDirty) setConfirmDiscard(true);
    else onClose();
  }

  function handleSubmit() {
    if (!isValid) return;
    if (isEdit && !isDirty) return;
    onSubmit?.({ date, type, startTime, endTime, reason });
    onClose();
  }

  // Current scheduled hours for the picked day
  const currentSched = useMemo(() => {
    const d = parseISODate(date);
    if (!d || !staff || !staff.hours) return null;
    const dn = dayName(d);
    const s = staff.hours[dn];
    return Array.isArray(s) ? s : null;
  }, [date, staff]);

  if (!open) return null;

  const title = isEdit ? 'Edit schedule change request' : 'Request schedule change';
  const subtitle = isEdit
    ? 'Update your schedule change. Your manager will be notified of any changes.'
    : 'Adjust your hours for a specific day. Your manager will be notified for approval.';
  const primaryLabel = isEdit ? 'Save changes' : 'Submit request';
  const primaryDisabled = !isValid || (isEdit && !isDirty);

  return (
    <>
      <Modal open={open} onClose={attemptClose} maxWidth="max-w-md">
        <div className="p-6">
          <div className="flex items-start justify-between mb-1">
            <h2 className="font-serif text-[28px] text-ink leading-tight">{title}</h2>
            <button onClick={attemptClose} className="text-muted hover:text-ink p-1 -mr-1"><I.X size={16} /></button>
          </div>
          <p className="text-[13px] text-muted mb-5">{subtitle}</p>
          <div className="space-y-3.5">
            <Field label="Type">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={type ? undefined : { color: '#8A857B' }}>
                <option value="" disabled hidden>Select type</option>
                <option value="late">Coming in late</option>
                <option value="early">Leaving early</option>
                <option value="custom">Custom schedule adjustment</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Date">
              <DateInput value={date} onChange={(v) => setDate(v)} />
            </Field>
            {currentSched ? (
              <div className="flex items-center gap-2 -mt-1 text-[12px] text-ink2">
                <I.Clock size={12} className="text-muted" />
                Currently scheduled: <span className="font-medium text-ink">{fmt12(currentSched[0])} – {fmt12(currentSched[1])}</span>
              </div>
            ) : date ? (
              <div className="flex items-center gap-2 -mt-1 text-[12px] text-muted">
                <I.Clock size={12} />
                No hours scheduled this day
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Requested start"><TimePicker value={startTime} onChange={setStartTime} /></Field>
              <Field label="Requested end"><TimePicker value={endTime} onChange={setEndTime} /></Field>
            </div>
            <Field label="Reason" optional>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional note for your manager…" rows={3} />
            </Field>
          </div>
          <div className="flex items-center justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={attemptClose}>Cancel</Button>
            <Button variant="accent" onClick={handleSubmit} disabled={primaryDisabled}>{primaryLabel}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmDiscard} onClose={() => setConfirmDiscard(false)} maxWidth="max-w-sm">
        <div className="p-6">
          <h3 className="font-serif text-[22px] text-ink leading-tight mb-1">Discard unsaved changes?</h3>
          <p className="text-[13px] text-muted mb-5">You've made changes to this request that haven't been saved yet. If you leave now, those changes will be lost.</p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
            <Button variant="accent" onClick={() => { setConfirmDiscard(false); onClose(); }}>Discard changes</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function BlockTimeForm({ onClose }) {
  const [from, setFrom] = useState('14:00');
  const [to, setTo] = useState('15:00');
  const [date, setDate] = useState(todayKey());
  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-1">
        <h2 className="font-serif text-[28px] text-ink leading-tight">Block time</h2>
        <button onClick={onClose} className="text-muted hover:text-ink p-1 -mr-1"><I.X size={16} /></button>
      </div>
      <p className="text-[13px] text-muted mb-5">Mark yourself unavailable for a slot. New bookings will skip this window.</p>
      <div className="space-y-3.5">
        <Field label="Date"><DateInput value={date} onChange={setDate} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><TimePicker value={from} onChange={setFrom} /></Field>
          <Field label="To"><TimePicker value={to} onChange={setTo} /></Field>
        </div>
        <Field label="Label">
          <input type="text" placeholder="e.g. Personal · Training · Coffee break" />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-2 mt-6">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="accent" onClick={onClose}>Block this time</Button>
      </div>
    </div>);

}

window.EmployeeCalendar = EmployeeCalendar;