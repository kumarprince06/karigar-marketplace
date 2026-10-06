# LLD-019: Worker Payout Accounts, Payouts and Dues Collection

| Field | Value |
|---|---|
| Status | Draft |
| Owner | TBD |
| Reviewers | TBD |
| Module | `payment` (`payment.payout` sub-package) |
| Parent HLD | [modules/06 §33–35, §63](../modules/06-payments-refunds-settlement-and-ledger.md), [architecture/03 §46.2–46.3](../architecture/03-erd-and-production-database-design.md), [ADR 0007](../adr/0007-payment-provider-abstraction.md), [security/03 §24](../security/03-data-privacy-pii-retention-and-compliance.md) |
| Requirements | FR-PAY-003 (worker earnings and payouts), BR money rules |
| Depends on | LLD-010 (ledger, posting rules, earnings, `DuesRestrictionService`, `account_restrictions` source `DUES`), LLD-011 (`PaymentGateway`, webhook intake, `provider_events`, `CheckoutService`), LLD-004 (readiness needs a verified bank account, D8), LLD-007 (`account_restrictions`) |
| Used by | LLD-004 (`PayoutAccountLookup`, `PayoutAccountVerified`), LLD-013 (payout notifications), admin finance views |
| Last updated | 2026-10-05 |

---

## 1. Context & scope

A worker is owed money for online jobs (positive `WORKER_PAYABLE` balance) and owes the platform its fee + GST on cash jobs (negative balance, LLD-010 §4). This LLD moves the positive side to the worker's bank account and lets a cash-only worker pay the negative side by UPI. It also owns the bank account itself, which LLD-004 needs before a worker's first job.

**In scope**

- Payout account: add bank account, penny-drop through the provider, name match, one active account
- Daily payout batch, payout + payout items, provider transfer, webhooks, retries
- Ledger P8 (payout) and its reversal; failed / reversed payout handling
- Dues collection: worker pays what they owe by UPI checkout (new payment purpose `WORKER_DUES`)
- Admin payout hold (`NO_PAYOUTS`), name-match review, payout search

**Out of scope:** TDS 194-O deduction (computed in the earning split, LLD-010 D2 — stays 0 until a CA confirms), GST invoices, payouts to customers for cash-dispute refunds (disputes LLD), instant / on-demand payouts.

**Decisions**

| # | Decision | Default (configurable) |
|---|---|---|
| D1 | **Payouts are provider split transfers** (Razorpay Route transfer / Cashfree Easy Split vendor settlement) **to the worker's linked account**, not a payouts API from our own current account: the money goes from the provider's settlement balance straight to the worker, so the platform never holds it (ADR 0007, RBI PA rules). | — |
| D2 | Payout destination is a **bank account only** (linked accounts settle to bank). UPI ID payout is refused with `422 UPI_PAYOUT_NOT_SUPPORTED` until a payouts-API mode exists; `account_type = 'UPI'` stays in the table for that. | — |
| D3 | Bank account verified by the provider's **penny-drop**; the beneficiary name returned is matched against the worker's name (§1.1). Score ≥ 80 → `ACTIVE`; 50–79 → `NEEDS_REVIEW` (ops decides); < 50 → `DISABLED` (`NAME_MISMATCH`). | 80 / 50 |
| D4 | **One `ACTIVE` bank account per worker** (always primary). A new one, once `ACTIVE`, replaces the old one (old → `DISABLED`, `REPLACED`). | — |
| D5 | **Cooling-off:** no payout to an account until 24 h after it became `ACTIVE`; the worker gets an email + push at add and at activation. Limits damage from a taken-over login. | 24 h |
| D6 | **Daily batch at 11:00 IST** (ShedLock). A worker is paid when: no `NO_PAYOUTS` restriction, an `ACTIVE` account past cooling-off, no open payout, and **amount ≥ ₹100**. | 11:00, ₹100 |
| D7 | **Amount = min(Σ owed on `ELIGIBLE` online earnings not yet paid, ledger balance).** A balance pulled down by cash dues is recovered here automatically; balance ≤ 0 → no payout (LLD-010 §4). Cash earnings never join a payout — they are debt, not money owed. | — |
| D8 | **P8 is posted when the payout is created** (same transaction as `QUEUED` + earnings → `PAID_OUT`), so the balance drops at once and the next batch can never pay the same money twice. A failed / reversed payout posts the exact reverse and earnings go back to `ELIGIBLE`. | — |
| D9 | Idempotency key per payout = `PAYOUT:{workerId}:{batchDate}`; the provider call uses the payout id, so a retry after a timeout never creates a second transfer. | — |
| D10 | **Dues by UPI:** a `payments` row with purpose `WORKER_DUES`, payer = the worker, amount = the whole amount owed (computed server-side). Reuses LLD-011 checkout, webhook, sweeper and reconciliation unchanged; only the success handler differs (P10, no earning). | — |

