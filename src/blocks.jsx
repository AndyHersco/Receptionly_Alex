import { useEffect, useMemo, useRef, useState } from 'react';
import { effectiveBusinessHours, validateBlockSlot } from './calendar-actions';
import { BLOCKS, BUSINESS, dayName, fmt12, fromMin, parseDay, toMin, todayKey } from './data';
import { I } from './icons';
import { persistSession } from './persistence';
import { Button, DateInput, Field, Modal, TimePicker, cx, showToast } from './ui';

// Manual block-time UI: SlotTypePicker (the 3-choice menu shown after a
// click on an empty slot) and BlockTimeModal (create / edit / delete a
// break or lunch break). Blocks live on each location's `loc.blocks`
// array, mirrored to the global BLOCKS list (swapped by setActiveLocation).

export const BLOCK_TYPES = {
  break:        { label: 'Break',       short: 'Break',       eyebrow: 'Break' },
  lunch_break:  { label: 'Lunch break', short: 'Lunch break', eyebrow: 'Lunch break' },
};

// ─────────────────────────────────────────────────────────────────
// Mutation helpers — both apps go through these so the BLOCKS array on
// the active location stays the single source of truth.
// ─────────────────────────────────────────────────────────────────

export function addBlock(draft) {
  const id = 'blk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const b = { id, ...draft };
  if (typeof BLOCKS !== 'undefined') BLOCKS.push(b);
  if (typeof persistSession === 'function') persistSession();
  return b;
}

export function updateBlock(updated) {
  if (typeof BLOCKS === 'undefined') return;
  const i = BLOCKS.findIndex(b => b.id === updated.id);
  if (i >= 0) BLOCKS[i] = updated;
  if (typeof persistSession === 'function') persistSession();
}

export function deleteBlock(id) {
  if (typeof BLOCKS === 'undefined') return;
  const i = BLOCKS.findIndex(b => b.id === id);
  if (i >= 0) BLOCKS.splice(i, 1);
  if (typeof persistSession === 'function') persistSession();
}

// ─────────────────────────────────────────────────────────────────
// SlotTypePicker — small floating menu shown at the clicked point on
// the calendar grid. Three options: Appointment / Break / Lunch Break.
// Positioned so it appears near the cursor and never escapes the
// viewport. Closes on Escape, outside click, or after a choice.
// ─────────────────────────────────────────────────────────────────

