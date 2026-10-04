# Observability, Logging, Metrics, Distributed Tracing, Audit & Monitoring

## 1. Purpose

A production system cannot be operated reliably if the team cannot answer:

* What is happening?
* Why did it happen?
* Which users were affected?
* Which component failed?
* How often is it happening?
* When did it start?
* Is the problem still occurring?
* Did the system recover?
* What business operation was affected?

For this platform, observability is especially important because a single customer action may cross multiple modules and external systems.

For example:

```text
Customer creates service request
        ↓
Service Request
        ↓
Matching
        ↓
Worker Match
        ↓
Notification
        ↓
Realtime
        ↓
Booking
        ↓
Job
        ↓
Payment
        ↓
Review
```

A production incident could occur anywhere in this chain.

Therefore, the platform needs a consistent observability architecture from the beginning.

---

# 2. Observability vs Monitoring

These concepts are related but different.

### Monitoring

Answers:

> Is something currently unhealthy?

Examples:

```text
CPU high
Database connections exhausted
Error rate increased
Redis unavailable
Queue backlog growing
```

### Observability

Answers:

> Why is the system behaving this way?

It combines:

```text
Logs
Metrics
Traces
Events
Audit records
Business telemetry
```

The goal is not merely to collect data.

The goal is:

> **Make system behavior explainable.**

---

# 3. Four Important Observability Signals

The architecture should primarily use:

```text
1. Logs
2. Metrics
3. Traces
4. Audit Events
```

They answer different questions.

| Signal       | Main Purpose               |
| ------------ | -------------------------- |
| Logs         | Detailed event/context     |
| Metrics      | Aggregated system behavior |
| Traces       | Request/event journey      |
| Audit events | Who did what and when      |

These should not be treated as interchangeable.

---

# 4. Logs

Logs capture detailed information about application execution.

Example:

```text
Booking confirmation failed
bookingId=...
requestId=...
workerId=...
reason=BOOKING_ALREADY_CONFIRMED
```

Logs are useful for debugging individual incidents.

---

# 5. Structured Logging

Production logs should be structured rather than arbitrary strings.

Avoid:

```text
Booking failed for worker 123
```

Prefer structured fields:

```text
event=BOOKING_CONFIRMATION_FAILED
bookingId=01J...
workerId=01J...
requestId=req-123
reason=BOOKING_ALREADY_CONFIRMED
```

This makes logs searchable and machine-readable.

---

# 6. Recommended Log Fields

Common fields:

```text
timestamp
level
service
module
environment
requestId
traceId
spanId
userId
actorType
event
errorCode
message
durationMs
```

Not every log needs every field.

Sensitive information must be excluded.

---

# 7. Log Levels

Use clear levels.

### TRACE

Extremely detailed diagnostic information.

Generally disabled in production except temporarily.

### DEBUG

Developer troubleshooting.

Usually reduced or disabled in production.

### INFO

Normal important application behavior.

Examples:

```text
booking confirmed
worker registered
payment succeeded
```

### WARN

Unexpected condition that does not necessarily mean failure.

Examples:

```text
payment provider latency unusually high
cache unavailable
retry scheduled
```

### ERROR

An operation failed and requires attention.

Examples:

```text
database operation failed
payment reconciliation failed
outbox processing failed
```

Avoid using ERROR for every expected business rejection.

---

# 8. Business Rejection vs Application Error

This distinction is important.

Suppose:

```text
Worker attempts to accept an already-accepted match
```

This may be:

```text
expected business rejection
```

not:

```text
ERROR
```

It may produce a structured response:

```json
{
  "code": "MATCH_ALREADY_ACCEPTED"
}
```

and possibly an INFO/DEBUG log depending on operational importance.

Unexpected database failure is different.

---

# 9. Never Log Secrets

Never log:

```text
password
OTP
access token
refresh token
payment credentials
card number
CVV
private keys
provider secrets
identity-document contents
signed private URLs
```

Logs are frequently copied into centralized systems with broad operational access.

---

# 10. PII in Logs

Personal information should be minimized.

Avoid unnecessary logging of:

```text
full phone number
full address
government ID
identity documents
private messages
payment details
```

If identification is necessary, use:

