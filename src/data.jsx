// Mock data store for Receptionly

export const BUSINESS = {
  id: 'biz_avalon',
  name: 'Avalon Salon & Spa',
  type: 'Salon',
  slug: 'avalon-salon',
  ownerName: 'Olivia Park',
  email: 'olivia@avalonsalon.com',
  phone: '(415) 555-0182',
  address: '418 Hayes Street',
  city: 'San Francisco',
  state: 'CA',
  zip: '94102',
  timezone: 'America/Los_Angeles',
  website: 'avalonsalon.com',
  bookingLink: 'receptionly.com/book/avalon-salon',
  logoMonogram: 'AV',
  logo: null, // data URL when the user uploads one; null falls back to monogram
  hours: {
    Mon: { open: '09:00', close: '19:00', closed: false },
    Tue: { open: '09:00', close: '19:00', closed: false },
    Wed: { open: '09:00', close: '19:00', closed: false },
    Thu: { open: '09:00', close: '20:00', closed: false },
    Fri: { open: '09:00', close: '20:00', closed: false },
    Sat: { open: '10:00', close: '18:00', closed: false },
    Sun: { open: '10:00', close: '16:00', closed: true  },
  },
  closures: [
    { id: 'c_seed_xmas', preset: 'us-christmas', name: 'Christmas Day', date: '2026-12-25', fullDay: true, open: '10:00', close: '14:00' },
    { id: 'c_seed_nye', name: "New Year's Eve — early close", date: '2026-12-31', fullDay: false, open: '10:00', close: '15:00' },
  ]
};

export const STAFF = [
  { id: 's_mike',   name: 'Mike Rodriguez', role: 'Senior Barber',     color: '#3F5D43', initials: 'MR',
    services: ['svc_mens_cut','svc_beard','svc_kids_cut','svc_hot_towel'],
    hours: { Mon:['10:00','19:00'], Tue:['10:00','19:00'], Wed:'off', Thu:['10:00','20:00'], Fri:['10:00','20:00'], Sat:['10:00','18:00'], Sun:'off' },
    lunch: '13:00–14:00', active: true, bookingBuffer: 5 },
  { id: 's_sarah',  name: 'Sarah Kim',      role: 'Stylist',           color: '#C97A4F', initials: 'SK',
    services: ['svc_womens_cut','svc_blowout','svc_kids_cut','svc_updo'],
    hours: { Mon:['09:00','17:00'], Tue:['09:00','17:00'], Wed:['09:00','17:00'], Thu:['11:00','20:00'], Fri:['11:00','20:00'], Sat:'off', Sun:'off' },
    lunch: '12:30–13:30', active: true, bookingBuffer: 10 },
  { id: 's_amanda', name: 'Amanda Lee',     role: 'Esthetician',       color: '#B8556A', initials: 'AL',
    services: ['svc_facial','svc_brow','svc_wax_full','svc_chem_peel'],
    hours: { Mon:'off', Tue:['10:00','18:00'], Wed:['10:00','18:00'], Thu:['10:00','18:00'], Fri:['10:00','19:00'], Sat:['10:00','18:00'], Sun:'off' },
    lunch: '13:00–14:00', active: true, bookingBuffer: 15 },
  { id: 's_jess',   name: 'Jessica Martinez', role: 'Colorist',         color: '#7A4A8F', initials: 'JM',
    services: ['svc_full_color','svc_balayage','svc_gloss','svc_womens_cut'],
    hours: { Mon:['11:00','19:00'], Tue:'off', Wed:['11:00','19:00'], Thu:['11:00','20:00'], Fri:['11:00','20:00'], Sat:['10:00','18:00'], Sun:'off' },
    lunch: '14:00–15:00', active: true, bookingBuffer: 10 },
  { id: 's_david',  name: 'David Chen',     role: 'Massage Therapist', color: '#4A6B8A', initials: 'DC',
    services: ['svc_deep_tissue','svc_swedish','svc_hot_stone'],
    hours: { Mon:['10:00','18:00'], Tue:['10:00','18:00'], Wed:'off', Thu:['10:00','18:00'], Fri:['10:00','19:00'], Sat:['10:00','17:00'], Sun:'off' },
    lunch: '13:00–14:00', active: true, bookingBuffer: 15 },
  { id: 's_priya',  name: 'Priya Shah',     role: 'Nail Technician',   color: '#A48230', initials: 'PS',
    services: ['svc_gel_mani','svc_classic_mani','svc_pedi','svc_gel_x'],
    hours: { Mon:['10:00','18:00'], Tue:['10:00','18:00'], Wed:['10:00','18:00'], Thu:'off', Fri:['10:00','19:00'], Sat:['10:00','18:00'], Sun:'off' },
    lunch: '13:00–13:30', active: true, bookingBuffer: 5 },
];

export const SERVICE_CATEGORIES = [
  { id: 'cat_haircuts', name: 'Haircuts' },
  { id: 'cat_color',    name: 'Hair Color' },
  { id: 'cat_barber',   name: 'Barbering' },
  { id: 'cat_face',     name: 'Facials' },
  { id: 'cat_massage',  name: 'Massage' },
  { id: 'cat_nails',    name: 'Nails' },
  { id: 'cat_waxing',   name: 'Waxing' },
  { id: 'cat_other',    name: 'Other' },
];

