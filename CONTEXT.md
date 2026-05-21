# Receptionly — Company & Product Context

> **Purpose.** Master context for the Receptionly Claude Cowork project. Load it (or paste it
> into the project's knowledge/instructions) so Claude understands the product, who it serves,
> how it's built, and where it's going — and can help across product, engineering, support,
> marketing, sales, and operations.
>
> **Fact vs. open:** §1, §3, §4, §5 are grounded in the codebase and confirmed founder direction.
> §2, §6, §7 are confirmed business strategy/pricing from the founder. Items marked **〈OPEN〉**
> are decisions still being worked out (see the open questions at the end of §7).
>
> _Last updated: 2026-05-21. Code repo: `github.com/AndyHersco/Receptionly_Alex`. Founder: Andy._

---

## 1. What Receptionly is

Receptionly is a **B2B SaaS company for appointment-based service businesses** — starting with
**barbershops and salons**, expanding to **med-spas**. **We sell two products, separately:**

1. **Receptionly Scheduling (the software)** — a back-office web app (calendar, staff, services,
   resources, customers, reporting/dashboards) plus a public **online booking portal** and
   **automated email reminders**. Look-and-feel comparable to Boulevard / Booksy.
2. **Receptionly Voice Agent (the AI receptionist)** — an AI that **answers the phone and handles
   booking, cancelling, rescheduling — basically every call**. Built on **Retell AI**. Integrates
   natively with Receptionly Scheduling. _(In development — ships after the website + backend.)_

They're sold separately and bundle well: the agent books into the same calendar the software
manages, via the same backend API. **The strategy is to win the account with cheap software and
make the majority of profit upselling the Voice Agent.**

**Pitch (beachhead):** for small shops with no real scheduling tool, we're not arguing we beat
competitors — **we're proving why they need this at all.**

---

## 2. Market, ICP & go-to-market

**Geography:** US. **Launching in New Jersey.**

**Beachhead ICP (start here):** small **barbershops/salons** that
- have **no scheduling software** (or a bad custom/manual setup) and **no online booking**,
- often have weak/old websites,
- are **found via Google Maps**.

For this segment the sale is **category creation** ("here's why you need this"), not competitive
displacement. We win on: **cheaper than competitors**, **seamless native AI-agent integration**, and
a **more personalized experience** (we'll add features on request).

**Onboarding/migration helpers (sales sweeteners, already planned):**
- Free **SMS blast** to share the new booking link with their existing clients.
- **White-glove**: we manually load their current client list.
- **Import appointments from Google & Apple Calendar.**

**Expansion (later):** more established barbers/salons **and med-spas**. Two motions:
1. **Convince them to switch** to Receptionly Scheduling (harder sell), or
2. **Sell the Voice Agent standalone** on top of *their existing* software (Boulevard, Booksy, etc.).
   This requires **integrating Retell custom functions with third-party systems** (via their APIs) —
   a capability we need to learn, through code and/or **Claude Cowork guidance**.

**Sequencing:** start small, learn, get comfortable, then move up to **big-ticket clients**;
**adjust pricing upward as we move upmarket.**

---

## 3. Product surfaces & functionality

A **multi-page web app** with five entry points; cross-links use plain page navigation.

### 3.1 Business / Owner app — `index.html`
| Area | What it does |
|---|---|
| **Dashboard** | Today's appointments, completed, upcoming, open slots, revenue today, expected weekly revenue, schedule, team status. |
| **Calendar** | Per-staff day columns; drag-to-move; working hours, **lunch breaks**, **closed/not-working**, **buffer time**, manual **blocks**; "+ Add"; date nav. |
| **Appointments** | Filterable, paginated list with status; create appointment; add a client inline; date-range filter. |
| **Staff** | Per-staff schedule, lunch, services, days off, buffer, active/inactive; **Employee Requests** inbox to approve/deny time-off, leave-early, schedule-change. |
| **Services** | Catalog by category: duration, price, buffer-after, required resource, eligible staff, online flag. |
| **Resources** | Chairs/rooms/stations with quantity + services — prevents double-booking a space. |
| **Customers** | Contact, visit history, no-shows, favorite staff, notes. |
| **Online Booking** | Preview/manage the public booking page (3.3). |
| **Reports** | Today / 7d / 30d / 90d / custom: KPIs, staff-performance, bookings chart — revenue, staff performance, growth. |
| **Settings** | Business profile, hours, locations (add/delete), logo, cancellation policy, password. |
| **Contact Us** | In-app support form. Posts to Formspree today. |

### 3.2 Employee / Staff app — `Employee.html`
Per-staff (set by `window.EMP_TWEAKS`): **Dashboard** (up-next, schedule, hours, optional earnings) ·
**My calendar** (Day/Week/Month; request time off / schedule change; block time) · **Appointments** ·
**Settings** · **Contact Us**. Plus a demo **Tweaks panel** to switch staff / toggle earnings.

### 3.3 Public booking flow (`booking.jsx`)
6 steps, no account: **Location → Services → Staff → Date & Time → Your info → Confirm → Booked.**
Honors duration, buffer, staff eligibility, hours, resource availability.

### 3.4 / 3.5 Onboarding — `onboarding.html` (9 steps) & `onboarding_new.html` (8 steps, add location)
Account → Location → Hours → Staff → Resources → Services → Staff assignment → Cancellation policy → Booking page.

### 3.6 Auth — `signin.html`
Sign in · Create business account · Create employee account. _Front-end stub today — no real credential check._

### 3.7 Receptionly Voice Agent (Retell AI)  _(in development — after website + backend)_
AI phone receptionist on **Retell AI** (telephony + speech-to-text + LLM + text-to-speech). Handles
**booking, cancelling, rescheduling, availability, FAQs — every call type**, for overflow and
after-hours.

**How it connects:** Retell agents invoke **custom functions** (tool calls/webhooks) that hit
**the same backend API as the web app** — so Voice is **gated on the backend existing**. Likely
functions: `check_availability`, `book_appointment`, `reschedule_appointment`, `cancel_appointment`,
`lookup_customer`, `list_services`, `get_business_hours`.

**Two integration targets:**
1. **Native** — against the Receptionly Scheduling API (the default for our own customers).
2. **Third-party** — against an existing system's API (Boulevard/Booksy/etc.) for the expansion
   segment that won't switch software. This is a **learning goal**: build Retell functions that talk
   to systems that aren't ours.

**Cowork's role (later):** once the website/backend is done, Claude (this project) helps **design and
write the custom functions** (JSON schemas + backend/3rd-party endpoints), the **agent prompt/script**,
and the **call-flow testing** — for both the native and third-party paths.

---

## 4. Data model

Seed/mock data in `src/data.jsx` + `src/employee-data.jsx`; maps ~1:1 to future DB tables:
**business** · **location** (many per business) · **staff** (hours, lunch, buffer, services, active) ·
**service_category** + **service** (duration, price, buffer-after, resource, eligible staff, online flag) ·
**resource** (capacity + qty) · **customer** (visits, no-shows, favorite, notes) ·
**appointment** (customer + staff + service + datetime + status) · **block** (non-bookable time, lunch overrides) ·
**time_off_request / schedule_change_request** · **announcement / employee_profile**.
The same data + API backs **both** the web app and the Voice Agent's custom functions.

---

## 5. Tech stack & architecture

- **Frontend:** Vite + React 18 + Tailwind 3, plain JS/JSX, multi-page, real ES modules.
- **Data today:** in-browser mock data in `localStorage` with cross-tab sync. **No backend/DB yet.**
- **Run:** `npm install`, `npm run dev` (→ `localhost:5173`); `npm run build` to ship.
- **The backend seam:** isolated in `src/data.jsx`, `src/employee-data.jsx`, `src/persistence.jsx`. A
  real backend plugs in by rewriting those three (DB + API) **without touching UI**. **This same API
  is what the Voice Agent's custom functions call** — so the backend unlocks both products.

---

## 6. Status & roadmap

**Now:** functional frontend prototype on mock data; converted to Vite, pushed to GitHub.

1. **Backend + database** — tables from §4, API, point `persistence.jsx` at it. _(Unblocks everything.)_
2. **Auth & roles** — replace the stub; owner vs. staff.
3. **Payments / billing** — subscription billing (Stripe/Square/PayPal connectors available here); per-missed-call billing for the Backup plan.
4. **Voice Agent (native)** — Retell custom functions against our API; agent prompt; phone number; test flows. **Cowork helps build the functions.**
5. **Voice Agent (third-party integrations)** — Retell functions against Boulevard/Booksy/etc. for the expansion segment.
6. **Notifications** — email reminders are in the base plan (Resend); add SMS reminders.

### v1 feature scope — must-haves for the first release
_(All ride on the backend, phase 1.)_

- **Calendar integrations** _(owner: Alex)_ — Google Calendar, Apple Calendar, Microsoft Outlook, etc.
  - **Import** the shop's existing calendar.
  - **Two-way sync** — changes on the external calendar update Receptionly, and changes in Receptionly update the external calendar, so **staff never have to open our app** if they don't want to.
- **Email reminders** _(owner: Andy — via **Resend**)_ — every email includes a **cancellation link**. Email types:
  1. Booking **confirmation**
  2. **24-hour** reminder
  3. **1-hour** reminder
  4. **Cancellation confirmation**
  5. **Reschedule confirmation**
  - _(Consistent with the Base plan, which already promises "automated email reminders.")_
- **Mobile** — every screen must look good on a phone (the UI is already responsive; treat it as a release gate).

### Backlog — planned after v1
- **Payments:** card-on-file for **cancellation fees**; store client cards with **notes / photos / history**; **pay or take a deposit at booking**.
- **Free SMS appointment reminders** (transactional text reminders).
- **Client reviews.**
- **Custom photos for services.**
- **Marketing & CRM:** **unlimited** email + push marketing messages _(benchmark: Booksy gives 2,000 SMS free — we aim to beat that)_; automated, customizable **text & email campaigns**.
- **Client management:** memberships / rewards program; **recurring appointments**; **block clients**; **waitlist**.
- **Inventory management.**
- **Booking tools:** **Instagram & Facebook** booking integration; **Reserve with Google** (get booked from Google Search & Maps — handled through Google).

---

## 7. Business model, pricing & unit economics

### Pricing plans (confirmed)
| # | Plan | Price | Includes |
|---|---|---|---|
| 1 | **Base Software** | **$50/mo** | Scheduling software, online booking portal, automated email reminders |
| 2 | **Backup Receptionist** | **$50/mo + $1.00 / missed call** | **AI-only voicemail backup** — activates **only when a call goes to voicemail**; pay only for calls you miss. **Scheduling software NOT included → +$50/mo to add it.** |
| 3 | **Starter AI** | **$100/mo** | Base software + **50** AI voice calls/mo |
| 4 | **Growth AI** | **$150/mo** | Base software + **100** AI voice calls/mo |
| 5 | **Professional AI** | **$650/mo** | Base software + **600** AI voice calls/mo |
| 6 | **Ultimate AI** | **$1,000/mo** | Base software + **unlimited** AI voice calls |

> The AI portion is a consistent **~$1.00/call** across Starter/Growth/Professional ($50/$100/$600 over
> 50/100/600 calls), which keeps the lineup coherent.

**Plan rules:** overage on Starter/Growth/Professional is **$1.50/call** past the included amount;
**Ultimate** is "unlimited" under a **~2,000 calls/mo fair-use cap** (then $1.50/call or custom).

**One-time setup / onboarding fees** (covers white-glove client import, SMS blast, calendar import):
| Plan | Setup fee |
|---|---|
| Base Software | $0 |
| Backup Receptionist | $0 |
| Starter AI | $0 |
| Growth AI | **$100** |
| Professional AI | **$300** |
| Ultimate AI | **$300** |
| Voice Agent (standalone) | **~$300** (third-party integration build) |

Rationale: keep the entry tiers (Base/Backup/Starter) friction-free for the beachhead; recover
onboarding effort from higher tiers and from the standalone third-party integration.

### Receptionly Voice Agent — standalone (expansion segment) _(proposed — validate)_
For shops that keep their existing software (Boulevard/Booksy/etc.) and buy only the AI agent, integrated
via Retell into *their* system. Priced **above** the bundled AI portion because there's no software margin
and real third-party-integration effort, and these are higher-willingness-to-pay, established shops:

- **From $199/mo** including **100 AI calls**
- **$2.00/call** overage (premium vs the bundled $1.50)
- **One-time integration setup ≈ $300** (build/QA the connection to their software)
- **Custom / enterprise pricing above ~600 calls/mo**

Margin check: ~$199 − ($2 phone + 100×$0.32) ≈ **$165 (≈83%)**; overage ~84% margin. _These are starting
numbers to test in market — expect to raise them as we move upmarket._

### Costs
- **Per AI client:** phone number **$2/mo** + calls at **$7.50–$9.60 per hour** of talk time.
- **Shared (all clients, not per-client):** Resend email **$20/mo** + hosting **~$10/mo** ≈ **$30/mo total**.

### Unit economics _(modeled at a **~2-min average call** — founder's estimate)_
Per-call cost ≈ **$0.25–$0.32** (at $7.50–$9.60/hr, 2 min; using ~$0.32 conservative). Monthly
contribution per account (price − variable cost; shared fixed amortizes to pennies at scale):

| Plan | Price | Variable cost | ≈ Gross margin | Margin % |
|---|---|---|---|---|
| Base | $50 | ~$0 | ~$50 | ~100% |
| Backup | $50 + $1/missed call | $2 + ~$0.32/call | $50 + **~$0.68/missed call** | high |
| Starter (50) | $100 | $2 + ~$16 | **~$82** | ~82% |
| Growth (100) | $150 | $2 + ~$32 | **~$116** | ~77% |
| Professional (600) | $650 | $2 + ~$192 | **~$456** | ~70% |
| Ultimate (∞) | $1,000 | $2 + usage | profitable to **~3,100–4,000 calls/mo** | healthy under fair-use cap |

**Decisions (locked) & takeaways:**
- **Profit reframe:** the *software* has the highest margin %, but AI plans drive far higher **revenue
  per account** ($100–$1,000 vs $50). The upsell wins on **ARPU + stickiness**, not margin %.
- **Overage (DECIDED): $1.50 per call** beyond the included amount on Starter/Growth/Professional. Agent
  keeps answering; revenue scales with usage. (Naturally nudges an upgrade ~83+ calls on Starter, etc.)
- **Ultimate fair-use cap (DECIDED): ~2,000 calls/mo** "reasonable use." Well above realistic shop volume,
  ~36% margin even at the cap; beyond it, $1.50/call overage or move to custom pricing. Keeps the
  "unlimited" marketing honest while bounding the tail risk.
- **Mid tier optional:** with $1.50 overage the Growth→Professional gap is smoothed, so a 250–300-call tier
  is nice-to-have, not required.

### Positioning & differentiation
- **vs. laggards (beachhead):** prove the *need*, not superiority.
- **vs. scheduling software (Boulevard, Booksy, Vagaro, Square Appointments, Fresha, Mindbody, GlossGenius):**
  cheaper, **flat per-location** (not per-staff), **native AI agent**, personalized feature requests.
- **vs. AI-phone point tools:** we're **scheduling + agent in one**, natively integrated.

### Metrics that matter
Activation (onboarded + first booking) · north-star (booked appts / active business / mo) ·
Voice (calls handled, booking-conversion, after-hours captured, minutes/cost, **AI attach rate**) ·
SaaS (trial→paid, MRR, churn, NRR, CAC payback).

### Support, legal, team
- **Support:** in-app Contact form → docs + onboarding emails; **white-glove Voice setup** (scripting, call-forwarding, test calls).
- **Legal 〈important for Voice〉:** **call-recording consent** (some US states need two-party consent — incl. check NJ rules); Terms/Privacy; PCI via processor.
- **Team:** Founder **Andy** (`AndyHersco`); developer **Alex** (backend; repo `Receptionly_Alex`). 〈OPEN: others?〉

### Resolved (this session)
- Avg call **~2 min**; overage **$1.50/call**; Ultimate **~2,000-call fair-use cap**.
- Standalone Voice **from $199/mo + $2/call + ~$300 integration setup**.
- **Setup fees:** $0 Base / Backup / Starter, **$100 Growth, $300 Professional & Ultimate**.
- **Backup = AI-only:** $50/mo + $1/missed call (charged for **every** voicemail-routed call the AI answers, booked or not); **+$50/mo to add the scheduling software**.

_No open pricing items right now — plan to revisit prices upward as we move upmarket._

---

## 8. How to use this Cowork project

Treat this doc as the source of truth. Example asks:
- _Eng:_ "Design the DB schema + API for §4." · "Write the `persistence.jsx` rewrite to call the API." · "Draft the Retell custom-function specs + endpoints (§3.7)."
- _Voice:_ "Write the Receptionly Voice Agent prompt." · "Design booking / reschedule / after-hours call flows." · "Plan a Retell↔Booksy integration for a non-Receptionly client."
- _GTM:_ "NJ barbershop outreach list criteria + cold-call/DM script." · "Landing page from §3 + §7." · "One-pager comparing us to Booksy."
- _Pricing/finance:_ "Model the 6 plans at 2/3/4-min avg calls and chart margin." · "Recommend overage + Ultimate cap."
- _Support/ops:_ "Onboarding email sequence." · "Contact-Us response templates."

**Connect tools** (available here) so Claude can act: **Stripe/Square/PayPal** (billing), **Gmail**
(sales/support), **Google Calendar** (demos + the calendar-import feature), **Google Drive** (docs),
**Zapier** (automation). The `setup-cowork` skill walks through connecting them.

> Keep this file current — it's the brain of the project. When the website + backend are done, come
> back and have Claude help build the Retell custom functions (§3.7), native first, then third-party.
