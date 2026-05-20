import { useMemo, useState } from 'react';
import { ACCOUNT, BUSINESS, LOCATIONS, dayName, fmt12, fromMin, localDayKey, offsetDayKey, parseDay, toMin } from './data';
import { I } from './icons';
import { BusinessMark, Button, CopyButton, Field, StaffAvatar, cx } from './ui';

// Customer-facing online booking page
// Steps: services → staff → date → time → details → confirm
// Supports multi-service.

// ─── Phone helpers ─────────────────────────────────────────────────
// Customers must provide a phone number to book — we use it to text
// confirmations and reminders. Format as the user types into the
// canonical (XXX) XXX-XXXX shape used throughout the app, and reject
// non-numeric characters silently.
export function formatPhoneInput(value) {
  const digits = (value || '').replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length < 4) return '(' + digits;
  if (digits.length < 7) return '(' + digits.slice(0, 3) + ') ' + digits.slice(3);
  return '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6);
}
export function isPhoneComplete(value) {
  return (value || '').replace(/\D/g, '').length === 10;
}

export function BookingPage() {
  const [previewing, setPreviewing] = useState(true);
  // Step 0 — Location, then services / staff / date+time / info / confirm.
  const [step, setStep] = useState(0);
  // The location the customer is booking AT. Defaults to the current owner-
  // workspace location so the preview matches what the staffer is viewing,
  // but the customer can change it before picking services.
  const [locationId, setLocationId] = useState(() => {
    try {
      const cur = window.ACTIVE_LOCATION_ID;
      if (cur && LOCATIONS.find(l => l.id === cur)) return cur;
    } catch {}
    return LOCATIONS[0].id;
  });
  const location = LOCATIONS.find(l => l.id === locationId) || LOCATIONS[0];
  // Per-location lists. These shadow the global STAFF / SERVICES / etc. so
  // the booking flow is always scoped to the chosen location, regardless of
  // which workspace the owner is currently viewing in the rest of the app.
  const locStaff = location.staff;
  const locServices = location.services;
  const locServiceCats = location.serviceCategories;
  const locAppointments = location.appointments;
  const locBlocks = location.blocks || [];
  const locBusiness = location.business;

  const [cart, setCart] = useState([]); // array of service ids
  const [staffPick, setStaffPick] = useState('any');
  const [date, setDate] = useState(offsetDayKey(1));
  const [time, setTime] = useState(null);
  const [info, setInfo] = useState({ name:'', phone:'', email:'', notes:'' });
  const [booked, setBooked] = useState(false);

  // When location changes, drop any selections that no longer apply at the
  // new location (cart entries, picked staff, time slot).
  function changeLocation(newId) {
    if (newId === locationId) return;
    const next = LOCATIONS.find(l => l.id === newId);
    if (!next) return;
    setLocationId(newId);
    // Cart: keep only service ids still offered at the new location.
    setCart(prev => prev.filter(sid => next.services.find(s => s.id === sid)));
    // Staff: if no longer at this location, reset to 'any'.
    setStaffPick(prev => (prev !== 'any' && !next.staff.find(s => s.id === prev)) ? 'any' : prev);
    // Time always gets re-checked once we recompute slots, but clear it now
    // so the user must reconfirm an available slot.
    setTime(null);
  }

  const totalDuration = cart.reduce((s, id) => s + (locServices.find(x=>x.id===id)?.duration || 0), 0);
  const totalPrice = cart.reduce((s, id) => s + (locServices.find(x=>x.id===id)?.price || 0), 0);

  // Determine which staff can perform all selected services
  const eligibleStaff = cart.length === 0 ? locStaff.filter(s => s.active) :
    locStaff.filter(s => s.active && cart.every(sid => s.services.includes(sid)));
  const needsMultiStaff = cart.length > 1 && eligibleStaff.length === 0;

  // Compute available time slots realistically for the chosen day
  const slots = useMemo(() => {
    if (cart.length === 0) return [];
    const dn = dayName(date);
    const bizHours = locBusiness.hours[dn];
    if (!bizHours || bizHours.closed) return [];
    const openMin = toMin(bizHours.open);
    const closeMin = toMin(bizHours.close);

    // Pick a staff to check against. If 'any', try each in eligibleStaff and pool results.
    const candidates = staffPick === 'any' ? (eligibleStaff.length ? eligibleStaff : locStaff) : [locStaff.find(s => s.id === staffPick)];
    const slotSet = new Map(); // minute -> staffId

    for (const s of candidates) {
      if (!s) continue;
      const sched = s.hours[dn];
      if (sched === 'off' || !Array.isArray(sched)) continue;
      const workStart = Math.max(openMin, toMin(sched[0]));
      const workEnd = Math.min(closeMin, toMin(sched[1]));
      // Existing appointments for this staff on this date
      const existing = locAppointments.filter(a => a.staffId === s.id && a.day === date && a.status !== 'canceled');
      // Manual blocks (breaks / lunch breaks) for this staff on this date
      const blocks = locBlocks.filter(b => b.staffId === s.id && b.day === date);
      // Lunch
      let lunch = null;
      if (s.lunch) { const [ls,le] = s.lunch.replace('–','-').split('-'); lunch = [toMin(ls), toMin(le)]; }

      // Buffer of the LAST service in the cart attaches to the new appointment's
      // tail — slots run their full duration + that buffer before the next booking.
      const lastSvc = locServices.find(x => x.id === cart[cart.length - 1]);
      const newBuf = (lastSvc && lastSvc.bufferAfter) || 0;

      // Step every 15 minutes
      for (let t = workStart; t + totalDuration <= workEnd; t += 15) {
        const end = t + totalDuration;
        const endWithBuf = end + newBuf;
        // lunch conflict (against the full occupied window)
        if (lunch && !(endWithBuf <= lunch[0] || t >= lunch[1])) continue;
        // manual block conflict — each block fully occupies its [start, end) window
        const blockConflict = blocks.some(b => {
          const bS = toMin(b.start);
          const bE = toMin(b.end);
          return !(endWithBuf <= bS || t >= bE);
        });
        if (blockConflict) continue;
        // existing conflict — each existing appt occupies [start, end + its buffer]
        const conflict = existing.some(a => {
          const aSvc = locServices.find(x => x.id === a.serviceId);
          const aBuf = (aSvc && aSvc.bufferAfter) || 0;
          const aS = toMin(a.start);
          const aE = toMin(a.end) + aBuf;
          return !(endWithBuf <= aS || t >= aE);
        });
        if (conflict) continue;
        if (!slotSet.has(t)) slotSet.set(t, s.id);
      }
    }
    return [...slotSet.entries()].sort((a,b) => a[0]-b[0]).map(([m, sid]) => ({ min:m, staffId:sid }));
  }, [cart, date, staffPick, totalDuration, eligibleStaff, locationId]);

  function toggleService(id) {
    setCart(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  }

  const steps = ['Location','Services','Staff','Date & Time','Your info','Confirm'];

  if (booked) {
    return <BookedScreen info={info} cart={cart} staffPick={staffPick} date={date} time={time} location={location} locServices={locServices} locStaff={locStaff} onAgain={()=>{ setBooked(false); setStep(0); setCart([]); setTime(null); }} />;
  }

  return (
    <div className="space-y-4">
      {previewing && (
        <div className="rounded-xl2 border border-dashed border-line2 bg-white px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-warmSoft text-warm flex items-center justify-center"><I.Eye size={16}/></div>
            <div>
              <div className="font-medium text-ink">Customer booking preview</div>
              <div className="text-[12.5px] text-muted">This is what customers see at <span className="font-mono text-ink2">{BUSINESS.bookingLink}</span></div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CopyButton variant="secondary" size="sm" label="Copy link" value={BUSINESS.bookingLink} />
            <Button variant="ghost" size="sm" onClick={()=>setPreviewing(false)}>Hide</Button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-surface overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-line bg-gradient-to-b from-bg/40 to-transparent">
          <div className="flex items-center gap-3">
            <BusinessMark
              logo={locBusiness.logo}
              monogram={locBusiness.logoMonogram}
              size={40}
              rounded="full"
              alt={`${locBusiness.name} logo`}
            />
            <div className="flex-1 min-w-0">
              <div className="font-serif text-[22px] text-ink leading-none truncate">{locBusiness.name}</div>
              <div className="text-[12.5px] text-muted truncate">
                {step > 0 ? (
                  <><span className="text-ink2 font-medium">{location.name}</span> · {locBusiness.address} · {locBusiness.city}, {locBusiness.state}</>
                ) : (
                  <>Choose a location to start booking</>
                )}
              </div>
            </div>
            {step > 0 && (
              <button
                onClick={() => setStep(0)}
                className="text-[12px] text-accent hover:underline whitespace-nowrap"
                title="Change location"
              >Change</button>
            )}
          </div>
          {/* Progress */}
          <div className="mt-5 flex items-center gap-1.5">
            {steps.map((s, i) => (
              <div key={s} className={cx('flex-1 h-1 rounded-full transition', i <= step ? 'bg-accent' : 'bg-line')} />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11.5px] text-muted">
            <span>Step {step+1} of {steps.length} — <span className="text-ink font-medium">{steps[step]}</span></span>
            {cart.length > 0 && step < 5 && (
              <span>{cart.length} service{cart.length>1?'s':''} · {totalDuration} min · ${totalPrice}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-0">
          <div className="p-6 min-h-[480px]">
            {step === 0 && <StepLocation locationId={locationId} onChange={changeLocation} />}
            {step === 1 && <StepServices cart={cart} onToggle={toggleService} locServices={locServices} locServiceCats={locServiceCats} />}
            {step === 2 && <StepStaff staffPick={staffPick} setStaffPick={setStaffPick} eligible={eligibleStaff} needsMultiStaff={needsMultiStaff} cart={cart} />}
            {step === 3 && <StepDateTime date={date} setDate={setDate} slots={slots} time={time} setTime={setTime} totalDuration={totalDuration} staffPick={staffPick} locBusiness={locBusiness} locStaff={locStaff} />}
            {step === 4 && <StepInfo info={info} setInfo={setInfo} />}
            {step === 5 && <StepConfirm cart={cart} staffPick={staffPick} eligibleStaff={eligibleStaff} date={date} time={time} info={info} totalDuration={totalDuration} totalPrice={totalPrice} location={location} locServices={locServices} locStaff={locStaff} />}
          </div>

          <aside className="border-t md:border-t-0 md:border-l border-line bg-bg/40 p-6">
            <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">Your booking</div>
            {step >= 1 && (
              <div className="mb-3 pb-3 border-b border-line">
                <div className="text-[12.5px] text-muted">At</div>
                <div className="text-[13px] font-medium text-ink">{location.name}</div>
                <div className="text-[11.5px] text-muted truncate">{locBusiness.address}</div>
              </div>
            )}
            {cart.length === 0 ? (
              <div className="text-[13.5px] text-muted">{step === 0 ? 'Choose a location to begin.' : 'Add a service to get started.'}</div>
            ) : (
              <div className="space-y-2.5">
                {cart.map(sid => {
                  const s = locServices.find(x=>x.id===sid);
                  return (
                    <div key={sid} className="flex items-start justify-between gap-2 text-[13px]">
                      <div>
                        <div className="font-medium text-ink">{s.name}</div>
                        <div className="text-[11.5px] text-muted">{s.duration} min</div>
                      </div>
                      <div className="font-medium text-ink">${s.price}</div>
                    </div>
                  );
                })}
                <div className="pt-2.5 mt-2.5 border-t border-line flex items-center justify-between text-[13px]">
                  <span className="text-ink2">Total</span>
                  <span className="font-medium text-ink">{totalDuration} min · ${totalPrice}</span>
                </div>
                {staffPick !== 'any' && step >= 2 && (
                  <div className="pt-2 text-[12.5px]">
                    <div className="text-muted">With</div>
                    <div className="font-medium text-ink">{locStaff.find(s=>s.id===staffPick)?.name}</div>
                  </div>
                )}
                {time && step >= 3 && (
                  <div className="pt-2 text-[12.5px]">
                    <div className="text-muted">When</div>
                    <div className="font-medium text-ink">{parseDay(date).toLocaleDateString('en-US',{weekday:'short', month:'short', day:'numeric'})} · {fmt12(fromMin(time))}</div>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>

        <div className="px-6 py-4 border-t border-line bg-white flex items-center justify-between gap-3">
          <Button variant="ghost" disabled={step===0} onClick={()=>setStep(step-1)}>
            <I.ChevronLeft size={14}/> Back
          </Button>
          <div className="text-[12px] text-muted hidden sm:block">Powered by Receptionly</div>
          {step < 5 ? (
            <Button
              variant="accent"
              disabled={
                (step===0 && !locationId) ||
                (step===1 && cart.length===0) ||
                (step===3 && !time) ||
                (step===4 && !isPhoneComplete(info.phone))
              }
              onClick={()=>setStep(step+1)}
            >
              Continue <I.ChevronRight size={14}/>
            </Button>
          ) : (
            <Button variant="accent" disabled={!isPhoneComplete(info.phone)} onClick={()=>setBooked(true)}>
              Confirm booking <I.Check size={14}/>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function StepLocation({ locationId, onChange }) {
  return (
    <div>
      <h2 className="font-serif text-[26px] text-ink mb-1">Choose your location</h2>
      <p className="text-[13.5px] text-ink2 mb-4">We have {LOCATIONS.length} locations. Pick the one closest to you.</p>
      <div className="space-y-2">
        {LOCATIONS.map(loc => {
          const sel = loc.id === locationId;
          const b = loc.business;
          // Friendly preview: how many services & staff are available here.
          const hoursNow = (() => {
            const dn = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
            const h = b.hours[dn];
            if (!h || h.closed) return 'Closed today';
            return `Open today · ${fmt12(h.open)}–${fmt12(h.close)}`;
          })();
          return (
            <button
              key={loc.id}
              onClick={() => onChange(loc.id)}
              className={cx(
                'w-full flex items-start gap-3 p-4 rounded-lg border text-left transition',
                sel ? 'border-accent bg-accentSoft/60' : 'border-line hover:border-ink2/40'
              )}
            >
              <div className={cx(
                'mt-0.5 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                sel ? 'bg-accent text-white' : 'bg-bg text-ink2'
              )}>
                <I.Map size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-ink">{loc.name}</span>
                  <span className="text-[12px] text-muted">· {hoursNow}</span>
                </div>
                <div className="text-[13px] text-ink2 mt-0.5">{b.address}</div>
                <div className="text-[12.5px] text-muted mt-0.5">{b.city}, {b.state} {b.zip} · {b.phone}</div>
                <div className="flex items-center gap-3 text-[11.5px] text-muted mt-1.5">
                  <span>{loc.staff.length} staff</span>
                  <span className="w-1 h-1 rounded-full bg-line2" />
                  <span>{loc.services.length} services</span>
                </div>
              </div>
              <div className={cx('w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-1', sel ? 'bg-accent border-accent' : 'border-line2 bg-white')}>
                {sel && <span className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StepServices({ cart, onToggle, locServices, locServiceCats }) {
  const [cat, setCat] = useState(locServiceCats[0].id);
  const visible = locServices.filter(s => s.category === cat && s.online);
  return (
    <div>
      <h2 className="font-serif text-[26px] text-ink mb-1">Choose your service</h2>
      <p className="text-[13.5px] text-ink2 mb-4">Add one or more services. We'll bundle them into a single appointment.</p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {locServiceCats.map(c => (
          <button key={c.id} onClick={()=>setCat(c.id)} className={cx('h-8 px-3 rounded-full text-[12.5px] font-medium border transition', cat===c.id ? 'bg-ink text-white border-ink' : 'bg-white border-line2 text-ink2 hover:border-ink2/60')}>
            {c.name}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {visible.map(s => {
          const selected = cart.includes(s.id);
          return (
            <button key={s.id} onClick={()=>onToggle(s.id)} className={cx('w-full flex items-start gap-3 p-3.5 rounded-lg border text-left transition', selected ? 'border-accent bg-accentSoft/60' : 'border-line hover:border-ink2/40')}>
              <div className={cx('mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0', selected ? 'bg-accent border-accent text-white' : 'border-line2 bg-white')}>
                {selected && <I.Check size={12} stroke={3} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{s.name}</span>
                  <span className="text-[12px] text-muted">{s.duration} min</span>
                </div>
                {s.desc && <div className="text-[12.5px] text-ink2 mt-0.5">{s.desc}</div>}
              </div>
              <div className="font-medium text-ink">${s.price}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StepStaff({ staffPick, setStaffPick, eligible, needsMultiStaff, cart }) {
  return (
    <div>
      <h2 className="font-serif text-[26px] text-ink mb-1">Pick a provider</h2>
      <p className="text-[13.5px] text-ink2 mb-4">
        {needsMultiStaff
          ? 'No single staff member can perform all selected services. We\'ll schedule them across multiple providers in sequence.'
          : 'Only providers who perform the selected service(s) are shown.'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <StaffPickCard sel={staffPick==='any'} onClick={()=>setStaffPick('any')}
          left={<div className="w-10 h-10 rounded-full bg-accentSoft text-accentInk flex items-center justify-center"><I.Sparkles size={18}/></div>}
          title="Any available"
          sub="Fastest option — we'll match you with the first open slot."
        />
        {eligible.map(s => (
          <StaffPickCard key={s.id} sel={staffPick===s.id} onClick={()=>setStaffPick(s.id)}
            left={<StaffAvatar staff={s} size={40} />}
            title={s.name}
            sub={s.role}
          />
        ))}
      </div>
    </div>
  );
}

export function StaffPickCard({ sel, onClick, left, title, sub }) {
  return (
    <button onClick={onClick} className={cx('flex items-center gap-3 p-3 rounded-lg border text-left transition', sel ? 'border-accent bg-accentSoft/60' : 'border-line hover:border-ink2/40')}>
      {left}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-ink truncate">{title}</div>
        <div className="text-[12.5px] text-ink2 truncate">{sub}</div>
      </div>
      <div className={cx('w-5 h-5 rounded-full border flex items-center justify-center', sel ? 'bg-accent border-accent' : 'border-line2')}>
        {sel && <span className="w-2 h-2 rounded-full bg-white" />}
      </div>
    </button>
  );
}

export function StepDateTime({ date, setDate, slots, time, setTime, totalDuration, staffPick, locBusiness, locStaff }) {
  // Anchor the calendar's visible month to the selected date.
  const selectedDate = parseDay(date);
  const [viewMonth, setViewMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  const today = new Date(); today.setHours(0,0,0,0);
  const todayKeyStr = localDayKey(today);

  // Build a 6-row Monday-start grid for viewMonth.
  const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  // JS getDay: 0=Sun..6=Sat. We want Monday-start: shift so Mon=0..Sun=6.
  const offset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - offset);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  function changeMonth(delta) {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1));
  }

  // Group times for the currently-selected date.
  const groups = { Morning: [], Afternoon: [], Evening: [] };
  slots.forEach(s => {
    const h = Math.floor(s.min / 60);
    if (h < 12) groups.Morning.push(s);
    else if (h < 17) groups.Afternoon.push(s);
    else groups.Evening.push(s);
  });

  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const selectedLabel = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // Can we navigate to the previous month? Only if it isn't entirely in the past.
  const prevMonthEnd = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 0);
  const canGoBack = prevMonthEnd >= today;

  return (
    <div>
      <h2 className="font-serif text-[26px] text-ink mb-1">Choose a date &amp; time</h2>
      <p className="text-[13.5px] text-ink2 mb-5">Pick a day, then select an available time slot.</p>

      {/* Calendar card */}
      <div className="rounded-xl border border-line bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => canGoBack && changeMonth(-1)}
            disabled={!canGoBack}
            aria-label="Previous month"
            className={cx('w-8 h-8 rounded-full flex items-center justify-center transition', canGoBack ? 'text-ink2 hover:bg-bg' : 'text-line2 cursor-not-allowed')}
          >
            <I.ChevronLeft size={16} />
          </button>
          <div className="font-serif text-[18px] text-ink">{monthLabel}</div>
          <button
            onClick={() => changeMonth(1)}
            aria-label="Next month"
            className="w-8 h-8 rounded-full flex items-center justify-center text-ink2 hover:bg-bg transition"
          >
            <I.ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-y-1">
          {['MO','TU','WE','TH','FR','SA','SU'].map(d => (
            <div key={d} className="text-center text-[10.5px] uppercase tracking-wider text-muted font-medium pb-2">{d}</div>
          ))}
          {cells.map((d) => {
            const dk = localDayKey(d);
            const inMonth = d.getMonth() === viewMonth.getMonth();
            const past = d < today;
            const dn = dayName(d);
            const closed = locBusiness.hours[dn]?.closed;
            const disabled = past || closed || !inMonth;
            const sel = dk === date;
            const isToday = dk === todayKeyStr;

            return (
              <div key={dk + '-' + d.getTime()} className="flex items-center justify-center py-1">
                <button
                  disabled={disabled}
                  onClick={() => !disabled && setDate(dk)}
                  className={cx(
                    'w-9 h-9 rounded-md tabular-nums flex items-center justify-center text-[13.5px] transition',
                    sel
                      ? 'bg-accent text-white font-semibold'
                      : isToday && inMonth && !disabled
                        ? 'text-accent font-semibold ring-1 ring-accent/40 hover:bg-accentSoft/50'
                        : disabled
                          ? (inMonth ? 'text-muted/30' : 'text-muted/30') + ' cursor-not-allowed'
                          : inMonth
                            ? 'text-ink hover:bg-bg/70'
                            : 'text-muted/50 hover:bg-bg/40'
                  )}
                  aria-label={d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  aria-pressed={sel}
                >
                  {d.getDate()}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day + time slots */}
      <div className="mt-6">
        <div className="font-serif text-[20px] text-ink leading-tight">{selectedLabel}</div>
        <div className="text-[12.5px] text-muted mt-0.5">{totalDuration} min appointment</div>

        {slots.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-line2 bg-bg/40 p-5 text-center">
            <div className="text-[13.5px] text-ink">No openings on this day.</div>
            <div className="text-[12.5px] text-ink2 mt-1">Try another date{staffPick !== 'any' ? ' or pick "Any available" staff' : ''}.</div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-x-3 sm:gap-x-5 items-start">
            {Object.entries(groups).map(([label, list]) => (
              <div key={label}>
                <div className="text-center text-[10.5px] tracking-wider text-muted font-medium pb-2">{label.toUpperCase()}</div>
                {list.length === 0 ? (
                  <div className="text-center text-[11.5px] text-line2 py-2">—</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {list.map(s => {
                      const sel = time === s.min;
                      const st = locStaff.find(x => x.id === s.staffId);
                      return (
                        <button
                          key={s.min}
                          onClick={() => setTime(s.min)}
                          className={cx(
                            'h-9 rounded-full border text-[13px] transition flex items-center justify-center px-3',
                            sel
                              ? 'border-accent bg-accent text-white font-medium'
                              : 'border-line2 bg-white text-ink hover:border-ink2/60'
                          )}
                          title={staffPick === 'any' && st ? `with ${st.name}` : undefined}
                        >
                          {fmt12(fromMin(s.min))}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function StepInfo({ info, setInfo }) {
  // Show the phone validation message only after the user has interacted
  // with the field — either typed something then cleared it, or blurred
  // while incomplete. This keeps the form quiet on first render but firm
  // about the requirement before continuing.
  const [phoneTouched, setPhoneTouched] = useState(false);
  const digits = (info.phone || '').replace(/\D/g, '');
  const phoneError = phoneTouched
    ? (digits.length === 0
      ? 'Phone number is required'
      : digits.length < 10
        ? 'Enter a complete 10-digit phone number'
        : null)
    : null;

  function onPhoneChange(e) {
    const formatted = formatPhoneInput(e.target.value);
    setInfo({ ...info, phone: formatted });
    // If the user has reached a complete number, drop any stale error
    // immediately rather than waiting for the next blur.
    if (isPhoneComplete(formatted)) setPhoneTouched(true);
  }

  return (
    <div>
      <h2 className="font-serif text-[26px] text-ink mb-1">Your details</h2>
      <p className="text-[13.5px] text-ink2 mb-4">We'll text you a confirmation and reminder.</p>
      <div className="space-y-3 max-w-md">
        <Field label="Full name"><input value={info.name} onChange={e=>setInfo({...info, name:e.target.value})} placeholder="Jane Doe" /></Field>
        <Field label="Phone" hint="We'll text your confirmation here" error={phoneError}>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={14}
            value={info.phone}
            onChange={onPhoneChange}
            onBlur={() => setPhoneTouched(true)}
            placeholder="(415) 555-0100"
            aria-invalid={!!phoneError}
            aria-required="true"
          />
        </Field>
        <Field label="Email" optional><input value={info.email} onChange={e=>setInfo({...info, email:e.target.value})} placeholder="jane@example.com" /></Field>
        <Field label="Appointment notes" optional hint="Anything we should know? Special requests, parking, accessibility, etc.">
          <textarea
            value={info.notes}
            onChange={e=>setInfo({...info, notes:e.target.value})}
            placeholder="Add any notes or special requests..."
            rows={3}
            className="w-full resize-y leading-snug"
          />
        </Field>
      </div>
      {(() => {
        const policy = ((typeof ACCOUNT !== 'undefined' && ACCOUNT && ACCOUNT.cancellationPolicy) || '').trim();
        if (!policy) return null;
        return (
          <div className="mt-8 pt-5 border-t border-line max-w-md">
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted font-medium mb-1.5">Cancellation policy</div>
            <p className="text-[11.5px] text-muted leading-relaxed whitespace-pre-line">{policy}</p>
          </div>
        );
      })()}
    </div>
  );
}

export function StepConfirm({ cart, staffPick, eligibleStaff, date, time, info, totalDuration, totalPrice, location, locServices, locStaff }) {
  const staff = staffPick === 'any' ? eligibleStaff[0] : locStaff.find(s => s.id === staffPick);
  return (
    <div>
      <h2 className="font-serif text-[26px] text-ink mb-1">Confirm your booking</h2>
      <p className="text-[13.5px] text-ink2 mb-4">Review and tap confirm. You'll get an email confirmation.</p>
      <div className="rounded-lg border border-line p-4 space-y-3">
        <div className="flex items-start justify-between text-[13px] pb-3 border-b border-line">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted">Location</div>
            <div className="font-medium text-ink mt-0.5">{location.name}</div>
            <div className="text-[12.5px] text-ink2">{location.business.address}, {location.business.city}</div>
          </div>
        </div>
        {cart.map(sid => {
          const s = locServices.find(x=>x.id===sid);
          return (
            <div key={sid} className="flex items-start justify-between text-[13.5px]">
              <div>
                <div className="font-medium text-ink">{s.name}</div>
                <div className="text-[12.5px] text-muted">{s.duration} min</div>
              </div>
              <div className="font-medium text-ink">${s.price}</div>
            </div>
          );
        })}
        <div className="pt-2 mt-2 border-t border-line flex items-center justify-between text-[13.5px]">
          <span className="text-ink2">Total</span>
          <span className="font-medium text-ink">{totalDuration} min · ${totalPrice}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3 text-[13px]">
        <div className="rounded-lg border border-line p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted">When</div>
          <div className="font-medium text-ink mt-0.5">{parseDay(date).toLocaleDateString('en-US',{weekday:'long', month:'long', day:'numeric'})}</div>
          <div className="text-[12.5px] text-ink2">{fmt12(fromMin(time))}</div>
        </div>
        <div className="rounded-lg border border-line p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted">With</div>
          <div className="font-medium text-ink mt-0.5 flex items-center gap-2">{staff && <StaffAvatar staff={staff} size={22}/>} {staff?.name}</div>
          <div className="text-[12.5px] text-ink2">{staff?.role}</div>
        </div>
      </div>

      {info.notes && info.notes.trim() && (
        <div className="mt-3 rounded-lg border border-line p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted mb-1">Appointment notes</div>
          <div className="text-[13px] text-ink2 leading-relaxed whitespace-pre-wrap">{info.notes.trim()}</div>
        </div>
      )}
    </div>
  );
}

export function BookedScreen({ info, cart, staffPick, eligibleStaff, date, time, location, locServices, locStaff, onAgain }) {
  const staff = staffPick === 'any' ? locStaff[0] : locStaff.find(s => s.id === staffPick);
  return (
    <div className="rounded-2xl border border-line bg-surface p-10 text-center">
      <div className="w-14 h-14 rounded-full bg-accentSoft text-accent mx-auto flex items-center justify-center mb-4">
        <I.Check size={28} stroke={2.2} />
      </div>
      <div className="font-serif text-[34px] text-ink mb-1">You're booked!</div>
      <div className="text-[14px] text-ink2 mb-6">A confirmation was sent to {info.email || 'your email'}. We've added it to your calendar.</div>
      <div className="max-w-md mx-auto rounded-lg border border-line p-4 text-left space-y-2 text-[13px]">
        <div className="flex items-center justify-between pb-2 border-b border-line">
          <span className="text-ink2">{location?.name}</span>
          <span className="text-muted text-[12px]">{location?.business.address}</span>
        </div>
        {cart.map(sid => {
          const s = locServices.find(x=>x.id===sid);
          return <div key={sid} className="flex items-center justify-between"><span className="text-ink">{s.name}</span><span className="text-muted">{s.duration} min</span></div>;
        })}
        {time && <div className="pt-2 mt-2 border-t border-line flex items-center justify-between">
          <span className="text-ink2">{parseDay(date).toLocaleDateString('en-US',{weekday:'short', month:'short', day:'numeric'})} · {fmt12(fromMin(time))}</span>
          <span className="text-ink2">with {staff?.name}</span>
        </div>}
        {info && info.notes && info.notes.trim() && (
          <div className="pt-2 mt-2 border-t border-line">
            <div className="text-[11px] uppercase tracking-wider text-muted mb-1">Notes</div>
            <div className="text-[12.5px] text-ink2 leading-relaxed whitespace-pre-wrap">{info.notes.trim()}</div>
          </div>
        )}
      </div>
      <Button variant="ghost" className="mt-5" onClick={onAgain}>Book another</Button>
    </div>
  );
}

window.BookingPage = BookingPage;