export const SERVICES = [
  // Haircuts
  { id:'svc_womens_cut', name:"Women's Haircut", category:'cat_haircuts', duration:60, price:75, bufferAfter:10, resource:'salon_chair', online:true,  desc:"Consultation, shampoo, cut & style.", staff:['s_sarah','s_jess'] },
  { id:'svc_blowout',    name:'Blowout',         category:'cat_haircuts', duration:45, price:55, bufferAfter:5,  resource:'salon_chair', online:true,  desc:'Shampoo and blow-dry styling.', staff:['s_sarah'] },
  { id:'svc_kids_cut',   name:"Kids' Haircut",   category:'cat_haircuts', duration:30, price:35, bufferAfter:5,  resource:'salon_chair', online:true,  desc:'Ages 10 and under.', staff:['s_mike','s_sarah'] },
  { id:'svc_updo',       name:'Special Occasion Updo', category:'cat_haircuts', duration:60, price:90, bufferAfter:10, resource:'salon_chair', online:true, desc:'Event-ready styling.', staff:['s_sarah'] },

  // Color
  { id:'svc_full_color', name:'Full Color',       category:'cat_color', duration:120, price:180, bufferAfter:15, resource:'color_station', online:true,  desc:'Single-process all-over color.', staff:['s_jess'] },
  { id:'svc_balayage',   name:'Balayage',         category:'cat_color', duration:180, price:280, bufferAfter:20, resource:'color_station', online:true,  desc:'Hand-painted highlights.', staff:['s_jess'] },
  { id:'svc_gloss',      name:'Glaze & Gloss',    category:'cat_color', duration:45,  price:65,  bufferAfter:10, resource:'color_station', online:true,  desc:'Shine treatment & toning.', staff:['s_jess'] },

  // Barber
  { id:'svc_mens_cut',   name:"Men's Haircut",    category:'cat_barber', duration:30, price:35, bufferAfter:5, resource:'barber_chair', online:true, desc:'Classic or modern cut, includes neck shave.', staff:['s_mike'] },
  { id:'svc_beard',      name:'Beard Trim',       category:'cat_barber', duration:15, price:20, bufferAfter:5, resource:'barber_chair', online:true, desc:'Shape and line-up.', staff:['s_mike'] },
  { id:'svc_hot_towel',  name:'Hot Towel Shave',  category:'cat_barber', duration:30, price:40, bufferAfter:5, resource:'barber_chair', online:true, desc:'Straight razor shave w/ hot towel.', staff:['s_mike'] },

  // Face
  { id:'svc_facial',     name:'Signature Facial', category:'cat_face', duration:60, price:120, bufferAfter:15, resource:'treatment_room', online:true, desc:'Cleanse, exfoliate, mask, massage.', staff:['s_amanda'] },
  { id:'svc_chem_peel',  name:'Chemical Peel',    category:'cat_face', duration:45, price:140, bufferAfter:15, resource:'treatment_room', online:false, desc:'Consultation required. Glycolic peel.', staff:['s_amanda'] },
  { id:'svc_brow',       name:'Brow Shaping',     category:'cat_face', duration:20, price:35,  bufferAfter:5,  resource:'treatment_room', online:true, desc:'Tweeze & wax.', staff:['s_amanda'] },

  // Massage
  { id:'svc_deep_tissue', name:'Deep Tissue Massage', category:'cat_massage', duration:60, price:130, bufferAfter:15, resource:'massage_room', online:true, desc:'Focused pressure for tension.', staff:['s_david'] },
  { id:'svc_swedish',     name:'Swedish Massage',     category:'cat_massage', duration:60, price:115, bufferAfter:15, resource:'massage_room', online:true, desc:'Relaxation-focused.', staff:['s_david'] },
  { id:'svc_hot_stone',   name:'Hot Stone Massage',   category:'cat_massage', duration:75, price:150, bufferAfter:15, resource:'massage_room', online:true, desc:'Warm basalt stones, full body.', staff:['s_david'] },

  // Nails
  { id:'svc_gel_mani',     name:'Gel Manicure',     category:'cat_nails', duration:45, price:50, bufferAfter:5, resource:'nail_station', online:true, desc:'Long-wear gel polish.', staff:['s_priya'] },
  { id:'svc_classic_mani', name:'Classic Manicure', category:'cat_nails', duration:30, price:35, bufferAfter:5, resource:'nail_station', online:true, desc:'Trim, file, polish.', staff:['s_priya'] },
  { id:'svc_pedi',         name:'Spa Pedicure',     category:'cat_nails', duration:45, price:65, bufferAfter:5, resource:'nail_station', online:true, desc:'Soak, scrub, polish.', staff:['s_priya'] },
  { id:'svc_gel_x',        name:'Gel-X Extensions', category:'cat_nails', duration:75, price:95, bufferAfter:10, resource:'nail_station', online:true, desc:'Soft gel tip extensions.', staff:['s_priya'] },

  // Waxing
  { id:'svc_wax_full',  name:'Full Leg Wax', category:'cat_waxing', duration:45, price:75, bufferAfter:5, resource:'treatment_room', online:true, desc:'', staff:['s_amanda'] },
];

export const RESOURCES = [
  { id:'barber_chair',    name:'Barber Chair',    type:'Barber Chair',    qty:1, services:['svc_mens_cut','svc_beard','svc_hot_towel'], active:true },
  { id:'salon_chair',     name:'Salon Chair',     type:'Salon Chair',     qty:2, services:['svc_womens_cut','svc_blowout','svc_kids_cut','svc_updo'], active:true },
  { id:'color_station',   name:'Color Station',   type:'Color Station',   qty:1, services:['svc_full_color','svc_balayage','svc_gloss'], active:true },
  { id:'treatment_room',  name:'Treatment Room',  type:'Treatment Room',  qty:1, services:['svc_facial','svc_brow','svc_chem_peel','svc_wax_full'], active:true },
  { id:'massage_room',    name:'Massage Room',    type:'Massage Room',    qty:1, services:['svc_deep_tissue','svc_swedish','svc_hot_stone'], active:true },
  { id:'nail_station',    name:'Nail Station',    type:'Nail Station',    qty:2, services:['svc_gel_mani','svc_classic_mani','svc_pedi','svc_gel_x'], active:true },
];

