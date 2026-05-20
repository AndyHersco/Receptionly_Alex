import { useEffect, useState } from 'react';
import { AddMenuButton, BLOCK_TYPES, BlockTimeModal, NotWorkingBlocks, SlotTypePicker, UserBlockEvent, addBlock, deleteBlock, updateBlock } from './blocks';
import { effectiveBuffer, effectiveBusinessHours, timeFromY, validateApptSlot, validateBlockSlot } from './calendar-actions';
import { BLOCKS, BUSINESS, CUSTOMERS, SERVICES, STAFF, dayName, fmt12, fromMin, localDayKey, parseDay, toMin, todayKey } from './data';
import { I } from './icons';
import { LunchBreakModal, getLunchFor } from './lunch-break-modal';
import { Card, DatePill, StaffAvatar, cx, showToast } from './ui';

// Calendar page — schedule grid with staff columns.
//
// Layout matches the spec screenshot:
//   • Header: small-caps "SCHEDULE" eyebrow + serif "Calendar" title,
//     accent "New appointment" button, prev/next chevrons, date pill.
//   • Clean white grid with hour lines; staff columns headed by avatar +
//     first name + role.
//   • Appointments render as solid accent blocks with the start time and
//     customer name in white.
//   • A rose "now" indicator spans the full width with the current time
//     labeled at the gutter.

export function CalendarPage({ appointments, onOpen, onAddAppointment, onUpdate }) {
  const [date, setDate] = useState(new Date());
  // Lunch break edit: holds {staff, dayKey} for the row being edited, plus a
  // tick the child views can read so they re-render after the override
  // mutation persists.
  const [editingLunch, setEditingLunch] = useState(null);
  const [lunchTick, setLunchTick] = useState(0);
  // Slot-type menu shown when the user clicks an empty grid spot. Holds the
  // anchor coordinates plus the prefill (date / start / staffId).
  const [slotMenu, setSlotMenu] = useState(null);
  // Block modal state — separate "creating new" vs "editing existing".
  const [creatingBlock, setCreatingBlock] = useState(null);
  const [editingBlock, setEditingBlock] = useState(null);
  // Bumped after any block mutation so the column views re-derive from BLOCKS.
  const [blocksTick, setBlocksTick] = useState(0);

  // Top-bar Add dropdown: opens the appointment modal OR seeds the block
  // modal with sensible defaults (today's date in the calendar, mid-day
  // start time, first visible staff). The block modal still lets the user
  // pick a different staff before saving.
  function topBarAdd(action) {
    if (action === 'appointment') {
      onAddAppointment && onAddAppointment();
      return;
    }
    const defaultStaff = STAFF.find(s => s.active && Array.isArray(s.hours[dayName(localDayKey(date))]))
      || STAFF[0];
    setCreatingBlock({
      type: action,
      staffId: defaultStaff ? defaultStaff.id : '',
      date: localDayKey(date),
      start: '14:00',
      end: '14:30',
      note: '',
    });
  }

  function shiftDate(days) {
    const d = new Date(date); d.setDate(d.getDate() + days); setDate(d);
  }

  // Resolves a slot-menu choice into the right downstream action.
  function pickSlotAction(action) {
    const prefill = slotMenu;
    setSlotMenu(null);
    if (!prefill) return;
    if (action === 'appointment') {
      onAddAppointment && onAddAppointment({ date: prefill.date, start: prefill.start, staffId: prefill.staffId });
    } else {
      // break / lunch_break
      setCreatingBlock({
        type: action,
        staffId: prefill.staffId,
        date: prefill.date,
        start: prefill.start,
        end: fromMin(toMin(prefill.start) + 30),
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

  // Moves a block to a new {staffId, day, startMin} (drag-drop result).
  function moveBlock(block, target) {
    const duration = toMin(block.end) - toMin(block.start);
    const newBlock = {
      ...block,
      staffId: target.staffId,
      day: target.day,
      start: fromMin(target.startMin),
      end: fromMin(target.startMin + duration),
    };
    updateBlock(newBlock);
    setBlocksTick(n => n + 1);
  }

  const dayKey = localDayKey(date);
  const todayDk = todayKey();
  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-medium mb-2">Schedule</div>
          <h1 className="font-serif text-[40px] leading-[1.05] text-ink">Calendar</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <AddMenuButton onPick={topBarAdd} label="Add" align="right" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => shiftDate(-1)}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-surface border border-line text-ink2 hover:text-ink hover:border-line2 transition"
              title="Previous day">
              <I.ChevronLeft size={16} />
            </button>
            <DatePill
              date={date}
              label={dateLabel}
              onChange={setDate}
              isToday={dayKey === todayDk}
            />
            <button
              onClick={() => shiftDate(1)}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-surface border border-line text-ink2 hover:text-ink hover:border-line2 transition"
              title="Next day">
              <I.ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg">
        <DayView
          date={date}
          appointments={appointments}
          onOpen={onOpen}
          onUpdate={onUpdate}
          onSlotClick={(payload) => setSlotMenu(payload)}
          onEditBlock={(b) => setEditingBlock(b)}
          onMoveBlock={moveBlock}
          onEditLunch={(staff, dayKey) => setEditingLunch({ staff, dayKey })}
          lunchTick={lunchTick}
          blocksTick={blocksTick}
        />
      </div>

      {editingLunch && (
        <LunchBreakModal
          staff={editingLunch.staff}
          dayKey={editingLunch.dayKey}
          onClose={() => setEditingLunch(null)}
          onSave={() => setLunchTick(n => n + 1)}
        />
      )}

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
          staffOptions={STAFF.map(s => ({ id: s.id, name: s.name }))}
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
          staffOptions={STAFF.map(s => ({ id: s.id, name: s.name }))}
          onSave={saveExistingBlock}
          onDelete={removeBlock}
          onClose={() => setEditingBlock(null)}
        />
      )}
    </div>
  );
}

