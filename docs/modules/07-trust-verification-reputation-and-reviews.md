# Trust, Verification, Reputation & Reviews

**Project:** Karigar Marketplace
**Status:** Architecture / Engineering Design
**Architecture:** Modular Monolith
**Primary Stack:** Java + Spring Boot + PostgreSQL + PostGIS + Redis

---

## Current Model (aligned with ERD and ADRs)

The [ERD](../architecture/03-erd-and-production-database-design.md) (§15–16 verification, §47–48.2 reviews, reputation, strikes) is the source of truth for tables and statuses; [ADR 0017](../adr/0017-customer-picks-the-worker.md) decides that the customer picks the worker from up to 3 who accepted, so trust signals are what the customer chooses on. Where another doc disagrees, this section wins.

- **Verification** (`worker_verifications`, `verification_documents`, `verification_requirements`, `worker_verification_events`) is owned by the `worker` module. This doc sets per-trade policy, expiry, re-verification and the admin review SLA; it does not redefine the tables.
- **Reviews** (`reviews`, `review_ratings`, `review_photos`) are two-way: customer → worker and worker → customer. **One review per job per direction** (`UNIQUE (job_id, reviewer_role)`), only for a job in `COMPLETED`. Multi-day jobs get one review, not one per visit.
- **Double-blind reveal:** both reviews stay `PENDING_REVEAL` until both are submitted or the 7-day window closes. Statuses: `PENDING_REVEAL | PUBLISHED | UNDER_MODERATION | HIDDEN | REMOVED`. An open dispute on the job holds the reveal (`held_by_dispute_id`).
- **Reputation** is derived data in `reputation_snapshots` (one row per worker per day), recomputed from source tables on events and nightly. Rating uses a Bayesian average; reliability uses smoothed rates. `reputation_score` (0–100) feeds the matching rank ([modules/01](01-matching-engine-and-geospatial-discovery.md) §26–27, §64) and is never shown to anyone outside the platform.
- **Levels:** `NEW | ESTABLISHED | TRUSTED | TOP_RATED`, with thresholds as configurable defaults and a 14-day grace before demotion.
- **Strikes** (`worker_strikes`) record no-shows, late cancellations and conduct violations with points that expire after 90 days; active points drive restrictions and suspension. Enforcement, appeals and fraud cases are in [modules/08](08-dispute-resolution-fraud-and-abuse-prevention.md).
- **Professional passport** ([modules/09](09-search-discovery-and-worker-profile.md) §9–11, §42) is a read model over these tables. MVP is an in-app profile; a shareable, portable passport comes later.

All numbers marked *configurable default* are business settings (admin config), not code constants.

---

# 1. Trust Signals Customers See

A customer picks from up to 3 accepted workers on a phone screen, so every signal must be short, comparable and honest. Each signal has a minimum sample before it is shown; below that the card shows "New on Karigar" instead of a misleading number.

## 1.1 Shortlist card and profile

| Signal | Source | Shown as | Shown when (configurable default) |
|---|---|---|---|
| Verification badges | `worker_verifications` VERIFIED and not expired (ERD §15) | "ID verified", "Police verified", "Skill certified", "Licensed electrician" | Always, per badge |
| Rating | `reputation_snapshots.rating_avg` + `rating_count` | "4.7 ★ (38)" | `rating_count ≥ 3` |
| Jobs completed | `jobs_completed_total` | "42 jobs" (exact up to 99, then "100+", "200+", "500+") | `≥ 1` |
| On Karigar since | `workers.created_at` (first ACTIVE) | "On Karigar since Mar 2026" | Always |
| Response time | `median_response_seconds` | "Usually responds in ~3 min" | `offers_received ≥ 10` in 90 days |
| On-time rate | `on_time_rate` | "On time 96%" | `≥ 10` checked-in visits in 90 days |
| Repeat customers | `repeat_customer_count` | "12 repeat customers" | `≥ 2` |
| Level | `reputation_snapshots.level` | "Trusted" / "Top Rated" chip | `TRUSTED` or `TOP_RATED` only |
| Aspect averages | `*_avg` columns | Punctuality 4.8, Quality 4.6 … (profile only, not the card) | `≥ 5` aspect ratings each |
| Reviews | `reviews` PUBLISHED / HIDDEN (stars only for HIDDEN) | Newest first, with worker reply | Always |
| Distance, visit charge, ETA | `worker_matches` | From matching, not this module | Per offer |

The shortlist card shows at most: name + photo, badges, rating, jobs completed, one reliability line (on-time or response time, whichever is stronger), level chip, offer details. Everything else is on the profile.

## 1.2 Decisions

- **Displayed rating is the raw window average** (`rating_avg`, last 12 months, max 50 reviews). The Bayesian value is for ranking and levels only; showing it would confuse ("why 4.5 when all reviews are 5?").
- **Acceptance rate is not shown to customers.** Declining a 9 km job is reasonable behaviour ([modules/01](01-matching-engine-and-geospatial-discovery.md) §60). The worker sees it in their own dashboard.
- **Worker → customer ratings** are shown to workers on the offer card ("Customer 4.6 ★ (7)") when the customer has `≥ 3` counted ratings. Individual texts are visible only to admins; the customer sees only their own average.

## 1.3 Never shown to customers or other workers

