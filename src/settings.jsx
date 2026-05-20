import { useEffect, useState } from 'react';
import { ClosuresSection } from './closures';
import { ACCOUNT, BUSINESS, LOCATIONS, fmt12, getLocation } from './data';
import { I } from './icons';
import { ChangePasswordCard, useDirtyGuard, useNavGuard } from './nav-guard';
import { Badge, Button, Card, CopyButton, Field, LogoUploader, SectionHeader, TimePicker, Toggle, cx } from './ui';

// Settings page
//
// Business tab is split into three clearly-separated cards:
//   1. Locations — list, switch, delete, add
//   2. Business Details — fields that apply to the whole brand (name,
//      type, owner, admin email/phone). Admin email is read-only.
//   3. Location Details — fields scoped to the currently-selected location
//      (address, city/state/zip, timezone, location phone).
//
// Each editable section has its own Save button that's enabled only when
// the user has actually changed a field (and disabled again if they
// revert it). All sections share a single nav-guard so leaving the page
// or switching tabs/locations/leaves while dirty pops the unsaved-changes
// confirmation, and saving from there commits whatever is pending.

export function shallowEq(a, b) {
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (a[k] !== b[k]) return false;
  return true;
}

export function SettingsPage({ onStartOnboarding, onAddLocation, onSwitchLocation, onDeleteLocation, onNav, activeLocId, locVersion }) {
  const navGuard = useNavGuard();
  const [tab, _setTab] = useState('business');
  const [resetKey, setResetKey] = useState(0); // bump to remount uncontrolled inputs on discard

  // ── Business-level form (ACCOUNT) ────────────────────────────────────
  const snapBiz = () => ({
    businessName: ACCOUNT.businessName,
    type: ACCOUNT.type,
    ownerName: ACCOUNT.ownerName,
    email: ACCOUNT.email,
    adminPhone: ACCOUNT.adminPhone,
    logo: ACCOUNT.logo || null,
  });
  const [bizForm, setBizForm] = useState(snapBiz);
  const [bizOrig, setBizOrig] = useState(snapBiz);
  const bizDirty = !shallowEq(bizForm, bizOrig);

  // ── Location-level form ──────────────────────────────────────────────
  const snapLoc = (id) => {
    const loc = getLocation(id);
    const b = loc.business;
    return {
      locationName: loc.name || '',
      address: b.address || '',
      city: b.city || '',
      state: b.state || '',
      zip: b.zip || '',
      timezone: b.timezone || '',
      phone: b.phone || '',
      website: b.website || '',
    };
  };
  const [locForm, setLocForm] = useState(() => snapLoc(activeLocId));
  const [locOrig, setLocOrig] = useState(() => snapLoc(activeLocId));
  const locDirty = !shallowEq(locForm, locOrig);

  // ── Cancellation policy (business-wide, optional) ───────────────────
  // Lives on ACCOUNT, shared across every location. Saved/discarded
  // independently of the other Business-tab cards.
  const [policyOrig, setPolicyOrig] = useState(ACCOUNT.cancellationPolicy || '');
  const [policy, setPolicy] = useState(ACCOUNT.cancellationPolicy || '');
  const policyDirty = policy !== policyOrig;

  // ── AI Agent Stats (business-wide toggle) ────────────────────────────
  // Lives on ACCOUNT. When false, AI KPIs, alerts panel, and AI source
  // breakdowns are hidden across the app.
  const [aiOrig, setAiOrig] = useState(ACCOUNT.aiAgentEnabled !== false);
  const [aiEnabled, setAiEnabled] = useState(ACCOUNT.aiAgentEnabled !== false);
  const aiDirty = aiEnabled !== aiOrig;

  // Reset the location form whenever the active location changes (after the
  // nav guard has already prompted-then-allowed the change at a higher level)
  // or whenever the locations registry mutates (e.g. on delete).
  useEffect(() => {
    const snap = snapLoc(activeLocId);
    setLocForm(snap);
    setLocOrig(snap);
  }, [activeLocId, locVersion]);

  // ── Hours tab (controlled state, diff-based dirty tracking) ─────
  // Snapshot the weekly hours and closures so any edit-then-revert flips the
  // Save button back to disabled (matches every other section on this page).
  const snapHours = () => ({
    hours: Object.fromEntries(['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => {
      const h = BUSINESS.hours[d] || { open: '09:00', close: '17:00', closed: true };
      return [d, { open: h.open, close: h.close, closed: !!h.closed }];
    })),
    closures: (BUSINESS.closures || []).map(c => ({ ...c })),
  });
  const [hoursForm, setHoursForm] = useState(snapHours);
  const [hoursOrig, setHoursOrig] = useState(snapHours);
  const hoursDirty = JSON.stringify(hoursForm) !== JSON.stringify(hoursOrig);
  // Re-snapshot when the active location changes (uncontrolled inputs remount).
  useEffect(() => {
    const snap = snapHours();
    setHoursForm(snap);
    setHoursOrig(snap);
  }, [activeLocId, locVersion]);

  function setHoursDay(day, patch) {
    setHoursForm(prev => ({ ...prev, hours: { ...prev.hours, [day]: { ...prev.hours[day], ...patch } } }));
  }
  function setClosuresForm(next) {
    setHoursForm(prev => ({ ...prev, closures: next }));
  }

  const dirty = bizDirty || locDirty || hoursDirty || policyDirty || aiDirty;

  function commitBiz() {
    Object.assign(ACCOUNT, bizForm);
    // Propagate brand-level fields to every location + the live BUSINESS.
    LOCATIONS.forEach((loc) => {
      loc.business.name = bizForm.businessName;
      loc.business.type = bizForm.type;
      loc.business.ownerName = bizForm.ownerName;
      loc.business.email = bizForm.email;
      loc.business.logo = bizForm.logo;
    });
    BUSINESS.name = bizForm.businessName;
    BUSINESS.type = bizForm.type;
    BUSINESS.ownerName = bizForm.ownerName;
    BUSINESS.email = bizForm.email;
    BUSINESS.logo = bizForm.logo;
    setBizOrig({ ...bizForm });
  }
  function commitLoc() {
    const loc = LOCATIONS.find((l) => l.id === activeLocId);
    if (!loc) return;
    loc.name = locForm.locationName;
    loc.business.address = locForm.address;
    loc.business.city = locForm.city;
    loc.business.state = locForm.state;
    loc.business.zip = locForm.zip;
    loc.business.timezone = locForm.timezone;
    loc.business.phone = locForm.phone;
    loc.business.website = locForm.website;
    if (loc.id === window.ACTIVE_LOCATION_ID) {
      Object.assign(BUSINESS, {
        address: locForm.address, city: locForm.city, state: locForm.state, zip: locForm.zip,
        timezone: locForm.timezone, phone: locForm.phone, website: locForm.website,
      });
    }
    setLocOrig({ ...locForm });
  }
  function commit() {
    if (bizDirty) commitBiz();
    if (locDirty) commitLoc();
    if (hoursDirty) commitHours();
    if (policyDirty) commitPolicy();
    if (aiDirty) commitAi();
  }
  function commitHours() {
    ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d => {
      const h = hoursForm.hours[d];
      BUSINESS.hours[d] = { open: h.open, close: h.close, closed: h.closed };
    });
    BUSINESS.closures = hoursForm.closures;
    setHoursOrig(snapHours());
  }
  function commitPolicy() {
    ACCOUNT.cancellationPolicy = policy;
    setPolicyOrig(policy);
  }
  function commitAi() {
    ACCOUNT.aiAgentEnabled = aiEnabled;
    setAiOrig(aiEnabled);
  }
  function discard() {
    setBizForm({ ...bizOrig });
    setLocForm({ ...locOrig });
    setPolicy(policyOrig);
    setAiEnabled(aiOrig);
    setHoursForm(hoursOrig);
    setResetKey((k) => k + 1);
  }

  useDirtyGuard({ dirty, onSave: commit, onDiscard: discard });

  // Guarded tab change — pops the modal if there are unsaved edits.
  function setTab(next) {
    if (next === tab) return;
    navGuard.request(() => _setTab(next));
  }

  // ── Delete-location confirmation ─────────────────────────────────────
  const [confirmingDelete, setConfirmingDelete] = useState(null); // location object
  function confirmDelete() {
    if (!confirmingDelete) return;
    const id = confirmingDelete.id;
    setConfirmingDelete(null);
    // If we're deleting the location that's currently being edited, drop
    // any unsaved location-level changes — the location is going away.
    if (id === activeLocId) {
      setLocForm({ ...locOrig });
    }
    onDeleteLocation && onDeleteLocation(id);
  }

  const TABS = [
    { v: 'business', l: 'Business' },
    { v: 'hours',    l: 'Hours' },
    { v: 'account',  l: 'Account' },
  ];

  const activeLoc = LOCATIONS.find((l) => l.id === activeLocId) || LOCATIONS[0];

  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Account" title="Settings" />

      {/* Pill-style segmented tabs */}
      <div className="inline-flex items-center gap-0.5 p-1 rounded-full bg-bg border border-line2">
        {TABS.map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className={cx(
              'h-9 px-4 rounded-full text-[13.5px] font-medium transition',
              tab === t.v ? 'bg-surface text-ink shadow-card' : 'text-ink2/70 hover:text-ink'
            )}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'business' && (
        <div className="space-y-6">
          {/* 1. Locations card */}
          <Card className="p-8">
            <div className="flex items-baseline justify-between gap-4 mb-1">
              <h3 className="font-serif text-[24px] text-ink whitespace-nowrap">Locations</h3>
              <span className="text-[12px] text-muted whitespace-nowrap flex-shrink-0">{LOCATIONS.length} {LOCATIONS.length === 1 ? 'location' : 'locations'}</span>
            </div>
            <p className="text-[13px] text-ink2 mb-5">Each location has its own staff, services, hours, and booking page. Switch between them using the workspace selector at the top-left.</p>
            <div className="rounded-lg border border-line divide-y divide-line overflow-hidden">
              {LOCATIONS.map((loc) => {
                const sel = loc.id === activeLocId;
                const isOnly = LOCATIONS.length === 1;
                return (
                  <div key={loc.id} className={cx('flex items-center gap-4 px-4 py-3.5', sel && 'bg-accentSoft/30')}>
                    <div className={cx('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', sel ? 'bg-accent text-white' : 'bg-bg text-ink2')}>
                      <I.Map size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink truncate">{loc.name}</span>
                        {sel && <Badge tone="accent">Currently viewing</Badge>}
                      </div>
                      <div className="text-[12.5px] text-muted truncate mt-0.5">
                        {loc.business.address} · {loc.business.city}, {loc.business.state} {loc.business.zip}
                      </div>
                      <div className="text-[11.5px] text-muted/80 truncate mt-0.5">
                        {loc.staff.length} staff · {loc.services.length} services · {loc.business.bookingLink}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!sel && (
                        <button
                          onClick={() => onSwitchLocation && onSwitchLocation(loc.id)}
                          className="h-8 px-3 rounded-md text-[12.5px] font-medium text-accent hover:bg-accentSoft/40 transition"
                        >
                          Switch to →
                        </button>
                      )}
                      <button
                        onClick={() => !isOnly && setConfirmingDelete(loc)}
                        disabled={isOnly}
                        title={isOnly ? 'At least one location is required' : 'Delete location'}
                        aria-label="Delete location"
                        className={cx(
                          'h-8 w-8 inline-flex items-center justify-center rounded-md transition',
                          isOnly ? 'text-line2 cursor-not-allowed' : 'text-muted hover:text-rose hover:bg-roseSoft/40'
                        )}
                      >
                        <I.Trash size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {LOCATIONS.length === 1 && (
              <div className="mt-3 rounded-lg border border-amber/30 bg-amberSoft/40 px-3.5 py-2.5 text-[12.5px] text-[#6B4D00] flex items-start gap-2.5">
                <span className="mt-0.5 w-4 h-4 rounded-full bg-amber/30 text-[#6B4D00] inline-flex items-center justify-center text-[10px] font-bold flex-shrink-0">!</span>
                <span><span className="font-medium">At least one location is required.</span> Add another location before deleting this one.</span>
              </div>
            )}
            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-[11.5px] text-muted">Adding a location won't affect existing bookings or staff at your current locations.</p>
              <Button variant="accent" onClick={onAddLocation}>
                <I.Plus size={14} /> Add new location
              </Button>
            </div>
          </Card>

          {/* 2. Business Details — applies to whole brand */}
          <Card className="p-8">
            <div className="flex items-baseline justify-between gap-4 mb-1">
              <h3 className="font-serif text-[24px] text-ink whitespace-nowrap">Business details</h3>
              <span className="text-[11.5px] text-muted whitespace-nowrap flex-shrink-0">Applies to your whole account</span>
            </div>
            <p className="text-[13px] text-ink2 mb-6">These details are shared across every location.</p>
            <div className="space-y-5">
              <div className="rounded-lg border border-line bg-bg/30 p-5">
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <div className="text-[12.5px] font-medium text-ink">Business logo</div>
                  <span className="text-[11.5px] text-muted">Optional</span>
                </div>
                <p className="text-[12px] text-muted mb-4">Shown in your dashboard and at the top of your customer-facing booking page.</p>
                <LogoUploader
                  value={bizForm.logo}
                  onChange={(d) => setBizForm({ ...bizForm, logo: d })}
                  onRemove={() => setBizForm({ ...bizForm, logo: null })}
                  size={96}
                  placeholderLabel="Add logo"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Business name">
                  <input value={bizForm.businessName} onChange={(e) => setBizForm({ ...bizForm, businessName: e.target.value })} />
                </Field>
                <Field label="Business type">
                  <select value={bizForm.type} onChange={(e) => setBizForm({ ...bizForm, type: e.target.value })}>
                    {['Salon', 'Barbershop', 'Spa', 'Medspa', 'Nail Salon', 'Wellness Studio', 'Other'].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Owner / admin name">
                  <input value={bizForm.ownerName} onChange={(e) => setBizForm({ ...bizForm, ownerName: e.target.value })} />
                </Field>
                <Field label="Admin email" hint="Read-only — contact support to change">
                  <input readOnly value={bizForm.email} className="!bg-bg/60 !text-ink2 !cursor-default focus:!ring-0 focus:!border-line2" />
                </Field>
                <Field label="Admin phone">
                  <input value={bizForm.adminPhone} onChange={(e) => setBizForm({ ...bizForm, adminPhone: e.target.value })} placeholder="(415) 555-0100" />
                </Field>
              </div>
            </div>
            <div className="mt-8 flex justify-end">
              <Button variant="accent" onClick={commitBiz} disabled={!bizDirty}>Save changes</Button>
            </div>
          </Card>

          {/* 3. Location Details — applies to the active location only */}
          <Card key={`loc-${activeLocId}-${locVersion}`} className="p-8">
            <div className="flex items-baseline justify-between gap-4 mb-1">
              <h3 className="font-serif text-[24px] text-ink whitespace-nowrap">Location details</h3>
              <span className="text-[11.5px] text-muted whitespace-nowrap flex-shrink-0">Editing <span className="text-ink2 font-medium">{activeLoc.name}</span></span>
            </div>
            <p className="text-[13px] text-ink2 mb-6">Information shown on the booking page and used in customer reminders for this location.</p>
            <div className="space-y-5">
              <Field label="Location name" hint="e.g. Hayes Valley, Mission, Downtown">
                <input value={locForm.locationName} onChange={(e) => setLocForm({ ...locForm, locationName: e.target.value })} />
              </Field>
              <Field label="Street address">
                <input value={locForm.address} onChange={(e) => setLocForm({ ...locForm, address: e.target.value })} />
              </Field>
              <div className="grid grid-cols-3 gap-5">
                <Field label="City">
                  <input value={locForm.city} onChange={(e) => setLocForm({ ...locForm, city: e.target.value })} />
                </Field>
                <Field label="State">
                  <input value={locForm.state} onChange={(e) => setLocForm({ ...locForm, state: e.target.value })} />
                </Field>
                <Field label="ZIP code">
                  <input value={locForm.zip} onChange={(e) => setLocForm({ ...locForm, zip: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Location phone">
                  <input value={locForm.phone} onChange={(e) => setLocForm({ ...locForm, phone: e.target.value })} placeholder="(415) 555-0100" />
                </Field>
                <Field label="Time zone">
                  <select value={locForm.timezone} onChange={(e) => setLocForm({ ...locForm, timezone: e.target.value })}>
                    {['America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'America/Anchorage', 'Pacific/Honolulu'].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Website" optional>
                <input value={locForm.website} onChange={(e) => setLocForm({ ...locForm, website: e.target.value })} placeholder="avalonsalon.com" />
              </Field>
            </div>
            <div className="mt-8 flex justify-end">
              <Button variant="accent" onClick={commitLoc} disabled={!locDirty}>Save changes</Button>
            </div>
          </Card>

          {/* 4. Cancellation Policy — applies to the whole business (optional) */}
          <Card className="p-8">
            <div className="flex items-baseline justify-between gap-4 mb-1">
              <h3 className="font-serif text-[24px] text-ink whitespace-nowrap">Cancellation policy</h3>
              <span className="text-[11.5px] text-muted whitespace-nowrap flex-shrink-0">Optional · applies to your whole account</span>
            </div>
            <p className="text-[13px] text-ink2 mb-5">Set expectations for online bookings. Customers see this on the booking page just before they confirm an appointment. Leave blank to hide it entirely.</p>
            <Field
              label="Policy text"
              optional
              hint="Plain text only. Line breaks are preserved."
            >
              <textarea
                rows={6}
                value={policy}
                maxLength={1200}
                onChange={(e) => setPolicy(e.target.value)}
                placeholder="e.g. Please give us 24 hours' notice if you need to cancel or reschedule. Late cancellations and no-shows may be charged 50% of the service price."
                style={{ minHeight: 140, lineHeight: 1.55 }}
              />
            </Field>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11.5px] text-muted">
                {policy.trim()
                  ? 'Visible to customers on the booking page.'
                  : 'No policy set — nothing will show on the booking page.'}
              </span>
              <span className="text-[11.5px] text-muted tabular-nums">{policy.length} / 1200</span>
            </div>
            <div className="mt-8 flex justify-end">
              <Button variant="accent" onClick={commitPolicy} disabled={!policyDirty}>Save changes</Button>
            </div>
          </Card>

          {/* 5. AI Agent Stats — business-wide toggle */}
          <Card className="p-8">
            <div className="flex items-baseline justify-between gap-4 mb-1">
              <h3 className="font-serif text-[24px] text-ink whitespace-nowrap">AI Agent Stats</h3>
              <span className="text-[11.5px] text-muted whitespace-nowrap flex-shrink-0">Applies to your whole account</span>
            </div>
            <p className="text-[13px] text-ink2 mb-5">Show AI-related stats, booking sources, and the AI receptionist alerts panel across your dashboard, reports, and appointments. Turn this off if you're not using the AI agent and want a cleaner view.</p>
            <label className="flex items-start gap-4 rounded-lg border border-line bg-bg/30 p-4 cursor-pointer">
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-medium text-ink">Enable AI Agent Stats</div>
                <div className="text-[12px] text-muted mt-0.5">
                  {aiEnabled
                    ? 'AI bookings, AI receptionist lift, and the alerts panel are visible across the app.'
                    : 'AI-related stats and categories are hidden everywhere.'}
                </div>
              </div>
              <Toggle checked={aiEnabled} onChange={setAiEnabled} />
            </label>
            <div className="mt-8 flex justify-end">
              <Button variant="accent" onClick={commitAi} disabled={!aiDirty}>Save changes</Button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'hours' && (
        <Card key={`hours-${resetKey}-${activeLocId}`} className="p-8">
          <h3 className="font-serif text-[24px] text-ink mb-6">Hours of operation</h3>
          <div className="rounded-lg border border-line divide-y divide-line">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => {
              const h = hoursForm.hours[d];
              return (
                <HoursRow
                  key={d}
                  day={d}
                  open={h.open}
                  close={h.close}
                  closed={h.closed}
                  onChange={(patch) => setHoursDay(d, patch)}
                />
              );
            })}
          </div>

          {/* Holidays & special closures — mirrors onboarding step 3 */}
          <div className="mt-8 pt-8 border-t border-line">
            <ClosuresSection
              data={{ tz: BUSINESS.timezone, closures: hoursForm.closures }}
              setData={(next) => setClosuresForm(next.closures)}
            />
          </div>

          <div className="mt-8 flex justify-end">
            <Button variant="accent" onClick={commitHours} disabled={!hoursDirty}>Save changes</Button>
          </div>
        </Card>
      )}

      {tab === 'account' && (
        <div key={`account-${resetKey}`} className="space-y-6">
          <ChangePasswordCard />

          <Card className="p-8">
            <h3 className="font-serif text-[24px] text-ink mb-6">Online booking link</h3>
            <Field label="Your unique booking URL" plain>
              <div className="flex items-stretch gap-2">
                <input readOnly defaultValue={BUSINESS.bookingLink} className="!font-mono !bg-bg/60 !text-ink2 !cursor-default focus:!ring-0 focus:!border-line2" />
                <CopyButton variant="secondary" value={BUSINESS.bookingLink} />
                <Button variant="secondary" onClick={() => onNav && onNav('booking')}>
                  <I.Eye size={14} /> Preview
                </Button>
              </div>
            </Field>
          </Card>

          <Card className="p-8">
            <h3 className="font-serif text-[24px] text-ink mb-2">Sign out</h3>
            <p className="text-[13.5px] text-ink2 mb-6">You'll need to sign back in with your email and password to access your dashboard.</p>
            <div className="flex justify-end">
              <Button variant="danger" onClick={() => { window.location.href = 'signin.html'; }}>
                <I.Door size={14} /> Sign out
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete-location confirmation modal */}
      {confirmingDelete && (
        <DeleteLocationModal
          location={confirmingDelete}
          isActive={confirmingDelete.id === activeLocId}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmingDelete(null)}
        />
      )}
    </div>
  );
}

window.SettingsPage = SettingsPage;

export function HoursRow({ day, open, close, closed, onChange }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <span className="w-12 font-medium text-ink">{day}</span>
      <Toggle checked={!closed} onChange={(v) => onChange({ closed: !v })} />
      <div className="flex-1 grid grid-cols-2 gap-2 max-w-xs">
        <TimePicker value={open} onChange={(v) => onChange({ open: v })} disabled={closed} className={closed ? 'opacity-40' : ''} />
        <TimePicker value={close} onChange={(v) => onChange({ close: v })} disabled={closed} className={closed ? 'opacity-40' : ''} />
      </div>
      <span className="text-[12px] text-muted ml-auto">{closed ? 'Closed' : `${fmt12(open)} – ${fmt12(close)}`}</span>
    </div>
  );
}

// Confirmation dialog for deleting a location. Mirrors the visual language
// of UnsavedChangesModal but with a destructive primary action.
export function DeleteLocationModal({ location, isActive, onConfirm, onCancel }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onCancel && onCancel(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 fadein"
      style={{ background: 'rgba(20,18,15,.42)' }}
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-[480px] bg-surface rounded-2xl shadow-pop border border-line p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          aria-label="Close"
          className="absolute top-4 right-4 w-7 h-7 inline-flex items-center justify-center rounded-md text-muted hover:text-ink hover:bg-bg/70 transition"
        >
          <I.X size={16} />
        </button>

        <div className="flex items-start gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-roseSoft text-rose flex items-center justify-center flex-shrink-0">
            <I.Trash size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-[22px] text-ink leading-tight">Delete this location?</h3>
            <p className="text-[12.5px] text-muted mt-0.5 truncate">{location.name} · {location.business.address}</p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-roseSoft bg-roseSoft/40 px-3.5 py-2.5 text-[12.5px] text-[#7A2A3D] leading-relaxed">
          This will remove <span className="font-medium">{location.name}</span> from your account, along with its staff, services, resources, customers, appointments, and booking page. This change applies to this demo only and won't affect real data.
        </div>
        {isActive && (
          <p className="text-[12.5px] text-ink2 mt-3 leading-relaxed">
            You're currently viewing this location. After deleting, the app will switch to {LOCATIONS.filter(l => l.id !== location.id)[0]?.name || 'another location'}.
          </p>
        )}

        <div className="mt-6 flex items-center gap-2 justify-end">
          <Button variant="secondary" size="lg" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" size="lg" onClick={onConfirm}>
            <I.Trash size={14} /> Delete location
          </Button>
        </div>
      </div>
    </div>
  );
}
