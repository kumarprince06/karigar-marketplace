# Payment Gateway Integration, Refunds, Settlement & Financial Ledger

**Project:** Karigar Marketplace
**Document Type:** System Architecture / Financial Domain Design
**Status:** Draft for Product & Engineering Review
**Scope:** Payments, payment providers, refunds, platform fees, worker earnings, settlement, financial records, webhooks, reconciliation

---

## Current Model (aligned with ERD and ADRs)

> The ERD ([architecture/03](../architecture/03-erd-and-production-database-design.md), §42–46.4) is the source of truth for tables, columns and states. Where this document and the ERD disagree, the ERD wins. See also [ADR 0006](../adr/0006-money-integer-minor-units.md) (money as integer minor units) and [ADR 0007](../adr/0007-payment-provider-abstraction.md) (payment provider abstraction, provider still open).

* **Money (ERD §42):** integer paise (`amount_minor BIGINT`) plus `currency = 'INR'`; never float or `NUMERIC` rupees. Percentages are rounded half-up to whole paise. The backend computes every amount from confirmed visits and accepted quotes; the client never sends an amount when creating a payment.
* **Payments (ERD §43):** purpose `VISIT_CHARGE | MATERIAL_ADVANCE | DAILY_WAGE | MILESTONE | FINAL | ADDITIONAL`; method `UPI | CARD | NETBANKING | WALLET | CASH`; `collected_by` `PLATFORM` (online) `| WORKER` (cash); status `CREATED`, `PENDING`, `SUCCEEDED`, `FAILED`, `CANCELLED`. A job can have several payments (visit charge, material advance, daily/weekly wages per `bookings.payment_schedule`, final). `payment_allocations` link each payment to the `job_visits` or `quotes` it covers.
* **Status source:** online status comes only from signature-verified provider webhooks stored in `provider_events` with `UNIQUE (provider, event_id)` (ERD §44). Cash is `SUCCEEDED` when the customer confirms it (or after a set time if the worker marked it and the customer did not object).
* **Idempotency (ERD §45):** `payments UNIQUE (customer_id, idempotency_key)`, `refunds UNIQUE (payment_id, idempotency_key)`, `payouts UNIQUE (idempotency_key)`, `ledger_transactions UNIQUE (idempotency_key)`.
* **No customer money held by the platform:** online money moves through the provider's marketplace split settlement (e.g. Razorpay Route or Cashfree Easy Split), in line with RBI payment-aggregator rules. There is no stored-value wallet. The concrete provider is still open (ADR 0007); providers stay behind the `PaymentGateway` port.
* **Refunds (ERD §46):** `REQUESTED`, `PROCESSING`, `SUCCEEDED`, `FAILED`, with a `reason_code`. Total of non-failed refunds ≤ payment amount, checked with the payment row locked. Cash payments are refunded through a ledger adjustment. A refund after the worker was paid out creates a recovery against the worker's future earnings.
* **Worker earnings (ERD §46.1):** one row per succeeded payment — `gross`, `platform_fee`, `gst_on_fee`, `tds` (194-O), `tcs` (GST s.52, only if the worker is GST-registered), `material_reimbursement` (no commission), `net` (negative for cash jobs: the worker owes the fee), `fee_rate_bps`. Status `PENDING`, `ELIGIBLE`, `ON_HOLD`, `PAID_OUT`, `REVERSED`. Tax rates are data (`tax_rates` with effective dates).
* **Payouts (ERD §46.2):** `worker_payout_accounts` (UPI VPA or bank account + IFSC, only the last 4 digits stored, penny-drop / VPA verified) and `payouts` (`QUEUED`, `PROCESSING`, `PAID`, `FAILED`, `REVERSED`, with bank `utr`).
* **Ledger (ERD §46.3):** true double-entry — `ledger_accounts`, `ledger_transactions`, `ledger_entries` (`direction` D/C, positive amounts). Debits = credits per transaction; append-only; corrections are `ADJUSTMENT` transactions. Example, ₹1,000 UPI payment (rates illustrative):

| Account | Debit | Credit |
|---|---|---|
| GATEWAY_CLEARING | ₹1,000.00 | |
| PLATFORM_FEE_REVENUE | | ₹100.00 |
| GST_PAYABLE | | ₹18.00 |
| TDS_PAYABLE | | ₹1.00 |
| WORKER_PAYABLE (worker) | | ₹881.00 |
| **Total** | **₹1,000.00** | **₹1,000.00** |

  The provider's fee (MDR) is a separate balanced transaction: Dr `GATEWAY_FEE_EXPENSE` / Cr `GATEWAY_CLEARING`.
* **GST invoices (ERD §46.4):** consecutive, gap-free numbering per financial year. GST s.9(5), TCS u/s 52, TDS u/s 194-O and SAC codes must be confirmed with a chartered accountant before launch.

---

# 1. Purpose

The platform involves money moving between multiple parties:

```text
Customer
    |
    | payment
    v
Payment Provider (marketplace split settlement)
    |
    +--> Platform fee
    |
    +--> Worker earnings
```

Eventually the platform may support:

* customer payments
* worker earnings
* platform commissions
* refunds
* partial refunds
* additional work charges
* payment failures
* payment retries
* settlement
* provider fees
* disputes
* reconciliation
* financial reporting.

Financial data must therefore be designed differently from ordinary application data.

The core principle is:

> **A payment system must be auditable, idempotent, recoverable, and capable of explaining every unit of money from customer payment to worker settlement.**

---

# 2. Why Payments Need a Dedicated Architecture

A simple implementation might look like:

```text
Booking
   |
   v
PaymentService
   |
   v
Razorpay/Cashfree
```

