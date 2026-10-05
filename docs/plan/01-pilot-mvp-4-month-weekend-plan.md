# Pilot MVP — 4-Month Weekend Plan (2 h Saturday + 2 h Sunday)

| Field | Value |
|---|---|
| Time budget | 17 weekends × 4 h = **68 hours** (10 Oct 2026 → 31 Jan 2027) |
| Team | 1 developer + Claude Code writing most code, tests and migrations |
| Goal | A **pilot** in Howrah with 5–10 workers: customer requests → workers say "interested" → customer picks → job done → cash paid → review |
| Source of truth | LLD-001…022, screens in `docs/design/screens/` |

## 1. Reality check

The full MVP (22 LLDs, two native apps, admin console) is roughly 10–15× this budget. 68 hours is enough for **one complete, reliable core loop** if we:

1. **Go cash-only for the pilot.** No online payment, no advance, no payouts (LLD-011, 019 deferred). LLD-006 D6 already allows switching the advance off. Ledger + dues (LLD-010) stay, so the platform fee is tracked from day one.
2. **Build one web app (PWA)** for customer and worker, with role-based screens, plus a few admin pages in the same app. Native apps later.
3. **Use simplified versions** of LLDs (below). Every simplification keeps the LLD's data model, so later work extends instead of rewriting.
4. **Let Claude Code write**, while you review, run and decide. Each session starts with a one-line goal and ends with green tests + a commit.

If a weekend is missed, use the buffer (W16–W17) or cut from §5 "cut further".

## 2. Scope for the pilot

| Area | In the pilot | Deferred (LLD stays the target) |
|---|---|---|
| Accounts | Email + password, email verify (Brevo), refresh rotation (LLD-001/002) | Redis deny-list, device list UI, logout-all UI |
| Catalog | Seeded trades + problems, en/bn/hi labels (LLD-003) | Admin catalog editor, multilingual search |
| Customer | Address with map pin + PIN zone check (LLD-005) | Site contact for others' homes, waitlist |
| Worker | Profile, 1–3 trades, rates, base + radius, preset hours, online toggle (LLD-004/007/015) | Time off, capacity, emergency opt-in |
| Request | 3 steps, NOW/TODAY/SCHEDULED, up to 3 photos (LLD-006/014 minimal) | Advance, emergency, drafts, video/voice |
| Matching | One query, widening rounds by scheduled job (LLD-007) | Favourite round, explainable scores UI |
| Offers & pick | Interested/decline, shortlist, select → booking (LLD-008) | Withdraw, reminders |
| Job | Single-day visits: on my way, check-in (GPS stored), start code, check-out, confirm, auto-confirm 24 h, cancel rules, FAILED (LLD-009) | Multi-day, proposals/reschedule, quotes & material bills (LLD-017) |
| Money | Cash marked by worker + customer confirm, ledger, earnings, dues limit (LLD-010) | Online pay, refunds, payouts, GST invoices |
| Trust | ID photo upload + manual admin approve (LLD-016 minimal), reviews 1–5 + text (LLD-012 minimal) | Police verification, double-blind, moderation queue |
| Comms | Email + in-app inbox + web push for new offers (LLD-013 minimal) | Templates per locale for all events, quiet hours |
| Admin | Login + TOTP, approve worker docs, suspend user, bookings list (LLD-020 minimal) | Ops queues UI, PII reveal flow, roles matrix |
| Disputes | Handled by phone by you; "Report a problem" form creates a row (LLD-018 table only) | Full dispute workflow |
| Platform | Outbox, idempotency, reason codes, Flyway, CI, Testcontainers (LLD-022) | ShedLock multi-instance, Grafana |

## 3. Weekend-by-weekend plan

S1 = Saturday 2 h, S2 = Sunday 2 h. Each weekend ends with a commit and tests passing.

### Month 1 — Foundation and accounts (16 h)

| Weekend | S1 | S2 |
|---|---|---|
| W1 · 10–11 Oct | Repo, Spring Boot 3 / Java 21 skeleton, module packages, docker-compose (PostgreSQL 17 + PostGIS, Redis), Flyway | `V1_0` shared platform (outbox, processed_events, idempotency, reason codes), OutboxWriter + dispatcher, GitHub Actions + Testcontainers, first ArchUnit rule |
| W2 · 17–18 Oct | `users`, register, login, password hashing, JWT (LLD-001) | Refresh sessions with rotation + reuse detection (LLD-002); email verify via Brevo through the outbox |
| W3 · 24–25 Oct | Catalog migration + seed (trades, problems, en/bn/hi), `GET /catalog/*` (LLD-003) | Customer address book + PIN-based zone check (LLD-005) |
| W4 · 31 Oct–1 Nov | PWA skeleton (React + Vite or Next.js), `karigar.css` tokens, auth screens (C-01) | Deploy to a small VM with Docker + HTTPS. **Demo 1:** sign up → verify email → add address |

