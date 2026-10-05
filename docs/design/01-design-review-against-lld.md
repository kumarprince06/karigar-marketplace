# Design Review — UI Designs vs LLD-001…022

| Field | Value |
|---|---|
| Reviewed | "Local Skilled Worker Network — Product Design System" PNG export (93 frames) |
| Against | LLD-001…022, ADR 0001–0018, ERD (architecture/03), product/04, security/03 |
| Date | 2026-10-05 |
| Status | Open — designer fixes + product decisions pending |

**How to read this:** §1 blockers (fix first), §2 decisions the product owner must make, §3 per-screen fixes for the designer, §4 screens that must be added, §5 doc changes the design exposed. Each fix cites the doc that decides it. "Fine" screens are listed at the end of each area.

---

## 1. Blockers (fix these first)

| # | Blocker | Where | Decided in |
|---|---|---|---|
| B1 | **Login is phone + OTP everywhere.** MVP is **email + password**, email verification link, phone collected but not verified, no SMS. | Welcome, Phone login, OTP, Worker login, Session expired, components (6-digit OTP), Communications | ADR 0016, LLD-001, LLD-013 |
| B2 | **No ₹99 advance payment before matching.** "Find workers" starts matching directly. Request waits in `PENDING_PAYMENT` until the advance is paid online; refund rules must be shown. | Request · review, Matching, No workers found | LLD-006 D6/D7, LLD-011 |
| B3 | **Worker "Accept job" reads as booked.** Accepting = "I'm interested" with a chosen rate + arrival time; the **customer picks** from up to 3 interested workers. Address/phone released only after selection. | Opportunity feed/detail, Matching · workers found, Booking confirmed | ADR 0017, LLD-008 D1/D2/D6 |
| B4 | **Worker types the final amount.** Amount = agreed rate per visit (backend-computed); extra work = quote the customer approves; materials = receipt-backed material bills. | Final amount, Active job, Booking detail (2) | LLD-009 §4, LLD-017 D1/D7/D8, LLD-010 D3 |
| B5 | **Chat and masked calling are designed in** (customer↔worker chat, support chat, "your number stays private"). Not MVP: real phone shared after selection; support by phone. | Chat with worker/customer, Support chat, Job tracking, Welcome, Worker profile | product/04 §39, LLD-008 D6, LLD-021 §1 |
| B6 | **Saved cards / in-app card form.** Checkout is the provider SDK; we store no cards or UPI IDs. A card form in our app puts us in PCI scope. | Payment methods, Add card, Confirm & pay, Account, Delete account | LLD-011 §8 |
| B7 | **Visit execution steps missing:** start code (customer shows, worker enters, 5 tries), On my way + ETA, GPS check-in (300 m / "check in anyway"), check-out (day type, helpers, summary, photos), customer confirms visit / completion (24 h), cash received + customer confirm, cannot-complete, add days / reschedule proposals. | Job tracking, Active job, Booking detail, Confirm & pay | LLD-009 D1–D9, LLD-010 |
| B8 | **One merged booking lifecycle.** Request, booking, job and visit are separate state machines; chips/labels must map to real enums. | IA slide, Bookings, Bookings table, components | ADR 0009, LLD-006/009 |
| B9 | **Bengali / Hindi deferred.** en/bn/hi are required at launch; fonts, line-heights (≥1.5 for Indic) and a language picker are missing everywhere. | Typography, all screens | LLD-003 D1/D2 |
| B10 | **Admin console has no MFA screens and no ops-queues page**; several admin pages (settings, roles, templates, analytics, system health) have no backend. | Admin (all) | LLD-020 D2/§3.3 |

---

## 2. Product decisions needed

Each row: what the design assumes → what the docs say today → recommendation.