### 1.1 Name match

```java
// NameMatch.score("SUJIT KUMAR DAS", "Sujit Das") → 100 ; ("S K DAS", "Sujit Das") → 100 ; ("RINA PAL", "Sujit Das") → 0
static int score(String bankName, String workerName) {
    List<String> a = tokens(bankName), b = tokens(workerName);      // upper-case, drop MR/MRS/MS/SHRI/SMT/KUMARI, punctuation
    long hit = b.stream().filter(t -> a.stream().anyMatch(x -> x.equals(t)
                 || (x.length() == 1 && t.startsWith(x)) || (t.length() == 1 && x.startsWith(t)))).count();
    return (int) (100 * hit / b.size());                             // share of the worker's name found in the bank name
}
```

Compared against `workers.display_name` (LLD-004). When the verification LLD stores a PAN / Aadhaar name, that name is used instead (§11).

---

## 2. Classes / components

```text
com.karigar.payment.payout
├── api/
│   ├── PayoutAccountController        -- /api/v1/worker/payout-accounts
│   ├── WorkerPayoutController         -- /api/v1/worker/payouts/**, POST /api/v1/worker/dues/pay
│   └── AdminPayoutController          -- /api/v1/admin/payouts/**, payout holds, account review
├── application/
│   ├── PayoutAccountService           -- add (penny-drop, name match), replace, review; implements PayoutAccountLookup (LLD-004)
│   ├── PayoutBatchJob                 -- daily (D6), ShedLock; one DB transaction per worker
│   ├── PayoutService                  -- create (txn), submit to provider (no txn), apply provider result
│   ├── PayoutRetryJob                 -- every 5 min: QUEUED older than 2 min → submit again (same key)
│   ├── PayoutEventHandler             -- called by LLD-011 ProviderEventProcessor for PAYOUT_* / ACCOUNT_VALIDATED
│   ├── DuesCheckoutService            -- WORKER_DUES order via CheckoutService; success → P10 → DuesRestrictionService
│   └── port/ PaymentGateway (LLD-011, extended below), LedgerPostingService, LedgerBalanceQuery,
│             RestrictionReader (trust), OutboxWriter
└── domain/  PayoutStatus, PayoutAccountStatus, NameMatch, PayoutAmountPolicy (D6, D7)
```

`PaymentGateway` (LLD-011) gains three methods — same provider, same adapter, so no second port:

```java
ProviderAccount registerBankAccount(WorkerId w, String holderName, String accountNumber, String ifsc, String idempotencyKey);
//   creates / updates the worker's linked account and starts penny-drop → ref, status (VALIDATED | PENDING | FAILED), beneficiaryName
ProviderTransfer createTransfer(String providerAccountRef, Money amount, String idempotencyKey, Map<String, String> notes);
ProviderTransferStatus fetchTransfer(String providerPayoutId);
```