```text
userId
workerId
requestId
bookingId
```

rather than duplicating personal data.

---

# 11. Phone Number Masking

If a phone number genuinely needs to appear in operational logs, use masking or another controlled representation.

Example:

```text
+91******1234
```

But preferably use:

```text
userId
```

for application debugging.

---

# 12. Request ID

Every incoming request should receive or propagate a request ID.

Example:

```text
X-Request-Id: req-01J...
```

If the client provides one, validate it and apply appropriate limits.

Otherwise the application generates one.

This allows:

```text
HTTP request
    ↓
application service
    ↓
database
    ↓
outbox
    ↓
worker
```

to be correlated.

---

# 13. Trace ID

A trace represents the complete journey of an operation.

Example:

```text
Trace
 ├── HTTP POST /service-requests
 ├── ServiceRequestService
 ├── PostgreSQL query
 ├── Matching operation
 ├── Notification processing
 └── Push provider call
```

A trace ID allows engineers to reconstruct this journey.

---

# 14. Distributed Tracing

Even though the system starts as a modular monolith, tracing is still valuable.

Today:

```text
API
 ↓
Module
 ↓
Database
```

Later:

```text
API
 ↓
Booking Service
 ↓
Event Broker
 ↓
Notification Service
 ↓
Provider
```

A consistent tracing model makes future extraction easier.

---

# 15. OpenTelemetry

The architecture should be designed to support OpenTelemetry-compatible instrumentation.

Conceptually:

```text
Application
   ↓
OpenTelemetry instrumentation
   ↓
Traces / Metrics
   ↓
Observability backend
```

The exact backend is an infrastructure decision.

Potential components can include:

```text
Prometheus
Grafana
Loki
Tempo
Jaeger
OpenTelemetry Collector
```

Do not deploy every tool simply because it exists.

---

# 16. Metrics

Metrics provide aggregated measurements.

Examples:

```text
requests_total
request_errors_total
request_latency
booking_confirmations_total
payments_success_total
notifications_failed_total
matching_latency
```

Metrics are especially useful for:

* dashboards;
* alerts;
* capacity planning;
* SLOs;
* trend analysis.

---

# 17. Metric Types

Common metric types:

### Counter

Monotonically increases.

Examples:

```text
jobs_completed_total
payments_succeeded_total
notifications_failed_total
```

### Gauge

Represents a current value.

Examples:

```text
active_websocket_connections
queue_depth
redis_memory_usage
```

### Histogram

Measures distributions.

Examples:

```text
request_duration
matching_duration
payment_provider_latency
```

Histograms are especially useful for latency.

---

# 18. Avoid High-Cardinality Metrics

Do not create metrics such as:

```text
request_duration{userId="..."}
```

for millions of users.

This can explode metrics storage.

Use low-cardinality dimensions such as:

```text
endpoint
method
status
module
operation
environment
```

User IDs belong in logs/traces, not usually metric labels.

---

# 19. HTTP Metrics

Track:

```text
request count
error count
latency
status code
endpoint
HTTP method
```

Useful measurements:

```text
p50 latency
p95 latency
p99 latency
```

The tail latency is especially important for production user experience.

---

# 20. Database Metrics

Track:

```text
connection pool utilization
active connections
waiting connections
query latency
slow queries
transaction duration
deadlocks
lock waits
database CPU
database storage
replication lag when replicas exist
```

This helps distinguish:

```text
application problem
```

from:

```text
database bottleneck
```

---

# 21. Redis Metrics

From [architecture/08](../architecture/08-caching-redis-and-distributed-state.md):

```text
cache hit rate
cache miss rate
Redis latency
memory usage
evictions
connected clients
commands/sec
connection errors
```

Track these separately by Redis feature where practical.

---

# 22. Background Worker Metrics

From [architecture/09](../architecture/09-async-processing-domain-events-and-outbox.md):

```text
jobs_processed_total
jobs_failed_total
jobs_retried_total
processing_duration
queue_depth
oldest_pending_job_age
dead_letter_total
```

A growing queue is often an early indicator of capacity problems.

---

# 23. Outbox Metrics

Important metrics:

