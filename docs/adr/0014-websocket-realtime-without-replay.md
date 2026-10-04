# 0014. WebSocket realtime without event replay

- Status: Accepted
- Date: 2026-10-03 (recorded from existing design docs)
- Deciders: TBD
- Source: [architecture/07 §3, §19–20](../architecture/07-realtime-and-websocket-architecture.md)

## Context
Customers and workers need live updates (offer received, booking confirmed, worker en route). Event replay needs durable storage, sequencing, retention and client checkpoints.

## Decision
Realtime events are notifications only, never the source of truth. On reconnect the client fetches authoritative state over REST. Domain events (e.g. `BookingConfirmed`) are mapped to realtime events (`BOOKING_CONFIRMED`).

## Consequences
- Missed realtime messages are harmless.
- Long-lived connections need token expiry/revocation handling.

## Alternatives considered
Event replay with client checkpointing — deferred.
