# Failure Modes, Resilience & Recovery Architecture

## 1. Purpose

A production marketplace cannot be designed only around the happy path.

The system must continue behaving safely when:

```text
requests are duplicated
workers disappear
services timeout
databases become unavailable
Redis fails
payment providers become unreachable
notifications fail
background workers crash
WebSocket connections drop
files fail to upload
deployments fail
events are delayed
external providers return ambiguous results
```

The goal is not to make every dependency impossible to fail.

The goal is:

> When something fails, the system should fail predictably, preserve business correctness, recover safely, and avoid turning one failure into a larger incident.

---

# 2. Core Resilience Principles

The system follows these principles:

```text
1. PostgreSQL is the transactional source of truth.
2. Critical business state must not depend on Redis.
3. External calls must not be trusted blindly.
4. Every retry-sensitive operation must have idempotency.
5. Database constraints protect critical invariants.
6. Asynchronous work must be retryable and recoverable.
7. External timeouts are not automatically failures.
8. Partial failure must be represented explicitly.
9. Critical transactions should remain short.
10. Optional dependencies should degrade gracefully.
11. Recovery must be observable.
12. Financial and trust history must remain reconstructable.
13. Replaying an event must not accidentally repeat irreversible side effects.
14. Human operational intervention must exist for exceptional cases.
```

---

# 3. Failure Classification

Failures should be classified before deciding how to handle them.

```text
Business Failure
Infrastructure Failure
Dependency Failure
Network Failure
Concurrency Failure
Data Failure
Security Failure
Deployment Failure
Operational Failure
```

---

# 4. Business Failure

A business failure is an expected outcome.

Examples:

```text
worker unavailable
no worker found
customer cancels
worker rejects match
payment declined
review not eligible
refund not allowed
```

These should normally be returned as controlled business responses.

They are not necessarily incidents.

---

# 5. Infrastructure Failure

Examples:

```text
PostgreSQL unavailable
Redis unavailable
application process crashes
container crashes
disk/storage issue
CPU exhaustion
memory exhaustion
network failure
```

Infrastructure failures require resilience and operational recovery.

---

# 6. External Dependency Failure

Examples:

```text
payment provider unavailable
SMS provider unavailable
push notification provider unavailable
maps provider unavailable
object storage unavailable
identity verification provider unavailable
```

The system must distinguish:

```text
known failure
timeout
unknown outcome
temporary failure
permanent rejection
```

---

# 7. Network Failure

A network failure is particularly dangerous because the caller may not know whether the remote operation succeeded.

Example:

```text
application
   ↓
payment provider
   ↓
payment succeeds
   ↓
network response lost
```

The application may see:

```text
timeout
```

while the provider sees:

```text
success
```

Therefore:

> Timeout does not necessarily mean failure.

---

# 8. Unknown Outcome

For important operations, use explicit states.

Example:

```text
PAYMENT_PENDING
```

instead of incorrectly converting:

```text
timeout → PAYMENT_FAILED
```

Recovery may occur through:

```text
provider webhook
provider status query
reconciliation
manual investigation
```

---

# 9. Failure Containment

A failure in one subsystem should not unnecessarily break unrelated functionality.

Example:

```text
SMS provider unavailable
```

should not prevent:

```text
existing booking lookup
job execution
review submission
admin dashboard
```

where those operations do not depend on SMS.

---

# 10. Dependency Criticality

Dependencies should be categorized.

### Critical

```text
PostgreSQL
```

The marketplace cannot operate normally without it.

### Important

```text
Redis
Object Storage
Payment Provider
```

Some functionality may degrade.

### Optional / asynchronous

```text
SMS
Push
Email
Maps enhancements
Analytics
```

Many core transactions can continue if these are temporarily unavailable.

---

# 11. Failure Matrix

