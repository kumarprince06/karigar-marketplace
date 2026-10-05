# LLD-018: Disputes — Cases, Evidence, Resolution Actions

| Field | Value |
|---|---|
| Status | Draft |
| Owner | TBD |
| Reviewers | TBD |
| Module | `dispute` |
| Parent HLD | [modules/08](../modules/08-dispute-resolution-fraud-and-abuse-prevention.md), [architecture/03 §49–50, §48.2](../architecture/03-erd-and-production-database-design.md), [modules/07 §3.7, §6](../modules/07-trust-verification-reputation-and-reviews.md), [security/03 §26–27](../security/03-data-privacy-pii-retention-and-compliance.md) |
| Requirements | FR-DIS-001, BR-D-001 (dispute references a job context), BR-D-002 (no silent edits of job history), BR-S-001 |
| Depends on | LLD-009 (jobs, visits, timers), LLD-010 (cash payment `DISPUTED`, P5/P6, earnings hold), LLD-011 (`RefundService`, `refunds.dispute_id`), LLD-014 (`MediaAttachments`, purpose `DISPUTE_EVIDENCE`), LLD-009 (`worker_strikes`, created in `V7_1`; strike rules modules/07 §6), LLD-012 (`reviews.held_by_dispute_id`) |
| Used by | LLD-009 / LLD-010 (dispute entry for visits, completion, cash), LLD-012 (reviews held while a dispute is open), LLD-013 (notifications), LLD-021 (realtime), admin console |
| Last updated | 2026-10-05 |

---

## 1. Context & scope

A customer or worker disagrees about a job: the work wasn't done or was poor, the amount is wrong, "I never paid that cash", a no-show was recorded wrongly, something was damaged, someone behaved badly. They open a **dispute** in the app; the other party is told and can answer; a **dispute agent** looks at both statements, the photos and the job's own records, and decides. The decision is an **outcome plus a list of explicit actions** (refund ₹300, cash was paid, strike the worker …) that this module asks the owning modules to carry out.

**In scope**

- Opening a dispute on a job, a visit or a payment (by a party, or by support on their behalf after a phone / WhatsApp call)
- Holding the disputed thing so timers don't auto-confirm it (visit, job completion, cash payment)
- Statements and media evidence from both parties; agent messages; internal notes
- Agent queue, claim, resolve / reject; party withdraw
- Resolution actions with idempotency keys and per-action status; `DisputeOpened` / `DisputeResolved` events

**Out of scope:** fraud scoring and risk signals (modules/08 §8–11), appeals, customer-side sanctions, review moderation (LLD-012), chat between the parties (agents phone them and log the call as an internal note), chargebacks.

**Decisions**

| # | Decision | Default (configurable) |
|---|---|---|
| D1 | **One case = one subject of one job**: the whole `JOB`, one `VISIT`, or one `PAYMENT`. At most one non-withdrawn dispute per subject; the other party answers **inside** that case instead of opening a counter-dispute. | — |
| D2 | **Windows.** `VISIT` with status `DONE`: until the visit is confirmed (≤ 24 h after check-out, LLD-009 D4). `JOB` in `WORK_COMPLETED`: until completion is confirmed (≤ 24 h, LLD-009 D9). Anything else (job, no-show visit, any payment of the job): from booking until **7 days** after the job ended (completed, failed or cancelled). | 24 h / 7 days |
| D3 | **Opening holds the subject in the same transaction**, through the owning module's public API: visit → `job_visits.disputed_at`; job in `WORK_COMPLETED` → `jobs.disputed_at`; cash `PENDING` → payment `DISPUTED`. LLD-009 / LLD-010 timers skip held rows, so nothing auto-confirms under an open dispute. Earnings `ON_HOLD` and review hold happen on `DisputeOpened` (LLD-010 D9, modules/07 §3.7). | — |
| D4 | The other party (respondent) has **48 h** to answer. The case moves to `IN_REVIEW` on their first statement, on timeout, or when an agent claims it. Both parties may keep adding statements and media until it closes. | 48 h; 2,000 chars / statement; 10 media per party |
| D5 | Statuses: `AWAITING_RESPONSE → IN_REVIEW → RESOLVED | REJECTED`, and `WITHDRAWN` by the opener. "Open" means not closed. Asking a party for more information is an agent message, not a status. | — |
| D6 | A decision = `outcome` (`UPHELD | PARTIALLY_UPHELD | NOT_UPHELD`) + `at_fault` + a **summary shown to both parties** + a list of **actions**. An empty list is "no action". Earnings are released automatically when the case closes (LLD-010 consumes `DisputeResolved`), so there is no "release earnings" action. | — |
| D7 | **Settling the subject is synchronous** with the close (visit confirmed with original or adjusted amount, job completed, cash paid / not paid): it is local DB work and must not lag the decision. **Refunds and strikes run after commit**, each tracked as `PENDING → DONE | FAILED`. A failed action goes to the ops queue; it **never reopens** the case. | retry 5×, 1 min → 30 min |
| D8 | Every action has key `DISPUTE:{disputeId}:{seq}` — the same key LLD-011 D7 expects for refunds; strikes are unique per `dispute_id` (ERD §48.2). Retried actions reuse the key, so a refund or strike happens once. | — |
| D9 | **Party-visible and internal data are in separate tables** (`dispute_evidence` vs `dispute_internal_notes`), so an internal note can't leak through a participant query. Both parties see each other's statements and media; never GPS points, internal notes or the agent's view of the other party's history. | security/03 §26–27 |
| D10 | Refunds only from **online** payments of the job (incl. the advance) through LLD-011. Money back for cash-paid jobs is not automated (§11). | — |
| D11 | A dispute's refund total above **₹5,000** also needs `finance.refund` (ERD §52.1, second approver for large amounts). | ₹5,000 |
| D12 | Priority `HIGH` for `DAMAGE` and `BEHAVIOUR` (possible safety issue), `NORMAL` otherwise. | — |