// --- Grid sizing ------------------------------------------------------------
export const DAY_START = 8 * 60;    // 8:00
export const DAY_END = 21 * 60;     // 21:00
export const PX_PER_MIN = 1.1;

export function gridHeight() { return (DAY_END - DAY_START) * PX_PER_MIN; }
export function topFor(t) { return (toMin(t) - DAY_START) * PX_PER_MIN; }
export function heightFor(start, end) { return (toMin(end) - toMin(start)) * PX_PER_MIN; }

// --- Time gutter & grid lines -----------------------------------------------
export function TimeGutter() {
  const labels = [];
  for (let m = DAY_START; m <= DAY_END; m += 60) labels.push(m);
  return (
    <div className="relative pr-3 select-none" style={{ height: gridHeight(), width: 72 }}>
      {labels.map((m) => (
        <div
          key={m}
          className="absolute left-0 right-0 text-[11.5px] text-muted text-right"
          style={{ top: (m - DAY_START) * PX_PER_MIN - 6 }}>
          {fmt12(fromMin(m))}
        </div>
      ))}
    </div>
  );
}

export function HourLines() {
  const lines = [];
  for (let m = DAY_START; m <= DAY_END; m += 60) lines.push(m);
  return (
    <>
      {lines.map((m) => (
        <div
          key={m}
          className="absolute left-0 right-0 border-t border-line/80 pointer-events-none"
          style={{ top: (m - DAY_START) * PX_PER_MIN }}
        />
      ))}
    </>
  );
}

// --- "Now" indicator --------------------------------------------------------
// Spans the entire grid width. Time label is positioned in the gutter at the
// line height — rendered as a sibling of the gutter so it can overlap.
export function NowLine({ visible, withLabel = false }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (!visible) return null;
  const m = now.getHours() * 60 + now.getMinutes();
  if (m < DAY_START || m > DAY_END) return null;
  const top = (m - DAY_START) * PX_PER_MIN;
  if (withLabel) {
    // Label-only variant for the gutter
    return (
      <div
        className="absolute right-3 text-[11px] text-rose font-medium select-none"
        style={{ top: top - 6 }}>
        {fmt12(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)}
      </div>
    );
  }
  return (
    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top }}>
      <div className="relative">
        <div className="absolute -left-1 -top-[3px] w-1.5 h-1.5 rounded-full bg-rose" />
        <div className="h-px bg-rose/80" />
      </div>
    </div>
  );
}