| Component            | Failure      |                 Core State Safe? | Immediate Behavior                 | Recovery                      |
| -------------------- | ------------ | -------------------------------: | ---------------------------------- | ----------------------------- |
| PostgreSQL           | unavailable  | Yes if transaction not committed | reject/503                         | DB recovery/failover          |
| Redis                | unavailable  |                              Yes | bypass cache/degrade               | Redis recovery                |
| Payment provider     | timeout      |                              Yes | payment pending                    | webhook/status/reconciliation |
| SMS                  | unavailable  |                              Yes | queue/retry                        | provider recovery             |
| Push                 | unavailable  |                              Yes | queue/retry                        | provider recovery             |
| Object storage       | unavailable  |                              Yes | upload unavailable/retry           | storage recovery              |
| WebSocket            | disconnected |                              Yes | REST/push fallback                 | reconnect/resync              |
| Worker process       | crash        |                              Yes | lease expires                      | retry/reclaim                 |
| Outbox worker        | crash        |                              Yes | events remain pending              | worker restart                |
| Maps                 | unavailable  |                              Yes | degraded matching/address behavior | retry/fallback                |
| Application instance | crash        |                              Yes | load balancer routes elsewhere     | restart                       |
| Deployment           | failed       |            Yes if migration safe | stop/rollback                      | recovery procedure            |

---

# 12. PostgreSQL Failure

PostgreSQL is the primary transactional dependency.

If unavailable:

```text
API
 ↓
connection failure
 ↓
business operation cannot safely proceed
```

The application should:

```text
fail fast
return controlled availability error
avoid endless retries
avoid pretending operation succeeded
```

---

# 13. Database Retry

Do not blindly retry every database exception.

Retries should be limited to operations known to be safely retryable.

Potential transient cases:

```text
connection acquisition failure
temporary network failure
serialization failure
deadlock
```

But retry policy must be carefully designed around transaction semantics.

---

# 14. Database Transaction Failure

If:

```text
transaction begins
business state changes
transaction fails
```

then the transaction should roll back.

No external side effect should be assumed successful merely because application code reached that point.

---

# 15. Database Constraint Failure

A unique constraint can intentionally protect correctness.

Example:

```text
two workers accept the same booking simultaneously
```

One transaction wins.

The other receives a conflict.

The application converts the database conflict into an appropriate business response.

---

# 16. Redis Failure

Redis is intentionally not the source of business truth.

Therefore:

```text
Redis unavailable
```

should not corrupt:

```text
bookings
payments
jobs
reviews
refunds
worker verification
```

---

# 17. Redis Degradation

Depending on the feature:

```text
Cache → bypass and read PostgreSQL
Presence → temporarily unavailable
Rate limiting → conservative fallback
Distributed coordination → fail safely
```

The exact fallback depends on the operation.

---

# 18. Redis Cache Failure

For:

```text
GET worker profile
```

a cache miss or Redis outage can cause:

```text
PostgreSQL query
```

instead.

The trade-off is increased database load.

Therefore Redis fallback must be combined with database capacity protection.

---

# 19. Redis Rate-Limit Failure

Security-sensitive rate limiting should not simply become unlimited because Redis is unavailable.

Possible fallback:

```text
local conservative limit
temporary endpoint restriction
fail closed for extremely sensitive operations
```

The exact policy depends on the endpoint.

---

# 20. Payment Provider Failure

Payment failures require special handling.

Possible outcomes:

```text
SUCCESS
FAILED
PENDING
UNKNOWN
```

The internal payment record must represent the actual known state.

---

# 21. Payment Timeout

Example:

```text
Customer pays ₹1,500
       ↓
provider request
       ↓
timeout
```

Do not immediately create a second payment attempt automatically.

Instead:

```text
payment → PENDING
```

then determine final state through:

```text
webhook
status query
reconciliation
```

---

# 22. Duplicate Payment Request

Client may retry because of:

```text
poor network
mobile timeout
app restart
```

Use:

```text
Idempotency-Key
```

to prevent accidental duplicate payment creation.

---

# 23. Duplicate Payment Webhook

Payment providers may send the same webhook more than once.

Use:

```text
provider
+
provider_event_id
```

as a unique idempotency boundary.

Processing should be safe if the same event arrives repeatedly.

---

# 24. Out-of-Order Payment Webhooks

Example:

```text
PAYMENT_SUCCEEDED
PAYMENT_PENDING
```

arrive in the wrong order.

The system must not blindly apply events according to arrival order.

Use:

```text
provider state
event metadata
internal state rules
reconciliation
```

to prevent stale events from corrupting payment state.

---

# 25. Refund Failure

