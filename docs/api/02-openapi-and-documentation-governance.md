# API/OpenAPI & Documentation Governance

## 1. Purpose

The Karigar Marketplace will eventually have many consumers of its APIs:

```text
Customer Mobile/Web App
Worker Mobile/Web App
Admin/Ops UI
Internal Background Processes
External Providers
Future Partner Integrations
```

As the system grows, undocumented or inconsistent APIs become a major source of bugs.

This document defines how API contracts and engineering documentation should be designed, maintained, versioned, tested, and evolved.

---

# 2. API as a Contract

An API is not simply:

```text
Controller → Service → Database
```

It is a contract between a client and the platform.

The contract defines:

```text
Endpoint
HTTP method
Authentication
Authorization
Request schema
Validation
Response schema
Error schema
Status codes
Idempotency
Pagination
Concurrency behavior
Side effects
Versioning
```

---

# 3. Existing API Version

The initial public API namespace is:

```text
/api/v1
```

Example:

```text
POST /api/v1/service-requests
```

Versioning should be intentional.

Do not introduce:

```text
/api/v1.1
/api/v1.2
```

for every small change.

---

# 4. API Design Principles

The API should be:

```text
predictable
explicit
consistent
secure
idempotent where appropriate
backward-compatible where practical
easy to document
easy to test
```

---

# 5. APIs Are Not Database CRUD

Avoid designing endpoints directly from tables.

For example, instead of:

```text
PATCH /bookings/{id}
```

with:

```json
{
  "status": "CONFIRMED"
}
```

use:

```text
POST /bookings/{id}/confirm
```

The API expresses user intent rather than exposing persistence mechanics.

---

# 6. Command vs Query

The API should distinguish:

### Commands

Change business state.

Examples:

```text
confirm booking
cancel booking
accept match
complete job
issue refund
submit review
```

### Queries

Read state.

Examples:

```text
get booking
get worker profile
list service requests
get payment
```

This distinction improves authorization, idempotency, and documentation.

---

# 7. Resource Naming

Use plural resource names.

Examples:

```text
/users
/workers
/service-requests
/bookings
/jobs
/payments
/reviews
/disputes
/notifications
```

Actions may use explicit subpaths where the action represents a business transition.

---

# 8. Action Endpoints

Examples:

```text
POST /matches/{id}/accept
POST /matches/{id}/reject

POST /bookings/{id}/confirm
POST /bookings/{id}/cancel

POST /jobs/{id}/en-route
POST /jobs/{id}/arrive
POST /jobs/{id}/start
POST /jobs/{id}/complete
```

These are preferable to generic status mutation.

---

# 9. OpenAPI as Contract

The project should maintain an OpenAPI specification.

Conceptually:

```text
OpenAPI
   ↓
API Contract
   ↓
Documentation
   ↓
Validation
   ↓
Client/tooling support
```

The OpenAPI specification should describe externally observable behavior.

---

# 10. OpenAPI Ownership

Each module should own the endpoints belonging to that module.

For example:

```text
Worker module
    → worker APIs

Service Request module
    → service-request APIs

Payment module
    → payment APIs
```

A central generated OpenAPI document can combine them.

---

# 11. Code-First vs Contract-First

Either approach can work.

For this project, a practical initial approach is:

```text
Java/Spring implementation
        +
explicit OpenAPI annotations/specification
        ↓
generated/documented API contract
```

The important requirement is that:

> The implementation and published API contract must never silently diverge.

---

# 12. OpenAPI Documentation Requirements

Every public endpoint should document:

```text
summary
description
authentication
authorization
parameters
request body
response
error responses
pagination where applicable
idempotency behavior
```

---

# 13. Example Endpoint Documentation

For:

```text
POST /api/v1/service-requests
```

document:

```text
Purpose:
Create a new service request.

Authentication:
Required.

Role:
CUSTOMER.

Idempotency:
Supported.

Request:
profession
skill
description
location
requested time
urgency
attachments

Response:
ServiceRequestResponse

Errors:
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
INVALID_LOCATION
DUPLICATE_REQUEST
```

---

# 14. Request DTOs

API request objects should be dedicated DTOs.

Example:

```text
CreateServiceRequestRequest
ConfirmBookingRequest
CompleteJobRequest
CreateRefundRequest
```