// --- Lunch block ------------------------------------------------------------
// Renders this staff's lunch break for `dayKey` as a "blocked" slot.
// Visually muted (dashed border, striped gray) so it reads as unavailable
// time rather than a customer booking. Click opens the edit modal scoped to
// this specific date.
export function LunchBlock({ staff, dn, dayKey, onEdit }) {
  // Only show if the staff works this day AND has a lunch (default or override).
  const sched = staff.hours[dn];
  if (!Array.isArray(sched)) return null;
  const lunch = getLunchFor(staff, dayKey);
  if (!lunch) return null;
  const [ls, le] = lunch.replace('–', '-').split('-');
  const top = topFor(ls);
  const h = heightFor(ls, le);
  return (
    <button
      type="button"
      onClick={() => onEdit && onEdit(staff, dayKey)}
      aria-label={`Edit lunch break for ${staff.name}`}
      title="Edit lunch break"
      className="absolute left-1 right-1 rounded-md border border-dashed border-line2 stripe-bg bg-bg/60 z-[5] select-none overflow-hidden text-left transition hover:bg-bg/80 hover:border-ink2/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
      style={{ top, height: Math.max(h - 2, 14) }}>
      <div className="h-full px-2 py-1 flex flex-col leading-tight">
        <div className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium">
          {fmt12(ls)}
        </div>
        {h >= 38 && (
          <div className="text-[12px] font-semibold text-ink2 truncate">Lunch Break</div>
        )}
      </div>
    </button>
  );
}

