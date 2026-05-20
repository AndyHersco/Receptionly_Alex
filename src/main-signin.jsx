import './styles/signin.css';
import { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';

/* ---------- phone helpers ---------- */
// Phone numbers across Receptionly use the canonical (XXX) XXX-XXXX form.
// We strip non-digits as the user types and re-format, so letters and stray
// punctuation can't land in the field at all.
function formatPhoneInput(value) {
  const digits = (value || '').replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length < 4) return '(' + digits;
  if (digits.length < 7) return '(' + digits.slice(0, 3) + ') ' + digits.slice(3);
  return '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6);
}
function isPhoneComplete(value) {
  return (value || '').replace(/\D/g, '').length === 10;
}

/* ---------- Button — mirrors the canonical Button from src/ui.jsx so the
   sign-in / register pages share the same primary, secondary, ghost, and
   danger affordances as the rest of the app. ---------- */
function cx(...args) { return args.filter(Boolean).join(' '); }
function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition leading-none whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'h-8 px-3 text-[13px]', md: 'h-9 px-3.5 text-[13.5px]', lg: 'h-10 px-4 text-[14px]', xl: 'h-11 px-4 text-[14px]' };
  const variants = {
    primary:   'bg-ink text-white hover:bg-[#2a2722] active:bg-[#0f0e0c]',
    accent:    'bg-accent text-white hover:bg-[#36513a] active:bg-[#2A3F2D]',
    secondary: 'bg-white text-ink border border-line2 hover:bg-bg hover:border-ink2/40',
    ghost:     'text-ink2 hover:text-ink hover:bg-line/60',
    danger:    'bg-rose text-white hover:bg-[#a04457] active:bg-[#8a3a4a]',
  };
  return <button className={cx(base, sizes[size], variants[variant], className)} {...props}>{children}</button>;
}

/* ---------- mock directory ---------- */
const BUSINESSES = [
  { id: 'biz_avalon',   name: 'Avalon Salon & Spa',     city: 'San Francisco, CA',
    employees: ['Mike Rodriguez','Sarah Kim','Amanda Lee','Jessica Martinez','David Chen','Priya Shah'] },
  { id: 'biz_lumen',    name: 'Lumen Hair Studio',      city: 'Oakland, CA',
    employees: ['Alex Tran','Bea Okafor','Cameron Reyes','Dani Park'] },
  { id: 'biz_north',    name: 'Northside Barber Co.',   city: 'Brooklyn, NY',
    employees: ['Marcus Hill','Tomás Vega','Ryan Walsh','Jordan Lee'] },
  { id: 'biz_olivebay', name: 'Olive Bay Wellness',     city: 'Austin, TX',
    employees: ['Hana Suzuki','Noor Rahman','Iris Bloom','Theo Adams'] },
  { id: 'biz_thistle',  name: 'Thistle & Thread',       city: 'Portland, OR',
    employees: ['Wren Carter','Sage Mendez','Quinn Foster'] },
  { id: 'biz_clover',   name: 'Clover Skin Atelier',    city: 'Chicago, IL',
    employees: ['Avery Cohen','Maya Patel','Liam Brooks','Zoe Halverson','Eli Nakamura'] },
];

/* ---------- icons ---------- */
const I = {
  eye:  (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff:(p)=> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 3l18 18"/><path d="M10.6 6.2A10.9 10.9 0 0 1 12 6c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1"/><path d="M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a10.9 10.9 0 0 0 5.4-1.4"/><path d="M9.9 9.9A3 3 0 0 0 12 15a3 3 0 0 0 2.1-.9"/></svg>,
  search:(p)=> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>,
  chev: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6"/></svg>,
  back: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>,
  warn: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 8v4.5"/><circle cx="12" cy="16" r=".6" fill="currentColor"/></svg>,
  check:(p)=> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m5 12 5 5L20 7"/></svg>,
  briefcase:(p)=> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></svg>,
  user: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>,
};

/* ---------- brand mark ---------- */
function Brand() {
  return (
    <div className="flex items-center justify-center gap-3 select-none">
      <div className="h-9 w-9 rounded-[10px] bg-ink flex items-center justify-center shadow-card">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#FAF8F4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 4h12a2 2 0 0 1 2 2v9"/>
          <path d="M5 4v16"/>
          <path d="M5 20h10"/>
          <path d="M19 15v5"/>
        </svg>
      </div>
      <div className="font-serif text-[28px] leading-none text-ink">Receptionly</div>
    </div>
  );
}

/* ---------- inputs ---------- */
function Field({ label, error, children, hint }) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-ink mb-1.5">{label}</label>
      {children}
      {error
        ? <div className="mt-1.5 text-[12px] text-danger flex items-center gap-1.5"><I.warn className="h-3.5 w-3.5"/>{error}</div>
        : hint ? <div className="mt-1.5 text-[12px] text-muted">{hint}</div> : null}
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder, error, autoComplete, onFocus }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={error ? 'field-error pr-10' : 'pr-10'}
      />
      <button type="button" tabIndex={-1} onClick={() => setShow(s => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-md text-muted hover:text-ink hover:bg-line/60 flex items-center justify-center"
        aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <I.eyeOff className="h-4 w-4"/> : <I.eye className="h-4 w-4"/>}
      </button>
    </div>
  );
}

