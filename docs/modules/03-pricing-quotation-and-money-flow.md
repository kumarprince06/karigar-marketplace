# Pricing, Quotation, Additional Charges & Marketplace Money Flow

**Project:** Karigar Marketplace
**Initial Market:** Howrah / Kolkata
**Architecture:** Java + Spring Boot Modular Monolith
**Database:** PostgreSQL + PostGIS
**Document Type:** Product + Domain + System Design
**Status:** Draft for Architecture Review

---

## Current Model (aligned with ERD and ADRs)

> The ERD ([architecture/03](../architecture/03-erd-and-production-database-design.md)) is the source of truth for tables, columns and states. Where this document and the ERD disagree, the ERD wins. See also [ADR 0006](../adr/0006-money-integer-minor-units.md) (money as integer minor units) and [ADR 0007](../adr/0007-payment-provider-abstraction.md) (payment provider abstraction).

* **Money (ERD §42):** integer paise (`amount_minor BIGINT`) plus `currency = 'INR'`. Never `FLOAT`/`DOUBLE` and never `NUMERIC` rupees. Percentages and quantity × unit price are rounded half-up to whole paise. The backend computes every amount; client-sent amounts and totals are ignored.
* **Worker rates (ERD §14.2, `worker_rates`):** per worker per trade — `VISIT`, `HOURLY`, `HALF_DAY`, `DAILY` (hajira), `PER_UNIT` (with `unit`: `SQ_FT`, `RUNNING_FT`, `POINT`, `PIECE`, `TAP`, `FIXTURE`, `KG`, `TANK`) and `MINIMUM`. A rate change closes the current row and inserts a new one; rows are never edited in place.
* **Price snapshot (ERD §35, `bookings`):** the booking copies the agreed rate — `agreed_rate_type` (any rate type above, or `QUOTE`), `agreed_unit`, `agreed_amount_minor`, `helper_count`, `helper_day_rate_minor`. It is never a foreign key to `worker_rates`.
* **Quotes (ERD §41):** `quote_kind` = `INITIAL | REVISION | ADDITIONAL`; status = `DRAFT`, `SUBMITTED`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `SUPERSEDED`, `WITHDRAWN`. Line types: `LABOUR`, `MATERIAL` (with `supplied_by` = `WORKER | CUSTOMER`), `HELPER`, `VISIT_CHARGE`, `TRANSPORT`, `DISCOUNT` (negative amount), `OTHER`. A quote is immutable once submitted; a change is a new `REVISION` and the old quote becomes `SUPERSEDED`. Additional work is an `ADDITIONAL` quote on the running job.
* **Material (ERD §41.1, `material_bills`):** actual shop bills are recorded against the job. A bill above the quoted material amount needs customer acknowledgement before it is charged. Material reimbursement carries no commission.
* **Multi-day jobs (ERD §40.1, `job_visits`):** one visit row per working day with `labour_amount_minor` and `helper_amount_minor`, fixed when the customer confirms the day. `bookings.payment_schedule` = `ON_COMPLETION | DAILY | WEEKLY | MILESTONE`. `payment_allocations` link each payment to the visits or quotes it covers.
* **Payments (ERD §43–45):** purpose `VISIT_CHARGE | MATERIAL_ADVANCE | DAILY_WAGE | MILESTONE | FINAL | ADDITIONAL`; method `UPI | CARD | NETBANKING | WALLET | CASH`; `collected_by` `PLATFORM | WORKER`; status `CREATED`, `PENDING`, `SUCCEEDED`, `FAILED`, `CANCELLED`. Online status comes only from signature-verified webhooks (`provider_events`, `UNIQUE (provider, event_id)`); cash is confirmed by the customer. Every money command carries an idempotency key. The platform never holds customer money in its own bank account: online money moves through the provider's marketplace split settlement (e.g. Razorpay Route or Cashfree Easy Split), in line with RBI payment-aggregator rules. The provider is still open (ADR 0007).
* **Refunds, earnings, tax and ledger (ERD §46–46.4):** refunds are separate records whose total never exceeds the payment. `worker_earnings` splits gross into platform fee, GST on the fee, TDS (194-O), TCS (GST s.52, only for GST-registered workers), material reimbursement and net; net is negative for cash jobs (the worker owes the fee). Tax rates are data (`tax_rates` with effective dates). Every money movement is a balanced double-entry ledger transaction. Details are in [modules/06](06-payments-refunds-settlement-and-ledger.md).

---

## 1. Purpose

This document defines how money moves through the platform.

The system must support:

* service pricing
* fixed-price services
* worker quotations
* customer approval
* additional work
* platform fees
* worker earnings
* taxes
* payments
* refunds
* cancellations
* disputes
* financial history
* reconciliation
* future marketplace settlement

The goal is **not** to finalize the business pricing model yet.

Instead, the architecture should allow different pricing models to be introduced without redesigning the entire payment system.

---

# 2. Core Principle

The platform must separate:

> **What the customer was charged**

from:

> **What the worker earned**

from:

> **What the platform earned**

and:

> **What money was actually received/refunded/settled.**

These are related but are not the same concept.

For example:

```text
Customer pays        ₹600
        │
        ├── Worker earnings      ₹500
        ├── Platform fee          ₹70
        └── Tax/other adjustment  ₹30
```

