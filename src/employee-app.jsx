import { useEffect, useMemo, useState } from 'react';
import { AppointmentsPage, NewAppointmentModal } from './appointments';
import { ContactPage } from './contact';
import { APPOINTMENTS, BUSINESS, CUSTOMERS, SERVICES, STAFF, fmt12, parseDay, todayKey } from './data';
import { EmployeeCalendar } from './employee-calendar';
import { EmployeeDashboard } from './employee-dashboard';
import { ANNOUNCEMENTS, TIME_OFF_REQUESTS, appointmentsFor, getEmployee } from './employee-data';
import { EmployeeSettings } from './employee-settings';
import { I } from './icons';
import { NavGuardProvider, useNavGuard } from './nav-guard';
import { NotesSection } from './notes-section';
import { onStorageSync, persistSession } from './persistence';
import { RescheduleModal } from './reschedule';
import { TweakSection, TweakSelect, TweaksPanel, useTweaks } from './tweaks-panel';
import { BusinessMark, Button, CustomerAvatar, StaffAvatar, StatusPill, ToastHost, cx, showToast } from './ui';

// Employee app shell — sidebar, top bar, routing, appointment modal, Tweaks.

export const EMP_NAV = [
  { id:'dashboard',    label:'Dashboard',    icon: <I.Dashboard /> },
  { id:'calendar',     label:'My calendar',  icon: <I.Calendar /> },
  { id:'appointments', label:'Appointments', icon: <I.List /> },
  { id:'settings',     label:'Settings',     icon: <I.Settings /> },
  { id:'contact',      label:'Contact Us',   icon: <I.Mail /> },
];

export function EmployeeApp() {
  return (
    <NavGuardProvider>
      <EmployeeAppShell/>
    </NavGuardProvider>
  );
}

export function EmployeeAppShell() {
  const [t, setTweak] = useTweaks(window.EMP_TWEAKS);
  const navGuard = useNavGuard();
  const [route, _setRoute] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Route through navGuard so an unsaved-changes prompt fires when leaving a
  // dirty section (e.g. Services-I-offer with pending toggles).
  const setRoute = (next) => navGuard.request(() => _setRoute(next));
  const [activeAppt, setActiveAppt] = useState(null);
  // `creatingAppt` may be true (fresh empty modal) or an object
  // {date, start, staffId} for prefill when triggered from a calendar
  // slot click. Falsy = modal closed.
  const [creatingAppt, setCreatingAppt] = useState(false);
  // Bumped whenever any appointment is mutated, so views that read from the
  // global APPOINTMENTS array (employee dashboard/calendar/appointments) re-derive.
  const [tick, setTick] = useState(0);

  const me = getEmployee(t.staffId) || STAFF[0];

  function updateAppointment(updated) {
    const idx = APPOINTMENTS.findIndex(a => a.id === updated.id);
    if (idx >= 0) APPOINTMENTS[idx] = updated;
    // Keep the open detail sheet in sync if it's showing this appt; don't
    // pop it open from a background drag/drop reschedule.
    setActiveAppt(curr => (curr && curr.id === updated.id) ? updated : curr);
    if (typeof persistSession === 'function') persistSession();
    setTick(n => n + 1);
  }

  function openCreate(prefill) {
    setCreatingAppt(prefill && typeof prefill === 'object' ? prefill : true);
  }

  function createAppointment(draft) {
    const newA = {
      id: 'new_' + Date.now(),
      ...draft,
      status: 'confirmed',
    };
    APPOINTMENTS.push(newA);
    if (typeof persistSession === 'function') persistSession();
    setCreatingAppt(false);
    setTick(n => n + 1);
    showToast({ title: 'Appointment booked', body: `${parseDay(newA.day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${fmt12(newA.start)}` });
  }

  // Cross-tab sync: when the owner app (or another employee tab) writes to
  // localStorage, bump tick so views re-derive from the freshly-hydrated
  // global APPOINTMENTS / BLOCKS arrays.
  useEffect(() => {
    if (typeof onStorageSync !== 'function') return;
    return onStorageSync(() => setTick(n => n + 1));
  }, []);

  // Read straight from the (mutated) global APPOINTMENTS list, re-snapshotted
  // whenever `tick` bumps. The AppointmentsPage takes a plain array.
  const appointments = useMemo(() => APPOINTMENTS.slice(), [tick]);

  // Counts for sidebar badges
  const todayCount = appointmentsFor(me.id, todayKey()).filter(a => a.status !== 'canceled').length;
  const pendingTimeOff = TIME_OFF_REQUESTS.filter(r => r.status === 'pending').length;
  const announcementsCount = ANNOUNCEMENTS.filter(a => a.kind === 'action').length;

  return (
    <div className="min-h-screen flex bg-bg" data-screen-label={`Employee · ${me.name}`}>
      <EmployeeSidebar
        route={route} onNav={setRoute}
        me={me}
        todayCount={todayCount}
        pendingTimeOff={pendingTimeOff}
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <EmployeeTopBar me={me} announcementsCount={announcementsCount} onOpenSidebar={() => setSidebarOpen(true)}/>
        <main className="flex-1 px-6 lg:px-8 py-6 max-w-[1400px] w-full mx-auto" data-screen-label={`Employee · ${route}`}>
          {route === 'dashboard'    && <EmployeeDashboard staffId={me.id} tweaks={t} onNav={setRoute} onOpenAppt={setActiveAppt}/>}
          {route === 'calendar'     && <EmployeeCalendar  staffId={me.id} onOpenAppt={setActiveAppt} onUpdate={updateAppointment} onAddAppointment={openCreate}/>}
          {route === 'appointments' && (
            <AppointmentsPage
              appointments={appointments}
              onOpen={setActiveAppt}
              onAddAppointment={() => openCreate()}
              meStaffId={me.id}
            />
          )}
          {route === 'settings'     && <EmployeeSettings  staffId={me.id}/>}
          {route === 'contact'      && <ContactPage />}
        </main>
      </div>

      {activeAppt && <AppointmentSheet appt={activeAppt} staff={me} onClose={() => setActiveAppt(null)} onUpdate={updateAppointment}/>}
      {creatingAppt && <NewAppointmentModal onClose={() => setCreatingAppt(false)} onCreate={createAppointment} initial={typeof creatingAppt === 'object' ? { ...creatingAppt, staffId: creatingAppt.staffId || me.id } : { staffId: me.id }}/>}

      <TweaksPanel title="Tweaks">
        <TweakSection label="View as">
          <TweakSelect
            label="Staff member"
            value={t.staffId}
            options={STAFF.map(s => ({ value: s.id, label: `${s.name} · ${s.role}` }))}
            onChange={v => setTweak('staffId', v)}
          />
        </TweakSection>
      </TweaksPanel>

      <ToastHost />
    </div>
  );
}

