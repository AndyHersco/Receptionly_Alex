import { useEffect, useRef, useState } from 'react';
import { ClosuresSection } from './closures';
import { ACCOUNT, BUSINESS, LOCATIONS } from './data';
import { I } from './icons';
import { useDirtyGuard, useNavGuard } from './nav-guard';
import { BusinessMark, Button, CopyButton, Field, LogoUploader, TimePicker, Toggle, cx } from './ui';

// Onboarding wizard — 10 steps. Lives in its own full-screen flow.

// Validation rules per step. Returns an object of { fieldKey: 'message' } or {} if clean.
export function validateStep(step, data) {
  const errs = {};
  const req = (v) => !v || (typeof v === 'string' && !v.trim());
  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim());
  if (step === 0) {
    if (req(data.bizName)) errs.bizName = 'Business name is required';
    if (req(data.owner)) errs.owner = 'Owner name is required';
    if (req(data.email)) errs.email = 'Email is required';
    else if (!isEmail(data.email)) errs.email = 'Enter a valid email address';
    if (req(data.phone)) errs.phone = 'Phone is required';
    if (req(data.password)) errs.password = 'Password is required';
    else if (data.password.length < 8) errs.password = 'Use at least 8 characters';
  } else if (step === 1) {
    if (req(data.address)) errs.address = 'Street address is required';
    if (req(data.city)) errs.city = 'City is required';
    if (req(data.state)) errs.state = 'State is required';
    if (req(data.zip)) errs.zip = 'ZIP is required';
  } else if (step === 2) {
    const anyOpen = Object.values(data.hours).some((h) => !h.closed);
    if (!anyOpen) errs._form = 'Open at least one day to continue.';
  } else if (step === 3) {
    const named = data.staff.filter((s) => s.name && s.name.trim());
    if (named.length === 0) errs._form = 'Add at least one staff member (a name is required).';
    else {
      data.staff.forEach((s, i) => { if (!s.name || !s.name.trim()) errs['staff_' + i] = 'Name required'; });
    }
  } else if (step === 4) {
    if (data.usesResources) {
      data.resources.forEach((r, i) => {
        if (!r.name || !r.name.trim()) errs['res_name_' + i] = 'Name required';
      });
    }
  } else if (step === 5) {
    const named = data.services.filter((s) => s.name && s.name.trim());
    if (named.length === 0) errs._form = 'Add at least one service.';
    else {
      data.services.forEach((s, i) => {
        if (!s.name || !s.name.trim()) errs['svc_name_' + i] = 'Service name required';
        if (!s.category) errs['svc_cat_' + i] = 'Choose a category';
        if (!s.duration || s.duration <= 0) errs['svc_dur_' + i] = 'Duration must be > 0';
      });
    }
  } else if (step === 6) {
    // Staff Assignment — ensure each staff has at least one working day.
    // schedule may not yet be hydrated; inherit defaults from business hours.
    (data.staff || []).forEach((s, i) => {
      if (!s.name || !s.name.trim()) return;
      const sched = s.schedule;
      let anyWorking;
      if (sched) {
        anyWorking = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].some((d) => sched[d] && !sched[d].off);
      } else {
        anyWorking = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].some((d) => data.hours && data.hours[d] && !data.hours[d].closed);
      }
      if (!anyWorking) errs['sa_sched_' + i] = (s.name || 'This staff member') + ' has no working days';
    });
  } else if (step === 7) {
    // Booking URL is now auto-generated and read-only — no validation needed.
  }
  return errs;
}

// Validate every step *before* `target`. Returns true if user is allowed to
// jump there directly from the sidebar.
export function canNavigateTo(target, data) {
  for (let i = 0; i < target; i++) {
    const errs = validateStep(i, data);
    if (Object.keys(errs).length) return false;
  }
  return true;
}

