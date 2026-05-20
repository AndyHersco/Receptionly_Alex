import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertsPanel } from './alerts';
import { APPOINTMENTS, CUSTOMERS, SERVICES, dayName, fmt12, offsetDayKey, toMin, todayKey } from './data';
import { EMPLOYEE_PROFILES, appointmentsFor, calcEarnings, getEmployee } from './employee-data';
import { I } from './icons';
import { Badge, Button, Card, CustomerAvatar, DateInput, EmptyState, Field, StatusPill, Tabs, cx } from './ui';

// Employee Dashboard — personal "my day" view.

export function EmployeeDashboard({ staffId, tweaks, onNav, onOpenAppt }) {
  const me = getEmployee(staffId);
  const profile = EMPLOYEE_PROFILES[staffId];
  const today = todayKey();
  const tomorrow = offsetDayKey(1);
  const allMine = appointmentsFor(staffId);
  const todays = allMine.filter(a => a.day === today);
  const tomorrows = allMine.filter(a => a.day === tomorrow);
  const upcoming = todays.filter(a => a.status === 'confirmed').sort((a,b) => toMin(a.start) - toMin(b.start));
  const completed = todays.filter(a => a.status === 'completed');
  const next = upcoming[0];
  const remainingCount = upcoming.length;

  const todaysEarnings = calcEarnings(todays, parseInt(profile.commissionRate));
  const weekEarnings = todaysEarnings * 4.2; // approximate week — sample

  // Upcoming appointments this week (today → Sunday, confirmed only)
  const todayDate = new Date();
  const dowFromMon = (todayDate.getDay() + 6) % 7;
  const daysLeftInWeek = 6 - dowFromMon; // includes today=0 … sat=5, sun=6
  const weekKeys = new Set();
  for (let i = 0; i <= daysLeftInWeek; i++) weekKeys.add(offsetDayKey(i));
  const upcomingThisWeek = allMine.filter(a => weekKeys.has(a.day) && a.status === 'confirmed').length;

  const greet = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const firstName = me.name.split(' ')[0];
  const dn = dayName(today);
  const sched = me.hours[dn];
  const working = Array.isArray(sched);

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-medium mb-1">
            {new Date().toLocaleDateString('en-US',{weekday:'long', month:'long', day:'numeric'})}
          </div>
          <h1 className="font-serif text-[40px] leading-[1.05] text-ink">{greet}, {firstName}.</h1>
          <p className="text-[14px] text-ink2 mt-1.5">
            {working
              ? <>You're on the floor from <span className="font-medium text-ink">{fmt12(sched[0])}</span> to <span className="font-medium text-ink">{fmt12(sched[1])}</span>. {remainingCount} appointments left today.</>
              : <>You're off today. {tomorrows.length > 0 ? `${tomorrows.length} booked for tomorrow.` : 'No appointments tomorrow yet.'}</>
            }
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" onClick={() => onNav('calendar')}><I.Calendar size={14}/> Open calendar</Button>
        </div>
      </div>

      {/* Up next — hero card */}
      {next && <UpNextCard appt={next} onOpen={onOpenAppt} />}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Completed today"        value={completed.length}    sub={todays.length > 0 ? `of ${todays.length} booked` : 'No bookings today'} />
        <StatCard label="Hours on the books"     value={Math.round(todays.reduce((s,a)=>s+a.duration,0)/60*10)/10 + 'h'} sub={`${Math.round(tomorrows.filter(a=>a.status!=='canceled').reduce((s,a)=>s+a.duration,0)/60*10)/10}h booked tomorrow`} />
        <StatCard label="Upcoming today"         value={remainingCount}      sub={next ? `Next at ${fmt12(next.start)}` : 'All done for today'} accent="accent" />
        <StatCard label="Upcoming this week"     value={upcomingThisWeek}    sub="Through Sunday" />
      </div>

      {/* Important alerts — filtered to this employee's clients/appointments */}
      <AlertsPanel staffId={staffId} onOpenAppt={onOpenAppt} />

      {/* My performance — personal report with time-range filter */}
      <MyPerformanceCard staffId={staffId} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Today's schedule */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-serif text-[22px] text-ink leading-tight">Today's schedule</h3>
              <div className="text-[12.5px] text-muted">Your appointments, in order</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNav('calendar')}>See calendar <I.ChevronRight size={14}/></Button>
          </div>
          {todays.length === 0 ? (
            <EmptyState title="No appointments today" body={working ? 'Your day is open — walk-ins welcome.' : "You're off today. Enjoy it."} />
          ) : (
            <div className="space-y-1">
              {todays
                .sort((a,b) => toMin(a.start) - toMin(b.start))
                .map((a, i, arr) => (
                  <EmpScheduleRow key={a.id} appt={a} prev={arr[i-1]} onOpen={onOpenAppt} isNext={a.id === next?.id} staffColor={me.color} />
                ))}
            </div>
          )}
        </Card>

        {/* Right column: tomorrow preview */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif text-[22px] text-ink leading-tight">Tomorrow</h3>
            <span className="text-[11.5px] text-muted">{new Date(Date.now()+86400000).toLocaleDateString('en-US',{weekday:'long', month:'short', day:'numeric'})}</span>
          </div>
          {tomorrows.length === 0 ? (
            <div className="text-[13px] text-muted py-2">No appointments booked yet.</div>
          ) : (
            <div className="space-y-2.5">
              {tomorrows.slice(0,6).map(a => {
                const svc = SERVICES.find(s => s.id === a.serviceId);
                const cust = CUSTOMERS.find(c => c.id === a.customerId);
                return (
                  <div key={a.id} className="flex items-center gap-2.5 text-[12.5px]">
                    <div className="w-12 text-ink font-mono text-[11.5px] font-medium">{fmt12(a.start)}</div>
                    <CustomerAvatar name={cust.name} size={22}/>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-ink truncate">{cust.name}</div>
                      <div className="text-muted truncate text-[11.5px]">{svc.name}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export function UpNextCard({ appt, onOpen }) {
  const svc = SERVICES.find(s => s.id === appt.serviceId);
  const cust = CUSTOMERS.find(c => c.id === appt.customerId);
  const minsUntil = (() => {
    const now = new Date();
    const [h, m] = appt.start.split(':').map(Number);
    const apptM = h*60 + m;
    const nowM = now.getHours()*60 + now.getMinutes();
    return apptM - nowM;
  })();
  const inWindow = minsUntil >= -10 && minsUntil <= 90;
  const labelTime = inWindow
    ? (minsUntil <= 0 ? 'Starting now' : `In ${minsUntil} min`)
    : `at ${fmt12(appt.start)}`;

  return (
    <Card className="p-0 overflow-hidden border-accent/30">
      <div className="flex flex-col md:flex-row">
        {/* Left — when */}
        <div className="md:w-[280px] flex-shrink-0 bg-accent text-white p-6 flex flex-col justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/70 font-medium">Up next</div>
            <div className="font-serif text-[44px] leading-none mt-2">{fmt12(appt.start)}</div>
            <div className="text-[13px] text-white/85 mt-1.5">{labelTime} · {appt.duration} min</div>
          </div>
        </div>
        {/* Right — who/what */}
        <div className="flex-1 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 mb-1.5">
                <CustomerAvatar name={cust.name} size={36}/>
                <div>
                  <div className="font-medium text-[16px] text-ink leading-tight">{cust.name}</div>
                  <div className="text-[12.5px] text-muted">{cust.visits > 0 ? `${cust.visits} visits · last ${cust.lastVisit}` : 'First visit'}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink2">
                <span className="inline-flex items-center gap-1.5"><I.Phone size={12} className="text-muted"/> {cust.phone}</span>
                <span className="inline-flex items-center gap-1.5"><I.Mail size={12} className="text-muted"/> {cust.email}</span>
              </div>
              <div className="mt-3">
                <div className="font-serif text-[24px] text-ink leading-tight">{svc.name}</div>
                <div className="text-[12.5px] text-muted mt-0.5">{svc.duration} min · ${svc.price}</div>
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <Button variant="accent" size="sm" onClick={() => onOpen(appt)}>Open details</Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function EmpScheduleRow({ appt, prev, onOpen, isNext, staffColor }) {
  const svc = SERVICES.find(s => s.id === appt.serviceId);
  const cust = CUSTOMERS.find(c => c.id === appt.customerId);
  const isComplete = appt.status === 'completed';
  const isNoShow = appt.status === 'no_show';
  const isCanceled = appt.status === 'canceled';

  // Show "free gap" pill if there's a gap from previous appt > 15 min
  const gap = prev ? toMin(appt.start) - toMin(prev.end) : null;
  const showGap = gap !== null && gap >= 20;

  return (
    <>
      {showGap && (
        <div className="flex items-center gap-3 py-1.5">
          <div className="w-[64px]"></div>
          <div className="flex-1 h-px bg-line"></div>
          <span className="text-[11px] text-muted font-mono">{gap} min open</span>
          <div className="flex-1 h-px bg-line"></div>
        </div>
      )}
      <button onClick={() => onOpen(appt)}
        className={cx('w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-bg/70 transition text-left relative',
          isNext && 'bg-accentSoft/40 ring-1 ring-accent/30')}>
        <div className="w-[64px] flex-shrink-0">
          <div className={cx('text-[13px] font-semibold leading-tight', isCanceled ? 'text-muted line-through' : 'text-ink')}>{fmt12(appt.start)}</div>
          <div className="text-[11px] text-muted">{appt.duration} min</div>
        </div>
        <div className="w-1 self-stretch rounded-full" style={{ background: isComplete ? '#E2DDD1' : isNoShow ? '#D4B776' : isCanceled ? '#F5E2E6' : staffColor }} />
        <CustomerAvatar name={cust.name} size={28} />
        <div className="flex-1 min-w-0">
          <div className={cx('text-[13.5px] font-medium truncate', isCanceled ? 'text-muted line-through' : 'text-ink')}>{cust.name}</div>
          <div className="text-[11.5px] text-ink2 truncate">{svc.name} · ${svc.price}</div>
        </div>
        {appt.source === 'ai' && <Badge tone="neutral"><I.Mic size={10}/> AI</Badge>}
        <StatusPill status={appt.status} />
      </button>
    </>
  );
}

export function StatCard({ label, value, sub, accent }) {
  return (
    <Card className="p-5">
      <div className="text-[12px] uppercase tracking-wider text-muted font-medium">{label}</div>
      <div className={cx('font-serif text-[36px] leading-none mt-2', accent === 'accent' ? 'text-accent' : 'text-ink')}>{value}</div>
      <div className="text-[12.5px] text-ink2 mt-1.5">{sub}</div>
    </Card>
  );
}

// ───────────── My performance — personal report section ──────────────────
// Self-contained: range tabs (Today/7d/30d/90d/Custom), custom date picker,
// and a tiny bar chart. Reads from APPOINTMENTS filtered to the current
// employee. Mirrors the visual language of the Reports page on index.html.

export const PERF_RANGE_TABS = [
  { value: 'today',  label: 'Today' },
  { value: '7d',     label: '7d' },
  { value: '30d',    label: '30d' },
  { value: '90d',    label: '90d' },
  { value: 'custom', label: 'Custom' },
];

export const PERF_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function perfAddDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function perfIsoDay(d) {
  const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
export function perfParseISO(s) { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); }
export function perfDaysBetween(a, b) {
  const A = perfParseISO(a); const B = perfParseISO(b);
  return Math.round((B - A) / (1000*60*60*24));
}

export function perfResolveView(range, customStart, customEnd, today) {
  if (range === 'today') return { mode: 'today', date: today, summary: 'Today' };
  if (range === '7d')    return { mode: 'daily',  startDate: perfAddDays(today, -6),  endDate: today, days: 7,  summary: 'Last 7 days' };
  if (range === '30d')   return { mode: 'daily',  startDate: perfAddDays(today, -29), endDate: today, days: 30, summary: 'Last 30 days' };
  if (range === '90d')   return { mode: 'weekly', startDate: perfAddDays(today, -89), endDate: today, days: 90, summary: 'Last 90 days' };
  const span = perfDaysBetween(customStart, customEnd) + 1;
  const s = perfParseISO(customStart); const e = perfParseISO(customEnd);
  return {
    mode: span > 30 ? 'weekly' : 'daily',
    startDate: s, endDate: e, days: span,
    summary: `${PERF_MONTHS[s.getMonth()]} ${s.getDate()} – ${PERF_MONTHS[e.getMonth()]} ${e.getDate()}`,
  };
}

export function fmtPerfMinutes(mins) {
  if (!mins) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function MyPerformanceCard({ staffId }) {
  const [range, setRange] = useState('today');
  const today = useMemo(() => new Date(), []);
  const [customStart, setCustomStart] = useState(() => perfIsoDay(perfAddDays(new Date(), -13)));
  const [customEnd, setCustomEnd]     = useState(() => perfIsoDay(new Date()));
  const [customOpen, setCustomOpen] = useState(false);

  function pickRange(v) {
    setRange(v);
    setCustomOpen(v === 'custom');
  }

  const view = useMemo(
    () => perfResolveView(range, customStart, customEnd, today),
    [range, customStart, customEnd, today]
  );

  const data = useMemo(() => buildEmployeeReport(view, staffId), [view, staffId]);

  return (
    <Card className="p-5" id="my-performance">
      <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h3 className="font-serif text-[22px] text-ink leading-tight">My performance</h3>
          <div className="text-[12.5px] text-muted">Your appointments and time worked for the selected range.</div>
        </div>
        <div className="relative">
          <Tabs value={range} onChange={pickRange} tabs={PERF_RANGE_TABS} />
          {range === 'custom' && (
            <PerfCustomRangePanel
              open={customOpen}
              onOpenChange={setCustomOpen}
              start={customStart}
              end={customEnd}
              onApply={(s, e) => { setCustomStart(s); setCustomEnd(e); setCustomOpen(false); }}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PerfStat
          label="Completed appointments"
          value={data.completed}
          accent
          sub={
            data.completed > 0
              ? <>across {data.completed} appointment{data.completed === 1 ? '' : 's'} · {view.summary.toLowerCase()}</>
              : <>None completed in {view.summary.toLowerCase()}.</>
          }
        />
        <PerfStat
          label="Time in appointments"
          value={fmtPerfMinutes(data.minutes)}
          sub={
            data.minutes > 0
              ? <><span className="text-ink font-medium tabular-nums">{data.minutes.toLocaleString()}</span> minutes · {view.summary.toLowerCase()}</>
              : <>No time logged yet.</>
          }
        />
      </div>

      {/* Mini chart — daily/weekly distribution; hidden for "today" */}
      {view.mode !== 'today' && (
        <div className="mt-5 pt-4 border-t border-line">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11.5px] uppercase tracking-[0.12em] text-muted font-medium">
              {view.mode === 'weekly' ? 'Weekly bookings' : 'Daily bookings'}
            </div>
            <div className="text-[11.5px] text-muted">{view.summary}</div>
          </div>
          <PerfMiniChart buckets={data.buckets} />
        </div>
      )}
    </Card>
  );
}

export function PerfStat({ label, value, sub, accent }) {
  return (
    <div className="bg-bg/60 border border-line rounded-xl2 p-4">
      <div className="text-[11.5px] uppercase tracking-[0.12em] text-muted font-medium">{label}</div>
      <div className={cx('font-serif text-[40px] leading-none mt-2 tabular-nums', accent ? 'text-accent' : 'text-ink')}>{value}</div>
      {sub ? <div className="text-[12.5px] text-ink2 mt-2.5">{sub}</div> : null}
    </div>
  );
}

export function PerfMiniChart({ buckets }) {
  const peak = Math.max(1, ...buckets.map(b => b.count));
  // Sparse x-labels — first, last, and a few in between
  const n = buckets.length;
  const labelIdx = new Set([0, n - 1]);
  if (n >= 5) {
    const step = Math.max(1, Math.floor((n - 1) / 4));
    for (let i = step; i < n - 1; i += step) labelIdx.add(i);
  }

  return (
    <div>
      <div className="flex items-end gap-[3px] h-[72px]">
        {buckets.map((b, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end items-stretch min-w-0 h-full group relative"
               title={`${b.tip} — ${b.count} appt${b.count === 1 ? '' : 's'} · ${fmtPerfMinutes(b.minutes)}`}>
            {b.count > 0
              ? <div className="bg-accent/80 hover:bg-accent rounded-sm transition" style={{ height: `${(b.count / peak) * 100}%`, minHeight: '2px' }} />
              : <div className="bg-line rounded-sm" style={{ height: '2px' }} />
            }
          </div>
        ))}
      </div>
      <div className="flex text-[10.5px] text-muted mt-2">
        {buckets.map((b, i) => (
          <div key={i} className="flex-1 text-left min-w-0">
            {labelIdx.has(i) && <span className="whitespace-nowrap">{b.label}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// Builds the per-employee aggregates from the shared APPOINTMENTS demo data.
export function buildEmployeeReport(view, staffId) {
  const mine = APPOINTMENTS.filter(a => a.staffId === staffId);

  // Per-bucket totals
  const buckets = [];
  let total = 0, minutes = 0, completed = 0, upcoming = 0, canceled = 0;

  function tally(appt) {
    if (appt.status === 'canceled') { canceled++; return; }
    total++;
    minutes += appt.duration || 0;
    // No-shows are "closed" like completed for performance purposes — they
    // already happened and aren't coming back into the schedule.
    if (appt.status === 'completed' || appt.status === 'no_show') completed++;
    else upcoming++;
  }

  if (view.mode === 'today') {
    const dk = perfIsoDay(view.date);
    mine.filter(a => a.day === dk).forEach(tally);
  } else if (view.mode === 'daily') {
    let d = new Date(view.startDate);
    while (d <= view.endDate) {
      const dk = perfIsoDay(d);
      const dayAppts = mine.filter(a => a.day === dk);
      let count = 0, mins = 0;
      dayAppts.forEach(a => {
        tally(a);
        if (a.status !== 'canceled') { count++; mins += a.duration || 0; }
      });
      buckets.push({
        count, minutes: mins,
        label: `${PERF_MONTHS[d.getMonth()]} ${d.getDate()}`,
        tip:   `${PERF_MONTHS[d.getMonth()]} ${d.getDate()}`,
      });
      d = perfAddDays(d, 1);
    }
  } else {
    // weekly — walk back from endDate in 7-day chunks
    let weekEnd = new Date(view.endDate);
    const weeks = [];
    while (weekEnd >= view.startDate) {
      const weekStart = perfAddDays(weekEnd, -6);
      const wsClamped = weekStart < view.startDate ? new Date(view.startDate) : weekStart;
      let count = 0, mins = 0;
      for (let dd = new Date(wsClamped); dd <= weekEnd; dd = perfAddDays(dd, 1)) {
        const dk = perfIsoDay(dd);
        mine.filter(a => a.day === dk).forEach(a => {
          tally(a);
          if (a.status !== 'canceled') { count++; mins += a.duration || 0; }
        });
      }
      weeks.unshift({
        count, minutes: mins,
        label: `${PERF_MONTHS[wsClamped.getMonth()]} ${wsClamped.getDate()}`,
        tip:   `Week of ${PERF_MONTHS[wsClamped.getMonth()]} ${wsClamped.getDate()}`,
      });
      weekEnd = perfAddDays(weekStart, -1);
    }
    buckets.push(...weeks);
  }

  return { total, minutes, completed, upcoming, canceled, buckets };
}

// Custom range picker — same UX as the Reports page on index.html.
export function PerfCustomRangePanel({ open, onOpenChange, start, end, onApply }) {
  const [s, setS] = useState(start);
  const [e, setE] = useState(end);
  const panelRef = useRef(null);

  useEffect(() => { setS(start); setE(end); }, [start, end, open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev) => {
      if (panelRef.current && !panelRef.current.contains(ev.target)) onOpenChange(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onOpenChange]);

  const valid = s && e && s <= e;
  const spanDays = valid ? perfDaysBetween(s, e) + 1 : 0;

  if (!open) return null;

  return (
    <div ref={panelRef}
         className="absolute right-0 top-[calc(100%+8px)] z-30 w-[320px] bg-surface rounded-xl2 border border-line shadow-pop p-4 fadein">
      <div className="text-[12px] uppercase tracking-[0.12em] text-muted font-medium mb-3">Custom range</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start" plain>
          <DateInput value={s} max={e} onChange={(v) => setS(v)} />
        </Field>
        <Field label="End" plain>
          <DateInput value={e} min={s} max={perfIsoDay(new Date())} onChange={(v) => setE(v)} align="right" />
        </Field>
      </div>
      <div className="mt-3 flex items-center justify-between text-[12px]">
        <span className="text-muted">
          {valid ? `${spanDays} day${spanDays === 1 ? '' : 's'} · ${spanDays > 30 ? 'weekly' : 'daily'} buckets` : 'Pick a valid range'}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" size="sm" disabled={!valid} onClick={() => onApply(s, e)}>
            Apply
          </Button>
        </div>
      </div>
      <div className="mt-3 -mx-1 flex flex-wrap gap-1">
        {[
          ['Yesterday',    -1, -1],
          ['Last 14 days', -13, 0],
          ['This month',   'month-start', 0],
          ['Last 90 days', -89, 0],
        ].map(([label, sOff, eOff]) => (
          <button key={label}
            onClick={() => {
              const today = new Date();
              const startD = sOff === 'month-start'
                ? new Date(today.getFullYear(), today.getMonth(), 1)
                : perfAddDays(today, sOff);
              const endD = perfAddDays(today, eOff);
              setS(perfIsoDay(startD));
              setE(perfIsoDay(endD));
            }}
            className="px-2 h-7 rounded-md text-[11.5px] text-ink2 hover:text-ink hover:bg-bg/70 border border-line2/60">
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

window.EmployeeDashboard = EmployeeDashboard;