export const CUSTOMERS = [
  { id:'c_1', name:'Emma Thompson', phone:'(415) 555-0142', email:'emma.t@gmail.com', favorite:'s_sarah', lastVisit:'Apr 21, 2026', visits:14, noShows:0, notes:'Sensitive scalp — use sulfate-free shampoo only. Books her own touch-ups every 6 weeks.' },
  { id:'c_2', name:'James O\'Connor', phone:'(415) 555-0177', email:'jamesoc@hey.com', favorite:'s_mike', lastVisit:'Apr 28, 2026', visits:6, noShows:0 },
  { id:'c_3', name:'Sofia Reyes', phone:'(415) 555-0119', email:'sofia.r@outlook.com', favorite:null, lastVisit:'—', visits:0, noShows:0 },
  { id:'c_4', name:'Marcus Bell', phone:'(415) 555-0163', email:'marcus@bell.studio', favorite:'s_david', lastVisit:'Mar 30, 2026', visits:3, noShows:1 },
  { id:'c_5', name:'Hana Watanabe', phone:'(415) 555-0188', email:'hana.w@gmail.com', favorite:'s_jess', lastVisit:'Apr 14, 2026', visits:22, noShows:0 },
  { id:'c_6', name:'Daniel Park', phone:'(415) 555-0124', email:'daniel.park@gmail.com', favorite:'s_mike', lastVisit:'May 02, 2026', visits:9, noShows:0 },
  { id:'c_7', name:'Ava Nguyen', phone:'(415) 555-0151', email:'ava.n@gmail.com', favorite:'s_priya', lastVisit:'Apr 30, 2026', visits:11, noShows:0 },
  { id:'c_8', name:'Olivia Brooks', phone:'(415) 555-0198', email:'oliviab@me.com', favorite:'s_amanda', lastVisit:'May 06, 2026', visits:18, noShows:0 },
];

// Helpers
export const STATUS = {
  // Calendar status palette — see also the inline appointment-block styles
  // in calendar.jsx / employee-calendar.jsx, which derive from the same hues
  // so the in-grid blocks and the row pills always agree.
  confirmed: { label:'Confirmed', dot:'#3D5A7C', soft:'#E4EAF1', ink:'#1F3A5C' }, // muted slate blue (upcoming)
  completed: { label:'Completed', dot:'#3F5D43', soft:'#EAEFE8', ink:'#2A3F2D' }, // forest green
  no_show:   { label:'No-Show',   dot:'#A07A1E', soft:'#F6EBC8', ink:'#6B4D00' }, // warm amber/yellow
  canceled:  { label:'Canceled',  dot:'#B8556A', soft:'#F5E2E6', ink:'#7A2A3D' }, // rose (not shown on calendar)
};

// Build today appointments programmatically. "Today" = today's actual local date so it always feels live.
// We deliberately avoid `toISOString()` because it converts to UTC and can flip the day in negative-UTC zones.
export function localDayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
export function todayKey() { return localDayKey(new Date()); }
export function offsetDayKey(days) {
  const d = new Date(); d.setDate(d.getDate()+days);
  return localDayKey(d);
}
// Parse an ISO date string (YYYY-MM-DD) as a LOCAL date — `new Date('2026-05-14')`
// parses as UTC midnight, which shifts the day backwards in negative-UTC zones.
export function parseDay(input) {
  if (input instanceof Date) return input;
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}/.test(input)) {
    const [y,m,d] = input.slice(0,10).split('-').map(Number);
    return new Date(y, m-1, d);
  }
  return new Date(input);
}
export function dayName(date) {
  const d = parseDay(date);
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
}

// Times helpers
export function toMin(t) { const [h,m] = t.split(':').map(Number); return h*60 + m; }
export function fromMin(m) { const h = Math.floor(m/60); const mm = m%60; return String(h).padStart(2,'0')+':'+String(mm).padStart(2,'0'); }
export function fmt12(t) { const [h,m] = t.split(':').map(Number); const ap = h>=12?'pm':'am'; const hh = ((h+11)%12)+1; return `${hh}:${String(m).padStart(2,'0')} ${ap}`.replace(':00','') ; }

// Realistic appointments for today + tomorrow + yesterday
export function makeAppt(id, day, start, serviceId, staffId, customerId, status='confirmed', source='walkin', notes='') {
  const svc = SERVICES.find(s => s.id === serviceId);
  const endMin = toMin(start) + svc.duration;
  return {
    id, day, start, end: fromMin(endMin), serviceId, staffId, customerId, status, source,
    price: svc.price, duration: svc.duration, notes,
  };
}