and store:

```text
payment.status = SUCCEEDED
```

That is insufficient for a production marketplace.

A real payment lifecycle can look like:

```text
Customer starts payment
        |
        v
Payment pending
        |
        v
Provider processes
        |
        v
Provider webhook
        |
        v
Payment successful
        |
        v
Worker earning created
        |
        v
Settlement initiated
        |
        v
Worker receives funds
```

Any step can fail independently.

Therefore:

```text
Payment
≠
Provider Transaction
≠
Worker Earning
≠
Settlement
≠
Ledger Entry
```

These concepts must remain separate.

---

# 3. Financial Domain Concepts

The platform should distinguish at least:

```text
Payment
Refund
Payment Provider Transaction
Platform Fee
Worker Earning
Settlement
Ledger Entry
Provider Event
Reconciliation Record
```

Each answers a different question.

---

# 4. Payment

A payment represents:

> Money the customer is expected to pay for a specific business transaction.

Example:

```text
Job #JOB-1001
Customer payment = ₹500
```

The payment belongs to the platform's business transaction.

---

# 5. Provider Transaction

A provider transaction represents:

> What happened at an external payment provider.

For example:

```text
Razorpay payment
Cashfree payment
```

The platform should preserve the provider's identifiers.

Conceptually:

```text
payment
   |
   +--> provider = RAZORPAY
   +--> providerOrderId = xxx
   +--> providerPaymentId = xxx
```

The internal payment ID must remain independent of the provider ID.

---

# 6. Worker Earning

Suppose:

```text
Customer pays ₹500
Platform fee = ₹50
Worker earning before taxes = ₹450
```

Worker earning should be recorded separately (`worker_earnings`, ERD §46.1). GST on the fee, TDS and TCS are also deducted; see §31. The examples in this document that show only a fee are simplified.

```text
Payment
₹500
 |
 +--> Platform fee ₹50
 |
 +--> Worker earning ₹450
```

This makes financial reporting possible.

---

# 7. Settlement

An earning does not necessarily mean the worker has already received money.

For example:

```text
Worker earning
₹450
   |
   v
Eligible for settlement
   |
   v
Settlement initiated
   |
   v
Settlement completed
```

Therefore:

```text
Earning ≠ Settlement
```

---

# 8. Ledger

A financial ledger answers:

> Where did the money come from, and where did it go?

For example:

Every movement is a balanced double-entry transaction (ERD §46.3). Example, ₹500 UPI payment with a ₹50 fee (taxes left out for brevity; see §37 for the full example):

| Account | Debit | Credit |
|---|---|---|
| GATEWAY_CLEARING | ₹500.00 | |
| PLATFORM_FEE_REVENUE | | ₹50.00 |
| WORKER_PAYABLE (worker) | | ₹450.00 |
| **Total** | **₹500.00** | **₹500.00** |

The chart of accounts should be confirmed with a chartered accountant.

The engineering architecture should nevertheless preserve immutable financial history.

---

# 9. Money Representation

Never use:

```text
double
float
```

for money.

Use integer minor units.

For INR:

```text
₹500.00
```

can be represented as:

```text
50000 paise
```

Conceptually:

```text
Money
----------------
amountMinor
currency
```

Example:

```text
amountMinor = 50000
currency = INR
```

This avoids floating-point precision problems. `NUMERIC` rupee columns are not used either; percentages are rounded half-up to whole paise (ADR 0006, ERD §42).

---

# 10. Currency

Every monetary record should explicitly carry currency.

Example:

```text
amountMinor = 50000
currency = INR
```

Do not assume:

```text
all amounts = INR
```

inside the financial domain.

This makes future expansion possible.

However, the initial product may support only:

```text
INR
```

---

# 11. Payment Lifecycle

A proposed payment lifecycle:

```text
CREATED
    |
    v
PENDING
    |
 +--+-----------+-----------+
 |              |           |
 v              v           v
SUCCEEDED     FAILED     CANCELLED
```

These are the ERD statuses (§43). Refunds are not payment states: they are separate `refunds` rows, and "partially refunded" / "refunded" is derived from them.

For **online** payments, `PENDING → SUCCEEDED | FAILED` happens only on a signature-verified webhook. For **cash** (`method = CASH`, `collected_by = WORKER`), the worker marks it received and it becomes `SUCCEEDED` when the customer confirms (or after a set time without objection).

The important principle is:

> Payment state represents the platform's understanding of the financial transaction, not simply the last API response received from the provider.

---

# 12. Payment Creation

Suppose:

```text
Job completed
Amount = ₹500
```

Customer initiates payment.

Flow:

```text
Customer
   |
   v
POST /payments   { jobId, purpose, method }  + Idempotency-Key header
   |
   v
Backend computes amount_minor from confirmed visits / accepted quotes
   |
   v
Payment created (CREATED) + payment_allocations
   |
   v
Provider order (Razorpay/Cashfree, with split-settlement instructions)
   |
   v
Customer completes payment (UPI / card / netbanking / wallet)
```

The request carries no amount. Any client-sent amount is ignored.

The API should return enough information for the client to continue payment without exposing sensitive provider credentials.

---

# 13. Do Not Trust the Client for Payment Success

The client may report:

```text
payment = SUCCEEDED
```

That should not be considered authoritative.

The backend sets online payment status only from:

* signature-verified provider webhooks (`provider_events`).

The provider API (status lookup) and internal consistency checks are used for reconciliation and for resolving stuck `PENDING` payments, which are then confirmed through the same verified path.

The client is not the financial source of truth.

---

# 14. Provider Webhooks

Payment providers commonly send asynchronous events.

Example:

