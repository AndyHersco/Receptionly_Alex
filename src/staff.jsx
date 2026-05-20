import { useEffect, useMemo, useState } from 'react';
import { fmtDateLong, fmtTime } from './closures';
import { SERVICES, STAFF, fmt12, localDayKey, parseDay } from './data';
import { I } from './icons';
import { UnsavedChangesModal, useDirtyGuard } from './nav-guard';
import { Badge, Button, Card, DateInput, EmptyState, Field, Modal, StaffAvatar, TimePicker, Toggle, cx, formatPhoneInput, isValidPhone, showToast } from './ui';

// Staff Management page — Team roster + Employee Requests

// ────────────────────────────────────────────────────────────
// Mock data — employee requests
// ────────────────────────────────────────────────────────────

export function _daysFromNow(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return localDayKey(d);
}
export function _fmtDate(key) {
  return parseDay(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
export function _fmtRange(start, end) {
  if (start === end) return _fmtDate(start);
  return `${_fmtDate(start)} – ${_fmtDate(end)}`;
}
export function _daysBetween(start, end) {
  const a = parseDay(start), b = parseDay(end);
  return Math.round((b - a) / 86400000) + 1;
}
export function _relTime(key) {
  const diff = Math.round((Date.now() - parseDay(key).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7)  return `${diff} days ago`;
  if (diff < 14) return '1 week ago';
  return `${Math.floor(diff/7)} weeks ago`;
}

export const REQUEST_TYPES = {
  time_off:        { label: 'Time off',        icon: 'Calendar', tone: 'accent' },
  early_leave:     { label: 'Leave early',     icon: 'Door',     tone: 'neutral'},
  schedule_change: { label: 'Schedule Change', icon: 'Clock',    tone: 'neutral'},
};

export const REQUEST_STATUS = {
  pending:  { label: 'Pending',  dot: '#B58300', soft: '#F5ECCF', ink: '#6B4D00' },
  approved: { label: 'Approved', dot: '#3F5D43', soft: '#EAEFE8', ink: '#2A3F2D' },
  denied:   { label: 'Denied',   dot: '#B8556A', soft: '#F5E2E6', ink: '#7A2A3D' },
};

// Action transitions for requests. Each entry maps an action id to the resulting
// status plus the confirmation copy / button styling. Pending requests can be
// approved or denied; approved requests can have their approval canceled
// (moving them to denied); denied requests can be reopened (back to pending).
export const REQUEST_ACTIONS = {
  approve:         { newStatus: 'approved', title: 'Approve this request?',     primaryLabel: 'Approve request',  primaryVariant: 'accent',    iconBg: 'bg-accentSoft text-accentInk', primaryIcon: 'check', decisionWord: 'approved' },
  deny:            { newStatus: 'denied',   title: 'Deny this request?',        primaryLabel: 'Deny request',     primaryVariant: 'danger',    iconBg: 'bg-roseSoft text-rose',         primaryIcon: 'x',     decisionWord: 'denied'   },
  cancel_approval: { newStatus: 'denied',   title: 'Cancel this approval?',     primaryLabel: 'Cancel approval',  primaryVariant: 'danger',    iconBg: 'bg-roseSoft text-rose',         primaryIcon: 'x',     decisionWord: 'denied'   },
  reopen:          { newStatus: 'pending',  title: 'Reopen this request?',      primaryLabel: 'Reopen request',   primaryVariant: 'accent',    iconBg: 'bg-amberSoft text-[#6B4D00]',   primaryIcon: 'refresh', decisionWord: 'pending' },
};

export const EMPLOYEE_REQUESTS_SEED = [
  {
    id: 'r_01', staffId: 's_sarah', type: 'time_off',
    start: _daysFromNow(11), end: _daysFromNow(14),
    requestedOn: _daysFromNow(-2),
    reason: 'Family wedding in Chicago — flights already booked. Happy to find coverage for Friday afternoon if needed.',
    paid: true, status: 'pending',
    conflicts: 6, ownerNote: '',
  },
  {
    id: 'r_04', staffId: 's_david', type: 'early_leave',
    start: _daysFromNow(2), end: _daysFromNow(2),
    leaveAt: '15:00',
    requestedOn: _daysFromNow(-1),
    reason: 'Kid\'s parent-teacher conference at 3:30. Last appointment is at 12pm so no conflict.',
    status: 'pending', conflicts: 0, ownerNote: '',
  },
  {
    id: 'r_05', staffId: 's_priya', type: 'time_off',
    start: _daysFromNow(-6), end: _daysFromNow(-6),
    requestedOn: _daysFromNow(-10),
    reason: 'Sick day — flu.',
    paid: true, status: 'approved',
    conflicts: 3, ownerNote: 'Hope you feel better — Olivia.',
  },
  {
    id: 'r_06', staffId: 's_jess', type: 'time_off',
    start: _daysFromNow(34), end: _daysFromNow(40),
    requestedOn: _daysFromNow(-4),
    reason: 'Annual vacation — visiting family in Korea. 7 days requested.',
    paid: true, status: 'approved',
    conflicts: 8, ownerNote: 'Approved — please block your calendar and add an out-of-office on the booking site.',
  },
  {
    id: 'r_07', staffId: 's_mike', type: 'time_off',
    start: _daysFromNow(-22), end: _daysFromNow(-19),
    requestedOn: _daysFromNow(-30),
    reason: 'Bachelor party in Vegas.',
    paid: false, status: 'denied',
    conflicts: 11, ownerNote: 'Too many regulars on the books that week. Try May or June instead — happy to approve.',
  },
  {
    id: 'r_08', staffId: 's_mike', type: 'schedule_change',
    date: _daysFromNow(3),
    subType: 'late',
    startTime: '11:00', endTime: '18:00',
    requestedOn: _daysFromNow(-1),
    reason: 'Dentist appointment in the morning. Can come in at 11 and work through close to make up the time.',
    status: 'pending', conflicts: 2, ownerNote: '',
  },
  {
    id: 'r_09', staffId: 's_amanda', type: 'schedule_change',
    date: _daysFromNow(-3),
    subType: 'early',
    startTime: '09:00', endTime: '14:00',
    requestedOn: _daysFromNow(-5),
    reason: 'School pickup — partner is out of town that week.',
    status: 'approved', conflicts: 1, ownerNote: 'Approved — last appt moves to Priya.',
  },
];

// ────────────────────────────────────────────────────────────
// Helpers — lunch parse/format
// ────────────────────────────────────────────────────────────

export function parseLunch(lunchStr) {
  if (!lunchStr || lunchStr === 'off' || lunchStr === 'none') {
    return { enabled: false, start: '13:00', end: '14:00' };
  }
  const m = String(lunchStr).match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
  if (m) return { enabled: true, start: m[1], end: m[2] };
  return { enabled: true, start: '13:00', end: '14:00' };
}

export function formatLunch(lunch) {
  return lunch.enabled ? `${lunch.start}–${lunch.end}` : 'none';
}

export function daySummary(hours) {
  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const on = DAYS.filter(d => Array.isArray(hours[d]));
  if (on.length === 0) return 'No working days';
  if (on.length === 7) return 'Every day';
  return on.join(' · ');
}

export function hoursRange(hours) {
  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const ranges = DAYS.map(d => hours[d]).filter(Array.isArray);
  if (ranges.length === 0) return '—';
  const starts = ranges.map(r => r[0]).sort();
  const ends = ranges.map(r => r[1]).sort();
  const s = starts[0], e = ends[ends.length - 1];
  if (starts[0] === starts[starts.length - 1] && ends[0] === ends[ends.length - 1]) {
    return `${fmt12(s)} – ${fmt12(e)}`;
  }
  return `${fmt12(s)} – ${fmt12(e)}`;
}

// ────────────────────────────────────────────────────────────
// Page shell — tabs between Team roster and Requests
// ────────────────────────────────────────────────────────────

export function StaffPage() {
  const [tab, setTab] = useState('team');
  const [requests, setRequests] = useState(EMPLOYEE_REQUESTS_SEED);
  const [staffList, setStaffList] = useState(STAFF);
  const [adding, setAdding] = useState(false);

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 mb-1">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-medium mb-2">Team</div>
          <h1 className="font-serif text-[40px] leading-[1.05] text-ink">Staff</h1>
          <p className="text-[14px] text-ink2 mt-1.5 max-w-2xl">
            {tab === 'team'
              ? 'Manage your team — schedules, services, and time off.'
              : 'Review time off and leave-early requests from your team.'}
          </p>
        </div>
        {tab === 'team' && (
          <Button variant="accent" onClick={() => setAdding(true)}>
            <I.Plus size={14}/> Add team member
          </Button>
        )}
      </div>

      {/* Tab strip */}
      <div className="flex items-center gap-1 border-b border-line">
        <StaffTab active={tab==='team'}     onClick={() => setTab('team')}>Team</StaffTab>
        <StaffTab active={tab==='requests'} onClick={() => setTab('requests')}>
          Employee Requests
          {pendingCount > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full bg-amberSoft text-[11px] font-semibold" style={{ color: '#6B4D00' }}>
              {pendingCount}
            </span>
          )}
        </StaffTab>
      </div>

      {tab === 'team'
        ? <TeamView staffList={staffList} setStaffList={setStaffList} adding={adding} setAdding={setAdding}/>
        : <RequestsView requests={requests} setRequests={setRequests} />}
    </div>
  );
}

export function StaffTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'inline-flex items-center gap-1 px-1 pb-3 -mb-px text-[14px] font-medium transition border-b-2 mr-5',
        active ? 'text-ink border-ink' : 'text-ink2 hover:text-ink border-transparent'
      )}>
      {children}
    </button>
  );
}

