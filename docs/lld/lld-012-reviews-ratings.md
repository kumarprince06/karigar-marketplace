# LLD-012: Reviews, Ratings and Reputation Snapshot

| Field | Value |
|---|---|
| Status | Draft |
| Owner | TBD |
| Reviewers | TBD |
| Module | `review` |
| Parent HLD | [modules/07 §1, §3–4](../modules/07-trust-verification-reputation-and-reviews.md), [architecture/03 §47–48.1](../architecture/03-erd-and-production-database-design.md), [ADR 0017](../adr/0017-customer-picks-the-worker.md) |
| Requirements | FR-REV-001, BR-R-001, BR-R-002, product/04 §21–22 |
| Depends on | LLD-009 (`JobCompleted`, `BookingCancelled`, job/booking query API), LLD-004 (`ContactInfoDetector`), LLD-007 (`worker_matches` for response rate) |
| Used by | LLD-004 (`ReputationLookup`: rating, jobs done), LLD-007 (ranking reads `reputation_snapshots`), LLD-008 (customer rating on the offer card), LLD-013 (review notifications), LLD-018 (reveal hold, review removal) |
| Last updated | 2026-10-05 |

---

## 1. Context & scope

After a job is `COMPLETED`, the customer rates the worker and the worker rates the customer. A customer chooses between up to 3 workers on a phone screen (ADR 0017), so the worker's rating must be honest: only real completed jobs, no retaliation, no buried bad reviews, and no hidden "trust score". Ratings are kept as individual review rows (BR-R-002); every number shown is recomputed from them.

**In scope**

- Submit / edit a review (both directions), double-blind reveal, review window
- Text filter at submit, reports, admin moderation (`review.moderate`)
- Worker's public reply to a customer review
- Public review list with rating summary (average, count, 1–5 distribution)
- `reputation_snapshots` (MVP columns): rating, jobs completed, response and completion rates; event-driven recompute + nightly rebuild
- Customer rating (worker → customer) for the offer card, computed on read

**Out of scope:** aspect ratings (`review_ratings`) and review photos (`review_photos`) — later, see §11; `reputation_score`, worker levels (post-MVP) and strikes (`worker_strikes`, LLD-009; dispute strikes LLD-018); collusion / fake-job detection beyond "only a completed job can be reviewed" (fraud LLD, modules/07 §7); review reminders (LLD-013 sends them); disputes workflow (LLD-018).

**Decisions**

