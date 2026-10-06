# LLD-011: Online Payment — Provider Checkout, Webhooks, Refunds, Reconciliation

| Field | Value |
|---|---|
| Status | Draft |
| Owner | TBD |
| Reviewers | TBD |
| Module | `payment` (online) |
| Parent HLD | [modules/06](../modules/06-payments-refunds-settlement-and-ledger.md), [architecture/03 §43–46](../architecture/03-erd-and-production-database-design.md), [ADR 0007](../adr/0007-payment-provider-abstraction.md) |
| Requirements | FR-PAY-001 (online payment), FR-PAY-002 (refunds), FR-CUS-004 (advance) |
| Depends on | LLD-010 (`payments` table, ledger posting rules P1/P3/P4/P7, earnings), LLD-006 (`AdvancePayments` port), LLD-009 (bill) |
| Used by | LLD-006 (advance), LLD-009 / LLD-010 (bill, fee and refund amounts), LLD-018 (refund command with `disputeId`), LLD-019 (transfers, payout webhooks, `WORKER_DUES` checkout), LLD-020 (ops queues) |
| Last updated | 2026-10-05 |

---

## 1. Context & scope

Customers pay online through the provider's checkout (UPI first — it is what most customers here use — then card / net banking). The app never decides that a payment succeeded: the backend learns it from a **signature-verified webhook** or by asking the provider server-to-server. The same module issues every refund the rest of the system asks for.

**In scope**

- `PaymentGateway` port and the reference adapter (Razorpay, matching the LLD-006 example; provider still open per ADR 0007)
- Checkout for the booking advance (`AdvancePayments` port for LLD-006) and for job payments (bill due, daily wages)
- Webhook intake, dedup, processing; payment and refund state machines
- Refunds: one `RefundService` used by request cancel / expiry / no-match (LLD-006), unused advance and fees (LLD-010), disputes and admin
- Pending-payment sweeper, nightly reconciliation against the provider
- Ledger postings P1, P3, P4, P7 and refund reversal (rules in LLD-010 §4)