`VerifiedEvent` kinds gain `PAYOUT_PROCESSED | PAYOUT_FAILED | PAYOUT_REVERSED | ACCOUNT_VALIDATED` (e.g. Route `transfer.processed`, `transfer.failed`, `transfer.reversed`, linked-account validation). Payout webhooks use the same endpoint and `provider_events` dedup as LLD-011.

---

## 3. Data model

From [ERD §46.2](../architecture/03-erd-and-production-database-design.md), with explicit checks. Changes vs the ERD: account status `NEEDS_REVIEW`, `disabled_reason`, `payout_items` as a table, one-open-payout index, payout `failure_code`, ledger `txn_type` `PAYOUT_REVERSAL` / `DUES_RECEIVED`, payment purpose `WORKER_DUES` with `customer_id` nullable. ERD updated in the same PR.

```sql
-- V14_1__payouts.sql  (payment module; after V9_1)
CREATE TABLE worker_payout_accounts (
    id                    UUID PRIMARY KEY,
    worker_id             UUID NOT NULL REFERENCES workers (id),
    account_type          VARCHAR(10) NOT NULL CHECK (account_type IN ('UPI','BANK')),
    upi_vpa               VARCHAR(100),
    bank_account_last4    CHAR(4),                          -- full number never stored (security/03)
    ifsc                  CHAR(11),
    account_holder_name   VARCHAR(100) NOT NULL,            -- as typed by the worker
    beneficiary_name      VARCHAR(100),                     -- as returned by penny-drop
    provider              VARCHAR(30) NOT NULL,
    provider_account_ref  VARCHAR(100),                     -- linked account / fund account id
    name_match_score      SMALLINT CHECK (name_match_score BETWEEN 0 AND 100),
    is_primary            BOOLEAN NOT NULL DEFAULT false,
    status                VARCHAR(20) NOT NULL CHECK (status IN ('PENDING_VERIFICATION','NEEDS_REVIEW','ACTIVE','DISABLED')),
    disabled_reason       VARCHAR(40),                      -- PENNY_DROP_FAILED, NAME_MISMATCH, REJECTED_BY_OPS, PAYOUT_FAILED, REPLACED
    verified_at           TIMESTAMPTZ,
    payouts_allowed_from  TIMESTAMPTZ,                      -- verified_at + cooling-off (D5)
    reviewed_by_admin_id  UUID REFERENCES admin_users (id),
    created_at            TIMESTAMPTZ NOT NULL,
    updated_at            TIMESTAMPTZ NOT NULL,
    version               BIGINT NOT NULL DEFAULT 0,
    CHECK ((account_type = 'UPI') = (upi_vpa IS NOT NULL)),
    CHECK (account_type <> 'BANK' OR (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$' AND bank_account_last4 ~ '^[0-9]{4}$')),
    CHECK ((status = 'DISABLED') = (disabled_reason IS NOT NULL)),
    CHECK (status <> 'ACTIVE' OR (verified_at IS NOT NULL AND provider_account_ref IS NOT NULL))
);
CREATE UNIQUE INDEX ux_payout_accounts_primary ON worker_payout_accounts (worker_id) WHERE is_primary AND status = 'ACTIVE';
CREATE INDEX ix_payout_accounts_worker ON worker_payout_accounts (worker_id, created_at DESC);
CREATE INDEX ix_payout_accounts_review ON worker_payout_accounts (created_at) WHERE status IN ('PENDING_VERIFICATION','NEEDS_REVIEW');

CREATE TABLE payouts (
    id                  UUID PRIMARY KEY,
    worker_id           UUID NOT NULL REFERENCES workers (id),
    payout_account_id   UUID NOT NULL REFERENCES worker_payout_accounts (id),
    amount_minor        BIGINT NOT NULL CHECK (amount_minor > 0),
    currency            CHAR(3) NOT NULL DEFAULT 'INR',
    status              VARCHAR(20) NOT NULL CHECK (status IN ('QUEUED','PROCESSING','PAID','FAILED','REVERSED')),
    provider            VARCHAR(30) NOT NULL,
    provider_payout_id  VARCHAR(100),
    utr                 VARCHAR(30),
    idempotency_key     VARCHAR(100) NOT NULL UNIQUE,       -- PAYOUT:{workerId}:{batchDate}
    failure_code        VARCHAR(50),
    failure_reason      VARCHAR(200),
    submit_attempts     SMALLINT NOT NULL DEFAULT 0,
    initiated_at        TIMESTAMPTZ NOT NULL,
    paid_at             TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ NOT NULL,
    version             BIGINT NOT NULL DEFAULT 0,
    UNIQUE (provider, provider_payout_id)
);
CREATE UNIQUE INDEX ux_payouts_one_open ON payouts (worker_id) WHERE status IN ('QUEUED','PROCESSING');
CREATE INDEX ix_payouts_worker ON payouts (worker_id, initiated_at DESC);
CREATE INDEX ix_payouts_queued ON payouts (initiated_at) WHERE status = 'QUEUED';

CREATE TABLE payout_items (
    payout_id          UUID NOT NULL REFERENCES payouts (id),
    worker_earning_id  UUID NOT NULL REFERENCES worker_earnings (id),
    amount_minor       BIGINT NOT NULL CHECK (amount_minor > 0),  -- net − cash_retained of the earning
    PRIMARY KEY (payout_id, worker_earning_id)
);
CREATE INDEX ix_payout_items_earning ON payout_items (worker_earning_id);  -- an earning can be in a FAILED payout and a later one

-- Ledger additions (LLD-010 V8_1)
ALTER TABLE ledger_transactions DROP CONSTRAINT ledger_transactions_txn_type_check,
    ADD CONSTRAINT ledger_transactions_txn_type_check CHECK (txn_type IN
        ('PAYMENT_SUCCEEDED','CASH_COLLECTED','CASH_DISPUTE_REVERSAL','ADVANCE_RECEIVED','ADVANCE_APPLIED',
         'ADVANCE_REFUNDED','REFUND','PAYOUT','PAYOUT_REVERSAL','DUES_RECEIVED','GATEWAY_FEE','ADJUSTMENT'));

-- Dues payments (D10): the payer is a worker, there is no customer and no job
ALTER TABLE payments ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE payments DROP CONSTRAINT payments_purpose_check,
    ADD CONSTRAINT payments_purpose_check CHECK (purpose IN
        ('BOOKING_ADVANCE','VISIT_CHARGE','MATERIAL_ADVANCE','DAILY_WAGE','MILESTONE','FINAL','ADDITIONAL','WORKER_DUES'));
ALTER TABLE payments DROP CONSTRAINT ck_payments_job_or_advance,          -- named in LLD-010 V8_1
    ADD CONSTRAINT ck_payments_job_or_advance CHECK (job_id IS NOT NULL OR purpose = 'WORKER_DUES'
        OR (purpose = 'BOOKING_ADVANCE' AND service_request_id IS NOT NULL)),
    ADD CONSTRAINT ck_payments_payer CHECK ((purpose = 'WORKER_DUES') = (customer_id IS NULL)),
    ADD CONSTRAINT ck_payments_dues CHECK (purpose <> 'WORKER_DUES'
        OR (worker_id IS NOT NULL AND job_id IS NULL AND collected_by = 'PLATFORM'));
CREATE UNIQUE INDEX ux_payments_dues_idempotency ON payments (worker_id, idempotency_key) WHERE purpose = 'WORKER_DUES';
CREATE UNIQUE INDEX ux_payments_one_open_dues ON payments (worker_id) WHERE purpose = 'WORKER_DUES' AND status IN ('CREATED','PENDING');
```

