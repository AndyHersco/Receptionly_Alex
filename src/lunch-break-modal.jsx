import { useEffect, useState } from 'react';
import { validateBlockSlot } from './calendar-actions';
import { APPOINTMENTS, SERVICES, dayName, fmt12, parseDay, toMin } from './data';
import { I } from './icons';
import { persistSession } from './persistence';
import { Button, Field, StaffAvatar, TimePicker, showToast } from './ui';

// Lunch break edit modal — mirrors the look & spacing of RescheduleModal but
// strips it down to just Start / End time. Lunch is stored two ways:
//   1. `staff.lunch` — the recurring weekly default ('HH:MM–HH:MM').
//   2. `LUNCH_OVERRIDES[staffId|dayKey]` — a per-day override that wins
//      over the default for that one date only.
// Editing from the calendar writes ONLY to the override so the recurring
// schedule stays intact; settings/schedule pages would mutate `staff.lunch`
// directly. Set an override to the empty string to mark "no lunch this day".

export const LUNCH_OVERRIDES = {};

export function _lunchKey(staffId, dayKey) { return staffId + '|' + dayKey; }

// Returns the effective lunch string ('HH:MM–HH:MM') for this staff on
// `dayKey`, or null if no lunch applies. Falls back to the recurring default.
export function getLunchFor(staff, dayKey) {
  if (!staff) return null;
  const k = _lunchKey(staff.id, dayKey);
  if (Object.prototype.hasOwnProperty.call(LUNCH_OVERRIDES, k)) {
    return LUNCH_OVERRIDES[k] || null;
  }
  return staff.lunch || null;
}

export function setLunchOverride(staff, dayKey, value) {
  LUNCH_OVERRIDES[_lunchKey(staff.id, dayKey)] = value;
  if (typeof persistSession === 'function') persistSession();
}

export function parseLunch(staff, dayKey) {
  const raw = getLunchFor(staff, dayKey);
  if (!raw) return { start: '12:00', end: '13:00' };
  const [s, e] = raw.replace('–', '-').split('-');
  return { start: s, end: e };
}

// Returns the first conflicting appointment on `dayKey` for `staff` whose
// time range overlaps [start, end), or null if no conflict.
export function findLunchConflict(staff, dayKey, start, end) {
  const ns = toMin(start);
  const ne = toMin(end);
  return APPOINTMENTS.find(a => {
    if (a.staffId !== staff.id) return false;
    if (a.day !== dayKey) return false;
    if (a.status === 'canceled') return false;
    const aSvc = SERVICES.find(s => s.id === a.serviceId);
    const aBuf = (aSvc && aSvc.bufferAfter) || 0;
    const aStart = toMin(a.start);
    const aEnd = toMin(a.end) + aBuf;
    // Lunch [ns, ne) overlaps appointment+buffer [aStart, aEnd)
    return ns < aEnd && ne > aStart;
  }) || null;
}

