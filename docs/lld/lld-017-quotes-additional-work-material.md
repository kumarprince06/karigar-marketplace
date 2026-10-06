# LLD-017: Quotes, Additional Work and Material Bills

| Field | Value |
|---|---|
| Status | Draft |
| Owner | TBD |
| Reviewers | TBD |
| Module | `job` (sub-package `job.quote`) |
| Parent HLD | [modules/03 §13–17](../modules/03-pricing-quotation-and-money-flow.md), [architecture/03 §41–41.1](../architecture/03-erd-and-production-database-design.md), [architecture/04 §41–43](../architecture/04-domain-model-aggregates-and-state-machines.md), [ADR 0006](../adr/0006-money-integer-minor-units.md), [ADR 0018](../adr/0018-uuidv7-identifiers.md) |
| Requirements | FR-JOB-002 (additional work, itemised quotes, material bills), product/04 §18 (MVP additional work) |
| Depends on | LLD-009 (job, visits, bill, `JobTimersJob`), LLD-010 (`payment_allocations`, `EarningSplit`), LLD-008 (agreed rate snapshot), media LLD (LLD-014, receipt photos) |
| Used by | LLD-009 (bill lines, completion guard), LLD-010 / LLD-011 (paying the bill, material excluded from commission), LLD-013 (notifications), disputes LLD |
| Last updated | 2026-10-05 |

---

## 1. Context & scope

A booking starts at the rate the worker picked at selection (LLD-008 D1). Real jobs change once the worker is on site: the tap needs a new valve, the plumber's inspection turns into a pipe replacement, the raj mistri needs 10 bags of cement. Every price the customer did not already agree to is a **quote** the customer accepts or rejects in the app. Material the worker buys is billed from the **shop bill**, not from a typed number.

**In scope**

- Worker creates a quote (line items) on a running job; customer accepts / rejects; worker withdraws or revises; expiry
- Accepted quotes enter the job bill (LLD-009 §5.4) — never edited afterwards
- Material bills: worker records amount + receipt photo; within the quoted material it is billable, above it the customer must acknowledge
- Bill lines and allocation targets for LLD-010 (material reimbursement carries no commission)

**Out of scope:** competing quotes before selection (selection uses existing rates, LLD-008 D1), changing the booking's agreed rate (`agreed_rate_type = QUOTE`), material advance payments, taking payment (LLD-010/011), disputes about quality or receipts (disputes LLD), GST invoices.

**Decisions**

