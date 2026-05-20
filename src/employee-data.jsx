import { APPOINTMENTS, SERVICES, STAFF } from './data';

// Employee-side data layer — adds personal info on top of the shared data store.

// Per-staff personal profile data (bio, contact, payout pref, etc).
export const EMPLOYEE_PROFILES = {
  s_sarah: {
    pronouns: 'she/her',
    email: 'sarah.kim@avalonsalon.com',
    phone: '(415) 555-0142',
    bio: 'Hair stylist with 8 years of experience. Specializing in lived-in color, modern cuts, and event styling. Trained at Vidal Sassoon Academy.',
    instagram: '@sarah.cuts',
    startedAt: 'Jun 2022',
    payoutMethod: 'Direct deposit',
    commissionRate: '55%',
    avgRating: 4.9,
    reviewCount: 218,
    rebookRate: 78,
  },
  s_mike: {
    pronouns: 'he/him',
    email: 'mike.r@avalonsalon.com',
    phone: '(415) 555-0188',
    bio: 'Senior barber. Classic cuts, fades, beard work, hot towel shaves.',
    instagram: '@mikecutsfades',
    startedAt: 'Mar 2021',
    payoutMethod: 'Direct deposit',
    commissionRate: '50%',
    avgRating: 4.8,
    reviewCount: 312,
    rebookRate: 82,
  },
  s_amanda: {
    pronouns: 'she/her',
    email: 'amanda.l@avalonsalon.com',
    phone: '(415) 555-0167',
    bio: 'Licensed esthetician. Facials, peels, brow shaping. Acne-safe protocols.',
    instagram: '@amandaglowskin',
    startedAt: 'Sep 2023',
    payoutMethod: 'Direct deposit',
    commissionRate: '50%',
    avgRating: 4.9,
    reviewCount: 142,
    rebookRate: 71,
  },
  s_jess: {
    pronouns: 'she/her',
    email: 'jess.m@avalonsalon.com',
    phone: '(415) 555-0155',
    bio: 'Colorist. Balayage, dimensional color, color correction.',
    instagram: '@jess.color',
    startedAt: 'Jan 2022',
    payoutMethod: 'Direct deposit',
    commissionRate: '55%',
    avgRating: 4.9,
    reviewCount: 264,
    rebookRate: 80,
  },
  s_david: {
    pronouns: 'he/him',
    email: 'david.c@avalonsalon.com',
    phone: '(415) 555-0193',
    bio: 'LMT. Deep tissue, Swedish, hot stone. Sports-recovery focus.',
    instagram: '',
    startedAt: 'Aug 2022',
    payoutMethod: 'Direct deposit',
    commissionRate: '60%',
    avgRating: 5.0,
    reviewCount: 98,
    rebookRate: 86,
  },
  s_priya: {
    pronouns: 'she/her',
    email: 'priya.s@avalonsalon.com',
    phone: '(415) 555-0117',
    bio: 'Nail tech. Gel manicures, Gel-X, hand-painted nail art.',
    instagram: '@priya.nails',
    startedAt: 'Apr 2024',
    payoutMethod: 'Direct deposit',
    commissionRate: '50%',
    avgRating: 4.8,
    reviewCount: 86,
    rebookRate: 74,
  },
};

// Time off requests (employee-side workflow)
export const TIME_OFF_REQUESTS = [
  { id:'to_1', from:'2026-06-14', to:'2026-06-18', type:'vacation', reason:'Family trip — Big Sur', status:'approved', submitted:'Apr 02' },
  { id:'to_2', from:'2026-05-23', to:'2026-05-23', type:'personal', reason:'Doctor appointment',     status:'approved', submitted:'May 04' },
  { id:'to_3', from:'2026-07-03', to:'2026-07-07', type:'vacation', reason:'Long weekend',           status:'pending',  submitted:'May 11' },
];

// Announcements / reminders from the owner that this employee should see.
export const ANNOUNCEMENTS = [
  { id:'an_1', from:'Olivia Park', role:'Owner', when:'2 hours ago', body:'New retail shelf is in — please refresh product knowledge before Friday. Updated SKU sheet in the back room.', kind:'info' },
  { id:'an_2', from:'Olivia Park', role:'Owner', when:'Yesterday',  body:"Summer hours start June 1 — we'll be open until 8pm Thurs/Fri. Confirm your availability by May 20.", kind:'action' },
  { id:'an_3', from:'Front desk', role:'Reception', when:'2 days ago', body:"Hana Watanabe's bridal trial moved to June 14 at 11am — already on your calendar.", kind:'info' },
];

// Per-employee notification preferences (their own; not the business-wide template)
export const EMP_NOTIFICATION_PREFS = [
  { id:'np_new_appt',  label:'New appointment booked',     desc:'When a client books with you',           sms:true,  email:true,  push:true  },
  { id:'np_cancel',    label:'Cancellation or reschedule', desc:"When a client changes their booking",    sms:true,  email:true,  push:true  },
  { id:'np_review',    label:'New client review',          desc:'When a client leaves you a review',       sms:false, email:true,  push:true  },
  { id:'np_morning',   label:'Daily morning summary',      desc:"Schedule recap sent at 7:30am",          sms:false, email:true,  push:false },
  { id:'np_msg',       label:'Direct message from owner',  desc:"When Olivia or front desk messages you",  sms:true,  email:false, push:true  },
  { id:'np_payout',    label:'Payout deposited',           desc:"When your weekly payout lands",           sms:false, email:true,  push:false },
];

// Helper — return the current employee from the staff list given an id
export function getEmployee(staffId) {
  return STAFF.find(s => s.id === staffId);
}

// Helper — services offered by this employee
export function servicesFor(staffId) {
  return SERVICES.filter(s => s.staff.includes(staffId));
}

// Helper — appointments for this employee, optionally filtered by day
export function appointmentsFor(staffId, dayKey) {
  let rows = APPOINTMENTS.filter(a => a.staffId === staffId);
  if (dayKey) rows = rows.filter(a => a.day === dayKey);
  return rows;
}

// Helper — earnings calculation for a list of appointments (commission applied)
export function calcEarnings(appts, commissionPct) {
  const c = commissionPct / 100;
  return appts
    .filter(a => a.status !== 'canceled')
    .reduce((sum, a) => sum + a.price * c, 0);
}

Object.assign(window, {
  EMPLOYEE_PROFILES, TIME_OFF_REQUESTS,
  ANNOUNCEMENTS, EMP_NOTIFICATION_PREFS,
  getEmployee, servicesFor, appointmentsFor, calcEarnings,
});