**Categories** (`reason_codes` category `DISPUTE`, labels in en/bn/hi):

| Category | Opened by | Subjects | Typical actions |
|---|---|---|---|
| `WORK_NOT_DONE`, `POOR_QUALITY` | customer | JOB, VISIT | REFUND, ADJUST_VISIT, WORKER_STRIKE |
| `OVERCHARGED` | customer | VISIT, PAYMENT, JOB | ADJUST_VISIT, REFUND |
| `CASH_NOT_PAID` | customer | PAYMENT (cash) | CASH_PAID or CASH_NOT_PAID (one is required) |
| `NO_SHOW_DISAGREEMENT` | both | VISIT (`WORKER_NO_SHOW` / `CUSTOMER_NO_SHOW`) | REVOKE_STRIKE, REFUND |
| `DAMAGE`, `BEHAVIOUR` | both | JOB | WORKER_STRIKE, REFUND |
| `OTHER` (note required) | both | any | any |

---

## 2. Classes / components

```text
com.karigar.dispute
├── api/
│   ├── DisputeController              -- /api/v1/disputes/** (customer, worker)
│   └── AdminDisputeController         -- /api/v1/admin/disputes/** (dispute.manage, dispute.resolve)
├── application/
│   ├── OpenDisputeService             -- party + window + category checks, hold subject, first statement, outbox DisputeOpened
│   ├── DisputeStatementService        -- party statements / media, agent messages, internal notes
│   ├── CloseDisputeService            -- resolve / reject / withdraw: settle subject (sync), queue actions, outbox DisputeResolved
│   ├── DisputeActionExecutor          -- REFUND, WORKER_STRIKE, REVOKE_STRIKE after commit; one action per transaction
│   ├── DisputeJobs                    -- every 1 min (ShedLock, SKIP LOCKED): response timeout → IN_REVIEW; due PENDING actions
│   ├── DisputeQueryService            -- participant view; agent view adds system evidence + internal notes
│   ├── DisputeLookup (public API)     -- forJob(jobId) for LLD-012; responded(disputeId) for LLD-013; parties(disputeId) for LLD-021
│   └── port/
│       ├── JobDisputeHooks            -- job (LLD-009): context(), holdVisit, holdCompletion, releaseVisit(adjusted?), releaseCompletion, timeline
│       ├── CashDisputeHooks           -- payment (LLD-010): markDisputed, resolvePaid, resolveNotPaid, paymentsOfJob
│       ├── RefundService              -- payment (LLD-011): refundableMinor(paymentId), request(…, disputeId, key)
│       ├── StrikeIssuer               -- owner of `worker_strikes` (LLD-009; rules modules/07 §6): issueForDispute(workerId, disputeId, type), revoke(strikeId, disputeId)
│       ├── MediaAttachments           -- media (LLD-014): attach(ids, owner, {DISPUTE_EVIDENCE}, "dispute:{id}"), release
│       ├── MediaUrls                  -- media (LLD-014): signed GET for parties (MAIN) and agents (ORIGINAL, 60 s, audited)
│       └── OutboxWriter, AuditWriter
└── domain/
    ├── Dispute, DisputeStatus         -- transition table §6
    ├── DisputeSubject                 -- JOB | VISIT | PAYMENT + ids
    ├── DisputeWindowPolicy            -- D2, from JobDisputeContext (status, endedAt, visit status)
    └── ResolutionAction, ActionType   -- validation per type (§4.3)
```

`JobDisputeContext` (returned by `JobDisputeHooks.context`) carries job / visit status, customer and worker ids, service zone, `endedAt` and visit amounts. The dispute module never reads job or payment tables directly (ArchUnit).

---

## 3. Data model

Replaces the sketch in [ERD §49–50](../architecture/03-erd-and-production-database-design.md) (status names, explicit subject, actions, internal notes). ERD to be updated in the same PR.