Why not a separate `worker_dues_payments` table: it would duplicate provider order, webhook, expiry sweeper and reconciliation code for one small flow. Relaxing one `NOT NULL` with a CHECK that ties it to the purpose keeps every existing customer payment exactly as strict as before.

---

## 4. Posting rules (completes LLD-010 §4)

`W` = the worker's account, `p` = payout amount, `d` = dues paid. Key `{txn_type}:{reference_id}`.

| # | When | Debit | Credit |
|---|---|---|---|
| P8 | Payout created (`QUEUED`) | WORKER_PAYABLE(W) `p` | GATEWAY_CLEARING `p` |
| P8r | Payout `FAILED` or `REVERSED` (`PAYOUT_REVERSAL`) | GATEWAY_CLEARING `p` | WORKER_PAYABLE(W) `p` |
| P10 | `WORKER_DUES` payment succeeded (`DUES_RECEIVED`, reference `PAYMENT`) | GATEWAY_CLEARING `d` | WORKER_PAYABLE(W) `d` |

Gateway fee on a dues payment → P7 as usual (platform expense). Refund after payout stays LLD-011 D8: the reversal debits `WORKER_PAYABLE(W)`, the balance goes negative and D7 recovers it from the next payout.

Example — Sujit has ₹2,350 owed on three `ELIGIBLE` UPI jobs and ₹354 of cash fees: balance ₹1,996 → payout ₹1,996, all three earnings `PAID_OUT`, balance 0. The ₹354 was recovered from them.

