import { AlertsPanel } from './alerts';
import { ACCOUNT, BUSINESS, CUSTOMERS, SERVICES, STAFF, fmt12, parseDay, toMin, todayKey } from './data';
import { I } from './icons';
import { Badge, Card, CustomerAvatar, StaffAvatar, StatusPill, cx } from './ui';

// Dashboard page — redesigned to match the PDF spec.
//
// Layout:
//   • Eyebrow with business name → big "Good morning," → today's date
//   • 4 stat cards (today, revenue, open slots, customers)
//   • 2-column grid:
//       Left  (2/3): Today's schedule, Recent activity
//       Right (1/3): Upcoming, Team today
//
// The previous dashboard with AI receptionist + quick actions lives in
// `dashboard-v1.jsx` for reference.

export function DashboardPage({ appointments, onOpen, onNav, onAddAppointment }) {
  const today = todayKey();
  const todays = appointments.filter((a) => a.day === today);
  const remaining = todays.filter((a) => a.status !== 'completed' && a.status !== 'canceled' && a.status !== 'no_show');
  const confirmed = todays.filter((a) => a.status === 'confirmed');
  const completed = todays.filter((a) => a.status === 'completed');
  const onlineToday = todays.filter((a) => a.source === 'online').length;
  const aiToday = todays.filter((a) => a.source === 'ai').length;
  const revenue = todays
    .filter((a) => a.status !== 'canceled')
    .reduce((s, a) => s + (SERVICES.find((x) => x.id === a.serviceId)?.price || 0), 0);

  // Expected weekly revenue — sum of price for non-canceled appointments in the
  // next 7 days (inclusive of today).
  const weekStart = new Date(); weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
  const expectedWeekly = appointments
    .filter((a) => {
      if (a.status === 'canceled') return false;
      const d = parseDay(a.day);
      return d >= weekStart && d < weekEnd;
    })
    .reduce((s, a) => s + (SERVICES.find((x) => x.id === a.serviceId)?.price || 0), 0);

  // Capacity: working staff today × business open minutes.
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
  const bHours = BUSINESS.hours[dow];
  const businessOpenMin = bHours && !bHours.closed ? toMin(bHours.close) - toMin(bHours.open) : 0;
  const workingStaff = STAFF.filter((s) => {
    const h = s.hours[dow];
    return h && h !== 'off';
  });
  const capacityMin = workingStaff.length * businessOpenMin;
  const bookedMin = todays
    .filter((a) => a.status !== 'canceled')
    .reduce((s, a) => s + a.duration, 0);
  const openSlots = Math.max(0, Math.floor((capacityMin - bookedMin) / 30));

  // Today's appointments sorted by start
  const todaysSorted = [...todays].sort((a, b) => toMin(a.start) - toMin(b.start));
  const upcoming = remaining.sort((a, b) => toMin(a.start) - toMin(b.start));

  // Recent activity = most-recently-booked appointments (use id order as proxy)
  const recent = [...appointments]
    .filter((a) => a.status !== 'canceled')
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, 5);

  // Team today — staff with today's appointment count
  const teamToday = STAFF.map((s) => ({
    staff: s,
    count: todays.filter((a) => a.staffId === s.id && a.status !== 'canceled').length,
    working: s.hours[dow] && s.hours[dow] !== 'off',
  }));

  const greet = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const todayLong = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-medium mb-3">
          {BUSINESS.name.toUpperCase()}
        </div>
        <h1 className="font-serif text-[52px] leading-[1.02] text-ink">{greet}, {ACCOUNT.ownerName.split(' ')[0]}.</h1>
        <p className="text-[14px] text-muted mt-2">Today — {todayLong}</p>
      </div>

      {/* Stat tiles — 8-up, two rows of four. Row 1: appointment progress; row 2: revenue + channels. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          icon={<I.Calendar size={15} />}
          tone="neutral"
          value={todays.length}
          label="Today's appointments"
        />
        <StatTile
          icon={<I.Check size={15} stroke={2} />}
          tone="accent"
          value={completed.length}
          label="Completed"
        />
        <StatTile
          icon={<I.Clock size={15} />}
          tone="accent"
          value={remaining.length}
          label="Upcoming appointments"
        />
        <StatTile
          icon={<I.Sparkles size={15} />}
          tone="neutral"
          value={openSlots > 0 ? openSlots : '—'}
          label="Open slots today"
        />
        <StatTile
          icon={<I.Dollar size={15} />}
          tone="warm"
          value={`$${revenue.toLocaleString()}`}
          label="Revenue today"
        />
        <StatTile
          icon={<I.Chart size={15} />}
          tone="warm"
          value={`$${expectedWeekly.toLocaleString()}`}
          label="Expected weekly revenue"
        />
        <StatTile
          icon={<I.Globe size={15} />}
          tone="neutral"
          value={onlineToday}
          label="Online bookings"
        />
        {ACCOUNT.aiAgentEnabled !== false && (
          <StatTile
            icon={<I.Sparkle size={15} />}
            tone="warm"
            value={aiToday}
            label="AI bookings"
          />
        )}
      </div>

      {/* Important alerts — from the AI voice agent */}
      {ACCOUNT.aiAgentEnabled !== false && <AlertsPanel onOpenAppt={onOpen} />}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column — schedule + recent activity */}
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-0 overflow-hidden">
            <div className="flex items-baseline justify-between px-5 pt-5 pb-3">
              <h3 className="font-serif text-[22px] text-ink leading-tight">Today's schedule</h3>
              <div className="text-[12px] text-muted">
                {todays.length} {todays.length === 1 ? 'appointment' : 'appointments'}
              </div>
            </div>
            <div className="divide-y divide-line/70">
              {todaysSorted.length === 0 ? (
                <div className="px-5 py-10 text-center text-[13px] text-muted">
                  No appointments today.
                  <button onClick={onAddAppointment} className="ml-2 text-accentInk font-medium hover:underline">Add one →</button>
                </div>
              ) : (
                todaysSorted.map((a) => <ScheduleRow key={a.id} appt={a} onOpen={onOpen} />)
              )}
            </div>
            <button
              onClick={() => onNav('calendar')}
              className="w-full text-center py-2.5 text-[12.5px] font-medium text-ink2 hover:text-ink hover:bg-bg/70 border-t border-line transition">
              Open calendar →
            </button>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="flex items-baseline justify-between px-5 pt-5 pb-3">
              <h3 className="font-serif text-[22px] text-ink leading-tight">Recent activity</h3>
              <button onClick={() => onNav('appointments')} className="text-[12.5px] text-muted hover:text-ink transition">View all →</button>
            </div>
            <div className="divide-y divide-line/70">
              {recent.map((a) => <ActivityRow key={a.id} appt={a} onOpen={onOpen} />)}
            </div>
          </Card>
        </div>

        {/* Right column — upcoming + team today */}
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="font-serif text-[22px] text-ink leading-tight">Upcoming</h3>
              <div className="text-[11px] text-muted uppercase tracking-wider">Next up</div>
            </div>
            {upcoming.length === 0 ? (
              <div className="text-[13px] text-muted py-3">All wrapped up for today.</div>
            ) : (
              <div className="space-y-2.5">
                {upcoming.slice(0, 3).map((a) => <UpcomingRow key={a.id} appt={a} onOpen={onOpen} />)}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="font-serif text-[22px] text-ink leading-tight">Team today</h3>
              <div className="text-[11px] text-muted uppercase tracking-wider">
                {teamToday.filter((t) => t.working).length} working
              </div>
            </div>
            <div className="space-y-1">
              {teamToday
                .sort((a, b) => a.staff.name.localeCompare(b.staff.name))
                .map((t) => (
                  <TeamRow key={t.staff.id} item={t} onNav={() => onNav('staff')} />
                ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// --- Stat tile ----------------------------------------------------------------
// Icon chip top-left, oversized serif value, label below. Tones tint the chip.
export function StatTile({ icon, value, label, tone = 'neutral' }) {
  const chipTones = {
    neutral: 'bg-bg/70 text-ink2',
    accent: 'bg-accentSoft text-accent',
    warm: 'bg-warmSoft text-[#C97A4F]',
  };
  return (
    <Card className="p-5">
      <div className={cx('w-9 h-9 rounded-lg flex items-center justify-center mb-5', chipTones[tone])}>
        {icon}
      </div>
      <div className="font-serif leading-none text-ink" style={{ fontSize: 44 }}>{value}</div>
      <div className="text-[13px] text-muted mt-3">{label}</div>
    </Card>
  );
}

// --- Schedule row -------------------------------------------------------------
export function ScheduleRow({ appt, onOpen }) {
  const svc = SERVICES.find((s) => s.id === appt.serviceId);
  const staff = STAFF.find((s) => s.id === appt.staffId);
  const cust = CUSTOMERS.find((c) => c.id === appt.customerId);
  return (
    <button
      onClick={() => onOpen(appt)}
      className="w-full flex items-center gap-4 px-5 py-3 hover:bg-bg/60 transition text-left">
      <div className="w-14 flex-shrink-0">
        <div className="text-[13.5px] font-semibold text-ink leading-tight">{fmt12(appt.start)}</div>
        <div className="text-[11px] text-muted mt-0.5">{appt.duration}m</div>
      </div>
      <StaffAvatar staff={staff} size={30} />
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-medium text-ink truncate">{cust?.name || 'Walk-in'}</div>
        <div className="text-[12px] text-ink2 truncate">
          {svc?.name} <span className="text-muted">· {staff?.name}</span>
        </div>
      </div>
      {appt.source === 'ai' && ACCOUNT.aiAgentEnabled !== false && <Badge tone="warm"><I.Mic size={10} /> AI</Badge>}
      <StatusPill status={appt.status} />
    </button>
  );
}

// --- Upcoming row (right column, smaller) -------------------------------------
export function UpcomingRow({ appt, onOpen }) {
  const svc = SERVICES.find((s) => s.id === appt.serviceId);
  const staff = STAFF.find((s) => s.id === appt.staffId);
  const cust = CUSTOMERS.find((c) => c.id === appt.customerId);
  return (
    <button
      onClick={() => onOpen(appt)}
      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-bg/70 transition text-left">
      <StaffAvatar staff={staff} size={32} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-ink truncate">{cust?.name || 'Walk-in'}</div>
        <div className="text-[11.5px] text-muted truncate">{fmt12(appt.start)} · {svc?.name}</div>
      </div>
    </button>
  );
}

// --- Team today row -----------------------------------------------------------
export function TeamRow({ item, onNav }) {
  const { staff, count, working } = item;
  return (
    <button
      onClick={onNav}
      className={cx(
        'w-full flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-bg/70 transition text-left',
        !working && 'opacity-50'
      )}>
      <StaffAvatar staff={staff} size={30} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-ink truncate leading-tight">{staff.name}</div>
        <div className="text-[11.5px] text-muted truncate">{staff.role}</div>
      </div>
      <div
        className={cx(
          'flex items-center justify-center min-w-[28px] h-[24px] px-2 rounded-md font-mono text-[12px] font-medium tabular-nums',
          count > 0 ? 'bg-accentSoft text-accentInk' : 'bg-bg text-muted'
        )}>
        {count}
      </div>
    </button>
  );
}

// --- Recent activity row (table-style) ---------------------------------------
export function ActivityRow({ appt, onOpen }) {
  const svc = SERVICES.find((s) => s.id === appt.serviceId);
  const staff = STAFF.find((s) => s.id === appt.staffId);
  const cust = CUSTOMERS.find((c) => c.id === appt.customerId);
  const isToday = appt.day === todayKey();
  const dayLabel = isToday
    ? fmt12(appt.start)
    : (() => {
        const d = parseDay(appt.day);
        return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${fmt12(appt.start)}`;
      })();

  const aiOn = ACCOUNT.aiAgentEnabled !== false;
  const sourceLabel = {
    online: 'Online',
    ai: aiOn ? 'AI' : 'Online',
    phone: 'Phone',
    walkin: 'Walk-in',
  }[appt.source] || appt.source;
  const sourceTone = {
    online: 'accent',
    ai: aiOn ? 'warm' : 'accent',
    phone: 'neutral',
    walkin: 'neutral',
  }[appt.source] || 'neutral';

  return (
    <button
      onClick={() => onOpen(appt)}
      className="w-full grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3 hover:bg-bg/60 transition text-left">
      <div className="min-w-0 flex items-center gap-3">
        <CustomerAvatar name={cust?.name || '—'} size={26} />
        <div className="min-w-0">
          <div className="text-[13px] text-ink truncate">
            <span className="font-medium">{cust?.name || 'Unknown'}</span>
            <span className="text-muted"> · {svc?.name}</span>
            <span className="text-muted"> with {staff?.name}</span>
          </div>
        </div>
      </div>
      <div className="text-[12px] text-ink2 tabular-nums whitespace-nowrap">{dayLabel}</div>
      <Badge tone={sourceTone}>{sourceLabel}</Badge>
    </button>
  );
}

window.DashboardPage = DashboardPage;