export function Onboarding({ onComplete, onExit, mode = 'new-business' }) {
  // When adding a location to an existing business, we skip the Account step
  // because the account already exists.
  const isNewLocation = mode === 'new-location';
  const [step, setStep] = useState(isNewLocation ? 1 : 0);
  const [errors, setErrors] = useState({});
  const [shake, setShake] = useState(false);
  // Snapshot of the initial form so we can tell whether the user has typed
  // anything yet — routes the exit/skip action through the unsaved-changes
  // prompt if so. Onboarding is a creation flow: no "Save & leave".
  const initialDataRef = useRef(null);
  const navGuard = useNavGuard();
  const [data, setData] = useState({
    bizName: '', type: 'Salon', owner: '', email: '', phone: '', password: '',
    address: '', city: '', state: '', zip: '', tz: 'America/Los_Angeles', website: '',
    hours: { Mon: { open: '09:00', close: '19:00', closed: false }, Tue: { open: '09:00', close: '19:00', closed: false }, Wed: { open: '09:00', close: '19:00', closed: false }, Thu: { open: '09:00', close: '20:00', closed: false }, Fri: { open: '09:00', close: '20:00', closed: false }, Sat: { open: '10:00', close: '18:00', closed: false }, Sun: { open: '10:00', close: '16:00', closed: true } },
    closures: [],
    staff: [{ name: '', role: 'Stylist', services: [], schedule: null, lunch: { start: '13:00', end: '14:00', enabled: true } }],
    services: [{ name: '', duration: 30, price: 35, category: '', resources: [] }],
    resources: [{ name: 'Salon Chair', type: 'Salon Chair', qty: 1 }],
    usesResources: false,
    cancellationPolicy: (typeof ACCOUNT !== 'undefined' && ACCOUNT && ACCOUNT.cancellationPolicy) || '',
    logo: (typeof ACCOUNT !== 'undefined' && ACCOUNT && ACCOUNT.logo) || null,
    slug: ''
  });

  // Capture the initial form snapshot once for dirty comparison.
  if (initialDataRef.current === null) {
    initialDataRef.current = JSON.stringify(data);
  }
  const dirty = JSON.stringify(data) !== initialDataRef.current;

  // Register with NavGuard. Creation flow — the popup only offers
  // "Leave without saving" and "Keep editing". `onDiscard` is a no-op;
  // NavGuardProvider's runPending() actually executes the deferred exit.
  useDirtyGuard({
    dirty,
    onSave: () => {},
    onDiscard: () => {},
    hideSave: true,
  });

  function handleExit() {
    navGuard.request(() => onExit && onExit());
  }

  const allSteps = [
  { id: 'account', label: 'Account', icon: <I.Building size={14} /> },
  { id: 'location', label: 'Location', icon: <I.Map size={14} /> },
  { id: 'hours', label: 'Hours', icon: <I.Clock size={14} /> },
  { id: 'staff', label: 'Staff', icon: <I.Users size={14} /> },
  { id: 'resources', label: 'Resources', icon: <I.Door size={14} /> },
  { id: 'services', label: 'Services', icon: <I.Scissors size={14} /> },
  { id: 'assign', label: 'Staff assignment', icon: <I.Calendar size={14} /> },
  { id: 'cancellation', label: 'Cancellation policy', icon: <I.Mail size={14} /> },
  { id: 'link', label: 'Booking page', icon: <I.Globe size={14} /> }];

  // In new-location mode the Account step is hidden entirely.
  const steps = isNewLocation ? allSteps.filter(s => s.id !== 'account') : allSteps;

  // Map sidebar index → actual step index in the original 0–7 step body switch.
  function bodyIndex(sidebarIdx) {
    if (isNewLocation) return sidebarIdx + 1; // shift past Account (step 0)
    return sidebarIdx;
  }
  function sidebarIndex(bodyIdx) {
    if (isNewLocation) return Math.max(0, bodyIdx - 1);
    return bodyIdx;
  }


  function next() {
    const errs = validateStep(step, data);
    if (Object.keys(errs).length) {
      setErrors(errs);
      setShake(true);
      setTimeout(() => setShake(false), 400);
      // Scroll to first error
      setTimeout(() => {
        const el = document.querySelector('.field-error, .form-error-banner');
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 10);
      return;
    }
    setErrors({});
    // Last real step depends on mode (we skip Account in new-location mode).
    const lastStep = 8;
    setStep((s) => Math.min(s + 1, lastStep));
  }
  function prev() {
    setErrors({});
    const firstStep = isNewLocation ? 1 : 0;
    setStep((s) => Math.max(s - 1, firstStep));
  }
  function finish() {
    const errs = validateStep(step, data);
    if (Object.keys(errs).length) {
      setErrors(errs); setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    // Stash the new location's nickname so the wrapper page can include it
    // in the redirect query, which is then shown as a confirmation banner.
    if (isNewLocation) {
      try { window.__newLocationName = data.locationName || ''; } catch {}
    }
    // Persist the optional cancellation policy so the booking page and
    // settings see it after onboarding completes. Trim trailing whitespace
    // but otherwise preserve the user's exact line breaks.
    try { ACCOUNT.cancellationPolicy = (data.cancellationPolicy || '').replace(/\s+$/, ''); } catch {}
    // Propagate the business logo across all locations so it appears in
    // the sidebar and on the customer-facing booking page.
    try {
      if (data.logo) {
        ACCOUNT.logo = data.logo;
        BUSINESS.logo = data.logo;
        LOCATIONS.forEach((l) => { l.business.logo = data.logo; });
      }
    } catch {}
    onComplete();
  }
  // Auto-clear errors as the user edits the relevant field
  function setDataAndClear(updater) {
    setData(updater);
    if (Object.keys(errors).length) setErrors({});
  }
  const errorCount = Object.keys(errors).filter((k) => k !== '_form').length + (errors._form ? 1 : 0);

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <I.Logo size={28} />
            <div>
              <div className="font-serif text-[20px] text-ink leading-none">Receptionly</div>
              <div className="text-[11px] text-muted">{isNewLocation ? 'Add a new location' : 'Set up your business'}</div>
            </div>
          </div>
          <button onClick={handleExit} className="text-[12.5px] text-ink2 hover:text-ink">{isNewLocation ? 'Cancel →' : 'Skip & explore dashboard →'}</button>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar steps */}
          <div className="col-span-12 lg:col-span-3">
            <div className="rounded-xl2 border border-line bg-surface p-2">
              {steps.map((s, sidebarIdx) => {
                const i = bodyIndex(sidebarIdx);
                const done = i < step;
                const cur = i === step;
                // Future steps require all prior steps to be valid.
                const reachable = i <= step || canNavigateTo(i, data);
                const locked = !reachable;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (locked) {
                        // Re-run validation on the current step to surface
                        // exactly what's missing, then shake the banner.
                        const errs = validateStep(step, data);
                        if (Object.keys(errs).length) {
                          setErrors(errs);
                        } else {
                          // Current step is fine — find the first blocking step.
                          for (let k = 0; k < i; k++) {
                            const e = validateStep(k, data);
                            if (Object.keys(e).length) {
                              setStep(k);
                              setErrors(e);
                              break;
                            }
                          }
                        }
                        setShake(true);
                        setTimeout(() => setShake(false), 400);
                        return;
                      }
                      setErrors({});
                      setStep(i);
                    }}
                    className={cx('w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition', cur ? 'bg-accentSoft/60' : locked ? 'cursor-not-allowed opacity-60 hover:bg-transparent' : 'hover:bg-bg/60')}
                    title={locked ? 'Complete the required fields above first' : undefined}
                  >
                    <div className={cx('w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-medium flex-shrink-0', done ? 'bg-accent text-white' : cur ? 'bg-ink text-white' : 'bg-line text-ink2')}>
                      {done ? <I.Check size={13} stroke={2.4} /> : sidebarIdx + 1}
                    </div>
                    <span className={cx('text-[13px] flex-1 flex items-center gap-1.5', cur ? 'text-ink font-medium' : done ? 'text-ink2' : 'text-muted')}>
                      {s.label}
                      {locked && <I.Lock size={11} className="text-muted" />}
                    </span>
                  </button>);

              })}
            </div>
          </div>

          {/* Step body */}
          <div className="col-span-12 lg:col-span-9">
            <div className="rounded-xl2 border border-line bg-surface min-h-[520px] flex flex-col">
              <div className="px-7 pt-7 pb-2">
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-medium mb-1.5">Step {sidebarIndex(step) + 1} of {steps.length}</div>
                <div className="flex items-center gap-2">
                  {steps.map((s, sidebarIdx) =>
                  <div key={s.id} className={cx('h-1 flex-1 rounded-full transition', sidebarIdx <= sidebarIndex(step) ? 'bg-accent' : 'bg-line')} />
                  )}
                </div>
              </div>
              <div className="px-7 py-6 flex-1">
                {errors._form && (
                  <div className={cx('form-error-banner mb-5 rounded-lg border border-rose/30 bg-roseSoft/60 px-3.5 py-2.5 flex items-start gap-2.5', shake && 'shake')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B8556A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <div className="text-[12.5px] text-[#7A2A3D] leading-relaxed">{errors._form}</div>
                  </div>
                )}
                {step === 0 && !isNewLocation && <Step0 data={data} setData={setDataAndClear} errors={errors} />}
                {step === 1 && <Step1 data={data} setData={setDataAndClear} errors={errors} isNewLocation={isNewLocation} />}
                {step === 2 && <Step2 data={data} setData={setDataAndClear} errors={errors} />}
                {step === 3 && <Step3 data={data} setData={setDataAndClear} errors={errors} />}
                {step === 4 && <Step5 data={data} setData={setDataAndClear} errors={errors} />}
                {step === 5 && <Step4 data={data} setData={setDataAndClear} errors={errors} />}
                {step === 6 && <Step6Assign data={data} setData={setDataAndClear} errors={errors} />}
                {step === 7 && <StepCancellation data={data} setData={setDataAndClear} />}
                {step === 8 && <Step8 data={data} setData={setDataAndClear} errors={errors} isNewLocation={isNewLocation} />}
              </div>
              <div className="px-7 py-4 border-t border-line flex items-center justify-between bg-bg/40 rounded-b-xl2">
                <Button variant="ghost" onClick={prev} disabled={step === (isNewLocation ? 1 : 0)}><I.ChevronLeft size={14} /> Back</Button>
                {step < 8 ?
                <Button variant="accent" onClick={next}>Continue <I.ChevronRight size={14} /></Button> :
                <Button variant="accent" onClick={finish}><I.Sparkle size={14} /> {isNewLocation ? 'Launch location' : 'Launch Receptionly'}</Button>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>);

}