export const APPOINTMENTS = [
  // Today
  makeAppt('a1',  todayKey(), '09:30', 'svc_mens_cut',     's_mike',   'c_2',  'completed',  'walkin'),
  makeAppt('a2',  todayKey(), '10:30', 'svc_beard',        's_mike',   'c_6',  'confirmed',  'phone', "Wants the beard a little shorter than last time. Allergic to citrus aftershaves \u2014 use unscented."),
  makeAppt('a3',  todayKey(), '11:15', 'svc_mens_cut',     's_mike',   'c_4',  'confirmed',  'online'),
  makeAppt('a4',  todayKey(), '14:30', 'svc_hot_towel',    's_mike',   'c_6',  'confirmed',  'ai'),
  makeAppt('a5',  todayKey(), '16:00', 'svc_mens_cut',     's_mike',   'c_2',  'confirmed',  'ai'),

  makeAppt('a6',  todayKey(), '09:00', 'svc_blowout',      's_sarah',  'c_1',  'completed',  'online'),
  makeAppt('a7',  todayKey(), '10:30', 'svc_womens_cut',   's_sarah',  'c_8',  'confirmed',  'phone'),
  makeAppt('a8',  todayKey(), '14:00', 'svc_updo',         's_sarah',  'c_5',  'confirmed',  'online'),
  makeAppt('a9',  todayKey(), '15:30', 'svc_kids_cut',     's_sarah',  'c_3',  'confirmed',  'ai'),

  makeAppt('a10', todayKey(), '10:30', 'svc_facial',       's_amanda', 'c_8',  'confirmed',  'online'),
  makeAppt('a11', todayKey(), '12:00', 'svc_brow',         's_amanda', 'c_1',  'confirmed',  'phone'),
  makeAppt('a12', todayKey(), '15:00', 'svc_facial',       's_amanda', 'c_5',  'confirmed',  'ai'),

  makeAppt('a13', todayKey(), '11:00', 'svc_full_color',   's_jess',   'c_5',  'confirmed',  'online', 'First time going darker \u2014 wants warm chestnut, NOT cool ash. Bring reference photos out of phone.'),
  makeAppt('a14', todayKey(), '15:00', 'svc_balayage',     's_jess',   'c_1',  'confirmed',  'ai'),

  makeAppt('a15', todayKey(), '10:00', 'svc_deep_tissue',  's_david',  'c_4',  'completed',  'phone'),
  makeAppt('a16', todayKey(), '12:00', 'svc_swedish',      's_david',  'c_6',  'confirmed',  'online'),
  makeAppt('a17', todayKey(), '15:30', 'svc_hot_stone',    's_david',  'c_8',  'confirmed',  'ai'),

  makeAppt('a18', todayKey(), '10:30', 'svc_gel_mani',     's_priya',  'c_7',  'no_show',    'online'),
  makeAppt('a19', todayKey(), '12:00', 'svc_pedi',         's_priya',  'c_1',  'confirmed',  'phone'),
  makeAppt('a20', todayKey(), '14:30', 'svc_gel_x',        's_priya',  'c_3',  'confirmed',  'ai'),
  makeAppt('a21', todayKey(), '16:00', 'svc_classic_mani', 's_priya',  'c_7',  'canceled',   'online'),

  // Tomorrow (a few)
  makeAppt('b1', offsetDayKey(1), '10:00', 'svc_womens_cut', 's_sarah', 'c_3',  'confirmed', 'ai'),
  makeAppt('b2', offsetDayKey(1), '11:30', 'svc_mens_cut',   's_mike',  'c_4',  'confirmed', 'online'),
  makeAppt('b3', offsetDayKey(1), '13:00', 'svc_facial',     's_amanda','c_8',  'confirmed', 'phone'),
  makeAppt('b4', offsetDayKey(1), '14:30', 'svc_balayage',   's_jess',  'c_5',  'confirmed', 'ai'),

  // Yesterday (history)
  makeAppt('p1', offsetDayKey(-1), '11:00', 'svc_mens_cut',  's_mike',  'c_2', 'completed', 'walkin'),
  makeAppt('p2', offsetDayKey(-1), '14:00', 'svc_facial',    's_amanda','c_8', 'completed', 'online'),
  makeAppt('p3', offsetDayKey(-1), '15:30', 'svc_deep_tissue','s_david','c_4', 'canceled',  'phone'),
];

// Historical seed — fill the last ~90 days with realistic completed
// appointments so the Reports / My-performance range tabs (7d/30d/90d/Custom)
// produce meaningful trends instead of repeating yesterday's two rows.
// Deterministic: same seed → same data on every reload.
(function seedAppointmentHistory() {
  function makeRng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  }
  let nextId = 1000;
  const sources = ['online', 'phone', 'ai', 'walkin'];
  for (let dayOffset = -90; dayOffset <= -2; dayOffset++) {
    const dayStr = offsetDayKey(dayOffset);
    const dow = dayName(dayStr);
    STAFF.forEach((staff, sIdx) => {
      const sched = staff.hours[dow];
      if (!Array.isArray(sched)) return; // off that day
      const rand = makeRng((Math.abs(dayOffset) + 1) * 9176 + sIdx * 311);
      // Density: heavier toward end of week, lighter Mon/Tue
      const dayWeight = { Mon: 0.6, Tue: 0.8, Wed: 0.9, Thu: 1.0, Fri: 1.2, Sat: 1.3, Sun: 0.7 }[dow] || 1.0;
      const count = Math.max(1, Math.round((3 + rand() * 3) * dayWeight));
      const [openH, openM]   = sched[0].split(':').map(Number);
      const [closeH, closeM] = sched[1].split(':').map(Number);
      const openMin  = openH * 60 + openM;
      const closeMin = closeH * 60 + closeM;
      const span = closeMin - openMin;
      if (span <= 60) return;
      const services = staff.services;
      const used = new Set();
      for (let i = 0; i < count; i++) {
        const svcId = services[Math.floor(rand() * services.length)];
        const svc = SERVICES.find(s => s.id === svcId);
        const cust = CUSTOMERS[Math.floor(rand() * CUSTOMERS.length)];
        // Stagger across the working day
        const slotPos = (i + rand() * 0.4) / count;
        let startMin = openMin + Math.floor(slotPos * (span - svc.duration));
        startMin = Math.max(openMin, Math.min(startMin, closeMin - svc.duration));
        startMin = Math.round(startMin / 15) * 15;
        const start = fromMin(startMin);
        if (used.has(start)) continue;
        used.add(start);
        // 90% completed, 5% canceled, 5% no-show.
        const r = rand();
        const status = r < 0.90 ? 'completed' : r < 0.95 ? 'canceled' : 'no_show';
        const source = sources[Math.floor(rand() * sources.length)];
        APPOINTMENTS.push(
          makeAppt(`h${nextId++}`, dayStr, start, svcId, staff.id, cust.id, status, source)
        );
      }
    });
  }
})();

// ─────────────────────────────────────────────────────────────────────
// MULTI-LOCATION DATA
// Each location keeps its own copy of business info, staff, services,
// resources, customers and appointments. The currently-active location's
// data is mirrored onto the BUSINESS / STAFF / … globals so existing
// page components continue to "just work" — they read from the global
// names every render, so swapping a location updates the whole app.
//
// ACCOUNT holds business-level fields that DO NOT change per location —
// brand name, type, owner / admin contact. Location-specific contact
// info (address, phone, hours, …) lives on each location's `business`.
// ─────────────────────────────────────────────────────────────────────

