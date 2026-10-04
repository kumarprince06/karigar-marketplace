# Architecture Decision Records

One decision per file: `NNNN-short-title.md` (e.g. `0001-use-modular-monolith.md`). Start from [0000-template.md](0000-template.md).
ADRs are immutable once accepted; to change a decision, write a new ADR that supersedes the old one.

| ADR | Title | Status |
|---|---|---|
| [0001](0001-modular-monolith.md) | Modular monolith instead of microservices | Accepted |
| [0002](0002-package-by-business-module.md) | Package by business module with layered internals | Accepted |
| [0003](0003-postgresql-postgis.md) | PostgreSQL + PostGIS as the system of record | Accepted |
| [0004](0004-redis-non-authoritative.md) | Redis as a non-authoritative supporting store | Accepted |
| [0005](0005-async-events-and-transactional-outbox.md) | Asynchronous processing: Spring events now, transactional outbox for critical flows, no broker | Proposed — docs conflict, needs a final call |
| [0006](0006-money-integer-minor-units.md) | Money as integer minor units | Accepted |
| [0007](0007-payment-provider-abstraction.md) | Payment provider abstraction with verified webhooks as source of truth | Accepted (provider choice still open) |
| [0008](0008-phone-otp-and-token-sessions.md) | Phone OTP login with short-lived access tokens and rotating refresh sessions | Login method superseded by 0016 |
| [0009](0009-separate-request-booking-job-lifecycles.md) | Separate lifecycles for service request, booking and job | Accepted |
| [0010](0010-action-endpoints-for-state-transitions.md) | Action endpoints for state transitions | Accepted |
| [0011](0011-explainable-rule-based-matching.md) | Explainable rule-based matching with small-batch offers | Accepted |
| [0012](0012-search-on-postgresql.md) | Search on PostgreSQL/PostGIS, no dedicated search engine | Accepted |
| [0013](0013-object-storage-direct-upload.md) | S3-compatible object storage with direct upload | Accepted |
| [0014](0014-websocket-realtime-without-replay.md) | WebSocket realtime without event replay | Accepted |
| [0015](0015-integration-tests-on-real-postgres.md) | Integration tests on real PostgreSQL/PostGIS | Accepted |
| [0016](0016-email-password-login-phone-otp-later.md) | Email + password login for MVP; phone OTP later | Accepted |
| [0017](0017-customer-picks-the-worker.md) | Customer picks the worker from those who accept | Accepted |