// ────────────────────────────────────────────────────────────
// Team view — grid of staff cards, click to edit
// ────────────────────────────────────────────────────────────

export function TeamView({ staffList, setStaffList, adding, setAdding }) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null); // staff object pending remove

  const filtered = staffList.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  function handleSaveEdit(updated) {
    setStaffList(prev => prev.map(s => s.id === updated.id ? updated : s));
    setEditingId(null);
  }

  function handleAdd(newStaff) {
    setStaffList(prev => [...prev, newStaff]);
    setAdding(false);
  }

  function performRemove(id) {
    const target = staffList.find(s => s.id === id);
    setStaffList(prev => prev.filter(s => s.id !== id));
    setEditingId(null);
    setConfirmRemove(null);
    if (target) showToast({ title: 'Team member removed', body: `${target.name} was removed from your team.` });
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <I.Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search staff" className="!pl-9" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No matches"
          body={`No team members match "${search}".`}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(s => (
            <StaffCard key={s.id} staff={s} onClick={() => setEditingId(s.id)} />
          ))}
        </div>
      )}

      {editingId && (
        <StaffModal
          mode="edit"
          initial={staffList.find(s => s.id === editingId)}
          onClose={() => setEditingId(null)}
          onSave={handleSaveEdit}
          onRemove={() => setConfirmRemove(staffList.find(s => s.id === editingId))}
        />
      )}
      {adding && (
        <StaffModal
          mode="add"
          onClose={() => setAdding(false)}
          onSave={handleAdd}
        />
      )}
      {confirmRemove && (
        <RemoveStaffModal
          staff={confirmRemove}
          onConfirm={() => performRemove(confirmRemove.id)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}

export function StaffCard({ staff, onClick }) {
  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const workCount = DAYS.filter(d => Array.isArray(staff.hours[d])).length;

  return (
    <button
      onClick={onClick}
      className="text-left bg-surface rounded-xl2 border border-line shadow-card p-4 hover:border-line2 hover:shadow-pop transition flex items-center gap-4 group">
      <StaffAvatar staff={staff} size={48} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-ink truncate text-[15px]">{staff.name}</span>
          <span className="text-[12.5px] text-ink2 truncate">{staff.role}</span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5"><I.Calendar size={11}/><span>{workCount} days/week · {hoursRange(staff.hours)}</span></span>
        </div>
        {staff.daysOff && staff.daysOff.length > 0 && (
          <div className="flex items-center gap-3 mt-0.5 text-[12px] text-muted">
            <span className="inline-flex items-center gap-1.5"><I.Door size={11}/><span>{staff.daysOff.length} day{staff.daysOff.length === 1 ? '' : 's'} off</span></span>
          </div>
        )}
      </div>
      <I.ChevronRight size={16} className="text-muted opacity-0 group-hover:opacity-100 transition shrink-0"/>
    </button>
  );
}

// ────────────────────────────────────────────────────────────
// Staff modal — Edit / Add
// ────────────────────────────────────────────────────────────

export function StaffModal({ mode, initial, onClose, onSave, onRemove }) {
  const isEdit = mode === 'edit';

  const initialValues = useMemo(() => {
    if (isEdit) {
      return {
        name: initial.name,
        role: initial.role,
        phone: initial.phone || '',
        lunch: parseLunch(initial.lunch),
        hours: { ...initial.hours },
        services: [...initial.services],
        daysOff: initial.daysOff ? initial.daysOff.map(d => ({ ...d })) : [],
      };
    }
    return {
      name: '',
      role: '',
      phone: '',
      lunch: { enabled: true, start: '13:00', end: '14:00' },
      hours: {
        Mon:['09:00','17:00'], Tue:['09:00','17:00'], Wed:['09:00','17:00'],
        Thu:['09:00','17:00'], Fri:['09:00','17:00'], Sat:'off', Sun:'off'
      },
      services: [],
      daysOff: [],
    };
  }, []);

  const [values, setValues] = useState(initialValues);
  const [confirmClose, setConfirmClose] = useState(false);

  // Normalize for dirty comparison (services order shouldn't matter)
  const normalize = (v) => JSON.stringify({
    ...v,
    services: [...v.services].sort(),
    daysOff: v.daysOff.map(d => ({ date: d.date, endDate: d.endDate || '', fullDay: d.fullDay, start: d.start, end: d.end, note: d.note })),
  });

  const dirty = useMemo(
    () => normalize(values) !== normalize(initialValues),
    [values, initialValues]
  );

  const canAdd =
    values.name.trim().length > 0 &&
    values.role.trim().length > 0 &&
    isValidPhone(values.phone);
  // For Add: "has info" means the user has entered something we'd lose
  const hasInfo = canAdd || values.services.length > 0 || values.daysOff.length > 0 || values.phone.length > 0 || values.name.length > 0 || values.role.length > 0;

  const primaryEnabled = isEdit ? dirty : canAdd;
  const shouldGuard = isEdit ? dirty : hasInfo;

  const patch = (p) => setValues(v => ({ ...v, ...p }));

  function handleSave() {
    if (!primaryEnabled) return;
    if (isEdit) {
      onSave({
        ...initial,
        name: values.name.trim(),
        role: values.role.trim(),
        phone: values.phone,
        lunch: formatLunch(values.lunch),
        hours: values.hours,
        services: values.services,
        daysOff: values.daysOff,
      });
    } else {
      const initials = values.name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
      const palette = ['#3F5D43','#C97A4F','#B8556A','#7A4A8F','#4A6B8A','#A48230','#3D7A6E'];
      const color = palette[Math.floor(Math.random() * palette.length)];
      onSave({
        id: 's_' + Math.random().toString(36).slice(2, 8),
        initials, color, active: true, bookingBuffer: 10,
        name: values.name.trim(),
        role: values.role.trim(),
        phone: values.phone,
        lunch: formatLunch(values.lunch),
        hours: values.hours,
        services: values.services,
        daysOff: values.daysOff,
      });
    }
  }

  function requestClose() {
    if (shouldGuard) setConfirmClose(true);
    else onClose();
  }

  // Route/sidebar guard while modal open
  useDirtyGuard({
    dirty: shouldGuard,
    onSave: () => handleSave(),
    onDiscard: () => {},
    hideSave: !isEdit, // Add flow: no "Save & leave"
  });

  return (
    <Modal open onClose={requestClose} maxWidth="max-w-2xl">
      <div className="p-6 border-b border-line flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-[26px] leading-tight text-ink">
            {isEdit ? `Edit ${initial.name}` : 'Add team member'}
          </h2>
          {!isEdit && (
            <p className="text-[13px] text-ink2 mt-1">Set up their schedule, services, and any planned days off.</p>
          )}
        </div>
        <button onClick={requestClose} aria-label="Close" className="text-ink2 hover:text-ink p-1.5 -m-1.5"><I.X/></button>
      </div>

      <div className="p-6 space-y-6">
        {/* Name + Role */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name">
            <input
              value={values.name}
              onChange={e => patch({ name: e.target.value })}
              placeholder="e.g. Amanda Lee"
              autoFocus={!isEdit}
            />
          </Field>
          <Field label="Role" plain>
            <input
              value={values.role}
              onChange={e => patch({ role: e.target.value })}
              placeholder="e.g. Esthetician"
            />
          </Field>
          <Field
            label="Phone"
            error={
              values.phone.length > 0 && !isValidPhone(values.phone)
                ? 'Enter a 10-digit phone number'
                : undefined
            }
          >
            <input
              type="tel"
              inputMode="tel"
              value={values.phone}
              onChange={e => patch({ phone: formatPhoneInput(e.target.value) })}
              placeholder="(415) 555-0100"
            />
          </Field>
        </div>

        {/* Lunch break */}
        <LunchBreakEditor value={values.lunch} onChange={v => patch({ lunch: v })} />

        {/* Weekly schedule */}
        <WeeklyScheduleEditor hours={values.hours} onChange={h => patch({ hours: h })} />

        {/* Services performed */}
        <ServicesPicker selected={values.services} onChange={s => patch({ services: s })} />

        {/* Days off */}
        <DaysOffEditor days={values.daysOff} onChange={d => patch({ daysOff: d })} />
      </div>

      <div className="px-6 py-4 bg-bg/60 border-t border-line flex items-center justify-between gap-2 sticky bottom-0">
        <div>
          {isEdit && onRemove && (
            <button
              onClick={onRemove}
              className="text-[12.5px] text-muted hover:text-rose font-medium inline-flex items-center gap-1 transition">
              <I.Trash size={13}/> Remove team member
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={requestClose}>Cancel</Button>
          <Button
            variant="accent"
            disabled={!primaryEnabled}
            onClick={handleSave}>
            {isEdit ? 'Save changes' : 'Add team member'}
          </Button>
        </div>
      </div>

      <UnsavedChangesModal
        open={confirmClose}
        hideSave={!isEdit}
        onSave={() => { handleSave(); setConfirmClose(false); onClose(); }}
        onDiscard={() => { setConfirmClose(false); onClose(); }}
        onStay={() => setConfirmClose(false)}
      />
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────
// Lunch break editor
// ────────────────────────────────────────────────────────────

export function LunchBreakEditor({ value, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12.5px] font-medium text-ink">Lunch break</span>
        <Toggle
          checked={value.enabled}
          onChange={(v) => onChange({ ...value, enabled: v })}
          label={value.enabled ? 'On' : 'Off'}
        />
      </div>
      {value.enabled ? (
        <div className="flex items-center gap-2 max-w-sm">
          <div className="flex-1">
            <TimePicker value={value.start} onChange={v => onChange({ ...value, start: v })} size="sm" />
          </div>
          <span className="text-muted">–</span>
          <div className="flex-1">
            <TimePicker value={value.end} onChange={v => onChange({ ...value, end: v })} size="sm" />
          </div>
        </div>
      ) : (
        <div className="text-[13px] text-muted italic">No lunch break</div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Weekly schedule editor
// ────────────────────────────────────────────────────────────

export function WeeklyScheduleEditor({ hours, onChange }) {
  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  function setDay(d, val) {
    onChange({ ...hours, [d]: val });
  }

  return (
    <div>
      <div className="text-[12.5px] font-medium text-ink mb-2">Weekly schedule</div>
      <div className="rounded-lg border border-line divide-y divide-line">
        {DAYS.map(d => {
          const h = hours[d];
          const isOn = Array.isArray(h);
          return (
            <div key={d} className="flex items-center gap-3 px-3 py-2">
              <div className="flex items-center gap-2.5 w-[88px] shrink-0">
                <Toggle
                  checked={isOn}
                  onChange={(v) => setDay(d, v ? ['10:00','18:00'] : 'off')}
                />
                <span className="text-[13px] font-medium text-ink2">{d}</span>
              </div>
              {isOn ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-[130px] shrink-0">
                    <TimePicker value={h[0]} onChange={v => setDay(d, [v, h[1]])} size="sm" />
                  </div>
                  <span className="text-muted">–</span>
                  <div className="w-[130px] shrink-0">
                    <TimePicker value={h[1]} onChange={v => setDay(d, [h[0], v])} size="sm" />
                  </div>
                </div>
              ) : (
                <span className="text-[13px] text-muted italic">Day off</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Services picker
// ────────────────────────────────────────────────────────────

export function ServicesPicker({ selected, onChange }) {
  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[12.5px] font-medium text-ink">Services performed</span>
        <span className="text-[11.5px] text-muted">{selected.length} selected</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-[220px] overflow-auto border border-line rounded-lg p-1.5 bg-bg/30">
        {SERVICES.map(svc => {
          const on = selected.includes(svc.id);
          return (
            <button
              key={svc.id}
              type="button"
              onClick={() => toggle(svc.id)}
              className={cx(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition border',
                on
                  ? 'bg-accentSoft/70 border-accent/30'
                  : 'bg-white border-line2 hover:border-ink2/30'
              )}>
              <span className={cx(
                'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
                on ? 'bg-accent border-accent' : 'bg-white border-line2'
              )}>
                {on && <I.Check size={10} stroke={3} className="text-white"/>}
              </span>
              <span className="text-[13px] text-ink truncate">{svc.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Days off editor
// ────────────────────────────────────────────────────────────

export function DaysOffEditor({ days, onChange }) {
  const [editingId, setEditingId] = useState(null);

  function add() {
    const id = 'd_' + Math.random().toString(36).slice(2, 9);
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    onChange([...days, { id, date: iso, endDate: '', fullDay: true, start: '10:00', end: '14:00', note: '' }]);
    setEditingId(id);
  }

  function update(id, p) {
    onChange(days.map(d => d.id === id ? { ...d, ...p } : d));
  }

  function remove(id) {
    onChange(days.filter(d => d.id !== id));
    if (editingId === id) setEditingId(null);
  }

  const sorted = [...days].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[12.5px] font-medium text-ink">
          Days off <span className="text-muted font-normal">(optional)</span>
        </span>
        <span className="text-[11.5px] text-muted">
          {days.length} {days.length === 1 ? 'day' : 'days'}
        </span>
      </div>
      <p className="text-[12px] text-muted mb-2.5">
        Block dates when this person is unavailable — vacation, appointments, training.
      </p>

      {sorted.length > 0 && (
        <div className="rounded-lg border border-line divide-y divide-line mb-2 overflow-hidden">
          {sorted.map(d => editingId === d.id ? (
            <DayOffEditRow
              key={d.id}
              day={d}
              onSave={(p) => { update(d.id, p); setEditingId(null); }}
              onCancel={() => { if (!d.date) remove(d.id); else setEditingId(null); }}
              onRemove={() => remove(d.id)}
            />
          ) : (
            <div key={d.id} className="flex items-center gap-3 px-3 py-2.5 group">
              <div className="w-9 h-9 rounded-lg bg-warmSoft/70 text-[#7A3F1F] flex flex-col items-center justify-center flex-shrink-0 leading-none">
                <span className="text-[8.5px] uppercase font-medium tracking-wider opacity-80">
                  {fmtDateLong(d.date).split(',')[1]?.trim().split(' ')[0]}
                </span>
                <span className="text-[14px] font-semibold mt-0.5">
                  {d.date ? Number(d.date.split('-')[2]) : '?'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-medium text-ink truncate">
                  {d.endDate && d.endDate !== d.date
                    ? <>{_fmtDate(d.date)} <span className="text-muted">→</span> {_fmtDate(d.endDate)}</>
                    : fmtDateLong(d.date)}
                </div>
                <div className="text-[12px] text-muted truncate">
                  {d.endDate && d.endDate !== d.date
                    ? `${_daysBetween(d.date, d.endDate)} days off`
                    : d.fullDay ? 'Off all day' : `Off ${fmtTime(d.start)}–${fmtTime(d.end)}`}
                  {d.note ? ` · ${d.note}` : ''}
                </div>
              </div>
              <button
                onClick={() => setEditingId(d.id)}
                className="p-1.5 text-muted hover:text-ink opacity-0 group-hover:opacity-100 transition"
                title="Edit"><I.Edit size={14}/></button>
              <button
                onClick={() => remove(d.id)}
                className="p-1.5 text-muted hover:text-rose opacity-0 group-hover:opacity-100 transition"
                title="Remove"><I.Trash size={14}/></button>
            </div>
          ))}
        </div>
      )}

      <Button variant="secondary" size="sm" onClick={add}>
        <I.Plus size={13}/> Add day off
      </Button>
    </div>
  );
}

export function DayOffEditRow({ day, onSave, onCancel, onRemove }) {
  const [mode, setMode] = useState(day.endDate && day.endDate !== day.date ? 'range' : 'single');
  const [date, setDate] = useState(day.date || '');
  const [endDate, setEndDate] = useState(day.endDate || '');
  const [fullDay, setFullDay] = useState(day.fullDay !== false);
  const [start, setStart] = useState(day.start || '10:00');
  const [end, setEnd] = useState(day.end || '14:00');
  const [note, setNote] = useState(day.note || '');
  const [err, setErr] = useState('');

  function save() {
    if (!date) { setErr('Pick a start date'); return; }
    if (mode === 'range') {
      if (!endDate) { setErr('Pick an end date'); return; }
      if (endDate < date) { setErr('End date must be after the start date'); return; }
      onSave({ date, endDate: endDate === date ? '' : endDate, fullDay: true, start, end, note: note.trim() });
    } else {
      onSave({ date, endDate: '', fullDay, start, end, note: note.trim() });
    }
  }

  const rangeDays = mode === 'range' && date && endDate && endDate >= date
    ? _daysBetween(date, endDate)
    : null;

  return (
    <div className="p-3 bg-bg/40">
      {/* Single / Range toggle */}
      <div className="mb-2.5">
        <label className="block text-[11px] uppercase tracking-wider text-muted font-medium mb-1">When</label>
        <div className="flex gap-1.5 h-10 max-w-xs">
          <button
            type="button"
            onClick={() => { setMode('single'); setErr(''); }}
            className={cx(
              'flex-1 rounded-lg border text-[12.5px] font-medium transition px-2',
              mode === 'single'
                ? 'border-accent bg-accentSoft/60 text-accentInk'
                : 'border-line2 text-ink2 hover:bg-bg/60 bg-white'
            )}>
            Single day
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('range');
              setErr('');
              if (!endDate && date) {
                // default end date = 1 day after start
                const [y, m, d] = date.split('-').map(Number);
                const dt = new Date(y, m - 1, d + 1);
                setEndDate(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`);
              }
            }}
            className={cx(
              'flex-1 rounded-lg border text-[12.5px] font-medium transition px-2',
              mode === 'range'
                ? 'border-accent bg-accentSoft/60 text-accentInk'
                : 'border-line2 text-ink2 hover:bg-bg/60 bg-white'
            )}>
            Date range
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-2.5">
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-muted font-medium mb-1">
            {mode === 'range' ? 'From' : 'Date'}
          </label>
          <DateInput
            value={date}
            onChange={v => { setDate(v); setErr(''); }}
          />
        </div>
        {mode === 'range' ? (
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-muted font-medium mb-1">To</label>
            <DateInput
              value={endDate}
              min={date || undefined}
              onChange={v => { setEndDate(v); setErr(''); }}
            />
          </div>
        ) : (
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-muted font-medium mb-1">Length</label>
            <div className="flex gap-1.5 h-10">
              <button
                type="button"
                onClick={() => setFullDay(true)}
                className={cx(
                  'flex-1 rounded-lg border text-[12.5px] font-medium transition px-2',
                  fullDay
                    ? 'border-accent bg-accentSoft/60 text-accentInk'
                    : 'border-line2 text-ink2 hover:bg-bg/60 bg-white'
                )}>
                Full day
              </button>
              <button
                type="button"
                onClick={() => setFullDay(false)}
                className={cx(
                  'flex-1 rounded-lg border text-[12.5px] font-medium transition px-2',
                  !fullDay
                    ? 'border-accent bg-accentSoft/60 text-accentInk'
                    : 'border-line2 text-ink2 hover:bg-bg/60 bg-white'
                )}>
                Custom hours
              </button>
            </div>
          </div>
        )}
      </div>

      {mode === 'range' && rangeDays !== null && (
        <div className="-mt-1 mb-2.5 text-[12px] text-muted">
          {rangeDays} consecutive {rangeDays === 1 ? 'day' : 'days'} off
        </div>
      )}

      {mode === 'single' && !fullDay && (
        <div className="grid grid-cols-2 gap-2 mb-2.5 max-w-xs">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-muted font-medium mb-1">From</label>
            <TimePicker value={start} onChange={setStart} size="sm" />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-muted font-medium mb-1">To</label>
            <TimePicker value={end} onChange={setEnd} size="sm" />
          </div>
        </div>
      )}

      <div className="mb-2.5">
        <label className="block text-[11px] uppercase tracking-wider text-muted font-medium mb-1">
          Note <span className="text-muted normal-case tracking-normal">(optional)</span>
        </label>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="e.g. Vacation, dentist, training"
        />
      </div>

      {err && <div className="text-[12px] text-rose mb-2 font-medium">{err}</div>}

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onRemove}
          className="text-[12.5px] text-muted hover:text-rose font-medium inline-flex items-center gap-1">
          <I.Trash size={13}/> Remove
        </button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="accent" size="sm" onClick={save}><I.Check size={13}/> Done</Button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Requests view
// ────────────────────────────────────────────────────────────

export function RequestsView({ requests, setRequests }) {
  const [filter, setFilter] = useState('pending');
  const [staffFilter, setStaffFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);

  const counts = useMemo(() => ({
    all: requests.length,
    pending:  requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    denied:   requests.filter(r => r.status === 'denied').length,
  }), [requests]);

  const filtered = useMemo(() => {
    return requests
      .filter(r => filter === 'all' ? true : r.status === filter)
      .filter(r => staffFilter === 'all' ? true : r.staffId === staffFilter)
      .sort((a, b) => {
        if (a.status !== b.status) {
          const order = { pending: 0, approved: 1, denied: 2 };
          return order[a.status] - order[b.status];
        }
        return b.requestedOn.localeCompare(a.requestedOn);
      });
  }, [requests, filter, staffFilter]);

  function applyAction(id, action, note) {
    const cfg = REQUEST_ACTIONS[action];
    if (!cfg) return;
    setRequests(prev => prev.map(r =>
      r.id === id ? { ...r, status: cfg.newStatus, ownerNote: note ?? r.ownerNote } : r
    ));
    setPendingAction(null);
    setOpenId(null);
  }

  const openRequest = openId ? requests.find(r => r.id === openId) : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <SummaryTile label="Pending review"      value={counts.pending}  status="pending"  active={filter==='pending'}  onClick={() => setFilter('pending')} />
        <SummaryTile label="Approved this month" value={counts.approved} status="approved" active={filter==='approved'} onClick={() => setFilter('approved')} />
        <SummaryTile label="Denied this month"   value={counts.denied}   status="denied"   active={filter==='denied'}   onClick={() => setFilter('denied')} />
      </div>

      <Card className="p-3 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-1">
          {['all','pending','approved','denied'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cx(
                'h-8 px-3 rounded-md text-[13px] font-medium capitalize transition',
                filter === f ? 'bg-ink text-white' : 'text-ink2 hover:text-ink hover:bg-line/60'
              )}>
              {f === 'all' ? 'All' : REQUEST_STATUS[f].label}
              <span className={cx('ml-1.5 text-[11.5px]', filter === f ? 'text-white/70' : 'text-muted')}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted">Staff</span>
          <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)} className="!h-9 !w-auto !pr-8 !text-[13px]">
            <option value="all">All staff</option>
            {STAFF.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body={filter === 'pending'
            ? "You're all caught up — no pending requests from the team."
            : `No ${filter} requests${staffFilter !== 'all' ? ' from this staff member' : ''}.`}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <RequestCard
              key={r.id}
              request={r}
              onOpen={() => setOpenId(r.id)}
              onApprove={() => setPendingAction({ id: r.id, action: 'approve', note: r.ownerNote || '' })}
              onDeny={() => setPendingAction({ id: r.id, action: 'deny', note: r.ownerNote || '' })}
              onCancelApproval={() => setPendingAction({ id: r.id, action: 'cancel_approval', note: r.ownerNote || '' })}
              onReopen={() => setPendingAction({ id: r.id, action: 'reopen', note: r.ownerNote || '' })}
            />
          ))}
        </div>
      )}

      {openRequest && (
        <RequestDetailModal
          request={openRequest}
          onClose={() => setOpenId(null)}
          onSaveNote={(note) => setRequests(prev => prev.map(x => x.id === openRequest.id ? { ...x, ownerNote: note } : x))}
          onAction={(action, note) => setPendingAction({ id: openRequest.id, action, note })}
        />
      )}

      <ConfirmActionModal
        pending={pendingAction}
        requests={requests}
        onClose={() => setPendingAction(null)}
        onConfirm={(id, action, note) => applyAction(id, action, note)}
      />
    </div>
  );
}

export function SummaryTile({ label, value, status, active, onClick }) {
  const s = REQUEST_STATUS[status];
  return (
    <button
      onClick={onClick}
      className={cx(
        'text-left rounded-xl2 border bg-surface shadow-card p-4 transition',
        active ? 'border-ink' : 'border-line hover:border-line2'
      )}>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full" style={{ background: s.dot }} />
        <span className="text-[12px] uppercase tracking-[0.1em] text-muted font-medium">{label}</span>
      </div>
      <div className="font-serif text-[32px] leading-none text-ink">{value}</div>
    </button>
  );
}

export function RequestCard({ request, onOpen, onApprove, onDeny, onCancelApproval, onReopen }) {
  const staff = STAFF.find(s => s.id === request.staffId);
  const type = REQUEST_TYPES[request.type];
  const status = REQUEST_STATUS[request.status];
  const isPending = request.status === 'pending';
  const isApproved = request.status === 'approved';
  const isDenied = request.status === 'denied';

  return (
    <Card className="p-5 hover:border-line2 transition">
      <div className="flex items-start gap-4">
        <StaffAvatar staff={staff} size={44} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1.5 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-ink text-[15px]">{staff.name}</span>
                <span className="text-[12.5px] text-muted">·</span>
                <span className="text-[12.5px] text-ink2">{staff.role}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge tone={type.tone} className="whitespace-nowrap">{type.label}</Badge>
                <span className="text-[13px] text-ink2">{requestHeadline(request)}</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11.5px] font-medium shrink-0" style={{ background: status.soft, color: status.ink }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.dot }} />
              {status.label}
            </span>
          </div>

          {request.reason && (
            <p className="text-[13.5px] text-ink2 leading-relaxed mt-2 line-clamp-2">"{request.reason}"</p>
          )}

          <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
            <div className="flex items-center gap-3 text-[12px] text-muted">
              <span>Requested {_relTime(request.requestedOn)}</span>
              {request.conflicts > 0 && isPending && (
                <span className="inline-flex items-center gap-1 text-[#7A2A3D]">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose" />
                  {request.conflicts} appt{request.conflicts === 1 ? '' : 's'} during this period
                </span>
              )}
              {request.ownerNote && !isPending && (
                <span className="inline-flex items-center gap-1 text-ink2">
                  <I.Edit size={11}/> Note added
                </span>
              )}
            </div>
            {isPending && (
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <Button variant="secondary" size="sm" onClick={onDeny}>Deny</Button>
                <Button variant="accent" size="sm" onClick={onApprove}><I.Check size={13}/> Approve</Button>
              </div>
            )}
            {isApproved && (
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <Button variant="secondary" size="sm" onClick={onCancelApproval}>Cancel approval</Button>
              </div>
            )}
            {isDenied && (
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <Button variant="secondary" size="sm" onClick={onReopen}><I.Refresh size={13}/> Reopen request</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function requestHeadline(r) {
  if (r.type === 'time_off')        return `${_fmtRange(r.start, r.end)} · ${_daysBetween(r.start, r.end)} day${_daysBetween(r.start, r.end) === 1 ? '' : 's'}`;
  if (r.type === 'schedule_change') return `${_fmtDate(r.date)} · ${fmt12(r.startTime)} – ${fmt12(r.endTime)}`;
  if (r.type === 'early_leave')     return `${_fmtDate(r.start)} · leave at ${fmt12(r.leaveAt)}`;
  return '';
}

export function RequestDetailModal({ request, onClose, onSaveNote, onAction }) {
  const staff = STAFF.find(s => s.id === request.staffId);
  const type  = REQUEST_TYPES[request.type];
  const status = REQUEST_STATUS[request.status];
  const isPending = request.status === 'pending';

  const initialNote = request.ownerNote || '';
  const [note, setNote] = useState(initialNote);
  const dirty = note !== initialNote;
  const [confirmClose, setConfirmClose] = useState(false);

  function requestClose() {
    if (dirty) setConfirmClose(true);
    else onClose();
  }

  function saveNote() {
    onSaveNote(note);
  }

  useDirtyGuard({
    dirty,
    onSave: () => saveNote(),
    onDiscard: () => {},
  });

  return (
    <Modal open onClose={requestClose} maxWidth="max-w-xl">
      <div className="p-6 border-b border-line flex items-start justify-between gap-3">
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <StaffAvatar staff={staff} size={48} />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-medium mb-1">{type.label}</div>
            <div className="font-serif text-[26px] leading-tight text-ink">{staff.name}</div>
            <div className="text-[13px] text-ink2 mt-0.5">{staff.role}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium" style={{ background: status.soft, color: status.ink }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.dot }} />
            {status.label}
          </span>
          <button onClick={requestClose} className="text-ink2 hover:text-ink p-1.5 -m-1.5"><I.X /></button>
        </div>
      </div>

      <div className="p-6 space-y-5">
        <RequestBody request={request} />

        {request.reason && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-1.5">Reason</div>
            <p className="text-[13.5px] text-ink2 leading-relaxed bg-bg/70 border border-line rounded-lg p-3">"{request.reason}"</p>
          </div>
        )}

        {request.conflicts > 0 && isPending && (
          <div className="rounded-lg bg-roseSoft/60 border border-rose/20 p-3 flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-rose/15 text-rose flex items-center justify-center flex-shrink-0 mt-0.5">
              <I.Bell size={13}/>
            </div>
            <div className="text-[13px] text-ink2 leading-relaxed">
              <span className="font-medium text-ink">{request.conflicts} appointment{request.conflicts === 1 ? '' : 's'} booked</span> during this period.
              Approving will require rescheduling or reassigning them to another staff member.
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12.5px] font-medium text-ink">Note for {staff.name.split(' ')[0]} <span className="text-muted font-normal">(optional)</span></span>
            {dirty && <span className="text-[11.5px] font-medium" style={{color:'#6B4D00'}}>Unsaved changes</span>}
          </div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="They'll see this with the decision. Helpful for coverage details or reasons for denial."
            rows={3}
            style={{ minHeight: '80px' }}
          />
        </div>
      </div>

      <div className="px-6 py-4 bg-bg/60 border-t border-line flex flex-wrap items-center gap-2 justify-between">
        <div className="text-[12px] text-muted">
          Requested {_relTime(request.requestedOn)}
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <Button variant="secondary" size="sm" onClick={saveNote}>Save changes</Button>
          )}
          {isPending ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => onAction('deny', note)}>Deny</Button>
              <Button variant="accent" size="sm" onClick={() => onAction('approve', note)}><I.Check size={13}/> Approve</Button>
            </>
          ) : request.status === 'approved' ? (
            <>
              <Button variant="ghost" size="sm" onClick={requestClose}>Close</Button>
              <Button variant="secondary" size="sm" onClick={() => onAction('cancel_approval', note)}>Cancel approval</Button>
            </>
          ) : request.status === 'denied' ? (
            <>
              <Button variant="ghost" size="sm" onClick={requestClose}>Close</Button>
              <Button variant="secondary" size="sm" onClick={() => onAction('reopen', note)}><I.Refresh size={13}/> Reopen request</Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={requestClose}>Close</Button>
          )}
        </div>
      </div>

      <UnsavedChangesModal
        open={confirmClose}
        onSave={() => { saveNote(); setConfirmClose(false); onClose(); }}
        onDiscard={() => { setConfirmClose(false); onClose(); }}
        onStay={() => setConfirmClose(false)}
      />
    </Modal>
  );
}

export function RequestBody({ request }) {
  if (request.type === 'time_off') {
    const days = _daysBetween(request.start, request.end);
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-line p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted mb-1">Dates</div>
          <div className="font-medium text-ink">{_fmtRange(request.start, request.end)}</div>
          <div className="text-[12.5px] text-ink2 mt-0.5">{days} day{days === 1 ? '' : 's'} · {request.paid ? 'Paid' : 'Unpaid'}</div>
        </div>
        <div className="rounded-lg border border-line p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted mb-1">Coverage impact</div>
          <div className="font-medium text-ink">{request.conflicts} appointment{request.conflicts === 1 ? '' : 's'}</div>
          <div className="text-[12.5px] text-ink2 mt-0.5">{request.conflicts === 0 ? 'No conflicts' : 'Will need rebooking'}</div>
        </div>
      </div>
    );
  }
  if (request.type === 'early_leave') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-line p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted mb-1">Date</div>
          <div className="font-medium text-ink">{_fmtDate(request.start)}</div>
        </div>
        <div className="rounded-lg border border-line p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted mb-1">Leaving at</div>
          <div className="font-medium text-ink">{fmt12(request.leaveAt)}</div>
        </div>
      </div>
    );
  }
  if (request.type === 'schedule_change') {
    const subLabel = {
      late:   'Coming in late',
      early:  'Leaving early',
      custom: 'Custom schedule adjustment',
      other:  'Other',
    }[request.subType] || 'Adjustment';
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-line p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted mb-1">Date</div>
          <div className="font-medium text-ink">{_fmtDate(request.date)}</div>
          <div className="text-[12.5px] text-ink2 mt-0.5">{subLabel}</div>
        </div>
        <div className="rounded-lg border border-line p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted mb-1">Requested hours</div>
          <div className="font-medium text-ink">{fmt12(request.startTime)} – {fmt12(request.endTime)}</div>
          <div className="text-[12.5px] text-ink2 mt-0.5">{request.conflicts === 0 ? 'No conflicts' : `${request.conflicts} appt${request.conflicts === 1 ? '' : 's'} affected`}</div>
        </div>
      </div>
    );
  }
  return null;
}

export function ConfirmActionModal({ pending, requests, onClose, onConfirm }) {
  if (!pending) return null;
  const request = requests.find(r => r.id === pending.id);
  if (!request) return null;
  const staff = STAFF.find(s => s.id === request.staffId);
  const type = REQUEST_TYPES[request.type];
  const cfg = REQUEST_ACTIONS[pending.action];
  if (!cfg) return null;
  const isApprove = pending.action === 'approve';
  const isCancelApproval = pending.action === 'cancel_approval';
  const isReopen = pending.action === 'reopen';

  const heroIcon = cfg.primaryIcon === 'check'   ? <I.Check size={16}/>
                 : cfg.primaryIcon === 'refresh' ? <I.Refresh size={16}/>
                 : <I.X size={16}/>;
  const btnIcon  = cfg.primaryIcon === 'check'   ? <I.Check size={13}/>
                 : cfg.primaryIcon === 'refresh' ? <I.Refresh size={13}/>
                 : null;

  // Per-action sentence — keeps the same structure so the modal feels consistent.
  let bodyTail;
  if (isReopen) {
    bodyTail = <>will move back to <span className="font-medium text-ink">pending</span> for review.</>;
  } else if (isCancelApproval) {
    bodyTail = <>will be moved from <span className="font-medium text-ink">approved</span> to <span className="font-medium text-ink">denied</span>.</>;
  } else {
    bodyTail = <>will be marked <span className="font-medium text-ink">{cfg.decisionWord}</span>.</>;
  }

  return (
    <Modal open onClose={onClose} maxWidth="max-w-md">
      <div className="p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className={cx(
            'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
            cfg.iconBg
          )}>
            {heroIcon}
          </div>
          <div>
            <h3 className="font-serif text-[22px] text-ink leading-tight">{cfg.title}</h3>
            <p className="text-[13.5px] text-ink2 mt-1.5 leading-relaxed">
              <span className="font-medium text-ink">{staff.name}</span>'s {type.label.toLowerCase()} request
              {request.type === 'time_off' && <> for <span className="font-medium text-ink">{_fmtRange(request.start, request.end)}</span></>}
              {request.type === 'early_leave' && <> on <span className="font-medium text-ink">{_fmtDate(request.start)}</span></>}
              {request.type === 'schedule_change' && <> on <span className="font-medium text-ink">{_fmtDate(request.date)}</span></>}
              {' '}{bodyTail}
            </p>
            {isApprove && request.conflicts > 0 && (
              <p className="text-[12.5px] text-ink2 mt-2 leading-relaxed">
                You'll still need to reschedule the <span className="font-medium text-ink">{request.conflicts} booked appointment{request.conflicts === 1 ? '' : 's'}</span> during this period.
              </p>
            )}
            {(pending.action === 'deny' || isCancelApproval) && (
              <p className="text-[12.5px] text-ink2 mt-2 leading-relaxed">
                {staff.name.split(' ')[0]} will see your note with the decision.
              </p>
            )}
            {isReopen && (
              <p className="text-[12.5px] text-ink2 mt-2 leading-relaxed">
                You can approve or deny it again from the pending list.
              </p>
            )}
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={cfg.primaryVariant} onClick={() => onConfirm(pending.id, pending.action, pending.note)}>
            {btnIcon}{cfg.primaryLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

window.StaffPage = StaffPage;

// ────────────────────────────────────────────────────────────
// Destructive confirmation — remove a team member from the roster.
// ────────────────────────────────────────────────────────────

export function RemoveStaffModal({ staff, onConfirm, onCancel }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onCancel && onCancel(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 fadein"
      style={{ background: 'rgba(20,18,15,.42)' }}
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-[460px] bg-surface rounded-2xl shadow-pop border border-line p-7"
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
            <h3 className="font-serif text-[22px] text-ink leading-tight">Remove team member?</h3>
            <p className="text-[12.5px] text-muted mt-0.5 truncate">{staff.name} · {staff.role}</p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-roseSoft bg-roseSoft/40 px-3.5 py-2.5 text-[12.5px] text-[#7A2A3D] leading-relaxed">
          <span className="font-medium">{staff.name}</span> will be removed from your team. Their past appointment history stays on record, but they won't appear in scheduling, services, or the booking page.
        </div>

        <div className="mt-6 flex items-center gap-2 justify-end">
          <Button variant="secondary" size="lg" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" size="lg" onClick={onConfirm}>
            <I.Trash size={14} /> Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

window.RemoveStaffModal = RemoveStaffModal;
