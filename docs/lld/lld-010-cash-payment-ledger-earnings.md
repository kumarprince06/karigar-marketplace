# LLD-010: Cash Payment, Ledger and Worker Earnings

| Field | Value |
|---|---|
| Status | Draft |
| Owner | TBD |
| Reviewers | TBD |
| Module | `payment` (ledger, earnings, cash) |
| Parent HLD | [modules/06](../modules/06-payments-refunds-settlement-and-ledger.md), [architecture/03 §42–46.3](../architecture/03-erd-and-production-database-design.md), [modules/03](../modules/03-pricing-quotation-and-money-flow.md), [ADR 0006](../adr/0006-money-integer-minor-units.md), [ADR 0007](../adr/0007-payment-provider-abstraction.md) |
| Requirements | FR-PAY-001 (cash and online), FR-PAY-003 (earnings), BR money rules |
| Depends on | LLD-009 (bill, `JobCompleted`, `BookingCancelled`, `VisitNoShow`, `JobFailed`, `VisitConfirmed`), LLD-007 (`account_restrictions`), LLD-018 (`DisputeOpened`, `DisputeResolved`) |
| Used by | LLD-011 (online payments post through the same ledger), LLD-017 (allocations to quotes / material bills), LLD-018 (`CashDisputeHooks`), LLD-019 (payouts, dues: P8, P10), LLD-020 (ops queue, admin finance views) |
| Last updated | 2026-10-05 |

---

## 1. Context & scope

Most local jobs are paid in **cash**: the worker takes the money and the platform never touches it. The platform still has to know that the job was paid, take its commission, and know how much each worker owes it or is owed. Online payments (LLD-011) and cash share one **double-entry ledger** and one **earnings** model, both defined here.

**In scope**

- Ledger: accounts, posting service, balance invariant, append-only rule, posting rules for every money event (including the ones LLD-011 triggers)
- Worker earnings: commission + tax split per payment, status, worker balance
- Cash payment: worker marks it received, customer confirms or disputes, auto-confirm
- Applying the booking advance to the bill, to a cancellation / no-show fee, or to a cancelled / failed job's fee + material due (before the rest is refunded)
- Worker dues limit: too much fee owed from cash jobs blocks new offers
- Manual finance adjustments; nightly ledger reconciliation

**Out of scope:** provider checkout, webhooks and refunds (LLD-011), payouts to bank and dues payment by UPI ([LLD-019](lld-019-worker-payouts.md)), GST invoices (invoice LLD), disputes workflow ([LLD-018](lld-018-disputes.md)), quotes and material bills ([LLD-017](lld-017-quotes-additional-work-material.md)).

**Decisions**

| # | Decision | Default (configurable) |
|---|---|---|
| D1 | Commission is taken **from the worker's gross** (no customer-side fee in MVP); `fee_rate_bps` per trade from config, snapshotted on each earning. | 1000 bps (10 %) |
| D2 | Taxes come from `tax_rates` (effective-dated rows). GST on the platform fee applies from launch; TDS 194-O and TCS s.52 rows are **not loaded** until a CA confirms them, so they compute to 0. No tax is computed on cash jobs except GST on the fee. | GST 1800 bps (illustrative) |
| D3 | **Cash** is allowed for every amount except the booking advance (always online, LLD-006 D6). The worker marks "cash received" for the amount the backend says is due; the customer confirms in the app. | — |
| D4 | No customer response → cash auto-confirms **24 h** after the worker marked it (same window as visit confirmation, LLD-009 D4). "I didn't pay that" → the customer opens a dispute (`POST /api/v1/disputes {subjectType: PAYMENT, category: CASH_NOT_PAID}`, [LLD-018](lld-018-disputes.md)), which calls `CashDisputeHooks.markDisputed` → payment `DISPUTED`; no ledger entries until resolved. | 24 h |
| D5 | Ledger postings happen **in the same DB transaction** as the payment / earning change that causes them. Events from other modules (`JobCompleted` …) are consumed idempotently (`processed_events` + the ledger `idempotency_key`). | [ADR 0005](../adr/0005-async-events-and-transactional-outbox.md) |
| D6 | Balances are **computed from `ledger_entries`**, never stored. The `ix_ledger_entries_account` index keeps a worker's balance query to one index range scan. | Revisit if one account passes ~100 k entries. |
| D7 | **Dues limit:** if a worker owes the platform more than the limit (cash-job fees), a `NO_NEW_OFFERS` restriction (source `DUES`) is added; it is lifted automatically when the balance is back within the limit. | ₹1,000 |
| D8 | The advance is income only when it is **applied** (to the bill or a fee). Until then it sits in `CUSTOMER_ADVANCES`; unused advance is refunded by LLD-011. | — |
| D9 | Earnings for job payments become `ELIGIBLE` (for payout) when the job is `COMPLETED`; daily-wage payments on `VisitConfirmed`. An open dispute on the job puts its earnings `ON_HOLD` (on `DisputeOpened`); they go back on `DisputeResolved` (LLD-018). | — |