| # | Decision | Docs today | Recommendation |
|---|---|---|---|
| P1 | In-app chat (customer↔worker, support) | Out of MVP | Keep out; Call button after selection + quote approvals; support phone/WhatsApp link |
| P2 | Masked calling | Later phase | Keep later; fix the "number stays private" copy |
| P3 | Saved payment methods | None (provider checkout) | Keep none; provider may remember the payer's VPA in its own UI |
| P4 | Human-readable references (`BKG-…`, `pay_…`) | ADR 0018: UUIDv7 only | **Add a short display code** for bookings (phone support needs it) — small ADR + column; show last 8 chars elsewhere |
| P5 | Analytics / KPI dashboard + System health inside admin | LLD-020 excludes; modules/12 implies MVP | Grafana/Metabase link-out for MVP; console = ops queues only |
| P6 | Admin lists vs search-first lookup for customers/workers | Search-first (exact phone/email, name prefix ≥3, 20 rows) | Keep search-first (limits PII exposure) |
| P7 | Runtime platform settings, maintenance mode, editable roles/templates | Config + migrations, templates in code | Read-only views in MVP |
| P8 | Favourites / "Booked before" / direct booking | Conflict: README "Later" vs LLD-007 favourite round | Keep "Book again" (worker offered first), no direct booking |
| P9 | Review aspect tags + review photos + "My reviews" list | Out of MVP / no endpoint | Drop tags/photos; add `GET /customers/me/reviews` (small) |
| P10 | Worker service area as several localities | One base point + radius | Keep base + radius |
| P11 | Experience as ranges | Integer years per trade | Keep integer per trade |
| P12 | Skill-level matching | Matching by trade only | Keep trade; skills are profile info |
| P13 | "Address proof" verification | Not a check type | Drop |
| P14 | Electrician licence | Mandatory (design shows optional) | Product call — mandatory may thin pilot supply (also LLD-016 open question) |
| P15 | Aadhaar-only workers | Can't finish ID proof until DigiLocker/e-KYC | Product call (LLD-016 open question) |
| P16 | Offline worker actions | Idempotent retries only; server time | Queue photos + idempotent actions; block check-in / start code offline |
| P17 | Receipt PDF / share, email receipts, SMS receipt | Not defined | Defer; in-app receipt screen only |
| P18 | Edit a submitted request | Cancel + "Book again" / "Search again" | Keep |
| P19 | Request a call-back / help-article CMS | Not defined | Dial support button; static bundled FAQ (en/bn/hi) |
| P20 | Marketing consent toggles | MARKETING not in MVP | Hide in MVP |
| P21 | Worker portfolio photos | Future | Defer |
| P22 | Name change → re-verification | Not specified | Decide which name is matched (LLD-016 NAME_MISMATCH) |
| P23 | Refund dual control / approval | Open question (LLD-020) | Not for MVP; refunds > ₹5,000 already need `finance.refund` |
| P24 | Dispute "reassign" / "free revisit" action; ops intervention on requests (notify more, widen radius) | Not defined | Claim-only; no free revisit action; requests read-only in MVP |
| P25 | Money display | Not defined | `₹4,250` (lakh grouping, paise only when non-zero), Latin digits in all locales |
| P26 | Phase labels | Design "MVP / Phase 2 / Future" vs product/04 phases & build slices | Use "MVP / Later / Future" mapped to build slices |

---

## 3. Per-screen fixes

### 3.1 Design system & IA