The exact amounts above are illustrative only.

The system must preserve the breakdown rather than storing only:

```text
payment.amount = 600
```

---

# 3. Pricing Models

The marketplace may eventually support multiple pricing models.

## 3.1 Fixed Price

Example:

```text
Service: Fan installation
Price: ₹500
```

The customer sees a predetermined price.

Flow:

```text
Customer selects service
        ↓
System calculates price
        ↓
Customer confirms
        ↓
Booking
        ↓
Payment
```

Useful when the work is standardized.

Examples:

* fan installation
* switch replacement
* tap replacement
* minor repair
* basic inspection

---

# 3.2 Starting Price

Some jobs cannot be accurately priced before inspection.

Example:

```text
Tap repair
Starting from ₹199
```

The final price may depend on:

* parts
* complexity
* labor
* travel
* additional work.

Therefore:

```text
Starting Price
      ↓
Inspection
      ↓
Final Quote
      ↓
Customer Approval
```

---

# 3.3 Worker Quotation

For complex jobs, workers may provide a quote.

Example:

Customer:

> "Need wiring work for a 2BHK apartment."

Worker:

```text
Labor       ₹4,000
Materials   ₹6,500
------------------
Total       ₹10,500
```

Customer can:

```text
ACCEPT
REJECT
REQUEST_CLARIFICATION
```

`REQUEST_CLARIFICATION` is a conversation, not a quote status: the quote stays `SUBMITTED` until the customer accepts or rejects it, or the worker submits a `REVISION` (ERD §41).

Only after customer approval should the quote become part of the confirmed commercial agreement.

---

# 3.4 Negotiated Pricing

Future possibility:

```text
Customer requests job
        ↓
Worker proposes ₹800
        ↓
Customer proposes ₹700
        ↓
Worker accepts ₹700
        ↓
Final agreed price = ₹700
```

This should not be implemented initially unless validated by the marketplace.

However, the domain should not make negotiation impossible.

---

# 4. Pricing Must Be Versioned

One of the most important financial rules:

> Never rely on the current catalog price to determine the historical price of an old booking.

Suppose:

```text
January:
Fan installation = ₹400
```

Later:

```text
June:
Fan installation = ₹550
```

A January booking must continue to show:

```text
₹400
```

even though the catalog now says:

```text
₹550
```

Therefore, when a price is agreed, the system must create a **price snapshot**.

---

# 5. Price Snapshot

A booking should retain the agreed commercial information.

Conceptually:

```text
Booking
 ├── pricingSnapshot
 │     ├── baseAmount
 │     ├── platformFee
 │     ├── tax
 │     ├── discount
 │     ├── additionalCharges
 │     ├── customerTotal
 │     └── workerEarnings
```

In the ERD this is the agreed-rate snapshot on `bookings` (`agreed_rate_type`, `agreed_unit`, `agreed_amount_minor`, helper fields) plus the accepted quote and its line items, which are immutable (ERD §35, §41). The fee/tax split is snapshotted later on `worker_earnings` (ERD §46.1).

The important rule is:

> Historical financial information must remain immutable.

---

# 6. Money Representation

Never use:

```java
double
float
```

for financial amounts.

Bad:

```java
double amount = 499.99;
```

Floating-point arithmetic can introduce precision problems.

---

## 6.1 Recommended Representation

Use minor currency units.

For INR:

```text
₹500 = 50000 paise
```

Conceptually:

```text
amountMinor = 50000
currency = INR
```

Database:

```text
amount_minor BIGINT
currency CHAR(3)
```

This gives deterministic arithmetic. `NUMERIC` rupee columns are not used either. Percentages (commission, GST, TDS, TCS) and quantity × unit price are rounded **half-up to whole paise** (ERD §41, §42).

---

# 7. Money Value Object

The domain should conceptually have:

```text
Money
 ├── amountMinor
 └── currency
```

Operations:

```text
add()
subtract()
multiply()
compare()
```

Rules:

```text
Money(INR, 500)
+
Money(INR, 200)

= Money(INR, 700)
```

But:

```text
Money(INR, 500)
+
Money(USD, 200)
```

must fail.

Different currencies must not be silently combined.

---

# 8. Price Breakdown

Instead of storing only:

```text
total = ₹800
```

the system should understand the components.

Example:

```text
Base Service       ₹600
Platform Fee        ₹50
Tax                 ₹90
Discount           -₹40
-----------------------
Customer Total     ₹700
```

Potential conceptual structure:

```text
PriceBreakdown
 ├── baseAmount
 ├── additionalCharges
 ├── platformFee
 ├── taxes
 ├── discounts
 └── total
```

---

# 9. Customer Total

The customer-facing amount should be explicitly calculated.

Conceptually:

```text
customerTotal =
    baseAmount
  + additionalCharges
  + platformFee
  + taxes
  - discounts
```

The calculation must be deterministic.

In the current model the customer pays the sum of the accepted quote lines (or the agreed-rate snapshot / confirmed visit amounts) — `LABOUR`, `MATERIAL`, `HELPER`, `VISIT_CHARGE`, `TRANSPORT`, `OTHER`, minus `DISCOUNT`. The platform fee is a commission taken out of the worker's gross in `worker_earnings`; a separate customer-side fee is still an open decision (§54).

---

# 10. Worker Earnings

Worker earnings should be calculated separately.