A refund request can remain:

```text
REQUESTED
PROCESSING
```

until provider confirmation.

If the provider fails:

```text
REFUND_FAILED
```

The original payment remains historically intact.

Do not erase or mutate the payment to hide the failed refund.

---

# 26. Payment Reconciliation

A background reconciliation process should compare:

```text
internal payment records
        ↕
provider records
```

and identify:

```text
missing transactions
unexpected success
unexpected failure
amount mismatch
refund mismatch
settlement mismatch
```

---

# 27. Notification Provider Failure

Notification delivery must never normally roll back the core business transaction.

Example:

```text
Booking confirmed
        ↓
DB commit
        ↓
push notification fails
```

The booking remains:

```text
CONFIRMED
```

The notification becomes:

```text
FAILED
```

and can be retried.

---

# 28. Notification Retry

Use:

```text
exponential backoff
jitter
bounded attempts
failure classification
```

Do not retry permanent failures indefinitely.

---

# 29. Notification Dead Letter

After repeated failure:

```text
notification
      ↓
dead-letter state
      ↓
admin/operations visibility
```

The marketplace transaction remains intact.

---

# 30. SMS Failure During OTP

OTP delivery is special because authentication may depend on it.

If SMS provider fails:

```text
OTP request accepted
OTP delivery failed
```

The system should:

```text
not reveal the OTP
record delivery failure
apply retry/fallback policy
avoid generating unlimited OTPs
```

---

# 31. WebSocket Failure

WebSocket is not authoritative.

If disconnected:

```text
client reconnects
       ↓
authenticate
       ↓
resubscribe
       ↓
refetch authoritative REST state
```

This protects against missed events.

---

# 32. Missed WebSocket Event

Example:

```text
Booking confirmed
WebSocket delivery fails
```

The booking still exists as:

```text
CONFIRMED
```

The client eventually discovers this through:

```text
REST refetch
```

---

# 33. Duplicate WebSocket Events

Clients should tolerate duplicate event IDs.

Example:

```text
eventId = ABC123
```

If received twice, the client should not treat it as two business operations.

---

# 34. Worker Process Failure

Background workers can crash during processing.

Example:

```text
NotificationWorker
      ↓
processing
      ↓
process crashes
```

The job must not remain permanently stuck.

Use:

```text
claimed_at
lease/visibility timeout
attempt count
```

so another worker can reclaim it.

---

# 35. Worker Crash Recovery

General pattern:

```text
PENDING
   ↓
CLAIMED
   ↓
PROCESSING
   ↓
SUCCESS
```

If worker dies:

```text
PROCESSING
   ↓
lease expires
   ↓
eligible again
```

---

# 36. Outbox Worker Failure

If an outbox worker crashes:

```text
outbox event remains in PostgreSQL
```

The event is not lost.

After worker recovery:

```text
pending event
   ↓
retry
```

---

# 37. Poison Messages

Some events may consistently fail because of malformed data or a permanent issue.

Do not retry forever.

Use:

```text
bounded attempts
        ↓
dead-letter state
        ↓
operator investigation
```

---

# 38. Event Replay Risk

Replaying an event can be dangerous.

For example:

```text
PAYMENT_SUCCESS
```

must not accidentally cause:

```text
second charge
```

or:

```text
second worker settlement
```

Therefore consumers need idempotency and replay-aware design.

---

# 39. Object Storage Failure

If object storage becomes unavailable:

```text
new uploads may fail
```

but existing transactional data should remain safe.

The service request should not be deleted because an attachment upload failed.

---

# 40. Upload Failure

Upload lifecycle:

```text
CREATED
   ↓
UPLOADING
   ↓
UPLOADED
   ↓
PROCESSING
   ↓
AVAILABLE
```

Failure should result in explicit states rather than silently assuming success.

---

# 41. Orphaned Objects

Object storage and PostgreSQL cannot participate in one normal atomic transaction.

Therefore:

```text
DB metadata exists
but object missing
```

or:

```text
object exists
but DB metadata missing
```

can occur.

A reconciliation process should detect these cases.

---

# 42. Media Processing Failure

If image processing fails:

```text
original object may remain
processing state → FAILED
```

The user should receive an actionable result.

