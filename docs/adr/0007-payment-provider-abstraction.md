# 0007. Payment provider abstraction with verified webhooks as source of truth

- Status: Accepted (provider choice still open)
- Date: 2026-10-03 (recorded from existing design docs)
- Deciders: TBD
- Source: [modules/06 §19, §76](../modules/06-payments-refunds-settlement-and-ledger.md), [modules/03 §55](../modules/03-pricing-quotation-and-money-flow.md)

## Context
Payment status reported by the client cannot be trusted, providers may change, and webhooks can arrive late, twice or out of order.

## Decision
- Providers sit behind a port/adapter interface; business modules never call a provider SDK directly.
- Payment truth = backend state + signature-verified provider webhooks. Client-reported status is never authoritative.
- Webhooks deduplicated on (provider, event id); every payment command takes an idempotency key.
- Customer payment, worker earnings and settlement are separate concepts; reconciliation is designed from the start.
- A minimal double-entry ledger is used from launch (debits = credits, append-only), because cash jobs, refunds after payout and platform-fee recovery need it ([architecture/03 §46.3](../architecture/03-erd-and-production-database-design.md)).

## Open
- Concrete provider not chosen: Razorpay or Cashfree, with UPI and a marketplace split-settlement product (Razorpay Route / Cashfree Easy Split) so the platform never holds customer money (RBI payment-aggregator rules).
- Cash payments, earnings, payouts and GST invoices are designed in [architecture/03 §43–46.4](../architecture/03-erd-and-production-database-design.md); GST s.9(5), TCS s.52, TDS 194-O and SAC codes are to be confirmed with a CA before launch.

## Alternatives considered
Calling the provider SDK directly from business code; trusting client-side payment callbacks — rejected.