Example:

```text
Customer pays (gross)          ₹1,000.00

Platform fee (10%)               ₹100.00
GST on fee (18%)                  ₹18.00
TDS u/s 194-O (0.1%)               ₹1.00
TCS u/s 52 (GST-registered only)   ₹0.00
-----------------------------------------
Worker net                       ₹881.00
```

Rates are illustrative; real rates come from `tax_rates` (effective-dated data) and the commission rule, and every amount is rounded half-up to whole paise.

As stored in `worker_earnings` (ERD §46.1):

```text
net_minor =
    gross_minor
  - platform_fee_minor
  - gst_on_fee_minor
  - tds_minor
  - tcs_minor
```

`material_reimbursement_minor` (material the worker bought) is passed through with no commission. For a **cash** job the worker already holds the gross, so `net_minor` is negative: the worker owes the fee and taxes, recovered from the next online payout.

Do not calculate worker earnings from the customer's final payment by simply doing:

```text
payment - platformFee
```

because future systems may contain:

* taxes
* discounts
* subsidies
* refunds
* adjustments
* commissions
* promotional credits
* tips
* cancellation fees.

---

# 11. Platform Revenue

Platform revenue must be represented independently.

For example:

```text
Booking
   │
   ├── Customer amount
   │
   ├── Worker earnings
   │
   └── Platform revenue
```

This makes financial reporting possible.

For example:

```text
Today's completed jobs
        ↓
Customer GMV
        ↓
Platform revenue
        ↓
Worker earnings
        ↓
Refunds
        ↓
Net marketplace revenue
```

---

# 12. Gross Merchandise Value

A useful marketplace metric is:

```text
GMV
```

Generally representing the total value of transactions processed through the marketplace before certain deductions, depending on the reporting definition.

The exact accounting definition should be finalized with finance/accounting requirements.

The important architecture principle is:

> Do not derive important financial metrics from mutable current records.

Financial reporting should be based on immutable transaction records or a proper ledger/event history.

---

# 13. Quotation Domain

A quotation is different from a payment.

Example:

```text
Worker submits quote:

Labor        ₹2,000
Materials    ₹1,500
-------------------
Total        ₹3,500
```

This does not mean:

```text
₹3,500 successfully paid
```

The lifecycle should therefore be independent.

---

# 14. Quote State Machine

Conceptually:

```text
DRAFT
  ↓
SUBMITTED                  (waiting for the customer)
  ├── ACCEPTED
  ├── REJECTED
  ├── EXPIRED              (valid_until passed)
  ├── SUPERSEDED           (worker submitted a REVISION)
  └── WITHDRAWN            (worker withdrew it)
```

These are the ERD statuses (§41). There is no separate `PENDING_CUSTOMER` or `REVISION_REQUESTED` state: `SUBMITTED` means waiting for the customer, and a revision is a new quote with `quote_kind = REVISION`.

`quote_kind` is `INITIAL`, `REVISION` or `ADDITIONAL`. Line items are `LABOUR`, `MATERIAL` (`supplied_by` `WORKER | CUSTOMER`), `HELPER`, `VISIT_CHARGE`, `TRANSPORT`, `DISCOUNT` (negative) and `OTHER`; each line is `ROUND_HALF_UP(quantity × unit_price_minor)` and the total is the sum of lines.

After acceptance:

```text
Quote Accepted
      ↓
Price Snapshot
      ↓
Booking / Job
```

---

# 15. Quote Immutability

Suppose worker submits:

```text
₹5,000
```

Customer accepts.

The worker should not be able to silently modify it to:

```text
₹7,000
```

Instead:

```text
Original Quote
      ↓
Revision
      ↓
Customer Approval
```

Every commercially meaningful change must create an explicit history. A quote is immutable once `SUBMITTED`; the revision is a new quote (`quote_kind = REVISION`, `revision_of_quote_id` set) and the old one becomes `SUPERSEDED`.

---

# 16. Additional Work

Real-world service jobs frequently change after inspection.

Example:

Customer requests:

> Repair leaking tap.

Worker discovers:

> Pipe inside wall is damaged.

Worker proposes:

```text
Additional pipe work = ₹800
```

Customer must explicitly approve.

Flow:

```text
Worker
  ↓
ADDITIONAL quote (on the running job)
  ↓
Customer
  ├── ACCEPT
  └── REJECT
```

Additional work is modelled as a quote with `quote_kind = ADDITIONAL` and `job_id` set (ERD §41); there is no separate additional-work table.

---

# 17. Additional Work Rules

An additional work proposal is an `ADDITIONAL` quote, so it has the same fields as any quote (ERD §41):

```text
quotes.id
quotes.job_id
quotes.quote_kind = ADDITIONAL
quote_line_items (LABOUR, MATERIAL, ...)
quotes.total_minor
quotes.status
quotes.submitted_at
quotes.decided_at / decided_by_user_id
```

Once accepted:

```text
ACCEPTED
```

the amount is added to the job's payable amount and becomes part of the agreed financial record. Rejecting it leaves the job unchanged.

It should not be silently edited.

If the worker needs another amount:

```text
₹800 approved

Later:
₹1,000 required
```

create another `ADDITIONAL` quote (or a `REVISION` of the open one). Material bills above the quoted material amount also need customer acknowledgement before they are charged (ERD §41.1).

