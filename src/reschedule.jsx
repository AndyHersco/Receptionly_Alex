import { useEffect, useMemo, useState } from 'react';
import { validateApptSlot } from './calendar-actions';
import { BUSINESS, CUSTOMERS, SERVICES, SERVICE_CATEGORIES, STAFF, dayName, fmt12, fromMin, parseDay, toMin, todayKey } from './data';
import { I } from './icons';
import { useDirtyGuard, useNavGuard } from './nav-guard';
import { Button, CustomerAvatar, DateInput, Field, StaffAvatar, StatusPill, showToast } from './ui';

// Reschedule appointment modal — used from both the owner app and employee app.
// Lets the user change service, date, time, and staff; computes available slots
// from the staff schedule + existing bookings (excluding the appointment itself).
//
// Patterns used here that mirror the rest of the app:
//  • Tracks "dirty" against the original appointment so Confirm stays disabled
//    until the user picks something different.
//  • Routes any "close" intent (X, backdrop, Escape, Cancel button) through
//    NavGuard so an unsaved-changes confirm pops if the form is dirty.
//  • Visual chrome mirrors the screenshot reference: 480px modal, header with
//    service category + name, a "current appointment" snapshot, then the
//    Reschedule form, then footer actions.

// ─────────────────────────────────────────────────────────────────────────────
// Availability helper