| Item | Problem | Fix | Ref |
|---|---|---|---|
| IA · lifecycle slide | One lifecycle Requested→…→Awaiting payment→Completed→Disputed | Four layered lifecycles (request, booking, job, visit) + label↔enum table; dispute is a hold, opened during the 24 h confirm window | ADR 0009, LLD-006/009/018 |
| IA · "fees/windows not defined" | Placeholder copy | Show real rules: free cancel until 2 h, fee = min(advance, ₹100) / visit charge after EN_ROUTE, request expiry per urgency | LLD-009 D5–D8, LLD-006 D10 |
| IA · weekly availability "Phase 2" | It is MVP | Move to MVP; add time off + open-job cap | LLD-015 |
| IA · Account "payments" | Implies saved methods | "Payment history" | LLD-011 |
| IA · Map view, Advanced filters, Trust risk, Analytics | Imply browsing/scores | Later; map = address pin only | ADR 0017, LLD-009 D1 |
| IA · missing MVP capabilities | Emergency, advance, waitlist, shortlist choice, start code, visit/completion confirm, quotes, material ack, cash confirm, no-show report, proposals, inbox, language, privacy; worker accept/decline/withdraw, en-route/check-in/start code/check-out, quotes, cash, dues, payout account, review reply, dispute response, verification, online toggle; admin ops queues, zones, reason codes, MFA | Add a second-level screen inventory per tab mapped to LLD IDs | LLD-005…022 |
| Typography | Anek Latin only; line-heights 1.23–1.47; 12–13 px text | Anek Bangla + Devanagari at launch; Indic line-height ≥1.5; worker body ≥16, secondary ≥14; min-height not fixed height; support 200% font scale; design at 360 dp with +40% text | LLD-003 |
| Chips/tap targets | Chips ~32 px | 48 dp hit area | — |
| Money format | `₹ 4,250.00` | `₹4,250` (P25) | ADR 0006 |
| `color.border.strong` #B9B6AC | 2.03:1 — fails non-text 3:1 | Darken to ≈ #8A877D | WCAG 1.4.11 |
| Contrast labels | Measured on white; canvas is #F6F5F1; marigold label says 8.2 (is 7.16) | Re-measure on real backgrounds; avoid tertiary text on secondary bg | — |
| Status chips | Booking: Requested/In progress (not states); Payment: Paid/Refund initiated; Verification: Approved/Needs resubmission | One chip set per enum (request, booking, job, visit, payment, refund, verification, dispute, quote, material bill, earning, payout, review, offer), each label → one enum, icon + text, add neutral/terminal token | LLD-006…019 |
| Code input | 6-digit SMS OTP | 4-digit **start code** input with attempts-left + locked; customer "show / regenerate" card | LLD-009 D3 |
| Phone input as login | — | Profile field; add email, password (show/hide), "email sent / resend" | ADR 0016 |
| Missing components | — | Bill breakdown, price-guide range, urgency + window picker (incl. emergency surcharge), API-driven reason picker sheet, countdown timer, 3-step stepper, photo/voice/video upload with progress, rating input + reply, accepting-jobs toggle, language switcher, masked-PII display, full-page error/retry, shortlist offer card (rate + arrival + badges + "why shown"), admin table/filters | LLD-003/006/008/009/011/014 |
| Offline banner / Undo toast | "Updates saved and will sync"; Undo on server actions | "Will retry when online"; block online-only actions; Undo only for local edits | LLD-009 §7, LLD-022 |
| Principles | Missing "show why" and explicit privacy rule | Add "Explain why (worker, price, status)"; "contact only after selection and 7 days after completion; identity data masked" | ADR 0011, LLD-008 D6, security/03 |

### 3.2 Customer — auth, account, support

