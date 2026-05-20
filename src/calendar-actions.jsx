import { APPOINTMENTS, BLOCKS, BUSINESS, CUSTOMERS, SERVICES, STAFF, dayName, fmt12, fromMin, parseDay, toMin } from './data';
import { getLunchFor } from './lunch-break-modal';

// Shared calendar interaction helpers: time snapping, slot-from-pointer math,
// and conflict validation for drag-to-reschedule + click-to-add.
//
// Used by both the admin calendar (src/calendar.jsx) and the employee
// calendar (src/employee-calendar.jsx). Exposed on window so each consumer
// can pull them in regardless of script load order.

// Round a minute value to the nearest `step` minutes. Default 15.
export function snapMinutes(min, step = 15) {
  return Math.round(min / step) * step;
}

// Convert a Y-offset within a grid (clientY - gridRect.top) to a minute value
// in the day's timeline, snapped to `step` minutes.
export function timeFromY(y, dayStartMin, pxPerMin, step = 15) {
  const m = dayStartMin + y / pxPerMin;
  return snapMinutes(m, step);
}

// Validate that a proposed appointment slot (`staffId` + `day` +
// `[startMin, endMin)`) doesn't collide with another appointment, the staff
// member's lunch, the staff member's working hours, or the business's hours.
// Returns `{ ok: true }` on success, `{ ok: false, reason: '...' }` otherwise.
//
// Options:
//   `excludeId`      — appointment id to skip (drag-to-reschedule on self)
//   `bufferAfter`    — buffer minutes after THIS slot's end. Counted against
//                      conflicts, working hours, and business hours, so a
//                      service whose buffer trails past close is rejected.
//   `skipLunchCheck` — when editing the recurring lunch itself (so getLunchFor
//                      doesn't compare it to itself and false-reject).
//   `appointments`   — explicit list to validate against (defaults to APPOINTMENTS)
export function validateApptSlot({ staffId, day, startMin, endMin, bufferAfter = 0, excludeId = null, appointments = null, skipLunchCheck = false }) {
  const appts = appointments || (typeof APPOINTMENTS !== 'undefined' ? APPOINTMENTS : []);
  const staff = (typeof STAFF !== 'undefined' ? STAFF : []).find(s => s.id === staffId);
  // The slot occupies [startMin, effectiveEnd). All "right edge" comparisons
  // use effectiveEnd so a service's own bufferAfter is counted as occupied
  // time — both for conflict detection AND for shift/hours containment.
  //
  // effBuf zeroes the raw buffer out when it would land in already-blocked
  // territory (end of shift, lunch, a manual break/lunch break). That lets
  // an appointment cleanly back up to a shift end or a lunch break without
  // the buffer falsely triggering a containment / overlap failure.
  const effBuf = effectiveBuffer({ staffId, day, endMin, bufferAfter });
  const effectiveEnd = endMin + effBuf;

  // 1. Staff working hours for this day
  if (staff) {
    const dn = dayName(day);
    const sched = staff.hours[dn];
    if (!Array.isArray(sched)) {
      return { ok: false, reason: `This day is marked as off — ${staff.name.split(' ')[0]} isn't scheduled to work on ${parseDay(day).toLocaleDateString('en-US', { weekday: 'long' })}.` };
    }
    const workStart = toMin(sched[0]);
    const workEnd   = toMin(sched[1]);
    if (startMin < workStart || effectiveEnd > workEnd) {
      return { ok: false, reason: `Outside ${staff.name.split(' ')[0]}'s working hours (${fmt12(sched[0])}–${fmt12(sched[1])}).${bufferAfter > 0 && (endMin <= workEnd && effectiveEnd > workEnd) ? ` The ${bufferAfter}-min buffer would run past end of shift.` : ''}` };
    }
  }

  // 2. Business hours (combined with date-specific closures)
  const biz = effectiveBusinessHours(day);
  if (biz) {
    if (biz.closed) {
      const name = biz.closureName ? ` (${biz.closureName})` : '';
      return { ok: false, reason: `Business is closed on ${parseDay(day).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}${name}.` };
    }
    const openM  = toMin(biz.open);
    const closeM = toMin(biz.close);
    if (startMin < openM) return { ok: false, reason: `Outside business hours. ${biz.closureName ? biz.closureName + ' \u2014 ' : ''}Opens at ${fmt12(biz.open)}.` };
    if (effectiveEnd > closeM)  return { ok: false, reason: `Would run past close (${fmt12(biz.close)})${biz.closureName ? ` \u2014 ${biz.closureName}` : ''}${bufferAfter > 0 && endMin <= closeM ? ` \u2014 the ${bufferAfter}-min buffer overruns business hours` : ''}.` };
  }

  // 3. Lunch break overlap. Skip when editing the lunch itself.
  if (staff && !skipLunchCheck && typeof getLunchFor === 'function') {
    const lunch = getLunchFor(staff, day);
    if (lunch) {
      const [ls, le] = lunch.replace('–', '-').split('-');
      const lStart = toMin(ls);
      const lEnd   = toMin(le);
      if (startMin < lEnd && effectiveEnd > lStart) {
        return { ok: false, reason: `Overlaps ${staff.name.split(' ')[0]}'s lunch break (${fmt12(ls)}–${fmt12(le)}).` };
      }
    }
  }

  // 3b. Manual block overlap (user-created breaks / lunch breaks)
  const blocks = typeof BLOCKS !== 'undefined' ? BLOCKS : [];
  for (const b of blocks) {
    if (b.staffId !== staffId) continue;
    if (b.day !== day) continue;
    const bS = toMin(b.start);
    const bE = toMin(b.end);
    if (startMin < bE && effectiveEnd > bS) {
      const label = b.type === 'lunch_break' ? 'lunch break' : 'break';
      return { ok: false, reason: `Overlaps a ${label} (${fmt12(b.start)}–${fmt12(b.end)}).` };
    }
  }

  // 4. Other appointments (incl. their trailing buffer). End times are
  //    exclusive: clicking AT `aE` is allowed (next slot starts there).
  //    When the conflict lies inside the buffer trail (i.e. past the
  //    appointment's nominal end but inside its `bufferAfter`), the
  //    error explicitly names the buffer so the user understands why
  //    a seemingly-empty slot is unavailable.
  for (const a of appts) {
    if (a.id === excludeId) continue;
    if (a.staffId !== staffId) continue;
    if (a.day !== day) continue;
    if (a.status === 'canceled') continue;
    const aSvc = (typeof SERVICES !== 'undefined' ? SERVICES : []).find(s => s.id === a.serviceId);
    const aRawBuf = (aSvc && aSvc.bufferAfter) || 0;
    const aBodyEnd = toMin(a.end);
    // Other appt's buffer is also subject to the "ignore if it lands in
    // already-blocked territory" rule, so a previous service ending at
    // shift edge / lunch boundary doesn't falsely block the next booking.
    const aBuf = effectiveBuffer({ staffId: a.staffId, day: a.day, endMin: aBodyEnd, bufferAfter: aRawBuf });
    const aS = toMin(a.start);
    const aE = aBodyEnd + aBuf;
    if (startMin < aE && effectiveEnd > aS) {
      const cust = (typeof CUSTOMERS !== 'undefined' ? CUSTOMERS : []).find(c => c.id === a.customerId);
      const who = cust ? cust.name + "'s " : '';
      const insideBuffer = aBuf > 0 && startMin >= aBodyEnd;
      if (insideBuffer) {
        return { ok: false, reason: `In the ${aBuf}-min buffer after ${who}${fmt12(a.start)}–${fmt12(a.end)} appointment. Free again at ${fmt12(fromMin(aE))}.` };
      }
      const ourBufNote = (effBuf > 0 && endMin <= aS && effectiveEnd > aS)
        ? ` — the ${effBuf}-min buffer would overlap the next appointment`
        : '';
      const theirBufNote = (!ourBufNote && aBuf > 0) ? ` (+${aBuf}m buffer)` : '';
      return { ok: false, reason: `Conflicts with ${who}${fmt12(a.start)}–${fmt12(a.end)} appointment${theirBufNote}${ourBufNote}.` };
    }
  }

  return { ok: true };
}