export function rescheduleSlots({ staffId, dayKey, serviceId, excludeApptId }) {
  const staff = STAFF.find(s => s.id === staffId);
  const svc   = SERVICES.find(s => s.id === serviceId);
  if (!staff || !svc) return [];
  const sched = staff.hours[dayName(dayKey)];
  if (!Array.isArray(sched)) return [];

  const [openT, closeT] = sched;
  let openM  = toMin(openT);
  let closeM = toMin(closeT);

  // Clip to the business's open hours for this day. If the business is
  // closed entirely on `dayKey`, no slots are available.
  const biz = BUSINESS && BUSINESS.hours && BUSINESS.hours[dayName(dayKey)];
  if (biz) {
    if (biz.closed) return [];
    openM  = Math.max(openM,  toMin(biz.open));
    closeM = Math.min(closeM, toMin(biz.close));
  }

  const dur    = svc.duration;
  const newBuf = svc.bufferAfter || 0;

  // Run each 15-min candidate through the shared validator so the visible
  // unavailable state matches what confirmReschedule will allow. This now
  // accounts for the staff's lunch break, manual breaks / lunch breaks,
  // appointment buffers, AND our own service's buffer trail.
  const slots = [];
  for (let m = openM; m + dur <= closeM; m += 15) {
    const v = validateApptSlot({
      staffId, day: dayKey,
      startMin: m, endMin: m + dur,
      bufferAfter: newBuf,
      excludeId: excludeApptId,
    });
    slots.push({
      value: fromMin(m),
      label: fmt12(fromMin(m)),
      unavailable: !v.ok,
    });
  }
  return slots;
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal

export function RescheduleModal({ appt, onClose, onConfirm }) {
  const origSvc   = SERVICES.find(s => s.id === appt.serviceId);
  const origStaff = STAFF.find(s => s.id === appt.staffId);
  const cust      = CUSTOMERS.find(c => c.id === appt.customerId);
  const cat       = SERVICE_CATEGORIES.find(c => c.id === origSvc.category);
  const sourceLabel = {
    walkin: 'Walk-in', phone: 'Phone', online: 'Online', ai: 'AI Receptionist',
  }[appt.source] || appt.source;

  // Form state
  const [serviceId, setServiceId] = useState(appt.serviceId);
  const [date, setDate]           = useState(appt.day);
  const [start, setStart]         = useState(appt.start);
  const [staffId, setStaffId]     = useState(appt.staffId);

  const newSvc = SERVICES.find(s => s.id === serviceId);

  // Staff that can perform the chosen service.
  const eligibleStaff = useMemo(
    () => STAFF.filter(s => s.services.includes(serviceId) && s.active),
    [serviceId]
  );

  // If service changes and the current staff can't do it, fall back to first eligible.
  useEffect(() => {
    if (!eligibleStaff.find(s => s.id === staffId) && eligibleStaff[0]) {
      setStaffId(eligibleStaff[0].id);
    }
  }, [serviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Available slots for the (staff, day, service) combo — exclude this appt.
  const slots = useMemo(
    () => rescheduleSlots({ staffId, dayKey: date, serviceId, excludeApptId: appt.id }),
    [staffId, date, serviceId, appt.id]
  );

  // If the chosen start is no longer in the available list (e.g. day changed,
  // staff doesn't work that day), drop it so the user has to re-pick.
  useEffect(() => {
    const match = slots.find(s => s.value === start);
    if (!match || match.unavailable) setStart('');
  }, [slots]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dirty = anything different from the original appointment.
  const dirty =
    serviceId !== appt.serviceId ||
    date      !== appt.day       ||
    start     !== appt.start     ||
    staffId   !== appt.staffId;

  // Valid = dirty AND start is a real available slot for the staff that day.
  const valid =
    dirty &&
    !!start &&
    slots.some(s => s.value === start && !s.unavailable);

  // ── Close handling — route through nav-guard so unsaved-changes popup fires.
  const navGuard = useNavGuard();
  function handleSave()    { if (valid) confirmReschedule(); }
  function confirmReschedule() {
    const endMin = toMin(start) + newSvc.duration;
    // Final sanity check via the shared validator — catches conflicts the
    // slot-grid filter doesn't enforce (lunch break, manual blocks, days
    // off, working hours when the staff was changed). Surfaces as a
    // bottom-right error toast and aborts the save.
    const v = validateApptSlot({
      staffId,
      day: date,
      startMin: toMin(start),
      endMin,
      bufferAfter: newSvc.bufferAfter || 0,
      excludeId: appt.id,
    });
    if (!v.ok) {
      showToast({ title: "Can't reschedule", body: v.reason, tone: 'error' });
      return;
    }
    onConfirm({
      ...appt,
      serviceId,
      staffId,
      day: date,
      start,
      end: fromMin(endMin),
      duration: newSvc.duration,
      price: newSvc.price,
    });
  }
  function requestClose() { navGuard.request(onClose); }

  useDirtyGuard({
    dirty,
    onSave: handleSave,
    onDiscard: () => {},
    hideSave: !valid,
  });

  // Escape key closes via guard
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') requestClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dirty]); // re-bind so closure sees current `dirty`

  // ── Render
  const dateObj = parseDay(date);
  const origDateLabel = parseDay(appt.day).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 fadein"
      style={{ background: 'rgba(20,18,15,.32)' }}
      onClick={requestClose}
    >
      <div
        className="relative w-full max-w-[520px] max-h-[92vh] overflow-auto bg-surface rounded-2xl shadow-pop border border-line"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-5 border-b border-line flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-medium mb-1">
              {cat.name} · {sourceLabel}
            </div>
            <div className="font-serif text-[26px] leading-tight text-ink truncate">{origSvc.name}</div>
            <div className="text-[13px] text-ink2 mt-1">{appt.duration} min · ${origSvc.price}</div>
          </div>
          <button
            onClick={requestClose}
            aria-label="Close"
            className="text-ink2 hover:text-ink p-1.5 -m-1.5 transition"
          >
            <I.X size={16}/>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Customer snapshot */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <CustomerAvatar name={cust.name} size={40}/>
              <div className="min-w-0">
                <div className="font-medium text-ink truncate">{cust.name}</div>
                <div className="text-[12.5px] text-ink2 flex items-center gap-3 flex-wrap">
                  <span className="inline-flex items-center gap-1"><I.Phone size={12}/> {cust.phone}</span>
                  <span className="inline-flex items-center gap-1"><I.Mail size={12}/> {cust.email}</span>
                </div>
              </div>
            </div>
            <StatusPill status={appt.status}/>
          </div>

          {/* Current appointment snapshot */}
          <div className="rounded-xl border border-line bg-bg/40 p-3 grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted mb-1">Currently with</div>
              <div className="flex items-center gap-2">
                <StaffAvatar staff={origStaff} size={22}/>
                <span className="font-medium text-ink text-[13.5px]">{origStaff.name}</span>
              </div>
              <div className="text-[12px] text-ink2 mt-0.5">{origStaff.role}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted mb-1">Currently scheduled</div>
              <div className="font-medium text-ink text-[13.5px]">{origDateLabel}</div>
              <div className="text-[12px] text-ink2 mt-0.5">{fmt12(appt.start)} – {fmt12(appt.end)}</div>
            </div>
          </div>

          {/* Reschedule form */}
          <div>
            <div className="text-[13px] font-medium text-ink mb-3">Reschedule appointment</div>

            <div className="space-y-3">
              <Field label="Service">
                <div className="relative">
                  <select
                    value={serviceId}
                    onChange={e => setServiceId(e.target.value)}
                    className="!pr-8 appearance-none"
                  >
                    {SERVICES.map(s => (
                      <option key={s.id} value={s.id}>{s.name} · {s.duration} min · ${s.price}</option>
                    ))}
                  </select>
                  <I.ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"/>
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="New date">
                  <DateInput
                    value={date}
                    min={todayKey()}
                    onChange={v => setDate(v)}
                  />
                </Field>
                <Field
                  label="New start time"
                  error={dirty && !start && slots.length > 0 ? 'Pick an available slot' : null}
                  hint={slots.length === 0 ? "Staff is off this day" : null}
                >
                  <div className="relative">
                    <select
                      value={start}
                      onChange={e => setStart(e.target.value)}
                      disabled={slots.length === 0}
                      className="!pr-8 appearance-none tabular-nums"
                    >
                      <option value="">Select a time…</option>
                      {slots.map(s => (
                        <option key={s.value} value={s.value} disabled={s.unavailable}>
                          {s.label}{s.unavailable ? ' — booked' : ''}
                        </option>
                      ))}
                    </select>
                    <I.Clock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"/>
                  </div>
                </Field>
              </div>

              <Field label="Staff">
                <div className="relative">
                  <select
                    value={staffId}
                    onChange={e => setStaffId(e.target.value)}
                    className="!pr-8 appearance-none"
                  >
                    {eligibleStaff.length === 0 && <option value="">No staff available</option>}
                    {eligibleStaff.map(s => (
                      <option key={s.id} value={s.id}>{s.name} · {s.role}</option>
                    ))}
                  </select>
                  <I.ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"/>
                </div>
              </Field>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-line bg-bg/40 flex items-center justify-between gap-3">
          <div className="text-[12px] text-muted">
            {dirty
              ? (valid
                ? <>Moving to <span className="font-medium text-ink">{parseDay(date).toLocaleDateString('en-US',{weekday:'short', month:'short', day:'numeric'})}, {fmt12(start)}</span></>
                : 'Pick a new date or time')
              : 'No changes yet'}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={requestClose}>Cancel</Button>
            <Button
              variant="accent"
              size="sm"
              disabled={!valid}
              onClick={confirmReschedule}
            >
              Confirm reschedule
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.RescheduleModal = RescheduleModal;