export const ACCOUNT = {
  businessName: BUSINESS.name,
  type: BUSINESS.type,
  ownerName: BUSINESS.ownerName,
  email: BUSINESS.email,
  adminPhone: BUSINESS.phone, // separate from per-location phone
  // Optional business-wide cancellation policy. Shown to customers on the
  // booking page's "Your details" step. Blank = nothing shown.
  cancellationPolicy: '',
  // AI Agent stats toggle. When false, AI-related KPIs, alerts panel,
  // and AI source breakdowns are hidden across the app.
  aiAgentEnabled: true,
  // Optional business-wide logo (data URL). Mirrored to every location's
  // business.logo so the sidebar / booking page can read it from whichever
  // location is active.
  logo: null,
};

// ─────────────────────────────────────────────────────────────────
// MANUAL BLOCKS — user-created breaks / lunch breaks placed directly
// on the calendar (separate from the recurring weekly lunch template
// on each staff member). Each block belongs to a staff member, a
// specific date, and a specific [start, end) window. Type drives the
// label only — break vs lunch_break both visually read as "unavailable"
// on the grid (striped slate). Lives per-location like APPOINTMENTS.
// ─────────────────────────────────────────────────────────────────

export const BLOCKS = [
  // Mike's mid-day coffee break. Sits AFTER his 11:15 men's-cut + buffer
  // (which runs to 11:50) and BEFORE his recurring 13–14 lunch.
  { id: 'b_seed1', staffId: 's_mike',  day: todayKey(),        start: '12:15', end: '12:45', type: 'break',       note: 'Coffee run' },
  { id: 'b_seed2', staffId: 's_sarah', day: offsetDayKey(1),   start: '15:00', end: '15:30', type: 'break',       note: '' },
];

export const MISSION_BLOCKS = [
  { id: 'bm_seed1', staffId: 'sm_kai',  day: todayKey(),       start: '14:00', end: '14:30', type: 'break',       note: '' },
];

// Location 1 — Hayes Valley (the original seed data above, wrapped up).
export const LOC_HAYES = {
  id: 'loc_hayes',
  name: 'Hayes Valley',
  business: {
    ...BUSINESS,
    locationName: 'Hayes Valley',
    address: '418 Hayes Street',
    city: 'San Francisco',
    state: 'CA',
    zip: '94102',
    phone: '(415) 555-0182',
    bookingLink: 'receptionly.com/book/avalon-hayes',
    slug: 'avalon-hayes',
  },
  staff: STAFF,
  services: SERVICES,
  serviceCategories: SERVICE_CATEGORIES,
  resources: RESOURCES,
  customers: CUSTOMERS,
  appointments: APPOINTMENTS,
  blocks: BLOCKS,
};

// Location 2 — Mission District. Smaller team, different menu mix, its
// own staff/services/customers/appointments so switching is visibly
// different across every page.
export const MISSION_STAFF = [
  { id: 'sm_lena',  name: 'Lena Alvarez',    role: 'Senior Stylist',    color: '#3F5D43', initials: 'LA',
    services: ['svm_womens_cut','svm_blowout','svm_balayage','svm_updo','svm_gloss'],
    hours: { Mon:['10:00','19:00'], Tue:['10:00','19:00'], Wed:['10:00','19:00'], Thu:['11:00','20:00'], Fri:['11:00','20:00'], Sat:['10:00','18:00'], Sun:'off' },
    lunch: '13:00–14:00', active: true, bookingBuffer: 10 },
  { id: 'sm_theo',  name: 'Theo Castellano', role: 'Barber',            color: '#C97A4F', initials: 'TC',
    services: ['svm_mens_cut','svm_beard','svm_fade','svm_hot_towel'],
    hours: { Mon:['09:00','18:00'], Tue:['09:00','18:00'], Wed:'off', Thu:['09:00','19:00'], Fri:['09:00','19:00'], Sat:['09:00','17:00'], Sun:'off' },
    lunch: '12:30–13:30', active: true, bookingBuffer: 5 },
  { id: 'sm_noor',  name: 'Noor Ahmadi',     role: 'Esthetician',       color: '#B8556A', initials: 'NA',
    services: ['svm_facial','svm_brow','svm_lash_lift'],
    hours: { Mon:'off', Tue:['11:00','19:00'], Wed:['11:00','19:00'], Thu:['11:00','19:00'], Fri:['11:00','19:00'], Sat:['10:00','18:00'], Sun:'off' },
    lunch: '14:00–14:30', active: true, bookingBuffer: 15 },
  { id: 'sm_kai',   name: 'Kai Rivera',      role: 'Nail Technician',   color: '#7A4A8F', initials: 'KR',
    services: ['svm_gel_mani','svm_pedi','svm_classic_mani'],
    hours: { Mon:['10:00','18:00'], Tue:['10:00','18:00'], Wed:['10:00','18:00'], Thu:'off', Fri:['10:00','19:00'], Sat:['10:00','18:00'], Sun:'off' },
    lunch: '13:00–13:30', active: true, bookingBuffer: 5 },
];

export const MISSION_SERVICE_CATEGORIES = [
  { id: 'catm_haircuts', name: 'Haircuts' },
  { id: 'catm_color',    name: 'Hair Color' },
  { id: 'catm_barber',   name: 'Barbering' },
  { id: 'catm_face',     name: 'Facials' },
  { id: 'catm_nails',    name: 'Nails' },
  { id: 'catm_other',    name: 'Other' },
];

