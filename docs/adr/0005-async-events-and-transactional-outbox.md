# 0005. Asynchronous processing: Spring events now, transactional outbox for critical flows, no broker

- Status: Proposed — docs conflict, needs a final call
- Date: 2026-10-03 (recorded from existing design docs)
- Deciders: TBD
- Source: [architecture/09 §69–70](../architecture/09-async-processing-domain-events-and-outbox.md), [architecture/01 §61](../architecture/01-system-architecture-modular-monolith.md), [modules/01 §44](../modules/01-matching-engine-and-geospatial-discovery.md), [modules/05 §24, §55](../modules/05-notification-and-communication.md)

## Context
Notifications, realtime pushes, media processing and analytics must not block core transactions. Business state and the events it emits must not diverge on a crash.

## Decision (as written in the docs)
- Core transactions (booking, job state, payment state, reviews/disputes) stay synchronous.
- Side effects run asynchronously, initially via Spring application events where reliability needs are low.
- Transactional outbox becomes the durable foundation for important async workflows.
- No Kafka or other broker until justified.

## Conflict to resolve
architecture/01, modules/01 and modules/05 say "outbox later"; architecture/06, modules/06 and architecture/09 treat it as required now. Matching triggers and payment/earnings follow-ups run on in-memory events, which are lost on crash.
**Recommendation:** outbox from MVP for matching, booking, payment and earnings events; Spring events only for best-effort side effects.

## Consequences
- Outbox needs a polling worker (`SKIP LOCKED`), retries and a dead-letter state.
- Consumers must be idempotent.

## Alternatives considered
Direct broker publishing; in-memory events only; Kafka-first — rejected for MVP.