Do not expose JPA entities directly.

---

# 15. Response DTOs

Similarly:

```text
ServiceRequestResponse
WorkerProfileResponse
BookingResponse
JobResponse
PaymentResponse
```

should define the API representation.

The database model may evolve without necessarily changing the API.

---

# 16. DTO Mapping

Conceptually:

```text
HTTP Request
      ↓
Request DTO
      ↓
Application Command
      ↓
Domain
      ↓
Result
      ↓
Response DTO
      ↓
HTTP Response
```

This prevents transport concerns from leaking into domain objects.

---

# 17. API Response Envelope

The existing standard response format remains:

```json
{
  "data": {},
  "meta": {}
}
```

For errors:

```json
{
  "error": {
    "code": "BOOKING_ALREADY_CONFIRMED",
    "message": "This service request already has a confirmed booking.",
    "details": {},
    "traceId": "..."
  }
}
```

The exact envelope should remain consistent across modules.

---

# 18. Error Codes

Clients should rely on:

```text
error.code
```

rather than parsing human-readable messages.

Example:

```text
BOOKING_ALREADY_CONFIRMED
```

The `message` is primarily for human understanding.

---

# 19. Error Code Naming

Use stable uppercase identifiers:

```text
INVALID_REQUEST
UNAUTHORIZED
FORBIDDEN
RESOURCE_NOT_FOUND
BOOKING_ALREADY_CONFIRMED
INVALID_STATE_TRANSITION
PAYMENT_ALREADY_REFUNDED
IDEMPOTENCY_KEY_REUSED
```

---

# 20. Error Code Governance

An error code should not casually change once clients depend on it.

If behavior changes significantly:

```text
new error code
```

may be safer than silently changing the meaning of an existing code.

---

# 21. HTTP Status Codes

Use HTTP status codes consistently.

Typical mapping:

```text
200 → successful query/action
201 → resource created
202 → accepted for asynchronous processing where appropriate
204 → successful operation with no response body
400 → malformed/invalid request
401 → authentication required/invalid
403 → authenticated but not authorized
404 → resource not found
409 → business/concurrency conflict
422 → semantically invalid request where chosen by convention
429 → rate limited
500 → unexpected server error
502/503 → dependency/service availability issue where appropriate
```

The project should standardize exact usage.

---

# 22. Validation Errors

Validation errors should identify the relevant field when possible.