export function StepHead({ title, body }) {
  return (
    <div className="mb-5">
      <h2 className="font-serif text-[30px] text-ink leading-tight">{title}</h2>
      {body && <p className="text-[13.5px] text-ink2 mt-1.5 max-w-2xl">{body}</p>}
    </div>);

}

export function Step0({ data, setData, errors = {} }) {
  return (
    <>
      <StepHead title="Create your business account" body="Each business gets its own workspace — its own staff, services, calendar and booking page. Everything stays separate from other Receptionly accounts." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        <Field label="Business name" error={errors.bizName}><input placeholder="Avalon Salon & Spa" value={data.bizName} onChange={(e) => setData({ ...data, bizName: e.target.value })} /></Field>
        <Field label="Business type" plain>
          <select value={data.type} onChange={(e) => setData({ ...data, type: e.target.value })}>
            {['Salon', 'Barbershop', 'Spa', 'Medspa', 'Nail Salon', 'Wellness Studio', 'Other'].map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Owner / admin name" error={errors.owner}><input placeholder="Olivia Park" value={data.owner} onChange={(e) => setData({ ...data, owner: e.target.value })} /></Field>
        <Field label="Email" error={errors.email}><input type="email" placeholder="olivia@avalon.com" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} /></Field>
        <Field label="Admin phone" error={errors.phone}><input placeholder="(415) 555-0100" value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} /></Field>
        <Field label="Password" hint="8+ chars" error={errors.password}><input type="password" placeholder="••••••••" value={data.password} onChange={(e) => setData({ ...data, password: e.target.value })} /></Field>
      </div>

      <div className="mt-8 pt-6 border-t border-line max-w-3xl">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <h3 className="font-serif text-[20px] text-ink">Business logo</h3>
          <span className="text-[11.5px] text-muted">Optional · you can add it later</span>
        </div>
        <p className="text-[13px] text-ink2 mb-4">Your logo appears in the dashboard and at the top of your customer-facing booking page.</p>
        <LogoUploader
          value={data.logo}
          onChange={(d) => setData({ ...data, logo: d })}
          onRemove={() => setData({ ...data, logo: null })}
          size={96}
          placeholderLabel="Add logo"
        />
      </div>
    </>);

}

export function Step1({ data, setData, errors = {}, isNewLocation = false }) {
  return (
    <>
      <StepHead
        title={isNewLocation ? "Tell us about this new location" : "Where's your business located?"}
        body={isNewLocation
          ? "Each location has its own address, hours, staff and booking page. Give it a short nickname your team will recognize."
          : "Your address powers map listings, reminders, and the booking page header."}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        {isNewLocation && (
          <div className="md:col-span-2">
            <Field label="Location name" hint="e.g. Hayes Valley, Downtown, Westside">
              <input
                placeholder="Mission District"
                value={data.locationName || ''}
                onChange={(e) => setData({ ...data, locationName: e.target.value })}
              />
            </Field>
          </div>
        )}
        <div className="md:col-span-2"><Field label="Street address" error={errors.address}><input placeholder="418 Hayes Street" value={data.address} onChange={(e) => setData({ ...data, address: e.target.value })} /></Field></div>
        <Field label="City" error={errors.city}><input value={data.city} onChange={(e) => setData({ ...data, city: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="State" error={errors.state}><input value={data.state} onChange={(e) => setData({ ...data, state: e.target.value })} /></Field>
          <Field label="ZIP" error={errors.zip}><input value={data.zip} onChange={(e) => setData({ ...data, zip: e.target.value })} /></Field>
        </div>
        <Field label="Time zone" plain>
          <select value={data.tz} onChange={(e) => setData({ ...data, tz: e.target.value })}>
            <option>America/Los_Angeles</option><option>America/Denver</option><option>America/Chicago</option><option>America/New_York</option>
          </select>
        </Field>
        <Field label="Location phone" plain><input placeholder="(415) 555-0182" value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} /></Field>
        <div className="md:col-span-2"><Field label="Website" optional><input placeholder="avalonsalon.com" value={data.website} onChange={(e) => setData({ ...data, website: e.target.value })} /></Field></div>
      </div>
    </>);

}

export function Step2({ data, setData }) {
  function setDay(d, val) {setData({ ...data, hours: { ...data.hours, [d]: { ...data.hours[d], ...val } } });}
  return (
    <>
      <StepHead title="When are you open?" body="Set your hours of operation. The AI receptionist will never book outside these times." />
      <div className="rounded-lg border border-line divide-y divide-line max-w-2xl">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => {
          const h = data.hours[d];
          return (
            <div key={d} className="flex items-center gap-3 px-4 py-3">
              <span className="w-12 font-medium text-ink">{d}</span>
              <Toggle checked={!h.closed} onChange={(v) => setDay(d, { closed: !v })} />
              <div className="flex-1 grid grid-cols-2 gap-2 max-w-xs">
                <TimePicker value={h.open} onChange={(v) => setDay(d, { open: v })} disabled={h.closed} className={h.closed ? 'opacity-40' : ''} />
                <TimePicker value={h.close} onChange={(v) => setDay(d, { close: v })} disabled={h.closed} className={h.closed ? 'opacity-40' : ''} />
              </div>
              <span className="ml-auto text-[12px] text-muted w-20 text-right">{h.closed ? 'Closed' : ''}</span>
            </div>);

        })}
      </div>
      <ClosuresSection data={data} setData={setData} />
    </>);

}