/* ---------- searchable combobox ---------- */
function Combobox({ items, value, onChange, placeholder, searchPlaceholder, error, emptyLabel, renderItem }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function onDoc(e){ if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 0); }, [open]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(it => (it.label + ' ' + (it.sub||'')).toLowerCase().includes(needle));
  }, [items, q]);

  const selected = items.find(it => it.value === value);

  return (
    <div ref={ref} className={"relative " + (error ? "combo-error" : "")}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className={"w-full h-[42px] px-3 pr-9 rounded-lg border bg-white text-left flex items-center text-[14px] " +
          (selected ? "text-ink" : "text-[#B5AE9F]") +
          " border-[#D9D4C7] hover:border-[#BFB8A6] " +
          (open ? "ring-[3px] ring-accent/20 border-accent" : "")}>
        {selected ? (renderItem ? renderItem(selected, true) : selected.label) : placeholder}
        <I.chev className={"h-4 w-4 text-muted absolute right-3 top-1/2 -translate-y-1/2 transition-transform " + (open ? "rotate-180" : "")}/>
      </button>

      {open && (
        <div className="absolute z-40 mt-1.5 left-0 right-0 bg-white rounded-xl border border-line2 shadow-pop popin overflow-hidden">
          <div className="p-2 border-b border-line">
            <div className="relative">
              <I.search className="h-4 w-4 text-muted absolute left-2.5 top-1/2 -translate-y-1/2"/>
              <input ref={inputRef} type="text" value={q} onChange={e => setQ(e.target.value)}
                placeholder={searchPlaceholder}
                className="!h-9 !pl-8 !text-[13px]"/>
            </div>
          </div>
          <div className="max-h-[224px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-[13px] text-muted">{emptyLabel || 'No matches'}</div>
            ) : filtered.map(it => {
              const active = it.value === value;
              return (
                <button key={it.value} type="button"
                  onClick={() => { onChange(it.value); setOpen(false); setQ(''); }}
                  className={"w-full text-left px-3 py-2 text-[14px] flex items-center gap-2 hover:bg-bg " +
                    (active ? "bg-accentSoft/60" : "")}>
                  <div className="flex-1 min-w-0">{renderItem ? renderItem(it, false) : it.label}</div>
                  {active && <I.check className="h-4 w-4 text-accent shrink-0"/>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- views ---------- */
function SignIn({ onSwitch }) {
  const [email, setEmail] = useState('');
  const [pwd, setPwd]     = useState('');
  const [touched, setTouched] = useState({});
  const [submitErr, setSubmitErr] = useState('');

  const emailErr = touched.email && !email.trim() ? 'Email is required'
    : touched.email && !/^\S+@\S+\.\S+$/.test(email) ? 'Enter a valid email'
    : '';
  const pwdErr = touched.pwd && !pwd ? 'Password is required' : '';

  function submit(e) {
    e.preventDefault();
    setTouched({ email: true, pwd: true });
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email) || !pwd) {
      setSubmitErr('Please fix the fields above.');
      return;
    }
    setSubmitErr('');
    window.location.href = 'index.html';
  }

  return (
    <form onSubmit={submit} className="popin">
      <h1 className="font-serif text-[40px] leading-[1.05] text-ink">Welcome back</h1>
      <p className="text-ink2 mt-1.5 text-[15px]">Sign in to your account</p>

      <div className="mt-7 space-y-4">
        <Field label="Email" error={emailErr}>
          <input type="email" autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
            onBlur={() => setTouched(t => ({...t, email: true}))}
            placeholder="you@example.com"
            className={emailErr ? 'field-error' : ''}/>
        </Field>

        <Field label="Password" error={pwdErr}>
          <PasswordInput value={pwd} onChange={setPwd}
            placeholder="••••••••"
            autoComplete="current-password"
            onFocus={() => {}}
            error={pwdErr}/>
        </Field>

        <Button type="submit" variant="accent" size="xl" className="w-full text-[15px]">
          Sign in
        </Button>

        {submitErr && <div className="text-[12px] text-danger flex items-center gap-1.5"><I.warn className="h-3.5 w-3.5"/>{submitErr}</div>}
      </div>

      <div className="my-6 flex items-center gap-3 text-[12px] text-muted">
        <div className="flex-1 h-px bg-line"></div>
        <span>New to Receptionly?</span>
        <div className="flex-1 h-px bg-line"></div>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        <Button type="button" variant="secondary" size="xl" className="w-full" onClick={() => { window.location.href = 'onboarding.html'; }}>
          <I.briefcase className="h-4 w-4 text-accent"/>
          Create business account
        </Button>
        <Button type="button" variant="secondary" size="xl" className="w-full" onClick={onSwitch}>
          <I.user className="h-4 w-4 text-accent"/>
          Create employee account
        </Button>
      </div>
    </form>
  );
}

function EmployeeRegister({ onBack }) {
  const [email, setEmail]   = useState('');
  const [phone, setPhone]   = useState('');
  const [pwd, setPwd]       = useState('');
  const [pwd2, setPwd2]     = useState('');
  const [bizId, setBizId]   = useState('');
  const [empName, setEmpName] = useState('');
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake]   = useState(false);
  const [confirmBack, setConfirmBack] = useState(false);

  // Creation flow — if the user has typed anything, prompt them before
  // we throw it away. "Save & leave" is hidden because the account
  // doesn't exist yet.
  const hasInput = !!(email || phone || pwd || pwd2 || bizId || empName);
  function handleBack() {
    if (hasInput) setConfirmBack(true);
    else onBack();
  }

  // Reset employee when business changes
  useEffect(() => { setEmpName(''); }, [bizId]);

  const biz = BUSINESSES.find(b => b.id === bizId);

  const emailErr = touched.email && !email.trim() ? 'Email is required'
    : touched.email && !/^\S+@\S+\.\S+$/.test(email) ? 'Enter a valid email'
    : '';
  const phoneErr = touched.phone && !phone ? 'Phone number is required'
    : touched.phone && !isPhoneComplete(phone) ? 'Enter a complete 10-digit phone number'
    : '';
  const pwdErr = touched.pwd && !pwd ? 'Password is required'
    : touched.pwd && pwd.length < 8 ? 'Use at least 8 characters'
    : '';
  const pwd2Err = touched.pwd2 && !pwd2 ? 'Please confirm your password'
    : touched.pwd2 && pwd && pwd2 && pwd !== pwd2 ? 'Passwords don\u2019t match'
    : '';
  const bizErr  = touched.biz && !bizId ? 'Select your business' : '';
  const empErr  = touched.emp && !empName ? 'Select your name' : '';

  const allFilled = email && /^\S+@\S+\.\S+$/.test(email) && isPhoneComplete(phone) && pwd.length >= 8 && pwd2 && pwd === pwd2 && bizId && empName;
  const disabled = !allFilled || submitting;

  const bizItems = BUSINESSES.map(b => ({ value: b.id, label: b.name, sub: b.city }));
  const empItems = (biz?.employees || []).map(n => ({ value: n, label: n }));

  function submit(e) {
    e.preventDefault();
    setTouched({ email: true, phone: true, pwd: true, pwd2: true, biz: true, emp: true });
    if (!allFilled) {
      setShake(true); setTimeout(() => setShake(false), 400);
      return;
    }
    setSubmitting(true);
    setTimeout(() => { window.location.href = 'Employee.html'; }, 450);
  }

  return (
    <form onSubmit={submit} className={"popin " + (shake ? "shake" : "")}>
      <button type="button" onClick={handleBack}
        className="inline-flex items-center gap-1.5 text-[13px] text-ink2 hover:text-ink mb-3 -ml-1 px-1 py-1 rounded-md hover:bg-line/40 transition">
        <I.back className="h-3.5 w-3.5"/> Back to sign in
      </button>

      <h1 className="font-serif text-[34px] leading-[1.05] text-ink">Join your team</h1>
      <p className="text-ink2 mt-1.5 text-[14px]">Create an employee account at your business.</p>

      <div className="mt-6 space-y-4">
        <Field label="Email" error={emailErr}>
          <input type="email" autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
            onBlur={() => setTouched(t => ({...t, email: true}))}
            placeholder="you@example.com"
            className={emailErr ? 'field-error' : ''}/>
        </Field>

        <Field label="Phone" error={phoneErr} hint={!phoneErr && !phone ? "We'll text you shift reminders" : null}>
          <input type="tel" inputMode="tel" autoComplete="tel" maxLength={14}
            value={phone}
            onChange={e => setPhone(formatPhoneInput(e.target.value))}
            onBlur={() => setTouched(t => ({...t, phone: true}))}
            placeholder="(415) 555-0100"
            aria-invalid={!!phoneErr}
            aria-required="true"
            className={phoneErr ? 'field-error' : ''}/>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Password" error={pwdErr} hint={!pwdErr && !pwd ? 'Min. 8 characters' : null}>
            <PasswordInput value={pwd} onChange={v => { setPwd(v); }}
              placeholder="••••••••"
              autoComplete="new-password"
              onFocus={() => setTouched(t => ({...t, pwd: false}))}
              error={pwdErr}/>
            {/* trigger touch on blur via wrapper */}
            <input type="hidden"/>
          </Field>
          <Field label="Confirm" error={pwd2Err}>
            <PasswordInput value={pwd2} onChange={setPwd2}
              placeholder="••••••••"
              autoComplete="new-password"
              onFocus={() => setTouched(t => ({...t, pwd2: false}))}
              error={pwd2Err}/>
          </Field>
        </div>
        {/* Sync touched on blur for password fields */}
        <BlurSync onBlur={() => setTouched(t => ({...t, pwd: pwd ? true : t.pwd}))}/>

        <Field label="Business" error={bizErr}>
          <Combobox
            items={bizItems}
            value={bizId}
            onChange={v => { setBizId(v); setTouched(t => ({...t, biz: true})); }}
            placeholder="Select your business"
            searchPlaceholder="Search businesses…"
            emptyLabel="No businesses found"
            error={bizErr}
            renderItem={(it, isSelected) => (
              <div className="min-w-0">
                <div className="truncate text-ink text-[14px]">{it.label}</div>
                {!isSelected && it.sub && <div className="truncate text-[12px] text-muted">{it.sub}</div>}
              </div>
            )}
          />
        </Field>

        <Field label="Your name" error={empErr}
          hint={!bizId ? 'Select a business first' : null}>
          <div className={!bizId ? "opacity-50 pointer-events-none" : ""}>
            <Combobox
              items={empItems}
              value={empName}
              onChange={v => { setEmpName(v); setTouched(t => ({...t, emp: true})); }}
              placeholder={bizId ? "Select your name" : "—"}
              searchPlaceholder="Search team members…"
              emptyLabel="No matching team members"
              error={empErr}
            />
          </div>
        </Field>

        <Button type="submit" variant="accent" size="xl" disabled={disabled} className="w-full text-[15px]">
          {submitting ? (
            <><span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin"></span> Creating account…</>
          ) : 'Create account'}
        </Button>

        <p className="text-[12px] text-muted text-center">
          By creating an account you agree to the Terms & Privacy Policy.
        </p>
      </div>

      <UnsavedChangesModal
        open={confirmBack}
        hideSave={true}
        onDiscard={() => { setConfirmBack(false); onBack(); }}
        onStay={() => setConfirmBack(false)}
      />
    </form>
  );
}

// Small helper to mark touched on blur outside of nested children
function BlurSync({ onBlur }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type === 'password') onBlur?.();
    };
    document.addEventListener('blur', handler, true);
    return () => document.removeEventListener('blur', handler, true);
  }, [onBlur]);
  return null;
}