| Screen | Problem | Fix | Ref |
|---|---|---|---|
| All | English only, no language picker; no email-verified state; no logout-all / change password | First-launch language choice + in Account; "Verify your email · Resend" banner; logout-all and change password rows | LLD-003, LLD-001 D1, LLD-002 |
| Splash | "Howrah · Kolkata" (Kolkata coming soon) | "Howrah" | LLD-005 seed |
| Welcome | "Continue with phone number"; "calls and chat go through the app" | "Create account" / "Log in"; "Your address and number go only to the worker you choose" | B1, B5 |
| Phone login → replace | Phone + OTP; implied consent | Sign up (name, email, mobile, password 8–128, separate Terms / Privacy / 18+ ticks, unticked optional consents) · Log in (email + password, Forgot password) · Check your email · Reset password; error states EMAIL/PHONE_ALREADY_IN_USE, INVALID_CREDENTIALS, TOO_MANY_REQUESTS, NOTICE_VERSION_OUTDATED | ADR 0016, LLD-001, security/03 §96 |
| OTP | Not MVP | Mark "Later" | ADR 0016 |
| Location permission | "Shared only after booking" — candidates see locality + distance | Reword; manual entry must end in a map pin | LLD-005 D1, §8 |
| Session expired | "Log in with OTP"; one message for all causes | "Log in"; separate copy for idle/expired, revoked elsewhere, suspended screen | LLD-002 §4.3 |
| Account | "Payment methods · Visa ••42" | Remove; add Language, Email (+verified), Notification settings | B6 |
| Edit profile | Phone "Verified" + "needs OTP"; email "optional"; "for receipts" | Phone unverified, change = immediate (409 if taken); email mandatory, read-only with verified state; remove receipts; remove designer note | ADR 0016, api/01 |
| Delete account | "Closes the open issue"; "removes payment methods"; "Type DELETE" | Show blockers (active booking, unpaid dues, open dispute, legal hold) and disable; 30-day timeline; request status; what is kept; password re-entry, localized | security/03 §40, §97 |
| Privacy & security | "Promotional · SMS"; Location app toggle; "Download my data by email" | Hide marketing (P20); "Open phone settings"; in-app data summary; add consents view, logout-all, change password, Grievance Officer | security/03 §96–98 |
| Terms & policies | — | Add Grievance Officer + Data Protection Board; open in user's locale | security/03 §98 |
| Saved addresses | No site contact, floor/lift, zone state | Show site contact for non-Self, floor/lift, "Not served yet · Notify me", 20 limit; no automatic new default | LLD-005 D3–D6 |
| Add address | One "street and area" field; fixed Home/Work/Other | Separate house/building/street/locality/PIN/landmark (+prefilled city/state); custom label; **address for** (Self/Family/Relative/Tenant/Business/Other) → contact name + mobile + consent tick; property type; floor + lift; make default; service-area result after pin | LLD-005 §3, D4 |
| Notifications | "Receipt sent"; `BKG-…`; "grouped per job" | Remove receipts and grouping; booking code per P4 | LLD-013, P4 |
| Notification settings | Toggles for booking/payments/issues/offers | Only **Reminders** switchable; others shown locked; mention quiet hours 21:00–07:00; no offers | LLD-013 D9 |
| Help & support (both) | "Chat with us", "Request a call", article search | Support phone/WhatsApp (P1/P19), "Report a problem with this booking" → dispute, grievance entry | LLD-018, security/03 §97 |
| Help article | Badge names wrong; "Was this helpful" | Use real badges (ID_VERIFIED, POLICE_VERIFIED, SKILL_CERTIFIED, LICENSED_ELECTRICIAN) | LLD-016 |
| Support chat | Not MVP | Remove (P1) | B5 |
| Report an issue | Categories don't match codes; no subject/window | Codes WORK_NOT_DONE, POOR_QUALITY, OVERCHARGED, CASH_NOT_PAID, NO_SHOW_DISAGREEMENT, DAMAGE, BEHAVIOUR, OTHER (note required); subject = job / visit / payment; window (24 h for a done visit/job, else 7 days) with closed state; 2,000 chars, ≤10 media, video ≤60 s; "other party has 48 h; payment/completion on hold" | LLD-018 D1–D9 |

Fine: Worker splash, Terms (minor), inbox structure, device list.

### 3.3 Customer — request → booking → payment → review

