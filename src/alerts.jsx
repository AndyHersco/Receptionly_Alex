import { useMemo, useState } from 'react';
import { APPOINTMENTS, CUSTOMERS, SERVICES, STAFF, fmt12, getActiveLocation } from './data';
import { I } from './icons';
import { Badge, Card, StaffAvatar, cx } from './ui';

// Important Alerts — surfaced from the AI voice agent.
// One source of truth for both dashboards. Filter by `staffId` for the
// employee view; pass none to show everything for the business.

export const ALERT_TYPES = {
  late:       { label: 'Running 5 min late', icon: 'Clock',   tone: 'warm' },
  cancel:     { label: 'Same-day cancel',    icon: 'X',       tone: 'rose' },
  reschedule: { label: 'Same-day reschedule', icon: 'Refresh', tone: 'amber' },
};

// Sample alerts live on each location object (data.jsx). When the owner
// switches locations in index.html, the dashboard remounts (its container
// is keyed by activeLocId), so this panel re-initializes from the new
// location's alerts and there's no cross-location leak.
// (See data.jsx: HAYES_ALERTS, MISSION_ALERTS — each scoped to its own
// customer/appointment IDs so lookups always resolve.)
// ---------------------------------------------------------------------------
// AlertsPanel — full card with header + list of alerts.
//
// Props:
//   • staffId      — when set, only show alerts whose related appointment is
//                    with this staff member (employee view).
//   • onOpenAppt   — opens the appointment drawer/modal when the appt link
//                    is clicked. Optional.
//   • maxVisible   — collapse beyond this count (default 3); a "Show more"
//                    chip expands the rest.
// ---------------------------------------------------------------------------
export function AlertsPanel({ staffId, onOpenAppt, maxVisible = 3 }) {
  // Pull the current location's seed alerts. Slice so subsequent mutations
  // (mark reviewed / dismiss) don't bleed back into the location object
  // and persist across location switches.
  const seed = (typeof getActiveLocation === 'function' && getActiveLocation()?.alerts) || [];
  const [alerts, setAlerts] = useState(() => seed.slice());
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'new'

  // Filter by staff if needed — match the appt's staffId
  const scoped = useMemo(() => {
    if (!staffId) return alerts;
    return alerts.filter(a => {
      const ap = APPOINTMENTS.find(x => x.id === a.apptId);
      return ap && ap.staffId === staffId;
    });
  }, [alerts, staffId]);

  const filtered = filter === 'new' ? scoped.filter(a => a.status === 'new') : scoped;
  const newCount = scoped.filter(a => a.status === 'new').length;

  const visible = expanded ? filtered : filtered.slice(0, maxVisible);
  const hiddenCount = filtered.length - visible.length;

  function markReviewed(id) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'reviewed' } : a));
  }
  function dismiss(id) {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }
  function markAllReviewed() {
    setAlerts(prev => prev.map(a => scoped.find(s => s.id === a.id) ? { ...a, status: 'reviewed' } : a));
  }

  return (
    <Card className="p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-line/70">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-9 h-9 rounded-lg bg-warmSoft text-warm flex items-center justify-center flex-shrink-0">
            <I.Bell size={16} />
            {newCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-warm text-white text-[10px] font-semibold flex items-center justify-center tabular-nums leading-none">
                {newCount}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-serif text-[22px] text-ink leading-tight">Important alerts</h3>
            <div className="text-[12px] text-muted">
              From the AI voice agent · {staffId ? 'your clients today' : 'across the business'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden sm:inline-flex p-0.5 bg-line/60 rounded-lg">
            <button
              onClick={() => setFilter('all')}
              className={cx(
                'px-2.5 h-6 rounded-md text-[11.5px] font-medium transition',
                filter === 'all' ? 'bg-white text-ink shadow-card' : 'text-ink2 hover:text-ink'
              )}>
              All <span className="text-muted">· {scoped.length}</span>
            </button>
            <button
              onClick={() => setFilter('new')}
              className={cx(
                'px-2.5 h-6 rounded-md text-[11.5px] font-medium transition',
                filter === 'new' ? 'bg-white text-ink shadow-card' : 'text-ink2 hover:text-ink'
              )}>
              New <span className="text-muted">· {newCount}</span>
            </button>
          </div>
          {newCount > 0 && (
            <button
              onClick={markAllReviewed}
              className="text-[11.5px] font-medium text-ink2 hover:text-ink transition px-2 h-7 rounded-md hover:bg-bg/70 whitespace-nowrap">
              Mark all reviewed
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <div className="font-serif text-[20px] text-ink mb-1">
            {filter === 'new' ? 'All caught up.' : 'No alerts right now.'}
          </div>
          <div className="text-[13px] text-muted">
            {filter === 'new'
              ? 'New messages from the AI agent will show up here.'
              : 'When the AI agent has something worth your attention, it lands here.'}
          </div>
          {filter === 'new' && scoped.length > 0 && (
            <button
              onClick={() => setFilter('all')}
              className="mt-3 text-[12.5px] font-medium text-accentInk hover:underline">
              View {scoped.length} reviewed →
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-line/70">
          {visible.map(a => (
            <AlertRow
              key={a.id}
              alert={a}
              onOpenAppt={onOpenAppt}
              onReview={() => markReviewed(a.id)}
              onDismiss={() => dismiss(a.id)}
            />
          ))}
        </div>
      )}

      {/* Footer — expand/collapse */}
      {hiddenCount > 0 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full text-center py-2.5 text-[12.5px] font-medium text-ink2 hover:text-ink hover:bg-bg/70 border-t border-line transition">
          Show {hiddenCount} more {hiddenCount === 1 ? 'alert' : 'alerts'} →
        </button>
      )}
      {expanded && filtered.length > maxVisible && (
        <button
          onClick={() => setExpanded(false)}
          className="w-full text-center py-2.5 text-[12.5px] font-medium text-ink2 hover:text-ink hover:bg-bg/70 border-t border-line transition">
          Show less ↑
        </button>
      )}
    </Card>
  );
}

export function AlertRow({ alert, onOpenAppt, onReview, onDismiss }) {
  const cust = CUSTOMERS.find(c => c.id === alert.customerId);
  const appt = alert.apptId ? APPOINTMENTS.find(a => a.id === alert.apptId) : null;
  const svc = appt ? SERVICES.find(s => s.id === appt.serviceId) : null;
  const staff = appt ? STAFF.find(s => s.id === appt.staffId) : null;
  const type = ALERT_TYPES[alert.type];
  const IconCmp = I[type.icon] || I.Bell;
  const isNew = alert.status === 'new';

  // Tint classes for the type chip
  const chipBg = {
    warm:    'bg-warmSoft text-[#C97A4F]',
    rose:    'bg-roseSoft text-[#B8556A]',
    amber:   'bg-amberSoft text-[#B58300]',
    neutral: 'bg-line text-ink2',
  }[type.tone];

  return (
    <div className={cx(
      'group relative flex items-start gap-3.5 px-5 py-3.5 transition',
      isNew ? 'bg-warmSoft/15 hover:bg-warmSoft/30' : 'hover:bg-bg/60'
    )}>
      {/* unread bar */}
      {isNew && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-warm" aria-hidden="true" />}

      {/* Type chip */}
      <div className={cx('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', chipBg)}>
        <IconCmp size={15} />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13.5px] font-semibold text-ink">{cust?.name || 'Unknown'}</span>
          <span className="text-[11.5px] text-muted">·</span>
          <span className="text-[11.5px] text-ink2 font-medium">{type.label}</span>
          {isNew ? (
            <Badge tone="warm">New</Badge>
          ) : (
            <span className="text-[11px] uppercase tracking-wider text-muted font-medium">Reviewed</span>
          )}
          <span className="ml-auto text-[11.5px] text-muted tabular-nums whitespace-nowrap">{alert.received}</span>
        </div>

        {/* Appointment context + actions */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 mt-2">
          {appt && (
            <button
              onClick={() => onOpenAppt && onOpenAppt(appt)}
              className="inline-flex items-center gap-1.5 text-[11.5px] text-ink2 hover:text-ink transition group/appt">
              <I.Calendar size={11} className="text-muted" />
              <span className="font-medium">{fmt12(appt.start)}</span>
              <span>{svc?.name}</span>
              {staff && (
                <>
                  <span className="text-muted">·</span>
                  <StaffAvatar staff={staff} size={14} />
                  <span>{staff.name}</span>
                </>
              )}
              <I.ChevronRight size={11} className="text-muted group-hover/appt:translate-x-0.5 transition-transform" />
            </button>
          )}

          <div className="ml-auto flex items-center gap-1">
            {isNew && (
              <button
                onClick={onReview}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11.5px] font-medium text-ink2 hover:text-ink hover:bg-white border border-transparent hover:border-line2 transition">
                <I.Check size={12} stroke={2.2} /> Mark reviewed
              </button>
            )}
            <button
              onClick={onDismiss}
              title="Dismiss"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted hover:text-ink hover:bg-white border border-transparent hover:border-line2 transition">
              <I.X size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.AlertsPanel = AlertsPanel;
