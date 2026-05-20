import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppointmentsPage, NewAppointmentModal } from './appointments';
import { BookingPage } from './booking';
import { CalendarPage } from './calendar';
import { ContactPage } from './contact';
import { CustomersPage } from './customers';
import { DashboardPage } from './dashboard';
import { BUSINESS, LOCATIONS, deleteLocation, fmt12, getLocation, parseDay, setActiveLocation } from './data';
import { I } from './icons';
import { AppointmentModal } from './modal';
import { NavGuardProvider, useNavGuard } from './nav-guard';
import { onStorageSync, persistSession } from './persistence';
import { ReportsPage } from './reports';
import { ResourcesPage } from './resources';
import { ServicesPage } from './services';
import { SettingsPage } from './settings';
import { StaffPage } from './staff';
import { BusinessMark, CustomerAvatar, ToastHost, cx, showToast } from './ui';

// Main app shell — sidebar, top bar, routing
// Location-aware: the BUSINESS / STAFF / SERVICES / RESOURCES / CUSTOMERS
// globals are swapped whenever the active location changes, and the routed
// page is remounted via a key so every page re-reads from scratch.

export const NAV = [
  { id:'dashboard', label:'Dashboard', icon: <I.Dashboard /> },
  { id:'calendar',  label:'Calendar',  icon: <I.Calendar /> },
  { id:'appointments', label:'Appointments', icon: <I.List /> },
  { id:'staff',     label:'Staff',     icon: <I.Users /> },
  { id:'services',  label:'Services',  icon: <I.Scissors /> },
  { id:'resources', label:'Resources', icon: <I.Door /> },
  { id:'customers', label:'Customers', icon: <I.Sparkles /> },
  { id:'booking',   label:'Online Booking', icon: <I.Globe /> },
  { id:'reports',   label:'Reports',   icon: <I.Chart /> },
  { id:'settings',  label:'Settings',  icon: <I.Settings /> },
  { id:'contact',   label:'Contact Us', icon: <I.Mail /> },
];

export function App() {
  return (
    <NavGuardProvider>
      <AppShell />
    </NavGuardProvider>
  );
}

