import { useMemo, useRef, useState } from 'react';
import { SERVICES, SERVICE_CATEGORIES, fmt12, toMin } from './data';
import { EMPLOYEE_PROFILES, getEmployee } from './employee-data';
import { I } from './icons';
import { ChangePasswordCard, useDirtyGuard, useNavGuard } from './nav-guard';
import { ACCEPTED_IMAGE_EXTS, Badge, Button, Card, Field, Modal, StaffAvatar, TimePicker, Toggle, cx, formatPhoneInput, isValidPhone, readFileAsDataURL, validateImageFile } from './ui';

// Employee Settings — personal profile, schedule prefs, services, notifications.

export function EmployeeSettings({ staffId }) {
  const me = getEmployee(staffId);
  const profile = EMPLOYEE_PROFILES[staffId];
  const navGuard = useNavGuard();
  const [section, _setSection] = useState('profile');
  // Section change goes through navGuard so dirty sections (e.g. Services I
  // offer) prompt the unsaved-changes modal before switching tabs.
  const setSection = (next) => navGuard.request(() => _setSection(next));

  const SECTIONS = [
    { id:'profile',       label:'Profile',          icon: <I.Sparkles size={14}/> },
    { id:'schedule',      label:'Working hours',    icon: <I.Clock size={14}/> },
    { id:'services',      label:'Services I offer', icon: <I.Scissors size={14}/> },
  ];

  return (
    <div>
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-medium mb-2">Settings</div>
        <h1 className="font-serif text-[40px] leading-[1.05] text-ink">Your account</h1>
        <p className="text-[14px] text-ink2 mt-1.5">Update your profile, schedule, and how clients book with you.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* Section nav */}
        <nav className="lg:sticky lg:top-20 self-start">
          <div className="space-y-0.5">
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => setSection(s.id)}
                className={cx('w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-left transition',
                  section === s.id ? 'bg-ink text-white' : 'text-ink2 hover:text-ink hover:bg-bg/70')}>
                <span className={section === s.id ? 'text-white' : 'text-ink2/80'}>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Section body */}
        <div className="min-w-0">
          {section === 'profile' && (
            <>
              <ProfileSection me={me} profile={profile}/>
              <ChangePasswordCard className="mt-5"/>
              <Card className="p-8 mt-5">
                <h3 className="font-serif text-[24px] text-ink mb-2">Sign out</h3>
                <p className="text-[13.5px] text-ink2 mb-6">You'll need to sign back in with your email and password to access your schedule.</p>
                <div className="flex justify-end">
                  <Button variant="danger" onClick={() => { window.location.href = 'signin.html'; }}>
                    <I.Door size={14} /> Sign out
                  </Button>
                </div>
              </Card>
            </>
          )}
          {section === 'schedule'      && <ScheduleSection me={me}/>}
          {section === 'services'      && <ServicesSection me={me}/>}
        </div>
      </div>
    </div>
  );
}

export function SectionShell({ title, subtitle, action, children, saveable, saveLabel = 'Save changes', extraAction, onSave }) {
  // If saveable, manage local dirty state and render a Save button that's disabled until changes happen.
  const [dirty, setDirty] = useState(false);
  const markDirty = () => { if (!dirty) setDirty(true); };

  const effectiveAction = saveable ? (
    <div className="flex items-center gap-2">
      {extraAction}
      <Button
        variant="accent"
        size="sm"
        disabled={!dirty}
        onClick={() => { onSave && onSave(); setDirty(false); }}
      >
        {saveLabel}
      </Button>
    </div>
  ) : action;

  const content = saveable ? (
    <div
      onChange={markDirty}
      onInput={markDirty}
      onClick={(e) => {
        // Toggle, TimePicker option, and other custom controls flag themselves
        if (e.target.closest('[data-dirty-trigger]')) markDirty();
      }}
    >
      {children}
    </div>
  ) : children;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-5 pb-5 border-b border-line">
        <div>
          <h2 className="font-serif text-[26px] text-ink leading-tight">{title}</h2>
          {subtitle && <p className="text-[13px] text-muted mt-1">{subtitle}</p>}
        </div>
        {effectiveAction}
      </div>
      {content}
    </Card>
  );
}