| Data | Why |
|---|---|
| Aadhaar / PAN numbers (even masked), documents, selfie, police certificate file | Aadhaar Act s.29, DPDP Act; badges are enough |
| Exact home location, phone number before booking | Safety and disintermediation ([modules/01](01-matching-engine-and-geospatial-discovery.md) §56) |
| `reputation_score`, strikes, strike history | Internal enforcement data |
| Dispute details, risk signals, admin notes | Unproven allegations ([modules/08](08-dispute-resolution-fraud-and-abuse-prevention.md) §24) |
| Earnings, payout details | Private |
| Cancellation counts as raw numbers | Context-free counts mislead ([modules/08](08-dispute-resolution-fraud-and-abuse-prevention.md) Rule D) |
| Religion, caste, community, age | Not collected for profiles; prevents discrimination. Year of birth is used only for the 18+ check |
| Reviews in `PENDING_REVEAL`, `UNDER_MODERATION`, `REMOVED` | See §3 |

---

# 2. Verification

Tables, statuses, masking and duplicate detection are in ERD §15 (`worker_verifications`, `verification_documents`, `verification_requirements`) and §16 (`worker_verification_events`, append-only). This section is policy.

## 2.1 Per-trade mandatory checks

Seeded into `verification_requirements`; *configurable defaults* to be confirmed by the business.

| Trades | Mandatory to receive jobs | Optional (badge) | `valid_for_months` |
|---|---|---|---|
| All 33 trades | `EMAIL`, `AADHAAR_EKYC`, `SELFIE_MATCH`, `BANK_ACCOUNT` | `POLICE_VERIFICATION`, `SKILL_CERTIFICATE` | — |
| `ELECTRICIAN` | + `ELECTRICAL_LICENSE` (WB wireman permit) | | from document `expires_on` |
| `LOCKSMITH`, `HOME_CLEANING` | + `POLICE_VERIFICATION` (unsupervised access to locks / home interior) | | 24 |
| `CCTV_TECHNICIAN`, `GAS_STOVE_REPAIR`, `AC_TECHNICIAN` | — | `SKILL_CERTIFICATE` recommended | — |
| Any trade, before payouts above the TDS threshold | + `PAN` | | — |
| Any, for `TRUSTED` / `TOP_RATED` level (§5) | `POLICE_VERIFICATION` | | 24 |

Rules (from ERD §15, restated for implementers):

- A worker receives offers for a trade only when every mandatory check for that trade is `VERIFIED` and not expired. Matching checks this as an eligibility filter, not a ranking factor.
- `workers.verification_status` is a summary: `VERIFIED` = all base checks done; `PARTIAL` = some; `UNVERIFIED` = none. It is recomputed on every `worker_verification_events` insert.
- Aadhaar is verified via DigiLocker / offline e-KYC; only the last 4 digits, reference id, name and year of birth are stored.

## 2.2 Expiry and re-verification

| Trigger | Action | Configurable default |
|---|---|---|
| `expires_on` approaching | Notify worker (push + SMS) | 30, 7 and 1 day before |
| `expires_on` passed | Nightly job sets `EXPIRED`; trade becomes ineligible if the check is mandatory; badge disappears | 02:00 IST |
| Payout bank account changed | New `BANK_ACCOUNT` check; payouts on hold until `VERIFIED` | — |
| Phone / email changed, login from a new device followed by payout change | New `SELFIE_MATCH` | — |
| Periodic liveness | New `SELFIE_MATCH` | every 12 months |
| Customer safety complaint or dispute with `ABUSIVE_BEHAVIOUR` | Admin may `REVOKE` police verification and request a fresh certificate | — |
| Duplicate `document_number_hash` on another account | Second submission rejected (`ux_verifications_document`), risk signal raised ([modules/08](08-dispute-resolution-fraud-and-abuse-prevention.md) Rule A) | — |

A re-verification creates a new `worker_verifications` row; the old one stays (`EXPIRED` / `REVOKED`) for history. Grace period: a worker with an expiring optional badge keeps working; an expiring mandatory check blocks new offers but never cancels already-booked jobs.

## 2.3 Admin review queue

Provider-backed checks (e-KYC, selfie match, PAN, penny drop) are automatic; a result goes to `IN_REVIEW` only on low confidence (selfie match score below threshold, name mismatch). Manual checks (police certificate, skill certificate, licence) always go to the queue (`ix_verifications_review_queue`).

| Item | Configurable default |
|---|---|
| SLA, all queued items | 24 h (P90), 48 h max |
| Priority order | 1) worker blocked from all jobs, 2) mandatory trade check, 3) optional badge; then oldest `submitted_at` |
| Selfie-match auto-pass threshold | provider score ≥ 0.80; 0.60–0.80 → `IN_REVIEW`; < 0.60 → `REJECTED` (`SELFIE_MISMATCH`) |
| Name-match tolerance (ID vs bank vs profile) | token similarity ≥ 0.85 (handles "Sujit Kr. Das" vs "Sujit Kumar Das") |
| Max resubmissions after rejection | 3 per type per 30 days, then admin contact |
| Four-eyes rule | Revoking a `VERIFIED` check needs a second admin |

Every decision records `reviewed_by_admin_id`, `rejection_reason_code` (category `VERIFICATION_REJECTION`, ERD §52.4) and an event row. SLA breaches are a metric on the ops dashboard ([modules/11](11-admin-and-marketplace-operations.md)).