| # | Decision | Default (configurable) |
|---|---|---|
| D1 | **Two directions** (ERD §47): `CUSTOMER` reviews the worker (public), `WORKER` reviews the customer (private: only counts toward the customer's rating that workers see on offers; texts visible to admins only, modules/07 §1.2). | — |
| D2 | **One review per job per direction**, enforced by `UNIQUE (job_id, reviewer_role)`. Multi-day jobs get one review. | — |
| D3 | **Eligibility is checked at submit** against the job module (source of truth): job `COMPLETED` (customer-confirmed, auto or admin, LLD-009 D9) and the caller is the booking's customer or worker. `FAILED` and `CANCELLED` jobs get no review. No eligibility table. | — |
| D4 | **Window** = `jobs.completed_at + 7 days`. If the job has a dispute: open → window stays open; resolved → `max(completed_at + 7 d, resolved_at + 48 h)`. | 7 days / 48 h |
| D5 | **Double-blind:** a review is revealed (`visible_at` set) when both directions are in and neither is `UNDER_MODERATION`, or when the window closes. "Revealed" means `visible_at IS NOT NULL`. | reveal job every 5 min |
| D6 | **Moderation = filter at submit + reports after publication.** The filter checks text only: `ContactInfoDetector` (LLD-004 D6, incl. Bengali/Devanagari digits) and a per-locale word list (en, bn, hi, romanised). A hit → `UNDER_MODERATION`; the user still gets `201`. Clean reviews are not pre-moderated. | SLA 24 h |
| D7 | **Reports:** one per user per review. 3 reports from distinct users (not the reviewee) → `UNDER_MODERATION`. The reviewee's own report goes to the queue but does not hide the review. | 3 |
| D8 | Author can **edit only before reveal**; no delete. Admin cannot change text or stars, only status. | — |
| D9 | **Worker reply:** one per revealed customer review, within 30 days, ≤ 500 chars, editable for 24 h. A filter hit **rejects** the reply (`CONTACT_INFO_NOT_ALLOWED`, like LLD-004) — no moderation state for replies. Admin can hide a reported reply. | 30 days / 24 h |
| D10 | **Reputation snapshot is a projection, recomputed from `reviews` + other modules' query APIs, never incremented.** One row per worker per IST day, upserted. Recompute on review/job events and nightly at 03:00 IST for all workers. | 03:00 IST |
| D11 | **Rating** = counted customer reviews in the last 12 months, max 50 most recent. Shown as raw average; Bayesian `(C·m + Σ) / (C + n)` is for ranking only. MVP uses one global prior. Shown on cards only when `count ≥ 3`. | 12 mo / 50 / C = 10 / m = 4.3 / 3 |
| D12 | **No opaque score in MVP** (product/04 §21–22): no `reputation_score`, no levels. Snapshot holds only what is shown or used by LLD-007. | — |
| D13 | Text stored **as written** (NFC-normalised, trimmed, no translation). `comment_locale` from script: Bengali block → `bn`, Devanagari → `hi`, else `en`. | customer 1,000 / worker 500 chars |

---

## 2. Classes / components

```text
com.karigar.review
├── api/
│   ├── ReviewController              -- /jobs/{id}/reviews, /reviews/{id}, reply, report
│   ├── WorkerReviewController        -- GET /workers/{id}/reviews (public), GET /workers/me/reputation
│   └── AdminReviewController         -- /admin/reviews/** (review.moderate)
├── application/
│   ├── SubmitReviewService           -- submit + edit: eligibility, filter, insert, tryReveal
│   ├── RevealService                 -- tryReveal(jobId) under the job lock; ReviewRevealJob (every 5 min)
│   ├── ReplyService
│   ├── ReportService                 -- report, threshold → UNDER_MODERATION
│   ├── ModerationService             -- approve / hide / remove / hideReply, audit_events
│   ├── DisputeHoldListener           -- DisputeOpened / DisputeResolved (LLD-018)
│   ├── ReputationRecomputeService    -- recompute(workerId): advisory lock → queries → upsert today's row
│   ├── ReputationEventListener       -- ReviewPublished, ReviewModerated, JobCompleted, BookingCancelled
│   ├── NightlyReputationJob          -- 03:00 IST: all workers active in 13 months; delete rows > 400 days
│   ├── ReputationQueries             -- public API: implements LLD-004 ReputationLookup, CustomerRatingLookup (LLD-008),
│   │                                    hasReviewed(jobId, role) for LLD-013 reminders
│   └── port/ JobLookup (LLD-009), MatchStatsLookup (LLD-007), DisputeLookup (LLD-018),
│             ContactInfoDetector (LLD-004), OutboxWriter
├── domain/  Review, ReviewStatus, ReviewerRole, RevealPolicy, TextFilter (detector + word list), RatingSummary
└── infrastructure/  ReviewRepository, ReputationSnapshotRepository (JdbcTemplate for aggregates)
```

```java
public record ReviewContext(UUID jobId, UUID bookingId, UUID customerId, UUID workerId,
                            UUID customerUserId, UUID workerUserId, JobStatus status, Instant completedAt) {}

public interface JobLookup {                       // LLD-009 public query API
    Optional<ReviewContext> reviewContext(UUID jobId);
    int completedJobs(UUID workerId);              // lifetime
    Rate completionRate(UUID workerId, Instant since);   // COMPLETED / bookings not cancelled by the customer
}
```

`ContactInfoDetector` is used by `worker` and `review`; it moves from `worker.application.port` to `shared/text/` (pure function, no module state) — patch to LLD-004.

---

## 3. Data model

ERD §47–48.1 with the MVP changes listed under each table. Migration `V10_1__reviews.sql`.

```sql
-- V10_1__reviews.sql
CREATE TABLE reviews (
    id                       UUID PRIMARY KEY,                      -- UUIDv7 (ADR 0018)
    job_id                   UUID NOT NULL REFERENCES jobs (id),
    reviewer_role            VARCHAR(10) NOT NULL CHECK (reviewer_role IN ('CUSTOMER','WORKER')),
    reviewer_user_id         UUID NOT NULL REFERENCES users (id),
    customer_id              UUID NOT NULL REFERENCES customers (id),   -- copied from the booking
    worker_id                UUID NOT NULL REFERENCES workers (id),     -- copied from the booking
    overall_rating           SMALLINT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
    comment                  TEXT CHECK (char_length(comment) <= 1000),
    comment_locale           VARCHAR(10) CHECK (comment_locale IN ('en','bn','hi')),
    status                   VARCHAR(20) NOT NULL CHECK (status IN
                             ('PENDING_REVEAL','PUBLISHED','UNDER_MODERATION','HIDDEN','REMOVED')),
    moderation_reason_code   VARCHAR(40),                           -- reason_codes REVIEW_MODERATION
    counts_toward_reputation BOOLEAN NOT NULL DEFAULT true,
    reveal_due_at            TIMESTAMPTZ NOT NULL,
    held_by_dispute_id       UUID,                                  -- FK → disputes added by LLD-018 V13_1
    submitted_at             TIMESTAMPTZ NOT NULL,
    visible_at               TIMESTAMPTZ,                           -- set once, at reveal; never cleared
    worker_reply             TEXT CHECK (char_length(worker_reply) <= 500),
    worker_reply_status      VARCHAR(20) CHECK (worker_reply_status IN ('PUBLISHED','HIDDEN')),
    replied_at               TIMESTAMPTZ,
    moderated_by_admin_id    UUID REFERENCES admin_users (id),
    moderated_at             TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL,
    updated_at               TIMESTAMPTZ NOT NULL,
    CONSTRAINT ux_reviews_job_direction UNIQUE (job_id, reviewer_role),
    CHECK (status <> 'PUBLISHED' OR visible_at IS NOT NULL),
    CHECK (status <> 'REMOVED' OR counts_toward_reputation = false),
    CHECK (worker_reply IS NULL OR reviewer_role = 'CUSTOMER'),
    CHECK ((worker_reply IS NULL) = (replied_at IS NULL) AND (worker_reply IS NULL) = (worker_reply_status IS NULL)),
    CHECK (reviewer_role = 'CUSTOMER' OR char_length(comment) <= 500)
);
CREATE INDEX ix_reviews_worker_public ON reviews (worker_id, visible_at DESC)
    WHERE reviewer_role = 'CUSTOMER' AND status IN ('PUBLISHED','HIDDEN') AND visible_at IS NOT NULL;
CREATE INDEX ix_reviews_worker_counted ON reviews (worker_id, submitted_at DESC)
    WHERE reviewer_role = 'CUSTOMER' AND counts_toward_reputation;
CREATE INDEX ix_reviews_customer_counted ON reviews (customer_id, submitted_at DESC)
    WHERE reviewer_role = 'WORKER' AND counts_toward_reputation;
CREATE INDEX ix_reviews_reveal_due ON reviews (reveal_due_at)
    WHERE visible_at IS NULL AND status IN ('PENDING_REVEAL','HIDDEN') AND held_by_dispute_id IS NULL;
CREATE INDEX ix_reviews_moderation_queue ON reviews (submitted_at) WHERE status = 'UNDER_MODERATION';

-- one report per user per review; the reviewee's report queues without hiding (D7)
CREATE TABLE review_reports (
    review_id         UUID NOT NULL REFERENCES reviews (id),
    reporter_user_id  UUID NOT NULL REFERENCES users (id),
    reason_code       VARCHAR(40) NOT NULL,          -- REVIEW_MODERATION codes
    note              VARCHAR(500),
    is_reviewee       BOOLEAN NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL,
    resolved_at       TIMESTAMPTZ,                   -- set when an admin decides on the review
    PRIMARY KEY (review_id, reporter_user_id)
);
CREATE INDEX ix_review_reports_open ON review_reports (created_at) WHERE resolved_at IS NULL;

-- MVP subset of ERD §48.1 (D12); later columns are added by the trust LLD
CREATE TABLE reputation_snapshots (
    worker_id                UUID NOT NULL REFERENCES workers (id),
    snapshot_date            DATE NOT NULL,                     -- Asia/Kolkata
    formula_version          SMALLINT NOT NULL,
    window_start_at          TIMESTAMPTZ NOT NULL,
    jobs_completed_total     INTEGER NOT NULL,
    rating_count             INTEGER NOT NULL,
    rating_sum               INTEGER NOT NULL,
    rating_histogram         INTEGER[] NOT NULL CHECK (cardinality(rating_histogram) = 5),  -- [n1★ … n5★]
    rating_avg               NUMERIC(3,2) CHECK (rating_avg BETWEEN 1 AND 5),               -- NULL when count = 0
    rating_bayesian          NUMERIC(3,2) NOT NULL CHECK (rating_bayesian BETWEEN 1 AND 5),
    offers_received          INTEGER NOT NULL,                  -- 90 days
    response_rate            NUMERIC(5,4) CHECK (response_rate BETWEEN 0 AND 1),            -- NULL = no offers
    median_response_seconds  INTEGER,
    completion_rate          NUMERIC(5,4) CHECK (completion_rate BETWEEN 0 AND 1),          -- NULL = no bookings
    computed_at              TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (worker_id, snapshot_date),
    CHECK (rating_sum = rating_histogram[1] + 2*rating_histogram[2] + 3*rating_histogram[3]
                        + 4*rating_histogram[4] + 5*rating_histogram[5]),
    CHECK (rating_count = rating_histogram[1] + rating_histogram[2] + rating_histogram[3]
                        + rating_histogram[4] + rating_histogram[5])
);

-- reason_codes category REVIEW_MODERATION is seeded in this module's repeatable R__review_reason_codes.sql
-- (LLD-022): CONTACT_DETAILS, ABUSIVE_LANGUAGE, HATE_SPEECH, NOT_ABOUT_JOB, FAKE_OR_COLLUSION, EXTORTION,
-- DISPUTE_OUTCOME, OTHER (+ en/bn/hi labels). Permission review.moderate and its role grants: LLD-020 §3.2, §4.1
```

Rating part of the recompute (served by `ix_reviews_worker_counted`):

```sql
WITH counted AS (
  SELECT overall_rating FROM reviews
   WHERE worker_id = :workerId AND reviewer_role = 'CUSTOMER' AND counts_toward_reputation
     AND status IN ('PUBLISHED','HIDDEN') AND visible_at IS NOT NULL
     AND submitted_at >= now() - interval '12 months'
   ORDER BY submitted_at DESC LIMIT 50)
SELECT count(*), coalesce(sum(overall_rating), 0),
       ARRAY[count(*) FILTER (WHERE overall_rating = 1), count(*) FILTER (WHERE overall_rating = 2),
             count(*) FILTER (WHERE overall_rating = 3), count(*) FILTER (WHERE overall_rating = 4),
             count(*) FILTER (WHERE overall_rating = 5)]
  FROM counted;
```

`UNDER_MODERATION` (not decided yet), `REMOVED` and unrevealed reviews never count. `HIDDEN` counts (genuine stars, text broke rules). Rows are never deleted; snapshots older than 400 days are.

---

## 4. API contract

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/v1/jobs/{jobId}/reviews` | customer / worker of the job | submit; `Idempotency-Key` |
| PUT | `/api/v1/reviews/{id}` | author | full replace while unrevealed (D8) |
| GET | `/api/v1/jobs/{jobId}/reviews` | job parties | own review + `counterpartSubmitted`; the worker also sees the customer's review once revealed |
| POST / PUT | `/api/v1/reviews/{id}/reply` | the reviewed worker | `{ "text": "…" }` (D9) |
| POST | `/api/v1/reviews/{id}/report` | any logged-in user who can see it | `{ "reasonCode": "CONTACT_DETAILS", "note": null }` |
| GET | `/api/v1/workers/{workerId}/reviews?cursor=&limit=20` | public | summary (first page) + revealed customer reviews, newest first |
| GET | `/api/v1/workers/me/reputation` | worker | own snapshot + rating distribution |
| GET | `/api/v1/admin/reviews?queue=MODERATION\|REPORTED&cursor=` | `review.moderate` | status `UNDER_MODERATION`, or open reports |
| POST | `/api/v1/admin/reviews/{id}/approve` · `/hide` · `/remove` · `/hide-reply` | `review.moderate` | `{ "reasonCode": "…", "note": "…" }`; reason required except approve |

Submit (role comes from the token, D3; no reviewer, worker or customer id in the body):

```json
// POST /api/v1/jobs/7c1e…/reviews   Idempotency-Key: 5b0d…
{ "overallRating": 5, "comment": "সুজিতদা আধ ঘণ্টায় MCB-র সমস্যা ঠিক করে দিলেন, বুঝিয়েও বললেন।" }
// 201
{
  "data": {
    "reviewId": "0192…", "jobId": "7c1e…", "reviewerRole": "CUSTOMER",
    "overallRating": 5, "commentLocale": "bn",
    "status": "PENDING_REVEAL", "revealDueAt": "2026-10-12T08:35:00Z", "editable": true
  }
}
```

A filter hit returns the same `201` with `"status": "UNDER_MODERATION", "moderationReason": "CONTACT_DETAILS"`; the app says "We'll check your review before it's shown".

Public list:

```json
// GET /api/v1/workers/3f8a…/reviews?limit=20
{
  "data": {
    "summary": { "average": 4.7, "count": 38, "histogram": [1, 0, 2, 6, 29], "shown": true },
    "items": [
      { "reviewId": "0192…", "rating": 5, "comment": "সুজিতদা আধ ঘণ্টায়…", "commentLocale": "bn",
        "reviewerName": "Ananya B.", "trade": "Electrician", "month": "2026-10",
        "reply": { "text": "ধন্যবাদ দিদি!", "repliedAt": "2026-10-06T10:00:00Z" } },
      { "reviewId": "0191…", "rating": 2, "comment": null, "hidden": true,
        "reviewerName": "Rakesh S.", "trade": "Electrician", "month": "2026-09", "reply": null }
    ],
    "nextCursor": "eyJ2Ijoi…"
  }
}
```

`summary` comes from today's snapshot (`shown: false` and `average: null` when `count < 3`). `HIDDEN` items show stars with `"hidden": true` and no text. Trade label is localised per LLD-003. Cursor = `(visible_at, id)`.

**Error codes**

| HTTP | `error.code` | When |
|---|---|---|
| 404 | `JOB_NOT_FOUND` / `REVIEW_NOT_FOUND` | not a party to the job / not visible to the caller |
| 409 | `JOB_NOT_COMPLETED` | job not `COMPLETED` (incl. `FAILED`, `CANCELLED`) |
| 409 | `REVIEW_ALREADY_SUBMITTED` | this direction exists (different `Idempotency-Key`) |
| 409 | `REVIEW_WINDOW_CLOSED` | `now() ≥ reveal_due_at` and no open dispute |
| 409 | `REVIEW_NOT_EDITABLE` | PUT after reveal, or while `UNDER_MODERATION` / `HIDDEN` / `REMOVED` |
| 409 | `REPLY_NOT_ALLOWED` | not revealed, not `PUBLISHED`, already replied, or > 30 days; PUT > 24 h after reply |
| 400 | `CONTACT_INFO_NOT_ALLOWED` | reply contains phone / email / UPI id / link, or a word-list hit |
| 409 | `ALREADY_REPORTED` | same user, same review |
| 409 | `MODERATION_NOT_ALLOWED` | e.g. approve a `PUBLISHED` review, any action on `REMOVED` |
| 400 | `VALIDATION_ERROR` | rating outside 1–5, text too long, unknown `reasonCode` |
| 429 | `RATE_LIMITED` | > 20 reports per user per day |

---

## 5. Sequence diagrams

### 5.1 Submit and double-blind reveal

```mermaid
sequenceDiagram
    participant C as Customer app
    participant S as SubmitReviewService
    participant J as JobLookup (LLD-009)
    participant D as DisputeLookup
    participant DB as PostgreSQL
    C->>S: POST /jobs/{id}/reviews (rating 5, text)
    S->>J: reviewContext(jobId)
    J-->>S: COMPLETED, completedAt, customerUserId = caller → role CUSTOMER
    S->>D: forJob(jobId) → none
    S->>S: window open? text NFC + locale; TextFilter → clean
    S->>DB: BEGIN; pg_advisory_xact_lock(job); INSERT review PENDING_REVEAL, reveal_due_at = completedAt + 7 d
    S->>DB: outbox ReviewSubmitted; RevealPolicy: worker review exists and not UNDER_MODERATION?
    alt both in
        S->>DB: both → PUBLISHED, visible_at = now(); outbox ReviewPublished ×2
    else waiting
        Note over S,DB: stays PENDING_REVEAL; LLD-013 nudges the worker ("rate your customer to see their review")
    end
    S->>DB: COMMIT → 201
    Note over DB: ReviewRevealJob (5 min): jobs with reveal_due_at ≤ now(), no hold → pg_try_advisory_xact_lock(job) → tryReveal
```

### 5.2 Report, moderation, recompute

```mermaid
sequenceDiagram
    participant U as Reporters
    participant R as ReportService
    participant A as Admin (review.moderate)
    participant M as ModerationService
    participant L as ReputationEventListener
    participant DB as PostgreSQL
    U->>R: POST /reviews/{id}/report (3rd distinct non-reviewee user)
    R->>DB: lock(job); INSERT review_reports; count non-reviewee reports = 3 → status UNDER_MODERATION;<br/>outbox ReviewModerated (PUBLISHED → UNDER_MODERATION)
    A->>M: POST /admin/reviews/{id}/hide (CONTACT_DETAILS)
    M->>DB: lock(job); UNDER_MODERATION → HIDDEN; moderated_by/at; resolve open reports;<br/>audit_events REVIEW_HIDDEN; outbox ReviewModerated
    DB-->>L: ReviewModerated (outbox relay)
    L->>DB: processed_events check; recompute(workerId): pg_advisory_xact_lock(worker) → aggregate queries → UPSERT today's row
    L->>DB: rating or jobs changed → outbox ReputationUpdated (LLD-004 profile cache, search)
```

---

## 6. State transitions

| From | Event | Guard | To | Side effects |
|---|---|---|---|---|
| — | submit | filter clean | PENDING_REVEAL | `ReviewSubmitted`; tryReveal |
| — | submit | filter hit | UNDER_MODERATION | `moderation_reason_code`; `ReviewSubmitted` |
| PENDING_REVEAL | edit | clean / hit | PENDING_REVEAL / UNDER_MODERATION | tryReveal |
| PENDING_REVEAL | reveal | both directions in, none `UNDER_MODERATION`, or `reveal_due_at` passed; no dispute hold | PUBLISHED | `visible_at = now()`; `ReviewPublished` |
| HIDDEN (unrevealed) | reveal | same | HIDDEN | `visible_at = now()`; `ReviewPublished` (stars only) |
| PUBLISHED / HIDDEN | 3rd distinct non-reviewee report, or admin | — | UNDER_MODERATION | `ReviewModerated` |
| UNDER_MODERATION | admin approve | `visible_at` set / not set | PUBLISHED / PENDING_REVEAL | then tryReveal; `ReviewModerated` |
| UNDER_MODERATION / PUBLISHED | admin hide | — | HIDDEN | stars still count; `ReviewModerated` |
| HIDDEN | admin approve (restore text) | — | PUBLISHED or PENDING_REVEAL | as approve |
| any except REMOVED | admin remove (incl. dispute `EXTORTION`) | — | REMOVED | `counts_toward_reputation = false`; `ReviewModerated` |
| REMOVED | anything | — | REMOVED | `409 MODERATION_NOT_ALLOWED` (terminal) |

A worker reply (POST) writes outbox `ReviewReplied { reviewId, jobId, customerId, workerId }` (LLD-013 tells the customer); edits within 24 h and admin `hide-reply` don't.

Every admin transition resolves the review's open `review_reports` and writes `audit_events` (`REVIEW_APPROVED | REVIEW_HIDDEN | REVIEW_REMOVED | REVIEW_REPLY_HIDDEN`, reason code, note). Dispute hold: `DisputeOpened` sets `held_by_dispute_id` on the job's unrevealed rows; `DisputeResolved` clears it, sets `reveal_due_at = greatest(reveal_due_at, resolved_at + 48 h)` and calls tryReveal.

---

## 7. Error handling, idempotency & concurrency

- **One review per direction:** `ux_reviews_job_direction`. A retry with the same `Idempotency-Key` gets the stored `201` (shared `idempotency_records`, LLD-022); a different key gets `409 REVIEW_ALREADY_SUBMITTED`.
- **Job lock:** submit, edit, report, moderation, dispute hold and reveal take `pg_advisory_xact_lock(hashtextextended('review:' || job_id, 0))` before reading the job's reviews. Without it, customer and worker submitting at the same moment would each miss the other and wait 7 days. An advisory lock keeps the review module from locking the `jobs` row it does not own.
- **Reveal job:** reads candidate job ids from `ix_reviews_reveal_due` (limit 200), then per job a new transaction with `pg_try_advisory_xact_lock`; busy → skip, next run picks it up. tryReveal re-reads inside the lock, so two instances reveal once.
- **Eligibility race:** a job cannot leave `COMPLETED` (LLD-009), so checking it before the insert is enough. `reveal_due_at` is checked in the same transaction as the insert.
- **Recompute** takes `pg_advisory_xact_lock(hashtextextended('reputation:' || worker_id, 0))` **before** its queries (READ COMMITTED: each query sees all commits up to then), then `INSERT … ON CONFLICT (worker_id, snapshot_date) DO UPDATE`. A recompute that started earlier can never overwrite a newer one. Recompute is idempotent, so `processed_events` only saves work; a lost event is fixed by the nightly run.
- **Consumers:** `ReviewPublished`, `ReviewModerated`, `JobCompleted`, `BookingCancelled` → recompute that worker (and evict the customer-rating cache for `WORKER` reviews). Response rate changes only nightly. `JobFailed` changes nothing here.
- **Other modules unavailable** (e.g. `MatchStatsLookup` throws): the snapshot is not written; the previous day's row stays current; retried by the outbox relay. Readers always take the latest row (`ORDER BY snapshot_date DESC LIMIT 1`).
- **Customer rating** (`CustomerRatingLookup.forCustomer(customerId)`): revealed, counted `WORKER` reviews in 12 months; `null` when `count < 3`; Redis 10 min, read-through. Redis down → query directly (ADR 0004).

---

## 8. Security & privacy

- Reviewer and role come from the token matched against the booking's `customerUserId` / `workerUserId`; ids in the body are ignored. Non-parties get `404`. Self-booking is already blocked at matching (LLD-007), which is the core anti-fake rule: a review needs a real completed job.
- Public list shows first name + last initial, trade and month only — never phone, address, job id, user id or exact date. Worker → customer texts are admin-only (D1); the customer sees their own average only.
- Text is stored and returned as plain text; clients render it escaped (no HTML / markdown). Logs carry review id, job id, rating and filter result — never comment text.
- Word lists and detector patterns are config (ops can add romanised spellings without a release); a filter hit is not shown to the author as the matched word.
- Admin endpoints need `review.moderate` (granted to `OPS_MANAGER`, `SUPPORT_AGENT`, `DISPUTE_AGENT`, LLD-020 §3.2); admins can change status only, never text or stars. Every action → `audit_events`.
- Reports are rate-limited (20 / user / day) so reporting cannot be used to bury reviews; the reviewee's report never hides by itself (D7).
- Account deletion (DPDP): reviews stay (BR-R-002, product/03 §45); the name shows as "Karigar customer" / "Karigar worker". A request to remove one's own review text is handled by support as `HIDDEN` (stars keep counting).

---

## 9. Observability

| Type | Name | Notes |
|---|---|---|
| Counter | `review_submitted_total{role, result}` | `clean`, `flagged` |
| Gauge | `review_rate_7d{role}` | reviews / completed jobs, nightly; pilot target ≥ 40 % for customers |
| Counter | `review_filter_hit_total{reason}` | `CONTACT_DETAILS` spike → workers asking customers to share numbers |
| Gauge | `review_moderation_queue_oldest_seconds` | alert > 24 h (SLA) |
| Counter | `review_reports_total{reason, auto_moderated}` | |
| Gauge | `review_reveal_lag_seconds` | oldest unrevealed, unheld row past `reveal_due_at`; alert > 15 min |
| Histogram | `reputation_recompute_seconds{trigger}` | one worker; p95 < 200 ms |
| Gauge | `reputation_nightly_last_success_timestamp` | alert if > 26 h ago |
| Counter | `reputation_recompute_failed_total{source}` | which lookup failed |

Logs: `review.submitted`, `review.revealed`, `review.moderated` with review id, job id, role, from → to, admin id.

---

## 10. Test plan

| Level | Cases |
|---|---|
| Unit | `RevealPolicy` (both in, one flagged, window passed, dispute hold); `TextFilter`: `98300 12345`, `+91-98300-12345`, `৯৮৩০০১২৩৪৫`, `९८३००१२३४५`, UPI id, URL, word-list hit in en/bn/hi/romanised, clean Bengali text with prices ("₹৫০০") not flagged; locale detection; Bayesian (n = 0 → 4.30, n = 3 all 5★ → 4.46) |
| Integration (Testcontainers) | submit on `COMPLETED` → 201; on `WORK_COMPLETED` / `FAILED` / `CANCELLED` → 409; non-party → 404; second submit → 409, same key → same 201; day 8 → `REVIEW_WINDOW_CLOSED` |
| Double-blind | customer only → hidden from worker; worker submits → both `PUBLISHED`; parallel submits from both sides (100 runs) → always revealed together; one flagged → other waits until day 7; approve → both revealed |
| Moderation | 3 reports from distinct users → `UNDER_MODERATION`; 3 from the reviewee + 1 → still `PUBLISHED`, listed in `REPORTED` queue; hide → stars count, text gone from list; remove → excluded, snapshot recomputed; `audit_events` row per action |
| Reply | before reveal → 409; phone in reply → 400; second reply → 409; edit at 25 h → 409 |
| Reputation | histogram/sum/count checks; recompute twice → identical row; 51 reviews → only 50 newest; `REMOVED`/`UNDER_MODERATION` excluded; two concurrent recomputes → final row includes all reviews; nightly run rebuilds a deleted row |
| Dispute hold | open dispute → no reveal at day 7; resolved on day 10 → submit allowed until day 12, reveal then |
| Contract | public list never contains phone, user id, job id; `WORKER` reviews never in public list |
| Architecture (ArchUnit) | `review` reads jobs/bookings/matches only through `JobLookup` / `MatchStatsLookup`; nothing outside `review` writes `reviews` or `reputation_snapshots` |

---

## 11. Open questions

| Question | Default until decided | Owner | Due |
|---|---|---|---|
| Review window 7 days (modules/07) or 14 days | 7 days | Product | Before pilot |
| Aspect ratings and photos (`review_ratings`, `review_photos`, ERD §47) | Not in MVP; LLD-014 already has purpose `REVIEW_PHOTO` (disabled) | Product | After pilot data |
| Per-trade Bayesian prior (modules/07 §4.2) | Global 4.3 | Product + data | When any trade has 200 ratings |
| `reputation_score`, levels, on-time / no-show rates, strikes | Trust LLD; columns added then | Product | Before Phase 3 |
| Should the customer see the worker's review text of them | No — own average only (modules/07 §1.2) | Product | Before pilot |
| Repeat-pair rule ("one review per pair per 30 days counts", modules/07 §7) | Not applied; fraud LLD | Trust & safety | With fraud LLD |

---

## Change log

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-05 | TBD | First draft |
| 0.2 | 2026-10-05 | TBD | Cross-LLD consistency |