// Validate a manual block slot — same rules as an appointment except that
// the source is itself a block and `excludeBlockId` is the one we're
// dragging or editing (so it doesn't conflict with itself).
//
// `skipLunchCheck` lets the LunchBreakModal validate a per-day lunch
// override without conflicting with the previous override it's about to
// replace. Block-modal callers leave it false.
export function validateBlockSlot({ staffId, day, startMin, endMin, excludeBlockId = null, appointments = null, skipLunchCheck = false }) {
  // Reuse the appt validator for working hours / business hours / lunch /
  // appointments. Then add a separate scan that ignores the block itself.
  const v = validateApptSlot({ staffId, day, startMin, endMin, appointments, skipLunchCheck });
  // Replace the "manual block overlap" failure with one that excludes this
  // specific block id.
  if (!v.ok && v.reason && (v.reason.includes('Overlaps a break') || v.reason.includes('Overlaps a lunch break'))) {
    const blocks = typeof BLOCKS !== 'undefined' ? BLOCKS : [];
    let collision = null;
    for (const b of blocks) {
      if (b.id === excludeBlockId) continue;
      if (b.staffId !== staffId) continue;
      if (b.day !== day) continue;
      const bS = toMin(b.start);
      const bE = toMin(b.end);
      if (startMin < bE && endMin > bS) { collision = b; break; }
    }
    if (!collision) return { ok: true };
    const label = collision.type === 'lunch_break' ? 'lunch break' : 'break';
    return { ok: false, reason: `Overlaps a ${label} (${fmt12(collision.start)}–${fmt12(collision.end)}).` };
  }
  return v;
}