```text
outbox_pending_count
outbox_processing_count
outbox_failed_count
outbox_oldest_pending_age
outbox_processing_latency
outbox_retry_count
```

A particularly important metric is:

```text
age of oldest unprocessed event
```

A queue with 100 pending events may be healthy if they arrived milliseconds ago.

A queue with 5 events stuck for 20 minutes may be unhealthy.

---

# 24. Matching Metrics

Matching is a core marketplace capability.

Track:

```text
matching_requests_total
matching_success_total
matching_failed_total
matching_duration
candidate_count
matches_created
matches_expired
no_candidate_requests
```

Business-level metrics can later include:

```text
time_to_first_match
match_acceptance_rate
request_to_booking_conversion
```

These belong to the analytics/product layer as well as operational monitoring.

---

# 25. Booking Metrics

Track:

```text
booking_confirmed_total
booking_cancelled_total
booking_expired_total
booking_confirmation_latency
booking_conflict_total
```

Breakdowns can include:

```text
cancellation actor
category
area
time window
```

where useful.

---

# 26. Job Metrics

Important measurements:

```text
jobs_started_total
jobs_completed_total
jobs_cancelled_total
worker_no_show_total
customer_no_show_total
job_duration
```

Do not turn every metric into a judgment about workers.

For example:

```text
cancellation ≠ no-show
```

and these should remain separate.

---

# 27. Payment Metrics

Financial operations need particularly strong monitoring.

Track:

```text
payments_initiated_total
payments_success_total
payments_failed_total
refunds_requested_total
refunds_success_total
refunds_failed_total
provider_timeout_total
webhook_received_total
webhook_invalid_total
reconciliation_mismatch_total
```

Never put sensitive payment credentials into metrics.

---

# 28. Notification Metrics

Track:

```text
notifications_created_total
notifications_sent_total
notifications_failed_total
notifications_delivered_total
provider_latency
retry_count
dead_letter_count
```

Breakdowns:

```text
channel
provider
notification_type
```

should be carefully controlled for cardinality.

---

# 29. Business Metrics vs Technical Metrics

Both matter.

### Technical

```text
CPU
memory
latency
error rate
DB connections
Redis latency
queue depth
```

### Business

```text
service requests submitted
matches created
bookings confirmed
jobs completed
payments succeeded
repeat customers
```

Technical health without business health is incomplete.

---

# 30. Four Golden Signals

The application should monitor:

```text
Latency
Traffic
Errors
Saturation
```

### Latency

How long requests take.

### Traffic

How much traffic is coming in.

### Errors

How many requests/workflows fail.

### Saturation

How close resources are to capacity.

Examples:

```text
database connections
CPU
memory
worker capacity
queue depth
```

---

# 31. Service-Level Objectives

The system should eventually define SLOs.

Examples:

```text
API availability
API latency
booking operation success
notification processing delay
payment webhook processing delay
```

Avoid inventing exact targets before measuring real workload.

Targets should be selected based on:

* user expectations;
* business criticality;
* infrastructure cost;
* operational maturity.

---

# 32. Availability Is Not Enough

An API can return HTTP 200 while the marketplace is functionally broken.

Example:

```text
POST /service-requests → 200
```

but:

```text
no workers receive matches
```

Technically the API works.

The marketplace does not.

Therefore, monitor critical business workflows end-to-end.

---

# 33. Marketplace Health Signals

Important product-health signals:

```text
requests submitted
requests matched
requests without candidates
matches accepted
bookings confirmed
jobs completed
```

A particularly useful funnel:

```text
Request
   ↓
Match
   ↓
Accept
   ↓
Booking
   ↓
Completion
```

Drops between stages should be observable.

---

# 34. Audit Events

Logs answer:

> What did the software do?

Audit events answer:

> What important action happened, who initiated it, and when?

Examples:

```text
Worker verification approved
Worker suspended
Dispute resolved
Refund issued
Admin changed worker status
Review hidden
```

These should be durable.

---

# 35. Audit vs Application Logs

Do not treat logs as the audit trail.

Logs may be:

* sampled;
* rotated;
* deleted;
* unavailable during incidents.

Audit records represent important business/security history.

Example:

```text
Admin suspended Worker
```

should create an audit event.