export function Step3({ data, setData, errors = {} }) {
  function addStaff() {setData({ ...data, staff: [...data.staff, { name: '', role: 'Stylist', services: [], schedule: null, lunch: { start: '13:00', end: '14:00', enabled: true } }] });}
  function update(i, k, v) {const a = [...data.staff];a[i] = { ...a[i], [k]: v };setData({ ...data, staff: a });}
  function remove(i) {const a = [...data.staff];a.splice(i, 1);setData({ ...data, staff: a });}
  const roles = ['Stylist', 'Barber', 'Colorist', 'Esthetician', 'Massage Therapist', 'Nail Tech', 'Other'];
  return (
    <>
      <StepHead title="Add your team" body="You can fully customize each staff member's hours, services and break times later." />
      <div className="space-y-2 max-w-3xl">
        {data.staff.map((s, i) =>
        <div key={i} className={cx('rounded-lg border p-3 flex items-center gap-3', errors['staff_' + i] ? 'border-rose/40 bg-roseSoft/20' : 'border-line')}>
            <div className="w-9 h-9 rounded-full bg-accentSoft text-accentInk flex items-center justify-center"><I.Users size={16} /></div>
            <input className={cx('!flex-1', errors['staff_' + i] && 'is-error')} placeholder="Staff name" value={s.name} onChange={(e) => update(i, 'name', e.target.value)} />
            <select value={s.role} onChange={(e) => update(i, 'role', e.target.value)} className="!w-44">
              {roles.map((r) => <option key={r}>{r}</option>)}
            </select>
            <button onClick={() => remove(i)} className="text-muted hover:text-rose p-1.5" disabled={data.staff.length <= 1}><I.Trash size={14} /></button>
          </div>
        )}
        <Button variant="secondary" size="sm" onClick={addStaff}><I.Plus size={14} /> Add staff member</Button>
      </div>
    </>);

}