// Build the patched appointment object resulting from a drag-to-new-slot.
// Preserves the original duration; recalculates `end` from the new start.
export function moveAppointment(appt, { day, staffId, startMin }) {
  const duration = toMin(appt.end) - toMin(appt.start);
  return {
    ...appt,
    day: day || appt.day,
    staffId: staffId || appt.staffId,
    start: fromMin(startMin),
    end:   fromMin(startMin + duration),
  };
}

// ─────────────────────────────────────────────────────────────────
// effectiveBuffer — returns the buffer the system should actually
// enforce / render for an appointment ending at `endMin` on `day`
// for `staffId`. The raw bufferAfter is zeroed when the buffer
// would extend INTO another already-unavailable region: end of
// shift, the recurring lunch break, or a manual break / lunch break
// on the same day. In those cases the buffer adds no value (nothing
// can be booked there anyway) so we don't block back-to-back
// scheduling or render a redundant buffer strip.
//
// Rules (any one ⇒ effective buffer is 0):
//   • appt body fits within the shift AND buffer would reach/extend
//     past the shift's end time
//   • appt body ends before/at the recurring lunch start AND buffer
//     would reach the lunch start
//   • appt body ends before/at a manual block's start AND buffer
//     would reach that block's start
//
// Otherwise the raw bufferAfter is preserved.
// ─────────────────────────────────────────────────────────────────
export function effectiveBuffer({ staffId, day, endMin, bufferAfter }) {
  if (!bufferAfter || bufferAfter <= 0) return 0;
  const staff = (typeof STAFF !== 'undefined' ? STAFF : []).find(s => s.id === staffId);

  // 1. End of staff shift
  if (staff) {
    const sched = staff.hours[dayName(day)];
    if (Array.isArray(sched)) {
      const workEnd = toMin(sched[1]);
      if (endMin <= workEnd && endMin + bufferAfter >= workEnd) return 0;
    }
  }

  // 2. Recurring weekly lunch (with per-day override)
  if (staff && typeof getLunchFor === 'function') {
    const lunch = getLunchFor(staff, day);
    if (lunch) {
      const [ls] = lunch.replace('–', '-').split('-');
      const lStart = toMin(ls);
      if (endMin <= lStart && endMin + bufferAfter >= lStart) return 0;
    }
  }

  // 3. Manual breaks / lunch breaks
  const blocks = typeof BLOCKS !== 'undefined' ? BLOCKS : [];
  for (const b of blocks) {
    if (b.staffId !== staffId) continue;
    if (b.day !== day) continue;
    const bS = toMin(b.start);
    if (endMin <= bS && endMin + bufferAfter >= bS) return 0;
  }

  return bufferAfter;
}

window.snapMinutes = snapMinutes;
window.timeFromY = timeFromY;
window.validateApptSlot = validateApptSlot;
window.validateBlockSlot = validateBlockSlot;
window.moveAppointment = moveAppointment;
window.effectiveBuffer = effectiveBuffer;

// ─────────────────────────────────────────────────────────────────
// effectiveBusinessHours — merge BUSINESS.hours (weekly template)
// with BUSINESS.closures (date-specific overrides). Returns the same
// shape as BUSINESS.hours[*] plus an optional `closureName` so error
// messages can name the holiday.
//
// Closure semantics, mirrored from the Settings/Onboarding flows:
//   { date, fullDay: true }   \u2192 whole day shut
//   { date, fullDay: false,
//     open, close }            \u2192 special hours that override the weekly template
//
// A non-fullDay closure with open === close (or no times) falls back
// to the weekly hours.
// ─────────────────────────────────────────────────────────────────
export function effectiveBusinessHours(day) {
  if (typeof BUSINESS === 'undefined' || !BUSINESS.hours) return null;
  const base = BUSINESS.hours[dayName(day)];
  if (!base) return null;
  const list = Array.isArray(BUSINESS.closures) ? BUSINESS.closures : [];
  const match = list.find(c => c && c.date === day);
  if (!match) return base;
  if (match.fullDay) {
    return { open: base.open, close: base.close, closed: true, closureName: match.name || 'Closed' };
  }
  if (match.open && match.close && match.open !== match.close) {
    return { open: match.open, close: match.close, closed: false, closureName: match.name || '' };
  }
  return base;
}
window.effectiveBusinessHours = effectiveBusinessHours;