---

# 3. Reviews

Tables: ERD §47–48 (`reviews`, `review_ratings`, `review_photos`).

## 3.1 Eligibility

| Rule | Decision |
|---|---|
| When | Job status `COMPLETED` (customer confirmed). `CANCELLED` jobs, including those with some `DONE` visits, get no review; no-shows are handled by strikes (§6), not reviews |
| Who | The job's customer (`reviewer_role = CUSTOMER`) and the job's worker (`WORKER`). Caller identity from the token, never from the body |
| How many | One per job per direction. Multi-day jobs: one review for the whole job. No per-visit rating (per-visit confirmation already exists, ERD §40.1) |
| Window | 7 days from `jobs.completed_at` (*configurable default*); reminders at +1 h, +2 days, +6 days |
| Window and disputes | If a dispute on the job is open when the window would close, the window extends to dispute resolution + 48 h |

## 3.2 Content

| Field | Customer → worker | Worker → customer |
|---|---|---|
| Overall rating 1–5 | Required | Required |
| Aspects 1–5 (optional each) | `PUNCTUALITY`, `QUALITY`, `BEHAVIOUR`, `CLEANLINESS`, `PRICE_FAIRNESS` | `BEHAVIOUR`, `PAYMENT_ON_TIME`, `SITE_READINESS`, `CLEAR_REQUIREMENTS` |
| Text | Optional, ≤ 1,000 chars, any of en / bn / hi | Optional, ≤ 500 chars |
| Photos | Optional, ≤ 5, JPEG/PNG/WebP, uploaded via media module (direct upload, [modules/10](10-media-upload-and-object-storage.md)) | Not allowed |
| Quick tags (UI) | "Fixed it first time", "Explained clearly", … mapped to aspects client-side; not stored separately | — |

A rating of 1–2 prompts (not forces) the customer to pick an aspect and offers "Report a problem" (opens a dispute via [modules/08](08-dispute-resolution-fraud-and-abuse-prevention.md)) — a low rating is not a dispute.

## 3.3 Double-blind reveal

Neither party sees the other's review until both are in or the window closes. This stops a worker from rating a customer 1★ because they got 1★, and stops a customer from fearing that.

```text
Job COMPLETED (t0)
   │
   ├─ customer submits ──► PENDING_REVEAL ─┐
   ├─ worker submits ────► PENDING_REVEAL ─┤
   │                                       ├─ both submitted ─────────► reveal both now
   │                                       └─ t0 + 7 days (reveal_due_at) ► reveal whichever exists
   │
   └─ dispute open on the job ──► reveal held (held_by_dispute_id) until resolved
```

Reveal = `status → PUBLISHED`, `visible_at = now()`, publish `ReviewPublished`. Implementation:

- On submit, in the same transaction: lock the job's reviews with a transaction-level advisory lock on the job id (`pg_advisory_xact_lock`, [LLD-012](../lld/lld-012-reviews-ratings.md) §7 — the review module does not lock the `jobs` row it doesn't own), insert, then if the other direction exists and both are `PENDING_REVEAL` and no dispute hold → reveal both.
- A scheduler every 5 minutes reveals rows from `ix_reviews_reveal_due` where `reveal_due_at <= now()` and `held_by_dispute_id IS NULL`, using `FOR UPDATE SKIP LOCKED`.
- A review in `UNDER_MODERATION` at reveal time is not revealed; it is revealed (or not) when the admin decides. The other side's review is revealed on schedule regardless.

## 3.4 Status lifecycle

```text
submit ──► auto-filter ──clean──► PENDING_REVEAL ──reveal──► PUBLISHED
                │                                              │
                └─flagged─► UNDER_MODERATION ◄──report / admin─┘
                                  │
                ┌─────────────────┼──────────────────┐
                ▼                 ▼                  ▼
       PENDING_REVEAL /       HIDDEN              REMOVED
       PUBLISHED (approved)  (stars stay,        (does not count;
                              text/photos hidden) counts_toward_reputation = false)
```

| Status | Meaning |
|---|---|
| `PENDING_REVEAL` | Submitted, waiting for the other side or the window; author can edit |
| `PUBLISHED` | Visible |
| `UNDER_MODERATION` | Flagged by the filter or reported; waits for an admin |
| `HIDDEN` | Rating is genuine but text/photos break rules (phone number, abuse). Stars count, text hidden |
| `REMOVED` | Review is not genuine or not about the job (fake, wrong job, extortion, removed by dispute outcome). Does not count |

`HIDDEN` and `REMOVED` show the author a reason (`moderation_reason_code`); the author cannot resubmit.

## 3.5 Moderation

Synchronous auto-filter at submit (and on worker reply):

| Check | Rule | Result |
|---|---|---|
| Phone numbers | Regex for Indian mobile (`[6-9]\d{9}`, with spaces/dashes/+91, Bengali and Devanagari digits) | `UNDER_MODERATION`, reason `CONTACT_DETAILS` |
| Email / UPI ID / URLs | Regex | `UNDER_MODERATION`, `CONTACT_DETAILS` |
| Profanity / slurs | Word list per locale (en, bn, hi incl. romanised Bengali/Hindi), admin-editable | `UNDER_MODERATION`, `ABUSIVE_LANGUAGE` |
| Caste / religion / community terms used as insult | Word list | `UNDER_MODERATION`, `HATE_SPEECH` |
| Photo | Media module malware + NSFW check; faces of people other than the reviewer allowed only after admin check | `UNDER_MODERATION`, `PHOTO_POLICY` |
| Text-rating mismatch | Not checked in MVP | — |

