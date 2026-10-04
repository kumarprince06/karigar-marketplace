# Karigar Marketplace — Documentation

Local marketplace for blue-collar skilled workers — any local trade: electricians, plumbers, carpenters, masons, painters, welders, AC / appliance technicians, cleaners, drivers and more — full list of 33 trades in [architecture/03 §12](architecture/03-erd-and-production-database-design.md). MVP launches in Howrah/Kolkata with electricians and plumbers; other trades follow ([product/01 §13](product/01-project-scope-and-vision.md)). Java + Spring Boot modular monolith, PostgreSQL + PostGIS, Redis.

Files are numbered from `01` within each folder, in reading order. Doc text still refers to the original global numbers ("Document 17"); see [Old document numbers](#old-document-numbers).

## Structure

| Folder | Contents |
|---|---|
| [product/](product/) | Vision, personas, requirements, MVP & release plan |
| [architecture/](architecture/) | High-level design (HLD): system, domain, data, async, caching, scalability |
| [api/](api/) | REST contract, error model, OpenAPI governance |
| [modules/](modules/) | Per-module HLD: matching, booking, pricing, payments, etc. |
| [security/](security/) | AuthN/AuthZ, threat model, privacy & compliance |
| [operations/](operations/) | Observability, CI/CD & infra, DR, resilience |
| [testing/](testing/) | Test strategy |
| [lld/](lld/) | Low-level designs, one per module/feature |
| [adr/](adr/) | Architecture Decision Records |
| [archive/](archive/) | Superseded docs — reference only, do not build from |

## Index

### Product
- [01 Project Scope & Vision](product/01-project-scope-and-vision.md)
- [02 User Roles, Personas & Journeys](product/02-user-roles-personas-and-journeys.md)
- [03 Functional Requirements & Business Rules](product/03-functional-requirements-and-business-rules.md)
- [04 MVP Scope, Release Plan & Future Phases](product/04-mvp-scope-release-plan-and-future-phases.md)

### Architecture (HLD)
- [01 System Architecture — Modular Monolith](architecture/01-system-architecture-modular-monolith.md)
- [02 Project Directory & Package Structure](architecture/02-project-directory-and-package-structure.md)
- [03 ERD & Production Database Design](architecture/03-erd-and-production-database-design.md)
- [04 Domain Model, Aggregates & State Machines](architecture/04-domain-model-aggregates-and-state-machines.md)
- [05 Java Domain Model & Class Design](architecture/05-java-domain-model-and-class-design.md)
- [06 Application Layer & Use-Case Design](architecture/06-application-layer-and-use-case-design.md)
- [07 Realtime & WebSocket Architecture](architecture/07-realtime-and-websocket-architecture.md)
- [08 Caching, Redis & Distributed State](architecture/08-caching-redis-and-distributed-state.md)
- [09 Async Processing, Domain Events & Outbox](architecture/09-async-processing-domain-events-and-outbox.md)
- [10 Scalability & Performance](architecture/10-scalability-and-performance.md)

### API
- [01 REST API Contract, Endpoints & Error Model](api/01-rest-api-contract-endpoints-and-error-model.md)
- [02 OpenAPI & Documentation Governance](api/02-openapi-and-documentation-governance.md)

### Modules
- [01 Matching Engine & Geospatial Discovery](modules/01-matching-engine-and-geospatial-discovery.md)
- [02 Service Request, Booking & Job Execution](modules/02-service-request-booking-and-job-execution.md)
- [03 Pricing, Quotation & Money Flow](modules/03-pricing-quotation-and-money-flow.md)
- [04 Worker Availability, Scheduling & Capacity](modules/04-worker-availability-scheduling-and-capacity.md)
- [05 Notification & Communication](modules/05-notification-and-communication.md)
- [06 Payments, Refunds, Settlement & Ledger](modules/06-payments-refunds-settlement-and-ledger.md)
- [07 Trust, Verification, Reputation & Reviews](modules/07-trust-verification-reputation-and-reviews.md)
- [08 Dispute Resolution, Fraud & Abuse Prevention](modules/08-dispute-resolution-fraud-and-abuse-prevention.md)
- [09 Search, Discovery & Worker Profile](modules/09-search-discovery-and-worker-profile.md)
- [10 Media Upload & Object Storage](modules/10-media-upload-and-object-storage.md)
- [11 Admin & Marketplace Operations](modules/11-admin-and-marketplace-operations.md)
- [12 Analytics, Metrics, KPIs & Event Tracking](modules/12-analytics-metrics-kpis-and-event-tracking.md)

### Security
- [01 Authentication, Authorization & Identity](security/01-authentication-authorization-and-identity.md)
- [02 Threat Model & Application Security](security/02-threat-model-and-application-security.md)
- [03 Data Privacy, PII, Retention & Compliance](security/03-data-privacy-pii-retention-and-compliance.md)

### Operations
- [01 Observability, Logging, Metrics & Tracing](operations/01-observability-logging-metrics-and-tracing.md)
- [02 CI/CD, Docker, Environments & Infrastructure](operations/02-ci-cd-docker-environments-and-infrastructure.md)
- [03 Backup, Disaster Recovery & Business Continuity](operations/03-backup-disaster-recovery-and-business-continuity.md)
- [04 Failure Modes, Resilience & Recovery](operations/04-failure-modes-resilience-and-recovery.md)

### Testing
- [01 Testing Strategy & Quality Engineering](testing/01-testing-strategy-and-quality-engineering.md)

## Conventions
- File names: `NN-kebab-case-title.md`, lowercase, no spaces or `&`, numbered from `01` per folder.
- A new doc takes the next free number in its folder. LLDs (`lld-NNN-…`) and ADRs (`NNNN-…`) number within their own folder.
- Superseded docs move to `archive/superseded/`, never deleted.

## Old document numbers

The docs were written as one numbered series (01–42). Use this table to resolve references like "Document 17" in the text.

| Old no. | Current file |
|---|---|
| 01 | [product/01-project-scope-and-vision.md](product/01-project-scope-and-vision.md) |
| 02 | [product/02-user-roles-personas-and-journeys.md](product/02-user-roles-personas-and-journeys.md) |
| 03 | [product/03-functional-requirements-and-business-rules.md](product/03-functional-requirements-and-business-rules.md) |
| 04 | [archive/superseded/01-domain-model-and-state-machines.md](archive/superseded/01-domain-model-and-state-machines.md) |
| 05 | [archive/superseded/02-erd-and-postgis-database-design.md](archive/superseded/02-erd-and-postgis-database-design.md) |
| 06 | [architecture/01-system-architecture-modular-monolith.md](architecture/01-system-architecture-modular-monolith.md) |
| 07 | [architecture/02-project-directory-and-package-structure.md](architecture/02-project-directory-and-package-structure.md) |
| 08 | [archive/superseded/03-domain-model-and-state-machines-v2.md](archive/superseded/03-domain-model-and-state-machines-v2.md) |
| 09 | [architecture/03-erd-and-production-database-design.md](architecture/03-erd-and-production-database-design.md) |
| 10 | [archive/superseded/04-rest-api-specification-and-contract.md](archive/superseded/04-rest-api-specification-and-contract.md) |
| 11 | [archive/superseded/05-application-use-cases-and-service-layer.md](archive/superseded/05-application-use-cases-and-service-layer.md) |
| 12 | [architecture/04-domain-model-aggregates-and-state-machines.md](architecture/04-domain-model-aggregates-and-state-machines.md) |
| 13 | [architecture/05-java-domain-model-and-class-design.md](architecture/05-java-domain-model-and-class-design.md) |
| 14 | [architecture/06-application-layer-and-use-case-design.md](architecture/06-application-layer-and-use-case-design.md) |
| 15 | [api/01-rest-api-contract-endpoints-and-error-model.md](api/01-rest-api-contract-endpoints-and-error-model.md) |
| 16 | [security/01-authentication-authorization-and-identity.md](security/01-authentication-authorization-and-identity.md) |
| 17 | [modules/01-matching-engine-and-geospatial-discovery.md](modules/01-matching-engine-and-geospatial-discovery.md) |
| 18 | [modules/02-service-request-booking-and-job-execution.md](modules/02-service-request-booking-and-job-execution.md) |
| 19 | [modules/03-pricing-quotation-and-money-flow.md](modules/03-pricing-quotation-and-money-flow.md) |
| 20 | [archive/superseded/06-matching-engine-and-geospatial-discovery-v2.md](archive/superseded/06-matching-engine-and-geospatial-discovery-v2.md) |
| 21 | [modules/04-worker-availability-scheduling-and-capacity.md](modules/04-worker-availability-scheduling-and-capacity.md) |
| 22 | [modules/05-notification-and-communication.md](modules/05-notification-and-communication.md) |
| 23 | [modules/06-payments-refunds-settlement-and-ledger.md](modules/06-payments-refunds-settlement-and-ledger.md) |
| 24 | [modules/07-trust-verification-reputation-and-reviews.md](modules/07-trust-verification-reputation-and-reviews.md) |
| 25 | [modules/08-dispute-resolution-fraud-and-abuse-prevention.md](modules/08-dispute-resolution-fraud-and-abuse-prevention.md) |
| 26 | [modules/09-search-discovery-and-worker-profile.md](modules/09-search-discovery-and-worker-profile.md) |
| 27 | [modules/10-media-upload-and-object-storage.md](modules/10-media-upload-and-object-storage.md) |
| 28 | [architecture/07-realtime-and-websocket-architecture.md](architecture/07-realtime-and-websocket-architecture.md) |
| 29 | [architecture/08-caching-redis-and-distributed-state.md](architecture/08-caching-redis-and-distributed-state.md) |
| 30 | [architecture/09-async-processing-domain-events-and-outbox.md](architecture/09-async-processing-domain-events-and-outbox.md) |
| 31 | [operations/01-observability-logging-metrics-and-tracing.md](operations/01-observability-logging-metrics-and-tracing.md) |
| 32 | [security/02-threat-model-and-application-security.md](security/02-threat-model-and-application-security.md) |
| 33 | [security/03-data-privacy-pii-retention-and-compliance.md](security/03-data-privacy-pii-retention-and-compliance.md) |
| 34 | [testing/01-testing-strategy-and-quality-engineering.md](testing/01-testing-strategy-and-quality-engineering.md) |
| 35 | [architecture/10-scalability-and-performance.md](architecture/10-scalability-and-performance.md) |
| 36 | [operations/02-ci-cd-docker-environments-and-infrastructure.md](operations/02-ci-cd-docker-environments-and-infrastructure.md) |
| 37 | [operations/03-backup-disaster-recovery-and-business-continuity.md](operations/03-backup-disaster-recovery-and-business-continuity.md) |
| 38 | [modules/11-admin-and-marketplace-operations.md](modules/11-admin-and-marketplace-operations.md) |
| 39 | [modules/12-analytics-metrics-kpis-and-event-tracking.md](modules/12-analytics-metrics-kpis-and-event-tracking.md) |
| 40 | [api/02-openapi-and-documentation-governance.md](api/02-openapi-and-documentation-governance.md) |
| 41 | [operations/04-failure-modes-resilience-and-recovery.md](operations/04-failure-modes-resilience-and-recovery.md) |
| 42 | [product/04-mvp-scope-release-plan-and-future-phases.md](product/04-mvp-scope-release-plan-and-future-phases.md) |