Do not corrupt the original object merely because a derived thumbnail failed.

---

# 43. Maps Provider Failure

Maps may support:

```text
geocoding
distance calculations
address suggestions
```

If unavailable:

```text
use already stored coordinates where possible
degrade optional address features
retry asynchronous enrichment
```

Matching should not unnecessarily depend on an external maps API if PostGIS already has the required coordinates.

---

# 44. Matching Failure

Matching may fail because:

```text
no candidates
matching worker failure
PostGIS query failure
temporary infrastructure issue
```

These are different situations.

### No candidates

```text
FAILED_TO_MATCH
```

### Infrastructure failure

```text
retry matching
```

Do not tell the customer that no worker exists merely because the matching subsystem crashed.

---

# 45. Matching Retry

A retryable matching process should be:

```text
idempotent
bounded
observable
safe under multiple workers
```

Multiple matching workers must not create duplicate booking opportunities incorrectly.

---

# 46. No Worker Found

No worker found is a valid marketplace outcome.

The system can:

```text
expand matching round where policy allows
wait for later availability
notify customer
expire request
```

This is different from technical failure.

---

# 47. Booking Concurrency Failure

Consider:

```text
Worker A accepts
Worker B accepts
```

simultaneously.

Only one booking should become confirmed.

Protection comes from:

```text
transaction
+
database constraint
+
appropriate locking/versioning
```

not Redis alone.

---

# 48. Booking Retry

If the client does:

```text
POST /bookings/{id}/confirm
```

and receives a timeout, the client should safely retry using documented idempotency/concurrency behavior.

The result should reflect the authoritative booking state.

---

# 49. Job Completion Failure

Suppose the worker presses:

```text
Complete Job
```

but the network fails.

The client may not know whether completion succeeded.

The API must therefore support safe retry.

If the job already became:

```text
WORK_COMPLETED
```

a repeated completion request should return an appropriate idempotent/already-completed result rather than creating a second completion.

---

# 50. Additional Work Failure

Additional work requires customer approval.

Possible sequence:

```text
PROPOSED
   ↓
APPROVED
```

If the approval request times out, the client should query the current state before attempting another operation.

---

# 51. Review Submission Failure

Reviews should be idempotent or otherwise protected from duplicate submission.

If the customer submits:

```text
5 stars
```

and the response is lost, retrying should not create two reviews.

---

# 52. Dispute Failure

Dispute creation must also prevent duplicate disputes for the same eligible job/rule where required.

Evidence uploads should be independently recoverable.

---

# 53. Authentication Failure

Potential causes:

```text
invalid OTP
expired OTP
expired token
revoked token
suspended account
provider outage
```

These should produce distinct internal outcomes where useful while avoiding information leakage to attackers.

---

# 54. Token Revocation

If an account is:

```text
suspended
deactivated
compromised
```

active sessions/tokens should be invalidated according to the authentication architecture.

---

# 55. Application Instance Failure

The application should be stateless enough that another instance can serve requests.

Architecture:

```text
Load Balancer
       ↓
 ┌─────────────┐
 │ App Instance│
 ├─────────────┤
 │ App Instance│
 └─────────────┘
       ↓
 PostgreSQL
 Redis
 Object Storage
```

---

# 56. Graceful Shutdown

During deployment:

```text
stop accepting new work
finish or safely release in-flight work
close connections
release worker leases
shutdown
```

Background jobs must be recoverable if interrupted.

---

# 57. Connection Pool Exhaustion

Possible causes:

```text
slow queries
long transactions
too many concurrent requests
database unavailable
connection leak
```

Mitigation:

```text
bounded connection pool
timeouts
query monitoring
short transactions
load shedding
```

Do not solve connection exhaustion simply by continuously increasing pool size.

---

# 58. Thread Pool Exhaustion

Background and request processing should have bounded concurrency.

Separate pools may eventually be used for:

```text
HTTP requests
notifications
matching
media processing
reconciliation
```

A slow media workload should not consume all capacity needed for booking operations.

---

# 59. Backpressure

When work arrives faster than it can be processed:

```text
producer
   ↓
queue
   ↓
workers
```

The system must have limits.

Possible controls:

```text
queue limits
concurrency limits
rate limits
batch sizes
load shedding
```