export function AppShell() {
  const navGuard = useNavGuard();
  const [route, _setRoute] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Allow query params to deep-link a new location: ?location=<id>
  const initialLocId = useMemo(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('location');
      if (q && LOCATIONS.find(l => l.id === q)) return q;
    } catch {}
    return LOCATIONS[0].id;
  }, []);
  const [activeLocId, _setActiveLocId] = useState(() => {
    setActiveLocation(initialLocId);
    return initialLocId;
  });

  // Appointments are kept per-location so switching is instant and edits
  // persist within the location they were made in.
  const [apptsByLoc, setApptsByLoc] = useState(() => {
    const o = {};
    for (const loc of LOCATIONS) o[loc.id] = [...loc.appointments];
    return o;
  });
  const appointments = apptsByLoc[activeLocId] || [];

  const [activeAppt, setActiveAppt] = useState(null);
  const [creatingAppt, setCreatingAppt] = useState(false);
  // Bumped after the locations registry is mutated (e.g. delete) so any
  // component reading the global LOCATIONS array re-renders.
  const [locVersion, setLocVersion] = useState(0);
  const bumpLocVersion = useCallback(() => setLocVersion(v => v + 1), []);
  const [completedOnboarding, setCompletedOnboarding] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('welcome') === '1'; }
    catch { return false; }
  });
  const [newLocationName, setNewLocationName] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('newLocation') || ''; }
    catch { return ''; }
  });

  function setActiveLocId(id) {
    if (id === activeLocId) return;
    navGuard.request(() => {
      setActiveLocation(id);
      _setActiveLocId(id);
      // Close any open modals/sheets for the previous location.
      setActiveAppt(null);
      setCreatingAppt(false);
    });
  }

  // Remove a location and any of its in-memory appointments. If the deleted
  // location was active, switch to whatever fallback the data layer picks.
  function handleDeleteLocation(id) {
    const target = LOCATIONS.find(l => l.id === id);
    const res = deleteLocation(id);
    if (!res.ok) return res;
    setApptsByLoc(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (id === activeLocId) {
      _setActiveLocId(res.fallbackId);
    }
    bumpLocVersion();
    if (target) showToast({ title: 'Location deleted', body: `${target.name} was removed from your account.` });
    return res;
  }

  // Remove a service from the active location: drop any appointments that
  // referenced it and dismiss any open detail modal pointing at one. Note
  // ServicesPage already mutates the global SERVICES / STAFF.services /
  // RESOURCES.services arrays so other pages reflect the change on render.
  function handleServiceDeleted(svcId) {
    setApptsByLoc(prev => {
      const next = {};
      let changed = false;
      for (const k of Object.keys(prev)) {
        const filtered = prev[k].filter(a => a.serviceId !== svcId);
        if (filtered.length !== prev[k].length) changed = true;
        next[k] = filtered;
      }
      return changed ? next : prev;
    });
    // Also remove the service from the active location's seed appointment
    // list so a future re-mount of the page doesn't resurrect them.
    LOCATIONS.forEach(loc => {
      if (Array.isArray(loc.appointments)) {
        loc.appointments = loc.appointments.filter(a => a.serviceId !== svcId);
      }
    });
    if (activeAppt && activeAppt.serviceId === svcId) setActiveAppt(null);
  }

  // Guarded route change — pops the Unsaved-changes modal if any registered
  // form is dirty. Used for sidebar nav, top-bar shortcuts, etc.
  function setRoute(next) {
    navGuard.request(() => _setRoute(next));
  }

  function updateAppointment(updated) {
    setApptsByLoc(prev => ({
      ...prev,
      [activeLocId]: (prev[activeLocId] || []).map(a => a.id === updated.id ? updated : a),
    }));
    // Keep the open detail modal in sync if it's showing this appt.
    // For background updates (e.g. drag-to-reschedule with the modal closed)
    // we don't want to pop the modal open as a side-effect.
    setActiveAppt(curr => (curr && curr.id === updated.id) ? updated : curr);
    // Mirror to the location's source-of-truth array so the employee app
    // (which reads loc.appointments directly via the global APPOINTMENTS)
    // sees the change after a navigation — and so persistence catches it.
    const loc = getLocation(activeLocId);
    if (loc) {
      const idx = loc.appointments.findIndex(a => a.id === updated.id);
      if (idx >= 0) loc.appointments[idx] = updated;
    }
    if (typeof persistSession === 'function') persistSession();
  }

  function addAppointment(prefill) {
    // `prefill` may be {date, start, staffId} when triggered from a
    // calendar slot click; null/undefined for the top-bar New button.
    setCreatingAppt(prefill && typeof prefill === 'object' ? prefill : true);
  }

  function createAppointment(draft) {
    const newA = {
      id: 'new_' + Date.now(),
      ...draft,
      status: 'confirmed',
    };
    setApptsByLoc(prev => ({
      ...prev,
      [activeLocId]: [...(prev[activeLocId] || []), newA],
    }));
    const loc = getLocation(activeLocId);
    if (loc) loc.appointments.push(newA);
    if (typeof persistSession === 'function') persistSession();
    setCreatingAppt(false);
    showToast({ title: 'Appointment booked', body: `${parseDay(newA.day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${fmt12(newA.start)}` });
  }

  // Cross-tab sync: when the employee app (or another owner tab) writes to
  // localStorage, mirror the change back into apptsByLoc so the calendar
  // updates without a manual refresh. The persistence layer has already
  // re-hydrated loc.appointments by the time our handler runs.
  useEffect(() => {
    if (typeof onStorageSync !== 'function') return;
    return onStorageSync(() => {
      setApptsByLoc(() => {
        const next = {};
        for (const loc of LOCATIONS) next[loc.id] = [...loc.appointments];
        return next;
      });
      // Bump the location version too so any LOCATIONS-driven UI (sidebar)
      // and the calendar's manual-blocks list re-derive.
      bumpLocVersion();
    });
  }, [bumpLocVersion]);

  return (
    <div className="min-h-screen flex bg-bg">
      <Sidebar route={route} onNav={setRoute} activeLocId={activeLocId} onLocationChange={setActiveLocId} locVersion={locVersion} sidebarOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar onNav={setRoute} onAdd={addAppointment} onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1 px-6 lg:px-8 py-6 max-w-[1500px] w-full mx-auto">
          {completedOnboarding && (
            <div className="rounded-lg border border-accent/30 bg-accentSoft/50 px-4 py-3 mb-5 flex items-center gap-3">
              <I.Check size={16} className="text-accent"/>
              <div className="flex-1 text-[13.5px] text-accentInk"><span className="font-medium">Welcome to Receptionly.</span> Your account is set up. Your AI receptionist is ready to start taking calls.</div>
              <button onClick={()=>setCompletedOnboarding(false)} className="text-accentInk/60 hover:text-accentInk"><I.X size={14}/></button>
            </div>
          )}
          {newLocationName && (
            <div className="rounded-lg border border-accent/30 bg-accentSoft/50 px-4 py-3 mb-5 flex items-center gap-3">
              <I.Check size={16} className="text-accent"/>
              <div className="flex-1 text-[13.5px] text-accentInk">
                <span className="font-medium">New location added.</span> {newLocationName} is now live and available in the location switcher.
              </div>
              <button onClick={()=>setNewLocationName('')} className="text-accentInk/60 hover:text-accentInk"><I.X size={14}/></button>
            </div>
          )}
          {/* Key on activeLocId+locVersion forces every page to remount when
              either the location switches OR persistence syncs in changes
              from another tab — so views re-read the swapped/hydrated globals
              (BLOCKS, LUNCH_OVERRIDES, …) from scratch. */}
          <div key={activeLocId + ':' + locVersion}>
            {route === 'dashboard' && <DashboardPage appointments={appointments} onOpen={setActiveAppt} onNav={setRoute} onAddAppointment={addAppointment} />}
            {route === 'calendar' && <CalendarPage appointments={appointments} onOpen={setActiveAppt} onAddAppointment={addAppointment} onUpdate={updateAppointment} />}
            {route === 'appointments' && <AppointmentsPage appointments={appointments} onOpen={setActiveAppt} onAddAppointment={addAppointment} />}
            {route === 'staff' && <StaffPage />}
            {route === 'services' && <ServicesPage onServiceDeleted={handleServiceDeleted} />}
            {route === 'resources' && <ResourcesPage />}
            {route === 'customers' && <CustomersPage appointments={appointments} onOpen={setActiveAppt} />}
            {route === 'booking' && <BookingPage />}
            {route === 'reports' && <ReportsPage />}
            {route === 'settings' && <SettingsPage
              onStartOnboarding={()=>{ navGuard.request(() => { window.location.href = 'onboarding.html'; }); }}
              onAddLocation={()=>{ navGuard.request(() => { window.location.href = 'onboarding_new.html'; }); }}
              onSwitchLocation={setActiveLocId}
              onDeleteLocation={handleDeleteLocation}
              onNav={setRoute}
              activeLocId={activeLocId}
              locVersion={locVersion}
            />}
            {route === 'contact' && <ContactPage />}
          </div>
        </main>
      </div>
      {activeAppt && <AppointmentModal appt={activeAppt} onClose={()=>setActiveAppt(null)} onUpdate={updateAppointment} />}
      {creatingAppt && <NewAppointmentModal onClose={()=>setCreatingAppt(false)} onCreate={createAppointment} initial={typeof creatingAppt === 'object' ? creatingAppt : null} />}
      <ToastHost />
    </div>
  );
}