Example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": {
      "description": [
        "Description must not be blank."
      ],
      "latitude": [
        "Latitude must be between -90 and 90."
      ]
    }
  }
}
```

---

# 23. Business Errors vs System Errors

These must remain distinct.

### Business error

```text
WORKER_NOT_AVAILABLE
```

Expected business outcome.

### System error

```text
DATABASE_UNAVAILABLE
```

Unexpected infrastructure failure.

Do not log normal business rejection as an application crash.

---

# 24. Trace ID

Error responses should expose a safe correlation identifier:

```text
traceId
```

Example:

```text
"traceId": "abc123"
```

Customers can provide this to support.

It should not expose internal infrastructure details.

---

# 25. Request ID

The API supports:

```text
X-Request-Id
```

This should propagate through relevant internal operations.

---

# 26. Authentication Documentation

Every protected endpoint should clearly indicate:

```text
authentication required
```

For example:

```text
Authorization: Bearer <access-token>
```

The documentation should explain authentication without exposing actual credentials.

---

# 27. Authorization Documentation

Authentication alone is insufficient.

Documentation should specify roles where relevant:

```text
CUSTOMER
WORKER
ADMIN
```

and resource ownership requirements.

Example:

```text
GET /bookings/{id}
```

may be accessible only to:

```text
customer associated with booking
worker associated with booking
authorized admin
```

---

# 28. Idempotency Documentation

Commands with retry risk should document idempotency.

Examples:

```text
POST /payments
POST /payments/{id}/refund
POST /bookings/{id}/confirm
POST /jobs/{id}/complete
```

Clients should understand:

```text
whether Idempotency-Key is required
how long it is retained
what happens when reused with different payload
```

Exact retention duration remains an implementation decision.

---

# 29. Idempotency Semantics

If the same idempotency key is reused with the same logical request:

```text
return the same logical result
```

If reused with a materially different request:

```text
reject
```

Example:

```text
IDEMPOTENCY_KEY_REUSED
```

---

# 30. Pagination

Collection APIs should use cursor pagination where appropriate.

Example:

```text
GET /api/v1/service-requests?limit=20&cursor=...
```

Response:

```json
{
  "data": [],
  "meta": {
    "nextCursor": "..."
  }
}
```

---

# 31. Pagination Rules

The API should define:

```text
maximum page size
default page size
cursor format
sort order
filter behavior
```

Clients should not assume unlimited results.

---

# 32. Stable Sorting

Cursor pagination requires deterministic ordering.

A typical ordering may use:

```text
createdAt
+
unique ID
```

to avoid ambiguous records with identical timestamps.

---

# 33. Filtering

Filtering should be explicit.

Examples:

```text
GET /service-requests?status=SUBMITTED
GET /workers?profession=ELECTRICIAN
GET /bookings?status=CONFIRMED
```

Only documented filters should be supported.

---

# 34. Sorting

Supported sorting should be documented.

Example:

```text
sort=createdAt
sort=-createdAt
```

Do not expose arbitrary database-column sorting.

---

# 35. Search

Search behavior must be documented.

For example:

```text
GET /admin/workers?query=...
```

should define:

```text
searchable fields
matching behavior
pagination
case sensitivity
```

---

# 36. API Versioning Strategy

Initial:

```text
/api/v1
```

Prefer backward-compatible additions.

Safe changes generally include:

```text
adding optional response fields
adding new endpoints
adding optional request fields
```

Potentially breaking changes include:

```text
removing fields
renaming fields
changing meaning
changing required behavior
changing enum semantics incompatibly
```

---

# 37. Enum Evolution

Enums are dangerous for clients.

Example:

```text
status = CONFIRMED
```

A future server may introduce:

```text
RESCHEDULED
```

Clients should tolerate unknown enum values where practical.

API documentation should clearly state that enum values may evolve unless guaranteed closed.

---

# 38. Response Field Evolution

Avoid removing a field immediately.

Use:

```text
introduce replacement
 ↓
deprecate old field
 ↓
monitor usage
 ↓
remove in future breaking version
```

---

# 39. Deprecation

Deprecated endpoints/fields should be documented.

Example:

```text
Deprecated:
GET /api/v1/old-worker-search
```

Documentation should state:

```text
replacement
reason
migration guidance
planned removal, if known
```

Do not promise a removal date unless it is actually committed.

---

# 40. Breaking Changes

If a breaking API change is unavoidable:

```text
new API version
```

may be introduced.

Example:

```text
/api/v2
```

But a new version should not be created merely because internal implementation changed.

---

# 41. Internal APIs

Not every internal method needs OpenAPI.

OpenAPI is for HTTP contracts exposed to API consumers.

Internal application/domain interfaces should be documented through:

```text
Java interfaces
architecture docs
ADRs
code documentation
```

---

# 42. WebSocket Contract

WebSocket events also require documentation.

For each event:

```text
event name
version
destination
payload
authorization
delivery semantics
ordering assumptions
resync behavior
```

---

# 43. WebSocket Example

```text
BOOKING_CONFIRMED
Destination:
user:{userId}

Payload:
{
  "eventId": "...",
  "type": "BOOKING_CONFIRMED",
  "version": 1,
  "entityType": "BOOKING",
  "entityId": "...",
  "payload": {
    "status": "CONFIRMED"
  }
}
```

Clients should know that WebSocket delivery is not authoritative.

---

# 44. REST + WebSocket Consistency

The documented contract should state:

```text
REST → authoritative current state
WebSocket → realtime notification of state change
```

If a WebSocket event is missed:

```text
client reconnects
      ↓