| # | Decision | Default (configurable) |
|---|---|---|
| D1 | **MVP creates only `ADDITIONAL` quotes (and `REVISION`s of them), always on a job.** "Inspection then quote" = visit 1 at the VISIT rate, then an additional quote (optionally with a `DISCOUNT` line "visit charge adjusted"). The booking's agreed rate is never changed, so no rate re-snapshot. `INITIAL` stays in the enum for later. | — |
| D2 | Quotes can be created only while the job is `IN_PROGRESS` or `ON_HOLD`, by the job's worker. **One `SUBMITTED` quote per job** at a time. | — |
| D3 | A quote is created directly as `SUBMITTED` (no server-side draft; the app keeps the draft). It **expires 24 h** after submission if the customer does nothing. Non-response never accepts. | 24 h |
| D4 | **Revise** = new quote (`REVISION`, `revision_of_quote_id`) that supersedes a `SUBMITTED` one in the same transaction. An `ACCEPTED` quote is final; more work = another `ADDITIONAL` quote. | — |
| D5 | Amounts are computed by the backend: line = `ROUND_HALF_UP(quantity × unit_price_minor)`; totals = sum of lines. Client totals are ignored. | — |
| D6 | **Sanity bounds:** ≤ 30 lines; `quantity` 0.01–9,999; one line ≤ ₹1,00,000; quote total ≤ ₹2,00,000 and ≥ 0; one material bill ≤ ₹50,000; `bill_date` from the booking's confirmed date − 1 day to today. Above → `422`; bigger jobs go through ops. | as listed |
| D7 | **Quoted material is a ceiling, not a charge.** On the bill a quote shows `total − material_total` (labour, helpers, visit charge, transport, discount). Worker-supplied material is billed **only from material bills**, at the actual amount. Underspend benefits the customer; padding labour as "material" earns nothing without a receipt. | — |
| D8 | **Material bill coverage:** a bill with a receipt photo, linked to an accepted quote, is billable up to that quote's **remaining material allowance** (`material_total − Σ covered` of earlier bills). The rest (`excess`) — or the whole bill if it has no photo or no quote — needs the customer's acknowledgement. Unacknowledged after **24 h** → excess not billable. | 24 h |
| D9 | **No material advance in MVP.** An accepted quote is on the bill immediately, so the customer may pay it before the work (normal LLD-010/011 job payment). Large material (cement, tiles) is usually bought by the customer (`supplied_by = CUSTOMER`, ₹0 line). `MATERIAL_ADVANCE` purpose stays unused. | — |
| D10 | Job **cancelled or failed** midway: accepted quote labour is **not** payable (work not done); material bills that are covered or acknowledged **are** payable (answers LLD-009 open question). Partial work → dispute. | — |
| D11 | **Approvals only in the customer app** (account holder of the booking). The on-site contact (LLD-006 `contact_name/phone`) cannot approve; the worker cannot approve on their behalf. The customer gets a push; the worker's app shows "Waiting for customer approval". | SMS/WhatsApp approval later |
| D12 | Worker cannot complete the job (LLD-009 `complete`) while a quote is `SUBMITTED` or a material bill is `PENDING_ACK`. | — |

---

## 2. Classes / components

```text
com.karigar.job.quote
├── api/
│   ├── QuoteController               -- /api/v1/jobs/{id}/quotes, /api/v1/quotes/{id}/**
│   └── MaterialBillController        -- /api/v1/jobs/{id}/material-bills, /api/v1/material-bills/{id}/**
├── application/
│   ├── QuoteService                  -- submit, revise, withdraw, accept, reject, expire
│   ├── MaterialBillService           -- add, acknowledge, reject excess, void, expire
│   ├── QuoteBillingQuery             -- billLines(jobId) for JobBillService (LLD-009); hasPendingPriceChange(jobId)
│   └── port/ MediaAttachments + MediaUrls (LLD-014: attach-once, signed GET), OutboxWriter, AuditWriter
└── domain/
    ├── Quote, QuoteKind, QuoteStatus, QuoteLine, LineType, Unit, SuppliedBy
    ├── QuoteCalculator               -- D5 rounding, totals, D6 bounds
    └── MaterialBill, MaterialBillStatus, MaterialCoverage   -- D8 split covered / excess
```

Timers run inside LLD-009's `JobTimersJob` (same module, already ShedLock + `SKIP LOCKED`): quote expiry and material-bill ack expiry.

```java
// MaterialCoverage — called with the quote row locked (FOR UPDATE)
static Split of(long amount, boolean hasPhoto, Quote quote, long alreadyCovered) {
    if (quote == null || !hasPhoto) return new Split(0, amount);              // all needs acknowledgement
    long remaining = Math.max(0, quote.materialTotalMinor() - alreadyCovered);
    long covered = Math.min(amount, remaining);
    return new Split(covered, amount - covered);
}
// billable = covered + (status == ACKNOWLEDGED ? excess : 0); VOID → 0
```

---

## 3. Data model

Builds on [ERD §41–41.1](../architecture/03-erd-and-production-database-design.md). Changes vs the ERD (ERD to be updated in the same PR): `job_id` is `NOT NULL` for every quote (D1), `DRAFT` removed, `notes` → required `reason` (FR-JOB-002), `idempotency_key` on both tables; `material_bills` links to the **quote** (not a line — one shop receipt usually covers several lines), and gets `worker_id`, `covered_minor` / `excess_minor`, `status`, decision columns. Also adds `payment_allocations.material_bill_id` and the `quote_id` FK that LLD-010 left open.