A normal debug log is not sufficient.

---

# 36. Audit Event Structure

Conceptually:

```text
audit_event
├── id
├── actor_user_id
├── actor_role
├── action
├── entity_type
├── entity_id
├── reason
├── metadata
├── request_id
├── occurred_at
```

Potentially:

```text
ipAddress
userAgent
```

may be retained according to security/privacy requirements.

---

# 37. Audit Event Examples

```text
WORKER_SUSPENDED
VERIFICATION_APPROVED
VERIFICATION_REJECTED
REFUND_ISSUED
DISPUTE_RESOLVED
REVIEW_HIDDEN
BOOKING_CANCELLED_BY_ADMIN
```

Admin actions should be particularly auditable.

---

# 38. Audit Immutability

Audit records should generally be append-oriented.

Do not casually edit:

```text
Admin suspended worker
```

into:

```text
Admin did not suspend worker
```

If a correction is required:

```text
Correction action
    ↓
new audit record
```

This preserves history.

---

# 39. Audit Metadata

Metadata should explain the action without storing excessive sensitive information.

Example:

```json
{
  "reason": "fraud_review",
  "previousStatus": "ACTIVE",
  "newStatus": "SUSPENDED"
}
```

Avoid storing identity-document contents or secrets.

---

# 40. Correlation Between Audit and Trace

Suppose an admin resolves a dispute.

```text
Audit Event
   ↓
requestId
   ↓
Trace
   ↓
Application Logs
```

This provides an investigation chain.

---

# 41. Error Tracking

Application exceptions should be aggregated.

Examples:

```text
NullPointerException
Database timeout
External provider timeout
Serialization failure
```

The error system should group repeated occurrences rather than generating an entirely separate incident for every request.

---

# 42. Exception Context

An error should include:

```text
traceId
requestId
module
operation
error type
safe business context
timestamp
```

Do not include secrets or sensitive payloads.

---

# 43. Database Slow Queries

Slow query monitoring is critical.

Example:

```text
Service request search
    ↓
PostGIS query
    ↓
unexpectedly slow
```

Observability should identify:

* query duration;
* query pattern;
* frequency;
* affected endpoint;
* database load.

Actual SQL logging must be handled carefully because parameters may contain sensitive information.

---

# 44. External Dependency Monitoring

Track dependencies independently:

```text
Payment provider
SMS provider
Push provider
Email provider
Maps provider
Object storage
Redis
PostgreSQL
```

For each:

```text
latency
error rate
availability
timeouts
retry count
```

This helps determine whether:

```text
our application is broken
```

or:

```text
external dependency is degraded
```

---

# 45. Dependency Failure Example

Suppose payment provider latency increases.

Observed:

```text
payment API latency ↑
provider timeout ↑
payment pending ↑
```

The system should be able to show the relationship.

Without dependency-level telemetry, engineers may incorrectly investigate PostgreSQL or application code.

---

# 46. Health Checks

The application should expose health information.

Conceptually:

```text
Application
 ├── database
 ├── Redis
 ├── object storage
 └── critical dependencies
```

But health checks need classification.

---

# 47. Liveness vs Readiness

### Liveness

Answers:

> Is the process alive?

If not:

```text
restart process
```

### Readiness

Answers:

> Can this instance safely receive traffic?

For example, if required database connectivity is unavailable:

```text
not ready
```

This becomes important when running multiple instances behind a load balancer.

---

# 48. Health Check Caution

Do not make every optional dependency a reason to declare the entire application unhealthy.

For example:

```text
email provider unavailable
```

should not necessarily make:

```text
API unavailable
```

The health model should reflect actual dependency criticality.

---

# 49. Startup Diagnostics

At startup, log safe information such as:

```text
application version
environment
build identifier
database migration version
enabled feature flags
```

Do not log:

```text
passwords
secrets
API keys
full connection strings
```

---

# 50. Deployment Correlation

Every deployment should have an identifiable version.

Example:

```text
applicationVersion = 1.8.3
gitCommit = abc123
buildId = build-456
```

Then an incident can be correlated with:

```text
deployment
```

This makes rollback and root-cause investigation easier.

---

# 51. Feature Flags

Feature flags should be observable.

If:

```text
newMatchingAlgorithm = true
```

logs/metrics should make it possible to determine which behavior was active.

Avoid invisible configuration changes.

---

# 52. Environment Separation

Telemetry should clearly distinguish:

```text
local
test
development
staging
production
```

Production data must not accidentally appear in development observability systems.

---

# 53. Log Retention

Not every log needs permanent retention.

Example conceptual policy:

```text
DEBUG → very short
INFO → moderate
ERROR → longer
AUDIT → separate long-term policy
```

Exact retention depends on:

* operational needs;
* storage cost;
* privacy;
* legal/compliance requirements.

This will connect to [security/03](../security/03-data-privacy-pii-retention-and-compliance.md).

---

# 54. Audit Retention

Audit events often require longer retention than ordinary logs.

For example:

```text
Worker suspension
Refund
Dispute resolution
Verification decision
```

should remain traceable according to the applicable retention policy.

Do not use arbitrary deletion just because the application log retention period ended.

---

# 55. Alerting Philosophy

An alert should mean:

> Someone should investigate or act.

Avoid alerts for every warning.

Bad:

```text
One request returned 400
```

Better:

```text
5xx error rate exceeded operational threshold
```

or:

```text
outbox oldest pending event exceeds threshold
```

---

# 56. Alert Categories

### Availability

```text
API unavailable
database unavailable
Redis unavailable
```

### Performance

```text
p95 latency high
database latency high
matching latency high
```

### Reliability

```text
error rate increased
queue backlog
outbox stuck
dead-letter events increasing
```

### Financial

```text
payment webhook failures
reconciliation mismatches
refund failures
```

### Security

```text
suspicious authentication failures
rate-limit abuse
admin permission anomalies
```

---

# 57. Alert Severity

Use severity levels such as:

```text
INFO
WARNING
CRITICAL
```

or an equivalent operational classification.

Critical alerts should correspond to meaningful user/business impact.

---

# 58. Incident Investigation Workflow

A typical investigation should be:

```text
Alert
 ↓
Identify affected workflow
 ↓
Find trace/request ID
 ↓
Inspect logs
 ↓
Inspect metrics
 ↓
Inspect audit history
 ↓
Inspect dependency health
 ↓
Identify failure
 ↓
Mitigate
 ↓
Verify recovery
 ↓
Post-incident analysis
```

The architecture should make this path practical.

---

# 59. Example Incident

Customer says:

> “I paid, but my booking still shows pending.”

Investigation:

```text
bookingId
    ↓
trace
    ↓
payment creation
    ↓
provider request
    ↓
provider response
    ↓
webhook
    ↓
payment state
```

Observability should allow engineers to answer:

* Was payment initiated?
* Did provider accept it?
* Did webhook arrive?
* Was webhook signature valid?
* Was event duplicated?
* Was the internal transaction committed?
* What is the current authoritative state?

---

# 60. Example Matching Incident

Customer submits a request but receives no workers.

Investigation:

```text
serviceRequestId
    ↓
ServiceRequestSubmitted
    ↓
matching worker
    ↓
candidate query
    ↓
candidate count
    ↓
filtering
    ↓
matches created
```

Possible findings:

```text
0 candidates
```

versus:

```text
50 candidates
but notification processing failed
```

These are completely different problems.

Observability should distinguish them.

---

# 61. Example Notification Incident

Worker says:

> “I accepted the job but did not receive the notification.”

Trace:

```text
MatchAccepted
    ↓
BookingConfirmed
    ↓
Outbox
    ↓
Notification worker
    ↓
Push provider
```

Metrics may show:

```text
provider error rate ↑
```

Logs may show:

```text
push token invalid
```

The issue can then be diagnosed without guessing.

---

# 62. Correlation Across Async Boundaries

A normal HTTP trace may end when the response returns.

But async work continues later.

Therefore propagate:

```text
trace/correlation context
eventId
causationId
aggregateId
```

into the asynchronous processing record.

This connects:

```text
HTTP request
```

to:

```text
outbox event
```

to:

```text
background worker
```

to:

```text
external provider
```

---

# 63. Event ID

Every durable asynchronous event should have a unique ID.

Example:

```text
eventId=01JABC...
```