refetch REST state
```

---

# 45. Webhook Contracts

Provider webhooks are also API contracts.

Document:

```text
endpoint
provider
authentication/signature validation
expected headers
payload
event IDs
idempotency
retry behavior
response behavior
```

---

# 46. Webhook Security

Documentation should never imply that:

```text
payload received = trusted
```

The implementation must:

```text
validate signature
validate provider
validate event ID
check replay/idempotency
process safely
```

---

# 47. File Upload APIs

Media upload contracts should document:

```text
allowed file types
maximum size
upload intent
object reference
finalization
expiration
failure behavior
```

Actual binary data should generally go directly to object storage rather than through the application server.

---

# 48. API Documentation for Async Operations

Some APIs may return:

```text
202 Accepted
```

when processing continues asynchronously.

The documentation must tell the client:

```text
what has already happened
what remains pending
how status can be checked
whether polling is supported
whether realtime notification exists
```

---

# 49. Example Async Contract

```text
POST /service-requests/{id}/matching
```

might return:

```json
{
  "data": {
    "requestId": "...",
    "status": "MATCHING"
  }
}
```

The client should not assume that matching is already complete.

---

# 50. API Documentation and State Machines

For stateful resources, documentation should include allowed transitions.

Example:

```text
Booking

PENDING
  ├── CONFIRMED
  ├── CANCELLED
  └── EXPIRED

CONFIRMED
  ├── COMPLETED
  ├── CANCELLED
  └── RESCHEDULED
```

This prevents clients from assuming arbitrary status mutation is supported.

---

# 51. State Transition Errors

When an invalid command is attempted:

```text
INVALID_STATE_TRANSITION
```

should be returned with enough information for the client to recover.

Avoid exposing unnecessary internal implementation details.

---

# 52. API Documentation Examples

Every important endpoint should contain realistic examples.

For:

```text
POST /service-requests
```

include:

```text
request example
success response
validation failure
authorization failure
business conflict
```

---

# 53. Examples Must Be Safe

Examples must never contain:

```text
real phone numbers
real addresses
real identity data
real payment credentials
real access tokens
```

Use synthetic data.

---

# 54. API Documentation Structure

Recommended:

```text
docs/
└── api/
    ├── README.md
    ├── authentication.md
    ├── errors.md
    ├── pagination.md
    ├── idempotency.md
    ├── versioning.md
    ├── webhooks.md
    ├── websocket.md
    └── openapi/
```

---

# 55. Architecture Documentation

The project should also maintain:

```text
docs/
├── architecture/
├── domain/
├── api/
├── events/
├── operations/
├── security/
├── privacy/
├── testing/
└── deployment/
```

Documentation should have clear ownership.

---

# 56. Documentation Hierarchy

A useful hierarchy is:

```text
Product Documentation
        ↓
System Architecture
        ↓
Domain Documentation
        ↓
API Contract
        ↓
Implementation
        ↓
Tests
```

Each level should remain consistent with the others.

---

# 57. Source of Truth

Different information should have different authoritative sources.

```text
Business state
    → Domain + database

HTTP contract
    → OpenAPI/API contract

Domain rules
    → Domain model + requirements

Infrastructure configuration
    → Infrastructure/configuration source

Operational procedures
    → Runbooks

Architecture decisions
    → ADRs
```

Avoid duplicating the same rule in many documents without ownership.

---

# 58. Architecture Decision Records

Important architectural decisions should use ADRs.

Examples:

```text
ADR-001 Modular Monolith
ADR-002 PostgreSQL + PostGIS
ADR-003 Redis Usage
ADR-004 Transactional Outbox
ADR-005 Payment Provider Abstraction
ADR-006 WebSocket Architecture
ADR-007 Object Storage
```

---

# 59. ADR Structure

Each ADR should contain:

```text
Title
Status
Context
Decision
Alternatives Considered
Consequences
Date
```

Example:

```text
ADR-004

Decision:
Use transactional outbox for reliable asynchronous event publication.

Reason:
Business state and event creation must commit atomically.

Alternatives:
Direct message publishing
In-memory Spring events
Kafka-first architecture
```

---

# 60. ADR Status

Possible statuses:

```text
PROPOSED
ACCEPTED
SUPERSEDED
REJECTED
DEPRECATED
```

---

# 61. Documentation Ownership

Every major document should have an owner.

For example:

```text
API → Backend Engineering
Security → Security/Engineering
Payment → Backend + Finance
Product requirements → Product
Operations → Operations
```

The exact organizational ownership will evolve.

---

# 62. Documentation Review

Changes to important contracts should be reviewed.

For example:

```text
API change
   ↓
implementation
   ↓
OpenAPI update
   ↓
tests
   ↓
