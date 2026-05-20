import { useEffect, useMemo, useRef, useState } from 'react';
import { I } from './icons';
import { Badge, Button, DateInput, TimePicker, cx } from './ui';

// Holidays & Special Closures — shared between onboarding and settings.
// Renders a collapsible section with a holiday quick-pick and an editable
// list of closed dates. The caller owns state via { data, setData } where
//   data.tz       — IANA timezone used to choose locale-appropriate holidays
//   data.closures — array of { id, name, date (YYYY-MM-DD), fullDay, open, close, preset? }

// Common holidays — keyed by locale derived from the business's time zone.
// Dates are generated for the next 12 months starting from `from`.
export function suggestedHolidays(from, tz) {
  // All current tz options are US; default to US. Hook in CA/UK/AU later.
  const locale = (tz || '').startsWith('America/') ? 'US' : 'US';
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const yearA = start.getFullYear();
  const yearB = yearA + 1;
  const nthWeekdayOf = (year, monthIdx, weekday, n) => {
    const d = new Date(year, monthIdx, 1);
    const offset = (7 + weekday - d.getDay()) % 7;
    d.setDate(1 + offset + (n - 1) * 7);
    return d;
  };
  const lastWeekdayOf = (year, monthIdx, weekday) => {
    const d = new Date(year, monthIdx + 1, 0); // last day of month
    const offset = (7 + d.getDay() - weekday) % 7;
    d.setDate(d.getDate() - offset);
    return d;
  };
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const buildUS = (yr) => [
    { key: 'us-new-year', name: "New Year's Day", date: fmt(new Date(yr, 0, 1)) },
    { key: 'us-memorial', name: 'Memorial Day', date: fmt(lastWeekdayOf(yr, 4, 1)) },
    { key: 'us-independence', name: 'Independence Day', date: fmt(new Date(yr, 6, 4)) },
    { key: 'us-labor', name: 'Labor Day', date: fmt(nthWeekdayOf(yr, 8, 1, 1)) },
    { key: 'us-thanksgiving', name: 'Thanksgiving Day', date: fmt(nthWeekdayOf(yr, 10, 4, 4)) },
    { key: 'us-christmas', name: 'Christmas Day', date: fmt(new Date(yr, 11, 25)) }];

  const list = [...buildUS(yearA), ...buildUS(yearB)].
    filter((h) => new Date(h.date) >= start).
    reduce((acc, h) => { acc.find((x) => x.key === h.key) || acc.push(h); return acc; }, []).
    sort((a, b) => a.date.localeCompare(b.date)).
    slice(0, 6);

  return list;
}