export const MISSION_SERVICES = [
  { id:'svm_womens_cut', name:"Women's Haircut", category:'catm_haircuts', duration:60, price:80,  bufferAfter:10, resource:'rsm_chair', online:true, desc:'Consultation, shampoo, cut & style.', staff:['sm_lena'] },
  { id:'svm_blowout',    name:'Blowout',          category:'catm_haircuts', duration:45, price:55,  bufferAfter:5,  resource:'rsm_chair', online:true, desc:'Shampoo and blow-dry styling.', staff:['sm_lena'] },
  { id:'svm_updo',       name:'Special Occasion Updo', category:'catm_haircuts', duration:75, price:95, bufferAfter:10, resource:'rsm_chair', online:true, desc:'Event-ready styling.', staff:['sm_lena'] },

  { id:'svm_balayage',   name:'Balayage',         category:'catm_color', duration:180, price:295, bufferAfter:20, resource:'rsm_color', online:true, desc:'Hand-painted highlights.', staff:['sm_lena'] },
  { id:'svm_gloss',      name:'Glaze & Gloss',    category:'catm_color', duration:45,  price:70,  bufferAfter:10, resource:'rsm_color', online:true, desc:'Shine treatment & toning.', staff:['sm_lena'] },

  { id:'svm_mens_cut',   name:"Men's Haircut",    category:'catm_barber', duration:30, price:40, bufferAfter:5, resource:'rsm_barber', online:true, desc:'Modern cut, includes neck shave.', staff:['sm_theo'] },
  { id:'svm_fade',       name:'Skin Fade',        category:'catm_barber', duration:45, price:55, bufferAfter:5, resource:'rsm_barber', online:true, desc:'Precision fade with detailed line-up.', staff:['sm_theo'] },
  { id:'svm_beard',      name:'Beard Trim',       category:'catm_barber', duration:15, price:22, bufferAfter:5, resource:'rsm_barber', online:true, desc:'Shape and line-up.', staff:['sm_theo'] },
  { id:'svm_hot_towel',  name:'Hot Towel Shave',  category:'catm_barber', duration:30, price:45, bufferAfter:5, resource:'rsm_barber', online:true, desc:'Straight razor shave w/ hot towel.', staff:['sm_theo'] },

  { id:'svm_facial',     name:'Brightening Facial', category:'catm_face', duration:60, price:135, bufferAfter:15, resource:'rsm_treatment', online:true, desc:'Cleanse, exfoliate, vitamin-C mask.', staff:['sm_noor'] },
  { id:'svm_brow',       name:'Brow Lamination',    category:'catm_face', duration:30, price:55,  bufferAfter:5,  resource:'rsm_treatment', online:true, desc:'Brow lift & tint.', staff:['sm_noor'] },
  { id:'svm_lash_lift',  name:'Lash Lift & Tint',   category:'catm_face', duration:45, price:95,  bufferAfter:10, resource:'rsm_treatment', online:true, desc:'Curl + tint, no extensions.', staff:['sm_noor'] },

  { id:'svm_gel_mani',     name:'Gel Manicure',     category:'catm_nails', duration:45, price:55, bufferAfter:5, resource:'rsm_nail', online:true, desc:'Long-wear gel polish.', staff:['sm_kai'] },
  { id:'svm_classic_mani', name:'Classic Manicure', category:'catm_nails', duration:30, price:38, bufferAfter:5, resource:'rsm_nail', online:true, desc:'Trim, file, polish.', staff:['sm_kai'] },
  { id:'svm_pedi',         name:'Spa Pedicure',     category:'catm_nails', duration:50, price:70, bufferAfter:5, resource:'rsm_nail', online:true, desc:'Soak, scrub, polish.', staff:['sm_kai'] },
];

export const MISSION_RESOURCES = [
  { id:'rsm_chair',     name:'Stylist Chair A', type:'Salon Chair',     qty:2, services:['svm_womens_cut','svm_blowout','svm_updo'], active:true },
  { id:'rsm_color',     name:'Color Station',   type:'Color Station',   qty:1, services:['svm_balayage','svm_gloss'], active:true },
  { id:'rsm_barber',    name:'Barber Chair',    type:'Barber Chair',    qty:1, services:['svm_mens_cut','svm_fade','svm_beard','svm_hot_towel'], active:true },
  { id:'rsm_treatment', name:'Treatment Room',  type:'Treatment Room',  qty:1, services:['svm_facial','svm_brow','svm_lash_lift'], active:true },
  { id:'rsm_nail',      name:'Nail Station',    type:'Nail Station',    qty:2, services:['svm_gel_mani','svm_classic_mani','svm_pedi'], active:true },
];

export const MISSION_CUSTOMERS = [
  { id:'cm_1', name:'Isabela Cortez', phone:'(415) 555-0203', email:'isa.cortez@gmail.com', favorite:'sm_lena',  lastVisit:'May 04, 2026', visits:9, noShows:0 },
  { id:'cm_2', name:'Theo Bukowski',  phone:'(415) 555-0211', email:'theo.b@hey.com',       favorite:'sm_theo',  lastVisit:'Apr 27, 2026', visits:5, noShows:0 },
  { id:'cm_3', name:'Mei Watanabe',   phone:'(415) 555-0237', email:'mei.w@outlook.com',    favorite:'sm_noor',  lastVisit:'Apr 30, 2026', visits:12, noShows:0 },
  { id:'cm_4', name:'Jordan Pierce',  phone:'(415) 555-0241', email:'jpierce@me.com',       favorite:'sm_kai',   lastVisit:'May 05, 2026', visits:7, noShows:1, notes:'Prefers shorter no-chip gel. Texts to confirm — don\u2019t call.' },
  { id:'cm_5', name:'Ana Salinas',    phone:'(415) 555-0259', email:'ana.s@gmail.com',      favorite:'sm_lena',  lastVisit:'Apr 19, 2026', visits:14, noShows:0 },
  { id:'cm_6', name:'Reza Ostovar',   phone:'(415) 555-0264', email:'reza@studio.co',       favorite:null,       lastVisit:'—',             visits:0, noShows:0 },
];

// Mission-only helper for building appointments with its own SERVICES.
export function makeApptM(id, day, start, serviceId, staffId, customerId, status='confirmed', source='walkin', notes='') {
  const svc = MISSION_SERVICES.find(s => s.id === serviceId);
  const endMin = toMin(start) + svc.duration;
  return {
    id, day, start, end: fromMin(endMin), serviceId, staffId, customerId, status, source,
    price: svc.price, duration: svc.duration, notes,
  };
}