review
```

Do not merge an API change while leaving documentation outdated.

---

# 63. API Contract Testing

The testing strategy should validate:

```text
implementation
       ↕
OpenAPI contract
```

Examples:

```text
response schema validation
required fields
status codes
error structure
content types
```

---

# 64. Consumer Contract Testing

If external consumers exist, contract testing can verify:

```text
provider API
       ↕
consumer expectations
```

This becomes increasingly useful as the ecosystem grows.

---

# 65. Generated API Clients

OpenAPI may eventually generate clients for:

```text
mobile clients
admin frontend
partner integrations
```

Generated clients should be treated as build artifacts rather than hand-maintained copies.

---

# 66. API SDKs

If external partners eventually need SDKs:

```text
Java SDK
JavaScript/TypeScript SDK
```

can be generated or maintained from the API contract.

Do not build SDK infrastructure before there are actual consumers.

---

# 67. Content Types

The API should consistently use:

```text
application/json
```

for JSON APIs.

File upload endpoints may use:

```text
multipart/form-data
```

or direct object-storage uploads depending on architecture.

---

# 68. Dates and Times

API timestamps should use:

```text
ISO-8601
UTC
```

Example:

```text
2026-09-30T10:30:00Z
```

The backend remains authoritative for timestamps.

---

# 69. Monetary Fields

API money representations should avoid floating-point ambiguity.

A recommended representation:

```json
{
  "amountMinor": 150000,
  "currency": "INR"
}
```

rather than:

```json
{
  "amount": 1500.00
}
```

This should remain consistent with the financial architecture.

---

# 70. Location Fields

Coordinates should use explicit fields:

```json
{
  "latitude": 22.5958,
  "longitude": 88.2636
}
```

The API should document:

```text
coordinate system
valid ranges
privacy behavior
whether coordinates are exact or approximate
```

---

# 71. Sensitive Fields

OpenAPI documentation should identify sensitive fields where useful.

Examples:

```text
identity evidence
private address
payout details
```

These should not accidentally become part of generic response schemas.

---

# 72. Public vs Private API Models

Separate:

```text
PublicWorkerProfileResponse
```

from:

```text
AdminWorkerOperationalResponse
```

Do not use one giant worker DTO with dozens of conditional fields.

---

# 73. Role-Specific Responses

Different consumers may need different views.

Example:

```text
Customer → public worker profile
Worker → own private profile
Admin → operational worker profile
```

Authorization should determine which representation is permitted.

---

# 74. API Security Documentation

The API documentation should explicitly describe:

```text
authentication
authorization
rate limits
idempotency
ownership
sensitive data
file access
webhook validation
```

Security behavior should not be hidden only inside implementation code.

---

# 75. Rate Limiting Documentation

Document limits for sensitive operations where appropriate.

Especially:

```text
OTP request
OTP verification
login
file upload
review creation
payment
refund
```

Exact limits should remain configurable.

---

# 76. Retry Guidance

Clients should know which failures are safe to retry.

For example:

```text
network timeout
503
429
```

may be retryable depending on operation.

For commands:

```text
use Idempotency-Key
```

when supported.

---

# 77. Do Not Retry Blindly

Blind retries can create:

```text
duplicate booking
duplicate payment
duplicate refund
```

Therefore API documentation should clearly describe retry semantics for commands.

---

# 78. API Timeout Semantics

External operations can become ambiguous.

For example:

```text
payment request sent
       ↓
provider timeout
```

The API should not necessarily return:

```text
PAYMENT_FAILED
```

if the actual provider state is unknown.

Instead, the system may expose:

```text
PAYMENT_PENDING
```

or another explicit state.

---

# 79. API Consistency Rules

All modules should follow common rules for:

```text
naming
errors
pagination
timestamps
IDs
authentication
authorization
idempotency
request IDs
responses
```

This prevents each module from becoming its own API ecosystem.

---

# 80. API Change Workflow

Recommended process:

```text
1. Identify requirement
        ↓
2. Determine domain change
        ↓
3. Design API contract
        ↓
4. Update OpenAPI
        ↓
5. Implement
        ↓
6. Update tests
        ↓
7. Run contract validation
        ↓
8. Update documentation
        ↓
9. Review
        ↓
