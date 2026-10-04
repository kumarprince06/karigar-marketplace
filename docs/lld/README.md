# Low-Level Designs (LLD)

One LLD per module or feature, implementing its HLD in `../modules/` or `../architecture/`.

- File name: `lld-NNN-<module>-<feature>.md` (e.g. `lld-001-matching-candidate-query.md`).
- Start from [_template.md](_template.md).
- Every LLD links its parent HLD and the requirement IDs (FR-/BR-/NFR-) it satisfies.

## Sizing rule

One LLD = one feature inside **one module**, small enough to build, test and review in about 1–3 days. If it touches two modules, split it and connect the parts through events or the module's public API. This keeps modules independent, so each can be scaled or extracted later without redesigning the others.

## Register

Planned in build order (the first vertical slice: sign-up → request → customer picks worker → job → payment → review).

| ID | Title | Module | Parent HLD | Status |
|---|---|---|---|---|
| [LLD-001](lld-001-identity-email-signup-login.md) | Email/password sign-up, login, email verification (Brevo) | identity | [security/01](../security/01-authentication-authorization-and-identity.md), [ADR 0016](../adr/0016-email-password-login-phone-otp-later.md) | Draft |
| [LLD-002](lld-002-identity-sessions-token-rotation.md) | Refresh sessions, token rotation, logout | identity | [security/01](../security/01-authentication-authorization-and-identity.md) | Draft |
| [LLD-003](lld-003-catalog-and-language.md) | Catalog: categories, trades, skills, common problems + translations, language resolution | catalog | [architecture/03 §12, §34.1](../architecture/03-erd-and-production-database-design.md) | Draft |
| [LLD-004](lld-004-worker-profile-trades-rates.md) | Worker profile: trades, rates, skills | worker | [architecture/03 §10–14.2](../architecture/03-erd-and-production-database-design.md) | Draft |
| [LLD-005](lld-005-customer-addresses-service-zones.md) | Customer address book + service-zone check | customer | [architecture/03 §22–23.1](../architecture/03-erd-and-production-database-design.md) | Draft |
| [LLD-006](lld-006-create-service-request.md) | Create service request (problems, urgency, address snapshot) | servicerequest | [modules/02](../modules/02-service-request-booking-and-job-execution.md) | Draft |
| [LLD-007](lld-007-matching-candidate-search.md) | Service area, online status, candidate search (PostGIS) and matching rounds | matching | [modules/01](../modules/01-matching-engine-and-geospatial-discovery.md) | Draft |
| [LLD-008](lld-008-offers-shortlist-selection.md) | Worker job inbox (accept/decline/withdraw) + customer shortlist + select worker | matching / booking | [ADR 0017](../adr/0017-customer-picks-the-worker.md) | Draft |
| [LLD-009](lld-009-booking-job-visits.md) | Booking, job and visits; start code, check-in/out, extra days, cancellations, no-shows, completion, bill | booking / job | [architecture/03 §35–40.1](../architecture/03-erd-and-production-database-design.md) | Draft |
| LLD-010 | Cash payment + platform-fee ledger entries | payment | [architecture/03 §43, §46.3](../architecture/03-erd-and-production-database-design.md) | Planned |
| LLD-011 | Online payment (provider checkout + webhooks) | payment | [modules/06](../modules/06-payments-refunds-settlement-and-ledger.md) | Planned |
| LLD-012 | Reviews and ratings | review | [architecture/03 §47](../architecture/03-erd-and-production-database-design.md) | Planned |
| LLD-013 | Notifications (push + email) via outbox | notification | [modules/05](../modules/05-notification-and-communication.md) | Planned |

Later: quotes and material bills, multi-day payments, payouts, GST invoices, verification (Aadhaar/PAN/police), admin roles, favourite workers, disputes.