```sql
-- V8_2__quotes_material.sql  (runs after V8_1 payments, LLD-010)
CREATE TABLE quotes (
    id                    UUID PRIMARY KEY,                       -- UUIDv7, app-generated
    service_request_id    UUID NOT NULL REFERENCES service_requests (id),
    job_id                UUID NOT NULL REFERENCES jobs (id),
    worker_id             UUID NOT NULL REFERENCES workers (id),
    quote_kind            VARCHAR(20) NOT NULL CHECK (quote_kind IN ('INITIAL','REVISION','ADDITIONAL')),
    revision_of_quote_id  UUID REFERENCES quotes (id),
    status                VARCHAR(20) NOT NULL CHECK (status IN
                          ('SUBMITTED','ACCEPTED','REJECTED','EXPIRED','SUPERSEDED','WITHDRAWN')),
    material_supplied_by  VARCHAR(20) NOT NULL CHECK (material_supplied_by IN ('WORKER','CUSTOMER','MIXED','NONE')),
    labour_total_minor    BIGINT NOT NULL DEFAULT 0,
    material_total_minor  BIGINT NOT NULL DEFAULT 0 CHECK (material_total_minor >= 0),  -- worker-supplied only
    other_total_minor     BIGINT NOT NULL DEFAULT 0,             -- helper, visit charge, transport, other, discount
    total_minor           BIGINT NOT NULL CHECK (total_minor BETWEEN 0 AND 20000000),
    currency              CHAR(3) NOT NULL DEFAULT 'INR',
    estimated_days        SMALLINT CHECK (estimated_days BETWEEN 1 AND 180),   -- informational
    reason                VARCHAR(300) NOT NULL,                  -- "Valve inside wall is cracked"
    valid_until           TIMESTAMPTZ NOT NULL,                   -- submitted_at + 24 h (D3)
    submitted_at          TIMESTAMPTZ NOT NULL,
    decided_at            TIMESTAMPTZ,
    decided_by_user_id    UUID REFERENCES users (id),
    reject_reason_code    VARCHAR(40),                            -- TOO_EXPENSIVE | NOT_NEEDED | WILL_ARRANGE_MYSELF | OTHER
    idempotency_key       VARCHAR(100) NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL,
    updated_at            TIMESTAMPTZ NOT NULL,
    version               BIGINT NOT NULL DEFAULT 0,
    CHECK (total_minor = labour_total_minor + material_total_minor + other_total_minor),
    CHECK ((quote_kind = 'REVISION') = (revision_of_quote_id IS NOT NULL)),
    CHECK (quote_kind <> 'INITIAL')                               -- D1: enable with the pre-booking quote LLD
);
CREATE UNIQUE INDEX ux_quotes_one_pending ON quotes (job_id) WHERE status = 'SUBMITTED';
CREATE UNIQUE INDEX ux_quotes_idempotency ON quotes (worker_id, idempotency_key);
CREATE INDEX ix_quotes_job ON quotes (job_id, created_at);
CREATE INDEX ix_quotes_expiry ON quotes (valid_until) WHERE status = 'SUBMITTED';

CREATE TABLE quote_line_items (
    id                UUID PRIMARY KEY,
    quote_id          UUID NOT NULL REFERENCES quotes (id),
    line_no           SMALLINT NOT NULL CHECK (line_no BETWEEN 1 AND 30),
    line_type         VARCHAR(20) NOT NULL CHECK (line_type IN
                      ('LABOUR','MATERIAL','HELPER','VISIT_CHARGE','TRANSPORT','DISCOUNT','OTHER')),
    skill_id          UUID REFERENCES skills (id),
    description       VARCHAR(200) NOT NULL,                      -- "CPVC pipe ¾ inch"
    brand_spec        VARCHAR(100),                               -- "Astral"
    quantity          NUMERIC(10,2) NOT NULL CHECK (quantity > 0 AND quantity <= 9999),
    unit              VARCHAR(20) NOT NULL CHECK (unit IN ('SQ_FT','RUNNING_FT','POINT','PIECE','DAY','BAG','KG',
                      'LITRE','METRE','CFT','TRIP','LUMPSUM')),
    unit_price_minor  BIGINT NOT NULL,
    amount_minor      BIGINT NOT NULL CHECK (amount_minor BETWEEN -10000000 AND 10000000),
    supplied_by       VARCHAR(20) CHECK (supplied_by IN ('WORKER','CUSTOMER')),
    UNIQUE (quote_id, line_no),
    CHECK ((line_type = 'DISCOUNT') = (amount_minor < 0)),
    CHECK ((line_type = 'MATERIAL') = (supplied_by IS NOT NULL)),
    CHECK (supplied_by IS DISTINCT FROM 'CUSTOMER' OR amount_minor = 0)
);

CREATE TABLE material_bills (
    id                    UUID PRIMARY KEY,
    job_id                UUID NOT NULL REFERENCES jobs (id),
    quote_id              UUID REFERENCES quotes (id),            -- an ACCEPTED quote of the same job, or NULL
    worker_id             UUID NOT NULL REFERENCES workers (id),
    vendor_name           VARCHAR(150),                           -- "Maa Tara Hardware, Shibpur"
    bill_no               VARCHAR(50),
    bill_date             DATE NOT NULL,
    amount_minor          BIGINT NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 5000000),
    currency              CHAR(3) NOT NULL DEFAULT 'INR',
    bill_photo_media_id   UUID UNIQUE REFERENCES media_objects (id),   -- purpose MATERIAL_BILL; one receipt, one bill
    covered_minor         BIGINT NOT NULL CHECK (covered_minor >= 0),
    excess_minor          BIGINT NOT NULL CHECK (excess_minor >= 0),
    status                VARCHAR(20) NOT NULL CHECK (status IN
                          ('COVERED','PENDING_ACK','ACKNOWLEDGED','EXCESS_REJECTED','VOID')),
    ack_due_at            TIMESTAMPTZ,                            -- PENDING_ACK only
    decided_at            TIMESTAMPTZ,
    decided_by            VARCHAR(10) CHECK (decided_by IN ('CUSTOMER','SYSTEM','WORKER')),
    uploaded_by_user_id   UUID NOT NULL REFERENCES users (id),
    idempotency_key       VARCHAR(100) NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL,
    updated_at            TIMESTAMPTZ NOT NULL,
    version               BIGINT NOT NULL DEFAULT 0,
    CHECK (covered_minor + excess_minor = amount_minor),
    CHECK (status <> 'COVERED' OR excess_minor = 0),
    CHECK (status NOT IN ('PENDING_ACK','ACKNOWLEDGED','EXCESS_REJECTED') OR excess_minor > 0),
    CHECK (status <> 'PENDING_ACK' OR ack_due_at IS NOT NULL)
);
CREATE UNIQUE INDEX ux_material_bills_idempotency ON material_bills (worker_id, idempotency_key);
CREATE INDEX ix_material_bills_job ON material_bills (job_id, created_at);
CREATE INDEX ix_material_bills_quote ON material_bills (quote_id) WHERE quote_id IS NOT NULL;
CREATE INDEX ix_material_bills_ack_due ON material_bills (ack_due_at) WHERE status = 'PENDING_ACK';

-- LLD-010 left these open
ALTER TABLE payment_allocations
    ADD COLUMN material_bill_id UUID REFERENCES material_bills (id),
    ADD CONSTRAINT fk_payment_allocations_quote FOREIGN KEY (quote_id) REFERENCES quotes (id),
    DROP CONSTRAINT ck_payment_allocations_target,           -- LLD-010 V8_1: exactly one of visit / quote
    ADD CONSTRAINT ck_payment_allocations_target CHECK (num_nonnulls(job_visit_id, quote_id, material_bill_id) = 1);
```