---

## 5. API contract

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/v1/worker/payout-accounts` | worker | add bank account (`Idempotency-Key`) → `201` with status |
| GET | `/api/v1/worker/payout-accounts` | worker | own accounts (masked) |
| GET | `/api/v1/worker/payouts?cursor=` | worker | payouts, newest first, max 50 |
| GET | `/api/v1/worker/payouts/{id}` | worker | payout + items (job, amount) + UTR |
| POST | `/api/v1/worker/dues/pay` | worker | checkout for the full amount owed (`Idempotency-Key`) → `201` (or `200` with the open order) |
| GET | `/api/v1/admin/payouts?status=&workerId=&cursor=` | `finance.view` | search |
| POST | `/api/v1/admin/workers/{id}/payout-hold` | `finance.payout` | `{ reasonCode, note }` → `NO_PAYOUTS` (source `ADMIN`) |
| DELETE | `/api/v1/admin/workers/{id}/payout-hold` | `finance.payout` | lift (sets `lifted_at`) |
| POST | `/api/v1/admin/payout-accounts/{id}/approve` · `/reject` | `finance.payout` | decide `NEEDS_REVIEW`; reason required on reject |

Add bank account (account number is write-only, never echoed):

```json
// POST /api/v1/worker/payout-accounts   Idempotency-Key: 9c2…
{ "accountType": "BANK", "accountHolderName": "Sujit Das", "accountNumber": "30551234567890", "ifsc": "SBIN0001234" }
// 201
{
  "data": {
    "id": "…", "accountType": "BANK", "bankAccountLast4": "7890", "ifsc": "SBIN0001234",
    "beneficiaryName": "SUJIT KUMAR DAS", "status": "ACTIVE",
    "payoutsAllowedFrom": "2026-10-06T08:15:00Z"
  }
}
```

Dues — response shape is LLD-011's checkout with `purpose: "WORKER_DUES"`, `amountMinor` = −balance.

**Error codes**

| HTTP | `error.code` | When |
|---|---|---|
| 400 | `IFSC_INVALID` / `ACCOUNT_NUMBER_INVALID` | format (IFSC regex; 9–18 digits) |
| 422 | `UPI_PAYOUT_NOT_SUPPORTED` | `accountType: UPI` (D2) |
| 422 | `PENNY_DROP_FAILED` | provider says account invalid / closed; row saved `DISABLED` |
| 409 | `ACCOUNT_VERIFICATION_PENDING` | another account of this worker is `PENDING_VERIFICATION` / `NEEDS_REVIEW` |
| 429 | `TOO_MANY_ACCOUNT_ATTEMPTS` | > 3 add attempts per 24 h (each penny-drop costs money and invites probing) |
| 409 | `NO_DUES` | balance ≥ 0 |
| 409 | `IDEMPOTENCY_KEY_REUSED` | same key, different body |
| 503 | `PAYMENT_PROVIDER_UNAVAILABLE` | provider down; nothing saved, safe to retry |

---

## 6. Sequence diagrams

### 6.1 Add bank account

```mermaid
sequenceDiagram
    participant W as Worker app
    participant S as PayoutAccountService
    participant G as PaymentGateway
    participant DB as PostgreSQL
    W->>S: POST /worker/payout-accounts (number, IFSC, name)
    S->>DB: rate limit, no other pending account
    S->>G: registerBankAccount(…, key) — no DB transaction open
    G-->>S: ref, VALIDATED, beneficiaryName "SUJIT KUMAR DAS"
    S->>DB: INSERT account (last4 only), score = 100 → ACTIVE, primary, payouts_allowed_from = +24 h;<br/>old ACTIVE → DISABLED (REPLACED); outbox PayoutAccountVerified, PayoutAccountChanged (email + push)
    S-->>W: 201 ACTIVE
    Note over S,G: PENDING from provider → row PENDING_VERIFICATION; ACCOUNT_VALIDATED webhook finishes the same steps