| Screen | Problem | Fix | Ref |
|---|---|---|---|
| Home | No emergency entry, drafts, language; 1 h booking window; free locality chip | "Emergency · 24×7" entry; "Continue your draft"; saved-address picker; real booked window | LLD-006 D1/D3/D5 |
| Tablet home | "Booked before" → direct booking; rating without count | "Book again" (worker offered first, P8); rating only when ≥3 | LLD-012 D11 |
| Request · describe problem | "Step 2 of 5"; 500 chars; ASAP/Pick time; no video/voice | 3 steps; 1,000 chars; "Something else" = description or voice required; max 5 problems; price guide per problem; video ≤30 s, voice ≤60 s, 5 photos with upload progress; Save draft; urgency moves to step 2 | LLD-006 §3, D4, LLD-014 |
| Request · address & time | 1 h slots, 3 days, "Today" vs ASAP | NOW / TODAY / SCHEDULED / EMERGENCY; windows ≥2 h within 07:00–21:00; SCHEDULED up to +30 days; emergency any hour + surcharge; site contact shown; "not in service area"; duplicate-request and 3-open-requests errors | LLD-006 D3–D5, D8 |
| Request · review | Matching without payment | "Pay ₹99 advance & find workers" with price guide, surcharge, refund note, 15-min pay window; site contact, urgency, media counts | B2 |
| (missing) Advance payment states | — | Pending with 15-min countdown, retry (`pay-advance`), window closed, late payment refunded | LLD-011 D5/D6 |
| Matching in progress | "Under a minute" | Realistic waits (rounds 10 min–4 h; off-hours held to 07:00); show advance paid; cancel shows refund | LLD-007, LLD-006 D7 |
| Matching · workers found | Reads as "available"; no price; unverified worker; arrival outside window; skill chips | "3 workers want this job — choose one"; each card: rate type + amount, "can come at 4:30", badges, languages, jobs done, rating (≥3); arrival within window; sort earliest/price/rating; confirm sheet (agreed rate, advance deducted, cancellation rule); request expiry countdown | ADR 0017, LLD-008 D1/D2 |
| No workers found | "Nothing charged" | "₹99 advance will be refunded"; actions "Search again" / "Create new request" | LLD-006 D7 |
| Worker profile | Chat before booking, "Book Rakesh", service localities, relative dates | Remove chat; "Select" only inside shortlist; no service area; month dates; rates per trade, trades, languages, all badges; "New" when <3 ratings | LLD-004 §4 |
| All worker reviews | Photo filter, lowest-first | Single newest-first list; worker reply; Report; counted-reviews label | LLD-012 D7/D9/D11 |
| Confirm & pay | Saved Visa; pay replaces "work done" confirm; no advance line; no cash | Explicit "Confirm work done" / "Report a problem" (24 h) then pay; bill lines VISIT_LABOUR, QUOTE, MATERIAL, EMERGENCY_SURCHARGE, **ADVANCE_PAID −₹99**, ALREADY_PAID → total/paid/due; Pay online (UPI/card/net banking) or Cash | LLD-009 §5.4, D9, LLD-010 |
| Payment pending / failed | `pay_01J9…` ref | Per P4 | ADR 0018 |
| Payment methods, Add card | Not supported | Remove | B6 |
| Booking confirmed | "He accepted and will see your address now"; window 4–5 | "You chose Rakesh"; first-visit window; worker phone + Call; **start code card**; agreed rate; advance deducted note; cancellation rule; "Ask to reschedule" (worker approves) | LLD-008 D6, LLD-009 D3/D5 |
| Bookings | Free-text titles; "Issue reported"; status vocabulary | Problem/trade labels; dispute status; tabs from job/visit status; badges "Confirm work", "Payment due", "Quote waiting", "Rate worker"; cancelled shows advance refund | LLD-009, LLD-018 |
| Cancel booking | "Charges, if any" | Fee preview (`?preview=true`) and refund of advance before the button; reason codes | LLD-009 D5 |
| Booking cancelled | "Charges: none" | "₹99 refunded to your UPI in 5–7 days" | LLD-011 |
| Job tracking | "Calls connect through Karigar"; chat icon; no ETA/start code; last step "confirm and pay" | Worker phone; On the way + ETA; start code until work starts (+regenerate); quote approve/reject and material bill acknowledge panels; "Confirm work done (24 h)" then "Pay"; per-visit confirm for multi-day | LLD-009, LLD-017 D3/D8/D11 |
| Receipt | Missing advance line; PDF/share | §5.4 lines incl. advance; PDF per P17 | LLD-009 |
| Rate worker | After payment; aspect tags; "receipt by SMS" | Only after job COMPLETED; drop tags; double-blind note ("shown after he reviews you or in 7 days"); moderation state; 1,000 chars | LLD-012 D3–D6, D13 |
| Chat with worker | Not MVP; price agreed in chat | Remove; extra price = quote | B5, LLD-017 |
| My reviews | No endpoint; "editable for limited time" | P9; editable **until published**; status, reply, moderation | LLD-012 D8 |