export function Sidebar({ route, onNav, activeLocId, onLocationChange, locVersion, sidebarOpen, onClose }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = LOCATIONS.find(l => l.id === activeLocId) || LOCATIONS[0];

  // Close location dropdown on outside click / Esc.
  useEffect(() => {
    if (!open) return;
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Close mobile drawer on Esc
  useEffect(() => {
    if (!sidebarOpen) return;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sidebarOpen, onClose]);

  // Lock body scroll while drawer is open on mobile
  useEffect(() => {
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    if (sidebarOpen && !isDesktop) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cx(
          'fixed inset-0 z-40 transition-opacity duration-200 lg:hidden',
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        style={{ background: 'rgba(20,18,15,.35)' }}
        onClick={onClose}
      />

      <aside className={cx(
        'fixed inset-y-0 left-0 z-50 w-[280px] border-r border-line bg-surface flex flex-col transition-transform duration-200 ease-in-out',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:sticky lg:top-0 lg:h-screen lg:w-[232px] lg:flex-shrink-0 lg:translate-x-0 lg:z-auto'
      )}>

        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="lg:hidden absolute top-3 right-3 p-1.5 rounded-lg text-muted hover:text-ink hover:bg-bg/70 transition"
          aria-label="Close navigation"
        >
          <I.X size={16} />
        </button>

        {/* Business / location switcher */}
        <div ref={ref} className="relative m-3 mb-2">
          <button
            onClick={() => setOpen(o => !o)}
            className={cx(
              'w-full flex items-center gap-2.5 p-2 rounded-lg transition text-left',
              open ? 'bg-bg/80' : 'hover:bg-bg/70'
            )}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <BusinessMark
              logo={BUSINESS.logo}
              monogram={BUSINESS.logoMonogram}
              size={32}
              rounded="md"
              alt={`${BUSINESS.name} logo`}
              className="shadow-card"
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-ink truncate text-[13.5px] leading-tight">{active.name}</div>
              <div className="text-[11px] text-muted truncate mt-0.5">{BUSINESS.name} · {LOCATIONS.length} location{LOCATIONS.length === 1 ? '' : 's'}</div>
            </div>
            <I.ChevronDown size={14} className={cx('text-muted transition-transform', open && 'rotate-180')} />
          </button>

          {open && (
            <div className="absolute left-0 right-0 top-full mt-1.5 rounded-xl2 border border-line bg-surface shadow-pop z-40 p-1.5 fadein">
              <div className="px-2 pt-1.5 pb-1 text-[10.5px] uppercase tracking-[0.14em] text-muted font-medium">Switch location</div>
              <div className="max-h-[320px] overflow-y-auto">
                {LOCATIONS.map(loc => {
                  const sel = loc.id === activeLocId;
                  return (
                    <button
                      key={loc.id}
                      onClick={() => { onLocationChange(loc.id); setOpen(false); }}
                      className={cx(
                        'w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition',
                        sel ? 'bg-accentSoft/60' : 'hover:bg-bg/70'
                      )}
                    >
                      <div className={cx(
                        'w-8 h-8 rounded-md font-serif text-[13px] flex items-center justify-center flex-shrink-0',
                        sel ? 'bg-accent text-white' : 'bg-bg text-ink2'
                      )}>
                        <I.Map size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={cx('text-[13px] truncate leading-tight', sel ? 'text-ink font-medium' : 'text-ink')}>{loc.name}</div>
                        <div className="text-[11px] text-muted truncate mt-0.5">{loc.business.address} · {loc.business.city}</div>
                      </div>
                      {sel && <I.Check size={14} className="text-accent flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-line mt-1.5 pt-1.5">
                <a
                  href="onboarding_new.html"
                  className="w-full flex items-center gap-2.5 p-2 rounded-lg text-left hover:bg-bg/70 transition text-[13px] text-ink"
                >
                  <div className="w-8 h-8 rounded-md bg-bg text-ink2 flex items-center justify-center flex-shrink-0">
                    <I.Plus size={14} />
                  </div>
                  <span>Add new location</span>
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="px-2 mb-1 flex items-center gap-2">
          <div className="flex-1 h-px bg-line"/>
        </div>

        <nav className="px-2 flex-1 overflow-y-auto">
          {NAV.map(n => (
            <button key={n.id} onClick={() => { onNav(n.id); onClose(); }}
              className={cx('nav-item w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] mb-0.5 transition',
                route === n.id ? 'bg-ink text-white' : 'text-ink2 hover:text-ink hover:bg-bg/70')}>
              <span className={cx(route === n.id ? 'text-white' : 'text-ink2/80')}>{n.icon}</span>
              <span className="flex-1 text-left">{n.label}</span>
            </button>
          ))}
        </nav>

      </aside>
    </>
  );
}

export function TopBar({ onNav, onAdd, onOpenSidebar }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  const today = now;
  return (
    <header className="border-b border-line bg-surface sticky top-0 z-30">
      <div className="max-w-[1500px] mx-auto px-4 lg:px-8 h-14 flex items-center gap-3">
        {/* Hamburger — mobile/tablet only */}
        <button
          onClick={onOpenSidebar}
          className="lg:hidden p-2 -ml-1 rounded-lg text-ink2 hover:text-ink hover:bg-bg/70 transition"
          aria-label="Open navigation"
        >
          <I.Menu size={20} />
        </button>
        {/* Business name pill — mobile only, since sidebar is hidden */}
        <span className="lg:hidden font-serif text-[15px] text-ink truncate flex-1 min-w-0">{BUSINESS.name}</span>
        <div className="hidden lg:block flex-1" />
        <div className="flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accentSoft/60 text-accentInk text-[12px]">
            <I.Clock size={12} />
            <span className="font-medium">{today.toLocaleDateString('en-US',{weekday:'short', month:'short', day:'numeric'})} · {today.toLocaleTimeString('en-US',{hour:'numeric', minute:'2-digit', hour12:true})}</span>
          </div>
          <div className="w-px h-6 bg-line" />
          <div className="flex items-center gap-2 pr-2 p-1">
            <CustomerAvatar name="Olivia Park" size={28} />
            <div className="hidden md:block text-left">
              <div className="text-[12.5px] font-medium text-ink leading-none">Olivia Park</div>
              <div className="text-[10.5px] text-muted mt-0.5">Owner</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