export function EmployeeSidebar({ route, onNav, me, todayCount, pendingTimeOff, sidebarOpen, onClose }) {

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

        {/* Identity block — personal, not a business switcher */}
        <div className="m-3 mb-2 flex items-center gap-2.5 p-2">
          <BusinessMark
            logo={BUSINESS.logo}
            monogram={BUSINESS.logoMonogram}
            size={32}
            rounded="md"
            alt={`${BUSINESS.name} logo`}
            className="shadow-card"
          />
          <div className="flex-1 min-w-0">
            <div className="font-serif text-[15px] text-ink leading-tight truncate">{BUSINESS.name}</div>
            <div className="text-[11px] text-muted truncate">Powered by Receptionly</div>
          </div>
        </div>

        <div className="px-2 mb-1 flex items-center gap-2">
          <div className="flex-1 h-px bg-line"/>
        </div>

        <nav className="px-2 flex-1 overflow-y-auto">
          {EMP_NAV.map(n => {
            const badge = n.id === 'dashboard' ? todayCount : null;
            return (
              <button key={n.id} onClick={() => { onNav(n.id); onClose(); }}
                className={cx('nav-item w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] mb-0.5 transition',
                  route === n.id ? 'bg-ink text-white' : 'text-ink2 hover:text-ink hover:bg-bg/70')}>
                <span className={route === n.id ? 'text-white' : 'text-ink2/80'}>{n.icon}</span>
                <span className="flex-1 text-left">{n.label}</span>
                {badge > 0 && (
                  <span className={cx('text-[10.5px] font-mono px-1.5 py-0.5 rounded',
                    route === n.id ? 'bg-white/15 text-white' : 'bg-line text-ink2')}>{badge}</span>
                )}
              </button>
            );
          })}
        </nav>

      </aside>
    </>
  );
}