// Alerts — per location. Both lists reference customers and appointments
// from THEIR OWN location, so switching locations swaps the dataset cleanly
// and we never end up looking up a Hayes customer id against the Mission
// customer list (which is what previously produced "Unknown" rows).
export const HAYES_ALERTS = [
  {
    id: 'al_1',
    type: 'late',
    customerId: 'c_1',
    apptId: 'a19',
    message: `“Hey, I’m about 5 minutes behind — coming straight from work. Don’t give my spot away!”`,
    received: '4 min ago',
    receivedAt: '11:21 AM',
    status: 'new',
  },
  {
    id: 'al_2',
    type: 'cancel',
    customerId: 'c_4',
    apptId: 'a3',
    message: `“I have to cancel today’s appointment — woke up with a fever. I’ll call back to rebook later this week.”`,
    received: '22 min ago',
    receivedAt: '11:03 AM',
    status: 'new',
  },
  {
    id: 'al_3',
    type: 'reschedule',
    customerId: 'c_8',
    apptId: 'a17',
    message: `“Something came up at work and I can’t make my 3:30 today. Could we move it to tomorrow around the same time?”`,
    received: '38 min ago',
    receivedAt: '10:47 AM',
    status: 'new',
  },
  {
    id: 'al_4',
    type: 'late',
    customerId: 'c_2',
    apptId: 'a5',
    message: `“Stuck in traffic on the bridge — going to be about 5 minutes late for the 4 o’clock. Sorry!”`,
    received: 'Just now',
    receivedAt: '11:25 AM',
    status: 'new',
  },
  {
    id: 'al_5',
    type: 'late',
    customerId: 'c_5',
    apptId: 'a8',
    message: `“Running about 5 minutes behind for my 2pm — parking is a nightmare. Be there shortly.”`,
    received: '12 min ago',
    receivedAt: '11:13 AM',
    status: 'new',
  },
  {
    id: 'al_6',
    type: 'cancel',
    customerId: 'c_3',
    apptId: 'a9',
    message: `“My son just came down with something — I need to cancel his 3:30 today. I’ll call to reschedule when he’s better.”`,
    received: '1 hr ago',
    receivedAt: '10:25 AM',
    status: 'reviewed',
  },
  {
    id: 'al_7',
    type: 'reschedule',
    customerId: 'c_6',
    apptId: 'a4',
    message: `“Hey — work meeting just got pushed and I can’t do 2:30 anymore. Any chance you have something later today or tomorrow?”`,
    received: '2 hr ago',
    receivedAt: '9:30 AM',
    status: 'reviewed',
  },
];

export const MISSION_ALERTS = [
  {
    id: 'alm_1',
    type: 'late',
    customerId: 'cm_5',         // Ana Salinas
    apptId: 'm2',               // 11:30 Blowout with Lena
    message: `“Hi! Just finishing up a call — I’ll be 5 minutes late for my 11:30 with Lena.”`,
    received: '6 min ago',
    receivedAt: '11:19 AM',
    status: 'new',
  },
  {
    id: 'alm_2',
    type: 'cancel',
    customerId: 'cm_2',         // Theo Bukowski
    apptId: 'm5',               // 11:00 Fade with Theo C.
    message: `“Something urgent came up at work — have to cancel my 11 today. I’ll rebook online tonight.”`,
    received: '18 min ago',
    receivedAt: '11:07 AM',
    status: 'new',
  },
  {
    id: 'alm_3',
    type: 'reschedule',
    customerId: 'cm_6',         // Reza Ostovar
    apptId: 'm6',               // 15:00 Hot Towel with Theo C.
    message: `“Any chance we can move my 3pm shave to later this week? Tomorrow afternoon would be ideal.”`,
    received: '34 min ago',
    receivedAt: '10:51 AM',
    status: 'new',
  },
  {
    id: 'alm_4',
    type: 'late',
    customerId: 'cm_3',         // Mei Watanabe
    apptId: 'm7',               // 12:00 Facial with Noor
    message: `“Muni is running slow — I’ll be about 5 minutes behind for my noon facial.”`,
    received: 'Just now',
    receivedAt: '11:26 AM',
    status: 'new',
  },
  {
    id: 'alm_5',
    type: 'cancel',
    customerId: 'cm_1',         // Isabela Cortez
    apptId: 'm10',              // 13:30 Pedi with Kai
    message: `“I’m sick today, won’t be able to make my 1:30 pedicure. Sorry for the late notice.”`,
    received: '1 hr ago',
    receivedAt: '10:25 AM',
    status: 'reviewed',
  },
];