### Month 2 — Worker, request, matching (16 h)

| Weekend | S1 | S2 |
|---|---|---|
| W5 · 7–8 Nov | Worker profile, trades, rates with bounds (LLD-004) | Service area base + radius, preset working hours, online toggle, readiness → ACTIVE (LLD-007/015) |
| W6 · 14–15 Nov | Service request create, time-window rules, photo upload via presigned URL (LLD-006/014) | Matching: candidate query + rounds job (LLD-007) |
| W7 · 21–22 Nov | Offers inbox, interested (rate + arrival time) / decline (LLD-008) | Shortlist + select → booking + job + first visit created (LLD-008/009) |
| W8 · 28–29 Nov | PWA: request flow (C-03), shortlist (C-05) | PWA: worker home + offers (W-05). **Demo 2:** request → 2 workers interested → customer picks |

### Month 3 — Doing the job and getting paid (16 h)

| Weekend | S1 | S2 |
|---|---|---|
| W9 · 5–6 Dec | Visit flow: on my way + ETA, check-in (GPS stored), start code with 5 tries (LLD-009) | Check-out + amount calculation (VISIT / HOURLY / DAILY), job complete |
| W10 · 12–13 Dec | Visit + completion confirm, 24 h auto-confirm timer, cancellations with 2 h rule | Job FAILED, worker no-show, customer no-show (money rows only) |
| W11 · 19–20 Dec | Cash payment: worker marks, customer confirms, ledger postings, earnings (LLD-010) | Dues limit → no new offers; earnings summary API |
| W12 · 26–27 Dec | PWA: worker job flow (W-06) + cash (W-07) | PWA: customer tracking, start code, confirm, pay (C-06…C-08). **Demo 3:** full job paid in cash |

### Month 4 — Trust, notifications, admin, pilot (20 h)

| Weekend | S1 | S2 |
|---|---|---|
| W13 · 2–3 Jan | Notifications: in-app inbox + email (LLD-013 minimal) | Web push for new offers and "you got the job" |
| W14 · 9–10 Jan | Reviews 1–5 + text, rating on worker profile (LLD-012 minimal) | Worker ID document upload + statuses (LLD-016 minimal) |
| W15 · 16–17 Jan | Admin login + TOTP, approve/reject worker documents (LLD-020/016) | Admin: suspend user, bookings list, "report a problem" list |
| W16 · 23–24 Jan | **Buffer** — catch up on anything late | Hardening: backups, error handling, logs, security checklist (security/02) |
| W17 · 30–31 Jan | Bengali strings review, seed real trades/rates, onboard 5–10 workers | **Pilot launch** with a few known customers |

## 4. Milestones

| Date | Milestone | Done when |
|---|---|---|
| 1 Nov | M1 Foundation | Deployed; sign-up and login work; CI green |
| 29 Nov | M2 Matching | A real request reaches nearby workers and the customer picks one |
| 27 Dec | M3 Job + cash | A booked job is completed and paid in cash, fee recorded in the ledger |
| 31 Jan | M4 Pilot | Notifications, reviews, worker approval and basic admin; first real jobs |

## 5. Rules that keep this on track

- **One vertical slice at a time.** Never start the next weekend's API before this weekend's tests pass.
- **Every session:** 10 min plan with Claude → 90 min build → 20 min run tests, commit, write the next step in this file.
- **If behind by one weekend:** use the buffer (W16 S1).
- **Cut further, in this order, if behind by more:** web push (email + inbox only) → reviews → admin pages (approve workers directly in the DB) → photo upload.
- **Don't add scope.** New ideas go to a "Later" list at the bottom of this file.

## 6. Decisions needed before W1

| # | Decision | Recommendation |
|---|---|---|
| 1 | Frontend stack for the PWA | React + Vite (simple, fast to iterate with Claude) |
| 2 | Hosting | One small VM (e.g. 2 vCPU / 4 GB) with Docker Compose, managed backups |
| 3 | Cash-only pilot (no advance) | Yes — online payment after the pilot (LLD-011) |
| 4 | Email provider account | Brevo free tier (ADR 0016) |
| 5 | Pilot area | One service zone in Howrah (e.g. Shibpur PINs) |

## 7. After the pilot (Feb 2027 onwards)

Online payment + advance (LLD-011), payouts (LLD-019), quotes & material bills (LLD-017), full disputes (LLD-018), multi-day jobs, police verification, ops queues and admin console (LLD-020), realtime (LLD-021), native Android apps. Re-plan from what the pilot teaches.

## Later list

_(add new ideas here instead of building them)_
