import { useEffect, useMemo, useRef, useState } from 'react';
import { validateApptSlot } from './calendar-actions';
import { ACCOUNT, CUSTOMERS, SERVICES, STAFF, fmt12, fromMin, localDayKey, offsetDayKey, parseDay, toMin, todayKey } from './data';
import { I } from './icons';
import { UnsavedChangesModal, useDirtyGuard } from './nav-guard';
import { Button, Card, CustomerAvatar, DateInput, EmptyState, StaffAvatar, StatusPill, TimePicker, cx, showToast } from './ui';

// Appointments list page — clean list view matching the new design

// ─────────────────────────────────────────────────────────────
// Date range filter — dropdown popover with presets + start/end
// inputs. Style matches the status / staff dropdowns in this page
// (h-11, rounded-xl, white surface, line2 border, shadow-card)
// so it slots into the filter bar without redesigning anything.
// ─────────────────────────────────────────────────────────────

export function formatRangeLabel(startDate, endDate) {
  if (!startDate && !endDate) return 'Any date';
  const t = todayKey();
  const fmt = (d) => parseDay(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const fmtFull = (d) => {
    const dt = parseDay(d);
    const sameYear = dt.getFullYear() === new Date().getFullYear();
    return dt.toLocaleDateString('en-US', sameYear
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' });
  };
  if (startDate && endDate) {
    if (startDate === endDate) {
      if (startDate === t) return 'Today';
      return fmtFull(startDate);
    }
    return `${fmt(startDate)} – ${fmtFull(endDate)}`;
  }
  if (startDate) return `From ${fmtFull(startDate)}`;
  return `Until ${fmtFull(endDate)}`;
}

export function DateRangeFilter({ startDate, endDate, onChange }) {
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(startDate || '');
  const [draftEnd, setDraftEnd] = useState(endDate || '');
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Re-seed the draft from props every time the popover is opened so
  // discarding an in-progress edit (close without Apply) reverts cleanly.
  useEffect(() => {
    if (open) {
      setDraftStart(startDate || '');
      setDraftEnd(endDate || '');
    }
  }, [open, startDate, endDate]);

  const invalid = !!(draftStart && draftEnd && draftStart > draftEnd);
  const hasRange = !!(startDate || endDate);

  const presets = [
    { v: 'today',     l: 'Today' },
    { v: 'tomorrow',  l: 'Tomorrow' },
    { v: '7days',     l: 'Next 7 days' },
    { v: '30days',    l: 'Next 30 days' },
    { v: 'thismonth', l: 'This month' },
    { v: 'last30',    l: 'Last 30 days' },
  ];

  function applyPreset(v) {
    const t = todayKey();
    let s = '', e = '';
    if (v === 'today')         { s = t; e = t; }
    else if (v === 'tomorrow') { s = offsetDayKey(1);  e = offsetDayKey(1); }
    else if (v === '7days')    { s = t; e = offsetDayKey(6); }
    else if (v === '30days')   { s = t; e = offsetDayKey(29); }
    else if (v === 'thismonth') {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      s = localDayKey(first);
      e = localDayKey(last);
    }
    else if (v === 'last30')   { s = offsetDayKey(-29); e = t; }
    setDraftStart(s);
    setDraftEnd(e);
  }

  // Detect whether the current draft matches one of the canned ranges so
  // we can render the matching preset chip as "selected".
  function activePreset() {
    if (!draftStart || !draftEnd) return null;
    const t = todayKey();
    if (draftStart === t && draftEnd === t) return 'today';
    if (draftStart === offsetDayKey(1) && draftEnd === offsetDayKey(1)) return 'tomorrow';
    if (draftStart === t && draftEnd === offsetDayKey(6)) return '7days';
    if (draftStart === t && draftEnd === offsetDayKey(29)) return '30days';
    if (draftStart === offsetDayKey(-29) && draftEnd === t) return 'last30';
    const now = new Date();
    const first = localDayKey(new Date(now.getFullYear(), now.getMonth(), 1));
    const last  = localDayKey(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    if (draftStart === first && draftEnd === last) return 'thismonth';
    return null;
  }
  const active = activePreset();

  function apply() {
    if (invalid) return;
    onChange(draftStart || '', draftEnd || '');
    setOpen(false);
  }

  function clearAll() {
    setDraftStart('');
    setDraftEnd('');
    onChange('', '');
    setOpen(false);
  }

  const label = formatRangeLabel(startDate, endDate);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cx(
          'inline-flex items-center justify-between gap-3 h-11 px-4 rounded-xl bg-white border text-[14px] hover:border-ink2/40 transition shadow-card',
          hasRange ? 'border-ink2/30' : 'border-line2'
        )}
        style={{ minWidth: '200px' }}
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <I.Calendar size={15} className="text-ink2 shrink-0" />
          <span className={cx('truncate', hasRange ? 'text-ink font-medium' : 'text-ink')}>{label}</span>
        </span>
        <I.ChevronDown size={16} className="text-ink2 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-[320px] bg-white border border-line2 rounded-xl shadow-pop z-30 fadein">
          {/* Presets */}
          <div className="p-3 border-b border-line/70">
            <div className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-2">Quick ranges</div>
            <div className="grid grid-cols-2 gap-1.5">
              {presets.map(p => (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => applyPreset(p.v)}
                  className={cx(
                    'h-8 px-3 rounded-lg text-[12.5px] font-medium border transition text-left',
                    active === p.v
                      ? 'bg-accent text-white border-accent hover:bg-[#36513a]'
                      : 'bg-white text-ink2 border-line2 hover:text-ink hover:border-ink2/40 hover:bg-bg'
                  )}
                >
                  {p.l}
                </button>
              ))}
            </div>
          </div>

          {/* Manual range */}
          <div className="p-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[12px] font-medium text-ink2 mb-1">Start</div>
                <DateInput
                  value={draftStart}
                  onChange={v => setDraftStart(v)}
                  max={draftEnd || undefined}
                  invalid={invalid}
                  className="!h-10 !text-[13px]"
                />
              </div>
              <div>
                <div className="text-[12px] font-medium text-ink2 mb-1">End</div>
                <DateInput
                  value={draftEnd}
                  onChange={v => setDraftEnd(v)}
                  min={draftStart || undefined}
                  invalid={invalid}
                  className="!h-10 !text-[13px]"
                />
              </div>
            </div>
            {invalid && (
              <div className="mt-2 text-[12px] text-rose font-medium leading-snug">
                Start date must be on or before the end date.
              </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={clearAll}
                disabled={!draftStart && !draftEnd && !hasRange}
              >
                Clear
              </Button>
              <Button
                type="button"
                variant="accent"
                onClick={apply}
                disabled={invalid || (!draftStart && !draftEnd && !hasRange)}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppointmentsPage({ appointments, onOpen, onAddAppointment, meStaffId, title, subtitle }) {
  const [tab, setTab] = useState('all'); // all | today | upcoming | past
  const [statusFilter, setStatusFilter] = useState('all');
  // When viewed from the employee app, default the staff filter to "me"
  // so the page opens scoped to the current employee's own appointments.
  const [staffFilter, setStaffFilter] = useState(meStaffId || 'all');
  const [search, setSearch] = useState('');
  const [statusOpen, setStatusOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  // Inclusive date range filter. '' means unbounded on that end. String
  // compare on YYYY-MM-DD keys is correct because both sides are zero-padded.
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const statusRef = useRef(null);
  const staffRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (statusRef.current && !statusRef.current.contains(e.target)) setStatusOpen(false);
      if (staffRef.current && !staffRef.current.contains(e.target)) setStaffOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const today = todayKey();

  const filtered = appointments.filter(a => {
    if (tab === 'today' && a.day !== today) return false;
    if (tab === 'upcoming' && a.day < today) return false;
    if (tab === 'past' && a.day >= today) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (staffFilter !== 'all' && a.staffId !== staffFilter) return false;
    if (startDate && a.day < startDate) return false;
    if (endDate && a.day > endDate) return false;
    if (search) {
      const cust = CUSTOMERS.find(c => c.id === a.customerId);
      const svc = SERVICES.find(s => s.id === a.serviceId);
      const staff = STAFF.find(s => s.id === a.staffId);
      const hay = `${cust?.name || ''} ${svc?.name || ''} ${staff?.name || ''}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  }).sort((a,b) => {
    // For "past" sort newest first; otherwise soonest first
    const av = a.day + a.start;
    const bv = b.day + b.start;
    return tab === 'past' ? bv.localeCompare(av) : av.localeCompare(bv);
  });

  // Reset to page 1 any time the filtered list could change.
  useEffect(() => { setPage(1); }, [tab, statusFilter, staffFilter, search, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamp current page if the list shrunk under us (e.g. appt deleted).
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const showPagination = filtered.length > PAGE_SIZE;

  const tabs = [
    { v: 'all', l: 'All' },
    { v: 'today', l: 'Today' },
    { v: 'upcoming', l: 'Upcoming' },
    { v: 'past', l: 'Past' },
  ];

  const statusOptions = [
    { v: 'all', l: 'All statuses' },
    { v: 'confirmed', l: 'Confirmed' },
    { v: 'completed', l: 'Completed' },
    { v: 'no_show', l: 'No-Show' },
    { v: 'canceled', l: 'Canceled' },
  ];
  const currentStatusLabel = statusOptions.find(o => o.v === statusFilter)?.l || 'All statuses';

  const staffOptions = [
    { v: 'all', l: 'All staff' },
    ...STAFF.map(s => ({
      v: s.id,
      // In the employee view, mark the current employee as "Me · …" so the
      // owner of the page can clearly see which row represents themselves.
      l: meStaffId && s.id === meStaffId ? `Me · ${s.name}` : s.name,
    })),
  ];
  const currentStaffLabel = staffOptions.find(o => o.v === staffFilter)?.l || 'All staff';

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-medium mb-2">Schedule</div>
          <h1 className="font-serif text-[40px] leading-[1.05] text-ink">{title || 'Appointments'}</h1>
          <p className="text-[14px] text-ink2 mt-1.5 max-w-2xl">
            {subtitle || (meStaffId ? 'Your appointments — switch the staff filter to see the rest of the team.' : 'All bookings across your team.')}
          </p>
        </div>
        <Button variant="accent" onClick={onAddAppointment} className="shrink-0">
          <I.Plus size={14} />
          New appointment
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Segmented tabs */}
        <div className="inline-flex items-center bg-white border border-line2 rounded-full p-1 shadow-card">
          {tabs.map(t => (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={cx(
                'h-9 px-4 rounded-full text-[13.5px] font-medium transition',
                tab === t.v
                  ? 'bg-bg text-ink border border-line2 shadow-card'
                  : 'text-ink2 hover:text-ink'
              )}
              style={tab === t.v ? { background: '#F4F1EA' } : undefined}
            >
              {t.l}
            </button>
          ))}
        </div>

        {/* Status dropdown */}
        <div className="relative" ref={statusRef}>
          <button
            onClick={() => setStatusOpen(o => !o)}
            className="inline-flex items-center justify-between gap-3 h-11 min-w-[180px] px-4 rounded-xl bg-white border border-line2 text-[14px] text-ink hover:border-ink2/40 transition shadow-card"
          >
            <span className={statusFilter === 'all' ? 'text-ink' : 'text-ink'}>{currentStatusLabel}</span>
            <I.ChevronDown size={16} className="text-ink2" />
          </button>
          {statusOpen && (
            <div className="absolute left-0 top-full mt-1.5 min-w-[200px] bg-white border border-line2 rounded-xl shadow-pop overflow-hidden z-20 fadein">
              {statusOptions.map(o => (
                <button
                  key={o.v}
                  onClick={() => { setStatusFilter(o.v); setStatusOpen(false); }}
                  className={cx(
                    'w-full text-left px-3.5 py-2.5 text-[13.5px] hover:bg-bg transition flex items-center justify-between gap-3',
                    statusFilter === o.v ? 'text-ink font-medium' : 'text-ink2'
                  )}
                >
                  {o.l}
                  {statusFilter === o.v && <I.Check size={14} className="text-accent" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Staff dropdown */}
        <div className="relative" ref={staffRef}>
          <button
            onClick={() => setStaffOpen(o => !o)}
            className="inline-flex items-center justify-between gap-3 h-11 min-w-[180px] px-4 rounded-xl bg-white border border-line2 text-[14px] text-ink hover:border-ink2/40 transition shadow-card"
          >
            <span className="text-ink truncate">{currentStaffLabel}</span>
            <I.ChevronDown size={16} className="text-ink2 shrink-0" />
          </button>
          {staffOpen && (
            <div className="absolute left-0 top-full mt-1.5 min-w-[220px] bg-white border border-line2 rounded-xl shadow-pop overflow-hidden z-20 fadein">
              {staffOptions.map(o => (
                <button
                  key={o.v}
                  onClick={() => { setStaffFilter(o.v); setStaffOpen(false); }}
                  className={cx(
                    'w-full text-left px-3.5 py-2.5 text-[13.5px] hover:bg-bg transition flex items-center justify-between gap-3',
                    staffFilter === o.v ? 'text-ink font-medium' : 'text-ink2'
                  )}
                >
                  {o.l}
                  {staffFilter === o.v && <I.Check size={14} className="text-accent" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date range picker */}
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
        />

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <I.Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search client, service, staff…"
            className="!h-11 !pl-11 !rounded-xl !bg-white !border-line2 !shadow-card placeholder:text-muted"
          />
        </div>
      </div>

      {/* Active date range chip — surfaces the applied range so it's obvious
          a filter is in play, and provides a one-tap clear next to it. */}
      {(startDate || endDate) && (
        <div className="-mt-2 mb-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 h-8 pl-3 pr-1.5 rounded-full bg-white border border-line2 shadow-card text-[12.5px] text-ink2">
            <I.Calendar size={13} className="text-ink2" />
            <span className="text-ink font-medium">
              {formatRangeLabel(startDate, endDate)}
            </span>
            <button
              type="button"
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="w-5 h-5 rounded-full text-muted hover:text-ink hover:bg-bg flex items-center justify-center transition"
              aria-label="Clear date range"
            >
              <I.X size={12} />
            </button>
          </span>
        </div>
      )}

      {/* List card */}
      <Card className="overflow-hidden">
        {filtered.length === 0 && (
          <div className="p-10">
            <EmptyState
              title={(startDate || endDate) ? 'No appointments in this date range' : 'No appointments'}
              body={(startDate || endDate)
                ? 'Try widening the range, clearing the dates, or adjusting other filters.'
                : 'Try a different filter, status, or search term.'}
              action={(startDate || endDate) ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                >
                  <I.X size={13} />
                  Clear date range
                </Button>
              ) : undefined}
            />
          </div>
        )}
        {pageItems.map((a, i) => (
          <AppointmentRow
            key={a.id}
            appt={a}
            onClick={() => onOpen(a)}
            isLast={i === pageItems.length - 1}
          />
        ))}
      </Card>

      {showPagination && (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={PAGE_SIZE}
          onChange={setPage}
        />
      )}
    </div>
  );
}

export function AppointmentRow({ appt, onClick, isLast }) {
  const svc = SERVICES.find(s => s.id === appt.serviceId);
  const staff = STAFF.find(s => s.id === appt.staffId);
  const cust = CUSTOMERS.find(c => c.id === appt.customerId);
  const today = todayKey();

  // Date label: "Today" if today, else "May 21"
  const d = parseDay(appt.day);
  const dateLabel = appt.day === today
    ? 'Today'
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Source label / pill
  const aiOn = ACCOUNT.aiAgentEnabled !== false;
  const sourceLabel =
    appt.source === 'online' ? 'Online' :
    appt.source === 'phone' ? 'Phone' :
    appt.source === 'ai' ? (aiOn ? 'AI' : 'Online') :
    'Walk-in';

  return (
    <button
      onClick={onClick}
      className={cx(
        'group w-full grid items-center px-6 py-4 text-left transition hover:bg-bg/60',
        !isLast && 'border-b border-line'
      )}
      style={{ gridTemplateColumns: '120px 44px 1fr auto auto auto', gap: '20px' }}
    >
      {/* Date / time */}
      <div className="min-w-0">
        <div className="text-[15px] font-medium text-ink leading-tight">{dateLabel}</div>
        <div className="text-[13.5px] text-muted mt-0.5">{fmt12(appt.start)}</div>
      </div>

      {/* Avatar (staff color) */}
      <div className="flex items-center">
        {staff ? (
          <StaffAvatar staff={staff} size={36} />
        ) : (
          <div className="w-9 h-9 rounded-full bg-line" />
        )}
      </div>

      {/* Client + service · staff */}
      <div className="min-w-0">
        <div className="text-[15px] font-semibold text-ink truncate">
          {cust?.name || 'Unknown client'}
        </div>
        <div className="text-[13.5px] text-ink2 truncate mt-0.5">
          {svc?.name}<span className="text-muted"> · </span>{staff?.name}
        </div>
      </div>

      {/* Price */}
      <div className="text-[15px] font-medium text-ink2 tabular-nums whitespace-nowrap">
        ${svc?.price ?? 0}
      </div>

      {/* Source pill */}
      <div>
        <span className="inline-flex items-center h-7 px-3 rounded-full bg-white border border-line2 text-[12.5px] text-ink2 font-medium whitespace-nowrap">
          {sourceLabel}
        </span>
      </div>

      {/* Status pill */}
      <div className="min-w-[110px] flex justify-end">
        <StatusPill status={appt.status} />
      </div>
    </button>
  );
}

export function getInitials(name) {
  if (!name) return '?';
  return name.split(/\s+/).filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

// ─────────────────────────────────────────────────────────────
// New Appointment modal
// ─────────────────────────────────────────────────────────────

export function NewAppointmentModal({ onClose, onCreate, initial }) {
  const init = initial || {};
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState(init.staffId || '');
  const [date, setDate] = useState(init.date || todayKey());
  const [start, setStart] = useState(init.start || '09:00');
  const [source, setSource] = useState('phone');
  const [notes, setNotes] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [errors, setErrors] = useState({});
  const [showNewClient, setShowNewClient] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  // Filter staff to those who can perform the selected service
  const availableStaff = useMemo(() => {
    if (!serviceId) return STAFF;
    const svc = SERVICES.find(s => s.id === serviceId);
    if (!svc || !svc.staff) return STAFF;
    return STAFF.filter(s => svc.staff.includes(s.id));
  }, [serviceId]);

  // Reset staff if not eligible for the new service
  useEffect(() => {
    if (staffId && !availableStaff.find(s => s.id === staffId)) {
      setStaffId('');
    }
  }, [serviceId, availableStaff, staffId]);

  const clientMatches = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return [];
    return CUSTOMERS.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [clientSearch]);

  function pickClient(c) {
    setSelectedClient(c);
    setClientSearch(c.name);
    setShowSuggestions(false);
    setErrors(e => ({ ...e, client: undefined }));
  }

  function clearClient() {
    setSelectedClient(null);
    setClientSearch('');
  }

  const isValid = selectedClient && serviceId && staffId && date && start;

  // "Has any user input we'd lose by closing?" — broader than `isValid`
  // so the prompt fires even on a half-filled draft. Prefilled slot values
  // (date / start / staffId from a click on the calendar) don't count as
  // dirty on their own — the user has to actually touch a field.
  const dirty =
    !!selectedClient ||
    clientSearch.trim().length > 0 ||
    serviceId !== '' ||
    staffId !== (init.staffId || '') ||
    date !== (init.date || todayKey()) ||
    start !== (init.start || '09:00') ||
    source !== 'phone' ||
    notes.trim().length > 0;

  function requestClose() {
    if (showNewClient) return; // child modal owns the close attempt
    if (dirty) setConfirmClose(true);
    else onClose();
  }

  // Pop the unsaved-changes modal on sidebar / route / tab nav too.
  // Creation flow — hide "Save & leave".
  useDirtyGuard({
    dirty,
    onSave: () => {},
    onDiscard: () => onClose(),
    hideSave: true,
  });

  function handleSubmit() {
    const newErrors = {};
    if (!selectedClient) newErrors.client = 'Choose a client';
    if (!serviceId) newErrors.service = 'Choose a service';
    if (!staffId) newErrors.staff = 'Choose a staff member';
    if (!date) newErrors.date = 'Pick a date';
    if (!start) newErrors.start = 'Pick a start time';
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }

    const svc = SERVICES.find(s => s.id === serviceId);
    const duration = svc?.duration || 30;
    const buf = (svc && svc.bufferAfter) || 0;
    const startMin = toMin(start);
    const endMin = startMin + duration;

    // Single validator handles all availability rules:
    //   • working hours, business hours (inc. closed days)
    //   • lunch break, manual breaks / lunch breaks
    //   • existing appointments (with their trailing buffer)
    //   • our service's own buffer is counted via bufferAfter
    // Failure surfaces both inline AND as a bottom-right error toast so the
    // feedback is consistent with drag-to-reschedule.
    const v = validateApptSlot({
      staffId,
      day: date,
      startMin,
      endMin,
      bufferAfter: buf,
    });
    if (!v.ok) {
      setErrors({ start: v.reason });
      showToast({ title: "Can't book this appointment", body: v.reason, tone: 'error' });
      return;
    }

    // If client is new (created via the Add client sub-modal), persist into CUSTOMERS
    if (selectedClient.isNew && !CUSTOMERS.find(c => c.id === selectedClient.id)) {
      CUSTOMERS.push({
        id: selectedClient.id,
        name: selectedClient.name,
        phone: selectedClient.phone || '',
        email: selectedClient.email || '',
        notes: selectedClient.notes || '',
        visits: 0,
      });
    }

    onCreate({
      day: date,
      start,
      end: fromMin(endMin),
      serviceId,
      staffId,
      customerId: selectedClient.id,
      source,
      duration,
      price: svc?.price || 0,
      notes: notes.trim(),
    });
  }

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') requestClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, dirty, showNewClient]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 fadein"
      style={{ background: 'rgba(20,18,15,.42)' }}
      onClick={requestClose}
    >
      <div
        className="relative w-full max-w-[520px] bg-surface rounded-2xl shadow-pop border border-line overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-2">
          <h2 className="font-serif text-[24px] text-ink leading-none">New appointment</h2>
          <button
            onClick={requestClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-ink2 hover:bg-bg transition"
            aria-label="Close"
          >
            <I.X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-7 py-5 space-y-4">
          {/* Client */}
          <div>
            <FieldLabel required>Client</FieldLabel>
            <div className="relative">
              <input
                type="text"
                value={clientSearch}
                onChange={e => {
                  setClientSearch(e.target.value);
                  setSelectedClient(null);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Search client name or phone…"
                className={cx('!h-11', errors.client && '!border-rose')}
                style={selectedClient ? { paddingRight: '36px' } : undefined}
              />
              {selectedClient && (
                <button
                  type="button"
                  onClick={clearClient}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-muted hover:text-ink hover:bg-bg flex items-center justify-center"
                  aria-label="Clear client"
                >
                  <I.X size={14} />
                </button>
              )}
              {showSuggestions && clientMatches.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-line2 rounded-lg shadow-pop overflow-hidden z-10 max-h-[220px] overflow-y-auto">
                  {clientMatches.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => pickClient(c)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-bg transition"
                    >
                      <CustomerAvatar name={c.name} size={28} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] text-ink truncate">{c.name}</div>
                        <div className="text-[12px] text-muted truncate">{c.phone}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="mt-2 text-[13px] text-accent hover:text-accentInk font-medium inline-flex items-center gap-1 transition"
              onClick={() => setShowNewClient(true)}
            >
              <I.Plus size={13} strokeWidth={2.2} /> Add new client
            </button>
          </div>

          {/* Service */}
          <div>
            <FieldLabel required>Service</FieldLabel>
            <select
              value={serviceId}
              onChange={e => { setServiceId(e.target.value); setErrors(er => ({ ...er, service: undefined })); }}
              className={cx('!h-11', errors.service && '!border-rose')}
            >
              <option value="">Choose service...</option>
              {SERVICES.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.duration} min · ${s.price}
                </option>
              ))}
            </select>
          </div>

          {/* Staff */}
          <div>
            <FieldLabel required>Staff member</FieldLabel>
            <select
              value={staffId}
              onChange={e => { setStaffId(e.target.value); setErrors(er => ({ ...er, staff: undefined })); }}
              className={cx('!h-11', errors.staff && '!border-rose')}
            >
              <option value="">Choose staff member...</option>
              {availableStaff.map(s => (
                <option key={s.id} value={s.id}>{s.name} — {s.role}</option>
              ))}
            </select>
          </div>

          {/* Date + Start time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Date</FieldLabel>
              <DateInput
                value={date}
                onChange={v => setDate(v)}
                className="!h-11"
              />
            </div>
            <div>
              <FieldLabel required>Start time</FieldLabel>
              <TimePicker value={start} onChange={(v) => { setStart(v); if (errors.start) setErrors(er => ({ ...er, start: undefined })); }} size="lg" />
              {errors.start && (
                <div className="mt-1.5 text-[12px] text-rose font-medium leading-snug">{errors.start}</div>
              )}
            </div>
          </div>

          {/* Booking source */}
          <div>
            <FieldLabel>Booking source</FieldLabel>
            <select
              value={source}
              onChange={e => setSource(e.target.value)}
              className="!h-11"
            >
              <option value="online">Online</option>
              <option value="phone">Phone</option>
              {ACCOUNT.aiAgentEnabled !== false && <option value="ai">AI</option>}
              <option value="walkin">Walk-in</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Appointment notes — optional */}
          <div>
            <FieldLabel>Appointment notes <span className="text-muted font-normal">(optional)</span></FieldLabel>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add any notes or special requests..."
              rows={3}
              className="w-full resize-y leading-snug"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-5 flex items-center justify-end gap-3 border-t border-line/70 bg-bg/30">
          <Button type="button" variant="secondary" size="lg" onClick={requestClose}>
            Cancel
          </Button>
          <Button type="button" variant="accent" size="lg" onClick={handleSubmit} disabled={!isValid}>
            Book appointment
          </Button>
        </div>
      </div>

      {showNewClient && (
        <NewClientModal
          onClose={() => setShowNewClient(false)}
          onCreate={(client) => {
            pickClient(client);
            setShowNewClient(false);
          }}
        />
      )}

      {/* Unsaved-changes confirmation — creation flow, no "Save & leave" */}
      <UnsavedChangesModal
        open={confirmClose}
        hideSave={true}
        onSave={() => setConfirmClose(false)}
        onDiscard={() => { setConfirmClose(false); onClose(); }}
        onStay={() => setConfirmClose(false)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// New Client modal — collected inside the appointment flow
// ─────────────────────────────────────────────────────────────

export function NewClientModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const nameRef = useRef(null);

  const dirty = name.trim().length > 0 || phone.trim().length > 0 || email.trim().length > 0 || notes.trim().length > 0;

  function requestClose() {
    if (dirty) setConfirmClose(true);
    else onClose();
  }

  // The parent modal already registered its own guard — but this child
  // owns its own dirty state and should pop the prompt if its inputs are
  // touched while the parent itself is clean.
  useDirtyGuard({
    dirty,
    onSave: () => {},
    onDiscard: () => onClose(),
    hideSave: true,
  });

  useEffect(() => { nameRef.current && nameRef.current.focus(); }, []);
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') requestClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dirty]);

  function handleCreate() {
    if (!name.trim()) { setError('Enter the client\u2019s name'); return; }
    onCreate({
      id: 'cust_new_' + Date.now(),
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      notes: notes.trim(),
      visits: 0,
      isNew: true,
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 fadein"
      style={{ background: 'rgba(20,18,15,.32)' }}
      onClick={requestClose}
    >
      <div
        className="relative w-full max-w-[480px] bg-surface rounded-2xl shadow-pop border border-line overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-2">
          <h2 className="font-serif text-[24px] text-ink leading-none">New client</h2>
          <button
            onClick={requestClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-ink2 hover:bg-bg transition"
            aria-label="Close"
          >
            <I.X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-7 py-5 space-y-4">
          <div>
            <FieldLabel required>Name</FieldLabel>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); if (error) setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              placeholder="Full name"
              className={cx('!h-11', error && '!border-rose')}
            />
            {error && (
              <div className="mt-1.5 text-[12px] text-rose font-medium">{error}</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel optional>Phone</FieldLabel>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(415) 555-0000"
                className="!h-11"
              />
            </div>
            <div>
              <FieldLabel optional>Email</FieldLabel>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="!h-11"
              />
            </div>
          </div>

          <div>
            <FieldLabel optional>Customer notes</FieldLabel>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add preferences, allergies, special instructions, or internal notes..."
              rows={3}
              className="w-full resize-y leading-snug"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-5 flex items-center justify-end gap-3 border-t border-line/70 bg-bg/30">
          <Button type="button" variant="secondary" size="lg" onClick={requestClose}>
            Back
          </Button>
          <Button type="button" variant="accent" size="lg" onClick={handleCreate} disabled={!name.trim()}>
            Create client
          </Button>
        </div>
      </div>

      {/* Unsaved-changes confirmation — creation flow, no "Save & leave" */}
      <UnsavedChangesModal
        open={confirmClose}
        hideSave={true}
        onSave={() => setConfirmClose(false)}
        onDiscard={() => { setConfirmClose(false); onClose(); }}
        onStay={() => setConfirmClose(false)}
      />
    </div>
  );
}

export function FieldLabel({ children, required, optional }) {
  // (declared again above; kept here for clarity if reused)
  return (
    <div className="text-[13px] font-medium text-ink mb-1.5">
      {children}
      {required && <span className="text-rose ml-0.5">*</span>}
      {optional && <span className="text-muted font-normal"> (optional)</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Pagination — bottom of the appointments list.
// Matches the app's button language: ~36px tall, rounded-md,
// white surface, line-coloured borders, hover-bg, accent fill
// for the active page.
// ─────────────────────────────────────────────────────────────
export function Pagination({ page, totalPages, totalItems, pageSize, onChange }) {
  if (totalPages <= 1) return null;

  // Visible page numbers with ellipses around large gaps.
  // Always keep first + last visible; fan out 1 on each side of `page`.
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    const start = Math.max(2, page - 1);
    const end   = Math.min(totalPages - 1, page + 1);
    if (start > 2) pages.push('…');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push('…');
    pages.push(totalPages);
  }

  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd   = Math.min(totalItems, page * pageSize);

  const navBtn = 'h-9 px-3 inline-flex items-center gap-1 rounded-md bg-white border border-line2 text-[13px] font-medium text-ink hover:border-ink2/40 hover:bg-bg transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-line2';
  const pageBtn = 'h-9 min-w-[36px] px-2 inline-flex items-center justify-center rounded-md text-[13px] font-medium border transition';

  return (
    <nav
      aria-label="Pagination"
      className="mt-5 flex flex-wrap items-center justify-between gap-3"
    >
      <div className="text-[12.5px] text-muted tabular-nums">
        Showing <span className="text-ink font-medium">{rangeStart}–{rangeEnd}</span> of <span className="text-ink font-medium">{totalItems}</span>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className={navBtn}
        >
          <I.ChevronLeft size={14} />
          <span className="hidden sm:inline">Previous</span>
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="px-1.5 text-muted text-[13px] select-none">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={cx(
                pageBtn,
                p === page
                  ? 'bg-accent text-white border-accent hover:bg-[#36513a]'
                  : 'bg-white text-ink border-line2 hover:border-ink2/40 hover:bg-bg'
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className={navBtn}
        >
          <span className="hidden sm:inline">Next</span>
          <I.ChevronRight size={14} />
        </button>
      </div>
    </nav>
  );
}

window.AppointmentsPage = AppointmentsPage;
window.NewAppointmentModal = NewAppointmentModal;
window.NewClientModal = NewClientModal;