---

## 2. Classes / components

```text
com.karigar.payment
├── api/
│   ├── CashPaymentController          -- /api/v1/jobs/{id}/payments/cash, /api/v1/payments/{id}/confirm-cash
│   ├── JobPaymentsController          -- GET /api/v1/jobs/{id}/payments
│   ├── WorkerEarningsController       -- /api/v1/worker/earnings/**
│   └── AdminLedgerController          -- /api/v1/admin/ledger/** (finance.adjust)
├── application/
│   ├── CashPaymentService             -- mark / confirm; CashAutoConfirmJob (every 5 min, SKIP LOCKED, skips DISPUTED)
│   ├── CashDisputeHooks               -- public API for LLD-018: markDisputed(paymentId), resolvePaid(paymentId), resolveNotPaid(paymentId)
│   ├── CashDisputedQueue              -- implements OpsQueueSource CASH_DISPUTED (LLD-020)
│   ├── EarningsService                -- earning per succeeded payment; status on JobCompleted / VisitConfirmed /
│   │                                     DisputeOpened (ON_HOLD) / DisputeResolved (back)
│   ├── AdvanceApplicationService      -- consumes JobCompleted, BookingCancelled, VisitNoShow, JobFailed
│   ├── DuesRestrictionService         -- after any WORKER_PAYABLE posting: add / lift NO_NEW_OFFERS (DUES)
│   ├── LedgerReconciliationJob        -- nightly, ShedLock
│   └── port/ JobBillLookup (LLD-009 bill), RefundRequester (LLD-011), RestrictionWriter (trust), OutboxWriter
│   (events, outbox: CashPaymentMarked, CashPaymentConfirmed {auto}, CashPaymentDisputed,
│    DuesRestrictionChanged {added|lifted} — ids + aggregateVersion + amounts only, LLD-022 D8)
├── domain/
│   ├── Money                          -- long minor + "INR"; add/subtract with Math.addExact; percent(bps) half-up
│   ├── Payment, PaymentStatus, PaymentPurpose, CollectedBy
│   ├── EarningSplit                   -- gross → fee, gst, tds, tcs, net (below)
│   └── CommissionPolicy               -- fee_rate_bps per trade (config)
└── ledger/                            -- public API of the ledger inside the payment module
    ├── LedgerPostingService           -- post(LedgerTxn): validate Dr = Cr, idempotent on key
    ├── PostingRules                   -- builds every txn in §4 (one method per row)
    ├── LedgerAccounts                 -- get-or-create (account_type, owner_id)
    └── LedgerBalanceQuery             -- workerBalance(workerId), accountBalance(type)
```

```java
// EarningSplit — every amount rounded half-up to whole paise (ERD §42)
// material = Σ payment_allocations.amount_minor with material_bill_id set (LLD-017), passed through without commission
public static EarningSplit of(Money gross, int feeBps, TaxRates rates, CollectedBy by, Money material) {
    Money commissionable = gross.minus(material);                 // material is passed through, no commission
    Money fee = commissionable.percent(feeBps);
    Money gst = fee.percent(rates.bps(GST_PLATFORM_FEE));
    Money tds = by == PLATFORM ? commissionable.percent(rates.bps(TDS_194O)) : Money.zero();  // 0 until loaded (D2)
    Money tcs = by == PLATFORM ? commissionable.percent(rates.bps(TCS_GST_S52)) : Money.zero();
    Money net = gross.minus(fee).minus(gst).minus(tds).minus(tcs);
    Money retained = by == WORKER ? gross : Money.zero();          // cash already in the worker's hand
    return new EarningSplit(gross, fee, gst, tds, tcs, material, net, retained);
}
// what the platform owes the worker for this payment = net − retained (negative for cash: the worker owes fee + GST)
```

---

## 3. Data model

Builds on [ERD §43–46.3](../architecture/03-erd-and-production-database-design.md). This LLD adds: `payments.status` `DISPUTED`, `payments.cash_disputed_at`, `worker_earnings.cash_retained_minor` (fixes the ERD text that called `net_minor` negative for cash — `net_minor` keeps its CHECK and the owed amount is `net − cash_retained`), ledger `txn_type` `ADVANCE_RECEIVED | ADVANCE_APPLIED | ADVANCE_REFUNDED | CASH_DISPUTE_REVERSAL`, restriction source `DUES`, and the balance trigger. ERD to be updated in the same PR.