export function ProfileSection({ me, profile }) {
  // Baseline snapshot for diff-based dirty. Kept in state (like admin
  // Settings) so committing forces a re-render even when the working
  // values happen to equal the new baseline.
  const [orig, setOrig] = useState({
    name: me.name,
    phone: profile.phone || '',
    avatar: me.avatar || null
  });
  const [name, setName] = useState(orig.name);
  const [phone, setPhone] = useState(orig.phone);
  const [avatar, setAvatar] = useState(orig.avatar);
  const [avatarError, setAvatarError] = useState('');
  const fileInputRef = useRef(null);

  const phoneValid = !phone || isValidPhone(phone);
  const dirty =
  phone !== orig.phone ||
  avatar !== orig.avatar;
  const canSave = dirty && phoneValid;

  function commit() {
    if (!canSave) return;
    const nextPhone = phone;
    const nextAvatar = avatar || null;
    profile.phone = nextPhone;
    me.avatar = nextAvatar;
    setPhone(nextPhone);
    setAvatar(nextAvatar);
    setOrig({ name: orig.name, phone: nextPhone, avatar: nextAvatar });
  }
  function discard() {
    setPhone(orig.phone);
    setAvatar(orig.avatar);
    setAvatarError('');
  }

  async function handleAvatarFile(file) {
    const err = validateImageFile(file);
    if (err) { setAvatarError(err); return; }
    try {
      const data = await readFileAsDataURL(file);
      setAvatarError('');
      setAvatar(data);
    } catch (e) {
      setAvatarError(e.message || 'Could not read the file.');
    }
  }
  function onPickFile(e) {
    const f = e.target.files && e.target.files[0];
    if (f) handleAvatarFile(f);
    e.target.value = '';
  }
  function openPicker() { fileInputRef.current && fileInputRef.current.click(); }
  function removeAvatar() { setAvatarError(''); setAvatar(null); }

  useDirtyGuard({
    dirty,
    onSave: () => { if (canSave) commit(); },
    onDiscard: discard,
    hideSave: !canSave
  });

  // Build a "preview" staff object so StaffAvatar reflects the unsaved
  // avatar choice while editing. Initials/colour fall through if cleared.
  const previewMe = { ...me, avatar, name: name || me.name };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-5 pb-5 border-b border-line">
        <div>
          <h2 className="font-serif text-[26px] text-ink leading-tight">Profile</h2>
          <p className="text-[13px] text-muted mt-1">This is how clients see you on the booking page.</p>
        </div>
        <Button variant="accent" size="sm" disabled={!canSave} onClick={commit}>Save changes</Button>
      </div>

      {/* Avatar + identity */}
      <div className="flex items-start gap-5 mb-6">
        <div className="flex flex-col items-start">
          <button
            type="button"
            onClick={openPicker}
            aria-label={avatar ? 'Replace profile picture' : 'Upload profile picture'}
            className="relative group rounded-full focus:outline-none focus:ring-2 focus:ring-accent/40">
            <StaffAvatar staff={previewMe} size={88} />
            <span className="absolute inset-0 rounded-full bg-ink/55 text-white text-[11px] font-medium flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition pointer-events-none">
              <I.Image size={16} />
              <span>{avatar ? 'Replace' : 'Upload'}</span>
            </span>
            <span className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-white border border-line2 shadow-card flex items-center justify-center text-ink2 group-hover:text-ink transition">
              <I.Image size={13} />
            </span>
          </button>
          {avatar &&
          <button type="button" onClick={removeAvatar}
          className="mt-2 text-[11.5px] text-rose hover:underline inline-flex items-center gap-1">
              <I.Trash size={11} /> Remove photo
            </button>
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-serif text-[22px] text-ink leading-tight">{name || me.name}</div>
          <div className="text-[13px] text-ink2 mt-0.5">{me.role}</div>
          <p className="text-[11.5px] text-muted mt-3 leading-relaxed max-w-sm">
            Click your photo to upload a new one. PNG, JPG, SVG, or WEBP up to 10 MB. Square images look best.
          </p>
          {avatarError && <p className="text-[11.5px] text-rose mt-1.5 leading-relaxed max-w-sm">{avatarError}</p>}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_EXTS}
          onChange={onPickFile}
          className="hidden" />

      </div>

      <div className="space-y-4 max-w-md">
        <Field label="Display name" plain hint="Managed by your salon">
          <input
            type="text"
            value={name}
            readOnly
            disabled
            tabIndex={-1}
            className="!bg-bg/60 !text-ink2 !cursor-not-allowed focus:!ring-0 focus:!border-line2" />
        </Field>
        <Field label="Email" plain hint="Managed by your salon">
          <input
            type="email"
            value={profile.email}
            readOnly
            disabled
            tabIndex={-1}
            className="!bg-bg/60 !text-ink2 !cursor-not-allowed focus:!ring-0 focus:!border-line2" />

        </Field>
        <Field
          label="Phone"
          error={phone && !phoneValid ? 'Enter a 10-digit phone number' : undefined}>

          <input
            type="tel"
            inputMode="tel"
            value={phone}
            placeholder="(415) 555-0100"
            onChange={(e) => setPhone(formatPhoneInput(e.target.value))} />

        </Field>
      </div>
    </Card>);

}