Fine: Home · loading skeleton; no live map anywhere (correct); address masked on shortlist (correct).

### 3.4 Worker app

| Screen | Problem | Fix | Ref |
|---|---|---|---|
| All | English, text-heavy, few icons, one offline state | bn/hi first; trade + status icons; no paise; offline/retry states on inbox, accept, earnings | LLD-003 |
| Worker login | Phone + SMS code; "Step 1 of 4"; areas/payout copy | Email + password (+18+, Terms, Privacy, WORKER_KYC consent); readiness has 7 steps; "Customers who book you will see this number"; one base + radius; payouts daily ≥₹100, cash paid by hand | ADR 0016, LLD-004, LLD-019 |
| Worker home | Online toggle while 80% complete; no ETA; % instead of checklist; no dues/restriction | Toggle locked until ACTIVE; ETA picker (15/30/45/60) and "available from" when >3 h early; readiness checklist; red dues banner ("You owe ₹X — pay by UPI"); missed-offer reminder | LLD-007 D2, LLD-009 §5.2, LLD-010 D7 |
| Opportunity feed | "Full address after accepting"; countdown looks like clock | "After the customer picks you"; "Ends in 8 min"; "Waiting for customer" tab (accepted, withdraw, 3-limit); EMERGENCY badge; price guide; thumbnails not "1 photos" | LLD-008 D3/D6 |
| Opportunity detail | "Accept job" | "I'm interested" sheet: pick one of **your** rates (no typing), arrival time inside window, optional note; show property type, floor/lift, price guide, surcharge, voice note, customer first name + rating | LLD-008 §4.1 |
| Decline reason | Missing PRICE_TOO_LOW, UNSAFE_AREA; "Other" free text | Add both codes; codes only; icons | LLD-008 §3 |
| Jobs | No waiting-for-customer tab; missing states | Add WORK_COMPLETED (awaiting customer), FAILED, ON_HOLD, "Day 2 of 3", "Cash to collect"; consistent data across screens | LLD-009 §6 |
| Active job · offline | "Enter final amount"; "Message customer"; skipped steps; "updates saved" | "Customer confirms, then collect ₹X"; Call customer; steps: check-in (GPS ≤300 m or reason) → start code → working → check-out sheet (day type, helpers, summary, photos) → complete; actions: cannot complete, add days / reschedule, customer not home (30 min), cancel (strike warning), extra-work quote, material receipt, cash received; offline per P16; "Accepted" → "Booked" | LLD-009 D2–D9, LLD-010, LLD-017 |
| Chat with customer | Not MVP | Remove; Call + status actions | B5 |
| Work photos | Caption stored; customer-sounding copy | Kind (before/after/progress) + visit summary; confirm which app | LLD-009 §3 |
| Earnings | No dues/negative balance; wrong "pending" meaning; "Paid" per row; weekly total; paise | Dues card + "Pay dues by UPI"; "Waiting for customer to confirm"; statuses PENDING/ELIGIBLE/ON_HOLD/PAID_OUT/REVERSED; cash rows "You collected ₹1,000 · fee ₹118"; payout rules (11:00 daily, ≥₹100, 24 h after account change); no paise | LLD-010 D7/D9, LLD-019 D5–D10 |
| Bank details | Branch lookup; "match your ID" | Drop branch (or IFSC lookup decision); "match your passbook and profile name"; states verifying / under review / failed; numeric keypad; passbook hint | LLD-019 D3–D5 |
| Availability | One range/day, no presets, time off, cap, emergency | Presets first ("Mon–Sat 9–6"), up to 2 ranges/day, time off ("rest of today"/dates), max open jobs, emergency opt-in (needs police verification) | LLD-015 D1–D7, LLD-004 |
| Onboarding · service area | Locality chips | Home base via "Use my location"/pin + radius 1–20 km (default 5) | LLD-007 D1 |
| Onboarding · skills | One trade; experience range; no rates; "only matching requests" | Up to 3 trades, one primary; years per trade; "Your charges" step (rate type + amount within bounds); languages; name/bio/photo; reword matching claim | LLD-004 D1–D6 |
| Verification · passport | Licence optional; "Address proof"; incomplete ID proof; "passport" name | Licence required for electricians (P14); drop address proof (P13); doc picker (Voter ID / DL / Passport), "Aadhaar not accepted", selfie with document, back side, doc number; police verification card; rename "Your documents" | LLD-016 D2/D3, §3 |
| Verification approved | "Go online now" | Show remaining checklist; button only when ACTIVE | LLD-004 D5/D8 |
| Verification rejected | Generic photo tip | Text per reason code; resubmits 3 per 30 days | LLD-016 §3, D5 |