**Billable amounts** (computed, never stored — same as LLD-009 §5.4):

| Bill line | Amount | When it counts |
|---|---|---|
| `QUOTE` | `total_minor − material_total_minor` | quote `ACCEPTED`, job not `CANCELLED`/`FAILED` (D10) |
| `MATERIAL` | `covered_minor + (status = ACKNOWLEDGED ? excess_minor : 0)` | status `COVERED`, `ACKNOWLEDGED` or `EXCESS_REJECTED` (covered part); any job status |

---

## 4. API contract

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/v1/jobs/{id}/quotes` | job's worker | submit `ADDITIONAL` quote → `201` (`Idempotency-Key` required) |
| GET | `/api/v1/jobs/{id}/quotes` | customer / worker | all quotes of the job, newest first, with lines |
| GET | `/api/v1/quotes/{id}` | customer / worker | one quote |
| POST | `/api/v1/quotes/{id}/revise` | worker | same body as submit → `201` new `REVISION`; old → `SUPERSEDED` |
| POST | `/api/v1/quotes/{id}/withdraw` | worker | `SUBMITTED → WITHDRAWN` |
| POST | `/api/v1/quotes/{id}/accept` | customer | `SUBMITTED → ACCEPTED` |
| POST | `/api/v1/quotes/{id}/reject` | customer | `{ "reasonCode": "TOO_EXPENSIVE" }` → `REJECTED` |
| POST | `/api/v1/jobs/{id}/material-bills` | job's worker | add bill (`Idempotency-Key` required) |
| GET | `/api/v1/jobs/{id}/material-bills` | customer / worker | bills with status, covered / excess, photo URL (signed, short-lived) |
| POST | `/api/v1/material-bills/{id}/acknowledge` | customer | `PENDING_ACK → ACKNOWLEDGED` |
| POST | `/api/v1/material-bills/{id}/reject` | customer | `PENDING_ACK → EXCESS_REJECTED` |
| POST | `/api/v1/material-bills/{id}/void` | worker | wrong entry; only while job active and nothing allocated |

Submit (fan repair → capacitor; prices are what the worker types, amounts are computed):

```json
{
  "reason": "Capacitor is weak, fan runs slow",
  "lines": [
    { "lineType": "LABOUR",   "description": "Replace capacitor", "quantity": 1, "unit": "LUMPSUM", "unitPriceMinor": 15000 },
    { "lineType": "MATERIAL", "description": "Capacitor 2.5 µF", "brandSpec": "Havells", "quantity": 1,
      "unit": "PIECE", "unitPriceMinor": 9000, "suppliedBy": "WORKER" }
  ]
}
```

```json
// 201
{
  "data": {
    "quoteId": "0192f5c1-…", "kind": "ADDITIONAL", "status": "SUBMITTED",
    "labourTotalMinor": 15000, "materialTotalMinor": 9000, "otherTotalMinor": 0, "totalMinor": 24000,
    "materialNote": "Material is billed from the shop bill, up to ₹90",
    "validUntil": "2026-10-06T10:15:00Z", "currency": "INR"
  }
}
```

Add material bill:

```json
{ "quoteId": "0192f5c1-…", "amountMinor": 11000, "billDate": "2026-10-05",
  "vendorName": "Maa Tara Hardware, Shibpur", "billNo": "4471", "photoMediaId": "0192f5c3-…" }