export function EmployeeTopBar({ me, announcementsCount, onOpenSidebar }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  const today = now;

  return (
    <header className="border-b border-line bg-surface sticky top-0 z-30">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 h-14 flex items-center gap-3">
        {/* Hamburger — mobile/tablet only */}
        <button
          onClick={onOpenSidebar}
          className="lg:hidden p-2 -ml-1 rounded-lg text-ink2 hover:text-ink hover:bg-bg/70 transition"
          aria-label="Open navigation"
        >
          <I.Menu size={20} />
        </button>
        {/* Business name — mobile only */}
        <span className="lg:hidden font-serif text-[15px] text-ink truncate flex-1 min-w-0">{BUSINESS.name}</span>
        <div className="hidden lg:block flex-1" />
        <div className="flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accentSoft/60 text-accentInk text-[12px]">
            <I.Clock size={12}/>
            <span className="font-medium">{today.toLocaleDateString('en-US',{weekday:'short', month:'short', day:'numeric'})} · {today.toLocaleTimeString('en-US',{hour:'numeric', minute:'2-digit', hour12:true})}</span>
          </div>
          <div className="w-px h-6 bg-line"/>
          <div className="flex items-center gap-2 pr-2 p-1">
            <StaffAvatar staff={me} size={28}/>
            <div className="hidden md:block text-left">
              <div className="text-[12.5px] font-medium text-ink leading-none">{me.name}</div>
              <div className="text-[10.5px] text-muted mt-0.5">{me.role}</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

// Slide-in sheet shown when an appointment is opened.
export function AppointmentSheet({ appt, staff, onClose, onUpdate }) {
  const svc = SERVICES.find(s => s.id === appt.serviceId);
  const cust = CUSTOMERS.find(c => c.id === appt.customerId);
  const [status, setLocalStatus] = useState(appt.status);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);

  // Keep local status mirror in sync if the appt is replaced (after reschedule).
  useEffect(() => { setLocalStatus(appt.status); }, [appt]);

  function setStatus(s) {
    setLocalStatus(s);
    onUpdate && onUpdate({ ...appt, status: s });
  }

  function handleComplete() {
    setStatus('completed');
    setConfirmingCancel(false);
    onClose && onClose();
    showToast({ title: 'Appointment marked as complete', body: `${svc.name} with ${cust.name}.` });
  }

  function handleNoShow() {
    setStatus('no_show');
    setConfirmingCancel(false);
    onClose && onClose();
    showToast({ title: 'Marked as no-show', body: `${cust.name} didn't show for ${svc.name}.` });
  }

  function handleCancel() {
    setStatus('canceled');
    setConfirmingCancel(false);
    onClose && onClose();
    showToast({ title: 'Appointment successfully canceled', body: `${cust.name}'s ${svc.name} was canceled.` });
  }

  function handleRestore() {
    setStatus('confirmed');
    setConfirmingCancel(false);
    onClose && onClose();
    showToast({ title: 'Appointment restored', body: `${cust.name}'s ${svc.name} is back on the books.` });
  }

  function handleReopen() {
    setStatus('confirmed');
    setConfirmingCancel(false);
    onClose && onClose();
    showToast({ title: 'Appointment reopened', body: `${cust.name}'s ${svc.name} is active again.` });
  }

  function handleRescheduleConfirm(updated) {
    onUpdate && onUpdate(updated);
    setRescheduling(false);
    setConfirmingCancel(false);
    onClose && onClose();
    const when = parseDay(updated.day).toLocaleDateString('en-US',{ weekday:'short', month:'short', day:'numeric' });
    showToast({ title: 'Appointment successfully rescheduled', body: `Moved to ${when} at ${fmt12(updated.start)}.` });
  }

  useEffect(() => {
    if (rescheduling) return; // RescheduleModal owns Escape while open
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, rescheduling]);

  if (rescheduling) {
    return (
      <RescheduleModal
        appt={appt}
        onClose={() => setRescheduling(false)}
        onConfirm={handleRescheduleConfirm}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 fadein" style={{ background: 'rgba(20,18,15,.32)' }} onClick={onClose}>
      <div className="absolute right-0 top-0 h-full w-full max-w-[460px] bg-surface border-l border-line shadow-pop overflow-auto"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-line sticky top-0 bg-surface z-10">
          <div className="flex items-start justify-between gap-3 mb-3">
            <StatusPill status={status}/>
            <button onClick={onClose} className="text-muted hover:text-ink p-1 -mr-1"><I.X size={16}/></button>
          </div>
          <div className="font-serif text-[28px] text-ink leading-tight">{svc.name}</div>
          <div className="text-[13px] text-ink2 mt-1">
            {new Date(parseDay(appt.day)).toLocaleDateString('en-US',{weekday:'long', month:'long', day:'numeric'})} · {fmt12(appt.start)} – {fmt12(appt.end)}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Client */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2.5">Client</div>
            <div className="flex items-center gap-3">
              <CustomerAvatar name={cust.name} size={44}/>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium text-[15px] text-ink">{cust.name}</div>
                </div>
                <div className="text-[12.5px] text-muted">
                  {cust.visits > 0 ? `${cust.visits} visits · last ${cust.lastVisit}` : 'First visit'}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1.5 mt-3 text-[12.5px] text-ink2">
              <div className="inline-flex items-center gap-1.5"><I.Phone size={12} className="text-muted"/> {cust.phone}</div>
              <div className="inline-flex items-center gap-1.5"><I.Mail size={12} className="text-muted"/> {cust.email}</div>
            </div>
            {/* Customer notes — sourced from the client profile (admin Customers
                page). Read-only here so employee context can't drift from the
                source of truth. */}
            {cust.notes && cust.notes.trim() && (
              <div className="mt-3">
                <NotesSection value={cust.notes} label="Customer notes" />
              </div>
            )}
          </div>

          {/* Service */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2.5">Service</div>
            <div className="rounded-lg border border-line p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="text-[13.5px] font-medium text-ink">{svc.name}</div>
                <div className="text-[13.5px] font-medium text-ink">${svc.price}</div>
              </div>
              <div className="text-[12px] text-muted">{svc.duration} min · {fmt12(appt.start)} – {fmt12(appt.end)}</div>
            </div>
          </div>

          {/* Source */}
          <div className="flex items-center gap-2 text-[12px] text-muted">
            <I.Calendar size={12}/>
            Booked via {appt.source === 'ai' ? 'AI receptionist' : appt.source === 'online' ? 'online booking' : appt.source === 'phone' ? 'phone' : 'walk-in'}
          </div>

          {/* Status banners */}
          {status === 'completed' && (
            <div className="rounded-lg border border-accent/25 bg-accentSoft/50 px-3.5 py-2.5 flex items-center gap-2.5 text-[13px] text-accentInk">
              <I.Check size={14} className="text-accent shrink-0"/>
              <span><span className="font-medium">Completed.</span> This appointment is closed and can no longer be changed.</span>
            </div>
          )}
          {status === 'no_show' && (
            <div className="rounded-lg border px-3.5 py-2.5 flex items-center gap-2.5 text-[13px]" style={{ borderColor: '#D4B776', background: '#FBF4DD', color: '#6B4D00' }}>
              <I.AlertTriangle size={14} className="shrink-0" style={{ color: '#A07A1E' }}/>
              <span><span className="font-medium">No-show.</span> Client didn't arrive. Reopen to bring the appointment back.</span>
            </div>
          )}
          {status === 'canceled' && (
            <div className="rounded-lg border border-rose/25 bg-roseSoft/50 px-3.5 py-2.5 flex items-center gap-2.5 text-[13px] text-rose">
              <I.X size={14} className="text-rose shrink-0"/>
              <span><span className="font-medium">Canceled.</span> Restore the appointment to bring it back.</span>
            </div>
          )}

          {/* Notes — inline editable, always visible (with empty state). */}
          <NotesSection
            appt={appt}
            onSave={(notes) => onUpdate && onUpdate({ ...appt, notes })}
          />
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-line bg-bg/30 sticky bottom-0">
          {confirmingCancel ? (
            <div className="space-y-3 fadein">
              <div className="text-[13px] text-ink">
                Cancel this appointment?
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setConfirmingCancel(false)}>Keep it</Button>
                <Button variant="danger" className="flex-1" onClick={handleCancel}>
                  Yes, cancel
                </Button>
              </div>
            </div>
          ) : status === 'completed' ? (
            <div className="flex items-center justify-between gap-3">
              <div className="text-[12.5px] text-ink2">Reopen to reschedule or cancel.</div>
              <Button variant="accent" size="sm" onClick={handleReopen}>
                <I.Refresh size={13}/> Reopen appointment
              </Button>
            </div>
          ) : status === 'no_show' ? (
            <div className="flex items-center justify-between gap-3">
              <div className="text-[12.5px] text-ink2">Reopen if they showed up after all.</div>
              <Button variant="accent" size="sm" onClick={handleReopen}>
                <I.Refresh size={13}/> Reopen appointment
              </Button>
            </div>
          ) : status === 'canceled' ? (
            <Button variant="accent" className="w-full" onClick={handleRestore}>
              <I.Refresh size={13}/> Restore appointment
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="accent" className="flex-1" onClick={handleComplete}><I.Check size={13}/> Mark complete</Button>
              <Button variant="secondary" size="sm" onClick={() => setRescheduling(true)}>Reschedule</Button>
              <Button variant="secondary" size="sm" onClick={handleNoShow} title="Mark no-show"><I.AlertTriangle size={13}/> No-show</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingCancel(true)} className="!text-rose hover:!bg-roseSoft/60">
                <I.X size={13}/> Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
