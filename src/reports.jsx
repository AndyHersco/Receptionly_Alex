import { useEffect, useMemo, useRef, useState } from 'react';
import { ACCOUNT, APPOINTMENTS, SERVICES, STAFF } from './data';
import { Button, Card, DateInput, Field, SectionHeader, StaffAvatar, Tabs, cx } from './ui';

// Reports page — adapts chart bucketing to the selected range.
//   today  -> hourly  (24 buckets, labels at 12am / 6am / 12pm / 6pm)
//   7d     -> daily   (7 buckets,  every day labeled lightly)
//   30d    -> daily   (30 buckets, label every ~5 days)
//   90d    -> weekly  (13 buckets, label each week)
//   custom -> daily if span ≤30d, weekly otherwise

export const RANGE_TABS = [
  { value: 'today',  label: 'Today' },
  { value: '7d',     label: '7d' },
  { value: '30d',    label: '30d' },
  { value: '90d',    label: '90d' },
  { value: 'custom', label: 'Custom' },
];

export function ReportsPage() {
  const [range, setRange] = useState('today');

  // Custom date range — defaults to last 14 days
  const today = useMemo(() => new Date(), []);
  const [customStart, setCustomStart] = useState(() => isoDay(addDays(new Date(), -13)));
  const [customEnd, setCustomEnd] = useState(() => isoDay(new Date()));
  const [customOpen, setCustomOpen] = useState(false);

  // When the user picks "Custom", auto-open the picker
  function pickRange(v) {
    setRange(v);
    setCustomOpen(v === 'custom');
  }

  const view = useMemo(() => resolveView(range, customStart, customEnd, today), [range, customStart, customEnd, today]);
  const data = useMemo(() => buildReport(view), [view]);

  const comparisonLabel = view.mode === 'hourly'
    ? 'vs. yesterday'
    : `vs. previous ${view.days} day${view.days === 1 ? '' : 's'}`;

  const titlesByMode = {
    hourly: 'Hourly bookings',
    daily:  'Daily bookings',
    weekly: 'Weekly bookings',
  };

  const aiOn = ACCOUNT.aiAgentEnabled !== false;
  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Insights"
        title="Reports"
        subtitle={aiOn
          ? "Where your time and revenue go. AI-booked appointments are tracked separately so you can see the lift."
          : "Where your time and revenue go."}
        right={
          <div className="relative">
            <Tabs value={range} onChange={pickRange} tabs={RANGE_TABS} />
            {range === 'custom' && (
              <CustomRangePanel
                open={customOpen}
                onOpenChange={setCustomOpen}
                start={customStart}
                end={customEnd}
                onApply={(s, e) => { setCustomStart(s); setCustomEnd(e); setCustomOpen(false); }}
                summary={view.summary}
              />
            )}
          </div>
        }
      />

      <div className={cx('grid gap-4 grid-cols-2', aiOn ? 'md:grid-cols-4' : 'md:grid-cols-3')}>
        <KPI label="Appointments booked"
             value={String(data.booked)}
             delta={data.bookedDelta}
             sub={comparisonLabel} />
        <KPI label="Revenue"
             value={'$' + data.revenue.toLocaleString()}
             delta={data.revenueDelta}
             sub={comparisonLabel}
             accent />
        <KPI label="No-Shows"
             value={String(data.noShows)}
             sub={`${pct(data.noShows, data.booked)} of bookings`}
             tone="rose" />
        {aiOn && (
          <KPI label="AI bookings"
               value={String(data.aiBookings)}
               sub={`${pct(data.aiBookings, data.booked)} of bookings`} />
        )}
      </div>

      <div className={cx('grid gap-5', aiOn ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1')}>
        <Card className={cx('p-5', aiOn && 'lg:col-span-2')}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-serif text-[22px] text-ink leading-tight">{titlesByMode[view.mode]}</h3>
              <div className="text-[12.5px] text-muted">{aiOn ? 'Online + phone + AI receptionist' : 'Online + phone'}</div>
            </div>
            {aiOn && (
              <div className="flex items-center gap-3 text-[11.5px] text-ink2">
                <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent"/> Manual</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warm"/> AI</span>
              </div>
            )}
          </div>
          <BookingsChart buckets={data.buckets} mode={view.mode} showAi={aiOn} />
        </Card>

        {aiOn && (
          <Card className="p-5">
            <h3 className="font-serif text-[22px] text-ink leading-tight mb-3">AI receptionist lift</h3>
            <div className="flex items-end gap-2">
              <div className="font-serif text-[48px] leading-none text-warm">{pct(data.aiBookings, data.booked, 0)}</div>
              <div className="text-[12.5px] text-ink2 pb-1.5">of bookings via AI receptionist</div>
            </div>
            <div className="mt-5 space-y-3.5">
              <SplitRow label="AI-booked" value={data.aiBookings} total={Math.max(1, data.booked)} color="#C97A4F" soft />
              <SplitRow label="Manual (online/phone)" value={data.manualCount} total={Math.max(1, data.booked)} color="#C97A4F" />
            </div>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="font-serif text-[22px] text-ink leading-tight mb-4">Staff utilization</h3>
          <div className="space-y-3">
            {STAFF.map((s) => {
              const appts = data.staffAppts[s.id] || 0;
              const maxAppts = Math.max(1, ...Object.values(data.staffAppts));
              return (
                <div key={s.id} className="flex items-center gap-3">
                  <StaffAvatar staff={s} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-[13.5px]">
                      <span className="text-ink truncate">{s.name}</span>
                      <span className="text-ink2 tabular-nums">{appts} appts</span>
                    </div>
                    <div className="h-1.5 bg-line rounded-full overflow-hidden mt-1.5">
                      <div className="h-full rounded-full" style={{ width: `${(appts / maxAppts) * 100}%`, background: appts > 0 ? s.color : 'transparent' }}/>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-serif text-[22px] text-ink leading-tight mb-4">Most-booked services</h3>
          {data.services.length === 0 ? (
            <div className="text-[13px] text-muted py-8 text-center">No services booked in this range.</div>
          ) : (
            <div className="space-y-2">
              {data.services.map((s, i) => {
                const max = data.services[0].count;
                return (
                  <div key={i} className="flex items-center gap-3 py-1.5">
                    <span className="w-5 text-[12px] text-muted tabular-nums">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] text-ink truncate">{s.name}</div>
                      <div className="h-[2px] bg-line rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-ink" style={{ width: `${(s.count / max) * 100}%` }} />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-medium text-ink tabular-nums">{s.count}</div>
                      <div className="text-[11px] text-muted tabular-nums">${s.revenue.toLocaleString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5" id="staff-performance">
        <div className="flex items-end justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h3 className="font-serif text-[22px] text-ink leading-tight">Staff performance</h3>
            <div className="text-[12.5px] text-muted">Per-employee revenue, bookings, and time worked — ranked by revenue for {view.summary.toLowerCase()}.</div>
          </div>
        </div>
        <StaffPerformanceTable
          staffRevenue={data.staffRevenue}
          staffAppts={data.staffAppts}
          staffMinutes={data.staffMinutes}
        />
      </Card>
    </div>
  );
}

// ----- KPI / shared display bits ------------------------------------------

export function KPI({ label, value, delta, sub, accent, tone }) {
  const isNeg = delta && (delta.startsWith('-') || delta.startsWith('−'));
  const isPos = delta && delta.startsWith('+');
  const valueColor = accent ? 'text-accent'
    : tone === 'rose' ? 'text-rose'
    : 'text-ink';
  return (
    <Card className="p-4">
      <div className="text-[11.5px] uppercase tracking-[0.12em] text-muted font-medium">{label}</div>
      <div className={cx('font-serif text-[40px] leading-none mt-3', valueColor)}>{value}</div>
      <div className="mt-3 leading-tight">
        {delta && (
          <div className={cx('text-[12.5px] font-medium tabular-nums', isPos ? 'text-accent' : isNeg ? 'text-rose' : 'text-ink2')}>
            {delta}
          </div>
        )}
        {sub && (
          <div className={cx('text-[11.5px] text-muted', delta ? 'mt-0.5' : '')}>{sub}</div>
        )}
      </div>
    </Card>
  );
}

export function SplitRow({ label, value, total, color, soft }) {
  const w = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[13px] mb-1.5">
        <span className="text-ink">{label}</span>
        <span className="text-ink2 tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 bg-warmSoft rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${w}%`, background: color, opacity: soft ? 0.35 : 1 }}/>
      </div>
    </div>
  );
}

// ----- Staff performance table -------------------------------------------

export function formatMinutes(mins) {
  if (!mins) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function StaffPerformanceTable({ staffRevenue, staffAppts, staffMinutes }) {
  const rows = STAFF.map((s) => ({
    staff: s,
    revenue: staffRevenue[s.id] || 0,
    appts:   staffAppts[s.id]   || 0,
    minutes: staffMinutes[s.id] || 0,
  })).sort((a, b) =>
    b.revenue - a.revenue ||
    b.appts   - a.appts   ||
    b.minutes - a.minutes ||
    a.staff.name.localeCompare(b.staff.name)
  );

  const totals = rows.reduce((acc, r) => ({
    revenue: acc.revenue + r.revenue,
    appts:   acc.appts   + r.appts,
    minutes: acc.minutes + r.minutes,
  }), { revenue: 0, appts: 0, minutes: 0 });

  const maxRevenue = Math.max(1, ...rows.map(r => r.revenue));

  return (
    <div>
      {/* Header row — visible on >=sm */}
      <div className="hidden sm:grid grid-cols-[1.6fr_repeat(3,1fr)] gap-4 px-3 pb-2 border-b border-line text-[11px] uppercase tracking-[0.12em] text-muted font-medium">
        <div>Staff</div>
        <div className="text-right">Revenue</div>
        <div className="text-right">Appointments</div>
        <div className="text-right">Time worked</div>
      </div>

      <div className="divide-y divide-line">
        {rows.map(({ staff, revenue, appts, minutes }, i) => {
          const isTop = i === 0 && revenue > 0;
          const sharePct = totals.revenue > 0 ? (revenue / totals.revenue) * 100 : 0;
          return (
            <div key={staff.id}
                 className="grid grid-cols-2 sm:grid-cols-[1.6fr_repeat(3,1fr)] gap-x-4 gap-y-2 items-center px-3 py-3">

              {/* Staff cell — full width on mobile */}
              <div className="col-span-2 sm:col-span-1 flex items-center gap-3 min-w-0">
                <div className="w-5 text-[12px] text-muted tabular-nums shrink-0">{i + 1}</div>
                <StaffAvatar staff={staff} size={32} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[13.5px] text-ink truncate">
                    <span className="truncate">{staff.name}</span>
                    {isTop && (
                      <span className="hidden sm:inline-flex items-center text-[10px] uppercase tracking-[0.1em] text-warm border border-warm/30 bg-warm/[0.08] rounded-full px-1.5 py-0.5 leading-none whitespace-nowrap">Top</span>
                    )}
                  </div>
                  <div className="text-[11.5px] text-muted truncate">{staff.role}</div>
                </div>
              </div>

              {/* Revenue */}
              <div className="sm:text-right">
                <div className="sm:hidden text-[10.5px] uppercase tracking-[0.1em] text-muted font-medium mb-0.5">Revenue</div>
                <div className="text-[14px] font-medium text-ink tabular-nums">${revenue.toLocaleString()}</div>
                <div className="hidden sm:block h-[3px] bg-line rounded-full overflow-hidden mt-1.5 ml-auto" style={{ width: '70%' }}>
                  <div className="h-full bg-accent rounded-full" style={{ width: `${(revenue / maxRevenue) * 100}%` }}/>
                </div>
                <div className="text-[11px] text-muted tabular-nums sm:mt-1">
                  {totals.revenue > 0 ? `${sharePct.toFixed(0)}% of total` : '—'}
                </div>
              </div>

              {/* Appointments */}
              <div className="sm:text-right">
                <div className="sm:hidden text-[10.5px] uppercase tracking-[0.1em] text-muted font-medium mb-0.5">Appointments</div>
                <div className="text-[14px] font-medium text-ink tabular-nums">{appts}</div>
                <div className="text-[11px] text-muted tabular-nums mt-0.5 sm:mt-1">
                  {appts > 0 ? `$${Math.round(revenue / appts).toLocaleString()} avg` : '—'}
                </div>
              </div>

              {/* Time worked */}
              <div className="sm:text-right">
                <div className="sm:hidden text-[10.5px] uppercase tracking-[0.1em] text-muted font-medium mb-0.5">Time worked</div>
                <div className="text-[14px] font-medium text-ink tabular-nums">{formatMinutes(minutes)}</div>
                <div className="text-[11px] text-muted tabular-nums mt-0.5 sm:mt-1">
                  {minutes > 0 ? `${minutes.toLocaleString()} min` : '—'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals row */}
      <div className="hidden sm:grid grid-cols-[1.6fr_repeat(3,1fr)] gap-4 px-3 pt-3 mt-1 border-t border-line text-[12px]">
        <div className="text-muted uppercase tracking-[0.12em] text-[11px] font-medium">Team total</div>
        <div className="text-right text-ink font-medium tabular-nums">${totals.revenue.toLocaleString()}</div>
        <div className="text-right text-ink font-medium tabular-nums">{totals.appts}</div>
        <div className="text-right text-ink font-medium tabular-nums">{formatMinutes(totals.minutes)}</div>
      </div>

      {/* Mobile totals */}
      <div className="sm:hidden grid grid-cols-3 gap-2 pt-3 mt-1 border-t border-line">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.1em] text-muted font-medium">Total revenue</div>
          <div className="text-[14px] font-medium text-ink tabular-nums">${totals.revenue.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.1em] text-muted font-medium">Total appts</div>
          <div className="text-[14px] font-medium text-ink tabular-nums">{totals.appts}</div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.1em] text-muted font-medium">Total time</div>
          <div className="text-[14px] font-medium text-ink tabular-nums">{formatMinutes(totals.minutes)}</div>
        </div>
      </div>
    </div>
  );
}

// ----- Chart --------------------------------------------------------------

export function BookingsChart({ buckets, mode, showAi = true }) {
  const totals = buckets.map(b => showAi ? (b.manual + b.ai) : (b.manual + b.ai));
  const peak = Math.max(1, ...totals);
  // Pick a small set of y-axis ticks: 0, mid, peak (rounded up to a nice number)
  const niceMax = niceCeil(peak);
  const yTicks = niceMax <= 2 ? [0, 1]
    : niceMax <= 4 ? [0, Math.round(niceMax/2), niceMax]
    : [0, Math.round(niceMax/2), niceMax];

  const H = 200; // chart drawing area
  const X_PAD_LEFT = 36;

  // Pick a sparse subset of x-labels so they don't collide
  const xLabels = pickXLabels(buckets, mode);

  return (
    <div className="relative">
      <div className="relative" style={{ height: H + 28 }}>
        {/* Gridlines */}
        <div className="absolute right-0 top-0" style={{ left: X_PAD_LEFT, height: H }}>
          {yTicks.map((t) => (
            <div key={t} className="absolute left-0 right-0 border-t border-line/80"
                 style={{ top: `${(1 - t / niceMax) * 100}%` }}/>
          ))}
        </div>
        {/* Y labels */}
        <div className="absolute left-0 top-0" style={{ width: X_PAD_LEFT - 6, height: H }}>
          {yTicks.map((t) => (
            <div key={t} className="absolute right-0 -translate-y-1/2 text-[11px] text-muted tabular-nums"
                 style={{ top: `${(1 - t / niceMax) * 100}%` }}>{t}</div>
          ))}
        </div>

        {/* Bars */}
        <div className="absolute right-0 top-0 flex items-end gap-[3px]" style={{ left: X_PAD_LEFT, height: H }}>
          {buckets.map((b, i) => {
            const total = b.manual + b.ai;
            const tip = `${b.tip} — ${total} booking${total === 1 ? '' : 's'}`;
            const manualSeg = showAi ? b.manual : total;
            const aiSeg = showAi ? b.ai : 0;
            return (
              <div key={i} className="flex-1 flex flex-col justify-end items-stretch min-w-0 h-full group relative"
                   title={tip}>
                {aiSeg > 0 && <div className="bg-warm rounded-sm" style={{ height: `${(aiSeg / niceMax) * 100}%` }} />}
                {manualSeg > 0 && <div className="bg-accent rounded-sm" style={{ height: `${(manualSeg / niceMax) * 100}%` }} />}
              </div>
            );
          })}
        </div>

        {/* X-axis labels */}
        <div className="absolute right-0 flex text-[11px] text-muted" style={{ left: X_PAD_LEFT, top: H + 8 }}>
          {buckets.map((_, i) => {
            const label = xLabels[i];
            return (
              <div key={i} className="flex-1 text-left min-w-0">
                {label && <span className="whitespace-nowrap">{label}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function pickXLabels(buckets, mode) {
  const n = buckets.length;
  const arr = new Array(n).fill('');
  if (mode === 'hourly') {
    // 24 bars: label at 0, 6, 12, 18
    [0, 6, 12, 18].forEach(i => { if (buckets[i]) arr[i] = buckets[i].label; });
  } else if (mode === 'weekly') {
    // 13ish bars: label each
    buckets.forEach((b, i) => { arr[i] = b.label; });
  } else {
    // daily — sparse labels: target ~6 labels evenly
    const target = Math.min(6, n);
    const step = Math.max(1, Math.floor((n - 1) / (target - 1)));
    for (let i = 0; i < n; i += step) arr[i] = buckets[i].label;
    if (n > 1) arr[n - 1] = buckets[n - 1].label;
  }
  return arr;
}

export function niceCeil(n) {
  if (n <= 0) return 1;
  if (n <= 2) return 2;
  if (n <= 5) return 5;
  if (n <= 10) return 10;
  // Round up to next 5 / 10 / 50 etc.
  const mag = Math.pow(10, Math.floor(Math.log10(n)));
  return Math.ceil(n / mag) * mag;
}

// ----- Custom range picker -----------------------------------------------

export function CustomRangePanel({ open, onOpenChange, start, end, onApply, summary }) {
  const [s, setS] = useState(start);
  const [e, setE] = useState(end);
  const panelRef = useRef(null);

  useEffect(() => { setS(start); setE(end); }, [start, end, open]);

  // Click-away
  useEffect(() => {
    if (!open) return;
    const onDoc = (ev) => {
      if (panelRef.current && !panelRef.current.contains(ev.target)) onOpenChange(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onOpenChange]);

  const valid = s && e && s <= e;
  const spanDays = valid ? daysBetween(s, e) + 1 : 0;

  return (
    <>
      {open && (
        <div ref={panelRef}
             className="absolute right-0 top-[calc(100%+8px)] z-30 w-[320px] bg-surface rounded-xl2 border border-line shadow-pop p-4 fadein">
          <div className="text-[12px] uppercase tracking-[0.12em] text-muted font-medium mb-3">Custom range</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start" plain>
              <DateInput value={s} max={e} onChange={(v) => setS(v)} />
            </Field>
            <Field label="End" plain>
              <DateInput value={e} min={s} max={isoDay(new Date())} onChange={(v) => setE(v)} align="right" />
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
              ['Yesterday',   -1, -1],
              ['Last 14 days', -13, 0],
              ['This month',   'month-start', 0],
              ['Last 90 days', -89, 0],
            ].map(([label, sOff, eOff]) => (
              <button key={label}
                onClick={() => {
                  const today = new Date();
                  const startD = sOff === 'month-start'
                    ? new Date(today.getFullYear(), today.getMonth(), 1)
                    : addDays(today, sOff);
                  const endD = addDays(today, eOff);
                  setS(isoDay(startD));
                  setE(isoDay(endD));
                }}
                className="px-2 h-7 rounded-md text-[11.5px] text-ink2 hover:text-ink hover:bg-bg/70 border border-line2/60">
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ----- Date / view resolution --------------------------------------------

export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function isoDay(d) {
  const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
export function parseISO(s) { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); }
export function daysBetween(a, b) {
  const A = parseISO(a); const B = parseISO(b);
  return Math.round((B - A) / (1000*60*60*24));
}
export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function resolveView(range, customStart, customEnd, today) {
  if (range === 'today') return { mode: 'hourly', date: today, summary: 'Today' };
  if (range === '7d')    return { mode: 'daily',  startDate: addDays(today, -6),  endDate: today, days: 7, summary: 'Last 7 days' };
  if (range === '30d')   return { mode: 'daily',  startDate: addDays(today, -29), endDate: today, days: 30, summary: 'Last 30 days' };
  if (range === '90d')   return { mode: 'weekly', startDate: addDays(today, -89), endDate: today, days: 90, summary: 'Last 90 days' };
  // custom
  const span = daysBetween(customStart, customEnd) + 1;
  return {
    mode: span > 30 ? 'weekly' : 'daily',
    startDate: parseISO(customStart),
    endDate: parseISO(customEnd),
    days: span,
    summary: `${MONTHS[parseISO(customStart).getMonth()]} ${parseISO(customStart).getDate()} – ${MONTHS[parseISO(customEnd).getMonth()]} ${parseISO(customEnd).getDate()}`,
  };
}

// ----- Per-day booking aggregates ---------------------------------------

export function buildReport(view) {
  // Compute the date range
  let startKey, endKey;
  if (view.mode === 'hourly') {
    startKey = endKey = isoDay(view.date);
  } else {
    startKey = isoDay(view.startDate);
    endKey   = isoDay(view.endDate);
  }

  // Collect every appointment that falls in the range (incl. canceled, for the
  // cancellation count). All other stats only count non-canceled bookings.
  const inRange = APPOINTMENTS.filter(a => a.day >= startKey && a.day <= endKey);

  const staffAppts   = {}; STAFF.forEach(s => staffAppts[s.id]   = 0);
  const staffRevenue = {}; STAFF.forEach(s => staffRevenue[s.id] = 0);
  const staffMinutes = {}; STAFF.forEach(s => staffMinutes[s.id] = 0);
  const serviceTotals = {}; // name -> { count, revenue }
  let manualCount = 0, aiBookings = 0, cancellations = 0, noShows = 0;
  let revenue = 0;

  for (const a of inRange) {
    if (a.status === 'canceled') { cancellations += 1; continue; }
    if (a.status === 'no_show') noShows += 1;
    if (a.source === 'ai') aiBookings += 1; else manualCount += 1;
    const svc = SERVICES.find(s => s.id === a.serviceId);
    const price = svc?.price ?? a.price ?? 0;
    const dur   = svc?.duration ?? a.duration ?? 0;
    const name  = svc?.name ?? 'Service';
    revenue += price;
    serviceTotals[name] = serviceTotals[name] || { count: 0, revenue: 0 };
    serviceTotals[name].count += 1;
    serviceTotals[name].revenue += price;
    if (staffAppts[a.staffId] !== undefined) {
      staffAppts[a.staffId]   += 1;
      staffRevenue[a.staffId] += price;
      staffMinutes[a.staffId] += dur;
    }
  }

  // Bucket the appointments for the chart
  const buckets = [];
  if (view.mode === 'hourly') {
    for (let h = 0; h < 24; h++) {
      buckets.push({ manual: 0, ai: 0, label: hourLabel(h), tip: hourLabel(h) });
    }
    for (const a of inRange) {
      if (a.status === 'canceled') continue;
      const hr = parseInt(a.start.slice(0, 2), 10);
      if (hr >= 0 && hr < 24) {
        if (a.source === 'ai') buckets[hr].ai += 1;
        else buckets[hr].manual += 1;
      }
    }
  } else if (view.mode === 'daily') {
    let d = new Date(view.startDate);
    while (d <= view.endDate) {
      const dk = isoDay(d);
      let manual = 0, ai = 0;
      for (const a of inRange) {
        if (a.day !== dk || a.status === 'canceled') continue;
        if (a.source === 'ai') ai += 1; else manual += 1;
      }
      buckets.push({ manual, ai, label: `${MONTHS[d.getMonth()]} ${d.getDate()}`, tip: `${MONTHS[d.getMonth()]} ${d.getDate()}` });
      d = addDays(d, 1);
    }
  } else { // weekly
    let weekEnd = new Date(view.endDate);
    const weeks = [];
    while (weekEnd >= view.startDate) {
      const weekStart = addDays(weekEnd, -6);
      const wsClamped = weekStart < view.startDate ? new Date(view.startDate) : weekStart;
      let manual = 0, ai = 0;
      for (let dd = new Date(wsClamped); dd <= weekEnd; dd = addDays(dd, 1)) {
        const dk = isoDay(dd);
        for (const a of inRange) {
          if (a.day !== dk || a.status === 'canceled') continue;
          if (a.source === 'ai') ai += 1; else manual += 1;
        }
      }
      weeks.unshift({
        manual, ai,
        label: `${MONTHS[wsClamped.getMonth()]} ${wsClamped.getDate()}`,
        tip:   `Week of ${MONTHS[wsClamped.getMonth()]} ${wsClamped.getDate()}`,
      });
      weekEnd = addDays(weekStart, -1);
    }
    buckets.push(...weeks);
  }

  const booked = manualCount + aiBookings;

  // Deltas: compare to the previous equivalent period for stable demo numbers.
  function deltaPct(curr, prev) {
    if (!prev && !curr) return '0.0%';
    if (!prev) return '+100.0%';
    const v = ((curr - prev) / prev) * 100;
    return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
  }
  // Previous period: same length, ending just before the current period.
  let prevBooked = 0, prevRevenue = 0;
  if (view.mode === 'hourly') {
    // Previous = yesterday
    const yk = isoDay(addDays(view.date, -1));
    for (const a of APPOINTMENTS) {
      if (a.day === yk && a.status !== 'canceled') {
        prevBooked += 1;
        prevRevenue += (SERVICES.find(s => s.id === a.serviceId)?.price ?? a.price ?? 0);
      }
    }
  } else {
    const spanDays = Math.round((view.endDate - view.startDate) / 86400000) + 1;
    const prevEnd = addDays(view.startDate, -1);
    const prevStart = addDays(prevEnd, -(spanDays - 1));
    const psk = isoDay(prevStart), pek = isoDay(prevEnd);
    for (const a of APPOINTMENTS) {
      if (a.day >= psk && a.day <= pek && a.status !== 'canceled') {
        prevBooked += 1;
        prevRevenue += (SERVICES.find(s => s.id === a.serviceId)?.price ?? a.price ?? 0);
      }
    }
  }
  const bookedDelta  = deltaPct(booked, prevBooked);
  const revenueDelta = deltaPct(revenue, prevRevenue);

  const services = Object.entries(serviceTotals)
    .map(([name, v]) => ({ name, count: v.count, revenue: v.revenue }))
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue);

  return {
    buckets,
    booked,
    revenue,
    bookedDelta,
    revenueDelta,
    cancellations,
    noShows,
    aiBookings,
    manualCount,
    staffAppts,
    staffRevenue,
    staffMinutes,
    services,
  };
}

export function hourLabel(h) {
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

export function pct(part, total, digits = 1) {
  if (!total) return '0.0%';
  return (part / total * 100).toFixed(digits) + '%';
}

window.ReportsPage = ReportsPage;