export function SlotTypePicker({ x, y, onPick, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('keydown', onKey);
    // Defer the click listener so the very click that opened the menu
    // doesn't immediately close it.
    const t = setTimeout(() => document.addEventListener('mousedown', onClick), 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
      document.removeEventListener('mousedown', onClick);
    };
  }, [onClose]);

  // Clamp to viewport.
  const W = 200, H = 156;
  const left = Math.min(x, window.innerWidth  - W - 12);
  const top  = Math.min(y, window.innerHeight - H - 12);

  return (
    <div
      ref={ref}
      className="fixed z-[60] w-[200px] bg-surface rounded-xl border border-line shadow-pop overflow-hidden fadein"
      style={{ left, top }}
      onMouseDown={e => e.stopPropagation()}>
      <div className="px-3 pt-2.5 pb-1 text-[10.5px] uppercase tracking-[0.14em] text-muted font-medium">Add to schedule</div>
      <button
        type="button"
        onClick={() => onPick('appointment')}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-[13.5px] text-ink hover:bg-bg/70 transition">
        <span className="w-7 h-7 rounded-md bg-accent text-white flex items-center justify-center"><I.Plus size={14}/></span>
        Appointment
      </button>
      <button
        type="button"
        onClick={() => onPick('break')}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-[13.5px] text-ink hover:bg-bg/70 transition">
        <span className="w-7 h-7 rounded-md border border-dashed border-line2 bg-bg flex items-center justify-center"><I.Clock size={14}/></span>
        Break
      </button>
      <button
        type="button"
        onClick={() => onPick('lunch_break')}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-[13.5px] text-ink hover:bg-bg/70 transition">
        <span className="w-7 h-7 rounded-md border border-dashed border-line2 bg-bg flex items-center justify-center"><I.Clock size={14}/></span>
        Lunch break
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// BlockTimeModal — create or edit a manual break / lunch break.
// Props:
//   mode      'create' | 'edit'
//   initial   { type, staffId, date, start, end, note }   (required)
//   block     existing block (when mode='edit')           (id needed for delete)
//   staffOptions  array of {id, name} to pick from (admin = all staff;
//                 employee = locked to themselves \u2014 pass [me]).
//   lockStaff true to hide the staff picker (employee view).
//   onSave    callback({...draft})
//   onDelete  callback(id)
//   onClose   callback()
// ─────────────────────────────────────────────────────────────────

export function BlockTimeModal({ mode = 'create', initial, block, staffOptions, lockStaff, onSave, onDelete, onClose }) {
  const isEdit = mode === 'edit';
  const seed = useMemo(() => ({
    type:    (initial && initial.type)    || 'break',
    staffId: (initial && initial.staffId) || (staffOptions && staffOptions[0] && staffOptions[0].id) || '',
    date:    (initial && initial.date)    || todayKey(),
    start:   (initial && initial.start)   || '09:00',
    end:     (initial && initial.end)     || fromMin(toMin((initial && initial.start) || '09:00') + 30),
    note:    (initial && initial.note)    || '',
  }), [initial, staffOptions]);

  const [type, setType] = useState(seed.type);
  const [staffId, setStaffId] = useState(seed.staffId);
  const [date, setDate] = useState(seed.date);
  const [start, setStart] = useState(seed.start);
  const [end, setEnd] = useState(seed.end);
  const [note, setNote] = useState(seed.note);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty =
    type !== seed.type ||
    staffId !== seed.staffId ||
    date !== seed.date ||
    start !== seed.start ||
    end !== seed.end ||
    note !== seed.note;

  function handleSubmit() {
    if (!staffId)        { setError('Pick a staff member.'); showToast({ title: "Can't save block", body: 'Pick a staff member.', tone: 'error' }); return; }
    if (!date)           { setError('Pick a date.'); showToast({ title: "Can't save block", body: 'Pick a date.', tone: 'error' }); return; }
    const sMin = toMin(start);
    const eMin = toMin(end);
    if (eMin <= sMin)    { setError('Start time must be before end time.'); showToast({ title: "Can't save block", body: 'Start time must be before end time.', tone: 'error' }); return; }
    const v = validateBlockSlot({
      staffId, day: date,
      startMin: sMin, endMin: eMin,
      excludeBlockId: block ? block.id : null,
    });
    if (!v.ok) {
      setError(v.reason);
      const label = type === 'lunch_break' ? 'lunch break' : 'break';
      showToast({ title: `Can't save ${label}`, body: v.reason, tone: 'error' });
      return;
    }
    onSave && onSave({ type, staffId, day: date, start, end, note: note.trim() });
    onClose && onClose();
  }

  function handleDelete() {
    if (!block) return;
    onDelete && onDelete(block.id);
    onClose && onClose();
  }

  return (
    <Modal open onClose={onClose} maxWidth="max-w-md">
      <div className="p-6">
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-serif text-[24px] text-ink leading-tight">{isEdit ? 'Edit block' : 'Block time'}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink p-1 -mr-1" aria-label="Close"><I.X size={16}/></button>
        </div>
        <p className="text-[13px] text-muted mb-5">
          Mark a slot as unavailable. {isEdit ? 'Only this block on this date is affected.' : 'Bookings will skip this window.'}
        </p>

        <div className="space-y-3.5">
          <Field label="Type">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setType('break')}
                className={cx('flex-1 h-9 rounded-lg border text-[13px] font-medium transition',
                  type === 'break' ? 'bg-ink text-white border-ink' : 'bg-surface text-ink2 border-line hover:border-line2')}>
                Break
              </button>
              <button
                type="button"
                onClick={() => setType('lunch_break')}
                className={cx('flex-1 h-9 rounded-lg border text-[13px] font-medium transition',
                  type === 'lunch_break' ? 'bg-ink text-white border-ink' : 'bg-surface text-ink2 border-line hover:border-line2')}>
                Lunch break
              </button>
            </div>
          </Field>

          {!lockStaff && staffOptions && staffOptions.length > 1 && (
            <Field label="Staff">
              <select value={staffId} onChange={e => setStaffId(e.target.value)}>
                {staffOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          )}

          <Field label="Date">
            <DateInput value={date} onChange={v => setDate(v)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start"><TimePicker value={start} onChange={setStart} minuteStep={15} /></Field>
            <Field label="End"><TimePicker value={end} onChange={setEnd} minuteStep={15} /></Field>
          </div>

          <Field label="Note" optional>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Optional — e.g. coffee, errand, training"
              rows={2}
              style={{ minHeight: 60 }}
            />
          </Field>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-rose/30 bg-roseSoft/40 px-3 py-2 text-[12.5px] text-rose">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mt-6">
          <div>
            {isEdit && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-[12.5px] text-muted hover:text-rose font-medium inline-flex items-center gap-1.5">
                <I.Trash size={13}/> Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="accent" size="sm" onClick={handleSubmit} disabled={isEdit && !dirty}>
              {isEdit ? 'Save changes' : 'Block time'}
            </Button>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <Modal open onClose={() => setConfirmDelete(false)} maxWidth="max-w-sm">
          <div className="p-6">
            <h3 className="font-serif text-[22px] text-ink leading-tight mb-1">Delete this block?</h3>
            <p className="text-[13px] text-muted mb-5">
              The {BLOCK_TYPES[type].label.toLowerCase()} on {parseDay(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} will be removed. The slot opens up for bookings again.
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>Keep</Button>
              <Button variant="danger" size="sm" onClick={handleDelete}>Delete block</Button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
// UserBlockEvent — the visual block rendered on the calendar grid for a
// user-created break or lunch break. Same striped slate vocabulary as
// the recurring lunch template so they read as "unavailable". Draggable.
// ─────────────────────────────────────────────────────────────────

export function UserBlockEvent({ block, pxPerMin, dayStartMin, onEdit, isDragging, onDragStart, onDragEnd }) {
  const top = (toMin(block.start) - dayStartMin) * pxPerMin;
  const h = (toMin(block.end) - toMin(block.start)) * pxPerMin;
  const label = BLOCK_TYPES[block.type] ? BLOCK_TYPES[block.type].short : 'Block';

  function handleDragStart(e) {
    e.dataTransfer.setData('text/plain', 'block:' + block.id);
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
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onEdit && onEdit(block); }}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => onDragEnd && onDragEnd()}
      aria-label={`Edit ${label.toLowerCase()}`}
      title={`${label} \u00b7 ${fmt12(block.start)}\u2013${fmt12(block.end)}${block.note ? ' \u00b7 ' + block.note : ''}`}
      className={cx(
        'calendar-block absolute left-1 right-1 rounded-md border border-dashed border-ink2/40 stripe-bg bg-bg/70 z-[7] select-none overflow-hidden text-left transition hover:bg-bg/90 hover:border-ink2/60 cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
        isDragging && 'opacity-40 ring-2 ring-accent/60'
      )}
      style={{ top, height: Math.max(h - 2, 14) }}>
      <div className="h-full px-2 py-1 flex flex-col leading-tight">
        <div className="text-[11px] uppercase tracking-[0.12em] text-muted font-semibold">{fmt12(block.start)}</div>
        {h >= 30 && <div className="text-[12px] font-semibold text-ink2 truncate">{label}</div>}
        {h >= 56 && block.note && (
          <div className="text-[11px] text-muted truncate mt-auto">{block.note}</div>
        )}
      </div>
    </button>
  );
}

Object.assign(window, {
  BLOCK_TYPES,
  addBlock, updateBlock, deleteBlock,
  SlotTypePicker, BlockTimeModal, UserBlockEvent,
  NotWorkingBlocks, AddMenuButton,
});

// ─────────────────────────────────────────────────────────────────
// NotWorkingBlocks — shades the parts of the grid where a staff
// member is NOT scheduled to work on `dayKey`. Uses the same
// unavailable-time visual family as Closed / Day Off / Break /
// Lunch (stripe-bg, muted bg, dashed edge) so all "unavailable"
// regions read as one category.
//
// Labels each strip clearly so users can tell Closed (business)
// apart from Not Working (this employee). If staff is off the
// whole day, renders a single full-grid block labeled "Day Off".
//
// Skips drawing OVER business closed-hours regions — those keep
// their "Closed" label via ClosedBlocks. We clamp the overlay to
// `[bizOpen, bizClose]` so the two never produce duplicate labels.
//
// Props:
//   staff        — staff record (with `.hours[Mon|Tue|…]`)
//   dayKey       — YYYY-MM-DD
//   dayStartMin  — top of grid (minutes since midnight)
//   dayEndMin    — bottom of grid (minutes since midnight)
//   pxPerMin     — px per minute
// ─────────────────────────────────────────────────────────────────
export function NotWorkingBlocks({ staff, dayKey, dayStartMin, dayEndMin, pxPerMin }) {
  if (!staff) return null;
  const sched = staff.hours[dayName(dayKey)];

  // Clamp to business hours so we never double-label with "Closed".
  const biz = (typeof effectiveBusinessHours === 'function')
    ? effectiveBusinessHours(dayKey)
    : ((typeof BUSINESS !== 'undefined' && BUSINESS.hours) ? BUSINESS.hours[dayName(dayKey)] : null);
  const bizClosed = biz && biz.closed;
  if (bizClosed) return null; // Whole day is "Closed" — ClosedBlocks covers it.
  const visStart = Math.max(dayStartMin, biz ? toMin(biz.open)  : dayStartMin);
  const visEnd   = Math.min(dayEndMin,   biz ? toMin(biz.close) : dayEndMin);
  if (visEnd <= visStart) return null;

  // Day off — staff isn't scheduled at all this day.
  if (!Array.isArray(sched)) {
    return (
      <div
        aria-label="Day off"
        title={`${staff.name.split(' ')[0]} — day off`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute inset-x-0 z-[6] overflow-hidden stripe-bg bg-bg/55 cursor-default select-none"
        style={{ top: (visStart - dayStartMin) * pxPerMin, height: (visEnd - visStart) * pxPerMin }}>
        <div className="px-2 pt-1.5 text-[10px] uppercase tracking-[0.14em] text-muted font-semibold leading-none">
          Day Off
        </div>
      </div>
    );
  }

  const workStart = Math.max(toMin(sched[0]), visStart);
  const workEnd   = Math.min(toMin(sched[1]), visEnd);
  const shiftLabel = `Works ${fmt12(sched[0])}–${fmt12(sched[1])}`;
  const blocks = [];
  if (workStart > visStart) {
    blocks.push({ key: 'before', topMin: visStart, heightMin: workStart - visStart, edge: 'bottom' });
  }
  if (workEnd < visEnd) {
    blocks.push({ key: 'after',  topMin: workEnd,  heightMin: visEnd - workEnd,     edge: 'top' });
  }
  if (blocks.length === 0) return null;
  return blocks.map(b => {
    const heightPx = b.heightMin * pxPerMin;
    return (
      <div
        key={b.key}
        aria-label="Not working"
        title={`Off shift · ${shiftLabel}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className={cx(
          'absolute inset-x-0 z-[6] overflow-hidden stripe-bg bg-bg/55 cursor-default select-none',
          b.edge === 'bottom' && 'border-b border-dashed border-ink/15',
          b.edge === 'top'    && 'border-t border-dashed border-ink/15'
        )}
        style={{ top: (b.topMin - dayStartMin) * pxPerMin, height: heightPx }}>
        {heightPx >= 22 && (
          <div className="px-2 pt-1.5 text-[10px] uppercase tracking-[0.14em] text-muted font-semibold leading-none">
            Not Working
          </div>
        )}
      </div>
    );
  });
}

// ─────────────────────────────────────────────────────────────────
// AddMenuButton — accent button + dropdown for the calendar
// top-bar. Picking an option calls `onPick(action)` with one of
// 'appointment' | 'break' | 'lunch_break'.
//
// Same three-row content as SlotTypePicker so the menu reads the
// same whether it's opened from a click on the grid or the top-bar.
// Closes on outside click, Escape, or after a choice.
// ─────────────────────────────────────────────────────────────────
export function AddMenuButton({ onPick, label = 'Add', align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  function pick(action) {
    setOpen(false);
    onPick && onPick(action);
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="accent"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}>
        <I.Plus size={14} strokeWidth={2.4} />
        {label}
        <I.ChevronDown size={12} className="opacity-80" />
      </Button>
      {open && (
        <div
          role="menu"
          className={cx(
            'absolute top-full mt-1.5 w-[208px] bg-surface rounded-xl border border-line shadow-pop overflow-hidden z-[60] fadein',
            align === 'right' ? 'right-0' : 'left-0'
          )}>
          <div className="px-3 pt-2.5 pb-1 text-[10.5px] uppercase tracking-[0.14em] text-muted font-medium">Add to schedule</div>
          <button
            type="button"
            role="menuitem"
            onClick={() => pick('appointment')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-[13.5px] text-ink hover:bg-bg/70 transition">
            <span className="w-7 h-7 rounded-md bg-accent text-white flex items-center justify-center"><I.Plus size={14}/></span>
            Appointment
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => pick('break')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-[13.5px] text-ink hover:bg-bg/70 transition">
            <span className="w-7 h-7 rounded-md border border-dashed border-line2 bg-bg flex items-center justify-center"><I.Clock size={14}/></span>
            Break
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => pick('lunch_break')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-[13.5px] text-ink hover:bg-bg/70 transition">
            <span className="w-7 h-7 rounded-md border border-dashed border-line2 bg-bg flex items-center justify-center"><I.Clock size={14}/></span>
            Lunch break
          </button>
        </div>
      )}
    </div>
  );
}