export function Step4({ data, setData, errors = {} }) {
  function add() {setData({ ...data, services: [...data.services, { name: '', duration: 30, price: 35, category: '', resources: [] }] });}
  function update(i, k, v) {const a = [...data.services];a[i] = { ...a[i], [k]: v };setData({ ...data, services: a });}
  function toggleResource(i, name) {
    const a = [...data.services];
    const cur = a[i].resources || [];
    a[i] = { ...a[i], resources: cur.includes(name) ? cur.filter((r) => r !== name) : [...cur, name] };
    setData({ ...data, services: a });
  }
  function remove(i) {const a = [...data.services];a.splice(i, 1);setData({ ...data, services: a });}
  const cats = ['Haircuts', 'Hair Color', 'Barbering', 'Facials', 'Massage', 'Nails', 'Waxing', 'Add-ons'];
  const availableResources = data.usesResources ? (data.resources || []).filter((r) => r.name && r.name.trim()) : [];
  const showResourcesPicker = data.usesResources && availableResources.length > 0;
  return (
    <>
      <StepHead title="Your service menu" body="Add the services you offer. The AI receptionist uses this menu when answering questions and booking calls." />
      <div className="space-y-2.5 max-w-4xl">
        <div className="grid grid-cols-12 gap-2 px-2 text-[11px] uppercase tracking-wider text-muted font-medium">
          <div className="col-span-4">Service</div>
          <div className="col-span-3">Category</div>
          <div className="col-span-2">Duration</div>
          <div className="col-span-2">Price</div>
          <div className="col-span-1"></div>
        </div>
        {data.services.map((s, i) => {
          const hasErr = errors['svc_name_' + i] || errors['svc_cat_' + i] || errors['svc_dur_' + i];
          const selectedResources = s.resources || [];
          return (
            <div key={i} className={cx('rounded-lg border overflow-hidden', hasErr ? 'border-rose/40 bg-roseSoft/20' : 'border-line bg-white')}>
              <div className="grid grid-cols-12 gap-2 p-2 items-center">
                <input className={cx('col-span-4 !h-9', errors['svc_name_' + i] && 'is-error')} placeholder="Men's Haircut" value={s.name} onChange={(e) => update(i, 'name', e.target.value)} />
                <div className="col-span-3">
                  <select
                    className={cx('!h-9', !s.category && 'text-muted', errors['svc_cat_' + i] && 'is-error')}
                    value={s.category}
                    onChange={(e) => update(i, 'category', e.target.value)}
                    required
                  >
                    <option value="" disabled>Choose category…</option>
                    {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="col-span-2 relative">
                  <input className="!h-9" type="number" value={s.duration} onChange={(e) => update(i, 'duration', +e.target.value)} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted">min</span>
                </div>
                <div className="col-span-2 relative">
                  <input className="!h-9 !pl-6" type="number" value={s.price} onChange={(e) => update(i, 'price', +e.target.value)} />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-muted">$</span>
                </div>
                <button onClick={() => remove(i)} className="col-span-1 text-muted hover:text-rose p-1.5 justify-self-center" disabled={data.services.length <= 1}><I.Trash size={14} /></button>
              </div>

              {showResourcesPicker && (
                <div className="border-t border-line/70 bg-bg/30 px-3 py-2.5">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <div className="text-[11.5px] font-medium text-ink">
                      Resources required <span className="text-muted font-normal">(optional)</span>
                    </div>
                    <div className="text-[11px] text-muted">
                      {selectedResources.length === 0
                        ? 'None — any chair/room'
                        : `${selectedResources.length} selected`}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableResources.map((r) => {
                      const checked = selectedResources.includes(r.name);
                      return (
                        <button
                          key={r.name}
                          type="button"
                          onClick={() => toggleResource(i, r.name)}
                          className={cx(
                            'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11.5px] font-medium transition',
                            checked
                              ? 'border-accent bg-accent text-white'
                              : 'border-line2 bg-white text-ink2 hover:border-ink2/40 hover:text-ink'
                          )}
                          title={r.customType || r.type}
                        >
                          <span className={cx('w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center flex-shrink-0', checked ? 'bg-white/20 border-white/40' : 'bg-white border-line2')}>
                            {checked && <I.Check size={9} stroke={3} />}
                          </span>
                          {r.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <Button variant="secondary" size="sm" onClick={add}><I.Plus size={14} /> Add service</Button>
        {data.usesResources && availableResources.length === 0 && (
          <p className="text-[11.5px] text-muted mt-1">Add resources in the previous step to assign them to services.</p>
        )}
      </div>
    </>);

}

export function Step5({ data, setData, errors = {} }) {
  function add() {setData({ ...data, resources: [...data.resources, { name: '', type: 'Salon Chair', qty: 1 }] });}
  function update(i, k, v) {const a = [...data.resources];a[i] = { ...a[i], [k]: v };setData({ ...data, resources: a });}
  function remove(i) {const a = [...data.resources];a.splice(i, 1);setData({ ...data, resources: a });}
  const types = ['Barber Chair', 'Salon Chair', 'Color Station', 'Treatment Room', 'Massage Room', 'Nail Station'];
  const enabled = data.usesResources;
  return (
    <>
      <StepHead title="Add resources" body="Chairs, rooms or stations that services need. Optional, but important for spas, salons and nail bars to avoid double-booking rooms." />

      <div className="max-w-3xl mb-4 rounded-xl2 border border-line bg-surface p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-accentSoft text-accentInk flex items-center justify-center flex-shrink-0"><I.Door size={16} /></div>
          <div className="flex-1 min-w-0 pr-4">
            <div className="text-[13.5px] font-medium text-ink">Do you use rooms, chairs, stations or equipment that need to be scheduled?</div>
            <div className="text-[12px] text-muted mt-0.5">Turn this off if every staff member works independently and there's no shared space or gear to manage.</div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={cx('text-[12px] font-medium', enabled ? 'text-ink' : 'text-muted')}>{enabled ? 'Yes' : 'No'}</span>
            <Toggle checked={enabled} onChange={(v) => setData({ ...data, usesResources: v })} />
          </div>
        </div>
      </div>

      {enabled ? (
        <div className="space-y-2 max-w-3xl">
          <div className="grid grid-cols-12 gap-2 px-2 text-[11px] uppercase tracking-wider text-muted font-medium">
            <div className="col-span-5">Resource</div>
            <div className="col-span-4">Type</div>
            <div className="col-span-2">Quantity</div>
            <div className="col-span-1"></div>
          </div>
          {data.resources.map((r, i) =>
          <div key={i} className={cx('grid grid-cols-12 gap-2 rounded-lg border p-2 items-center', errors['res_name_' + i] ? 'border-rose/40 bg-roseSoft/20' : 'border-line')}>
              <div className="col-span-5 flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-accentSoft text-accentInk flex items-center justify-center flex-shrink-0"><I.Door size={16} /></div>
                <input className={cx('!h-9 min-w-0 flex-1', errors['res_name_' + i] && 'is-error')} placeholder="Resource name" value={r.name} onChange={(e) => update(i, 'name', e.target.value)} />
              </div>
              <div className="col-span-4">
              {r.type === 'Other' ? (
                <div className="relative">
                  <input
                    className="!h-9 !pr-7"
                    placeholder="Custom type"
                    value={r.customType || ''}
                    onChange={(e) => update(i, 'customType', e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => { update(i, 'type', 'Salon Chair'); update(i, 'customType', ''); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1"
                    title="Use preset type"
                  ><I.X size={12} /></button>
                </div>
              ) : (
                <select className="!h-9" value={r.type} onChange={(e) => update(i, 'type', e.target.value)}>
                  {types.map((t) => <option key={t}>{t}</option>)}
                  <option value="Other">Other</option>
                </select>
              )}
              </div>
              <div className="col-span-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => update(i, 'qty', Math.max(1, (Number(r.qty) || 1) - 1))}
                  className="w-8 h-9 rounded-md border border-line text-ink2 hover:bg-bg hover:text-ink flex items-center justify-center flex-shrink-0"
                  aria-label="Decrease quantity"
                  title="Decrease"
                ><I.Minus size={12} /></button>
                <input
                  type="number"
                  min={1}
                  className="!h-9 !px-0 text-center min-w-0 flex-1"
                  value={r.qty ?? 1}
                  onChange={(e) => update(i, 'qty', Math.max(1, parseInt(e.target.value || '1', 10) || 1))}
                />
                <button
                  type="button"
                  onClick={() => update(i, 'qty', (Number(r.qty) || 1) + 1)}
                  className="w-8 h-9 rounded-md border border-line text-ink2 hover:bg-bg hover:text-ink flex items-center justify-center flex-shrink-0"
                  aria-label="Increase quantity"
                  title="Increase"
                ><I.Plus size={12} /></button>
              </div>
              <button onClick={() => remove(i)} className="col-span-1 text-muted hover:text-rose p-1.5 justify-self-center"><I.Trash size={14} /></button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={add}><I.Plus size={14} /> Add resource</Button>
            <span className="text-[12px] text-muted">You can skip this for now and add resources later.</span>
          </div>
        </div>
      ) : (
        <div className="max-w-3xl rounded-xl2 border border-dashed border-line2 bg-bg/40 px-5 py-8 text-center">
          <div className="font-serif text-[20px] text-ink mb-1">Resources skipped</div>
          <div className="text-[13px] text-ink2 max-w-md mx-auto">Bookings will only be checked against staff availability. You can add chairs, rooms or equipment later from Settings.</div>
        </div>
      )}
    </>);

}

// ─────────────────────────────────────────────────────────────────────
// Step 6 — Staff Assignment
// Configure per-staff working hours, lunch break, days off, and the
// services each person performs. No booking buffer / no calendar color.
// ─────────────────────────────────────────────────────────────────────
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function defaultScheduleFromHours(hours) {
  const out = {};
  DAYS.forEach((d) => {
    const h = (hours && hours[d]) || { open: '09:00', close: '17:00', closed: false };
    out[d] = { off: !!h.closed, open: h.open || '09:00', close: h.close || '17:00' };
  });
  return out;
}

export function Step6Assign({ data, setData, errors = {} }) {
  const namedStaff = (data.staff || []).map((s, i) => ({ s, i })).filter(({ s }) => s.name && s.name.trim());
  const [activeIdx, setActiveIdx] = useState(namedStaff.length ? namedStaff[0].i : 0);

  // Lazily hydrate schedule for whichever staff is being viewed.
  useEffect(() => {
    let changed = false;
    const next = data.staff.map((s) => {
      if (!s.name || !s.name.trim()) return s;
      if (s.schedule) return s;
      changed = true;
      return {
        ...s,
        schedule: defaultScheduleFromHours(data.hours),
        services: s.services || [],
        lunch: s.lunch || { start: '13:00', end: '14:00', enabled: true },
      };
    });
    if (changed) setData({ ...data, staff: next });
  }, []); // eslint-disable-line

  if (namedStaff.length === 0) {
    return (
      <>
        <StepHead title="Staff assignment" body="Configure each staff member's working hours, lunch break, days off, and the services they perform." />
        <div className="max-w-3xl rounded-xl2 border border-dashed border-line2 bg-bg/40 px-5 py-10 text-center">
          <div className="font-serif text-[20px] text-ink mb-1">No staff added yet</div>
          <div className="text-[13px] text-ink2 max-w-md mx-auto">Go back to the Staff step and add at least one team member to assign hours and services.</div>
        </div>
      </>
    );
  }

  const active = data.staff[activeIdx];
  const schedule = active.schedule || defaultScheduleFromHours(data.hours);
  const lunch = active.lunch || { start: '13:00', end: '14:00', enabled: true };
  const services = active.services || [];
  const namedServices = (data.services || []).filter((s) => s && s.name && s.name.trim());

  function patchStaff(patch) {
    const next = [...data.staff];
    next[activeIdx] = { ...next[activeIdx], ...patch };
    setData({ ...data, staff: next });
  }
  function setDay(d, val) {
    patchStaff({ schedule: { ...schedule, [d]: { ...schedule[d], ...val } } });
  }
  function toggleService(name) {
    const has = services.includes(name);
    patchStaff({ services: has ? services.filter((s) => s !== name) : [...services, name] });
  }
  function applyToAll(field) {
    // Copy current staff's schedule / lunch / services to every other named staff.
    const next = data.staff.map((s, i) => {
      if (i === activeIdx) return s;
      if (!s.name || !s.name.trim()) return s;
      if (field === 'schedule') return { ...s, schedule: { ...schedule } };
      if (field === 'lunch') return { ...s, lunch: { ...lunch } };
      if (field === 'services') return { ...s, services: [...services] };
      return s;
    });
    setData({ ...data, staff: next });
  }

  const activeErr = errors['sa_sched_' + activeIdx];

  return (
    <>
      <StepHead title="Staff assignment" body="Set each staff member's working hours, lunch break, days off, and the services they perform." />

      <div className="grid grid-cols-12 gap-5 max-w-5xl">
        {/* Staff picker */}
        <div className="col-span-12 md:col-span-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-medium mb-2">Team</div>
          <div className="rounded-xl2 border border-line bg-surface overflow-hidden divide-y divide-line">
            {namedStaff.map(({ s, i }) => {
              const cur = i === activeIdx;
              const err = errors['sa_sched_' + i];
              const initials = s.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
              const sched = s.schedule || defaultScheduleFromHours(data.hours);
              const workingDays = DAYS.filter((d) => sched[d] && !sched[d].off).length;
              return (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className={cx('w-full flex items-center gap-3 px-3 py-2.5 text-left transition', cur ? 'bg-accentSoft/50' : 'hover:bg-bg/60')}
                >
                  <div className={cx('w-8 h-8 rounded-full flex items-center justify-center text-[11.5px] font-semibold flex-shrink-0', cur ? 'bg-accent text-white' : 'bg-line text-ink2')}>
                    {initials || <I.Users size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cx('text-[13px] truncate', cur ? 'text-ink font-medium' : 'text-ink2')}>{s.name}</div>
                    <div className="text-[11px] text-muted truncate">{s.role} · {workingDays} day{workingDays === 1 ? '' : 's'}/wk · {(s.services || []).length} service{(s.services || []).length === 1 ? '' : 's'}</div>
                  </div>
                  {err && <span className="w-1.5 h-1.5 rounded-full bg-rose flex-shrink-0" title={err} />}
                </button>
              );
            })}
          </div>
          <p className="text-[11.5px] text-muted mt-2.5 leading-relaxed">Defaults inherit from your business hours. Tweak each person as needed — you can always come back later.</p>
        </div>

        {/* Editor */}
        <div className="col-span-12 md:col-span-8">
          <div className="rounded-xl2 border border-line bg-surface overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-line flex items-center gap-3 bg-bg/30">
              <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center font-semibold text-[13px] flex-shrink-0">
                {(active.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-serif text-[18px] text-ink leading-tight truncate">{active.name}</div>
                <div className="text-[12px] text-muted">{active.role}</div>
              </div>
            </div>

            {activeErr && (
              <div className="px-5 pt-3">
                <div className="rounded-lg border border-rose/30 bg-roseSoft/60 px-3 py-2 text-[12px] text-[#7A2A3D]">{activeErr}</div>
              </div>
            )}

            {/* Weekly schedule */}
            <div className="px-5 py-4 border-b border-line">
              <div className="flex items-center justify-between mb-2.5">
                <div className="text-[12.5px] font-medium text-ink">Weekly schedule</div>
                <button onClick={() => applyToAll('schedule')} className="text-[11.5px] text-accent hover:underline">Apply to all staff</button>
              </div>
              <div className="rounded-lg border border-line divide-y divide-line">
                {DAYS.map((d) => {
                  const h = schedule[d] || { off: false, open: '09:00', close: '17:00' };
                  return (
                    <div key={d} className="flex items-center gap-3 px-3 py-2.5">
                      <Toggle checked={!h.off} onChange={(v) => setDay(d, { off: !v })} />
                      <span className="w-10 text-[13px] font-medium text-ink">{d}</span>
                      {h.off ? (
                        <span className="text-[12px] text-muted italic flex-1">Day off</span>
                      ) : (
                        <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 max-w-md">
                          <TimePicker size="sm" value={h.open} onChange={(v) => setDay(d, { open: v })} />
                          <span className="text-muted">–</span>
                          <TimePicker size="sm" value={h.close} onChange={(v) => setDay(d, { close: v })} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lunch break */}
            <div className="px-5 py-4 border-b border-line">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="text-[12.5px] font-medium text-ink">Lunch break</div>
                  <Toggle checked={lunch.enabled !== false} onChange={(v) => patchStaff({ lunch: { ...lunch, enabled: v } })} />
                </div>
                <button onClick={() => applyToAll('lunch')} className="text-[11.5px] text-accent hover:underline">Apply to all staff</button>
              </div>
              {lunch.enabled === false ? (
                <div className="text-[12px] text-muted italic">No lunch break — bookings allowed throughout the working day.</div>
              ) : (
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 max-w-md">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-1">Start</div>
                    <TimePicker size="sm" value={lunch.start} onChange={(v) => patchStaff({ lunch: { ...lunch, start: v } })} />
                  </div>
                  <span className="text-muted mt-5">–</span>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-1">End</div>
                    <TimePicker size="sm" value={lunch.end} onChange={(v) => patchStaff({ lunch: { ...lunch, end: v } })} />
                  </div>
                </div>
              )}
            </div>

            {/* Services performed */}
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="text-[12.5px] font-medium text-ink">Services performed <span className="text-muted font-normal">({services.length}/{namedServices.length})</span></div>
                <div className="flex items-center gap-3">
                  {namedServices.length > 0 && (
                    <button
                      onClick={() => patchStaff({ services: services.length === namedServices.length ? [] : namedServices.map((s) => s.name) })}
                      className="text-[11.5px] text-accent hover:underline"
                    >
                      {services.length === namedServices.length ? 'Clear all' : 'Select all'}
                    </button>
                  )}
                  <button onClick={() => applyToAll('services')} className="text-[11.5px] text-accent hover:underline">Apply to all staff</button>
                </div>
              </div>
              {namedServices.length === 0 ? (
                <div className="rounded-lg border border-dashed border-line2 bg-bg/40 px-4 py-5 text-center text-[12.5px] text-ink2">
                  No services yet — add some in the Services step to assign them here.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {namedServices.map((svc, i) => {
                    const checked = services.includes(svc.name);
                    return (
                      <label
                        key={i}
                        className={cx(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition',
                          checked ? 'border-accent bg-accentSoft/40' : 'border-line bg-white hover:border-ink2/30'
                        )}
                      >
                        <span className={cx('w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition', checked ? 'bg-accent border-accent text-white' : 'border-line2 bg-white')}>
                          {checked && <I.Check size={10} stroke={3} />}
                        </span>
                        <span className="text-[12.5px] text-ink truncate flex-1">{svc.name}</span>
                        <span className="text-[11px] text-muted whitespace-nowrap">{svc.duration} min</span>
                        <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleService(svc.name)} />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function Step7({ data, setData, errors = {} }) {
  // Notifications step removed.
  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Cancellation Policy — optional. Free-form text that applies to the
// whole business (every location). Customers see it on the booking
// page's "Your details" step right before they confirm.
// ─────────────────────────────────────────────────────────────────────
export function StepCancellation({ data, setData }) {
  const value = data.cancellationPolicy || '';
  const charCount = value.length;
  const sampleClicked = () => {
    if (value.trim()) return;
    setData({
      ...data,
      cancellationPolicy:
        "We kindly ask for at least 24 hours' notice to cancel or reschedule. " +
        "No-shows and cancellations within 24 hours may be charged 50% of the service price.",
    });
  };
  return (
    <>
      <StepHead
        title="Cancellation policy"
        body="Optional. Set expectations for customers when they book online — they'll see this right before they confirm an appointment. Applies to your whole business."
      />
      <div className="max-w-3xl">
        <Field
          label="Policy text"
          optional
          hint="Plain text only. Leave blank to skip — you can add one later from Settings."
        >
          <textarea
            rows={6}
            value={value}
            maxLength={1200}
            onChange={(e) => setData({ ...data, cancellationPolicy: e.target.value })}
            placeholder="e.g. Please give us 24 hours' notice if you need to cancel or reschedule. Late cancellations and no-shows may be charged 50% of the service price."
            style={{ minHeight: 140, lineHeight: 1.55 }}
          />
        </Field>
        <div className="flex items-center justify-between mt-1">
          <button
            type="button"
            onClick={sampleClicked}
            disabled={!!value.trim()}
            className={cx(
              'text-[11.5px] underline-offset-2',
              value.trim() ? 'text-muted/60 cursor-not-allowed' : 'text-accent hover:underline'
            )}
          >
            Use a sample policy
          </button>
          <span className="text-[11.5px] text-muted tabular-nums">{charCount} / 1200</span>
        </div>

        <div className="mt-6 rounded-xl2 border border-line bg-bg/40 p-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-medium mb-2">Customer preview</div>
          {value.trim() ? (
            <div className="rounded-lg border border-line bg-surface px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-1">Cancellation policy</div>
              <p className="text-[12px] text-ink2 leading-relaxed whitespace-pre-line">{value.trim()}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-line2 bg-surface/60 px-4 py-5 text-center">
              <div className="text-[12.5px] text-ink2 font-medium">No policy yet</div>
              <div className="text-[11.5px] text-muted mt-0.5">Nothing will appear on the booking page until you add some text.</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function Step8({ data, setData, errors = {}, isNewLocation = false }) {
  // For new locations, derive the slug from the location nickname so each
  // location gets a distinct booking URL — the business name slug would
  // collide with the existing primary location's URL.
  const sourceName = isNewLocation
    ? (data.locationName || data.bizName || 'new-location')
    : (data.bizName || 'your-business');
  const baseBiz = isNewLocation
    ? (LOCATIONS[0]?.business?.name || 'your-business')
        .toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'your-business'
    : null;
  const nameSlug = sourceName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'new-location';
  const slug = isNewLocation ? `${baseBiz}-${nameSlug}` : nameSlug;
  const bookingUrl = 'receptionly.com/book/' + slug;
  return (
    <>
      <StepHead
        title={isNewLocation ? `Your new location's booking page` : 'Your online booking page'}
        body={isNewLocation
          ? `${data.locationName ? `"${data.locationName}"` : 'This location'} will appear as an option in the booking flow — customers pick a location, then services, staff, date and time. You can share this direct link too.`
          : 'Customers can book themselves at this link. Share it on Instagram, Google, or your website.'}
      />
      {isNewLocation && (
        <div className="mb-5 max-w-3xl rounded-lg border border-accent/30 bg-accentSoft/40 px-4 py-3 flex items-start gap-3">
          <div className="w-7 h-7 rounded-md bg-accent text-white flex items-center justify-center flex-shrink-0 mt-0.5">
            <I.Map size={14}/>
          </div>
          <div className="text-[12.5px] text-accentInk leading-relaxed">
            <span className="font-medium">Appears in the public booking flow.</span> Customers visiting <span className="font-mono">{LOCATIONS[0]?.business?.bookingLink || 'your booking page'}</span> will see <span className="font-medium">{data.locationName || 'this location'}</span> as a choice alongside your existing locations.
          </div>
        </div>
      )}
      <div className="block max-w-xl">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[12.5px] font-medium text-ink">{isNewLocation ? "This location's direct booking URL" : 'Your booking URL'} <span className="text-muted font-normal">(auto-generated)</span></span>
          <span className="text-[11.5px] text-muted">Based on {isNewLocation ? 'location name' : 'your business name'}</span>
        </div>
        <div className="flex items-stretch gap-2">
          <div className="flex-1 flex items-stretch rounded-lg border border-line2 bg-bg/40 overflow-hidden">
            <span className="px-3 inline-flex items-center text-[13px] text-muted bg-bg border-r border-line">receptionly.com/book/</span>
            <span className="flex-1 inline-flex items-center px-3 text-[13px] font-mono text-ink truncate">{slug}</span>
          </div>
          <CopyButton variant="secondary" value={bookingUrl} />
        </div>
        <div className="mt-1.5 text-[11.5px] text-muted">You can change this anytime in Settings after launch.</div>
      </div>
      <div className="mt-6 max-w-3xl">
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-medium">{isNewLocation ? 'Location selector preview' : 'Booking page preview'}</div>
          <div className="text-[11.5px] text-muted">{isNewLocation ? 'How customers will see and pick this location' : 'What your customers will see'}</div>
        </div>
        {isNewLocation ? <LocationSelectorPreview data={data} /> : <BookingPagePreview data={data} />}
      </div>
    </>);

}

// Mini preview of the public booking flow's first step — shows this new
// location slotted in alongside any existing ones.
export function LocationSelectorPreview({ data }) {
  const stepLabels = ['Location', 'Services', 'Staff', 'Date', 'Time', 'Confirm'];
  const bizName = LOCATIONS[0]?.business?.name || data.bizName || 'Your business';
  const monogram = (LOCATIONS[0]?.business?.logoMonogram) || (bizName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'YB');
  const logo = data.logo || LOCATIONS[0]?.business?.logo || null;
  const newLoc = {
    name: data.locationName || 'New location',
    address: data.address || 'Street address',
    city: data.city || 'City',
    state: data.state || 'ST',
  };
  return (
    <div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-card">
      <div className="px-5 pt-5 pb-4 border-b border-line bg-gradient-to-b from-bg/40 to-transparent">
        <div className="flex items-center gap-3">
          <BusinessMark logo={logo} monogram={monogram} size={40} rounded="full" />
          <div className="min-w-0">
            <div className="font-serif text-[20px] text-ink leading-none truncate">{bizName}</div>
            <div className="text-[12px] text-muted truncate">Choose a location to start booking</div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5">
          {stepLabels.map((s, i) => (
            <div key={s} className={cx('flex-1 h-1 rounded-full', i === 0 ? 'bg-accent' : 'bg-line')} />
          ))}
        </div>
        <div className="mt-1.5 text-[11px] text-muted">Step 1 of {stepLabels.length} — <span className="text-ink font-medium">{stepLabels[0]}</span></div>
      </div>
      <div className="p-5">
        <div className="font-serif text-[20px] text-ink leading-tight mb-1">Choose your location</div>
        <p className="text-[12px] text-ink2 mb-3">We have {LOCATIONS.length + 1} locations. Pick the one closest to you.</p>
        <div className="space-y-2">
          {LOCATIONS.map((loc) => (
            <div key={loc.id} className="flex items-start gap-3 p-3 rounded-lg border border-line bg-white">
              <div className="w-8 h-8 rounded-full bg-bg text-ink2 flex items-center justify-center flex-shrink-0 mt-0.5"><I.Map size={14} /></div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-ink truncate">{loc.name}</div>
                <div className="text-[11.5px] text-muted truncate">{loc.business.address} · {loc.business.city}, {loc.business.state}</div>
              </div>
              <span className="w-4 h-4 rounded-full border border-line2 mt-1 flex-shrink-0" />
            </div>
          ))}
          {/* The new one, highlighted */}
          <div className="flex items-start gap-3 p-3 rounded-lg border border-accent bg-accentSoft/60">
            <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center flex-shrink-0 mt-0.5"><I.Map size={14} /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-[13px] font-medium text-ink truncate">{newLoc.name}</div>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-white border border-accent/30 text-accentInk">New</span>
              </div>
              <div className="text-[11.5px] text-muted truncate">{newLoc.address} · {newLoc.city}, {newLoc.state}</div>
            </div>
            <span className="w-4 h-4 rounded-full bg-accent border border-accent mt-1 flex-shrink-0 flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-white" /></span>
          </div>
        </div>
      </div>
      <div className="px-5 py-3 border-t border-line bg-white flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[12px] text-muted/70"><I.ChevronLeft size={12} /> Back</span>
        <span className="text-[10.5px] text-muted hidden sm:inline">Powered by Receptionly</span>
        <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-accent text-white text-[11.5px] font-medium">Continue <I.ChevronRight size={12} /></span>
      </div>
    </div>
  );
}

// Static, non-interactive preview that mirrors the real /book/ page.
export function BookingPagePreview({ data }) {
  const bizName = data.bizName || 'Your business';
  const monogram = bizName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'YB';
  const logo = data.logo || null;
  const addrLine = [data.address, [data.city, data.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'Your address';

  const namedServices = (data.services || []).filter((s) => s && s.name && s.name.trim());
  // Group by category, then pick one category to "show" — use the first non-empty.
  const cats = [];
  for (const s of namedServices) {
    const cat = s.category || 'Uncategorized';
    if (!cats.find((c) => c.name === cat)) cats.push({ name: cat, services: [] });
    cats.find((c) => c.name === cat).services.push(s);
  }
  // If no services yet, show a fallback hint.
  const activeCat = cats[0];
  const stepLabels = ['Services', 'Staff', 'Date', 'Time', 'Your info', 'Confirm'];

  return (
    <div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-card">
      {/* Hero */}
      <div className="px-5 pt-5 pb-4 border-b border-line bg-gradient-to-b from-bg/40 to-transparent">
        <div className="flex items-center gap-3">
          <BusinessMark logo={logo} monogram={monogram} size={40} rounded="full" />
          <div className="min-w-0">
            <div className="font-serif text-[20px] text-ink leading-none truncate">{bizName}</div>
            <div className="text-[12px] text-muted truncate">{addrLine}</div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5">
          {stepLabels.map((s, i) => (
            <div key={s} className={cx('flex-1 h-1 rounded-full', i === 0 ? 'bg-accent' : 'bg-line')} />
          ))}
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted">
          <span>Step 1 of 6 — <span className="text-ink font-medium">{stepLabels[0]}</span></span>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_220px]">
        <div className="p-5">
          <div className="font-serif text-[20px] text-ink leading-tight mb-1">Choose your service</div>
          <p className="text-[12px] text-ink2 mb-3">Add one or more. We'll bundle them into a single appointment.</p>

          {cats.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line2 bg-bg/40 p-5 text-center">
              <div className="text-[12.5px] text-ink2 font-medium">Your service menu will show here.</div>
              <div className="text-[11.5px] text-muted mt-0.5">Add services in the Services step to populate this list.</div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {cats.slice(0, 5).map((c, i) => (
                  <span key={c.name} className={cx('h-7 px-2.5 inline-flex items-center rounded-full text-[11.5px] font-medium border', i === 0 ? 'bg-ink text-white border-ink' : 'bg-white border-line2 text-ink2')}>
                    {c.name}
                  </span>
                ))}
              </div>
              <div className="space-y-1.5">
                {activeCat.services.slice(0, 3).map((s, i) => (
                  <div key={i} className={cx('flex items-start gap-2.5 p-2.5 rounded-lg border', i === 0 ? 'border-accent bg-accentSoft/50' : 'border-line bg-white')}>
                    <div className={cx('mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0', i === 0 ? 'bg-accent border-accent text-white' : 'border-line2 bg-white')}>
                      {i === 0 && <I.Check size={10} stroke={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[12.5px] font-medium text-ink truncate">{s.name}</span>
                        <span className="text-[11px] text-muted whitespace-nowrap">{s.duration} min</span>
                      </div>
                    </div>
                    <div className="text-[12.5px] font-medium text-ink">${s.price}</div>
                  </div>
                ))}
                {activeCat.services.length > 3 && (
                  <div className="text-[11px] text-muted pl-2 pt-0.5">+ {activeCat.services.length - 3} more in {activeCat.name}</div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Aside */}
        <aside className="border-t md:border-t-0 md:border-l border-line bg-bg/40 p-5">
          <div className="text-[10.5px] uppercase tracking-wider text-muted font-medium mb-2">Your booking</div>
          {activeCat && activeCat.services[0] ? (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[12.5px] font-medium text-ink leading-tight">{activeCat.services[0].name}</div>
                  <div className="text-[11px] text-muted">{activeCat.services[0].duration} min</div>
                </div>
                <div className="text-[12.5px] font-medium text-ink">${activeCat.services[0].price}</div>
              </div>
              <div className="pt-2 mt-2 border-t border-line flex items-center justify-between text-[11.5px]">
                <span className="text-ink2">Total</span>
                <span className="font-medium text-ink">{activeCat.services[0].duration} min · ${activeCat.services[0].price}</span>
              </div>
            </div>
          ) : (
            <div className="text-[11.5px] text-muted">Selections appear here.</div>
          )}
        </aside>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-line bg-white flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[12px] text-muted/70">
          <I.ChevronLeft size={12} /> Back
        </span>
        <span className="text-[10.5px] text-muted hidden sm:inline">Powered by Receptionly</span>
        <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-accent text-white text-[11.5px] font-medium">
          Continue <I.ChevronRight size={12} />
        </span>
      </div>
    </div>);

}

export function Step9({ data }) {
  return null;
}

window.Onboarding = Onboarding;