```sql
-- V13_1__disputes.sql
CREATE TABLE disputes (
    id                  UUID PRIMARY KEY,                               -- UUIDv7 (ADR 0018)
    job_id              UUID NOT NULL REFERENCES jobs (id),
    subject_type        VARCHAR(10) NOT NULL CHECK (subject_type IN ('JOB','VISIT','PAYMENT')),
    job_visit_id        UUID REFERENCES job_visits (id),
    payment_id          UUID REFERENCES payments (id),
    customer_id         UUID NOT NULL REFERENCES customers (id),        -- copied from the booking
    worker_id           UUID NOT NULL REFERENCES workers (id),
    service_zone_id     UUID NOT NULL REFERENCES service_zones (id),    -- agent queues are zone-scoped (ERD §52.1)
    category            VARCHAR(30) NOT NULL CHECK (category IN ('WORK_NOT_DONE','POOR_QUALITY','OVERCHARGED',
                            'CASH_NOT_PAID','NO_SHOW_DISAGREEMENT','DAMAGE','BEHAVIOUR','OTHER')),
    priority            VARCHAR(10) NOT NULL CHECK (priority IN ('NORMAL','HIGH')),
    opened_by_user_id   UUID NOT NULL REFERENCES users (id),
    opened_by_role      VARCHAR(10) NOT NULL CHECK (opened_by_role IN ('CUSTOMER','WORKER')),
    opened_via          VARCHAR(10) NOT NULL CHECK (opened_via IN ('APP','SUPPORT')),
    opened_by_admin_id  UUID REFERENCES admin_users (id),               -- SUPPORT only
    status              VARCHAR(20) NOT NULL CHECK (status IN
                            ('AWAITING_RESPONSE','IN_REVIEW','RESOLVED','REJECTED','WITHDRAWN')),
    response_due_at     TIMESTAMPTZ NOT NULL,
    responded_at        TIMESTAMPTZ,
    assigned_admin_id   UUID REFERENCES admin_users (id),
    outcome             VARCHAR(20) CHECK (outcome IN ('UPHELD','PARTIALLY_UPHELD','NOT_UPHELD')),
    at_fault            VARCHAR(10) CHECK (at_fault IN ('WORKER','CUSTOMER','BOTH','NONE')),
    resolution_summary  TEXT,                                           -- shown to both parties
    closed_by_admin_id  UUID REFERENCES admin_users (id),
    closed_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL,
    version             BIGINT NOT NULL DEFAULT 0,
    CHECK ((subject_type = 'JOB'     AND job_visit_id IS NULL     AND payment_id IS NULL)
        OR (subject_type = 'VISIT'   AND job_visit_id IS NOT NULL AND payment_id IS NULL)
        OR (subject_type = 'PAYMENT' AND payment_id IS NOT NULL   AND job_visit_id IS NULL)),
    CHECK ((opened_via = 'SUPPORT') = (opened_by_admin_id IS NOT NULL)),
    CHECK ((status = 'RESOLVED') = (outcome IS NOT NULL AND at_fault IS NOT NULL)),
    CHECK ((status IN ('RESOLVED','REJECTED','WITHDRAWN')) = (closed_at IS NOT NULL)),
    CHECK (status NOT IN ('RESOLVED','REJECTED') OR (closed_by_admin_id IS NOT NULL AND resolution_summary IS NOT NULL))
);
-- D1: one live case per subject (a withdrawn case may be reopened inside the window)
CREATE UNIQUE INDEX ux_disputes_subject ON disputes (subject_type, COALESCE(job_visit_id, payment_id, job_id))
    WHERE status <> 'WITHDRAWN';
CREATE INDEX ix_disputes_queue    ON disputes (service_zone_id, priority, created_at) WHERE status IN ('AWAITING_RESPONSE','IN_REVIEW');
CREATE INDEX ix_disputes_response ON disputes (response_due_at) WHERE status = 'AWAITING_RESPONSE';
CREATE INDEX ix_disputes_job      ON disputes (job_id);
CREATE INDEX ix_disputes_customer ON disputes (customer_id, created_at DESC);
CREATE INDEX ix_disputes_worker   ON disputes (worker_id, created_at DESC);

-- party-visible timeline: statements, media, agent messages. Never updated (retention may delete).
CREATE TABLE dispute_evidence (
    id              UUID PRIMARY KEY,
    dispute_id      UUID NOT NULL REFERENCES disputes (id),
    kind            VARCHAR(15) NOT NULL CHECK (kind IN ('STATEMENT','MEDIA','AGENT_MESSAGE')),
    body            TEXT CHECK (char_length(body) <= 2000),
    media_id        UUID UNIQUE REFERENCES media_objects (id),          -- purpose DISPUTE_EVIDENCE (LLD-014)
    author_user_id  UUID NOT NULL REFERENCES users (id),
    author_role     VARCHAR(10) NOT NULL CHECK (author_role IN ('CUSTOMER','WORKER','AGENT')),
    created_at      TIMESTAMPTZ NOT NULL,
    CHECK ((kind = 'MEDIA') = (media_id IS NOT NULL AND body IS NULL)),
    CHECK (kind = 'MEDIA' OR body IS NOT NULL),
    CHECK ((kind = 'AGENT_MESSAGE') = (author_role = 'AGENT'))
);
CREATE INDEX ix_dispute_evidence_dispute ON dispute_evidence (dispute_id, created_at);
CREATE FUNCTION dispute_evidence_no_update() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'dispute evidence is append-only'; END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_dispute_evidence_ro BEFORE UPDATE ON dispute_evidence
    FOR EACH ROW EXECUTE FUNCTION dispute_evidence_no_update();

-- agents only; no participant query touches this table
CREATE TABLE dispute_internal_notes (
    id              UUID PRIMARY KEY,
    dispute_id      UUID NOT NULL REFERENCES disputes (id),
    admin_user_id   UUID NOT NULL REFERENCES admin_users (id),
    body            TEXT NOT NULL CHECK (char_length(body) <= 4000),    -- e.g. "Called Rina 14:10, fan stopped next morning"
    created_at      TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_dispute_notes_dispute ON dispute_internal_notes (dispute_id, created_at);

CREATE TABLE dispute_actions (
    id                  UUID PRIMARY KEY,
    dispute_id          UUID NOT NULL REFERENCES disputes (id),
    seq                 SMALLINT NOT NULL CHECK (seq BETWEEN 1 AND 20),
    action_type         VARCHAR(20) NOT NULL CHECK (action_type IN
                            ('REFUND','ADJUST_VISIT','CASH_PAID','CASH_NOT_PAID','WORKER_STRIKE','REVOKE_STRIKE')),
    payment_id          UUID REFERENCES payments (id),                  -- REFUND, CASH_*
    job_visit_id        UUID REFERENCES job_visits (id),                -- ADJUST_VISIT
    amount_minor        BIGINT CHECK (amount_minor >= 0),               -- REFUND amount; ADJUST_VISIT labour amount
    helper_amount_minor BIGINT CHECK (helper_amount_minor >= 0),        -- ADJUST_VISIT only
    strike_type         VARCHAR(30) CHECK (strike_type IN ('DISPUTE_UPHELD','OFF_PLATFORM_PAYMENT','ABUSIVE_BEHAVIOUR')),
    strike_id           UUID REFERENCES worker_strikes (id),            -- REVOKE_STRIKE target (LLD-009 V7_1)
    status              VARCHAR(10) NOT NULL CHECK (status IN ('PENDING','DONE','FAILED','CANCELLED')),
    idempotency_key     VARCHAR(100) NOT NULL UNIQUE,                   -- DISPUTE:{disputeId}:{seq}
    result_ref_id       UUID,                                           -- refund id / strike id
    attempts            SMALLINT NOT NULL DEFAULT 0,
    next_attempt_at     TIMESTAMPTZ,
    last_error          VARCHAR(200),
    executed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL,
    UNIQUE (dispute_id, seq),
    CHECK (action_type <> 'REFUND'        OR (payment_id IS NOT NULL AND amount_minor > 0)),
    CHECK (action_type NOT IN ('CASH_PAID','CASH_NOT_PAID') OR payment_id IS NOT NULL),
    CHECK (action_type <> 'ADJUST_VISIT'  OR (job_visit_id IS NOT NULL AND amount_minor IS NOT NULL AND helper_amount_minor IS NOT NULL)),
    CHECK (action_type <> 'WORKER_STRIKE' OR strike_type IS NOT NULL),
    CHECK (action_type <> 'REVOKE_STRIKE' OR strike_id IS NOT NULL)
);
CREATE UNIQUE INDEX ux_dispute_actions_one_strike ON dispute_actions (dispute_id) WHERE action_type = 'WORKER_STRIKE';
CREATE INDEX ix_dispute_actions_due ON dispute_actions (next_attempt_at) WHERE status = 'PENDING';

-- left open by LLD-011
ALTER TABLE refunds ADD CONSTRAINT fk_refunds_dispute FOREIGN KEY (dispute_id) REFERENCES disputes (id),
    ADD CONSTRAINT ck_refunds_dispute_reason CHECK ((reason_code = 'DISPUTE_RESOLVED') = (dispute_id IS NOT NULL));

-- left open by LLD-009 (worker_strikes, V7_1) and LLD-012 (reviews, V10_1)
ALTER TABLE worker_strikes ADD CONSTRAINT fk_worker_strikes_dispute
    FOREIGN KEY (dispute_id) REFERENCES disputes (id);
ALTER TABLE reviews ADD CONSTRAINT fk_reviews_held_by_dispute
    FOREIGN KEY (held_by_dispute_id) REFERENCES disputes (id);
```