// --- Closed-hours block ----------------------------------------------------
// Reads the active location's BUSINESS.hours[dayName] and shades the parts of
// the grid that fall outside opening hours — above the open time, below the
// close time, or the full grid if the business is closed that day. Renders
// as a muted slate fill with a thin dashed boundary so it reads as a
// different category than appointments / lunch / buffer.
export function ClosedBlocks({ dayKey }) {
  const h = (typeof effectiveBusinessHours === 'function')
    ? effectiveBusinessHours(dayKey)
    : (BUSINESS && BUSINESS.hours && BUSINESS.hours[dayName(dayKey)]);
  if (!h) return null;
  const closureName = h.closureName || '';
  const blocks = [];
  if (h.closed) {
    blocks.push({ key: 'all', top: 0, height: gridHeight(), edge: null });
  } else {
    const openMin = toMin(h.open);
    const closeMin = toMin(h.close);
    if (openMin > DAY_START) {
      blocks.push({
        key: 'before',
        top: 0,
        height: (openMin - DAY_START) * PX_PER_MIN,
        edge: 'bottom',
      });
    }
    if (closeMin < DAY_END) {
      blocks.push({
        key: 'after',
        top: (closeMin - DAY_START) * PX_PER_MIN,
        height: (DAY_END - closeMin) * PX_PER_MIN,
        edge: 'top',
      });
    }
  }
  if (blocks.length === 0) return null;
  // These overlays MUST capture pointer events (not pass them through to
  // the staff column underneath). Without that, the column's cursor-copy
  // and click handler would activate on hover/click over closed hours,
  // suggesting you can add an appointment there — you can't. We swallow
  // the click so the slot picker never opens; the user gets no error
  // toast either, just no response, matching the "doesn't look clickable"
  // requirement.
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

// --- Staff column -----------------------------------------------------------
export function StaffColumn({ staff, day, appointments, onOpen, isToday, dn, onEditLunch, onUpdate, onSlotClick, onEditBlock, onMoveBlock, draggingId, setDraggingId, blocksTick }) {
  const apps = appointments.filter(
    (a) => a.staffId === staff.id && a.day === day && a.status !== 'canceled'
  );
  // eslint-disable-next-line no-unused-vars
  const _btick = blocksTick; // re-derive when a block mutates
  const blocks = (typeof BLOCKS !== 'undefined' ? BLOCKS : [])
    .filter(b => b.staffId === staff.id && b.day === day);
  const [hoverMin, setHoverMin] = useState(null);

  // Compute the snapped minute for a pointer event relative to the grid.
  function minutesFromEvent(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    return timeFromY(y, DAY_START, PX_PER_MIN, 15);
  }

  function handleClick(e) {
    if (!onSlotClick) return;
    // Don't trigger when the click was on an event block / lunch button.
    if (e.target.closest('button, a')) return;
    const min = minutesFromEvent(e);
    if (min < DAY_START || min >= DAY_END) return;
    // Reject clicks that land on unavailable time (closed hours, day off,
    // off-shift, lunch, an existing appointment, or a manual block). We use
    // a 15-min probe at the clicked minute; the slot picker would only be
    // followed by a modal that re-validates, so catching it here is purely
    // a UX shortcut — no need for the chosen block type to match here.
    const v = validateApptSlot({
      appointments, staffId: staff.id, day,
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

  function handleDragLeave() {
    setHoverMin(null);
  }

  function handleDrop(e) {
    e.preventDefault();
    setHoverMin(null);
    const data = e.dataTransfer.getData('text/plain') || draggingId || '';
    setDraggingId && setDraggingId(null);

    // Block drag — payload looks like "block:<id>".
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

    // Otherwise this is an appointment drag.
    const apptId = data;
    const appt = appointments.find(a => a.id === apptId);
    if (!appt) return;
    const startMin = minutesFromEvent(e);
    const duration = toMin(appt.end) - toMin(appt.start);
    const endMin = startMin + duration;
    const apptSvc = (typeof SERVICES !== 'undefined' ? SERVICES : []).find(s => s.id === appt.serviceId);
    const apptBuf = (apptSvc && apptSvc.bufferAfter) || 0;
    const v = validateApptSlot({
      appointments,
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
    showToast({ title: 'Appointment moved', body: `${fmt12(fromMin(startMin))} · ${staff.name.split(' ')[0]}` });
  }

  // Ghost preview of the dragged item in its prospective slot.
  let ghost = null;
  if (draggingId && hoverMin != null) {
    let dur = 0;
    if (typeof draggingId === 'string' && draggingId.startsWith('block:')) {
      const blockId = draggingId.slice(6);
      const dragged = (typeof BLOCKS !== 'undefined' ? BLOCKS : []).find(b => b.id === blockId);
      if (dragged) dur = toMin(dragged.end) - toMin(dragged.start);
    } else {
      const dragged = appointments.find(a => a.id === draggingId);
      if (dragged) dur = toMin(dragged.end) - toMin(dragged.start);
    }
    if (dur > 0) {
      ghost = (
        <div
          className="absolute left-1 right-1 rounded-md border-2 border-dashed border-accent/70 bg-accent/10 pointer-events-none z-[8]"
          style={{
            top: (hoverMin - DAY_START) * PX_PER_MIN,
            height: Math.max(dur * PX_PER_MIN - 2, 22),
          }}>
          <div className="px-2 py-1 text-[11px] font-medium text-accentInk">{fmt12(fromMin(hoverMin))}</div>
        </div>
      );
    }
  }

  return (
    <div
      className={cx(
        'relative flex-1 min-w-[180px] border-l border-line bg-surface',
        onSlotClick && 'cursor-copy',
        draggingId && 'bg-accentSoft/10'
      )}
      // Explicit height matches the gutter so the column's hit-test area
      // covers the entire grid. Without this, the absolute-positioned
      // hour lines and event blocks visually overflow but the column's
      // DOM box ends at the scroll container's clientHeight — making
      // clicks below the fold land on the scroller, not the column.
      style={{ height: gridHeight() }}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      title={onSlotClick ? 'Click an empty slot to book or block' : undefined}>
      <HourLines />
      <ClosedBlocks dayKey={day} />
      <NotWorkingBlocks
        staff={staff}
        dayKey={day}
        dayStartMin={DAY_START}
        dayEndMin={DAY_END}
        pxPerMin={PX_PER_MIN}
      />
      <LunchBlock staff={staff} dn={dn} dayKey={day} onEdit={onEditLunch} />
      <NowLine visible={isToday} />
      {ghost}
      {blocks.map((b) => (
        <UserBlockEvent
          key={b.id}
          block={b}
          pxPerMin={PX_PER_MIN}
          dayStartMin={DAY_START}
          onEdit={onEditBlock}
          isDragging={draggingId === 'block:' + b.id}
          onDragStart={() => setDraggingId && setDraggingId('block:' + b.id)}
          onDragEnd={() => setDraggingId && setDraggingId(null)}
        />
      ))}
      {apps.map((a) => (
        <EventBlock
          key={a.id}
          appt={a}
          staff={staff}
          onOpen={onOpen}
          isDragging={draggingId === a.id}
          onDragStart={() => setDraggingId && setDraggingId(a.id)}
          onDragEnd={() => setDraggingId && setDraggingId(null)}
        />
      ))}
    </div>
  );
}

// --- Event block ------------------------------------------------------------
export function EventBlock({ appt, staff, onOpen, isDragging, onDragStart, onDragEnd }) {
  const svc = SERVICES.find((s) => s.id === appt.serviceId);
  const cust = CUSTOMERS.find((c) => c.id === appt.customerId);
  const top = topFor(appt.start);
  const h = heightFor(appt.start, appt.end);
  const isShort = h < 38;
  const isCompleted = appt.status === 'completed';
  const isNoShow    = appt.status === 'no_show';

  // Buffer (optional) renders as a quieter striped strip attached to the
  // bottom of the appointment. It's not interactive and isn't counted as
  // its own appointment — it just shows that the slot is unavailable.
  //
  // Buffer is hidden (`buf` falls to 0) when it would land at the end of
  // the staff's shift or directly before a lunch break / manual break,
  // matching how validateApptSlot treats those edges — there's no
  // bookable slot for the buffer to protect anyway.
  const rawBuf = (svc && svc.bufferAfter) || 0;
  const buf = (typeof effectiveBuffer === 'function')
    ? effectiveBuffer({ staffId: appt.staffId, day: appt.day, endMin: toMin(appt.end), bufferAfter: rawBuf })
    : rawBuf;
  const bufHeight = buf * PX_PER_MIN;

  // Color treatments per status — keep in sync with STATUS in data.jsx
  // and the employee calendar's EmpEventBlock so the appointment surface
  // looks identical across all calendar views:
  //   default (upcoming / confirmed) — solid slate blue, white text
  //   completed                      — solid forest green, white text
  //   no-show                        — light amber wash, ink text
  // Canceled appointments are filtered out upstream and never reach here.
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
    // Custom drag image — a faint copy of the block so the cursor isn't empty.
    try {
      const ghost = e.currentTarget.cloneNode(true);
      ghost.style.position = 'absolute';
      ghost.style.top = '-9999px';
      ghost.style.opacity = '0.85';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 20, 16);
      setTimeout(() => ghost.remove(), 0);
    } catch (_) { /* setDragImage isn't supported everywhere */ }
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
    </>
  );
}

// --- Day view ---------------------------------------------------------------
export function DayView({ date, appointments, onOpen, onUpdate, onSlotClick, onEditBlock, onMoveBlock, onEditLunch, lunchTick, blocksTick }) {
  const dk = localDayKey(date);
  const isToday = dk === todayKey();
  // Show only staff whose hours cover this day, like the screenshot. Sorted by first name.
  const dn = dayName(dk);
  const visibleStaff = STAFF
    .filter((s) => s.active && Array.isArray(s.hours[dn]))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Shared drag state for all columns in this view — lets a column highlight
  // the dragged event regardless of which column is under the cursor.
  const [draggingId, setDraggingId] = useState(null);

  return (
    <Card className="overflow-hidden">
      {/* Single scroll container wraps BOTH the header row and the grid body
          so they always share the same horizontal scroll position and the
          same per-column widths. The header is sticky-top so it stays
          visible while scrolling time vertically; the gutter is sticky-left
          so the time labels stay visible while scrolling staff horizontally.

          Before this change the header sat OUTSIDE this scroll container,
          which meant the body could grow past the viewport (5+ staff
          columns at min-width 180px) and scroll independently — leaving the
          header pinned to scroll=0 and visually misaligned from the
          columns underneath. */}
      <div className="overflow-auto relative" style={{ maxHeight: 'calc(100vh - 230px)' }}>
        {/* Header row */}
        <div className="flex sticky top-0 z-30 bg-surface border-b border-line">
          {/* Top-left corner: sticky in both directions so it sits above
              the gutter AND the staff headers. */}
          <div className="w-[72px] shrink-0 sticky left-0 z-40 bg-surface" />
          {visibleStaff.map((s) => {
            const first = s.name.split(' ')[0];
            return (
              <div key={s.id} className="flex-1 min-w-[180px] shrink-0 border-l border-line px-4 py-3.5 bg-surface">
                <div className="flex items-center gap-2.5">
                  <StaffAvatar staff={s} size={30} />
                  <div className="min-w-0">
                    <div className="font-semibold text-[14px] text-ink leading-tight truncate">{first}</div>
                    <div className="text-[12px] text-muted truncate">{s.role}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Grid body */}
        <div className="flex relative">
          <div className="w-[72px] shrink-0 sticky left-0 z-20 bg-surface relative pt-2">
            <TimeGutter />
            {/* "11:59 am"-style label aligned to the now line, inside the gutter */}
            <div className="absolute inset-0 pt-2 pointer-events-none">
              <NowLine visible={isToday} withLabel />
            </div>
          </div>
          <div className="flex flex-1 relative">
            {visibleStaff.map((s) => (
              <StaffColumn
                key={s.id + ':' + lunchTick}
                staff={s}
                day={dk}
                dn={dn}
                appointments={appointments}
                onOpen={onOpen}
                onUpdate={onUpdate}
                onSlotClick={onSlotClick}
                onEditBlock={onEditBlock}
                onMoveBlock={onMoveBlock}
                isToday={isToday}
                onEditLunch={onEditLunch}
                draggingId={draggingId}
              setDraggingId={setDraggingId}
              blocksTick={blocksTick}
            />
          ))}
        </div>
        </div>
      </div>
    </Card>
  );
}

window.CalendarPage = CalendarPage;