```sql
-- V8_1__payments_ledger.sql  (runs after V7_1; LLD-006's advance FK is added here)
CREATE TABLE payments (
    id                         UUID PRIMARY KEY,
    job_id                     UUID REFERENCES jobs (id),
    service_request_id         UUID REFERENCES service_requests (id),
    customer_id                UUID NOT NULL REFERENCES customers (id),
    worker_id                  UUID REFERENCES workers (id),
    purpose                    VARCHAR(20) NOT NULL CHECK (purpose IN
                               ('BOOKING_ADVANCE','VISIT_CHARGE','MATERIAL_ADVANCE','DAILY_WAGE','MILESTONE','FINAL','ADDITIONAL')),
                                                           -- MATERIAL_ADVANCE unused in MVP (LLD-017 D9); WORKER_DUES added by LLD-019
    method                     VARCHAR(20) NOT NULL CHECK (method IN ('UPI','CARD','NETBANKING','WALLET','CASH')),
    collected_by               VARCHAR(20) NOT NULL CHECK (collected_by IN ('PLATFORM','WORKER')),
    amount_minor               BIGINT NOT NULL CHECK (amount_minor > 0),
    currency                   CHAR(3) NOT NULL DEFAULT 'INR',
    status                     VARCHAR(20) NOT NULL CHECK (status IN ('CREATED','PENDING','SUCCEEDED','FAILED','CANCELLED','DISPUTED')),
    provider                   VARCHAR(30),
    provider_order_id          VARCHAR(100),
    provider_payment_id        VARCHAR(100),
    payer_vpa_masked           VARCHAR(100),
    failure_code               VARCHAR(50),
    idempotency_key            VARCHAR(100) NOT NULL,
    cash_marked_by_worker_at   TIMESTAMPTZ,
    cash_confirmed_by_customer_at TIMESTAMPTZ,
    cash_disputed_at           TIMESTAMPTZ,
    paid_at                    TIMESTAMPTZ,
    created_at                 TIMESTAMPTZ NOT NULL,
    updated_at                 TIMESTAMPTZ NOT NULL,
    version                    BIGINT NOT NULL DEFAULT 0,
    CHECK ((method = 'CASH') = (collected_by = 'WORKER')),
    CONSTRAINT ck_payments_job_or_advance                 -- replaced by name in LLD-019 (WORKER_DUES)
        CHECK (job_id IS NOT NULL OR (purpose = 'BOOKING_ADVANCE' AND service_request_id IS NOT NULL)),
    CHECK (purpose <> 'BOOKING_ADVANCE' OR method <> 'CASH'),
    CHECK (method <> 'CASH' OR provider IS NULL)
);
CREATE UNIQUE INDEX ux_payments_provider_payment ON payments (provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE UNIQUE INDEX ux_payments_idempotency ON payments (customer_id, idempotency_key);
CREATE UNIQUE INDEX ux_payments_one_open_cash ON payments (job_id) WHERE method = 'CASH' AND status IN ('PENDING','DISPUTED');
CREATE INDEX ix_payments_job ON payments (job_id, created_at);
CREATE INDEX ix_payments_cash_due ON payments (cash_marked_by_worker_at) WHERE method = 'CASH' AND status = 'PENDING';

ALTER TABLE service_requests ADD CONSTRAINT fk_service_requests_advance_payment
    FOREIGN KEY (advance_payment_id) REFERENCES payments (id);

CREATE TABLE payment_allocations (
    payment_id    UUID NOT NULL REFERENCES payments (id),
    job_visit_id  UUID REFERENCES job_visits (id),
    quote_id      UUID,                                   -- FK added by LLD-017 V8_2
    amount_minor  BIGINT NOT NULL CHECK (amount_minor > 0),
    CONSTRAINT ck_payment_allocations_target              -- replaced by name in LLD-017 V8_2 (+ material_bill_id)
        CHECK ((job_visit_id IS NULL) <> (quote_id IS NULL))
);
CREATE INDEX ix_payment_allocations_payment ON payment_allocations (payment_id);

CREATE TABLE tax_rates (
    tax_code        VARCHAR(30) NOT NULL CHECK (tax_code IN ('GST_PLATFORM_FEE','TDS_194O','TDS_194O_NO_PAN','TCS_GST_S52')),
    rate_bps        INTEGER NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
    effective_from  DATE NOT NULL,
    effective_to    DATE,
    PRIMARY KEY (tax_code, effective_from)
);

CREATE TABLE worker_earnings (
    id                           UUID PRIMARY KEY,
    worker_id                    UUID NOT NULL REFERENCES workers (id),
    job_id                       UUID NOT NULL REFERENCES jobs (id),
    payment_id                   UUID NOT NULL UNIQUE REFERENCES payments (id),
    applied_minor                BIGINT,               -- advance only: part of the advance applied (rest refunded)
    gross_minor                  BIGINT NOT NULL CHECK (gross_minor >= 0),
    platform_fee_minor           BIGINT NOT NULL CHECK (platform_fee_minor >= 0),
    gst_on_fee_minor             BIGINT NOT NULL CHECK (gst_on_fee_minor >= 0),
    tds_minor                    BIGINT NOT NULL DEFAULT 0,
    tcs_minor                    BIGINT NOT NULL DEFAULT 0,
    material_reimbursement_minor BIGINT NOT NULL DEFAULT 0,
    cash_retained_minor          BIGINT NOT NULL DEFAULT 0,
    net_minor                    BIGINT NOT NULL,
    fee_rate_bps                 INTEGER NOT NULL,
    status                       VARCHAR(20) NOT NULL CHECK (status IN ('PENDING','ELIGIBLE','ON_HOLD','PAID_OUT','REVERSED')),
    eligible_at                  TIMESTAMPTZ,
    created_at                   TIMESTAMPTZ NOT NULL,
    updated_at                   TIMESTAMPTZ NOT NULL,
    CHECK (net_minor = gross_minor - platform_fee_minor - gst_on_fee_minor - tds_minor - tcs_minor)
);
CREATE INDEX ix_worker_earnings_worker ON worker_earnings (worker_id, created_at DESC);

CREATE TABLE ledger_accounts (
    id            UUID PRIMARY KEY,
    account_type  VARCHAR(30) NOT NULL CHECK (account_type IN
                  ('GATEWAY_CLEARING','WORKER_PAYABLE','PLATFORM_FEE_REVENUE','GST_PAYABLE','TDS_PAYABLE','TCS_PAYABLE',
                   'GATEWAY_FEE_EXPENSE','CASH_WITH_WORKER','REFUNDS_PAYABLE','CUSTOMER_ADVANCES')),
    owner_id      UUID,                                   -- worker id for WORKER_PAYABLE / CASH_WITH_WORKER
    currency      CHAR(3) NOT NULL DEFAULT 'INR',
    CHECK ((account_type IN ('WORKER_PAYABLE','CASH_WITH_WORKER')) = (owner_id IS NOT NULL))
);
CREATE UNIQUE INDEX ux_ledger_accounts ON ledger_accounts (account_type, COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'));

CREATE TABLE ledger_transactions (
    id               UUID PRIMARY KEY,
    txn_type         VARCHAR(30) NOT NULL CHECK (txn_type IN
                     ('PAYMENT_SUCCEEDED','CASH_COLLECTED','CASH_DISPUTE_REVERSAL','ADVANCE_RECEIVED','ADVANCE_APPLIED',
                      'ADVANCE_REFUNDED','REFUND','PAYOUT','GATEWAY_FEE','ADJUSTMENT')),
    reference_type   VARCHAR(30) NOT NULL CHECK (reference_type IN ('PAYMENT','REFUND','PAYOUT','EARNING','ADJUSTMENT')),
    reference_id     UUID NOT NULL,
    idempotency_key  VARCHAR(100) NOT NULL UNIQUE,        -- e.g. "CASH_COLLECTED:{paymentId}"
    description      VARCHAR(200),
    created_by       UUID,                                -- admin id for ADJUSTMENT, else NULL (system)
    occurred_at      TIMESTAMPTZ NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_ledger_txn_reference ON ledger_transactions (reference_type, reference_id);

CREATE TABLE ledger_entries (
    id                     UUID PRIMARY KEY,
    ledger_transaction_id  UUID NOT NULL REFERENCES ledger_transactions (id),
    account_id             UUID NOT NULL REFERENCES ledger_accounts (id),
    direction              CHAR(1) NOT NULL CHECK (direction IN ('D','C')),
    amount_minor           BIGINT NOT NULL CHECK (amount_minor > 0)
);
CREATE INDEX ix_ledger_entries_txn ON ledger_entries (ledger_transaction_id);
CREATE INDEX ix_ledger_entries_account ON ledger_entries (account_id) INCLUDE (direction, amount_minor);

-- Dr = Cr per transaction, checked at commit
CREATE FUNCTION ledger_txn_balanced() RETURNS trigger AS $$
BEGIN
    IF (SELECT COALESCE(SUM(CASE direction WHEN 'D' THEN amount_minor ELSE -amount_minor END), 0)
          FROM ledger_entries WHERE ledger_transaction_id = NEW.ledger_transaction_id) <> 0 THEN
        RAISE EXCEPTION 'ledger transaction % is unbalanced', NEW.ledger_transaction_id;
    END IF;
    RETURN NULL;
END $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER trg_ledger_balanced AFTER INSERT ON ledger_entries
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ledger_txn_balanced();

-- append-only
CREATE FUNCTION ledger_no_change() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'ledger rows are append-only'; END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_ledger_entries_ro BEFORE UPDATE OR DELETE ON ledger_entries FOR EACH ROW EXECUTE FUNCTION ledger_no_change();
CREATE TRIGGER trg_ledger_txn_ro     BEFORE UPDATE OR DELETE ON ledger_transactions FOR EACH ROW EXECUTE FUNCTION ledger_no_change();

ALTER TABLE account_restrictions DROP CONSTRAINT account_restrictions_source_check,
    ADD CONSTRAINT account_restrictions_source_check CHECK (source IN ('STRIKES','FRAUD','ADMIN','DUES'));
```