```

The full account number lives only in the request object for this call; it is excluded from logs, traces and error reports (field marked `@Sensitive`, scrubbed by the log filter).

### 6.2 Daily batch and webhook

```mermaid
sequenceDiagram
    participant J as PayoutBatchJob (11:00 IST)
    participant P as PayoutService
    participant L as LedgerPostingService
    participant G as PaymentGateway
    participant E as PayoutEventHandler
    participant DB as PostgreSQL
    J->>DB: workers with ELIGIBLE unpaid online earnings
    loop each worker (own transaction)
        P->>DB: skip if NO_PAYOUTS / no ACTIVE account past cooling-off / open payout
        P->>DB: SELECT eligible earnings FOR UPDATE SKIP LOCKED; balance; amount = min(Σ, balance)
        alt amount ≥ ₹100
            P->>DB: INSERT payout QUEUED + items; earnings → PAID_OUT
            P->>L: P8 (key PAYOUT:{payoutId})
            P->>DB: commit
            P->>G: createTransfer(ref, amount, key = payoutId)
            P->>DB: provider_payout_id, PROCESSING
        end
    end
    G->>E: webhook PAYOUT_PROCESSED (LLD-011 intake, dedup)
    E->>DB: lock payout; PROCESSING → PAID, utr, paid_at; outbox PayoutPaid (push "Your earnings were sent to your bank"; amount and last 4 in the inbox, LLD-013 D5)
