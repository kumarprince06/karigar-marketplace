# 0006. Money as integer minor units

- Status: Accepted
- Date: 2026-10-03 (recorded from existing design docs)
- Deciders: TBD
- Source: [modules/03 §6.1, §55](../modules/03-pricing-quotation-and-money-flow.md), [modules/06 §76](../modules/06-payments-refunds-settlement-and-ledger.md), [api/01 §48](../api/01-rest-api-contract-endpoints-and-error-model.md)

## Context
Floating-point money causes rounding errors; amounts flow across pricing, payments, refunds, earnings and settlement.

## Decision
- Store and transmit money as integer minor units (paise) — `BIGINT` in the database, `amountMinor` in the API — always with an explicit currency.
- Price snapshots are preserved; historical financial records are never silently mutated. Refunds and adjustments are separate records.

## Consequences
- Rounding: line amounts and percentages are rounded half-up to whole paise (architecture/03 §41, §42).
- The archived ERD (archive/superseded/02) still uses `NUMERIC(12,2)`; the current ERD (architecture/03) uses integer paise throughout.
- `Money` must allow negative values for discounts/adjustments and use overflow-safe arithmetic.

## Alternatives considered
`DECIMAL`/`NUMERIC` major units; floating point — rejected.