export function LunchBreakModal({ staff, dayKey, onClose, onSave }) {
  const orig = parseLunch(staff, dayKey);
  const [start, setStart] = useState(orig.start);
  const [end, setEnd] = useState(orig.end);
  const [error, setError] = useState(null);

  // Clear the error as soon as the user changes either field — the previous
  // conflict may no longer apply.
  useEffect(() => { setError(null); }, [start, end]);

  const dirty = start !== orig.start || end !== orig.end;
  const orderValid = toMin(end) > toMin(start);
  const canSave = dirty && orderValid;

  function handleSave() {
    if (!canSave) return;
    const sMin = toMin(start);
    const eMin = toMin(end);
    // Re-use the shared block validator. skipLunchCheck = true so the
    // existing lunch override (which getLunchFor would return) doesn't
    // false-conflict with itself. This now catches all the rules:
    //   • Day off / outside working hours
    //   • Outside business hours / closed days
    //   • Overlapping appointment (incl. its buffer)
    //   • Overlapping break / lunch break / manual block
    const v = validateBlockSlot({
      staffId: staff.id,
      day: dayKey,
      startMin: sMin,
      endMin: eMin,
      skipLunchCheck: true,
    });
    if (!v.ok) {
      setError(v.reason);
      showToast({ title: "Can't update lunch break", body: v.reason, tone: 'error' });
      return;
    }
    // Per-day override only — the recurring `staff.lunch` is untouched.
    setLunchOverride(staff, dayKey, `${start}–${end}`);
    onSave && onSave(staff, dayKey);
    onClose && onClose();
    const when = parseDay(dayKey).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
    showToast({
      title: 'Lunch break updated',
      body: `${staff.name.split(' ')[0]}'s lunch on ${when} is now ${fmt12(start)} – ${fmt12(end)}.`,
    });
  }

  // Escape closes (no dirty guard for this tiny form — Cancel is one click away).
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose && onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const editingDate = parseDay(dayKey);
  const dn = dayName(editingDate);
  const todaySched = staff.hours && staff.hours[dn];
  const workingThisDay = Array.isArray(todaySched);
  const dateLabel = editingDate.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 fadein"
      style={{ background: 'rgba(20,18,15,.32)' }}
      onClick={onClose}>
      <div
        className="relative w-full max-w-[480px] max-h-[92vh] overflow-auto bg-surface rounded-2xl shadow-pop border border-line"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-6 pb-5 border-b border-line flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-medium mb-1">
              Schedule · Unavailable time
            </div>
            <div className="font-serif text-[26px] leading-tight text-ink truncate">Lunch Break</div>
            <div className="text-[13px] text-ink2 mt-1">{dateLabel} only</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-ink2 hover:text-ink p-1.5 -m-1.5 transition">
            <I.X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Staff snapshot — matches the reschedule modal's "current" card */}
          <div className="rounded-xl border border-line bg-bg/40 p-3 grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted mb-1">Staff</div>
              <div className="flex items-center gap-2">
                <StaffAvatar staff={staff} size={22} />
                <span className="font-medium text-ink text-[13.5px] truncate">{staff.name}</span>
              </div>
              <div className="text-[12px] text-ink2 mt-0.5 truncate">{staff.role}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted mb-1">Currently</div>
              <div className="font-medium text-ink text-[13.5px] tabular-nums">
                {fmt12(orig.start)} – {fmt12(orig.end)}
              </div>
              <div className="text-[12px] text-ink2 mt-0.5">
                {workingThisDay ? `Hours: ${fmt12(todaySched[0])} – ${fmt12(todaySched[1])}` : 'Off this day'}
              </div>
            </div>
          </div>

          {/* Edit form */}
          <div>
            <div className="text-[13px] font-medium text-ink mb-1">Edit lunch break</div>
            <div className="text-[12px] text-muted mb-3">Changes apply to this day only — your recurring schedule won't change.</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start time">
                <TimePicker value={start} onChange={setStart} minuteStep={5} />
              </Field>
              <Field
                label="End time"
                error={!orderValid ? 'Must be after start' : null}>
                <TimePicker value={end} onChange={setEnd} minuteStep={5} />
              </Field>
            </div>

            {error && (
              <div className="mt-3 rounded-lg border border-rose/30 bg-roseSoft/50 px-3.5 py-2.5 flex items-start gap-2.5 text-[13px] text-rose fadein">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-line bg-bg/40 flex items-center justify-between gap-3">
          <div className="text-[12px] text-muted">
            {dirty && orderValid
              ? <>New lunch: <span className="font-medium text-ink tabular-nums">{fmt12(start)} – {fmt12(end)}</span></>
              : 'No changes yet'}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              variant="accent"
              size="sm"
              disabled={!canSave}
              onClick={handleSave}>
              Update Lunch Break
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.LunchBreakModal = LunchBreakModal;
window.findLunchConflict = findLunchConflict;
window.getLunchFor = getLunchFor;
window.setLunchOverride = setLunchOverride;
