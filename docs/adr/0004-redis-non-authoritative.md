# 0004. Redis as a non-authoritative supporting store

- Status: Accepted
- Date: 2026-10-03 (recorded from existing design docs)
- Deciders: TBD
- Source: [architecture/08 §3–4, §10](../architecture/08-caching-redis-and-distributed-state.md), [modules/04 §73](../modules/04-worker-availability-scheduling-and-capacity.md), [security/01 §77](../security/01-authentication-authorization-and-identity.md)

## Context
Some data needs fast, short-lived operations that do not need PostgreSQL's transactional model.

## Decision
Use Redis for caching, rate limiting, OTP attempt counters, WebSocket presence, short-lived locks and idempotency state. PostgreSQL stays authoritative for all persistent business state; booking state is not cached.

## Consequences
- Losing Redis must never lose business data; all Redis-backed decisions are revalidated against PostgreSQL (e.g. availability at booking time).
- Security-sensitive limits (OTP, auth rate limits) fail closed when Redis is down.

## Alternatives considered
Caching business state (bookings, payments) in Redis — rejected.