---

# 18. Payment vs Pricing

These are different concepts.

### Pricing

Answers:

> How much should the customer pay?

### Payment

Answers:

> Did the customer actually pay?

Example:

```text
Agreed price = ₹1,000

Payment:
PENDING
```

The customer owes ₹1,000, but money has not necessarily been received.

Another case:

```text
Agreed price = ₹1,000

Payment:
SUCCEEDED
```

Now the provider has confirmed payment.

---

# 19. Payment State Machine

Conceptually:

```text
CREATED
    ↓
PENDING
    ├── SUCCEEDED
    ├── FAILED
    └── CANCELLED
```

These are the ERD statuses (§43). Refunds are not payment states: they are separate `refunds` rows (`REQUESTED → PROCESSING → SUCCEEDED | FAILED`), and "refunded" / "partially refunded" is derived from them.

Provider-specific states should be mapped into the platform's internal state model. Online payments become `SUCCEEDED` only from a signature-verified webhook; cash payments become `SUCCEEDED` when the customer confirms them.

---

# 20. Payment Provider Abstraction

The domain should not directly depend on:

```text
Razorpay SDK
Cashfree SDK
```

Instead:

```text
Payment Application
        ↓
PaymentGateway
        ↓
Provider Implementation
```

Conceptually:

```text
PaymentGateway
     ├── RazorpayPaymentGateway
     ├── CashfreePaymentGateway
     └── FutureProvider
```

This allows provider changes without rewriting the payment domain. The concrete provider is still open (ADR 0007). Whichever is chosen must offer marketplace split settlement (e.g. Razorpay Route, Cashfree Easy Split) so the platform never holds customer money in its own account.

---

# 21. Payment Intent

The application should create a payment intent/request before attempting payment.

Conceptually:

```text
Payment
 ├── paymentId
 ├── jobId
 ├── customerId
 ├── workerId
 ├── purpose          (VISIT_CHARGE | MATERIAL_ADVANCE | DAILY_WAGE | MILESTONE | FINAL | ADDITIONAL)
 ├── method           (UPI | CARD | NETBANKING | WALLET | CASH)
 ├── collectedBy      (PLATFORM | WORKER)
 ├── amountMinor      (computed by the backend)
 ├── currency
 ├── provider
 ├── providerOrderId
 ├── providerPaymentId
 ├── status
 └── idempotencyKey
```

The client asks to pay for a job and a purpose; it never sends the amount. The backend computes `amountMinor` from confirmed visits and accepted quotes and records which ones the payment covers in `payment_allocations` (ERD §43).

---

# 22. Idempotency

Financial operations must be idempotent.

Suppose the client sends:

```text
POST /payments
{ "jobId": "...", "purpose": "FINAL", "method": "UPI" }
```

(no amount — the backend computes it) and network failure occurs.

The client retries.

Without idempotency:

```text
₹1,000
₹1,000
```

could potentially be charged twice.

With:

```text
Idempotency-Key: abc123
```

the system recognizes the retry as the same operation.

---

# 23. Webhook Handling

Payment providers may notify the application asynchronously.

Example:

```text
Payment Provider
       ↓
Webhook
       ↓
API
       ↓
Validate signature
       ↓
Check provider event ID
       ↓
Update payment
       ↓
Publish event
```

The system must never blindly trust:

```text
payment_status = SUCCEEDED
```

from an unverified request. Online payment status is set only from signature-verified webhooks stored in `provider_events` (ERD §44).

---

# 24. Webhook Idempotency

Payment providers may send the same webhook more than once.

Example:

```text
payment.captured
payment.captured
payment.captured
```

The system should process it once.

Maintain provider event identity:

```text
provider
event_id
```

with a uniqueness constraint: `UNIQUE (provider, event_id)` on `provider_events`.

---

# 25. Refunds

Refunds should be separate financial records.

One payment can have:

```text
Payment = ₹1,000

Refund 1 = ₹200
Refund 2 = ₹300
```

Total:

```text
₹500 refunded
₹500 remaining
```

Therefore:

```text
refunds
```

should not simply overwrite:

```text
payment.amount
```

---

# 26. Refund Invariant

The platform must enforce:

```text
totalRefunded <= totalCaptured
```

Example:

```text
Captured = ₹1,000
Refunded = ₹700
```

Valid.

But:

```text
Captured = ₹1,000
Refunded = ₹1,200
```

must never be allowed. The check sums all non-failed refunds with the payment row locked (`SELECT … FOR UPDATE`). Refund statuses are `REQUESTED`, `PROCESSING`, `SUCCEEDED`, `FAILED`, and each refund carries a `reason_code` (ERD §46).

Two special cases:

* **Cash payments** cannot be refunded through the provider; they are settled by a ledger `ADJUSTMENT` (the worker returns the cash, or the platform pays the customer by UPI).
* **Refund after the worker was paid out:** the worker's earning is reversed and a recovery entry is posted against the worker in the ledger, recovered from their future earnings — the money is not lost.

---

# 27. Cancellation and Money

Cancellation can have financial consequences.

Possible scenarios:

### Before worker accepts

```text
No payment
```

### After booking but before work

```text
Cancellation
       ↓
Possible fee
```

### Worker no-show

```text
Customer cancellation/refund
       ↓
Potential worker penalty
```

