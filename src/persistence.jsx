import { ACTIVE_LOCATION_ID, LOCATIONS, setActiveLocation } from './data';
import { LUNCH_OVERRIDES } from './lunch-break-modal';

// Calendar session persistence — keeps the mutable calendar data
// (appointments, manual breaks / lunch breaks, per-day lunch overrides)
// in localStorage so:
//
//   • A reload doesn't lose user edits.
//   • The owner app (index.html) and the employee app (Employee.html)
//     share state — book in one, reload the other, see it there.
//   • If both apps are open in different tabs at the same time, the
//     `storage` event fires and each tab re-hydrates immediately.
//
// Snapshot is keyed by the local calendar day. When the day rolls over,
// we DISCARD the snapshot so the demo seed (which is "today"-relative)
// is honored again — otherwise yesterday's appointments would keep
// showing on today's grid forever. User edits made on the current day
// persist within that day.
//
// Backend integration note: this is purely client-side. A real deploy
// would replace persistSession() with POST/PATCH/DELETE to a backend
// (e.g. /appointments, /blocks, /lunch-overrides) and replace the
// storage-event listener with SSE/WebSocket pushes. The data model
// in `_snapshot` is already in the shape a server would round-trip.

export const PERSIST_KEY = 'receptionly_calendar_v1';

export function _todayStampKey() {
  // Stable, local-day stamp so we can detect "is this snapshot from today?".
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
}

export function _snapshot() {
  const out = {
    version: 1,
    stamp: _todayStampKey(),
    locs: {},
    lunchOverrides: (typeof LUNCH_OVERRIDES !== 'undefined') ? LUNCH_OVERRIDES : {},
  };
  for (const loc of LOCATIONS) {
    out.locs[loc.id] = {
      appointments: loc.appointments || [],
      blocks: loc.blocks || [],
    };
  }
  return out;
}

// Debounced save — drag events fire many times per second; coalesce into a
// single localStorage write so we never block the main thread.
export let _saveT = null;
export function persistSession() {
  if (_saveT) return;
  _saveT = setTimeout(() => {
    _saveT = null;
    try {
      localStorage.setItem(PERSIST_KEY, JSON.stringify(_snapshot()));
    } catch (_) {
      // Quota / private-mode failure — silently degrade to session-only.
    }
  }, 80);
}

export function hydrateSession() {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return false;
    const snap = JSON.parse(raw);
    if (!snap || !snap.locs) return false;
    // Stale-day check: if the snapshot is from a previous local day, drop
    // it so the freshly-seeded "today" data is what the user sees.
    if (snap.stamp && snap.stamp !== _todayStampKey()) {
      localStorage.removeItem(PERSIST_KEY);
      return false;
    }
    for (const loc of LOCATIONS) {
      const saved = snap.locs[loc.id];
      if (!saved) continue;
      if (Array.isArray(saved.appointments)) {
        loc.appointments.length = 0;
        for (const a of saved.appointments) loc.appointments.push(a);
      }
      if (Array.isArray(saved.blocks)) {
        if (!loc.blocks) loc.blocks = [];
        loc.blocks.length = 0;
        for (const b of saved.blocks) loc.blocks.push(b);
      }
    }
    if (snap.lunchOverrides && typeof LUNCH_OVERRIDES !== 'undefined') {
      Object.keys(LUNCH_OVERRIDES).forEach(k => delete LUNCH_OVERRIDES[k]);
      Object.assign(LUNCH_OVERRIDES, snap.lunchOverrides);
    }
    return true;
  } catch (_) { return false; }
}

// React-friendly cross-tab listener. Pass a callback that re-derives any
// view state from the (now hydrated) globals — e.g. rebuilds the admin
// app's `apptsByLoc` from `LOCATIONS[*].appointments`. Returns an
// unsubscribe.
export function onStorageSync(handler) {
  function listener(e) {
    if (e.key !== PERSIST_KEY) return;
    hydrateSession();
    handler && handler();
  }
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}

// Hydrate immediately. This runs AFTER data.jsx (which seeds the demo)
// and AFTER lunch-break-modal.jsx (which defines LUNCH_OVERRIDES). The
// active-location pointer is set up by data.jsx's `setActiveLocation`
// call site in the app shells; this just overlays user edits onto the
// freshly-seeded arrays.
hydrateSession();
// Re-point the active globals at the (possibly mutated) hydrated arrays.
if (typeof ACTIVE_LOCATION_ID === 'string' && typeof setActiveLocation === 'function') {
  setActiveLocation(ACTIVE_LOCATION_ID);
}

Object.assign(window, {
  PERSIST_KEY, persistSession, hydrateSession, onStorageSync,
});