This should appear in:

* outbox;
* worker logs;
* event consumer logs;
* notification records;
* realtime delivery logs where useful.

---

# 64. Causation ID

Suppose:

```text
Customer Request
    ↓
BookingConfirmed
    ↓
NotificationCreated
```

The notification can record:

```text
causationId = BookingConfirmed.eventId
```

This helps reconstruct why an event/action occurred.

---

# 65. Observability Data Flow

Conceptually:

```text
Application
    │
    ├── Logs ────────→ Log System
    │
    ├── Metrics ─────→ Metrics System
    │
    ├── Traces ──────→ Trace System
    │
    └── Audit ───────→ PostgreSQL
```

Business audit history remains under application/database control.

Operational telemetry may use specialized observability infrastructure.

---

# 66. Production Stack

A possible future stack:

```text
Spring Boot
    ↓
Micrometer / OpenTelemetry
    ↓
OpenTelemetry Collector
    ├── Metrics
    ├── Logs
    └── Traces
          ↓
Observability backend
```

A specific vendor or backend should be selected later based on:

* cost;
* operational simplicity;
* team familiarity;
* retention;
* scale.

---

# 67. Local Development

Developers should have a simple local observability setup.

At minimum:

```text
application logs
request IDs
basic metrics
health endpoints
```

Optionally:

```text
local tracing
local Prometheus/Grafana
```

Do not make local development dependent on a huge observability stack.

---

# 68. Testing Observability

Observability itself should be tested.

Examples:

```text
request ID generated
trace ID propagated
expected metric emitted
audit event created
sensitive fields absent
async correlation preserved
error logged safely
```

A security test should verify that OTPs/tokens do not appear in logs.

---

# 69. Log Testing Example

A test can execute:

```text
POST /auth/otp/verify
```

and verify:

```text
OTP value NOT present
access token NOT present
userId present if appropriate
requestId present
```

This prevents accidental logging regressions.

---

# 70. Operational Dashboards

At minimum, create dashboards for:

### API

```text
requests
latency
errors
throughput
```

### Database

```text
connections
latency
CPU
storage
locks
```

### Redis

```text
memory
latency
hits/misses
connections
```

### Async

```text
queue depth
outbox backlog
failed jobs
dead letters
processing latency
```

### Marketplace

```text
requests
matches
bookings
completed jobs
payments
```

---

# 71. Executive/Product Dashboard

A separate dashboard should show business health rather than infrastructure internals.

Example:

```text
Service requests
Match rate
Booking conversion
Completion rate
Payment success
Repeat usage
Worker activity
```

This helps distinguish:

```text
infrastructure health
```

from:

```text
marketplace health
```

---

# 72. Privacy-Aware Observability

Observability systems often become a secondary data store.

Therefore:

* minimize PII;
* redact sensitive payloads;
* restrict access;
* apply retention policies;
* encrypt data where appropriate;
* audit access to sensitive telemetry;
* prevent production data from leaking into lower environments.

---

# 73. Observability Access Control

Not every employee/admin should access everything.

Potential roles:

```text
Developer
Operations
Security
Finance
Super Admin
```

Financial logs and security events may require stricter access.

---

# 74. Cost Management

Observability can become expensive.

Avoid:

```text
logging every DB query
logging every WebSocket heartbeat
storing massive request bodies
storing duplicate payloads
unbounded debug logs
high-cardinality metrics
```

Instead:

```text
sample where appropriate
aggregate metrics
retain useful logs
store IDs instead of payloads
```

---

# 75. What Should Be Implemented in MVP?

### Logging

```text
structured logs
request ID
safe error context
log levels
PII/secret redaction
```

### Metrics

```text
HTTP metrics
database metrics
Redis metrics
basic business counters
```

### Tracing

```text
request tracing
database spans
external-call spans
async correlation
```

### Audit

```text
admin actions
financial actions
verification decisions
dispute decisions
security-sensitive actions
```

### Monitoring

```text
health checks
basic dashboards
critical alerts
```

---

# 76. What Can Come Later?

Do not initially overbuild:

* sophisticated anomaly detection;
* AI-powered incident diagnosis;
* complex event replay dashboards;
* custom observability platform;
* enormous log retention;
* per-user metric dimensions;
* full distributed tracing for every internal method;
* elaborate SLO tooling before real traffic exists.

---

# 77. Production Growth Path

### Stage 1

```text
Structured application logs
Request IDs
Basic metrics
Health checks
Audit events
```

### Stage 2

```text
Centralized logs
Distributed tracing
Dashboards
Alerts
Async telemetry
```

### Stage 3

```text
SLOs
Error budgets
Advanced dependency monitoring
Capacity planning
Automated incident workflows
```

### Stage 4

```text
Multi-service tracing
Event-stream observability
Advanced analytics
Automated anomaly detection
```

---

# 78. Observability Module Structure

Observability is primarily a cross-cutting infrastructure concern.

Conceptually:

```text
observability/
├── api/
├── application/
│   ├── service/
│   └── port/
├── domain/
│   ├── audit/
│   └── valueobject/
└── infrastructure/
    ├── logging/
    ├── metrics/
    ├── tracing/
    ├── audit/
    └── health/
```

However, business modules should own their domain events and important business context.

Observability should not become the owner of business logic.

---

# 79. Architectural Boundaries

The architecture should maintain:

```text
Business modules
    ↓
produce meaningful events/telemetry
    ↓
Observability infrastructure
    ↓
collects and presents operational information
```

Not:

```text
Observability
    ↓
decides booking/payment/business behavior
```

---

# 80. Core Invariants

The observability architecture must enforce:

1. Logs are structured and searchable.
2. Every incoming request has a correlation/request ID.
3. Distributed traces propagate across asynchronous boundaries where practical.
4. Durable events have unique event IDs.
5. Important admin/security/financial actions create audit records.
6. Audit records are append-oriented.
7. Secrets must never be logged.
8. Sensitive PII must be minimized and protected.
9. High-cardinality identifiers should not become unrestricted metric labels.
10. Business rejection is distinguished from unexpected system failure.
11. Metrics cover both technical and business health.
12. Critical external dependencies are observable independently.
13. Background workers expose queue and processing health.
14. Outbox backlog and age are monitored.
15. Health checks distinguish liveness from readiness.
16. Optional dependency failure does not automatically make the whole platform unavailable.
17. Production telemetry must be separated from lower environments.
18. Observability data has retention and access policies.
19. Logs and audit records serve different purposes.
20. Incident investigation must be traceable from user operation to downstream effect.
21. Observability must not become a second source of business truth.
22. Telemetry collection must not materially slow critical business operations.
23. The system should remain operable even when optional telemetry infrastructure is degraded.
24. Observability should be added according to operational value, not merely because tooling exists.

---

# 81. Final Architecture

The overall production flow becomes:

```text
                         ┌─────────────────────┐
                         │      Client         │
                         └──────────┬──────────┘
                                    │
                              Request ID
                                    │
                                    ↓
                         ┌─────────────────────┐
                         │     Spring Boot     │
                         │   Modular Monolith  │
                         └──────────┬──────────┘
                                    │
             ┌──────────────────────┼──────────────────────┐
             ↓                      ↓                      ↓
          Business              Database               External
          Modules               / Redis               Providers
             │                      │                      │
             └──────────────┬───────┴──────────────┬───────┘
                            ↓                      ↓
                          Logs                  Metrics
                            │                      │
                            └──────────┬───────────┘
                                       ↓
                                     Traces
                                       │
                                       ↓
                              Observability Stack


Business/Admin Actions
          │
          ↓
      Audit Events
          │
          ↓
      PostgreSQL
```

The target operating model is:

```text
User action
    ↓
Request ID
    ↓
Business transaction
    ↓
Domain event
    ↓
Outbox / async processing
    ↓
External effects
    ↓
Logs + metrics + traces
    ↓
Audit where appropriate
    ↓
Dashboards + alerts
```

This gives us something more valuable than simply “logs”:

> **A system where important behavior can be reconstructed from the user's original action through the business transaction, asynchronous processing, external dependency, and final outcome.**

That capability becomes increasingly important as the marketplace grows and multiple application instances, background workers, payment providers, notification providers, and eventually independently deployed services are introduced.

# End of Document