### Customer no-show

```text
Possible cancellation fee
```

The exact policy is a product/business decision. The fee charged is recorded on the booking (`cancellation_fee_minor`, ERD §35).

The architecture must support it without embedding arbitrary percentages throughout the codebase.

---

# 28. Pricing Policy

Pricing rules should be represented through policies rather than scattered conditionals.

Conceptually:

```text
PricingPolicy
CancellationPolicy
CommissionPolicy
RefundPolicy
TaxPolicy
```

For example:

```text
CommissionPolicy
      ↓
calculateCommission(...)
```

rather than:

```java
if (amount > 500) {
    fee = amount * 0.10;
}
```

inside random services.

This will become particularly important when pricing evolves.

---

# 29. Discounts

Future discounts may come from:

* promotional campaigns
* referral credits
* first-job discounts
* worker-funded discounts
* platform-funded discounts.

The system must distinguish:

```text
Original Price
Discount
Customer Payable
```

Example:

```text
Service             ₹1,000
Platform discount    -₹100
----------------------------
Customer pays        ₹900
```

The worker may still receive:

```text
₹1,000
```

if the platform funds the discount.

Or:

```text
₹900
```

if the worker funds it.

Therefore, discount ownership matters.

---

# 30. Tips

Tips should be considered separately from the base service price.

Example:

```text
Service       ₹800
Tip           ₹100
-----------------
Customer      ₹900
```

Worker earnings:

```text
Service earning ₹700
Tip              ₹100
---------------------
Worker           ₹800
```

Tip handling may be introduced later.

---

# 31. Worker Earnings Lifecycle

Worker earnings should not immediately mean:

> Money is already in the worker's bank account.

There are multiple concepts:

```text
worker_earnings:  PENDING → ELIGIBLE → PAID_OUT
                     │          │
                     └──→ ON_HOLD (e.g. dispute) ──→ ELIGIBLE
                  any → REVERSED (refund / dispute outcome)

payouts:          QUEUED → PROCESSING → PAID (with bank UTR)
                                      ├→ FAILED
                                      └→ REVERSED
```

These are the ERD statuses (§46.1, §46.2). An earning becomes `ELIGIBLE` after the dispute window (`eligible_at`). Payouts go to a verified payout account (UPI VPA or bank account + IFSC, only the last 4 digits stored, penny-drop verified).

---

# 32. Settlement

Marketplace settlement means transferring money to workers.

Conceptually:

```text
Customer Payment
       ↓
Payment provider (marketplace split settlement)
       ↓                       ↘
Financial Ledger              Platform fee + taxes → platform account
       ↓
Worker Payable Balance
       ↓
Payout (provider transfer)
       ↓
Worker UPI / Bank Account
```

The platform never holds customer money in its own bank account. The provider's marketplace/split-settlement product (e.g. Razorpay Route or Cashfree Easy Split) holds and splits the funds, in line with RBI payment-aggregator rules; the platform's ledger records what each party is owed.

Settlement should be separated from customer payment.

---

# 33. Why Payment and Settlement Must Be Separate

Example:

```text
Customer pays ₹1,000
```

does not necessarily mean:

```text
Worker receives ₹900 immediately.
```

There may be:

* payment settlement delay
* dispute window
* refund risk
* platform fee
* tax withholding
* payout schedule
* failed bank transfer.

Therefore:

```text
Payment
≠
Worker Payout
```

---

# 34. Financial Ledger

As the marketplace grows, a proper ledger becomes important.

Instead of relying only on mutable records:

```text
payment.status
worker.balance
platform.revenue
```

the system can maintain financial entries.

The ERD (§46.3) uses a true double-entry ledger: `ledger_accounts`, `ledger_transactions` and `ledger_entries`.

```text
Ledger Entry

id
ledger_transaction_id
account_id
direction        (D | C)
amount_minor     (always positive)
```

For every transaction, total debits = total credits.

Example — ₹1,000 UPI payment, 10% fee, 18% GST on the fee, 0.1% TDS (rates illustrative; real rates come from `tax_rates`):

| Account | Debit | Credit |
|---|---|---|
| GATEWAY_CLEARING | ₹1,000.00 | |
| PLATFORM_FEE_REVENUE | | ₹100.00 |
| GST_PAYABLE | | ₹18.00 |
| TDS_PAYABLE | | ₹1.00 |
| WORKER_PAYABLE (worker) | | ₹881.00 |
| **Total** | **₹1,000.00** | **₹1,000.00** |

The provider's fee (MDR) is posted as its own balanced transaction: Dr `GATEWAY_FEE_EXPENSE` / Cr `GATEWAY_CLEARING`.

The exact chart of accounts should be confirmed with a chartered accountant.

---

# 35. Ledger Principles

A financial ledger should ideally be:

### Append-oriented

Do not rewrite historical entries.

### Auditable

Every entry should have a reference.

### Balanced

For a double-entry implementation:

```text
Total Debits = Total Credits
```

per transaction, enforced at commit. Mistakes are corrected with an `ADJUSTMENT` transaction, never by updating or deleting entries.

### Traceable

Every financial movement should point to:

```text
payment
refund
payout
adjustment
booking
job
```

---

# 36. Why a Ledger Is Different From CRUD

Normal CRUD:

```text
UPDATE worker
SET balance = 900
```