// Self-contained Unsaved-changes modal — mirrors the wording and visual
// language used everywhere else in the app, so the signin / signup flow
// feels consistent with the rest of Receptionly.
function UnsavedChangesModal({ open, hideSave, onSave, onDiscard, onStay }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape') onStay && onStay(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onStay]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 fadein"
      style={{ background: 'rgba(20,18,15,.42)' }}
      onClick={onStay}>
      <div
        className="relative w-full max-w-[440px] bg-surface rounded-2xl shadow-pop border border-line p-7"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="font-serif text-[22px] text-ink leading-tight mb-2">Unsaved changes</h3>
        <p className="text-[14px] text-ink2 leading-relaxed mb-6">
          You have unsaved changes. What would you like to do?
        </p>
        <div className="space-y-2">
          {!hideSave && (
            <Button type="button" variant="accent" size="xl" className="w-full" onClick={onSave}>
              Save &amp; leave
            </Button>
          )}
          <Button type="button" variant="secondary" size="xl" className="w-full" onClick={onDiscard}>
            Leave without saving
          </Button>
          <Button type="button" variant="ghost" size="lg" className="w-full" onClick={onStay}>
            Keep editing
          </Button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [view, setView] = useState('signin'); // 'signin' | 'employee'

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-10 sm:py-14">
      <div className="w-full max-w-[420px]">
        <div className="mb-6">
          <Brand/>
        </div>

        <div className="bg-surface rounded-2xl shadow-pop border border-line p-7 sm:p-8">
          {view === 'signin'
            ? <SignIn onSwitch={() => setView('employee')}/>
            : <EmployeeRegister onBack={() => setView('signin')}/>}
        </div>

        <div className="mt-5 text-center text-[12px] text-muted">
          {view === 'signin'
            ? <>Protected by Receptionly · <a className="hover:text-ink2" href="#">Help</a></>
            : <>Need a different role? <button onClick={() => setView('signin')} className="text-ink2 hover:text-ink font-medium underline-offset-2 hover:underline">Back to sign in</button></>}
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App/>);