```

```json
// 201 — ₹110 against ₹90 quoted: ₹90 billable now, ₹20 waits for the customer
{ "data": { "materialBillId": "…", "status": "PENDING_ACK", "coveredMinor": 9000, "excessMinor": 2000,
            "ackDueAt": "2026-10-06T10:40:00Z", "currency": "INR" } }
```

**Error codes**

| HTTP | `error.code` | When |
|---|---|---|
| 404 | `JOB_NOT_FOUND` / `QUOTE_NOT_FOUND` / `MATERIAL_BILL_NOT_FOUND` | not a party to it |
| 409 | `JOB_STATE_INVALID` | job not `IN_PROGRESS` / `ON_HOLD` (D2) |
| 409 | `QUOTE_PENDING` | another quote is `SUBMITTED` (`ux_quotes_one_pending`) — revise or withdraw it |
| 409 | `QUOTE_NOT_PENDING` | accept / reject / revise / withdraw on a quote that is no longer `SUBMITTED` (incl. superseded while the customer was looking) |
| 409 | `QUOTE_EXPIRED` | `valid_until` passed (timer not yet run) |
| 422 | `QUOTE_INVALID` | `details.field`: empty lines, > 30 lines, bad unit, customer material with a price, total < 0 |
| 422 | `AMOUNT_OUT_OF_BOUNDS` | D6 limits (`details.limitMinor`) |
| 422 | `QUOTE_NOT_ACCEPTED` | material bill linked to a quote that isn't `ACCEPTED` on this job |
| 422 | `INVALID_MEDIA` | `attach` failed: photo not the worker's, not `AVAILABLE`, purpose not `MATERIAL_BILL`, or already used (LLD-014) |
| 422 | `BILL_DATE_INVALID` | outside the D6 window |
| 409 | `MATERIAL_BILL_STATE_INVALID` | ack / reject not `PENDING_ACK`; void after payment or job end |
| 409 | `IDEMPOTENCY_KEY_REUSED` | same key, different body |

---

## 5. Sequence diagrams

### 5.1 Additional work

```mermaid
sequenceDiagram
    participant W as Worker app
    participant C as Customer app
    participant Q as QuoteService
    participant DB as PostgreSQL
    W->>Q: POST /jobs/{id}/quotes (Idempotency-Key)
    Q->>DB: lock job; IN_PROGRESS? worker = job worker?
    Q->>Q: QuoteCalculator (lines, totals, bounds)
    Q->>DB: INSERT quote SUBMITTED + lines (ux_quotes_one_pending); audit; outbox QuoteSubmitted
    DB-->>C: push "Sujit sent a price for extra work" (amount in app, LLD-013 D5)
    C->>Q: POST /quotes/{id}/accept
    Q->>DB: UPDATE … SET status='ACCEPTED' WHERE id=:id AND status='SUBMITTED' AND valid_until > now()
    Q->>DB: outbox QuoteAccepted (→ push to worker)
    Note over C,DB: GET /jobs/{id}/bill now shows QUOTE ₹150 (labour); material appears with the shop bill