```text
Provider
   |
   v
Webhook
   |
   v
POST /api/v1/webhooks/payments/{provider}
```

The webhook can tell us:

```text
payment succeeded
payment failed
refund succeeded
refund failed
payout processed / failed
```

The platform must process these events safely.

---

# 15. Webhook Signature Verification

Webhook requests must be authenticated.

The system should verify:

```text
provider signature
timestamp
payload integrity
```

before processing the event.

Invalid webhook:

```text
HTTP request
    |
    X invalid signature
    |
    v
reject
```

Never process unverified payment webhooks.

---

# 16. Webhook Idempotency

Providers may retry webhooks.

For example:

```text
PaymentSucceeded
```

may arrive:

```text
Webhook #1
Webhook #2
Webhook #3
```

The system must not create:

```text
3 payments
3 worker earnings
3 ledger entries
```

Instead, provider event IDs should be persisted.

Conceptually:

```text
provider_events
-------------------------
provider
event_id
event_type
payload            (JSONB)
signature_verified
received_at
processed_at
processing_error
```

with uniqueness on:

```text
(provider, event_id)
```

---

# 17. Payment Idempotency

Client requests can also be duplicated.

Example:

```text
Customer taps Pay
      |
      v
Request sent
      |
network timeout
      |
Customer taps Pay again
```

Without idempotency:

```text
₹500
₹500
```

could be created.

Therefore payment creation should support:

```text
Idempotency-Key
```

The server should associate the key with the intended operation.

Repeated requests with the same key should produce the same logical result.

---

# 18. Payment Provider Abstraction

The application should not couple business logic to Razorpay, Cashfree, or another provider. The provider is still open (ADR 0007); it must support UPI and marketplace split settlement (e.g. Razorpay Route, Cashfree Easy Split).

Conceptually:

```text
PaymentGateway
       |
       +--> RazorpayPaymentGateway
       |
       +--> CashfreePaymentGateway
       |
       +--> FutureProvider
```

Business code should interact with:

```text
PaymentGateway
```

rather than:

```text
Razorpay SDK
```

directly.

---

# 19. Why Provider Abstraction Matters

Suppose the product initially uses Provider A.

Later:

```text
Provider A
    |
    v
Provider B
```

Business modules should not need to rewrite:

```text
Job
Booking
Payment
Refund
Worker Earnings
```

Only provider infrastructure should change.

---

# 20. Provider-Specific Data

Do not pollute the core payment model with provider-specific fields.

Avoid:

```text
razorpayOrderId
razorpayPaymentId
cashfreeOrderId
```

all inside core domain objects.

Instead:

```text
Payment
   |
   +--> ProviderTransaction
```

or a provider-specific infrastructure representation.

The ERD uses generic columns instead: `provider`, `provider_order_id`, `provider_payment_id` on `payments`, `provider_refund_id` on `refunds`, `provider_payout_id` on `payouts` (ERD §43–46.2).

---

# 21. Payment and Job Completion

Payment should remain logically independent from job execution.

Example:

```text
Job = WORK_COMPLETED
Payment = PENDING
```

This can temporarily happen if:

* payment provider is slow
* payment fails
* customer needs to retry
* webhook is delayed.

The system should not pretend:

```text
Job completed
=
Payment successful
```

They are separate lifecycles.

---

# 22. Payment Timing

The business may eventually choose one of several models.

### Model A — Pay after service

```text
Job completed
      |
      v
Customer pays
```

### Model B — Authorization before service

```text
Booking
   |
   v
Payment authorization
   |
   v
Service
   |
   v
Capture
```

### Model C — Prepayment

```text
Booking
   |
   v
Payment
   |
   v
Service
```

### Model D — Staged payments (current model)

Local trades are often paid in parts: visit charge, material advance, daily/weekly wages (hajira) for multi-day work, then the final balance. The booking's `payment_schedule` (`ON_COMPLETION | DAILY | WEEKLY | MILESTONE`) and each payment's `purpose` capture this; `payment_allocations` link each payment to the confirmed `job_visits` or accepted `quotes` it covers (ERD §35, §40.1, §43).

The architecture should support the distinction between:

```text
authorized
captured
refunded
```

if the selected provider/business model requires it.

The exact commercial payment timing remains a product/business decision.

---

# 23. Additional Work Payment

Suppose:

```text
Original service = ₹500
Additional work = ₹200
```

Customer approves:

```text
₹200
```

The financial system should preserve:

```text
Base amount = ₹500
Additional amount = ₹200
Total = ₹700
```

Do not simply mutate:

```text
payment.amount = 700
```

without retaining the financial history. The additional work is an accepted `ADDITIONAL` quote; if paid separately it is a new payment with `purpose = ADDITIONAL`, allocated to that quote in `payment_allocations`.

---

# 24. Payment Amount Snapshot

At payment creation time, the system should preserve the amount being charged.

For example:

```text
Payment
-------------------------
jobId
amountMinor = 50000
currency = INR
```

Later pricing changes should not silently change the historical payment.

This is another reason to separate:

```text
current pricing
```

from:

```text
historical transaction amount
```

---

# 25. Refunds

Refunds should be separate records.

Why?

Because one payment can have:

```text
one refund
```

or:

```text
multiple partial refunds
```

Example:

```text
Payment = ₹1,000

Refund #1 = ₹200
Refund #2 = ₹100

Total refunded = ₹300
Remaining = ₹700
```

Therefore:

```text
refunds
--------
payment_id
amount_minor
currency
status
reason_code
dispute_id
provider_refund_id
idempotency_key
requested_by_user_id
created_at / completed_at
```

---

# 26. Refund Lifecycle