---

# 60. Retry Storm Prevention

Retries can amplify incidents.

Bad pattern:

```text
provider fails
 ↓
1000 requests retry immediately
 ↓
provider receives 1000 more requests
 ↓
failure worsens
```

Use:

```text
exponential backoff
jitter
bounded retries
circuit breaking where appropriate
```

---

# 61. Circuit Breakers

Circuit breakers may be useful for repeatedly failing external dependencies.

Conceptually:

```text
CLOSED
  ↓ failures
OPEN
  ↓ wait
HALF_OPEN
  ↓ successful probes
CLOSED
```

They should be introduced where actual dependency behavior justifies them.

Do not place circuit breakers around every internal method.

---

# 62. Timeouts

Every external dependency should have explicit timeouts.

Avoid:

```text
indefinite waiting
```

Timeouts should reflect the operation.

For example:

```text
payment API
maps request
notification provider
object storage
```

may have different timeout requirements.

---

# 63. Long Transactions

Never hold a database transaction open while waiting for:

```text
payment provider
SMS provider
object storage
maps API
```

Preferred:

```text
DB transaction
   ↓
commit
   ↓
external operation
   ↓
update state
```

or:

```text
DB transaction
   ↓
outbox
   ↓
background worker
   ↓
external operation
```

depending on the workflow.

---

# 64. Partial Failure

A transaction can succeed while its side effect fails.

Example:

```text
Booking confirmed
Notification failed
```

This is not necessarily a system inconsistency.

The correct model is:

```text
business state = CONFIRMED
notification state = FAILED
```

---

# 65. Business State vs Side Effect State

Never use:

```text
notification sent
```

as proof that:

```text
booking confirmed
```

The booking itself remains authoritative.

Similarly:

```text
payment notification delivered
```

does not prove payment success.

---

# 66. Customer Experience During Failure

Failure handling must produce understandable states.

Bad:

```text
Something went wrong.
```

Better:

```text
Payment is still being confirmed.
```

or:

```text
We couldn't find an available worker yet.
```

or:

```text
Your booking is confirmed, but the notification could not be delivered.
```

The exact UI wording belongs to product/client design, but backend states must provide enough information.

---

# 67. Failure State vs Terminal State

Not every failure should be terminal.

For example:

```text
PAYMENT_PENDING
```

may recover.

Similarly:

```text
MATCHING_RETRYABLE
```

may continue.

Distinguish:

```text
retryable failure
permanent business failure
unknown state
terminal failure
```

---

# 68. Cancellation During Failure

Suppose:

```text
customer cancels
```

while:

```text
payment provider is unreachable
```

The business state and financial state must be handled independently.

Example:

```text
booking → CANCELLED
payment → PENDING
```

The reconciliation system later resolves the payment.

---

# 69. Worker Goes Offline During Job

A worker may disappear after:

```text
WORK_STARTED
```

This does not automatically mean:

```text
WORKER_NO_SHOW
```

The system should distinguish:

```text
worker connectivity
job state
presence
operational timeout
customer report
admin investigation
```

---

# 70. Customer Goes Offline

Similarly, customer connectivity does not change booking/job state.

The worker can continue according to the established business rules.

The customer can resync later.

---

# 71. Device Crash

Mobile application crash must not corrupt server state.

Server operations should therefore be:

```text
atomic
idempotent
state-based
retryable where appropriate
```

---

# 72. Duplicate Requests

Duplicate requests can originate from:

```text
user double tap
mobile retry
network retry
client bug
malicious automation
```

Protection:

```text
idempotency keys
unique constraints
state transitions
business uniqueness rules
```

---

# 73. Stale Client State

Example:

```text
Client thinks booking = PENDING
Server already has CONFIRMED
```

A command based on stale state should be evaluated against current server state.

The client is never authoritative.

---

# 74. Optimistic Concurrency

For resources where concurrent edits matter:

```text
version number
updatedAt/version token
```

can detect stale updates.

Example:

```text
expectedVersion = 7
actualVersion = 8
```

Result:

```text
CONCURRENT_MODIFICATION
```

---

# 75. Pessimistic Locking

For highly sensitive short-lived transitions, database locking may be appropriate.

Examples:

```text
booking confirmation
refund processing
critical financial transition
```

Locks should remain:

```text
short
bounded
well indexed
transaction-scoped
```

---

# 76. Deadlocks

Concurrent transactions can deadlock.

Mitigation:

```text
consistent lock ordering
short transactions
proper indexes
bounded retry for known transient deadlocks
```

Never hide recurring deadlocks with unlimited retries.

---

# 77. Data Corruption

Data corruption is different from infrastructure downtime.

Possible causes:

```text
application bug
migration bug
manual admin error
malicious activity
provider mismatch
```

Response:

```text
stop harmful automation
identify scope
preserve evidence
restore/reconstruct safely
validate invariants
```

---

# 78. Invariant Validation

After recovery, validate important invariants:

```text
one confirmed booking/request
one job/booking
payment totals valid
refunds <= captured
valid state transitions
review eligibility
worker/account consistency
verification consistency
```

---

# 79. Recovery Must Be Business-Aware

A database being:

```text
ONLINE
```

does not prove the marketplace has recovered.

Recovery validation should include:

```text
authentication
service requests
matching
booking
jobs
payments
refunds
notifications
worker access
admin access
```

---

# 80. Deployment Failure

A failed deployment can result from:

```text
application startup failure
migration failure
configuration error
dependency incompatibility
memory/resource problem
```

Deployment pipeline should:

```text
detect
stop rollout
prevent further damage
rollback application where safe
```

---

# 81. Database Migration Failure

Database rollback is more dangerous than application rollback.

Therefore prefer:

```text
backward-compatible migrations
expand-and-contract
```

rather than destructive one-step schema changes.

---

# 82. Feature Flags

Feature flags can separate:

```text
deployment
```

from:

```text
feature activation
```

If a new feature causes problems:

```text
disable feature
```

without necessarily rolling back the entire application.

---

# 83. Security Incident

Security failures require a separate response path.

Examples:

```text
token compromise
credential leakage
unauthorized admin action
data exposure
malicious file
payment manipulation
```

Response:

```text
detect
contain
revoke/rotate
investigate
repair
recover
validate
```

---

# 84. Stop-the-Bleeding Controls

The admin/ops platform should eventually provide controlled emergency actions such as:

```text
disable payments
pause new bookings
pause matching
disable worker activation
disable a provider
disable a feature
```

These must be:

```text
permission-controlled
audited
reason-required
reversible
```

---

# 85. Provider Failover

Multiple providers may eventually exist for:

```text
payments
SMS
email
maps
identity verification
```

But failover must not create duplicate external operations.

For example:

```text
Payment Provider A timeout
```

does not automatically mean:

```text
charge Provider B
```

unless the system can safely determine Provider A did not succeed.

---

# 86. Graceful Degradation Levels

The platform can conceptually operate at levels.

### Level 0 — Normal

All dependencies operational.

### Level 1 — Degraded

Optional notifications/maps unavailable.

Core marketplace continues.

### Level 2 — Restricted

Payment or matching degraded.

Affected workflows become pending/restricted.

### Level 3 — Read-Only / Emergency

Core writes disabled because transactional storage is unavailable or unsafe.

Users may still receive limited information if safely available.

---

# 87. Read-Only Mode

A controlled read-only mode may be useful during severe incidents.

Potentially allow:

```text
view existing booking
view job history
view profile
```

while disabling:

```text
booking creation
payment
refund
state-changing operations
```

Only if the underlying data is sufficiently reliable.

---

# 88. Incident Observability

Every important failure should be traceable through:

```text
requestId
traceId
userId where appropriate
aggregateId
eventId
provider transaction ID
worker/job ID
error code
attempt number
```

Sensitive values must still be redacted.

---

# 89. Failure Metrics

Track:

```text
API error rate
API latency
database failures
Redis failures
payment failures
payment pending duration
webhook failures
notification failure rate
outbox backlog
worker retry count
dead-letter count
matching failure rate
upload failure rate
WebSocket disconnects
job recovery count
```

---

# 90. Failure Alerts

Alert on symptoms that matter.

Examples:

```text
payment pending duration unusually high
outbox backlog continuously growing
database connection pool exhausted
matching failures suddenly increase
refund failures increase
notification backlog grows
```