```

### 5.2 Material bill above the quote

```mermaid
sequenceDiagram
    participant W as Worker app
    participant C as Customer app
    participant M as MaterialBillService
    participant DB as PostgreSQL
    W->>M: POST /jobs/{id}/material-bills (₹110, photo, quote)
    M->>DB: lock quote FOR UPDATE; Σ covered of earlier bills = 0
    M->>M: MaterialCoverage → covered ₹90, excess ₹20
    M->>DB: INSERT PENDING_ACK, ack_due_at = now + 24 h; outbox MaterialBillAdded
    DB-->>C: push "Sujit added a shop bill above the quote" (amounts in app)
    alt customer acknowledges
        C->>M: acknowledge → ACKNOWLEDGED (bill: ₹110)
    else rejects, or 24 h pass (JobTimersJob)
        M->>DB: EXCESS_REJECTED (bill: ₹90); worker may open a dispute
    end
```

---

## 6. State transitions

**Quote**

| From | Event | By | Guard | To |
|---|---|---|---|---|
| — | submit | worker | job `IN_PROGRESS`/`ON_HOLD`, no other `SUBMITTED` | SUBMITTED |
| SUBMITTED | accept | customer | `now < valid_until`, job `IN_PROGRESS`/`ON_HOLD` | ACCEPTED |
| SUBMITTED | reject | customer | — | REJECTED |
| SUBMITTED | withdraw | worker | — | WITHDRAWN |
| SUBMITTED | revise | worker | job active | SUPERSEDED (new quote `SUBMITTED`, same txn) |
| SUBMITTED | 24 h, or job left `IN_PROGRESS`/`ON_HOLD` | `JobTimersJob` | — | EXPIRED |

`ACCEPTED`, `REJECTED`, `EXPIRED`, `SUPERSEDED`, `WITHDRAWN` are final. A job that is cancelled or fails with a quote pending can't accept it (guard), and the timer expires it.

Outbox events (LLD-013 notifications, LLD-021 realtime): submit / revise → `QuoteSubmitted`; accept → `QuoteAccepted`; reject / expire → `QuoteRejected { reason: REJECTED | EXPIRED }`. Material bill add → `MaterialBillAdded { status }` (customer is asked to acknowledge only when `PENDING_ACK`).

**Material bill**

| From | Event | By | Guard | To |
|---|---|---|---|---|
| — | add, `excess = 0` | worker | job `IN_PROGRESS`/`ON_HOLD`, D6 | COVERED |
| — | add, `excess > 0` | worker | same | PENDING_ACK |
| PENDING_ACK | acknowledge | customer | — | ACKNOWLEDGED |
| PENDING_ACK | reject / `ack_due_at` passed | customer / timer | — | EXCESS_REJECTED |
| COVERED / PENDING_ACK / ACKNOWLEDGED | void | worker | job active, no `payment_allocations` row | VOID |

Voiding a `COVERED` bill gives its allowance back (allowance is recomputed from non-void bills).

---

## 7. Error handling, idempotency & concurrency

- **Idempotent creates:** `(worker_id, idempotency_key)` unique on quotes and material bills; a retry with the same key and body returns the first result (`201` → `200`), a different body → `IDEMPOTENCY_KEY_REUSED`.
- **One pending quote:** `ux_quotes_one_pending`; a parallel second submit → `QUOTE_PENDING`. Revise does `UPDATE old SET status='SUPERSEDED' WHERE status='SUBMITTED'` then inserts the new one in one transaction.
- **Accept vs revise / withdraw / expire:** all are guarded updates `WHERE id = :id AND status = 'SUBMITTED'`; exactly one wins. A customer who accepts a quote that was just superseded gets `QUOTE_NOT_PENDING` and the app reloads the new one — they never accept an amount they didn't see (the accepted id is the one they viewed).
- **Repeating a decision** (double tap, flaky network) returns `200` with the current state when it is the same outcome.
- **Allowance race:** two bills for the same quote lock the quote row (`SELECT … FOR UPDATE`) before computing `Σ covered`; lock order job → quote → bill, same as LLD-009 (booking → job → visit).
- **Completion guard (D12):** `JobCompletionService` calls `QuoteBillingQuery.hasPendingPriceChange(jobId)` inside its transaction after locking the job; quote / bill creation lock the job too, so nothing slips in between.
- **Timers** re-check status inside their transaction (`FOR UPDATE SKIP LOCKED`), so two instances act once.
- **Bill after payment:** money already allocated to a quote or bill stays allocated; later acknowledged excess shows as new due (LLD-010 §8 rule).

---

## 8. Security & privacy

- Only the job's worker creates / revises / withdraws quotes and adds / voids bills; only the booking's customer accepts / rejects / acknowledges. Anyone else → `404`. Admin read via `booking.view` (LLD-020 §4.1); admins never accept on a customer's behalf.
- **Never a silent price change:** amounts are immutable after insert (no update endpoint; JPA entities have no setters for amounts); every increase needs a customer action in the app; non-response never accepts (D3, D8).
- Amounts computed server-side (D5); the worker sends quantity and unit price only. Bounds (D6) stop typos like ₹15,000 for ₹150 from reaching the customer.
- Receipt photo is attached with `MediaAttachments.attach(ids, worker, {MATERIAL_BILL}, "material_bill:{id}")` in the add transaction (owner, `AVAILABLE`, purpose checked by LLD-014); `bill_photo_media_id` is unique so one receipt can't be billed twice. Photos are private objects; signed URLs for the job's customer, worker and dispute agents only.
- Commission: material is billed only from receipts (D7), so labelling labour as material to avoid the fee doesn't pay. Ops sees `material_excess_ratio` (below).
- Every status change writes `audit_events` (actor, from → to). `reason`, `description`, vendor names are not logged.

---

## 9. Observability

| Type | Name | Notes |
|---|---|---|
| Counter | `quote_total{result}` | accepted, rejected, expired, withdrawn, superseded |
| Histogram | `quote_decision_minutes` | submit → decision |
| Histogram | `quote_total_rupees{trade}` | spot outliers |
| Counter | `material_bill_total{status}` | covered, pending_ack, acknowledged, excess_rejected, void |
| Gauge | `material_excess_ratio` | Σ excess / Σ amount, last 7 days |
| Counter | `job_completion_blocked_total{reason}` | quote_pending, bill_pending |

Alerts: expired share of quotes > 30 % in a week (customers not seeing pushes — check LLD-013); one worker with > 3 `EXCESS_REJECTED` in 30 days (ops review); quote rejection > 50 % for a trade (pricing guidance).

---

## 10. Test plan

| Level | Cases |
|---|---|
| Unit | `QuoteCalculator`: 20 × ₹45 = ₹900; 2.5 × ₹33.33 half-up; discount makes total < 0 → invalid; customer material with price → invalid; bounds at limit / limit + 1. `MaterialCoverage`: under / exactly / above allowance; no photo → all excess; no quote → all excess; second bill uses remaining allowance |
| Integration (Testcontainers) | submit → accept → bill shows `QUOTE` = labour part; submit → reject → bill unchanged; revise → old `SUPERSEDED`, new `SUBMITTED`; second submit → `QUOTE_PENDING`; submit on `SCHEDULED` / `COMPLETED` job → `JOB_STATE_INVALID` |
| Material | ₹110 vs ₹90 → covered 90 / excess 20; acknowledge → bill ₹110; reject → ₹90; 24 h → `EXCESS_REJECTED`; same photo twice → `INVALID_MEDIA`; void after allocation → 409 |
| Bill / payment (with LLD-010) | allocation to quote, visit and material bill; `num_nonnulls` check rejects two targets; earning `material_reimbursement` = Σ material allocations, no commission on it |
| Cancel / fail (D10) | job `FAILED` after material covered → bill has `MATERIAL`, no `QUOTE`; pending quote can't be accepted, expires |
| Concurrency | accept vs revise in parallel → one wins; two bills on one quote in parallel → covered never exceeds allowance; complete vs new quote → one wins |
| Timers | expiry runs once with two instances |
| Security | other worker / other customer → 404; customer can't create, worker can't accept |
| Architecture (ArchUnit) | `job.quote` writes only quote / material tables; `payment` reads bill lines through `JobBillService`, not quote tables |

---

## 11. Open questions

| Question | Default until decided | Owner | Due |
|---|---|---|---|
| Approval by the on-site contact (SMS link / OTP) when the customer is away | Customer app only (D11) | Product | With SMS phase |
| Pre-booking competing quotes (`INITIAL`) and rate re-snapshot to `QUOTE` | Not in MVP (D1) | Product | Phase 2 |
| Reducing an accepted quote (customer drops part of the scope) | Not supported; ops adjustment / dispute | Product | Pilot review |
| Material advance before purchase for big jobs | Pay the accepted quote early, or customer buys material (D9) | Product | Pilot review |
| GST treatment of material reimbursement | Pass-through, no fee, no GST on it (LLD-010) | CA | Before launch |
| Expiry windows (quote 24 h, ack 24 h) | 24 h each | Product | Pilot review |

---

## Change log

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-05 | TBD | First draft |
| 0.2 | 2026-10-05 | TBD | Cross-LLD consistency |