is dangerous as the sole source of financial truth.

Suppose the balance becomes wrong.

How do we know:

```text
Why is balance ₹900?
```

A ledger can answer. Statement of the worker's `WORKER_PAYABLE` account (each line is one side of a balanced transaction; balance = credits − debits):

```text
Transaction       Debit    Credit
Job #1001                  ₹500
Job #1002                  ₹400
Refund #R1        ₹200
Adjustment #A1             ₹200
---------------------------------
Balance (Cr)               ₹900
```

This creates an audit trail.

---

# 37. Financial Reconciliation

The platform must eventually reconcile:

```text
Internal records
        ↕
Payment provider
        ↕
Bank / settlement records
```

Example:

```text
Internal:
₹10,00,000 received

Provider:
₹9,98,000 received
```

This mismatch must be detectable.

---

# 38. Reconciliation Process

Future scheduled process:

```text
Fetch provider transactions
        ↓
Compare with internal payments
        ↓
Match
        ↓
Identify discrepancies
        ↓
Create reconciliation records
        ↓
Alert operations/finance
```

This should be an operational capability, not a manual SQL exercise.

---

# 39. Financial Audit Trail

Important events should be retained.

Examples:

```text
PRICE_CREATED
QUOTE_SUBMITTED
QUOTE_ACCEPTED
ADDITIONAL_WORK_APPROVED
PAYMENT_CREATED
PAYMENT_SUCCEEDED
PAYMENT_FAILED
CASH_PAYMENT_CONFIRMED
REFUND_REQUESTED
REFUND_SUCCEEDED
PAYOUT_QUEUED
PAYOUT_PAID
FINANCIAL_ADJUSTMENT
```

Each event should have:

```text
timestamp
actor
reference
amount
currency
reason
requestId
metadata
```

---

# 40. Financial Adjustments

Operational teams may occasionally need adjustments.

Examples:

```text
₹100 compensation
₹50 fee reversal
₹200 manual correction
```

Never modify the original payment.

Instead:

```text
Adjustment
```

should create a new auditable financial record.

---

# 41. Disputes and Money

A dispute may affect money.

Example:

```text
Customer disputes ₹1,000
        ↓
Dispute opened
        ↓
Review evidence
        ↓
Partial refund ₹400
```

The dispute should not directly mutate:

```text
payment.amount
```

Instead:

```text
Dispute
   ↓
Resolution
   ↓
Refund / Adjustment
   ↓
Financial records
```

---

# 42. Financial Data Model — Conceptual

The financial area will eventually contain concepts such as:

```text
Quote
PriceSnapshot
PriceComponent
Payment
PaymentAttempt
Refund
Payout
PayoutItem
LedgerAccount
LedgerEntry
FinancialAdjustment
ProviderEvent
ReconciliationRecord
```

In the ERD these map to `worker_rates`, `quotes` / `quote_line_items`, `material_bills`, `job_visits`, `payments`, `payment_allocations`, `provider_events`, `refunds`, `worker_earnings`, `tax_rates`, `worker_payout_accounts`, `payouts` / `payout_items`, `ledger_accounts` / `ledger_transactions` / `ledger_entries` and `invoices` (ERD §14.2, §40.1–46.4).

Not all of these need to be implemented in MVP.

---

# 43. MVP Financial Scope

For the first release, keep it smaller.

Recommended MVP:

```text
Service Price
     ↓
Booking
     ↓
Payment
     ↓
Refund
     ↓
Worker Earnings Record
```

Support:

* fixed pricing
* optional quote flow if required by product
* additional work
* payment provider (with marketplace split settlement)
* payment webhook
* cash payments (collected by worker, confirmed by customer)
* multi-day jobs paid per visit / day / week (`payment_schedule`)
* refunds
* idempotency
* payment history
* basic worker earnings (with fee, GST, TDS, TCS split).

Do **not** immediately implement a giant accounting system. A minimal double-entry ledger is still in the MVP (ERD §46.3), because cash jobs (worker owes the fee) and refunds after payout cannot be tracked correctly without one.

---

# 44. Future Financial Scope

As transaction volume grows:

```text
MVP
 ↓
Payment + Refund
 ↓
Worker Payout
 ↓
Settlement
 ↓
Ledger (minimal double-entry exists from MVP; extend accounts/reports)
 ↓
Reconciliation
 ↓
Accounting Integration
```

This allows financial complexity to grow with actual marketplace volume.

---

# 45. Database Design Principles

Financial tables should generally use:

```text
BIGINT amount_minor
CHAR(3) currency
TIMESTAMPTZ timestamps
UUID identifiers
```

Important constraints:

```text
amount_minor > 0     (payments, refunds, payouts, ledger entries)
```

Exceptions are deliberate: `DISCOUNT` quote lines are negative, and `worker_earnings.net_minor` is negative for cash jobs.

Provider payment IDs should be unique.

Provider event IDs should be unique.

Idempotency keys should be unique within the appropriate scope.

Refund totals must not exceed captured amounts.

Historical financial records should not be deleted casually.

---

# 46. Transaction Boundaries

A financial operation may involve:

```text
Payment
PriceSnapshot
Job
OutboxEvent
```

The system must clearly define what belongs in the same database transaction.

For example:

```text
Payment state update
      +
Outbox event
```

should be transactionally consistent when using the outbox pattern.