```

---

## 7. State transitions

**Payout account**

| From | Event | Guard | To |
|---|---|---|---|
| — | add, provider `VALIDATED` | score ≥ 80 | ACTIVE (+ `PayoutAccountVerified`) |
| — / PENDING_VERIFICATION | validated | 50 ≤ score < 80 | NEEDS_REVIEW |
| — / PENDING_VERIFICATION | validated | score < 50 | DISABLED (`NAME_MISMATCH`) |
| — | add, provider `PENDING` | — | PENDING_VERIFICATION |
| — / PENDING_VERIFICATION | penny-drop failed | — | DISABLED (`PENNY_DROP_FAILED`) |
| NEEDS_REVIEW | ops approve / reject | `finance.payout` | ACTIVE / DISABLED (`REJECTED_BY_OPS`) |
| ACTIVE | newer account becomes ACTIVE | — | DISABLED (`REPLACED`) |
| ACTIVE | payout failed / reversed with an account reason (closed, invalid, frozen) | — | DISABLED (`PAYOUT_FAILED`) + `PayoutAccountDisabled` |

A disabled account does not deactivate the worker (LLD-004 readiness is checked only for activation); cash jobs continue, payouts wait for a new account.

**Payout**

| From | Event | To | Side effects |
|---|---|---|---|
| — | batch | QUEUED | items, earnings → `PAID_OUT`, P8 |
| QUEUED | provider accepted | PROCESSING | `provider_payout_id` |
| QUEUED | provider call timed out | QUEUED | `PayoutRetryJob` resubmits with the same key |
| QUEUED | provider rejected synchronously | FAILED | as `PAYOUT_FAILED` below |
| PROCESSING | `PAYOUT_PROCESSED` | PAID | `utr`, `paid_at`, outbox `PayoutPaid` |
| PROCESSING | `PAYOUT_FAILED` | FAILED | P8r; earnings `PAID_OUT → ELIGIBLE`; account reason → account DISABLED; outbox `PayoutFailed` |
| PAID | `PAYOUT_REVERSED` | REVERSED | same as FAILED |
| PAID / FAILED / REVERSED | anything else | unchanged | event recorded, ignored |

Earnings (adds to LLD-010 §7): `ELIGIBLE → PAID_OUT` (payout created) · `PAID_OUT → ELIGIBLE` (payout failed / reversed). `PAID_OUT` means "assigned to a non-failed payout"; the worker app shows the payout's own status next to it.

---

## 8. Error handling, idempotency & concurrency

- **No double payout:** `ux_payouts_one_open` (one open payout per worker), the batch key `PAYOUT:{workerId}:{batchDate}`, the ledger key `PAYOUT:{payoutId}`, and earnings moved with `… WHERE status = 'ELIGIBLE'`. A second batch run the same day hits the unique key and skips.
- **No provider call inside a DB transaction.** Provider timeout → payout stays `QUEUED`; resubmission uses the payout id as the provider idempotency key, so the provider returns the first transfer. After 5 attempts → ops alert, payout left `QUEUED` (never auto-failed while the provider may have it — `fetchTransfer` decides).
- **Balance moves during the batch** (a refund reversal lands at the same moment): the amount is computed from the ledger inside the worker's transaction; a race can at most leave the balance slightly negative, which D7 recovers next time. Accepted rather than locking every ledger write.
- **Earning put `ON_HOLD` while being paid:** the batch locks earnings `FOR UPDATE SKIP LOCKED`; a dispute arriving after `PAID_OUT` follows LLD-011 D8 (recovered via the balance).
- **Webhooks** go through LLD-011 intake (`UNIQUE (provider, event_id)`, verify → store → process); out-of-order `PROCESSED` after `FAILED` → parked + alert (money state unclear), never applied silently. Amount mismatch → parked + alert.
- **Dues payment** reuses LLD-011's transition table; success posts P10 (key `DUES_RECEIVED:{paymentId}`) and calls `DuesRestrictionService` (LLD-010 D7), which lifts `NO_NEW_OFFERS` when the balance is back within the limit. Late success after the worker's balance already recovered → balance goes positive; it is simply paid out next batch (no refund needed).
- **Adding an account twice** with the same `Idempotency-Key` → same response; the provider call also carries the key.

---

## 9. Security & privacy

- Bank data: only `last4`, IFSC, holder / beneficiary name and the provider ref are stored (security/03 §24). The full number is passed to the provider over TLS and dropped; it is never in logs, DB, outbox payloads or analytics.
- Payout accounts and payouts are visible only to the worker and staff with `finance.view`; never in customer or public APIs (LLD-004 §8).
- Account takeover: 24 h cooling-off (D5), email + push on every add / replace / disable, 3 adds per 24 h. Admin actions (`finance.payout`: hold, lift, approve, reject) require MFA (`admin_users.mfa_enabled`, ERD) and write `audit_events` with reason.
- Admin cannot change the destination of a payout or type a payout amount; both come from the account row and the ledger.
- Retention: accounts and payouts 8 years with the transactions (security/03 retention table).

---

## 10. Observability

| Type | Name | Notes |
|---|---|---|
| Counter | `payout_total{result}` | paid, failed, reversed |
| Counter | `payout_amount_minor_total` | daily sum, compare with provider report |
| Gauge | `payouts_open_oldest_seconds` | alert > 48 h (QUEUED / PROCESSING) |
| Counter | `payout_account_added_total{result}` | active, needs_review, name_mismatch, penny_drop_failed |
| Gauge | `payout_accounts_needs_review` | ops queue size |
| Counter | `worker_dues_paid_total` | |
| Gauge | `payout_batch_last_success_timestamp` | alert if no run by 12:00 IST |

**Reconciliation:** the nightly LLD-011 job also compares the provider's transfer report with `payouts` (missing, amount differs, status differs) and checks Σ P8 − Σ P8r = Σ `amount` of `PAID` + open payouts. Mismatch → P1 alert, no auto-fix.

Alerts: payout failure rate > 5 % in a batch; one worker > ₹25,000 in a day (fraud review); > 20 % of new accounts `NEEDS_REVIEW` (threshold or name source wrong).

---

## 11. Test plan

| Level | Cases |
|---|---|
| Unit | `NameMatch`: exact, extra middle name, initials, titles, swapped order, different person; `PayoutAmountPolicy`: eligible ₹2,350 / balance ₹1,996 → ₹1,996; balance −₹50 → none; ₹90 → none (below min); `ON_HOLD` and cash earnings excluded |
| DB (Testcontainers) | payout account CHECKs (UPI without VPA, bad IFSC, ACTIVE without ref); two ACTIVE primaries → unique violation; two open payouts → unique violation; `WORKER_DUES` with `customer_id` → CHECK fails; customer payment without `customer_id` → CHECK fails |
| Batch (FakeGateway) | eligible → QUEUED → PROCESSING → PAID, P8 posted once, earnings `PAID_OUT`; batch run twice → one payout; `NO_PAYOUTS` → skipped; account in cooling-off → skipped |
| Failure | `PAYOUT_FAILED` (account closed) → P8r, earnings `ELIGIBLE`, account `DISABLED`, push; transient failure → account stays `ACTIVE`, paid next batch; `PAID → REVERSED` → P8r; provider timeout → retry with same key → one transfer |
| Account | penny-drop OK + score 100 → `ACTIVE` + `PayoutAccountVerified` → LLD-004 readiness passes; score 65 → `NEEDS_REVIEW` → approve; failed penny-drop → 422; account number absent from logs (log capture assertion) |
| Dues | balance −₹1,180 with `NO_NEW_OFFERS` (DUES) → pay → P10 → balance 0 → restriction lifted; `NO_DUES` when ≥ 0; webhook delivered twice → one P10 |
| Contract (provider sandbox, nightly CI) | linked account + penny-drop, transfer, transfer webhook signature |
| Architecture (ArchUnit) | `payment.payout` uses the ledger only via `LedgerPostingService` / `LedgerBalanceQuery` |

---

## 12. Open questions

| Question | Default until decided | Owner | Due |
|---|---|---|---|
| Linked-account KYC needs (PAN for individuals?) with the chosen provider | PAN from the verification LLD when available; ops collects otherwise | Finance + provider | Before pilot |
| Name source for matching (display name vs PAN / Aadhaar name) | `display_name`; switch when the verification LLD stores a verified name | Product | With verification LLD |
| Payout frequency / minimum (daily ₹100 vs weekly) | Daily 11:00 IST, ₹100 | Product | Pilot review |
| UPI payouts (needs payouts-API mode and its RBI position) | Not supported (D2) | Product + finance | After pilot |
| TDS 194-O on payouts | 0 (LLD-010 D2) | CA | Before launch |
| Step-up auth (password re-entry) before adding a bank account | Cooling-off + notification only | Security | With LLD-002 review |

---

## Change log

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-05 | TBD | First draft |
| 0.2 | 2026-10-05 | TBD | Cross-LLD consistency |