Fine: No opportunities (optionally say why: offline, restricted, outside hours, onboarding).

### 3.5 Admin console

Cross-cutting: prefixed ids (`req_`, `BKG-`, `cus_` …) → short UUID tail with copy, or P4; add MFA enroll / code prompt / re-prompt / lockout; masks per LLD-020 D7 (`+91******1234`, `s***@gmail.com`).

| Screen | Problem | Fix | Ref |
|---|---|---|---|
| Operations dashboard | SMS failures; "Address proof"; provider latency; KPIs; zone scope | Remove SMS; real check types; link Grafana; KPIs per P5; **main block = 7 ops queues** (flagged check-ins, disputed cash, stuck refunds, parked provider events, verification pending, open disputes, outbox dead) filtered by permission; zone = filter | LLD-020 §3.3, D4 |
| Requests & matching | "Unmatched"; no AWAITING_SELECTION; intervention actions; no list API | Real request statuses + "no interested worker" flag; urgency, advance state, run status; read-only (P24); add admin list endpoint | LLD-006/007 |
| Bookings table | "Awaiting worker"; mixed statuses; bulk/export | Booking / job / visit as separate chips, lateness derived; admin cancel dialog (reason, note, fee/refund effect, `booking.manage`); no bulk/export | LLD-009 §5.3 |
| Customers table | Mask format; "needs Support role"; open issues; paged list | D7 masks; "needs reveal permission + reason"; only open dispute + restrictions; search-first (P6); no export | LLD-020 D7 |
| Customer detail | Email mask; dispute as booking status; notes; reveal button | Reveal modal (fields, PII_REVEAL reason, note, 20/h, re-mask); suspend/reinstate dialog with reason (bookings listed, not auto-cancelled); restrictions add/lift; DEACTIVATED; drop notes; confirm device source | LLD-020 §4, §11 |
| Workers table | Verification values; "Invite worker"; areas; online | UNVERIFIED/PARTIAL/VERIFIED + pending chip; no invite; base locality + radius; ACCEPTING_JOBS; DEACTIVATED; suspend dialog with blockLogin + bookings-to-cancel | LLD-004, LLD-020 |
| Worker verification review | "Request info"; free-text note; approve document | Remove request-info; reason dropdown (note only for OTHER); approve the check with confirmed fields (name, year of birth, masked number, issue/expiry, version); claim/assign; selfie vs document; doc kind; one-click AADHAAR_NOT_ACCEPTED; duplicate warning; SLA; two-admin revoke; 60 s signed URLs, audited | LLD-016 §4, §6, D9 |
| Dispute investigation | Resolution radios; contradictory states; reassign; free-text title | Outcome + at-fault + summary + action list (REFUND amount, ADJUST_VISIT, CASH_PAID, CASH_NOT_PAID, WORKER_STRIKE, REVOKE_STRIKE); claim moves to IN_REVIEW; resolve allowed from AWAITING_RESPONSE; reject; internal notes separate; messages to parties; refund only for online payments and >₹5,000 needs finance; action status with retry; system evidence | LLD-018 D6–D11 |
| Payments & refunds | Wrong statuses; "awaiting approval"; retry; Stripe-like ids | Real payment/refund/payout statuses; refund action (reason, note, idempotency, pro-rata preview); stuck refunds, parked events, disputed cash, reconciliation; payout hold + account review; ledger balance/dues + adjustments | LLD-010/011/019 |
| Catalog | "Services" layer; Draft | Category → trade → skills + common problems; active flag only; immutable code; en/bn/hi translations + missing view; price guide / needs inspection; trade settings (rate type, emergency, surcharge, advance); search misses; service zones screens | LLD-003, LLD-005 |
| Communications | SMS, OTP, editable templates, campaigns | Read-only delivery log with retry on FAILED (`notification.retry`); optional template preview; no campaigns | LLD-013 D2/D4 |
| Analytics | No defined metrics | P5 | — |
| Audit log | "Denied" results; IP/browser | Remove result column; metadata = actor, reason, note, request id, from/to; action constants; entity/actor filter or ≤31 days; no export | LLD-020 D9 |
| Admin users | "2-step login: Off"; "Invited"; single role | "Not enrolled · blocked" + MFA reset; statuses ACTIVE/SUSPENDED/LEFT ("password not set" sub-state); multiple role grants; grant/revoke; last-super-admin and self-action guards; step-up for staff.manage; no bulk | LLD-020 D2/D3 |
| Roles & permissions | "+ New role"; missing DISPUTE_AGENT; wrong cells | Read-only matrix of the 21 permission codes × 6 roles per LLD-020 §3.2 | LLD-020 §3.2, §4.1 |
| Platform settings | No backend | Read-only (P7); zones → LLD-005, trades → LLD-003; MFA always on | — |
| System health | Grafana data; generic failed jobs | Grafana link; keep outbox panel (DEAD list, retry, ack) + link to ops queues | LLD-022, P5 |