Admin actions on `UNDER_MODERATION`: approve (back to where it would be), `HIDDEN`, `REMOVED`. SLA 24 h (*configurable default*). Customers and workers can report a published review once per review (`POST …/report`); 3 reports from different users auto-move it to `UNDER_MODERATION` (*configurable default*). The reviewee's own report goes straight to the queue but does not hide the review until decided — a worker cannot bury a bad review by reporting it.

New `reason_codes` category `REVIEW_MODERATION` (seed data only): `CONTACT_DETAILS`, `ABUSIVE_LANGUAGE`, `HATE_SPEECH`, `PHOTO_POLICY`, `NOT_ABOUT_JOB`, `FAKE_OR_COLLUSION`, `EXTORTION`, `DISPUTE_OUTCOME`, `OTHER`.

## 3.6 Editing and replies

| Action | Allowed | Rule |
|---|---|---|
| Edit own review | Only while `PENDING_REVEAL` | Full replace of rating, aspects, text, photos; re-runs the filter |
| Edit after `PUBLISHED` | No | Prevents "change it or else" pressure. Customer may ask support; admin can only moderate, never alter text |
| Delete own review | No | Admin `REMOVED` only |
| Worker reply | Once per customer review, after `PUBLISHED`, within 30 days | ≤ 500 chars, same filter; reply can be edited within 24 h of posting |
| Customer reply to worker review | No | Worker→customer reviews are not public (§1.2) |

## 3.7 Reviews and disputes

| Situation | Behaviour |
|---|---|
| Dispute open before reveal | Both reviews held (`held_by_dispute_id`); window extends to resolution + 48 h |
| Dispute resolved `FULL_REFUND` / `PARTIAL_REFUND` / `REWORK` against the worker | Customer review revealed as is; strike `DISPUTE_UPHELD` (§6) |
| Dispute resolved `NO_ACTION` | Reviews revealed as is |
| Dispute finds a review was used as a threat ("pay extra or 1★") | Review `REMOVED` with `EXTORTION`; abuse case on the author ([modules/08](08-dispute-resolution-fraud-and-abuse-prevention.md) §3.8) |
| Dispute opened after reveal | Review stays `PUBLISHED`; admin may move it to `UNDER_MODERATION` if the dispute is about the review itself |

Disputes never edit a review's rating; the only outcomes are the statuses above. The admin's action is recorded in `audit_events`.

---

# 4. Reputation Score

> **Post-MVP.** `reputation_score` (§4.4) and worker levels (§5) are not built in MVP (product/04 §21–22, [LLD-012](../lld/lld-012-reviews-ratings.md) D12); the MVP snapshot holds rating, jobs completed, response and completion rates only.

Table: `reputation_snapshots` (ERD §48.1). Everything is recomputed **from source tables**, never incremented, so a recompute is idempotent and a bug fix is a re-run.

## 4.1 Inputs and windows

| Metric | Definition | Window (configurable default) |
|---|---|---|
| Rating | Customer reviews with `counts_toward_reputation` | Last 12 months, at most the 50 most recent |
| Response rate | (`ACCEPTED` + `DECLINED`) / offers `NOTIFIED` (excludes offers withdrawn by the system) | 90 days |
| Acceptance rate | `ACCEPTED` / offers responded to | 90 days (worker-facing only) |
| Median response time | `responded_at − notified_at` over responded offers | 90 days |
| Completion rate | Jobs `COMPLETED` / bookings not cancelled by the customer | 90 days |
| Worker cancellation rate | Bookings cancelled by the worker / bookings | 90 days |
| No-show rate | Visits `WORKER_NO_SHOW` / visits scheduled | 90 days |
| On-time rate | Visits with `check_in_at ≤ scheduled_start_at + 15 min` / visits checked in | 90 days |
| Dispute rate | Disputes resolved `FULL_REFUND`, `PARTIAL_REFUND` or `REWORK` / completed jobs | 12 months |
| Repeat customers | Distinct customers with ≥ 2 completed jobs with the worker | Lifetime |

Ops windows are short (90 days) so a worker can recover; rating uses 12 months because reviews are sparser. "50 most recent" stops a long-tenured worker's old reviews from masking recent decline.

## 4.2 Bayesian rating

```text
R_b = (C × m + Σ ratings) / (C + n)

n = counted ratings in the window
m = prior: platform mean overall_rating for the worker's primary trade, last 90 days
    (fallback 4.3 until the trade has 200 ratings)        -- configurable default
C = 10 (prior weight, in "virtual reviews")               -- configurable default
```

| Worker | n | Raw avg | R_b (m = 4.3) |
|---|---|---|---|
| A, new | 3 | 5.00 | (43 + 15) / 13 = **4.46** |
| B, long-tenured | 50 (window cap) | 4.80 | (43 + 240) / 60 = **4.72** |
| C, mediocre | 40 | 4.00 | (43 + 160) / 50 = **4.06** |

## 4.3 Smoothed rates