export function fmtDateLong(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, '0')}${ap}`;
}

export function ClosuresSection({ data, setData, defaultOpen = false, className = '' }) {
  const [open, setOpen] = useState(defaultOpen);
  const [editingId, setEditingId] = useState(null);

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const suggestions = useMemo(() => suggestedHolidays(today, data.tz), [today, data.tz]);

  const closures = data.closures || [];
  const sorted = useMemo(() => [...closures].sort((a, b) => (a.date || '').localeCompare(b.date || '')), [closures]);

  const presetKeys = new Set(closures.map((c) => c.preset).filter(Boolean));

  function togglePreset(h) {
    if (presetKeys.has(h.key)) {
      setData({ ...data, closures: closures.filter((c) => c.preset !== h.key) });
    } else {
      setData({ ...data, closures: [...closures, { id: 'c_' + Math.random().toString(36).slice(2, 9), preset: h.key, name: h.name, date: h.date, fullDay: true, open: '10:00', close: '14:00' }] });
    }
  }

  function addCustom() {
    const id = 'c_' + Math.random().toString(36).slice(2, 9);
    const iso = today.toISOString().slice(0, 10);
    setData({ ...data, closures: [...closures, { id, name: '', date: iso, fullDay: true, open: '10:00', close: '14:00' }] });
    setEditingId(id);
    if (!open) setOpen(true);
  }

  function updateClosure(id, patch) {
    setData({ ...data, closures: closures.map((c) => c.id === id ? { ...c, ...patch, preset: patch.name !== undefined || patch.date !== undefined ? undefined : c.preset } : c) });
  }

  function removeClosure(id) {
    setData({ ...data, closures: closures.filter((c) => c.id !== id) });
    if (editingId === id) setEditingId(null);
  }

  const count = closures.length;
  const summary = count === 0 ? 'No closed dates yet' : `${count} closed ${count === 1 ? 'date' : 'dates'}`;

  return (
    <div className={cx('max-w-2xl', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cx('w-full flex items-center gap-3 rounded-xl2 border bg-surface p-4 text-left transition hover:border-line2', open ? 'border-line2 rounded-b-none' : 'border-line')}>
        <div className="w-9 h-9 rounded-lg bg-warmSoft text-[#7A3F1F] flex items-center justify-center flex-shrink-0">
          <I.Calendar size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium text-ink">Holidays & special closures</span>
            <span className="text-[11px] text-muted">Optional</span>
          </div>
          <div className="text-[12.5px] text-muted">
            {open
              ? 'Dates marked here override your weekly hours — no bookings will be taken.'
              : count === 0
                ? 'Block off holidays or special dates the booking page should treat as unavailable.'
                : summary + ' · the booking page will mark these dates unavailable.'}
          </div>
        </div>
        {count > 0 && !open && <Badge tone="warm">{count}</Badge>}
        <I.ChevronDown size={16} className={cx('text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="rounded-b-xl2 border border-t-0 border-line2 bg-surface px-5 pt-5 pb-5 fadein">
          {/* Quick add — common holidays */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2.5">
              <I.Sparkles size={13} className="text-accent flex-shrink-0" />
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-medium whitespace-nowrap">Suggested for your area</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((h) => {
                const active = presetKeys.has(h.key);
                return (
                  <button
                    key={h.key}
                    type="button"
                    onClick={() => togglePreset(h)}
                    className={cx(
                      'inline-flex items-center gap-2 px-2.5 h-8 rounded-full border text-[12.5px] whitespace-nowrap transition',
                      active
                        ? 'bg-accent text-white border-accent hover:bg-[#36513a]'
                        : 'bg-white text-ink border-line2 hover:border-ink2/40 hover:bg-bg'
                    )}>
                    <span className={cx('w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0', active ? 'bg-white/20 border-white/40' : 'border-line2')}>
                      {active && <I.Check size={9} stroke={3} />}
                    </span>
                    <span className="font-medium">{h.name}</span>
                    <span className={cx('text-[11.5px]', active ? 'text-white/75' : 'text-muted')}>
                      {fmtDateLong(h.date).replace(/, \d{4}$/, '')}
                    </span>
                  </button>);
              })}
            </div>
          </div>

          {/* List */}
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-medium whitespace-nowrap">Upcoming closed dates</div>
            <div className="text-[11.5px] text-muted whitespace-nowrap">{count} {count === 1 ? 'date' : 'dates'}</div>
          </div>

          {sorted.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line2 bg-bg/40 py-6 px-4 text-center mb-3">
              <div className="text-[13px] text-ink2">No closures yet.</div>
              <div className="text-[12px] text-muted mt-0.5">Pick a holiday above or add a custom date below.</div>
            </div>
          ) : (
            <div className="rounded-lg border border-line divide-y divide-line mb-3 overflow-hidden">
              {sorted.map((c) => editingId === c.id ? (
                <ClosureEditRow key={c.id} closure={c} onSave={(patch) => { updateClosure(c.id, patch); setEditingId(null); }} onCancel={() => { if (!c.name) removeClosure(c.id); else setEditingId(null); }} onRemove={() => removeClosure(c.id)} />
              ) : (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3 group">
                  <div className="w-9 h-9 rounded-lg bg-warmSoft/70 text-[#7A3F1F] flex flex-col items-center justify-center flex-shrink-0 leading-none">
                    <span className="text-[8.5px] uppercase font-medium tracking-wider opacity-80">{fmtDateLong(c.date).split(',')[1]?.trim().split(' ')[0]}</span>
                    <span className="text-[14px] font-semibold mt-0.5">{c.date ? Number(c.date.split('-')[2]) : '?'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium text-ink truncate">{c.name || <span className="text-muted italic">Untitled closure</span>}</div>
                    <div className="text-[12px] text-muted">
                      {fmtDateLong(c.date)} · {c.fullDay ? 'Closed all day' : `Open ${fmtTime(c.open)} – ${fmtTime(c.close)}`}
                    </div>
                  </div>
                  <button onClick={() => setEditingId(c.id)} className="p-1.5 text-muted hover:text-ink opacity-0 group-hover:opacity-100 transition" title="Edit"><I.Edit size={14} /></button>
                  <button onClick={() => removeClosure(c.id)} className="p-1.5 text-muted hover:text-rose opacity-0 group-hover:opacity-100 transition" title="Remove"><I.Trash size={14} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" size="sm" onClick={addCustom}><I.Plus size={14} /> Add custom closure</Button>
            <div className="text-[11.5px] text-muted">Override weekly hours · Staff availability is paused</div>
          </div>
        </div>
      )}
    </div>);
}

export function ClosureEditRow({ closure, onSave, onCancel, onRemove }) {
  const [name, setName] = useState(closure.name || '');
  const [date, setDate] = useState(closure.date || '');
  const [fullDay, setFullDay] = useState(closure.fullDay !== false);
  const [openT, setOpenT] = useState(closure.open || '10:00');
  const [closeT, setCloseT] = useState(closure.close || '14:00');
  const [err, setErr] = useState('');
  const nameRef = useRef(null);
  useEffect(() => { if (nameRef.current) nameRef.current.focus(); }, []);

  function save() {
    if (!name.trim()) { setErr('Add a name for this closure'); return; }
    if (!date) { setErr('Pick a date'); return; }
    onSave({ name: name.trim(), date, fullDay, open: openT, close: closeT });
  }

  return (
    <div className="p-4 bg-bg/40">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5 mb-3">
        <div className="md:col-span-3">
          <label className="block text-[11px] uppercase tracking-wider text-muted font-medium mb-1">Reason / name</label>
          <input ref={nameRef} placeholder="e.g. Christmas Day, Staff training, Private event" value={name} onChange={(e) => { setName(e.target.value); setErr(''); }} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-[11px] uppercase tracking-wider text-muted font-medium mb-1">Date</label>
          <DateInput value={date} onChange={(v) => { setDate(v); setErr(''); }} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
        <button
          type="button"
          onClick={() => setFullDay(true)}
          className={cx('flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition', fullDay ? 'border-accent bg-accentSoft/60' : 'border-line hover:bg-bg/60')}>
          <span className={cx('w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0', fullDay ? 'border-accent' : 'border-line2')}>
            {fullDay && <span className="w-2 h-2 rounded-full bg-accent" />}
          </span>
          <div>
            <div className="text-[13px] font-medium text-ink leading-tight">Closed all day</div>
            <div className="text-[11.5px] text-muted">No bookings accepted</div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setFullDay(false)}
          className={cx('flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition', !fullDay ? 'border-accent bg-accentSoft/60' : 'border-line hover:bg-bg/60')}>
          <span className={cx('w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0', !fullDay ? 'border-accent' : 'border-line2')}>
            {!fullDay && <span className="w-2 h-2 rounded-full bg-accent" />}
          </span>
          <div>
            <div className="text-[13px] font-medium text-ink leading-tight">Custom hours</div>
            <div className="text-[11.5px] text-muted">Limited hours for this date</div>
          </div>
        </button>
      </div>

      {!fullDay && (
        <div className="grid grid-cols-2 gap-2 mb-3 max-w-xs">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-muted font-medium mb-1">Opens</label>
            <TimePicker value={openT} onChange={setOpenT} />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-muted font-medium mb-1">Closes</label>
            <TimePicker value={closeT} onChange={setCloseT} />
          </div>
        </div>
      )}

      {err && <div className="text-[12px] text-rose mb-3 font-medium">{err}</div>}

      <div className="flex items-center justify-between gap-2">
        <Button variant="danger" size="sm" onClick={onRemove}><I.Trash size={13} /> Remove</Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="accent" size="sm" onClick={save}><I.Check size={13} /> Save</Button>
        </div>
      </div>
    </div>);
}

Object.assign(window, { ClosuresSection, ClosureEditRow, suggestedHolidays, fmtDateLong, fmtTime });