10. Release
```

---

# 81. API Review Checklist

Before merging an API change:

```text
Is the endpoint name consistent?
Is authentication documented?
Is authorization enforced?
Are request DTOs explicit?
Are response DTOs explicit?
Are validation rules documented?
Are error codes defined?
Are status codes correct?
Is idempotency required?
Is pagination needed?
Is concurrency behavior documented?
Are sensitive fields excluded?
Is OpenAPI updated?
Are contract tests added?
Is backward compatibility preserved?
```

---

# 82. API Deprecation Workflow

```text
Introduce replacement
        ↓
Mark old API deprecated
        ↓
Notify consumers
        ↓
Monitor usage
        ↓
Migrate consumers
        ↓
Remove in planned breaking release
```

Do not delete an API simply because the implementation has been rewritten.

---

# 83. Documentation CI

Documentation should be part of CI.

Possible checks:

```text
OpenAPI syntax validation
OpenAPI schema validation
broken-link detection
example validation
API contract tests
architecture documentation checks
```

---

# 84. OpenAPI Drift Detection

CI should detect when:

```text
implementation changes
```

but:

```text
OpenAPI remains unchanged
```

or vice versa.

The exact tooling can be selected later.

---

# 85. API Snapshot Testing

For stable APIs, selected response schemas/examples can be tested.

However, avoid brittle snapshots that block harmless changes.

The purpose is contract protection, not freezing every implementation detail.

---

# 86. Documentation Searchability

Developers should be able to quickly find:

```text
endpoint
state machine
error code
event
metric
ADR
runbook
```

Consistent naming and directory structure matter.

---

# 87. API Changelog

Maintain a changelog for externally meaningful API changes.

Example:

```text
2026-09-30
Added:
POST /api/v1/jobs/{id}/complete

Changed:
Booking response includes job summary

Deprecated:
GET /api/v1/old-endpoint
```

---

# 88. Internal Release Notes

Important changes should also appear in engineering release notes:

```text
database migration
API change
event schema change
configuration change
operational change
security change
```

---

# 89. API and Mobile Compatibility

Mobile applications may remain on older versions for long periods.

Therefore the backend should avoid assuming:

```text
all clients upgrade immediately
```

Backward compatibility is especially important for:

```text
mobile APIs
```

---

# 90. API Compatibility Strategy

Prefer:

```text
additive changes
```

such as:

```text
new optional field
new endpoint
new optional query parameter
```

before:

```text
breaking replacement
```

---

# 91. Client Compatibility

Clients should:

```text
ignore unknown response fields
handle unknown enum values safely where possible
handle new optional metadata
not assume event ordering
retry according to documented semantics
```

---

# 92. Admin API Compatibility

Admin UI is generally controlled by the same organization, but compatibility still matters because:

```text
deployment order
```

can cause temporary version mismatches.

Therefore:

```text
old UI + new backend
```

should not break during rolling deployments where practical.

---

# 93. Expand-and-Contract API Evolution

For breaking data changes:

```text
Phase 1
support old + new

Phase 2
migrate clients

Phase 3
remove old
```

This works well with the deployment strategy already defined.

---

# 94. API Observability

Every request should be measurable by:

```text
endpoint
HTTP method
status
latency
request ID
trace ID
```

Avoid high-cardinality labels such as:

```text
user ID
booking ID
request ID
```

in aggregate metrics.

---

# 95. API Auditability

Business-sensitive commands should generate appropriate audit/domain events.

For example:

```text
refund issued
worker suspended
verification approved
dispute resolved
```

The API request should be traceable to the resulting business event.

---

# 96. API and Event Correlation

A useful chain:

```text
API Request
    ↓
Request ID
    ↓
Domain Command
    ↓
Transaction
    ↓
Domain Event
    ↓