External provider calls should generally **not** be held inside a long database transaction.

---

# 47. External Payment Failure

Example:

```text
Application
   ↓
Create Payment
   ↓
Provider API
   ↓
Timeout
```

A timeout does not necessarily mean:

```text
payment failed
```

The provider may have processed it successfully.

Therefore the payment stays:

```text
PENDING
```

until a verified webhook, a provider status lookup or reconciliation resolves it. There is no separate `UNKNOWN` status in the ERD.

The system should verify provider state rather than blindly retrying a charge.

---

# 48. Financial Idempotency Matrix

| Operation             | Idempotency Required |
| --------------------- | -------------------- |
| Create payment        | Yes                  |
| Capture payment       | Yes                  |
| Refund                | Yes                  |
| Payment webhook       | Yes                  |
| Payout                | Yes                  |
| Ledger posting        | Yes                  |
| Financial adjustment  | Yes                  |
| Reconciliation import | Yes                  |

Financial operations should be safe against retries.

---

# 49. Pricing and Marketplace Architecture

Conceptually:

```text
                 ┌──────────────────┐
                 │ Service Catalog  │
                 └────────┬─────────┘
                          ↓
                 ┌──────────────────┐
                 │ Pricing Engine   │
                 └────────┬─────────┘
                          ↓
                 ┌──────────────────┐
                 │ Price Snapshot   │
                 └────────┬─────────┘
                          ↓
Customer ───────→ Booking / Job
                          ↓
                 ┌──────────────────┐
                 │ Payment          │
                 └────────┬─────────┘
                          ↓
                 ┌──────────────────┐
                 │ Financial Model  │
                 └────────┬─────────┘
                          ↓
              ┌───────────┴────────────┐
              ↓                        ↓
       Worker Earnings           Platform Revenue
              ↓
          Settlement
```

---

# 50. Separation of Responsibilities

The architecture should maintain these boundaries:

```text
Catalog
  → What service exists?

Pricing
  → What should this service cost?

Quotation
  → What price is being proposed?

Booking
  → What was agreed?

Job
  → What work happened?

Payment
  → What money was paid?

Refund
  → What money was returned?

Earnings
  → What does the worker earn?

Settlement
  → What money was transferred to worker?

Ledger
  → What financial movements occurred?

Reconciliation
  → Do our records match external providers?
```

This separation will prevent the payment module from becoming a giant business-logic module.

---

# 51. Important Domain Invariants

### Pricing

```text
Price must be non-negative.
Currency must be valid.
Historical agreed price cannot silently change.
```

### Quote

```text
Only authorized worker can submit.
Customer must explicitly approve.
Accepted quote cannot silently change.
```

### Additional Work

```text
Customer approval required.
Approved amount is immutable.
```

### Payment

```text
Payment amount must be positive and computed by the backend.
Provider payment ID must be unique.
Payment operations must be idempotent.
Online status only from verified webhooks; cash confirmed by the customer.
```

### Refund

```text
Refund total cannot exceed the payment amount (checked with the payment row locked).
Refund cannot be processed twice.
Refund after payout creates a recovery against the worker's future earnings.
```

### Earnings

```text
Worker earnings must have traceable source.
```

### Ledger

```text
Debits equal credits for every transaction.
Historical entries are never updated or deleted.
Every adjustment is an explicit ADJUSTMENT transaction.
```

---

# 52. Scalability Considerations

The financial design should work when the marketplace grows from:

```text
100 jobs/day
```

to:

```text
10,000 jobs/day
```

and eventually much higher.

Initially:

```text
Spring Boot
   ↓
PostgreSQL
```

is enough.

As volume increases:

```text
Payment Webhooks
       ↓
Outbox
       ↓
Async Workers
       ↓
Financial Processing
```

Later:

```text
Payment Service
Ledger Service
Settlement Service
Reconciliation Service
```

may become separate services.

But these should be extracted only when there is a real scaling or organizational reason.

---

# 53. Do Not Start With a Complex Accounting System

A common architecture mistake is building:

```text
Double-entry ledger
+
multiple settlement accounts
+
tax engine
+
multi-currency
+
payout orchestration
+
reconciliation platform
```

before the marketplace has meaningful transaction volume.

That creates enormous complexity.

Instead:

```text
MVP
 ↓
Correct payment model
 ↓
Correct financial history
 ↓
Real transaction data
 ↓
Scale financial architecture when required
```

The important thing is to avoid making the MVP financially incorrect, not to make it unnecessarily complicated.

Note: the ERD deliberately includes a **minimal** double-entry ledger and effective-dated `tax_rates` from the start (ERD §46.1, §46.3). Indian cash jobs, GST/TDS/TCS and refunds after payout make a single-sided balance financially incorrect; tax rates are data, not a tax engine.

---

# 54. Open Business Decisions

These remain product/business decisions.

### Pricing

* fixed price?
* quote?
* starting price?
* negotiation?
* combination?

### Platform Fee

* customer fee?
* worker commission?
* both?
* category-specific?

### Taxes

* platform responsible for which taxes? (GST s.9(5) on notified services by unregistered workers)
* worker-side tax treatment? (TCS u/s 52 for GST-registered workers, TDS u/s 194-O)
* invoice requirements? (consecutive per-FY numbering, SAC codes)