export function ScheduleSection({ me }) {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const dayNames = { Mon:'Monday', Tue:'Tuesday', Wed:'Wednesday', Thu:'Thursday', Fri:'Friday', Sat:'Saturday', Sun:'Sunday' };
  const [showRequest, setShowRequest] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null);
  const navGuard = useNavGuard();

  // Going through navGuard means any unsaved edits inside the request form
  // pop the unsaved-changes prompt before the modal actually closes.
  function requestCloseSchedule() {
    navGuard.request(() => setShowRequest(false));
  }

  return (
    <>
      <SectionShell
        title="Working hours"
        subtitle="Set by your manager. Submit a request if you'd like them changed."
        action={<Button variant="accent" size="sm" onClick={() => setShowRequest(true)} style={{ lineHeight: 1 }}><I.Edit size={13}/> Request change</Button>}
      >
        {pendingRequest && (
          <div className="mb-4 rounded-lg border border-amberSoft/80 bg-amberSoft/40 p-3.5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center text-[#6B4D00] flex-shrink-0">
              <I.Clock size={15}/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-[#6B4D00]">Change request pending approval</div>
              <div className="text-[12px] text-[#6B4D00]/80 mt-0.5">Submitted just now · waiting on your manager</div>
            </div>
            <button onClick={() => setPendingRequest(null)} className="text-[11.5px] text-[#6B4D00]/80 hover:text-[#6B4D00] hover:underline">Withdraw</button>
          </div>
        )}

        <div className="rounded-lg border border-line divide-y divide-line bg-bg/30">
          {days.map(d => {
            const v = me.hours[d];
            const isOff = !Array.isArray(v);
            return (
              <div key={d} className="flex items-center gap-4 px-4 py-3.5">
                <div className="w-[120px]">
                  <div className="text-[13.5px] font-medium text-ink">{dayNames[d]}</div>
                </div>
                <div className="flex-1">
                  {isOff ? (
                    <span className="text-[13px] text-muted">Day off</span>
                  ) : (
                    <span className="text-[13.5px] text-ink font-mono">{fmt12(v[0])} – {fmt12(v[1])}</span>
                  )}
                </div>
                {!isOff && (
                  <span className="text-[11.5px] text-muted">
                    {(toMin(v[1]) - toMin(v[0])) / 60}h
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-2 text-[12px] text-muted">
          <I.Bell size={12}/>
          Working hours can only be changed by your manager. Use "Request change" to suggest an update.
        </div>
      </SectionShell>

      <LunchBreakCard me={me} />

      <Modal open={showRequest} onClose={requestCloseSchedule} maxWidth="max-w-lg">
        <ScheduleChangeForm
          me={me}
          onCancel={requestCloseSchedule}
          onSubmit={() => { setPendingRequest({}); setShowRequest(false); }}
        />
      </Modal>
    </>
  );
}

export function LunchBreakCard({ me }) {
  const [enabled, setEnabled] = useState(true);
  const lunchStart = me.lunch.replace('–','-').split('-')[0];
  const lunchEnd = me.lunch.replace('–','-').split('-')[1];
  const [start, setStart] = useState(lunchStart || '12:30');
  const [end, setEnd] = useState(lunchEnd || '13:30');

  const initialRef = useRef({ enabled, start, end });
  const dirty =
    enabled !== initialRef.current.enabled ||
    start !== initialRef.current.start ||
    end !== initialRef.current.end;

  function commit() {
    // Persist by writing back to me.lunch; toggling enabled flips the format.
    me.lunch = enabled ? `${start}-${end}` : 'off';
    initialRef.current = { enabled, start, end };
  }
  function discard() {
    setEnabled(initialRef.current.enabled);
    setStart(initialRef.current.start);
    setEnd(initialRef.current.end);
  }

  // Existing item — editing, so "Save & leave" is allowed.
  useDirtyGuard({ dirty, onSave: commit, onDiscard: discard });

  return (
    <Card className="p-6 mt-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h3 className="font-serif text-[20px] text-ink leading-tight">Lunch break</h3>
          <p className="text-[13px] text-muted mt-1">Auto-blocked from bookings on working days.</p>
        </div>
        <Button variant="accent" size="sm" disabled={!dirty} onClick={commit}>Save changes</Button>
      </div>
      <div className="mt-4">
        <div className="flex items-center gap-3 mb-3">
          <Toggle checked={enabled} onChange={setEnabled}/>
          <span className="text-[13px] text-ink2">{enabled ? 'Enabled on working days' : 'No lunch break scheduled'}</span>
        </div>
        <div className={cx('flex items-center gap-2', !enabled && 'opacity-50 pointer-events-none')}>
          <div className="w-[120px]"><TimePicker value={start} onChange={setStart} /></div>
          <span className="text-muted text-[13px]">to</span>
          <div className="w-[120px]"><TimePicker value={end} onChange={setEnd} /></div>
          <span className="text-[12px] text-muted ml-2">
            {enabled && `${Math.max(0, toMin(end) - toMin(start))} min`}
          </span>
        </div>
      </div>
    </Card>
  );
}

export function ScheduleChangeForm({ me, onCancel, onSubmit }) {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const dayNames = { Mon:'Monday', Tue:'Tuesday', Wed:'Wednesday', Thu:'Thursday', Fri:'Friday', Sat:'Saturday', Sun:'Sunday' };
  const [proposed, setProposed] = useState(() => {
    const out = {};
    for (const d of days) out[d] = me.hours[d];
    return out;
  });
  const [reason, setReason] = useState('');

  function toggleDay(d) {
    setProposed(p => ({
      ...p,
      [d]: Array.isArray(p[d]) ? 'off' : ['09:00','17:00']
    }));
  }
  function setTime(d, idx, val) {
    setProposed(p => {
      const next = Array.isArray(p[d]) ? [...p[d]] : ['09:00','17:00'];
      next[idx] = val;
      return { ...p, [d]: next };
    });
  }

  const changedDays = days.filter(d => {
    const a = me.hours[d];
    const b = proposed[d];
    const aOff = !Array.isArray(a);
    const bOff = !Array.isArray(b);
    if (aOff !== bOff) return true;
    if (aOff && bOff) return false;
    return a[0] !== b[0] || a[1] !== b[1];
  });

  // Submitting a request is a "create" action — hide "Save & leave".
  // `onDiscard` is a no-op: the runPending() in NavGuardProvider runs the
  // close action that triggered the prompt (and the modal's onCancel button
  // already routes through navGuard.request, so we'd loop if we re-fired it).
  const dirty = changedDays.length > 0 || reason.trim().length > 0;
  useDirtyGuard({
    dirty,
    onSave: () => {},
    onDiscard: () => {},
    hideSave: true,
  });

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-1">
        <h2 className="font-serif text-[26px] text-ink leading-tight">Request hours change</h2>
        <button onClick={onCancel} className="text-muted hover:text-ink p-1 -mr-1"><I.X size={16}/></button>
      </div>
      <p className="text-[13px] text-muted mb-5">Propose new hours. Your manager will review and approve before they take effect.</p>

      <div className="rounded-lg border border-line divide-y divide-line">
        {days.map(d => {
          const v = proposed[d];
          const isOff = !Array.isArray(v);
          const orig = me.hours[d];
          const origOff = !Array.isArray(orig);
          const changed = changedDays.includes(d);
          return (
            <div key={d} className={cx('flex items-center gap-3 px-4 py-3', changed && 'bg-accentSoft/40')}>
              <div className="w-[110px]">
                <div className="text-[13px] font-medium text-ink">{dayNames[d]}</div>
                {changed && (
                  <div className="text-[10.5px] text-muted mt-0.5">
                    was {origOff ? 'off' : `${fmt12(orig[0])}–${fmt12(orig[1])}`}
                  </div>
                )}
              </div>
              <Toggle checked={!isOff} onChange={() => toggleDay(d)}/>
              <div className="flex-1 flex items-center gap-2">
                {isOff ? (
                  <span className="text-[13px] text-muted">Day off</span>
                ) : (
                  <>
                    <div className="w-[120px]"><TimePicker value={v[0]} onChange={val => setTime(d, 0, val)} size="sm" /></div>
                    <span className="text-muted text-[13px]">to</span>
                    <div className="w-[120px]"><TimePicker value={v[1]} onChange={val => setTime(d, 1, val)} size="sm" /></div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Field label="Reason for change" optional>
        <textarea
          rows={3}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Optional note for your manager — e.g. school pickups on Thursdays…"
          className="mt-3"/>
      </Field>

      <div className="flex items-center justify-between gap-2 mt-6">
        <div className="text-[12px] text-muted">
          {changedDays.length === 0
            ? 'No changes yet'
            : `${changedDays.length} day${changedDays.length === 1 ? '' : 's'} changed`}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant="accent" onClick={onSubmit} disabled={changedDays.length === 0}>Submit request</Button>
        </div>
      </div>
    </div>
  );
}

export function ServicesSection({ me }) {
  const all = SERVICES;

  // Snapshot of the original offering set — recompares every render against
  // current selection so dirty flips off when the user reverts a toggle.
  const originalRef = useRef(new Set(me.services));
  const [selected, setSelected] = useState(() => new Set(me.services));

  const dirty = useMemo(() => {
    const orig = originalRef.current;
    if (selected.size !== orig.size) return true;
    for (const id of selected) if (!orig.has(id)) return true;
    return false;
  }, [selected]);

  function toggle(svcId) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(svcId)) next.delete(svcId);
      else next.add(svcId);
      return next;
    });
  }

  function commit() {
    me.services = [...selected];
    originalRef.current = new Set(selected);
    // Force a re-render so `dirty` recomputes against the fresh baseline.
    setSelected(new Set(selected));
  }

  function discard() {
    setSelected(new Set(originalRef.current));
  }

  // Register with NavGuard so leaving the page/section with unsaved toggles
  // pops the unsaved-changes modal.
  useDirtyGuard({ dirty, onSave: commit, onDiscard: discard });

  // Group by category
  const grouped = SERVICE_CATEGORIES.map(cat => ({
    cat,
    items: all.filter(s => s.category === cat.id),
  })).filter(g => g.items.length > 0);

  const activeCount = selected.size;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-5 pb-5 border-b border-line">
        <div>
          <h2 className="font-serif text-[26px] text-ink leading-tight">Services I offer</h2>
          <p className="text-[13px] text-muted mt-1">Pick which services clients can book with you. Pricing and duration are set by the salon.</p>
        </div>
        <Button variant="accent" size="sm" disabled={!dirty} onClick={commit} style={{ lineHeight: 1 }}>Save changes</Button>
      </div>

      <div className="mb-4 flex items-center gap-3 text-[12.5px]">
        <Badge tone="accent">{activeCount} active</Badge>
        <span className="text-muted">·</span>
        <span className="text-muted">{all.length - activeCount} available</span>
      </div>
      <div className="space-y-5">
        {grouped.map(g => (
          <div key={g.cat.id}>
            <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">{g.cat.name}</div>
            <div className="rounded-lg border border-line divide-y divide-line">
              {g.items.map(svc => {
                const offered = selected.has(svc.id);
                return (
                  <label
                    key={svc.id}
                    className={cx(
                      'flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-bg/50 transition',
                      !offered && 'opacity-60'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={offered}
                      onChange={() => toggle(svc.id)}
                      className="!w-4 !h-4 !p-0 !rounded accent-[#3F5D43]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-medium text-ink">{svc.name}</div>
                      <div className="text-[12px] text-muted">{svc.duration} min · ${svc.price}{svc.desc ? ` · ${svc.desc}` : ''}</div>
                    </div>
                    {offered && <Badge tone="accent"><I.Check size={10}/> Offering</Badge>}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

window.EmployeeSettings = EmployeeSettings;