Every rate is smoothed toward a platform prior the same way, so new workers are neither punished nor flattered by tiny denominators:

```text
rate_s = (successes + K × p) / (n + K),   K = 5      -- configurable default
```

| Rate | Prior p (configurable default) |
|---|---|
| response | 0.80 |
| completion | 0.95 |
| on_time | 0.85 |
| no_show | 0.02 |
| worker_cancellation | 0.05 |
| dispute | 0.02 |

Snapshots store the **raw** rates (what the profile shows); the score uses the smoothed ones.

## 4.4 Score

```text
rating_part      = (R_b − 1) / 4                                          -- 0..1
penalty          = min(1, 5 × no_show_s + 2 × worker_cancel_s + 3 × dispute_s)

reputation_score = 100 × ( 0.40 × rating_part
                         + 0.20 × on_time_s
                         + 0.15 × completion_s
                         + 0.10 × response_s
                         + 0.15 × (1 − penalty) )
```

Weights and multipliers are *configurable defaults*, versioned by `formula_version`. Strikes do not change the score directly (their causes already show up in the rates); they drive enforcement (§6).

Example — worker B above, on-time 0.92, completion 0.97, response 0.85, no-show 0.01, cancel 0.03, dispute 0.01 (smoothed values close to raw at this volume):

```text
rating_part = (4.72 − 1) / 4 = 0.93
penalty     = 0.05 + 0.06 + 0.03 = 0.14
score       = 100 × (0.372 + 0.184 + 0.1455 + 0.085 + 0.129) = 91.6
```

## 4.5 Recomputation