Avoid alerting on every individual expected business rejection.

---

# 91. Recovery Runbook

A generic incident workflow:

```text
1. Detect
        ↓
2. Assign severity
        ↓
3. Assign owner
        ↓
4. Protect users/data/money
        ↓
5. Stop harmful automation
        ↓
6. Identify affected subsystem
        ↓
7. Determine scope
        ↓
8. Mitigate
        ↓
9. Recover
        ↓
10. Validate business invariants
        ↓
11. Restore normal traffic
        ↓
12. Monitor
        ↓
13. Document
        ↓
14. Postmortem
```

---

# 92. Incident Severity

A practical model:

### SEV-1

Major financial, security, or marketplace-wide outage.

### SEV-2

Significant degradation affecting an important workflow or large user group.

### SEV-3

Limited functionality or operational issue with workaround.

### SEV-4

Low-impact defect or operational anomaly.

Exact thresholds should be defined once real operational data exists.

---

# 93. Incident Ownership

Every incident should have:

```text
Incident Commander
Technical owner
Communication owner
Relevant domain owner
```

For a small startup, one person may temporarily perform multiple roles.

---

# 94. Postmortem

After significant incidents document:

```text
What happened?
When did it begin?
How was it detected?
What was affected?
Why did it happen?
Why did existing controls not prevent it?
How was it mitigated?
How was it recovered?
What data/business state was affected?
What will change?
```

Avoid focusing only on individual blame.

---

# 95. Chaos / Resilience Testing

Eventually test controlled failures:

```text
Redis unavailable
payment provider timeout
SMS unavailable
worker crash
outbox worker crash
database connection interruption
object storage failure
WebSocket disconnect
```

These tests should start in non-production environments.

---

# 96. Failure Injection

Examples:

```text
kill background worker
inject provider timeout
drop Redis connection
restart application instance
delay webhook
duplicate webhook
delay outbox processing
```

The purpose is to verify documented recovery behavior.

---

# 97. Recovery Testing

DR testing should periodically verify:

```text
backup restore
database recovery
object storage recovery
application recreation
secret recovery
worker recovery
outbox recovery
payment reconciliation
```

Recovery procedures are not considered reliable until exercised.

---

# 98. Dependency Isolation

External provider implementations should sit behind interfaces:

```text
PaymentGateway
NotificationGateway
SmsGateway
MapsGateway
StorageGateway
VerificationGateway
```

This makes it possible to:

```text
test failures
replace providers
mock dependencies
introduce failover later
```

without changing core domain logic.

---

# 99. Failure Injection at Boundaries

Testing should inject failures at boundaries rather than randomly corrupting internal state.

Important boundaries:

```text
Application → PostgreSQL
Application → Redis
Application → Payment
Application → Notification
Application → Storage
Application → Maps
Worker → Outbox
Client → API
Provider → Webhook
```

---

# 100. Resilience Architecture

The resulting architecture is:

```text
                    ┌───────────────┐
                    │ Client Apps   │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Load Balancer │
                    └───────┬───────┘
                            │
                 ┌──────────┴──────────┐
                 ▼                     ▼
          ┌─────────────┐       ┌─────────────┐
          │ Spring Boot │       │ Spring Boot │
          │ Instance 1  │       │ Instance 2  │
          └──────┬──────┘       └──────┬──────┘
                 │                     │
                 └──────────┬──────────┘
                            │
                    ┌───────▼────────┐
                    │  PostgreSQL    │
                    │ Source of Truth│
                    └───────┬────────┘
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
          Redis         Object Storage   Outbox
             │                             │
             │                             ▼
             │                       Background
             │                         Workers
             │
             ▼
       Realtime Coordination

External:
Payment / SMS / Push / Email / Maps / Verification
```

---

# 101. Failure Boundary Principle

Every external dependency should have:

```text
timeout
retry policy
failure classification
observability
fallback/degradation behavior
recovery mechanism
```

Not every dependency needs the same implementation.

---

# 102. What Must Never Happen

The system must prevent:

```text
Redis failure → lost booking
notification failure → rolled-back booking
WebSocket failure → lost business state
payment timeout → assumed payment failure
duplicate webhook → duplicate financial operation
duplicate request → duplicate payment/booking
worker crash → permanently stuck background job
database race → two confirmed bookings
object-storage failure → deleted service request
stale client → unauthorized state transition
retry storm → dependency collapse
```

---

# 103. Failure Handling by Domain

| Domain          | Primary Failure Concern                 | Protection                  |
| --------------- | --------------------------------------- | --------------------------- |
| Identity        | duplicate/auth abuse                    | rate limits, token controls |
| Worker          | verification/availability inconsistency | state rules, DB constraints |
| Service Request | duplicate/failed matching               | idempotency, retry          |
| Matching        | no candidates vs infrastructure failure | explicit outcomes           |
| Booking         | concurrent acceptance                   | transaction + constraint    |
| Job             | stale/duplicate transitions             | state machine + idempotency |
| Payment         | unknown provider outcome                | pending + reconciliation    |
| Refund          | duplicate/refund race                   | financial invariants        |
| Review          | duplicate/fraud                         | eligibility + uniqueness    |
| Dispute         | evidence/state inconsistency            | explicit workflow           |
| Notification    | provider failure                        | async retry                 |
| Media           | object/DB mismatch                      | lifecycle + reconciliation  |
| Realtime        | missed events                           | REST resync                 |
| Analytics       | delayed/lost derived data               | asynchronous recovery       |
| Admin           | dangerous operations                    | RBAC + audit                |

---

# 104. Failure Philosophy

The system should distinguish:

```text
"The business rejected this operation."
```

from:

```text
"The system could not determine the outcome."
```

and from:

```text
"The system is currently unavailable."
```

These are fundamentally different situations.

---

# 105. MVP Resilience Scope

For MVP, implement:

```text
database transactions
database constraints
idempotency for critical commands
payment webhook idempotency
payment pending state
bounded retries
background worker recovery
transactional outbox where asynchronous reliability requires it
Redis graceful degradation
private object storage
WebSocket reconnect/resync
provider timeouts
structured error handling
request/trace correlation
health checks
backup/restore procedures
basic reconciliation
admin operational controls
```

---

# 106. Future Resilience Capabilities

Later, based on measured requirements:

```text
circuit breakers
advanced provider failover
read replicas
dedicated worker pools
queue infrastructure
Kafka/event backbone
automated failover
multi-AZ database
multi-region DR
advanced chaos testing
automated remediation
service-level isolation
```

These should be introduced according to actual failure patterns and scale.

---

# 107. Core Resilience Invariants

The system must preserve:

1. Business state is authoritative in PostgreSQL.
2. Redis failure must not corrupt transactional state.
3. External timeout does not automatically mean external failure.
4. Payment state must remain financially reconstructable.
5. Refunds must remain bounded by captured funds.
6. Duplicate requests must not create duplicate critical operations.
7. Duplicate webhooks must be safe.
8. Async workers must recover from crashes.
9. Outbox events must survive application crashes.
10. Retry attempts must be bounded.
11. Retry storms must be prevented.
12. Critical state transitions must be concurrency-safe.
13. WebSocket failure must not lose business state.
14. Object-storage failure must not corrupt transactional records.
15. Matching failure must be distinguishable from no available workers.
16. Business failures must be distinguishable from infrastructure failures.
17. Stale clients cannot override current server state.
18. Recovery must validate business invariants.
19. Security incidents require containment and credential/session controls.
20. Operational emergency actions must be audited.
21. Replayed events must not repeat irreversible side effects.
22. Critical dependencies must have explicit recovery procedures.
23. Backups are useful only if restoration is tested.
24. Every important failure must be observable.
25. The system should degrade gracefully where correctness permits.

---

# 108. Final Principle

The marketplace should not be designed around the assumption:

```text
Everything works.
```

It should be designed around:

```text
Something will eventually fail.
```

The engineering objective is therefore:

```text
Failure
   ↓
Containment
   ↓
Correct State
   ↓
Observable Recovery
   ↓
Reconciliation
   ↓
Verified Recovery
```

A resilient system is not one that never fails.

It is one where failure does not silently become:

```text
lost money
lost bookings
corrupted state
duplicate transactions
lost trust
lost data
or an unrecoverable operational situation.
```

# End of Document