Outbox Event
```

This allows an incident investigator to reconstruct the operation.

---

# 97. API Documentation for Business Rules

Not every internal rule belongs in OpenAPI.

But client-relevant rules should be documented.

Example:

```text
Worker can accept a match only while:
- worker is active
- match is still valid
- worker is eligible
- no conflicting booking exists
```

---

# 98. API Documentation Boundaries

Document:

```text
externally observable behavior
```

Do not document:

```text
private implementation details
internal class names
database table names
internal Redis keys
```

unless they are genuinely relevant to an integration.

---

# 99. API Contract Invariants

The API layer must maintain:

1. Every public endpoint belongs to a defined domain/application capability.
2. API contracts do not expose persistence entities directly.
3. Request and response DTOs are explicit.
4. Authentication requirements are documented and enforced.
5. Authorization requirements are documented and enforced.
6. Error codes are stable and machine-readable.
7. Human-readable messages are not the primary client contract.
8. Business errors are distinguishable from system failures.
9. Idempotency behavior is documented for retry-sensitive commands.
10. Pagination behavior is consistent.
11. Timestamps use a consistent format.
12. Money uses explicit integer minor units and currency.
13. Sensitive fields are excluded from inappropriate representations.
14. APIs use explicit state-transition commands for important mutations.
15. WebSocket contracts are documented separately from REST.
16. Webhooks are treated as secure contracts.
17. OpenAPI remains synchronized with implementation.
18. Breaking changes follow a defined versioning/deprecation process.
19. Clients can survive additive evolution where practical.
20. API changes include appropriate automated tests.

---

# 100. Documentation Governance Invariants

The engineering documentation system must maintain:

1. Every major architecture decision is recorded.
2. ADRs preserve the reason behind important decisions.
3. API contracts are version-controlled.
4. Event schemas are documented.
5. KPI definitions are documented.
6. Runbooks exist for important operational failures.
7. Security-sensitive behavior is documented.
8. Privacy-sensitive behavior is documented.
9. Documentation changes are reviewed with relevant code changes.
10. Documentation should identify the authoritative source for important information.
11. Duplicate contradictory definitions should be eliminated.
12. Examples must use synthetic data.
13. Deprecated behavior must be clearly marked.
14. Historical decisions should remain discoverable.
15. Documentation should evolve with the system rather than becoming a one-time project artifact.

---

# 101. Recommended Project Documentation Structure

The project can evolve toward:

```text
docs/
├── product/
│   ├── vision.md
│   ├── requirements.md
│   ├── user-journeys.md
│   └── mvp-scope.md
│
├── architecture/
│   ├── system-architecture.md
│   ├── modules.md
│   ├── scalability.md
│   └── decisions/
│
├── domain/
│   ├── aggregates.md
│   ├── state-machines.md
│   └── business-rules.md
│
├── api/
│   ├── README.md
│   ├── authentication.md
│   ├── errors.md
│   ├── pagination.md
│   ├── idempotency.md
│   ├── versioning.md
│   ├── webhooks.md
│   ├── websocket.md
│   └── openapi/
│
├── events/
│   ├── event-catalog.md
│   └── schemas/
│
├── analytics/
│   ├── kpi-definitions.md
│   ├── metric-dictionary.md
│   └── event-tracking.md
│
├── security/
├── privacy/
├── testing/
├── deployment/
├── operations/
│   └── runbooks/
└── adr/
```

---

# 102. Documentation Lifecycle

Documentation should follow the software lifecycle:

```text
Requirement
     ↓
Architecture
     ↓
Domain Design
     ↓
API/Event Contract
     ↓
Implementation
     ↓
Testing
     ↓
Deployment
     ↓
Operations
     ↓
Feedback
     ↓
Documentation Update
```

This creates a continuous engineering feedback loop.

---

# 103. MVP Documentation Scope

Before implementation begins, the project should have:

```text
product requirements
user journeys
business rules
architecture
project structure
database design
domain model
API contract
security architecture
privacy architecture
testing strategy
scalability strategy
deployment architecture
DR architecture
admin/ops architecture
analytics architecture
API documentation governance
```

The project is approaching the end of its **high-level architecture/documentation phase**.

---

# 104. What Comes Next

The next document will cover:

**[operations/04](../operations/04-failure-modes-resilience-and-recovery.md) — Failure Modes, Resilience & Recovery**

It will consolidate how the system behaves when:

```text
database fails
Redis fails
payment provider fails
SMS fails
object storage fails
matching fails
worker crashes
application instance crashes
network calls timeout
duplicate requests arrive
events are delayed
outbox processing fails
WebSocket disconnects
deployment fails
partial operations occur
```

This is important because the previous documents defined individual systems, while the next document will examine **how the entire marketplace behaves under failure**.

# End of Document