| Trigger event | Recompute |
|---|---|
| `JobCompleted`, `BookingCancelled`, `VisitMarkedNoShow`, `VisitCheckedIn` | That worker |
| `ReviewPublished`, `ReviewModerated` (to `HIDDEN` / `REMOVED` / back) | That worker (and the customer's aggregate) |
| `MatchResponded`, `MatchExpired` | That worker, debounced |
| `DisputeResolved`, `StrikeIssued`, `StrikeRevoked`, `VerificationStatusChanged` | That worker |
| Nightly 03:00 IST | All workers with any activity in the last 13 months: window roll-over, level hysteresis, strike expiry |

- Consumers read from the outbox ([ERD §52.5](../architecture/03-erd-and-production-database-design.md)); since recompute is idempotent, `processed_events` is used only to skip work, not for correctness.
- Debounce: event consumers add `worker_id` to a Redis set `reputation:dirty`; a job drains it every 60 s (*configurable default*) and upserts today's snapshot row. If Redis is lost, the nightly run catches up ([ADR 0004](../adr/0004-redis-non-authoritative.md)).
- One recompute = ~6 indexed aggregate queries per worker; at launch scale (low thousands of workers) the nightly full run is minutes. No incremental counters.
- Customer aggregates (worker → customer rating, cancellation and no-show counts) are computed on read for the offer card and cached in Redis for 10 min; no customer snapshot table in MVP.

## 4.6 Use in matching

Matching ([modules/01](01-matching-engine-and-geospatial-discovery.md) §26–27) reads the latest snapshot row with a `LATERAL … ORDER BY snapshot_date DESC LIMIT 1` join.

- **Eligibility (filter, not rank):** `account_status = ACTIVE`, mandatory verifications valid, not under strike restriction (§6).
- **Rank:** `reputation_score / 100` replaces the illustrative `reliabilityScore` term in modules/01 §27; weight 25% (*configurable default*), distance and skill fit keep the rest. `ranking_score` on `worker_matches` stores the result so the shortlist order is explainable.
- **Favourites** are notified first regardless of score (ERD §34.2).
- Rating never acts alone (modules/01 §64): a 5.0 with 3 reviews ranks near the prior, not at the top.

## 4.7 Cold start

| Mechanism | Detail |
|---|---|
| Priors | A new worker's score ≈ 83 (all values at the priors: rating 4.3, on-time 0.85, etc.) — below an established good worker (≈ 90+), above a poor one |
| Exploration slot | In each round-1 notification batch, 1 of N slots goes to a `NEW` worker who passes eligibility, if one is in range (*configurable default*: 1 slot, until the worker has 5 completed jobs) |
| Card | "New on Karigar" + verification badges + "On Karigar since"; no rating until 3 reviews |
| Onboarding reference | Optional: verified skill certificate gives the "Skill certified" badge from day one |

---

# 5. Worker Levels

> **Post-MVP** (see §4 note).

Computed nightly into `reputation_snapshots.level`. Badges from verification (§1.1) are separate from levels.

| Level | Requirements (all; *configurable defaults*) | Visible to customer |
|---|---|---|
| `NEW` | < 5 completed jobs | "New on Karigar" |
| `ESTABLISHED` | ≥ 5 completed jobs, not meeting `TRUSTED` | No chip |
| `TRUSTED` | ≥ 20 completed jobs; `R_b ≥ 4.3`; no-show rate ≤ 3%; `POLICE_VERIFICATION` valid; active strike points < 3 | "Trusted" |
| `TOP_RATED` | ≥ 50 completed jobs; `R_b ≥ 4.7`; on-time ≥ 90%; no-show ≤ 1%; dispute rate ≤ 2%; 0 active strike points; ≥ 6 months on platform | "Top Rated" |

Losing a level:

- **Grace:** demotion happens only after the worker has failed the level's thresholds on 14 consecutive daily snapshots (*configurable default*). The worker is notified on day 1 with the failing metric ("On-time rate 86%, needs 90%").
- **Immediate demotion** (no grace): suspension, police verification `EXPIRED`/`REVOKED`, or a strike of ≥ 3 points.
- Promotion is immediate on the next nightly run.
- Level changes publish `WorkerLevelChanged`; the worker sees it in the app with what to fix.

Levels give ranking no extra boost beyond the score (to avoid double counting); they are a customer-facing summary and a worker motivation.

---

# 6. Penalties & Safety

Table: `worker_strikes` (ERD §48.2). Restrictions and appeals use modules/08 §22–23.

## 6.1 Worker strikes

| Event | `strike_type` | Points (*configurable default*) | Issued by |
|---|---|---|---|
| Visit `WORKER_NO_SHOW` (confirmed: no check-in by start + 45 min and customer reports, or admin) | `NO_SHOW` | 3 | System |
| Worker cancels < 2 h before `scheduled_start_at` (except `PERSONAL_EMERGENCY` accepted by admin) | `LATE_CANCELLATION` | 2 | System |
| Worker cancels 2–12 h before | `LATE_CANCELLATION` | 1 | System |
| Check-in > 60 min late without a reschedule | `LATE_ARRIVAL` | 1 | System |
| Dispute resolved against the worker | `DISPUTE_UPHELD` | 2 | Explicit `WORKER_STRIKE` action in the agent's decision ([LLD-018](../lld/lld-018-disputes.md)), not automatic on `DisputeResolved` |
| Asking for off-platform payment / contact (proved by evidence) | `OFF_PLATFORM_PAYMENT` | 3 | Admin |
| Abusive or threatening behaviour | `ABUSIVE_BEHAVIOUR` | 5 | Admin |
| Review collusion / fake jobs (§7) | `REVIEW_MANIPULATION` | 5 | Admin |

Strikes expire 90 days after issue (*configurable default*). Idempotency: unique per (`job_visit_id`, `strike_type`) and per `dispute_id`, so redelivered events do not double-strike.

## 6.2 Thresholds

Active points = sum of `ACTIVE` + `APPEALED` strikes not expired.

| Active points | Consequence (*configurable defaults*) |
|---|---|
| 3 | Warning notification; level demoted to ≤ `ESTABLISHED` |
| 5 | Restricted 3 days: no new offers (`can accept jobs = NO`, modules/08 §22); booked jobs continue |
| 8 | Restricted 14 days + admin review |
| 10, or any `ABUSIVE_BEHAVIOUR` involving safety | `account_status = SUSPENDED` pending admin decision; future booked jobs are re-matched for the customer |
| 2 suspensions in 12 months | Admin decides on `DEACTIVATED` |

Restrictions are evaluated on every `StrikeIssued` / `StrikeRevoked` and nightly. A restriction ending does not erase the strikes; they expire on their own schedule.

## 6.3 Customer-side abuse

No customer strike table in MVP; customer counters are computed on read (§4.5) and enforcement uses `account_restrictions` (modules/08 §22, §25).

| Behaviour | Signal | Action (*configurable defaults*) |
|---|---|---|
| Fake / prank bookings | Customer no-show (`CUSTOMER_NO_SHOW`) ≥ 2 in 30 days, or requests from many accounts on one device | Cancellation fee on next booking (modules/03); 3rd in 30 days → restrict request creation 7 days |
| Late cancellation after worker en route | Booking cancelled after `EN_ROUTE` | Fee per reason code with `cancellation_fee_applies` (ERD §52.4) |
| Non-payment for cash jobs | Worker reports unpaid; dispute resolved in worker's favour | Cash option disabled; prepaid only. 2nd case → restriction + admin review |
| Abuse / harassment of worker | Worker review `BEHAVIOUR ≤ 2` with report, or safety report | Admin case; workers can block a customer (no further offers to that worker) |
| Review extortion | Dispute finding (§3.7) | Review `REMOVED`; restriction |

Low worker→customer ratings are shown to workers (§1.2), so workers can decline; they do not hide the customer from matching.

## 6.4 Appeals

- Worker appeals a strike within 7 days of issue (`POST /workers/me/strikes/{id}/appeal`) with a note and optional evidence → `APPEALED`. Still counts until decided.
- SLA 72 h (*configurable default*). Decision by an admin who did not issue the strike → `REVOKED` (score recomputed, restriction lifted if below threshold) or back to `ACTIVE`.
- Suspension appeals follow modules/08 §23. Verification rejections are not appealed; the worker resubmits (§2.3).
- Every decision is in `audit_events` with reason code.

---

# 7. Fake Review & Collusion Prevention

The core guarantee ([modules/08](08-dispute-resolution-fraud-and-abuse-prevention.md) §15): **a review can only come from a `COMPLETED` job on the platform**. Everything below is about fake jobs.

| Check | Rule (*configurable defaults*) | Where | Result |
|---|---|---|---|
| Self-booking | Customer and worker share a `user_devices` device id, phone, email, payout account / UPI VPA, or verified identity hash | At booking selection and review submit | Booking blocked if the same user; otherwise review `UNDER_MODERATION` (`FAKE_OR_COLLUSION`) + risk signal |
| Same payment account | Customer's payment instrument fingerprint = worker's payout account | Payment webhook | Risk signal; earnings held for review |
| Location sanity | Check-in GPS within 300 m of the request location and start code verified (ERD §40.1) | Visit check-in | Without both, the job's review gets `counts_toward_reputation = false` until admin check |
| Repeat pair velocity | Same customer–worker pair > 3 completed jobs in 7 days, or a worker's 5★ reviews from the same customer > 2 in 30 days | Reputation recompute | Only the first review per pair per 30 days counts toward the rating; extra reviews still publish |
| Review velocity | Worker gets > 5 reviews in 24 h, or > 3× their 30-day daily average | Nightly | Admin queue, no automatic action |
| Very short jobs | Job completed < 10 min after check-in with ≥ 4★ and no payment | Submit | `UNDER_MODERATION` |
| New-account cluster | ≥ 3 customer accounts created on one device in 30 days, all booking the same worker | Nightly | Risk case (modules/08 Rule A/B) |
| Reciprocal 5★ | Worker A's customers are workers who A reviewed 5★ and vice versa | Nightly | Risk case |

Signals create risk cases (modules/08 §9–10); only an admin issues `REVIEW_MANIPULATION` strikes or removes reviews. Removing a review sets `counts_toward_reputation = false` and triggers a recompute — reputation is fixed by recalculation, never by editing numbers (modules/08 §24).

---

# 8. Professional Passport

The passport is the worker's portable, evidence-based record ([modules/09](09-search-discovery-and-worker-profile.md) §9–11, §42). It is a read model; this module owns the review and reputation parts, the worker module owns identity and verification.

| Scope | MVP | Later |
|---|---|---|
| In-app profile | Badges, trades, rating, jobs completed, on-time, repeat customers, level, reviews, "On Karigar since" | Timeline view ("Completed 100 jobs — Aug 2027") |
| Worker view of own record | Full stats incl. acceptance rate, strikes, level progress | Monthly summary push/SMS |
| Shareable link | — | Public signed URL `karigar.in/p/{slug}` with the customer-visible subset, revocable by the worker |
| PDF / printable certificate | — | "Work history certificate" for bank loans / housing societies, signed with a QR code that verifies against the platform |
| Export to other platforms | — | Verifiable credential (W3C VC) / DigiLocker issued document; needs legal review |
| Data portability (DPDP) | Worker can download their own data (JSON) via support | Self-serve |

MVP builds no new tables: the profile is a query over `workers`, `worker_professions`, `worker_verifications`, `reputation_snapshots` and `reviews`, cached in Redis (5 min, invalidated on `ReputationUpdated`, `VerificationStatusChanged`, `ReviewPublished`).

---

# 9. Events and APIs

## 9.1 Events published

Written to `outbox_events` in the same transaction as the change.

| Event | Payload (key fields) | Consumers |
|---|---|---|
| `ReviewSubmitted` | reviewId, jobId, reviewerRole, overallRating | analytics |
| `ReviewPublished` | reviewId, jobId, workerId, customerId, reviewerRole, overallRating | reputation recompute, notification ("You got a new review"), search projection |
| `ReviewModerated` | reviewId, fromStatus, toStatus, reasonCode | reputation recompute, notification to author |
| `ReviewReplied` | reviewId, workerId | notification to customer |
| `ReputationUpdated` | workerId, snapshotDate, reputationScore, ratingAvg, ratingCount, level | matching cache, search projection, passport cache |
| `WorkerLevelChanged` | workerId, fromLevel, toLevel, reason | notification, analytics |
| `StrikeIssued` / `StrikeRevoked` / `StrikeExpired` | strikeId, workerId, strikeType, points, activePoints | restriction evaluator, notification |
| `WorkerRestricted` / `WorkerRestrictionLifted` | workerId, until, activePoints | matching eligibility, notification |
| `VerificationStatusChanged` (worker module) | workerId, verificationType, professionId, toStatus | eligibility, badges, reputation (level) |

Consumed: `JobCompleted` (opens review window, schedules reminders), `BookingCancelled`, `VisitMarkedNoShow`, `VisitCheckedIn`, `MatchResponded`, `MatchExpired`, `DisputeOpened` (hold reveal), `DisputeResolved` (release hold; strikes come from the explicit `WORKER_STRIKE` action, LLD-018).

## 9.2 Endpoints

Base `/api/v1`. Caller role from the token. Errors use the standard envelope ([api/01](../api/01-rest-api-contract-endpoints-and-error-model.md)). State changes are action endpoints ([ADR 0010](../adr/0010-action-endpoints-for-state-transitions.md)) and accept `Idempotency-Key`.

| Method & path | Who | Purpose |
|---|---|---|
| `POST /jobs/{jobId}/reviews` | Customer or worker of the job | Submit review |
| `PUT /reviews/{reviewId}` | Author | Edit while `PENDING_REVEAL` |
| `GET /jobs/{jobId}/reviews` | Job parties | Own review + other side's if revealed |
| `POST /reviews/{reviewId}/reply` | Reviewed worker | Public reply |
| `POST /reviews/{reviewId}/report` | Any logged-in user | Report a review |
| `GET /workers/{workerId}/reviews?cursor=&limit=20` | Public | Published customer reviews |
| `GET /workers/{workerId}/reputation` | Public | Trust summary for card/profile |
| `GET /workers/me/reputation` | Worker | Full stats, level progress, strike points |
| `GET /workers/me/strikes` | Worker | Strikes with status and expiry |
| `POST /workers/me/strikes/{strikeId}/appeal` | Worker | Appeal a strike |
| `GET /admin/reviews?status=UNDER_MODERATION` | Admin `review.moderate` | Moderation queue |
| `POST /admin/reviews/{reviewId}/approve` · `/hide` · `/remove` | Admin `review.moderate` | Moderation decision with `reasonCode` |
| `POST /admin/workers/{workerId}/strikes` | Admin `worker.enforce` | Manual strike |
| `POST /admin/strikes/{strikeId}/revoke` · `/reject-appeal` | Admin `worker.enforce` | Appeal decision |

### Submit review

```http
POST /api/v1/jobs/7c1e…/reviews
Idempotency-Key: 5b0d…
```

```json
{
  "overallRating": 5,
  "aspects": { "PUNCTUALITY": 5, "QUALITY": 5, "BEHAVIOUR": 5, "CLEANLINESS": 4, "PRICE_FAIRNESS": 5 },
  "comment": "Sujit-da fixed the MCB tripping in 30 minutes and explained the problem.",
  "photoMediaIds": ["e2a4…"]
}
```

`201 Created`

```json
{
  "reviewId": "91f3…",
  "jobId": "7c1e…",
  "reviewerRole": "CUSTOMER",
  "status": "PENDING_REVEAL",
  "revealDueAt": "2026-10-10T14:05:00+05:30",
  "editableUntilReveal": true
}
```

Errors:

| HTTP | code | When |
|---|---|---|
| 409 | `JOB_NOT_COMPLETED` | Job not `COMPLETED` |
| 403 | `NOT_A_JOB_PARTY` | Caller is not the job's customer or worker |
| 409 | `REVIEW_ALREADY_SUBMITTED` | Direction already reviewed (unique index) |
| 409 | `REVIEW_WINDOW_CLOSED` | `now() ≥ reveal_due_at` |
| 400 | `VALIDATION_ERROR` | Rating out of 1–5, aspect not allowed for the role, > 5 photos, text too long |
| 409 | `REVIEW_NOT_EDITABLE` | (PUT) review already revealed or moderated |

A submission caught by the filter still returns `201` with `"status": "UNDER_MODERATION"` and the reason; the user is told it will be checked.

### Get worker reputation (public)

```http
GET /api/v1/workers/3f8a…/reputation
```

`200 OK`

```json
{
  "workerId": "3f8a…",
  "displayName": "Sujit Das",
  "level": "TRUSTED",
  "badges": ["ID_VERIFIED", "POLICE_VERIFIED", "LICENSED_ELECTRICIAN"],
  "rating": { "average": 4.7, "count": 38, "shown": true },
  "aspects": { "PUNCTUALITY": 4.8, "QUALITY": 4.7, "BEHAVIOUR": 4.9, "CLEANLINESS": 4.5, "PRICE_FAIRNESS": 4.6 },
  "jobsCompleted": 42,
  "jobsCompletedLabel": "42",
  "memberSince": "2026-03",
  "onTimeRate": 0.96,
  "medianResponseSeconds": 170,
  "repeatCustomers": 12,
  "asOf": "2026-10-03"
}
```

Fields below their minimum sample (§1.1) are `null`; for a new worker `level` is `NEW` and `rating.shown` is `false`. `reputationScore`, strikes and acceptance rate are only in `GET /workers/me/reputation` (score excluded there too; the worker sees the metrics and the level gap, not the internal number).

---

# 10. Configurable Defaults Summary

| Setting | Default |
|---|---|
| Review window | 7 days after `COMPLETED`; + 48 h after dispute resolution |
| Minimum ratings to show rating | 3 |
| Rating window | 12 months, max 50 reviews |
| Ops-metric window | 90 days |
| Bayesian prior weight `C` / fallback mean `m` | 10 / 4.3 |
| Rate smoothing `K` | 5 |
| Score weights (rating / on-time / completion / response / penalty) | 40 / 20 / 15 / 10 / 15 |
| Reputation weight in matching rank | 25% |
| On-time tolerance | 15 min |
| Level demotion grace | 14 days |
| Strike expiry | 90 days |
| Restriction thresholds | 5 pts → 3 days, 8 pts → 14 days, 10 pts → suspension |
| Moderation / verification / appeal SLA | 24 h / 24 h (48 h max) / 72 h |
| Reports to auto-moderate | 3 distinct users |
| Police verification validity | 24 months |
| Selfie re-check | 12 months |

---

# 11. Module Ownership

```text
review module (com.karigar.review)
├── reviews, review_ratings, review_photos
├── reputation_snapshots          -- derived; recompute service + nightly job
├── worker_strikes                -- issue/expire; restriction evaluator calls modules/08 account_restrictions
├── moderation filter (word lists, regex) + admin moderation use cases
└── read APIs for reputation / reviews

worker module
└── worker_verifications, verification_documents, verification_requirements, worker_verification_events
```

The review module reads jobs, bookings, visits, matches and disputes through their modules' query APIs or read-only SQL views, never by writing to them ([ADR 0002](../adr/0002-package-by-business-module.md)).