The schema already supports these (ERD §46.1, §46.4); the rules must be confirmed with a chartered accountant before launch.

### Refunds

* full refund?
* partial refund?
* cancellation fees?

### Worker Payout

* immediate?
* daily?
* weekly?
* after dispute window?

### Additional Work

* approval required? — decided: yes, as an `ADDITIONAL` quote
* maximum amount?
* customer notification?
* emergency exception?

### Tips

* supported?
* worker receives 100%?
* platform fee?

These must be decided from actual business/legal/accounting requirements rather than hard-coded prematurely.

---

# 55. Key Architectural Decisions

### Decision 1

Use integer minor currency units.

```text
BIGINT
```

### Decision 2

Separate pricing from payment.

### Decision 3

Separate customer payment from worker payout.

### Decision 4

Preserve price snapshots.

### Decision 5

Use explicit financial records for refunds and adjustments.

### Decision 6

Use idempotency for all financial commands.

### Decision 7

Treat provider webhooks as asynchronous external events.

### Decision 8

Abstract payment providers behind interfaces.

### Decision 9

Do not silently mutate historical financial information.

### Decision 10

Keep a minimal true double-entry ledger from launch (ERD §46.3) and extend it as financial complexity grows.

---

# 56. End-to-End Example

Consider:

> Customer needs an electrician to install a ceiling fan.

### Step 1 — Request

```text
Service Request
Fan Installation
```

### Step 2 — Pricing

```text
Base price = ₹500
```

### Step 3 — Booking

```text
Agreed price = ₹500
```

Price snapshot created.

### Step 4 — Job

Worker completes installation.

### Step 5 — Additional Work

Worker discovers damaged connector.

```text
ADDITIONAL quote = ₹100
```

Customer accepts.

New agreed total:

```text
₹600
```

### Step 6 — Payment

```text
Customer pays ₹600 by UPI (purpose FINAL)
Status SUCCEEDED from a verified webhook
```

### Step 7 — Financial Breakdown

Example (rates illustrative):

```text
Customer total (gross)   ₹600.00
Platform fee (10%)        ₹60.00
GST on fee (18%)          ₹10.80
TDS 194-O (0.1%)           ₹0.60
Worker net               ₹528.60
```

### Step 8 — Review

Customer reviews worker.

### Step 9 — Worker Earnings

```text
Worker payable = ₹528.60 (worker_earnings ELIGIBLE after the dispute window)
```

### Step 10 — Settlement

Later:

```text
₹528.60 → worker payout (via provider split settlement, status PAID with UTR)
```

Had the customer paid ₹600 in cash, the worker would keep the cash and owe ₹70.80 (fee + GST), recovered from their next online payout.

Every stage has a separate responsibility.

---

# 57. Final Financial Architecture

The complete conceptual model is:

```text
                    SERVICE
                       │
                       ↓
                  PRICING
                       │
                       ↓
                    QUOTE
                       │
                       ↓
               PRICE SNAPSHOT
                       │
                       ↓
                    BOOKING
                       │
                       ↓
                      JOB
                       │
             ┌─────────┴─────────┐
             ↓                   ↓
       ADDITIONAL WORK        COMPLETION
             │                   │
             └─────────┬─────────┘
                       ↓
                    PAYMENT
                       │
             ┌─────────┴──────────┐
             ↓                    ↓
          REFUND              EARNINGS
                                  │
                                  ↓
                              SETTLEMENT
                                  │
                                  ↓
                                LEDGER
                                  │
                                  ↓
                           RECONCILIATION
```

---

# 58. Final Engineering Principles

The financial system must follow these principles:

1. **Money is represented precisely.**
2. **Pricing is not payment.**
3. **Payment is not settlement.**
4. **Customer charges are not worker earnings.**
5. **Historical prices are immutable snapshots.**
6. **Additional charges require explicit authorization.**
7. **Refunds are separate financial records.**
8. **Financial commands are idempotent.**
9. **Provider webhooks are verified and deduplicated.**
10. **External payment providers are hidden behind interfaces.**
11. **Financial history is auditable.**
12. **Adjustments create new records rather than rewriting history.**
13. **A minimal double-entry ledger exists from launch and grows with marketplace complexity.**
14. **The MVP should remain financially correct without becoming an accounting platform.**
15. **The architecture must allow future payout, settlement, reconciliation and accounting systems without redesigning the core booking/job domain.**

---

## Document Status

**Completed:** High-level pricing and financial architecture.

**Not yet covered in LLD:**

* Java classes
* interfaces
* repositories
* JPA mappings
* transaction annotations
* exact database schemas (now defined in the [ERD](../architecture/03-erd-and-production-database-design.md))
* concurrency implementation
* payment gateway adapter classes
* ledger class design
* detailed sequence diagrams
* implementation-level design patterns.

Those belong to the **LLD phase after the documentation phase is complete**.

## Next Document

**[modules/01](01-matching-engine-and-geospatial-discovery.md) — Matching Engine & Geospatial Discovery Design**

It will define how the platform answers the central marketplace question:

> **"Which workers should receive this job, and in what order?"**

It will cover PostGIS, radius search, skill matching, availability, ranking, worker capacity, candidate generation, matching rounds, concurrency, fairness, explainability, Redis, performance, and how the design can scale to millions of workers/users without prematurely introducing a separate matching microservice.