LLD-006 `V5_1` declares `advance_payment_id UUID` **without** the inline `REFERENCES payments` (the table doesn't exist yet); the FK is added above.

Later migrations change these tables by constraint name: [LLD-017](lld-017-quotes-additional-work-material.md) `V8_2` adds the `quote_id` FK, `payment_allocations.material_bill_id` and replaces `ck_payment_allocations_target` with a three-way check (exactly one of visit / quote / material bill); [LLD-019](lld-019-worker-payouts.md) replaces `ck_payments_job_or_advance` for `WORKER_DUES` and adds the `PAYOUT_REVERSAL` / `DUES_RECEIVED` txn types. A payment therefore allocates to **visits, quotes or material bills**.

---

## 4. Posting rules

`G` gross, `F` platform fee, `T` GST on fee, `D` TDS, `X` TCS, `N = G − F − T − D − X`, `W` = that worker's account. Every row is one ledger transaction; the idempotency key is `{txn_type}:{reference_id}`.

| # | When | Posted by | Debit | Credit |
|---|---|---|---|---|
| P1 | Advance succeeded (verified webhook) | LLD-011 | GATEWAY_CLEARING `A` | CUSTOMER_ADVANCES `A` |
| P2 | Advance **applied** — job completed (`min(A, bill total)`), or cancellation / no-show fee, or cancelled / failed job's fee + material due (LLD-009 §8, LLD-017 D10) | this LLD | CUSTOMER_ADVANCES `G` | PLATFORM_FEE_REVENUE `F`, GST_PAYABLE `T`, TDS_PAYABLE `D`, TCS_PAYABLE `X`, WORKER_PAYABLE(W) `N` |
| P3 | Advance refunded (refund succeeded) | LLD-011 | CUSTOMER_ADVANCES `r` | GATEWAY_CLEARING `r` |
| P4 | Online payment succeeded (non-advance) | LLD-011 | GATEWAY_CLEARING `G` | as P2 |
| P5 | Cash confirmed | this LLD | CASH_WITH_WORKER(W) `G`; WORKER_PAYABLE(W) `G` | WORKER_PAYABLE(W) `N`, PLATFORM_FEE_REVENUE `F`, GST_PAYABLE `T`; CASH_WITH_WORKER(W) `G` |
| P6 | Cash dispute resolved "not paid" after it had auto-confirmed | LLD-018 → `CashDisputeHooks.resolveNotPaid` | exact reverse of P5 (`CASH_DISPUTE_REVERSAL`) | |
| P7 | Gateway fee (MDR) reported | LLD-011 | GATEWAY_FEE_EXPENSE | GATEWAY_CLEARING |
| P8 | Payout created (reverse on payout `FAILED` / `REVERSED`, `PAYOUT_REVERSAL`) | [LLD-019](lld-019-worker-payouts.md) | WORKER_PAYABLE(W) `p` | GATEWAY_CLEARING `p` |
| P9 | Manual correction | admin (`finance.adjust`) | any balanced pair, reason required | |
| P10 | Worker dues received (`WORKER_DUES` payment succeeded, `DUES_RECEIVED`) | [LLD-019](lld-019-worker-payouts.md) via LLD-011 | GATEWAY_CLEARING `d` | WORKER_PAYABLE(W) `d` |

P5 example — ₹1,000 cash, 10 % fee, 18 % GST: CASH_WITH_WORKER Dr 1,000 / WORKER_PAYABLE Cr 882 / FEE Cr 100 / GST Cr 18, then the clearing pair WORKER_PAYABLE Dr 1,000 / CASH_WITH_WORKER Cr 1,000. Net: the worker's account shows **₹118 owed**, and `CASH_WITH_WORKER` keeps the gross cash visible in reports. (Same as [modules/06 §37](../modules/06-payments-refunds-settlement-and-ledger.md).)

**Worker balance** = Σ credits − Σ debits on `WORKER_PAYABLE(W)`: positive = platform owes the worker (online jobs), negative = worker owes the platform (cash fees).

---

## 5. API contract

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/v1/jobs/{id}/payments/cash` | worker | "Customer paid me cash" for what is due now → `201` payment `PENDING` (`Idempotency-Key` required) |
| POST | `/api/v1/payments/{id}/confirm-cash` | customer | → `SUCCEEDED`, P5 posted |
| GET | `/api/v1/jobs/{id}/payments` | both | payments of the job with status (no provider ids) |
| GET | `/api/v1/worker/earnings/summary` | worker | balance, pending, eligible, dues limit, restricted |
| GET | `/api/v1/worker/earnings?cursor=` | worker | earnings rows, newest first, max 50 per page |
| POST | `/api/v1/admin/ledger/adjustments` | admin `finance.adjust` | `{ workerId, amountMinor, direction, reasonCode, note }` → P9 |
| GET | `/api/v1/admin/ledger/accounts/{type}?ownerId=` | admin `finance.view` | balance + entries (cursor) |

"I didn't pay this" is not an endpoint here: the customer opens a dispute with `POST /api/v1/disputes {subjectType: PAYMENT, category: CASH_NOT_PAID}` ([LLD-018](lld-018-disputes.md)), which calls `CashDisputeHooks.markDisputed`.

Worker marks cash — no amount in the body; the backend takes `dueMinor` from the bill (LLD-009 §5.4) and allocates it to the confirmed visits / accepted quotes / material bills it covers. A remaining due is still payable on a `CANCELLED` or `FAILED` job (e.g. material bills, LLD-017 D10):

```json
// 201
{
  "data": {
    "paymentId": "…", "purpose": "FINAL", "method": "CASH", "status": "PENDING",
    "amountMinor": 195100, "currency": "INR",
    "autoConfirmAt": "2026-10-06T12:30:00Z"
  }
}
```

Earnings summary (Sujit does mostly cash jobs):

```json
{
  "data": {
    "balanceMinor": -35400,          // he owes ₹354 in fees
    "pendingMinor": 88100,           // online earnings waiting for job completion
    "eligibleMinor": 0,
    "duesLimitMinor": 100000,
    "restricted": false,
    "currency": "INR"
  }
}
```

**Error codes**

| HTTP | `error.code` | When |
|---|---|---|
| 404 | `JOB_NOT_FOUND` / `PAYMENT_NOT_FOUND` | not a party to it |
| 409 | `NOTHING_DUE` | bill `dueMinor` = 0 |
| 409 | `CASH_ALREADY_PENDING` | an open cash payment exists for the job (`ux_payments_one_open_cash`) |
| 409 | `PAYMENT_STATE_INVALID` | confirm when not `PENDING` |
| 409 | `IDEMPOTENCY_KEY_REUSED` | same key, different request |
| 422 | `ADJUSTMENT_REASON_REQUIRED` | admin adjustment without reason |

---

## 6. Sequence diagrams

### 6.1 Cash at completion

```mermaid
sequenceDiagram
    participant W as Worker app
    participant C as Customer app
    participant J as JobCompletionService (LLD-009)
    participant A as AdvanceApplicationService
    participant P as CashPaymentService
    participant L as LedgerPostingService
    participant DB as PostgreSQL
    J->>DB: job COMPLETED; outbox JobCompleted(bill)
    DB-->>A: JobCompleted (outbox poller)
    A->>DB: earning for advance payment (gross = min(advance, total)); P2; processed_events
    W->>P: POST /jobs/{id}/payments/cash (Idempotency-Key)
    P->>DB: bill due ₹1,951 → payment CASH PENDING + allocations; outbox CashPaymentMarked → push customer "Confirm the cash payment for your job" (amount only in the app)
    C->>P: confirm-cash
    P->>DB: lock payment; PENDING → SUCCEEDED
    P->>L: earning (split, cash_retained = gross) + P5
    L->>DB: entries; trigger checks Dr = Cr at commit; outbox CashPaymentConfirmed {auto: false}
    P->>P: DuesRestrictionService: balance < −₹1,000? add NO_NEW_OFFERS (DUES); outbox DuesRestrictionChanged {added}
```

### 6.2 Customer cancels late — fee from the advance

```mermaid
sequenceDiagram
    participant B as BookingCancellationService (LLD-009)
    participant A as AdvanceApplicationService
    participant R as RefundRequester (LLD-011)
    participant DB as PostgreSQL
    B->>DB: booking CANCELLED; outbox BookingCancelled(advance ₹199, fee ₹100, refund ₹99)
    DB-->>A: BookingCancelled
    A->>DB: earning(gross = fee + materialDueMinor, material allocations excluded from commission) + P2 (ADVANCE_APPLIED)
    A->>R: refund(advance − fee − materialDue) if > 0, key "ADV_REFUND:{requestId}"
```

---

## 7. State transitions

**Cash payment**

| From | Event | By | To | Ledger |
|---|---|---|---|---|
| — | worker marks cash received | worker | PENDING | — |
| PENDING | customer confirms | customer | SUCCEEDED | earning + P5 |
| PENDING | 24 h, no response | `CashAutoConfirmJob` | SUCCEEDED | earning + P5 (`CashPaymentConfirmed {auto: true}`) |
| PENDING | customer opens a `CASH_NOT_PAID` dispute | LLD-018 → `CashDisputeHooks.markDisputed` | DISPUTED | — (`CashPaymentDisputed`) |
| DISPUTED | dispute resolved "paid" | LLD-018 → `resolvePaid` | SUCCEEDED | earning + P5 |
| DISPUTED | dispute resolved "not paid" | LLD-018 → `resolveNotPaid` | CANCELLED | — (amount is due again) |
| SUCCEEDED (auto) | later dispute resolved "not paid" | LLD-018 → `resolveNotPaid` | CANCELLED | P6 reversal, earning `REVERSED` |

**Earning:** `PENDING → ELIGIBLE` (job `COMPLETED`, or `VisitConfirmed` for daily wages) · `ELIGIBLE / PENDING → ON_HOLD` (`DisputeOpened` on the job, LLD-018) · `ON_HOLD → ELIGIBLE` (`DisputeResolved`) · `ELIGIBLE → PAID_OUT` (payout created, LLD-019) · `PAID_OUT → ELIGIBLE` (payout `FAILED` / `REVERSED`, LLD-019) · `→ REVERSED` (P6, or a full refund in LLD-011). Cash earnings are created `ELIGIBLE` — what they create is a debt, not a payout.

---

## 8. Error handling, idempotency & concurrency

- **Posting is idempotent:** `ledger_transactions.idempotency_key` is unique; a second post with the same key returns the first transaction. Event consumers also record `processed_events`.
- **Balance invariant** is enforced by the deferred trigger, so no code path can commit an unbalanced transaction; the service validates first to give a clear error.
- **Confirm vs auto-confirm vs dispute:** each is a guarded update `… WHERE id = :id AND status = 'PENDING'` on the locked payment row; exactly one wins, the others get `PAYMENT_STATE_INVALID` (or `200` with current state if it's the same action repeated).
- **Two cash marks at once:** `ux_payments_one_open_cash` lets only one through → `CASH_ALREADY_PENDING`.
- **Bill changes after cash was marked** (a late visit confirmation): the pending cash payment keeps its allocations; the new amount shows as due separately.
- **Advance applied twice** (duplicate `JobCompleted`): key `ADVANCE_APPLIED:{advancePaymentId}` → no-op.
- **Dues restriction race:** add / lift is one upsert keyed by `(user_id, NO_NEW_OFFERS, DUES)` with `lifted_at IS NULL`; recalculated from the ledger each time, never incremented. A real change writes outbox `DuesRestrictionChanged {added|lifted}`.
- **Cash disputes** are listed for ops through the `CASH_DISPUTED` `OpsQueueSource` ([LLD-020](lld-020-admin-operations.md) §3.3) until LLD-018 resolves them.
- **Money overflow:** `Money` uses `Math.addExact`/`multiplyExact`; amounts above ₹10,00,000 per payment are rejected (config) — far beyond any real job here.

---

## 9. Security & privacy

- Workers see only their own earnings and balance; customers see only payments of their jobs. Provider ids, ledger accounts and other workers' data are never in non-admin responses.
- `finance.view` / `finance.adjust` are separate admin permissions ([ERD §52.1](../architecture/03-erd-and-production-database-design.md)); every adjustment writes `audit_events` with the reason and is shown in the worker's earnings list as "Adjustment by Karigar support".
- The amount for cash is always computed server-side; the worker cannot type an amount (stops "customer paid ₹500" being recorded as ₹50 to dodge the fee — the customer confirms the same figure).
- No card / UPI / bank data is stored here (LLD-011 and LLD-019 handle provider tokens).
- Push text never shows an amount on the lock screen ("Confirm the cash payment for your job"); the amount is shown in the app (LLD-013).

---

## 10. Observability

| Type | Name | Notes |
|---|---|---|
| Counter | `cash_payment_total{result}` | confirmed, auto_confirmed, disputed |
| Gauge | `worker_dues_restricted_count` | workers blocked by D7 |
| Counter | `ledger_post_total{txn_type}` | |
| Counter | `ledger_post_rejected_total{reason}` | unbalanced, duplicate key |
| Gauge | `ledger_reconciliation_mismatch_count` | from the nightly job |
| Histogram | `worker_balance_query_ms` | watch D6 |

**Nightly reconciliation** (`LedgerReconciliationJob`): every `SUCCEEDED` payment has exactly one earning and its posting; Σ Dr = Σ Cr over the whole ledger; `CUSTOMER_ADVANCES` per request = advance − applied − refunded ≥ 0; cash `PENDING` older than 48 h (job stuck). Any mismatch → alert (P1 severity) and an ops task; nothing is auto-fixed.

Alerts: auto-confirmed share of cash > 60 % (customers not engaging — or workers marking cash that wasn't paid); dues-restricted workers > 10 % of active workers (fee too high for cash trades).

---

## 11. Test plan

| Level | Cases |
|---|---|
| Unit | `EarningSplit`: ₹1,000 at 10 % / 18 % → 100 / 18 / 882; material ₹300 excluded from commission; odd paise rounding half-up (₹333.33 × 10 %); cash → `cash_retained = gross`, owed −118; `Money` overflow throws |
| Ledger (Testcontainers) | unbalanced txn fails at commit; UPDATE / DELETE on entries fails; same idempotency key twice → one txn; worker balance after P2 + P5 + P9 |
| Cash flow | mark → confirm → SUCCEEDED, P5, earning; mark → 24 h → auto; mark → `CashDisputeHooks.markDisputed` → no postings, auto-confirm skips it; double mark → 409; worker can't mark another worker's job → 404; cash for remaining material due on a `FAILED` job accepted |
| Advance | completion applies min(advance, total); late cancel fee capped at advance, rest refunded once; failed job: visit charge + material due from advance before refund (LLD-009 §8); duplicate events → one posting |
| Disputes / payouts | `DisputeOpened` → job earnings `ON_HOLD`, `DisputeResolved` → back to `ELIGIBLE`; payout failed (LLD-019) → earnings `PAID_OUT → ELIGIBLE` |
| Dues | three cash jobs → balance −₹354, not restricted; push past −₹1,000 → `NO_NEW_OFFERS`; online earning brings it back → lifted |
| Concurrency | confirm vs auto-confirm vs dispute in parallel → one result; two parallel postings with the same key → one row |
| Reconciliation | delete-free tampering (insert an orphan earning in test DB) → job reports mismatch |
| Architecture (ArchUnit) | only `payment.ledger` writes ledger tables; no module outside `payment` imports `payment.ledger` internals except `LedgerPostingService` / `LedgerBalanceQuery` |

---

## 12. Open questions

| Question | Default until decided | Owner | Due |
|---|---|---|---|
| Commission rate per trade (cash-heavy trades may need lower) | 10 % all trades | Product | Before pilot |
| TDS 194-O / TCS s.52 / GST s.9(5) treatment, incl. cash jobs | Not applied (rows not loaded); GST on fee only | CA | Before launch |
| ~~How a cash-only worker pays dues~~ | **Resolved by [LLD-019](lld-019-worker-payouts.md) D10:** `WORKER_DUES` UPI checkout via LLD-011, P10 | — | — |
| Dues limit amount | ₹1,000 | Product | Pilot review |
| Allow cash for emergency jobs at night | Allowed | Product | Before launch |

---

## Change log

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-05 | TBD | First draft |
| 0.2 | 2026-10-05 | TBD | Integrated with LLD-012–022: named CHECKs `ck_payments_job_or_advance` / `ck_payment_allocations_target` (replaced by 017 / 019); material allocations + material on cancel/fail (017); P8 + P10 + `PAID_OUT → ELIGIBLE` (019); `dispute-cash` endpoint removed → `POST /api/v1/disputes` + `CashDisputeHooks`, earnings hold on `DisputeOpened` / `DisputeResolved` (018); named cash / dues events, no amount on lock screen; `CASH_DISPUTED` ops queue (020) |