The eight `DISPUTE` reason codes with en/bn/hi labels (`OTHER` has `requires_note`) are seeded in this module's repeatable `R__dispute_reason_codes.sql` (LLD-022), not in a versioned migration. `worker_strikes` (LLD-009 `V7_1`) and `reviews` (LLD-012 `V10_1`) both exist before `V13_1`, so their dispute FKs are added here.

**Retention** ([security/03](../security/03-data-privacy-pii-retention-and-compliance.md) table, proposed): 3 years after `closed_at` a job deletes `dispute_evidence` rows and `dispute_internal_notes`, calls `MediaAttachments.release` for the media, and keeps the `disputes` row (outcome, at_fault, summary) and `dispute_actions`. `legal_holds` skip the purge. An open dispute blocks account erasure (`OPEN_DISPUTE`, ERD §52.7).

---

## 4. API contract

### 4.1 Participants

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/v1/disputes` | customer / worker of the job | open; `Idempotency-Key` required → `201` |
| GET | `/api/v1/disputes?cursor=` | both | own disputes (as opener or respondent), newest first, 20 per page |
| GET | `/api/v1/disputes/{id}` | parties | status, timeline (evidence + status changes), summary and actions once closed |
| POST | `/api/v1/disputes/{id}/statements` | parties | `{ "body": "…", "mediaIds": [] }`; the respondent's first one moves the case to `IN_REVIEW` |
| POST | `/api/v1/disputes/{id}/withdraw` | opener | while open → `WITHDRAWN`; the subject is released as if the opener had confirmed it |

Open (Rina: fan stopped the morning after Sujit's repair; she paid the ₹450 bill online):

```json
// POST /api/v1/disputes   Idempotency-Key: 0192…
{ "subjectType": "JOB", "jobId": "…", "visitId": null, "paymentId": null,
  "category": "POOR_QUALITY", "statement": "Fan stopped again next morning, same noise.", "mediaIds": ["0192f…"] }