Booking detail (2) and Edit service (exported among worker frames) are admin screens: Booking detail — agreed rate + bill breakdown instead of "set by worker", "8 offered · 3 interested", check-in distance/flag, start-code attempts, ETA, advance; no Messages tab. Edit service — redesign as edit trade / skill / problem with en/bn/hi names and keywords.

---

## 4. Screens to add

**Customer:** Sign up · Log in · Check your email · Forgot / reset password · Language picker · Advance payment pending / failed / window closed · Shortlist confirm sheet · Start code card · Visit confirm · Completion confirm or report · Quote approve / reject · Material bill acknowledge · Cash payment confirm · Reschedule / add-days proposal response · Worker no-show report · Draft list · Waitlist ("notify me") · Data summary · Consents · Grievance.
**Worker:** Sign up / login (email) · Readiness checklist · Rates per trade · Working hours presets + time off · Accept sheet · Waiting-for-customer list · On my way + ETA · Check-in (incl. "check in anyway") · Start code entry · Check-out sheet · Cannot complete · Add days / reschedule proposal · Customer not home · Extra-work quote · Material bill receipt · Cash received · Dues + pay by UPI · Payout account states · Review reply · Dispute response · Police verification · Emergency opt-in · Suspended / restricted states.
**Admin:** MFA enroll / prompt / lockout · Ops queues page · Booking / job detail with visits + quotes · Dispute queue · Verification queue · Review moderation · Service zones · Payout account review · Restrictions · Reason codes (read-only) · Outbox dead list.

---

## 5. Doc changes the design exposed

| # | Change | Where |
|---|---|---|
| D1 | Change password (`PUT /me/password`) and change-email flow | LLD-001 / LLD-002 |
| D2 | `createdAt` in `/me/sessions` (for "new login" banner) | LLD-002 |
| D3 | Admin list endpoint for service requests (`GET /admin/service-requests`, `booking.view`) | LLD-006 |
| D4 | `GET /customers/me/reviews` (if P9 = yes) | LLD-012 |
| D5 | Short booking display code (if P4 = yes) | ADR + LLD-009 |
| D6 | "This week" earnings in summary (or client-side) | LLD-010 |
| D7 | Pending worker payout as an account-erasure blocker | security/03 §40 |
| D8 | Fix doc conflicts: SMS in product/04 §69 vs LLD-013; worker payouts "future" in product/04 §61 vs LLD-019; favourites "Later" vs LLD-007/ERD | product/04, README |

---

## Change log

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-05 | TBD | First review of 93 frames against LLD-001…022 |