Proposed:

```text
REQUESTED
    |
    v
PROCESSING
    |
 +--+--------+
 |           |
 v           v
SUCCEEDED   FAILED
```

Online refunds become `SUCCEEDED` / `FAILED` only from verified provider webhooks.

The platform should retain refund history.

Never simply overwrite:

```text
payment.refunded = true
```

because that cannot represent:

* partial refunds
* multiple refunds
* failed refunds
* provider references.

---

# 27. Refund Invariant

The platform must enforce:

```text
total_refunded <= captured_amount
```

Example:

```text
Captured = ₹500

Existing refunds:
₹200 + ₹100 = ₹300

Maximum additional refund:
₹200
```

A request for:

```text
₹250
```

must be rejected. The check sums all non-failed refunds with the payment row locked (`SELECT … FOR UPDATE`), so concurrent requests cannot exceed the payment (see §52).

Special cases:

* **Cash payments** cannot be refunded through the provider. They are settled as a ledger `ADJUSTMENT` (the worker returns the cash, or the platform pays the customer by UPI and recovers it from the worker).
* **Refund after payout:** if the worker's earning was already paid out, the earning is `REVERSED` and a recovery is posted against the worker's `WORKER_PAYABLE` account; it is deducted from their future earnings instead of being lost.

---

# 28. Refund Reasons

Refunds should preserve a reason.

Examples:

```text
CUSTOMER_CANCELLATION
WORKER_NO_SHOW
CUSTOMER_NO_SHOW
SERVICE_ISSUE
DISPUTE_RESOLVED
DUPLICATE_PAYMENT
ADMIN_ADJUSTMENT
OTHER
```

These are `reason_code` values from the shared reason-code list (ERD §46, §52.4). The exact business rules will be defined in the dispute/payment policy documentation.

---

# 29. Platform Fee

Suppose:

```text
Customer payment = ₹500
Platform fee = ₹50
Worker earning = ₹450
```

The platform fee should be represented explicitly.

Do not calculate it every time from:

```text
500 * 10%
```

after the fact.

The transaction should preserve the actual fee applied.

Why?

Because fee rules can change.

Today:

```text
10%
```

Tomorrow:

```text
12%
```

Historical transactions must remain unchanged.

---

# 30. Fee Snapshot

Conceptually:

```text
Payment
-----------------------
grossAmount = ₹500
platformFee = ₹50
workerAmount = ₹450
```

Potentially also:

```text
feeRuleId
feeRate
feeVersion
```

This allows historical explanation. In the ERD the snapshot lives on `worker_earnings` (`platform_fee_minor`, `gst_on_fee_minor`, `tds_minor`, `tcs_minor`, `fee_rate_bps`); tax rates come from effective-dated `tax_rates`, so later rate changes never alter past rows.

---

# 31. Worker Earnings

A worker earnings record can represent:

```text
Job #123
Gross = ₹500
Platform fee = ₹50
Worker payable = ₹450
```

In the ERD (`worker_earnings`, §46.1), one row per succeeded payment:

```text
gross_minor                    what the customer paid
platform_fee_minor             commission (fee_rate_bps)
gst_on_fee_minor               GST on the platform fee
tds_minor                      Income-tax TDS u/s 194-O
tcs_minor                      GST TCS u/s 52 (only if the worker is GST-registered)
material_reimbursement_minor   passed through, no commission
net_minor = gross - fee - gst_on_fee - tds - tcs
```

For a **cash** job the worker already holds the gross, so `net_minor` is negative: the worker owes the fee and GST, recovered from the next online payout.

Other deductions may later include:

* refunds (via reversal / recovery)
* adjustments
* penalties where legally/product-policy appropriate.

Tax rates are data in `tax_rates`, not hardcoded.

---

# 32. Earnings State

Conceptually:

```text
PENDING
   |
   v
ELIGIBLE  <---->  ON_HOLD   (e.g. open dispute)
   |
   v
PAID_OUT

any --> REVERSED   (refund / dispute outcome)
```

These are the ERD statuses (§46.1). Payout failure is tracked on the payout, not the earning: a `FAILED` payout leaves the earning `ELIGIBLE` for the next payout.

The worker should be able to see the difference between:

```text
earned
```

and:

```text
paid out
```

---

# 33. Settlement

Settlement represents the actual movement of worker funds.

Example:

```text
Worker earned ₹2,000
       |
       v
Settlement batch
       |
       v
Provider payout
       |
       v
Worker bank account
```

In the ERD this is the `payouts` table (§46.2):

```text
id
worker_id
payout_account_id
amount_minor
status              QUEUED | PROCESSING | PAID | FAILED | REVERSED
provider
provider_payout_id
utr                 bank reference shown to the worker
idempotency_key
failure_reason
initiated_at / paid_at
```

Payouts go to a `worker_payout_accounts` row: UPI VPA or bank account + IFSC (only the last 4 digits stored), verified by penny-drop / VPA validation with a name-match score. `payout_items` link a payout to the earnings it settled. A payout is made only when the worker's ledger balance is positive, so fees owed from cash jobs are recovered automatically.

---

# 34. Settlement Batching

The MVP might settle individual transactions.

Later, batching may be more efficient.

Example:

```text
Monday
Job 1 = ₹450
Job 2 = ₹600
Job 3 = ₹350

Total = ₹1,400
```

Then:

```text
Settlement #S100
₹1,400
```

This reduces operational overhead.

The architecture should therefore avoid assuming:

```text
one job = one settlement
```

forever.

---

# 35. Worker Balance

A worker may eventually have:

```text
Available balance
Pending balance
Settled amount
```

Example:

```text
Worker earnings view
--------------------------
Pending       ₹500
Available     ₹1,200
Paid out      ₹8,400
```

This is a read-only view, not a stored-value wallet: the platform never holds customer or worker money in its own account (funds sit with the provider's split-settlement product). It should not be implemented as an arbitrary mutable balance.

The balance is derived from the ledger (`WORKER_PAYABLE` account) and `worker_earnings`. It can be negative when the worker owes fees from cash jobs.

---

# 36. Ledger Principles

Financial records should preferably be append-oriented.

Instead of:

```text
balance = balance - 100
```

without history, preserve balanced transactions that touch the worker's `WORKER_PAYABLE` account:

```text
Txn 1 PAYMENT_SUCCEEDED   Dr GATEWAY_CLEARING 500   Cr WORKER_PAYABLE 450, PLATFORM_FEE_REVENUE 50
Txn 2 REFUND              Dr WORKER_PAYABLE 100      Cr GATEWAY_CLEARING 100
```

Every transaction has total debits = total credits; entries are append-only and corrections are `ADJUSTMENT` transactions (ERD §46.3).

This creates an audit trail. The chart of accounts should be confirmed with a chartered accountant.

---

# 37. Ledger Example

Example transaction:

```text
Customer pays ₹500
```

Conceptually:

```text
Customer Payment
        |
        v
+-------------------+
| Gross: ₹500       |
+-------------------+
        |
        +---- Platform fee ₹50
        |
        +---- Worker payable ₹450
```

As a double-entry transaction (ERD §46.3), a ₹1,000 UPI payment with a 10% fee, 18% GST on the fee and 0.1% TDS (rates illustrative; real rates come from `tax_rates`):

| Account | Debit | Credit |
|---|---|---|
| GATEWAY_CLEARING | ₹1,000.00 | |
| PLATFORM_FEE_REVENUE | | ₹100.00 |
| GST_PAYABLE | | ₹18.00 |
| TDS_PAYABLE | | ₹1.00 |
| WORKER_PAYABLE (worker) | | ₹881.00 |
| **Total** | **₹1,000.00** | **₹1,000.00** |

The provider's fee (MDR) is posted as its own balanced `GATEWAY_FEE` transaction: Dr `GATEWAY_FEE_EXPENSE` / Cr `GATEWAY_CLEARING`.

**Same job paid in cash** (`CASH_COLLECTED`): the worker already holds ₹1,000, so the ledger records that the worker owes the platform ₹118 (fee + GST):

| Account | Debit | Credit |
|---|---|---|
| CASH_WITH_WORKER (worker) | ₹1,000.00 | |
| WORKER_PAYABLE (worker) | | ₹882.00 |
| PLATFORM_FEE_REVENUE | | ₹100.00 |
| GST_PAYABLE | | ₹18.00 |
| **Total** | **₹1,000.00** | **₹1,000.00** |

Clearing the cash the worker kept (Dr `WORKER_PAYABLE` 1,000 / Cr `CASH_WITH_WORKER` 1,000) leaves `WORKER_PAYABLE` with a ₹118 debit balance, recovered from the next online payout. (TDS treatment of cash jobs is to be confirmed with a CA.)

The ledger preserves the allocations that explain the movement.

---

# 38. Immutable Financial History

After a financial transaction becomes final, avoid silently modifying:

```text
amount
currency
provider ID
fee
refund history
settlement history
```

If a correction is needed:

```text
Original record
      |
      v
Adjustment
```

rather than:

```text
UPDATE old transaction
```

This is critical for reconciliation.

---

# 39. Reconciliation

Reconciliation answers:

> Does our internal financial state match what the payment provider says happened?

Example:

```text
Internal:
Payment #1001 = SUCCEEDED ₹500

Provider:
Payment ABC = captured ₹500
```

Match.

But suppose:

```text
Internal:
SUCCEEDED ₹500

Provider:
FAILED ₹500
```

This is a reconciliation problem.

---

# 40. Reconciliation Process

Periodic reconciliation:

```text
Internal records
      |
      v
Provider records
      |
      v
Compare
      |
 +----+----+
 |         |
 v         v
MATCH    MISMATCH
           |
           v
       Investigation
```

This becomes especially important at scale.

---

# 41. Provider Event Storage

Provider events should be retained sufficiently to debug and reconcile.

Example:

```text
provider_events
-------------------------
id
provider
event_id
event_type
payload            (JSONB)
signature_verified
received_at
processed_at
processing_error
```

`UNIQUE (provider, event_id)`; rows are updated only to set `processed_at` / `processing_error` (ERD §44).

Raw payload storage should follow security and retention policies.

---

# 42. Financial Audit Trail

Important operations should produce audit information:

```text
Payment initiated
Payment succeeded
Refund requested
Refund approved
Refund succeeded
Fee applied
Payout queued
Payout paid
Admin adjustment
Dispute resolution adjustment
```

Admin financial changes should be particularly auditable.

---

# 43. Admin Financial Controls

Admins should not be able to arbitrarily modify:

```text
payment.amount
worker.earnings
settlement.amount
```

through a generic CRUD interface.

Instead, financial actions should be explicit:

```text
Issue refund
Create adjustment
Approve settlement
Resolve payment discrepancy
```

and each action should be audited.

---

# 44. Financial State vs Business State

The platform should never assume:

```text
Job COMPLETED
      =
Payment SUCCEEDED
```

or:

```text
Payment SUCCEEDED
      =
Worker PAID_OUT
```

Instead:

```text
Job
 |
 +--> Payment
        |
        +--> Worker earning
                |
                +--> Settlement
```

These are connected but independent state machines.

---

# 45. Example: Successful Job

Customer:

```text
Job completed
₹500 due
```

Payment:

```text
CREATED
    |
    v
PENDING
    |
    v
SUCCEEDED
```

Worker:

```text
Earning = ₹450
Status = ELIGIBLE
```

Payout:

```text
QUEUED
    |
    v
PROCESSING
    |
    v
PAID (UTR shown to worker)
```

Final (taxes left out for brevity):

```text
Customer paid       ₹500
Platform fee         ₹50
Worker received     ₹450
```

---

# 46. Example: Payment Failure

```text
Job completed
     |
     v
Payment initiated
     |
     v
Provider failure
     |
     v
Payment FAILED
```

The job remains:

```text
WORK_COMPLETED
```

The customer can retry payment according to business rules.

---

# 47. Example: Refund

```text
Payment SUCCEEDED
₹500
   |
   v
Refund REQUESTED
₹500
   |
   v
Refund PROCESSING
   |
   v
Refund SUCCEEDED
```

Worker earning is then adjusted according to its state:

* not yet paid out → earning `REVERSED`, reversing ledger transaction;
* already paid out → earning `REVERSED` and a recovery posted against the worker's `WORKER_PAYABLE`, deducted from their future earnings.

The system must preserve the original payment and the refund rather than rewriting the original payment.

---

# 48. Example: Partial Refund

```text
Payment = ₹1,000

Refund = ₹300
```

Final:

```text
Captured = ₹1,000
Refunded = ₹300
Net = ₹700
```

The payment remains financially meaningful rather than becoming simply:

```text
REFUNDED
```

until the entire captured amount has been refunded.

---

# 49. Payment Security

The system should follow payment-security principles including:

* never store raw card numbers unless explicitly required and compliant
* use provider-hosted/tokenized payment mechanisms where possible
* never log sensitive payment credentials
* verify webhook signatures
* protect provider secrets
* restrict payment administrative operations
* audit refunds and adjustments
* use HTTPS
* apply idempotency
* validate amounts server-side.

---

# 50. Amount Validation

The server must determine the amount to be charged.

Do not trust:

```json
{
  "amount": 100
}
```

from the client.

Instead:

```text
Client
   |
   v
Job / approved charges
   |
   v
Server calculates amount
   |
   v
Payment
```

For additional work:

```text
Worker proposes ₹200
       |
       v
Customer approves
       |
       v
Server records approved amount
       |
       v
Payment
```

---

# 51. Payment Authorization

Only authorized actors should be able to initiate financial operations.

Examples:

```text
Customer
    -> initiate own payment

Worker
    -> cannot charge arbitrary amount

Admin
    -> refund according to permission

System
    -> process provider webhook
```

Authorization should be checked at the application/domain boundary.

---

# 52. Concurrency

Payments create important race conditions.

Example:

```text
Request A -> Refund ₹500
Request B -> Refund ₹500
```

for a:

```text
₹500 payment
```

Without concurrency control:

```text
Total refund = ₹1,000
```

which is invalid.

The system must atomically validate:

```text
captured - alreadyRefunded >= requestedRefund
```

and create the refund.

This is a critical database transaction boundary.

---

# 53. Duplicate Payment

Another race:

```text
Customer clicks Pay
Customer clicks Pay again
```

Idempotency must prevent duplicate financial transactions.

This should be tested under concurrent requests.

---

# 54. Duplicate Webhook

Example:

```text
Webhook 1
Webhook 2
```

arrives simultaneously.

Both must safely converge to:

```text
Payment = SUCCEEDED
```

without duplicate:

```text
earnings
ledger entries
notifications
```

---

# 55. Event-Driven Financial Side Effects

After:

```text
PaymentSucceeded
```

other modules may react:

```text
PaymentSucceeded
       |
       +--> Worker Earnings
       |
       +--> Notification
       |
       +--> Analytics
       |
       +--> Receipt
```

The payment module should not directly contain all of these side effects.

Use domain/application events.

---

# 56. Transactional Outbox

A financial transaction may need to publish events reliably.

Example:

```text
DB transaction
--------------------------------
Payment = SUCCEEDED
Worker earning = created
Ledger transaction = posted (balanced)
Outbox event = PaymentSucceeded
COMMIT
```

Then asynchronous consumers process:

```text
Notification
Analytics
Settlement preparation
```

This prevents an event from being lost after the financial transaction commits.

---

# 57. Payment Notifications

Payment events can produce:

```text
PaymentSucceeded
PaymentFailed
RefundRequested
RefundSucceeded
PayoutPaid
```

The notification architecture from [modules/05](05-notification-and-communication.md) consumes these events.

Payment should not directly call:

```text
sendPush()
sendSMS()
```

---

# 58. Financial Reporting

The platform should eventually support:

### Customer

```text
Payment history
Refund history
Receipts
```

### Worker

```text
Job earnings
Pending earnings
Paid-out earnings
Payout history (with UTR)
Fees owed from cash jobs
```

### Platform

```text
Gross transaction value
Platform fees
Refunds
Provider costs
Outstanding worker payable
Settlement totals
```

---

# 59. Financial Metrics

Important metrics include:

```text
Total payment volume
Successful payment rate
Payment failure rate
Refund rate
Average transaction value
Platform fee revenue
Worker payable amount
Settlement success rate
Provider reconciliation mismatch count
```

These metrics should be generated from authoritative financial data.

---

# 60. Payment Provider Failure

Suppose:

```text
Customer starts payment
      |
      v
Provider timeout
```

The platform should not immediately assume:

```text
FAILED
```

if the provider may have processed the transaction.

Instead:

```text
PENDING
```

may remain until:

* provider response
* webhook
* provider status query
* reconciliation.

This prevents accidental duplicate charges.

---

# 61. Network Failure During Payment

Example:

```text
Backend -> provider
Backend <- payment success
Backend crashes before response to client
```

Customer sees:

```text
timeout
```

and retries.

Idempotency + provider transaction lookup must prevent a second charge.

This is one of the reasons payment idempotency is mandatory.

---

# 62. Refund Provider Failure

Suppose:

```text
Refund requested
      |
      v
Provider timeout
```

Do not assume:

```text
refund failed
```

immediately.

The provider may have created the refund.

The platform may need:

```text
provider status lookup
webhook
reconciliation
```

before determining the final state.

---

# 63. Worker Payout Failure

Suppose:

```text
Worker earning = ₹450
Payout PROCESSING
      |
      X bank/provider failure
```

The earning should not disappear.

Instead:

```text
Payout = FAILED
Worker earning = still ELIGIBLE
Worker payable = still ₹450
```

subject to applicable settlement rules.

---

# 64. Financial Data Model — Conceptual

At high level:

```text
Payment
   |
   +---- ProviderTransaction
   |
   +---- Refund
   |
   +---- FeeAllocation
   |
   +---- WorkerEarning
             |
             +---- Settlement
```

Separately:

```text
Financial Transaction
       |
       v
Ledger Entries
```

And:

```text
ProviderEvent
       |
       v
Reconciliation
```

The table design is now in the ERD: `payments`, `payment_allocations`, `provider_events`, `refunds`, `worker_earnings`, `tax_rates`, `worker_payout_accounts`, `payouts`, `payout_items`, `ledger_accounts`, `ledger_transactions`, `ledger_entries`, `invoices` (ERD §43–46.4).

---

# 65. Proposed Financial Module

High-level package:

```text
payment/
├── api/
├── application/
│   ├── command/
│   ├── query/
│   ├── service/
│   └── policy/
├── domain/
│   ├── model/
│   ├── event/
│   ├── valueobject/
│   └── exception/
└── infrastructure/
    ├── persistence/
    ├── provider/
    │   ├── razorpay/
    │   ├── cashfree/
    │   └── common/
    ├── webhook/
    ├── reconciliation/
    └── configuration/
```

Detailed Java classes/interfaces are intentionally postponed to the LLD phase.

---

# 66. MVP Scope

The first version should remain manageable.

### Include

```text
Customer payment
One primary payment provider (with marketplace split settlement)
Cash payments (worker-collected, customer-confirmed)
Staged payments (visit charge, material advance, daily/weekly wages, final)
Payment status
Provider transaction ID
Webhook handling
Webhook signature validation
Idempotency
Payment failure handling
Basic refunds
Partial refunds
Payment history
Basic worker earnings (fee, GST, TDS, TCS)
Payout accounts (UPI / bank, penny-drop verified) and payouts
Minimal double-entry ledger
GST invoices
Financial audit trail
```

### Design for later

```text
Multiple payment providers
Provider failover
Payment authorization/capture
Automated settlement batching
Complex fee rules
Advanced reconciliation
Accounting integrations
Tax filing automation
Multi-currency
International payments
```

---

# 67. What Should NOT Be Done

Avoid:

```text
payment.status = SUCCEEDED
```

based only on frontend response.

Avoid:

```text
double amount
```

Avoid:

```text
UPDATE payment SET amount = ...
```

for historical corrections.

Avoid:

```text
refund = true
```

instead of a refund record.

Avoid:

```text
worker.balance = worker.balance + 450
```

without financial history.

Avoid:

```text
Razorpay/Cashfree SDK directly inside BookingService
```

Avoid trusting:

```text
client-provided amount
```

Avoid processing webhooks without signature verification.

Avoid holding customer money in the platform's own bank account; use the provider's split settlement.

Avoid single-sided ledger entries; every transaction must balance.

Avoid treating provider timeout as guaranteed payment failure.

---

# 68. Core Financial Invariants

### FI-001

Money is represented using integer minor units.

### FI-002

Every monetary record has an explicit currency.

### FI-003

Payment amount is determined by the server.

### FI-004

Payment creation is idempotent.

### FI-005

Provider transaction identifiers are unique within the provider namespace.

### FI-006

Provider webhook events are idempotent.

### FI-007

Unverified webhooks are rejected.

### FI-008

Refunded amount cannot exceed captured amount.

### FI-009

Historical financial records are not silently rewritten.

### FI-010

Worker earnings are separate from worker settlement.

### FI-011

Provider failures do not automatically imply financial failure.

### FI-012

Financial operations are auditable.

### FI-013

Concurrent refund operations cannot exceed the refundable amount.

### FI-014

Financial side effects are recoverable.

### FI-015

Client-side payment status is never the authoritative financial state.

### FI-016

Every ledger transaction balances (total debits = total credits); ledger rows are append-only.

### FI-017

A refund after payout creates a recovery against the worker's future earnings.

---

# 69. End-to-End Example

Consider:

```text
Electrician job
₹500
```

### Step 1 — Job completion

```text
Job
WORK_COMPLETED
```

### Step 2 — Payment

```text
Payment
₹500
PENDING
```

### Step 3 — Provider

```text
Provider
payment.captured
```

### Step 4 — Webhook

```text
PaymentSucceeded
```

### Step 5 — Internal state

```text
Payment
SUCCEEDED
```

### Step 6 — Fee allocation

```text
Gross          ₹500
Platform fee    ₹50
Worker payable ₹450   (before GST on fee / TDS / TCS; see §31)
```

### Step 7 — Worker earning

```text
Earning
₹450
ELIGIBLE
```

### Step 8 — Settlement

```text
Payout
₹450
PROCESSING
```

### Step 9 — Provider payout

```text
PAID (UTR recorded)
```

### Final

```text
Customer paid:     ₹500
Platform fee:       ₹50
Worker received:   ₹450
```

Every stage remains independently traceable.

---

# 70. Future Marketplace Evolution

As the marketplace grows, the financial architecture may eventually support:

```text
Customer
   |
   v
Payment
   |
   +--> Platform revenue
   |
   +--> Worker earnings
   |
   +--> Taxes/fees
   |
   +--> Provider costs
   |
   +--> Refunds
   |
   +--> Adjustments
   |
   v
Settlement
```

The system should therefore avoid embedding today's simple:

```text
₹500 -> worker ₹450
```

calculation directly into unrelated business logic.

---

# 71. Scaling Architecture

Initial:

```text
Spring Boot Modular Monolith
        |
        v
PostgreSQL
        |
        +--> Payment Provider
```

Growing:

```text
Application Instances
        |
        v
Payment Module
        |
        +--> Outbox
        |
        +--> Background Workers
        |
        v
Payment Provider
```

At larger scale:

```text
Payment Events
      |
      v
Event Backbone
      |
 +----+--------+--------+
 |             |        |
 v             v        v
Earnings    Ledger   Analytics
 |             |
 v             v
Settlement  Reconciliation
```

The initial system does not need a payment microservice.

---

# 72. Observability

Every payment operation should be traceable through:

```text
requestId
paymentId
jobId
bookingId
provider
providerTransactionId
providerEventId
```

Logs should allow engineers to answer:

> What happened to payment #X?

without searching blindly through unrelated logs.

Sensitive financial information must not be logged unnecessarily.

---

# 73. Operational Dashboard

Eventually the admin platform should show:

```text
Payments
--------------------------------
Successful
Pending
Failed
Refunded
```

and:

```text
Provider Health
--------------------------------
Success rate
Failure rate
Webhook latency
Webhook failures
Reconciliation mismatches
```

and:

```text
Payouts
--------------------------------
Queued
Processing
Paid
Failed
```

---

# 74. Final Architecture

The financial architecture becomes:

```text
                     CUSTOMER
                        |
                        v
                    Payment API
                        |
                        v
                     Payment
                        |
                 +------+------+
                 |             |
                 v             v
          Payment Provider   Ledger
                 |
                 v
             Webhooks
                 |
                 v
          Provider Events
                 |
                 v
          Reconciliation
                 |
                 v
          Financial State
                 |
          +------+------+
          |             |
          v             v
     Worker Earning   Refund
          |
          v
      Settlement
          |
          v
      Worker Bank
```

The important separation is:

```text
Payment
   ≠
Refund
   ≠
Earning
   ≠
Settlement
   ≠
Ledger
```

---

# 75. Final Engineering Principles

1. **Never trust the client for financial truth.**
2. **Use integer minor units for money.**
3. **Always preserve currency.**
4. **Use idempotency everywhere financial duplication is possible.**
5. **Treat provider webhooks as asynchronous external events.**
6. **Verify webhook signatures.**
7. **Persist provider event IDs.**
8. **Keep payment state separate from job state.**
9. **Keep worker earnings separate from settlements.**
10. **Represent refunds independently.**
11. **Never silently rewrite finalized financial history.**
12. **Preserve actual fees applied to historical transactions.**
13. **Make financial operations auditable.**
14. **Design for reconciliation from the beginning.**
15. **Assume networks and providers can fail after performing an operation.**
16. **Make duplicate requests safe.**
17. **Keep payment providers behind an abstraction boundary.**
18. **Use transactional outbox for reliable financial events.**
19. **Use database transactions for critical financial invariants.**
20. **Do not introduce payment microservices prematurely.**
21. **Detailed implementation and Java LLD will come after the remaining architecture documentation.**

---

# 76. Decision Summary

| Area                           | Decision                           |
| ------------------------------ | ---------------------------------- |
| Money                          | Integer minor units                |
| Currency                       | Explicit                           |
| Payment source of truth        | Backend + verified provider events |
| Client payment status          | Not authoritative                  |
| Provider integration           | Adapter/port abstraction           |
| Webhooks                       | Required                           |
| Webhook signature verification | Required                           |
| Webhook idempotency            | Required                           |
| Payment idempotency            | Required                           |
| Refund model                   | Separate records                   |
| Partial refund                 | Supported                          |
| Worker earnings                | Separate from payment              |
| Settlement                     | Separate from earnings             |
| Ledger                         | True double-entry, append-only     |
| Customer funds                 | Provider split settlement only     |
| Cash payments                  | Supported, customer-confirmed      |
| Tax rates                      | Data (`tax_rates`), CA to confirm  |
| Reconciliation                 | Designed from beginning            |
| Historical mutation            | Avoid                              |
| Financial audit                | Required                           |
| Kafka                          | Not initially                      |
| Payment microservice           | Not initially                      |
| PostgreSQL                     | Financial source of truth          |
| Redis                          | Supporting only                    |
| LLD                            | Deferred                           |

---

## Final Principle

For this marketplace, the payment system should be designed around one question:

> **Can we explain exactly what happened to every rupee?**

For any completed job, we should eventually be able to trace:

```text
Job
 ↓
Charge
 ↓
Provider transaction
 ↓
Customer payment
 ↓
Platform fee
 ↓
Worker earning
 ↓
Refund/adjustment, if any
 ↓
Settlement
 ↓
Worker payout
```

If the system can reconstruct that chain reliably—even months later—we have the foundation required for a trustworthy marketplace financial system.