// 201
{ "data": { "id": "0192…", "status": "AWAITING_RESPONSE", "category": "POOR_QUALITY",
            "subject": { "type": "JOB", "jobId": "…" }, "responseDueAt": "2026-10-08T09:00:00Z" } }
```

The app opens a visit dispute from "Confirm today's work" (`subjectType: VISIT`), a completion dispute from "Work done?" (`JOB`), and "I didn't pay this" from the cash prompt (`PAYMENT`, `CASH_NOT_PAID`).

### 4.2 Agents

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/api/v1/admin/disputes?status=&zoneId=&priority=&cursor=` | `dispute.manage` | queue, oldest first within priority; zone-scoped roles see their zones only |
| GET | `/api/v1/admin/disputes/{id}` | `dispute.manage` | case + internal notes + system evidence: job / visit timeline (`audit_events`), check-in distance, flagged check-ins, start-code time, `job_media`, bill, payments and refunds, both parties' dispute and strike history |
| POST | `/api/v1/admin/disputes` | `dispute.manage` | open on behalf of a party after a phone / WhatsApp call: as §4.1 + `onBehalfOfUserId`; `opened_via = SUPPORT` |
| POST | `/api/v1/admin/disputes/{id}/claim` | `dispute.manage` | assign to me; `AWAITING_RESPONSE → IN_REVIEW` |
| POST | `/api/v1/admin/disputes/{id}/notes` | `dispute.manage` | internal note |
| POST | `/api/v1/admin/disputes/{id}/messages` | `dispute.manage` | message to both parties (e.g. "Please add a photo of the fan") |
| POST | `/api/v1/admin/disputes/{id}/resolve` | `dispute.resolve` (+ `finance.refund` above D11) | decision, `Idempotency-Key` required |
| POST | `/api/v1/admin/disputes/{id}/reject` | `dispute.resolve` | `{ "summary": "…" }` — not a valid dispute (duplicate, outside the platform's role); subject released with original values |
| POST | `/api/v1/admin/disputes/{id}/actions/{actionId}/retry` · `/cancel` | `dispute.resolve` | `FAILED` action: retry with the same key, or cancel with a note |

Resolve — fan fixed badly: ₹300 back from the online payment, worker strike:

```json
// POST /api/v1/admin/disputes/{id}/resolve   Idempotency-Key: 7c1…
{ "outcome": "PARTIALLY_UPHELD", "atFault": "WORKER",
  "summary": "The repair did not last. ₹300 of the labour is refunded to you.",
  "actions": [ { "type": "REFUND", "paymentId": "…", "amountMinor": 30000 },
               { "type": "WORKER_STRIKE", "strikeType": "DISPUTE_UPHELD" } ] }
// 200
{ "data": { "id": "…", "status": "RESOLVED",
            "actions": [ { "seq": 1, "type": "REFUND", "status": "PENDING" },
                         { "seq": 2, "type": "WORKER_STRIKE", "status": "PENDING" } ] } }
```

### 4.3 Action rules (checked before anything is written)

| Action | Valid when | Executed by | When |
|---|---|---|---|
| `ADJUST_VISIT` | subject is that `VISIT`, status `DONE`; amounts ≤ the visit's current ones (only lowering) | `JobDisputeHooks.releaseVisit` → visit confirmed `ADMIN`, `VisitConfirmed` | in the close txn |
| `CASH_PAID` / `CASH_NOT_PAID` | cash payment of the job, `DISPUTED` or auto-confirmed `SUCCEEDED`; exactly one is **required** when the subject is a `DISPUTED` cash payment | `CashDisputeHooks` → LLD-010 table (SUCCEEDED + P5 / CANCELLED / P6) | in the close txn |
| `REFUND` | online `SUCCEEDED` payment of the job; Σ refund actions ≤ `refundableMinor` | `RefundService.request(paymentId, amount, DISPUTE_RESOLVED, key, disputeId)` | after commit |
| `WORKER_STRIKE` | `atFault` ∈ (`WORKER`, `BOTH`); max one per dispute; points from modules/07 §6.1 by type | `StrikeIssuer.issueForDispute` | after commit |
| `REVOKE_STRIKE` | strike is on this job's worker and this job (e.g. a wrong `NO_SHOW`) | `StrikeIssuer.revoke` | after commit |

No action given for a held subject → released with original values (visit confirmed as checked out, job `COMPLETED` by `ADMIN`). For a `DISPUTED` cash payment the agent must choose (`CASH_ACTION_REQUIRED`); reject / withdraw count as `CASH_PAID`.

### 4.4 Error codes

| HTTP | `error.code` | When |
|---|---|---|
| 404 | `DISPUTE_NOT_FOUND` / `JOB_NOT_FOUND` | not a party (or not in the agent's zone) |
| 409 | `DISPUTE_WINDOW_CLOSED` | outside D2, or the timer confirmed it first |
| 409 | `DISPUTE_ALREADY_EXISTS` | live case on that subject (`details.disputeId`) — add a statement there |
| 422 | `CATEGORY_NOT_ALLOWED` | category not allowed for this role / subject (§1 table) |
| 422 | `INVALID_MEDIA` | `attach` failed (not `AVAILABLE`, not yours, wrong purpose, already used) — LLD-014 |
| 422 | `NOTE_REQUIRED` | `OTHER` without a statement |
| 409 | `DISPUTE_CLOSED` / `DISPUTE_STATE_INVALID` | statement / withdraw / resolve on a closed case |
| 422 | `ACTION_INVALID` | a §4.3 rule fails (`details.seq`, `details.reason`) |
| 422 | `CASH_ACTION_REQUIRED` | cash dispute resolved without `CASH_PAID` / `CASH_NOT_PAID` |
| 409 | `REFUND_EXCEEDS_PAYMENT` | `details.refundableMinor` |
| 403 | `REFUND_APPROVAL_REQUIRED` | above D11 without `finance.refund` |
| 409 | `IDEMPOTENCY_KEY_REUSED` | same key, different body |

---

## 5. Sequence diagrams

### 5.1 Customer disputes the cash the worker marked

```mermaid
sequenceDiagram
    participant C as Customer app
    participant O as OpenDisputeService
    participant P as CashDisputeHooks (LLD-010)
    participant M as MediaAttachments (LLD-014)
    participant DB as PostgreSQL
    C->>O: POST /disputes {PAYMENT, CASH_NOT_PAID, statement} (Idempotency-Key)
    O->>P: context + markDisputed(paymentId)
    P->>DB: lock payment; PENDING → DISPUTED, cash_disputed_at (else DISPUTE_WINDOW_CLOSED)
    O->>DB: INSERT disputes AWAITING_RESPONSE (response_due_at = +48 h), evidence STATEMENT
    O->>M: attach(mediaIds, customer, {DISPUTE_EVIDENCE}, "dispute:{id}")
    O->>DB: outbox DisputeOpened; audit_events — one commit
    Note over DB: DisputeOpened → LLD-010 earnings of the job ON_HOLD · LLD-012 hold reviews · LLD-013 push to worker "Rina raised an issue about the job. Please reply within 48 h" (details in app)
```

### 5.2 Resolve with a refund and a strike

```mermaid
sequenceDiagram
    participant A as Agent (dispute.resolve)
    participant S as CloseDisputeService
    participant J as JobDisputeHooks (LLD-009)
    participant X as DisputeActionExecutor
    participant R as RefundService (LLD-011)
    participant T as StrikeIssuer (LLD-009 strikes)
    participant DB as PostgreSQL
    A->>S: resolve {PARTIALLY_UPHELD, WORKER, actions} (Idempotency-Key)
    S->>DB: SELECT dispute FOR UPDATE; open?; validate §4.3 (refundableMinor, cash rule)
    S->>J: releaseCompletion(jobId) → job COMPLETED (ADMIN), outbox JobCompleted
    S->>DB: dispute RESOLVED; dispute_actions REFUND #1, STRIKE #2 PENDING; outbox DisputeResolved; audit — commit
    S-->>A: 200
    X->>R: request(paymentId, ₹300, DISPUTE_RESOLVED, "DISPUTE:{id}:1", disputeId)
    R-->>X: refundId (REQUESTED)
    X->>DB: action #1 DONE, result_ref_id = refundId
    X->>T: issueForDispute(workerId, disputeId, DISPUTE_UPHELD)
    X->>DB: action #2 DONE, result_ref_id = strikeId
    Note over X,DB: provider down / rejected → attempts++, next_attempt_at; after 5 → FAILED, alert. Case stays RESOLVED.
```

---

## 6. State transitions

**Dispute**

| From | Event | By | Guard | To |
|---|---|---|---|---|
| — | open | party / support | party of the job, D2 window, category allowed, subject held | AWAITING_RESPONSE |
| AWAITING_RESPONSE | respondent's first statement | respondent | — | IN_REVIEW (`responded_at`) |
| AWAITING_RESPONSE | `response_due_at` passed | `DisputeJobs` | — | IN_REVIEW (timeline: "No reply from Sujit") |
| AWAITING_RESPONSE / IN_REVIEW | claim | agent | `dispute.manage`, zone | IN_REVIEW (`assigned_admin_id`) |
| AWAITING_RESPONSE / IN_REVIEW | resolve | agent | `dispute.resolve`; actions valid | RESOLVED |
| AWAITING_RESPONSE / IN_REVIEW | reject | agent | `dispute.resolve` | REJECTED |
| AWAITING_RESPONSE / IN_REVIEW | withdraw | opener | — | WITHDRAWN |
| RESOLVED / REJECTED / WITHDRAWN | anything | — | — | unchanged (`DISPUTE_CLOSED`) |

Every close settles the subject (§4.3) and writes outbox `DisputeResolved { disputeId, jobId, customerId, workerId, subjectType, category, status, outcome, atFault, refundTotalMinor }` — one event for all three closes, consumed by LLD-010 (earnings back from `ON_HOLD`), LLD-012 (reveal reviews, modules/07 §3.7) and LLD-013 (push with the summary).

**Action:** `PENDING → DONE` (port succeeded; for a refund this means LLD-011 accepted it — its own `REFUND` state machine finishes it) · `PENDING → FAILED` (port rejected it, or 5 attempts) · `FAILED → PENDING` (retry, same key) · `FAILED → CANCELLED` (agent, with an internal note). In-transaction actions (`ADJUST_VISIT`, `CASH_*`) are written as `DONE`.

---

## 7. Error handling, idempotency & concurrency

- **Open vs auto-confirm timer:** the hold is a guarded update on the locked visit / job / payment row (`… AND customer_confirmed_at IS NULL AND disputed_at IS NULL`, `… AND status = 'PENDING'`). If the LLD-009 / LLD-010 timer committed first, the open fails with `DISPUTE_WINDOW_CLOSED`; if the open committed first, the timer's own re-check skips the row.
- **Two opens on one subject** (double tap, both parties at once): `ux_disputes_subject` lets one through; the other gets `DISPUTE_ALREADY_EXISTS` with the id. Same `Idempotency-Key` → the first `201` (`idempotency_records`).
- **Two agents resolving:** `SELECT … FOR UPDATE` + `version`; the second sees a closed case → `DISPUTE_CLOSED`, or the stored `200` if it was the same idempotency key.
- **Close transaction is all-or-nothing:** a settlement hook failing (e.g. the cash payment changed state) rolls back the whole decision; the agent sees the error and nothing half-applied exists.
- **No provider call inside a DB transaction:** refunds are queued as `PENDING` actions; `RefundService` commits its own row before calling the provider (LLD-011 §7).
- **Retries are safe:** the action key `DISPUTE:{id}:{seq}` is the refund's idempotency key (`UNIQUE (payment_id, idempotency_key)` in `refunds`), and `ux_strikes_dispute` blocks a second strike. If the executor crashed after the port call but before marking `DONE`, the next run gets the same refund / strike back and marks it `DONE`.
- **Refund over-limit:** pre-checked with `refundableMinor`, enforced again by LLD-011 under the payment lock; an action rejected there becomes `FAILED` (`REFUND_EXCEEDS_PAYMENT`) for the agent to correct.
- **Withdraw after the window:** allowed; the subject is released (opener's confirmation), and reopening is then impossible because the subject is no longer in its window.

---

## 8. Security & privacy

- **Who sees what:** parties see their own disputes, both parties' statements and media, agent messages, summary and their own money actions. Never: internal notes, GPS points or distances, the other party's phone, strike / dispute history, provider ids. Agent view requires `dispute.manage` and the case's zone; resolving needs `dispute.resolve`; large refunds `finance.refund` (D11). `DISPUTE_AGENT` role gets both dispute permissions; `SUPPORT_AGENT` gets `dispute.manage` only.
- Participant and agent responses are **different DTOs** built by different query methods; an ArchUnit rule forbids `DisputeController` from depending on `dispute_internal_notes` repositories (security/03 §27).
- Media: images are re-encoded and EXIF-stripped for parties; originals kept for agents with 60 s signed URLs and an audit row per URL (LLD-014 D6, D10).
- Every open, claim, message, note, close, retry and cancel writes `audit_events` (actor, dispute id, from → to). Resolution never edits job history (BR-D-002): visits / jobs change only through their own state transitions with actor `ADMIN`.
- Abuse limits: 5 opens per user per day, 3 live disputes per user, 20 statements per party per case (`429 RATE_LIMITED`). Repeated `NOT_UPHELD` openers are an ops signal (dashboard), not an automatic sanction (modules/08 §37).
- Statement text and internal notes are never logged; logs carry dispute id, status, category and action types only.

---

## 9. Observability

| Type | Name | Notes |
|---|---|---|
| Counter | `dispute_opened_total{category, subject, role, via}` | |
| Counter | `dispute_closed_total{status, outcome, at_fault}` | |
| Histogram | `dispute_time_to_close_hours{priority}` | SLA view (modules/08 §35) |
| Gauge | `disputes_open_oldest_hours{priority}` | alert: `HIGH` > 24 h, `NORMAL` > 72 h |
| Counter | `dispute_action_total{type, result}` | done, failed, retried |
| Gauge | `dispute_actions_failed_count` | alert > 0 (money or strike not applied) |
| Counter | `dispute_refund_minor_total` | refunds decided via disputes |

Product metrics (analytics, not alerts): disputes per 100 completed jobs, refund and partial-refund rate, share of `NOT_UPHELD`, disputes per worker (feeds `reputation_snapshots.dispute_rate`).

---

## 10. Test plan

| Level | Cases |
|---|---|
| Unit | `DisputeWindowPolicy`: each subject / status / age at the edges (23 h 59 m vs 24 h 01 m; day 7 vs day 8); category × role × subject matrix; §4.3 validation (lowering only, one strike, cash action required, Σ refunds) |
| Integration (Testcontainers) | open visit dispute → `disputed_at` set, auto-confirm timer skips it; open completion dispute → job stays `WORK_COMPLETED` past 24 h; cash dispute → payment `DISPUTED`, no ledger rows; respondent statement → `IN_REVIEW`; 48 h timeout → `IN_REVIEW` |
| Resolution | refund + strike → actions `DONE`, `refunds.dispute_id` set, `DisputeResolved` in outbox; `CASH_NOT_PAID` on auto-confirmed cash → P6 reversal (LLD-010); `ADJUST_VISIT` → visit confirmed `ADMIN` with lower amount; withdraw cash dispute → `SUCCEEDED` + P5 |
| Failure | provider down → refund action retried with the same key → one provider refund; executor killed after port call → no duplicate; refund rejected → `FAILED`, case stays `RESOLVED`, alert fires |
| Concurrency | open vs auto-confirm timer in parallel → exactly one wins; two opens on one subject → one `201`, one `409`; two agents resolve → one decision |
| Security | worker can't read another job's dispute (404); participant JSON never contains internal notes (schema snapshot test); zone-scoped agent can't see other zones; resolve without `dispute.resolve` → 403; ₹6,000 refund without `finance.refund` → 403 |
| Architecture (ArchUnit) | `dispute` uses only the ports in §2; no reads of `jobs`, `job_visits`, `payments` repositories |

---

## 11. Open questions

| Question | Default until decided | Owner | Due |
|---|---|---|---|
| Appeals against a dispute decision | None in MVP; a party may phone support, an agent can add a note; strikes keep their own appeal (ERD §48.2) | Product | Pilot review |
| Money back to a customer who paid **cash** (LLD-011 and LLD-019 both defer it here) | Not automated: ops pays by UPI and records a finance adjustment against the worker (LLD-010 P9) | Product + finance | Before launch |
| Refund from an advance that was already **applied** (e.g. wrong customer no-show fee) — LLD-011 must reverse the P2 split, not P3 | LLD-011 treats it like a job-payment refund (pro-rata, D8) | LLD-011 owner | Before build |
| Sanctions on customers (`BEHAVIOUR`, repeated false disputes) | Manual `account_restrictions` by ops outside this LLD | Product | Pilot review |
| "Rework" outcome (worker comes back to fix it) | Not an action; agent arranges it by phone, case resolved after | Product | Pilot review |
| Worker claims customer owes more (rejected material excess, LLD-017) | `OTHER`; no "charge customer" action | Product | With LLD-017 review |
| Should the worker see the customer's evidence photos | Yes (D9), images are re-encoded | Product + legal | Before launch |
| Windows (7 days general, 48 h response) and evidence retention (3 years) | As D2, D4, §3 | Product + legal | Before launch |

---

## Change log

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-05 | TBD | First draft |
| 0.2 | 2026-10-05 | TBD | Cross-LLD consistency |