**Out of scope:** payout logic and worker bank accounts ([LLD-019](lld-019-worker-payouts.md) — this LLD only provides the gateway methods and webhook intake it uses; online money stays in the provider's settlement account until then, so the platform never holds it in its own bank account), GST invoices, cash (LLD-010).

**Decisions**

| # | Decision | Default (configurable) |
|---|---|---|
| D1 | **One `payments` row = one provider order.** Retries in checkout (UPI declined, app closed) are attempts on the same order; the order is reused until it is paid or the payment expires. No `payment_attempts` table — attempt history lives in `provider_events`. | — |
| D2 | **Truth = verified webhook, or a server-to-server status fetch** (sweeper / reconciliation). The SDK's success callback only makes the app start polling. | ADR 0007 |
| D3 | Webhook endpoint **verifies and stores, then returns 200**; processing runs in a second transaction right after, and `ProviderEventJob` retries anything unprocessed. The provider is never kept waiting on our business logic. | retry every 1 min |
| D4 | `SUCCEEDED` is terminal for a payment. A `payment.failed` for one attempt does **not** fail the payment (the customer may retry on the same order); only expiry without capture does. Out-of-order events can therefore never move a payment backwards. | — |
| D5 | Payment expiry: advance → the request's `payment_due_at` (15 min, LLD-006); job payments → 30 min. Before expiring, the sweeper **asks the provider**; a capture found then is a normal success. | 30 min |
| D6 | **Late success** (captured after the request expired or was cancelled) → keep it `SUCCEEDED`, then refund it automatically. Never drop money silently. | — |
| D7 | Refund total ≤ payment amount, checked with the payment row locked. Refund idempotency key comes from the caller's reason (`ADV_REFUND:{requestId}`, `DISPUTE:{disputeId}:{n}` …). | ERD §46 |
| D8 | A refund of a job payment reverses the original split **pro-rata** (fee, GST, worker share); if the worker was already paid out, their balance goes negative and is recovered from later earnings (ERD §46). | open question §12 |
| D9 | Amounts are always computed by the backend (advance from LLD-006, bill due from LLD-009). The client never sends an amount. | api/01 |

---

## 2. Classes / components

```text
com.karigar.payment
├── api/
│   ├── OnlinePaymentController        -- POST /api/v1/jobs/{id}/payments/online, GET /api/v1/payments/{id}
│   ├── WebhookController              -- POST /api/v1/payments/webhooks/{provider}   (no auth; signature)
│   └── AdminPaymentController         -- /api/v1/admin/payments/** (finance.view, finance.refund)
├── application/
│   ├── CheckoutService                -- create / reuse order; implements AdvancePayments for LLD-006
│   ├── WebhookIntakeService           -- verify → INSERT provider_events ON CONFLICT DO NOTHING
│   ├── ProviderEventProcessor         -- event → payment / refund transition + ledger + outbox
│   ├── RefundService                  -- request(paymentId, amount, reasonCode, key, disputeId?); refundAdvance(requestId, reason)
│   ├── StuckRefundQueue, ParkedProviderEventQueue -- implement OpsQueueSource STUCK_REFUND / PARKED_PROVIDER_EVENT (LLD-020)
│   ├── PendingPaymentSweeper          -- every 5 min: expire or rescue PENDING via fetchPayment
│   ├── ReconciliationJob              -- nightly: provider settlement report vs our rows
│   └── port/ PaymentGateway, OutboxWriter, LedgerPostingService + EarningsService (LLD-010), JobBillLookup,
│             PayoutEventHandler (LLD-019: PAYOUT_* / ACCOUNT_VALIDATED events)
├── domain/  PaymentStatus transitions (D4), RefundStatus, RefundSplit (pro-rata reversal)
└── infrastructure/gateway/
    ├── razorpay/ RazorpayGateway, RazorpaySignatureVerifier, RazorpayEventMapper
    └── fake/     FakeGateway (local + tests: deterministic ids, triggers webhooks)
```

```java
public interface PaymentGateway {
    ProviderOrder createOrder(PaymentId receipt, Money amount, Map<String, String> notes);   // receipt = our payment id
    ProviderPaymentStatus fetchOrder(String providerOrderId);                               // server-to-server truth
    ProviderRefund createRefund(String providerPaymentId, Money amount, String idempotencyKey);
    ProviderRefundStatus fetchRefund(String providerRefundId);
    VerifiedEvent verifyAndParse(byte[] rawBody, Map<String, String> headers);              // throws InvalidSignature
    List<ProviderSettlementLine> settlementReport(LocalDate day);
    // added for LLD-019 (same provider, same adapter)
    ProviderAccount registerBankAccount(WorkerId w, String holderName, String accountNumber, String ifsc, String idempotencyKey);
    ProviderTransfer createTransfer(String providerAccountRef, Money amount, String idempotencyKey, Map<String, String> notes);
    ProviderTransferStatus fetchTransfer(String providerPayoutId);
}
```

`VerifiedEvent` is provider-neutral: `ORDER_PAID | PAYMENT_FAILED | REFUND_PROCESSED | REFUND_FAILED | PAYOUT_PROCESSED | PAYOUT_FAILED | PAYOUT_REVERSED | ACCOUNT_VALIDATED | OTHER`, with provider ids, amount, currency, method, masked VPA and fee. Provider status names never leave the adapter. `ProviderEventProcessor` hands the `PAYOUT_*` and `ACCOUNT_VALIDATED` kinds to `PayoutEventHandler` ([LLD-019](lld-019-worker-payouts.md)); dedup and parking are the same as for payment events.

---

## 3. Data model

`payments` and `payment_allocations` are created in LLD-010 (`V8_1`). This LLD adds `expires_at` and creates `refunds` and `provider_events` from [ERD §44, §46](../architecture/03-erd-and-production-database-design.md), with explicit status checks.

```sql
-- V9_1__online_payments_refunds.sql
ALTER TABLE payments ADD COLUMN expires_at TIMESTAMPTZ;                 -- online only (D5)
CREATE UNIQUE INDEX ux_payments_provider_order ON payments (provider, provider_order_id) WHERE provider_order_id IS NOT NULL;
CREATE INDEX ix_payments_online_pending ON payments (expires_at) WHERE status IN ('CREATED','PENDING') AND method <> 'CASH';
CREATE UNIQUE INDEX ux_payments_one_open_advance ON payments (service_request_id)
    WHERE purpose = 'BOOKING_ADVANCE' AND status IN ('CREATED','PENDING','SUCCEEDED');

CREATE TABLE provider_events (
    id                  UUID PRIMARY KEY,
    provider            VARCHAR(30) NOT NULL,
    event_id            VARCHAR(100) NOT NULL,
    event_type          VARCHAR(80) NOT NULL,
    payload             JSONB NOT NULL,
    signature_verified  BOOLEAN NOT NULL CHECK (signature_verified),     -- unverified events are rejected, never stored
    received_at         TIMESTAMPTZ NOT NULL,
    processed_at        TIMESTAMPTZ,
    attempts            SMALLINT NOT NULL DEFAULT 0,
    processing_error    TEXT,
    UNIQUE (provider, event_id)
);
CREATE INDEX ix_provider_events_unprocessed ON provider_events (received_at) WHERE processed_at IS NULL;

CREATE TABLE refunds (
    id                   UUID PRIMARY KEY,
    payment_id           UUID NOT NULL REFERENCES payments (id),
    amount_minor         BIGINT NOT NULL CHECK (amount_minor > 0),
    currency             CHAR(3) NOT NULL DEFAULT 'INR',
    status               VARCHAR(20) NOT NULL CHECK (status IN ('REQUESTED','PROCESSING','SUCCEEDED','FAILED')),
    reason_code          VARCHAR(40) NOT NULL,       -- CANCELLED_BEFORE_BOOKING, REQUEST_EXPIRED, NO_MATCH, UNUSED_ADVANCE,
                                                     -- LATE_PAYMENT, DISPUTE_RESOLVED, DUPLICATE_PAYMENT, ADMIN
    dispute_id           UUID,                       -- FK fk_refunds_dispute added by LLD-018 V13_1
    provider_refund_id   VARCHAR(100),
    failure_code         VARCHAR(50),
    idempotency_key      VARCHAR(100) NOT NULL,
    requested_by_user_id UUID REFERENCES users (id), -- NULL = system
    created_at           TIMESTAMPTZ NOT NULL,
    completed_at         TIMESTAMPTZ,
    version              BIGINT NOT NULL DEFAULT 0,
    UNIQUE (payment_id, idempotency_key)
);
CREATE UNIQUE INDEX ux_refunds_provider ON refunds (provider_refund_id) WHERE provider_refund_id IS NOT NULL;
CREATE INDEX ix_refunds_open ON refunds (created_at) WHERE status IN ('REQUESTED','PROCESSING');
```

Retention: `provider_events.payload` is kept 8 years with the payment (financial record), but only the fields the mapper uses are read; card / VPA data in it is already masked by the provider.

---

## 4. API contract

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/v1/jobs/{id}/payments/online` | customer | pay what is due now → `201` with checkout data (or `200` with the existing open order) |
| GET | `/api/v1/payments/{id}` | customer / worker of the job | status, amount, method, refunds (no provider ids for the worker) |
| POST | `/api/v1/service-requests/{id}/pay-advance` | customer | LLD-006; returns the existing order, creates one only if it doesn't exist |
| POST | `/api/v1/payments/webhooks/{provider}` | provider | raw body + signature header; `200` once stored (or duplicate), `400` bad signature |
| GET | `/api/v1/admin/payments?status=&cursor=` | `finance.view` | search |
| POST | `/api/v1/admin/payments/{id}/refunds` | `finance.refund` | `{ amountMinor, reasonCode: "ADMIN", note }` + `Idempotency-Key`; reason required, audited |

Pay the bill online (no amount in the body, D9):

```json
// POST /api/v1/jobs/{id}/payments/online   Idempotency-Key: 6f1…
// 201
{
  "data": {
    "paymentId": "…", "status": "PENDING", "purpose": "FINAL",
    "amountMinor": 195100, "currency": "INR",
    "payment": { "provider": "RAZORPAY", "orderId": "order_…",
                 "checkout": { "keyId": "rzp_live_…", "amountMinor": 195100 },
                 "dueAt": "2026-10-06T12:30:00Z" }
  }
}
```

The app opens the checkout, then polls `GET /payments/{id}` (every 3 s, up to 2 min; then "We're confirming your payment — you'll get a notification").

**Error codes**

| HTTP | `error.code` | When |
|---|---|---|
| 404 | `JOB_NOT_FOUND` / `PAYMENT_NOT_FOUND` | not a party to it |
| 409 | `NOTHING_DUE` | bill `dueMinor` = 0 |
| 409 | `CASH_ALREADY_PENDING` | an open cash payment covers the same amount (LLD-010) |
| 409 | `PAYMENT_WINDOW_CLOSED` | advance after `payment_due_at` (LLD-006) |
| 409 | `REFUND_EXCEEDS_PAYMENT` | admin refund above the refundable remainder (`details.refundableMinor`) |
| 503 | `PAYMENT_PROVIDER_UNAVAILABLE` | order creation failed after retries; safe to retry the same request |
| 400 | `WEBHOOK_SIGNATURE_INVALID` | webhook only; also logged as a security event |

---

## 5. Sequence diagrams

### 5.1 Advance (LLD-006) — create order, webhook, late success

```mermaid
sequenceDiagram
    participant App as Customer app
    participant SR as CreateServiceRequestService (LLD-006)
    participant CO as CheckoutService
    participant G as Provider
    participant WH as WebhookIntakeService
    participant P as ProviderEventProcessor
    participant DB as PostgreSQL
    SR->>DB: request PENDING_PAYMENT, payment_due_at = +15 min (commit)
    SR->>CO: createAdvanceOrder(requestId, ₹99)
    CO->>DB: payment CREATED (BOOKING_ADVANCE, key = requestId) — commit
    CO->>G: createOrder(receipt = paymentId)
    CO->>DB: provider_order_id, PENDING, expires_at = payment_due_at
    CO-->>App: checkout data
    App->>G: pays by UPI
    G->>WH: webhook order.paid (signature)
    WH->>DB: INSERT provider_events ON CONFLICT DO NOTHING (commit) → 200
    WH->>P: process(eventId)
    P->>DB: lock payment; amount & currency match; PENDING → SUCCEEDED; P1 (Dr GATEWAY_CLEARING / Cr CUSTOMER_ADVANCES);<br/>outbox AdvancePaymentSucceeded; processed_at
    Note over P: request already EXPIRED / CANCELLED? → still SUCCEEDED, then RefundService(LATE_PAYMENT) (D6)
```

### 5.2 Refund

```mermaid
sequenceDiagram
    participant C as Caller (LLD-006 / 010 / 018 / admin)
    participant R as RefundService
    participant G as Provider
    participant P as ProviderEventProcessor
    participant DB as PostgreSQL
    C->>R: request(paymentId, ₹99, NO_MATCH, key "ADV_REFUND:{requestId}", disputeId = null)
    R->>DB: SELECT payment FOR UPDATE; Σ non-failed refunds + 99 ≤ amount; INSERT refund REQUESTED (commit)
    R->>G: createRefund(providerPaymentId, ₹99, idempotencyKey = refund id)
    R->>DB: provider_refund_id, PROCESSING
    G->>P: webhook refund.processed (via intake)
    P->>DB: refund SUCCEEDED; advance → P3; job payment → pro-rata reversal (D8); outbox RefundSucceeded {refundId, paymentId, customerId, workerId, purpose, amountMinor}
```

LLD-018 passes `disputeId` (reason `DISPUTE_RESOLVED`, key `DISPUTE:{disputeId}:{seq}`); it is stored in `refunds.dispute_id`.

If `createRefund` times out the refund stays `REQUESTED`; `RefundRetryJob` calls the provider again with the **same idempotency key**, so the provider returns the first refund instead of making a second one.

---

## 6. State transitions

**Payment (online)**

| From | Event | To | Side effects |
|---|---|---|---|
| — | checkout requested | CREATED | — |
| CREATED | provider order created | PENDING | `expires_at` set |
| CREATED | order creation failed | CREATED | app retries the same call; sweeper cancels at `expires_at` |
| PENDING | `ORDER_PAID` (webhook / fetch) | SUCCEEDED | P1 (advance) or earning + P4 (job); `WORKER_DUES` ([LLD-019](lld-019-worker-payouts.md) D10): no earning, no P4 — post P10 and call `DuesRestrictionService`; outbox `PaymentSucceeded` / `AdvancePaymentSucceeded`; gateway fee → P7 |
| PENDING | `PAYMENT_FAILED` | PENDING | `failure_code` recorded; customer can retry (D4) |
| PENDING / CREATED | `expires_at` passed and fetch shows no capture | FAILED (`EXPIRED`) | outbox `AdvancePaymentFailed` for advances |
| FAILED | capture found later (reconciliation) | SUCCEEDED | as above + D6 auto-refund if the request is no longer payable |
| SUCCEEDED | anything except refunds | SUCCEEDED | event recorded, ignored |

**Refund:** `REQUESTED → PROCESSING → SUCCEEDED | FAILED`. `FAILED` → ops queue `STUCK_REFUND` ([LLD-020](lld-020-admin-operations.md); `finance.refund` can retry with a new key); the refundable remainder is freed only when the refund is `FAILED`.

**Events** (outbox, ids + `aggregateVersion` + amounts only, LLD-022 D8): `PaymentSucceeded`, `AdvancePaymentSucceeded`, `AdvancePaymentFailed`, `RefundSucceeded` — each carries `customerId` (null for `WORKER_DUES`), `workerId`, `purpose`, `amountMinor`.

---

## 7. Error handling, idempotency & concurrency

- **Webhook dedup:** `UNIQUE (provider, event_id)`; a duplicate gets `200` without processing. Processing is also idempotent per payment (terminal states, ledger keys `PAYMENT_SUCCEEDED:{paymentId}`, `REFUND:{refundId}`).
- **Amount / currency mismatch** between event and our row → event left unprocessed with `processing_error`, P1 alert; never "fixed" automatically. Events still unprocessed after 5 attempts appear in the `PARKED_PROVIDER_EVENT` ops queue (LLD-020).
- **Unknown order id** (e.g. created by a crashed request) → fetch the order's `receipt` (our payment id) and link it; if still unknown, park and alert.
- **Webhook vs sweeper vs reconciliation** all `SELECT … FOR UPDATE` the payment and apply the same transition table; whoever comes second sees a terminal state and stops.
- **No DB transaction is open during provider calls** (CREATED/REQUESTED rows are committed first; the provider result is written in a new transaction).
- **Two checkouts for one bill:** the `Idempotency-Key` on `POST …/payments/online` and the open-payment check return the same order. Paying online while a cash payment is pending → `CASH_ALREADY_PENDING`.
- **Provider down:** order creation retries 3× with backoff (1 s, 3 s, 9 s, jitter), then `503 PAYMENT_PROVIDER_UNAVAILABLE`; nothing is charged. Webhooks queue on the provider side and are processed when we're back.
- **Refund over-limit race:** the payment row lock serialises refund requests; the sum check runs inside that lock.

---

## 8. Security & privacy

- Webhook: HMAC signature over the **raw** body with the webhook secret (constant-time compare); body ≤ 64 KB; unsigned / invalid → `400`, counted, never stored. Optional provider IP allowlist at the load balancer.
- Provider keys and webhook secret come from AWS Secrets Manager; the public `keyId` is the only provider value sent to apps.
- No card number, CVV, UPI PIN or bank credentials ever reach our servers — checkout is the provider's SDK. We store only the masked VPA (`rah***@okaxis`) and method.
- Customers see their own payments; the worker sees status and amount of payments on their jobs, not the payer's VPA. Admin refunds need `finance.refund`, a reason, and write `audit_events`.
- Logs carry payment id, order id and status — never the raw webhook payload.

---

## 9. Observability

| Type | Name | Notes |
|---|---|---|
| Counter | `payment_online_total{purpose, result}` | succeeded, expired, late_success |
| Histogram | `payment_checkout_to_capture_seconds` | UX of UPI flows |
| Counter | `webhook_received_total{provider, type, result}` | processed, duplicate, invalid_signature, parked |
| Gauge | `provider_events_unprocessed_oldest_seconds` | alert > 10 min |
| Counter | `refund_total{reason, result}` | |
| Gauge | `refunds_open_oldest_seconds` | alert > 24 h |
| Gauge | `reconciliation_mismatch_count` | alert > 0 |

**Reconciliation (nightly):** provider settlement lines for yesterday vs our `SUCCEEDED` payments and refunds — missing on our side (→ fetch and process), missing on theirs, amount differences; also the provider's transfer report vs `payouts` (missing, amount or status differs — [LLD-019](lld-019-worker-payouts.md)). **Pending sweeper (5 min):** `CREATED/PENDING` past `expires_at` → `fetchOrder` → success or expire.

Alerts: invalid signatures > 10 / min (attack or rotated secret); success rate of UPI checkouts drops below 70 % over 30 min (provider / UPI outage — show "pay by cash" in the app for job bills).

---

## 10. Test plan

| Level | Cases |
|---|---|
| Unit | transition table: every (state, event) pair incl. failed-then-paid and paid-then-failed (stays SUCCEEDED); `RefundSplit` pro-rata with odd paise (sum equals refund) |
| Webhook (Testcontainers + FakeGateway) | valid → SUCCEEDED, P1/P4 posted, outbox row; same event twice → one effect; bad signature → 400, nothing stored; amount mismatch → parked + alert; unknown order resolved by receipt |
| Advance | request created → paid → `AdvancePaymentSucceeded` → request SUBMITTED; paid after `payment_due_at` → SUCCEEDED + LATE_PAYMENT refund; `pay-advance` twice → same order |
| Refunds | cancel before booking → full refund once even if the event is delivered 3×; two parallel refunds of ₹60 on a ₹99 advance → one succeeds, one `REFUND_EXCEEDS_PAYMENT`; provider timeout → retry with same key → one provider refund |
| Sweeper / reconciliation | PENDING past expiry but captured at provider → SUCCEEDED; not captured → FAILED; provider report line missing locally → processed next run |
| Contract (Razorpay sandbox, nightly CI job, not per-PR) | create order, UPI success / failure, refund, webhook signature with real secret |
| Architecture (ArchUnit) | only `payment.infrastructure.gateway` imports provider SDKs; other modules use `AdvancePayments` / `RefundService` only |

---

## 11. Open questions

| Question | Default until decided | Owner | Due |
|---|---|---|---|
| Provider: Razorpay (Route) or Cashfree (Easy Split) | Razorpay adapter first; port keeps both possible | Product + finance | Before pilot |
| On a refund of a job payment, is the platform fee refunded too (D8)? | Pro-rata: yes | Product | Before launch |
| Who pays the gateway fee on refunded payments | Platform (expense) | Finance | Before launch |
| ~~Worker dues payment (cash-only workers, LLD-010)~~ | **Resolved by [LLD-019](lld-019-worker-payouts.md) D10:** `WORKER_DUES` checkout through this LLD, P10 on success | — | — |
| Customer refunds for cash payments (dispute outcome) | Not automated: ops pays by UPI and records a finance adjustment ([LLD-018](lld-018-disputes.md) open question) | Product + finance | Before launch |

---

## Change log

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-05 | TBD | First draft |
| 0.2 | 2026-10-05 | TBD | Integrated with LLD-012–022: gateway `registerBankAccount` / `createTransfer` / `fetchTransfer` + payout event kinds → `PayoutEventHandler`, `WORKER_DUES` success (P10), transfer reconciliation (019); `RefundService.request(…, disputeId)`, `refunds.dispute_id` FK in 018 V13_1; event payloads; `STUCK_REFUND` / `PARKED_PROVIDER_EVENT` ops queues (020) |