export const MISSION_APPOINTMENTS = [
  // Today — lighter day
  makeApptM('m1', todayKey(), '10:00', 'svm_womens_cut','sm_lena', 'cm_1', 'completed', 'online'),
  makeApptM('m2', todayKey(), '11:30', 'svm_blowout',   'sm_lena', 'cm_5', 'confirmed', 'phone'),
  makeApptM('m3', todayKey(), '14:00', 'svm_balayage',  'sm_lena', 'cm_3', 'confirmed', 'ai', 'Returning client \u2014 same brightness as last appointment, lift the face-framing pieces a touch more.'),

  makeApptM('m4', todayKey(), '09:30', 'svm_mens_cut',  'sm_theo', 'cm_2', 'completed', 'walkin'),
  makeApptM('m5', todayKey(), '11:00', 'svm_fade',      'sm_theo', 'cm_2', 'confirmed', 'ai'),
  makeApptM('m6', todayKey(), '15:00', 'svm_hot_towel', 'sm_theo', 'cm_6', 'confirmed', 'online'),

  makeApptM('m7', todayKey(), '12:00', 'svm_facial',    'sm_noor', 'cm_3', 'confirmed', 'online'),
  makeApptM('m8', todayKey(), '15:30', 'svm_lash_lift', 'sm_noor', 'cm_5', 'confirmed', 'ai'),

  makeApptM('m9', todayKey(),  '11:00', 'svm_gel_mani', 'sm_kai',  'cm_4', 'completed', 'phone'),
  makeApptM('m10', todayKey(), '13:30', 'svm_pedi',     'sm_kai',  'cm_1', 'confirmed', 'online'),
  makeApptM('m11', todayKey(), '16:00', 'svm_classic_mani','sm_kai','cm_4','canceled', 'online'),

  // Tomorrow
  makeApptM('mb1', offsetDayKey(1), '10:00', 'svm_balayage','sm_lena','cm_5','confirmed','online'),
  makeApptM('mb2', offsetDayKey(1), '11:30', 'svm_mens_cut','sm_theo','cm_2','confirmed','ai'),
  makeApptM('mb3', offsetDayKey(1), '14:30', 'svm_facial',  'sm_noor','cm_3','confirmed','phone'),

  // Yesterday
  makeApptM('mp1', offsetDayKey(-1), '11:00', 'svm_fade',   'sm_theo', 'cm_2','completed','walkin'),
  makeApptM('mp2', offsetDayKey(-1), '14:00', 'svm_facial', 'sm_noor', 'cm_3','completed','online'),
];

export const LOC_MISSION = {
  id: 'loc_mission',
  name: 'Mission District',
  business: {
    id: 'biz_avalon',
    name: BUSINESS.name,
    type: BUSINESS.type,
    locationName: 'Mission District',
    slug: 'avalon-mission',
    ownerName: BUSINESS.ownerName,
    email: BUSINESS.email,
    phone: '(415) 555-0334',
    address: '2245 Valencia Street',
    city: 'San Francisco',
    state: 'CA',
    zip: '94110',
    timezone: 'America/Los_Angeles',
    website: BUSINESS.website,
    bookingLink: 'receptionly.com/book/avalon-mission',
    logoMonogram: 'AV',
    logo: null,
    hours: {
      Mon: { open: '10:00', close: '19:00', closed: false },
      Tue: { open: '10:00', close: '19:00', closed: false },
      Wed: { open: '10:00', close: '19:00', closed: false },
      Thu: { open: '10:00', close: '20:00', closed: false },
      Fri: { open: '10:00', close: '20:00', closed: false },
      Sat: { open: '09:00', close: '18:00', closed: false },
      Sun: { open: '11:00', close: '17:00', closed: true  },
    },
    closures: [
      { id: 'cm_seed_xmas', preset: 'us-christmas', name: 'Christmas Day', date: '2026-12-25', fullDay: true, open: '10:00', close: '14:00' },
    ],
  },
  staff: MISSION_STAFF,
  services: MISSION_SERVICES,
  serviceCategories: MISSION_SERVICE_CATEGORIES,
  resources: MISSION_RESOURCES,
  customers: MISSION_CUSTOMERS,
  appointments: MISSION_APPOINTMENTS,
  alerts: MISSION_ALERTS,
  blocks: MISSION_BLOCKS,
};

// Attach Hayes alerts to its location. (HAYES_ALERTS is defined after the
// LOC_HAYES literal, so we set it here rather than inline above.)
LOC_HAYES.alerts = HAYES_ALERTS;

// Mutable list — Settings can push new locations onto this at runtime.
export const LOCATIONS = [LOC_HAYES, LOC_MISSION];

// Currently-active location id. Synced onto window so all scripts agree.
export let ACTIVE_LOCATION_ID = LOC_HAYES.id;

export function getLocation(id) { return LOCATIONS.find(l => l.id === id) || LOCATIONS[0]; }
export function getActiveLocation() { return getLocation(ACTIVE_LOCATION_ID); }

// Swap the globals to point at `id`. Called from app.jsx on location change.
// We mutate the BUSINESS object in place (rather than reassigning) so any
// captured references continue to work.
export function setActiveLocation(id) {
  const loc = getLocation(id);
  ACTIVE_LOCATION_ID = loc.id;
  window.ACTIVE_LOCATION_ID = loc.id;
  // Replace global lists wholesale.
  window.STAFF = loc.staff;
  window.SERVICES = loc.services;
  window.SERVICE_CATEGORIES = loc.serviceCategories;
  window.RESOURCES = loc.resources;
  window.CUSTOMERS = loc.customers;
  window.APPOINTMENTS = loc.appointments;
  window.BLOCKS = loc.blocks || (loc.blocks = []);
  // Mutate BUSINESS in place to keep the same object identity.
  Object.keys(window.BUSINESS).forEach(k => { delete window.BUSINESS[k]; });
  Object.assign(window.BUSINESS, loc.business);
}

// Remove a location from the registry. Returns the id we suggest switching
// to (first remaining), or null if nothing left. Refuses to delete the last
// remaining location.
export function deleteLocation(id) {
  if (LOCATIONS.length <= 1) return { ok: false, reason: 'last' };
  const idx = LOCATIONS.findIndex(l => l.id === id);
  if (idx === -1) return { ok: false, reason: 'not-found' };
  LOCATIONS.splice(idx, 1);
  const fallbackId = LOCATIONS[0].id;
  if (ACTIVE_LOCATION_ID === id) setActiveLocation(fallbackId);
  return { ok: true, fallbackId };
}

// Expose
Object.assign(window, {
  BUSINESS, STAFF, SERVICE_CATEGORIES, SERVICES, RESOURCES, CUSTOMERS, APPOINTMENTS,
  BLOCKS,
  STATUS, ACCOUNT,
  LOCATIONS, ACTIVE_LOCATION_ID,
  getLocation, getActiveLocation, setActiveLocation, deleteLocation,
  todayKey, offsetDayKey, localDayKey, dayName, parseDay, toMin, fromMin, fmt12,
});
