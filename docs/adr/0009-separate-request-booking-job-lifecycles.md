# 0009. Separate lifecycles for service request, booking and job

- Status: Accepted
- Date: 2026-10-03 (recorded from existing design docs)
- Deciders: TBD
- Source: [modules/02 §2, §98](../modules/02-service-request-booking-and-job-execution.md), [product/03 §72](../product/03-functional-requirements-and-business-rules.md), [architecture/04](../architecture/04-domain-model-aggregates-and-state-machines.md)

## Context
A single `job.status` field would mix matching, booking, travel, work, payment and dispute — different business dimensions.

## Decision
Model Service Request (demand), Booking (agreement), Job (execution), Payment, Review and Dispute as separate aggregates, each with its own explicit state machine. Financial state is never stored on the job.

## Consequences
- State names must be defined once, in [architecture/04](../architecture/04-domain-model-aggregates-and-state-machines.md), and reused by DB, API and events (currently inconsistent across docs).
- Cross-aggregate changes go through events, one aggregate per transaction.

## Alternatives considered
One entity with one giant status field — rejected.
