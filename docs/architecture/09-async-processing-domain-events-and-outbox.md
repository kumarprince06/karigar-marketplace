# Async Processing, Domain Events, Transactional Outbox & Background Workers

## 1. Purpose

The platform contains many operations that should not make the customer's or worker's HTTP request wait for every downstream task to finish.

Examples:

* sending notifications;
* sending SMS/push messages;
* processing uploaded files;
* generating thumbnails;
* updating derived statistics;
* triggering matching;
* publishing realtime events;
* reconciliation;
* cleanup;
* retrying failed external operations.

This document defines how the system handles asynchronous processing while preserving correctness.

The central principle is:

> **Business state changes happen transactionally first. Non-critical side effects happen asynchronously afterward.**

---

# 2. Why Asynchronous Processing Is Required

Consider a worker accepting a job.

A naive implementation might do:

```text
HTTP Request
    ↓
Update booking
    ↓
Send push notification
    ↓
Send SMS
    ↓
Send WebSocket event
    ↓
Update analytics
    ↓
Return HTTP response
```

This creates several problems.

If SMS takes 2 seconds:

```text
Customer waits 2 seconds
```

If SMS provider is unavailable:

```text
Booking request may fail
```

If analytics fails:

```text
Core transaction may fail
```

That is undesirable.

Instead:

```text
HTTP Request
    ↓
DB Transaction
    ↓
Booking CONFIRMED
    ↓
Commit
    ↓
Return response
    ↓
Async processing
       ├── notification
       ├── realtime event
       ├── analytics
       └── other side effects
```

---

# 3. Synchronous vs Asynchronous Work

Not everything should be asynchronous.

## Synchronous

Keep work synchronous when the caller needs the result immediately or the operation is part of the business transaction.

Examples:

```text
Validate service request
Create booking
Confirm booking
Accept match
Approve additional work
Complete job
Create payment intent
Create dispute
Submit review
```

## Asynchronous

Use async processing for work that can happen after the transaction.

Examples:

```text
Send notification
Send SMS
Send email
Publish realtime event
Generate image thumbnail
Process video
Update search/read models
Generate analytics events
Cleanup expired files
Retry external provider operation
```

---

# 4. Domain Events

A domain event represents something meaningful that happened in the business domain.

Examples:

```text
ServiceRequestSubmitted
MatchCreated
WorkerAcceptedMatch
BookingConfirmed
JobStarted
JobCompleted
PaymentSucceeded
RefundSucceeded
ReviewCreated
DisputeOpened
WorkerVerificationApproved
```

These events describe facts.

For example:

```text
BookingConfirmed
```

means:

> A booking was successfully confirmed.

It does not mean:

> Send SMS.

The notification system decides what to do with that fact.

---

# 5. Domain Event vs Command

These concepts must remain separate.

### Command

Requests an action.

```text
ConfirmBooking
AcceptMatch
CompleteJob
```

### Event

Describes something that already happened.

```text
BookingConfirmed
MatchAccepted
JobCompleted
```

Conceptually:

```text
Command
   ↓
Business logic
   ↓
State change
   ↓
Event
```

---

# 6. Example

Customer confirms a booking.

```text
ConfirmBookingCommand
        ↓
Booking.confirm()
        ↓
Booking status = CONFIRMED
        ↓
BookingConfirmed event
```

Consumers may then perform:

```text
BookingConfirmed
    ├── Notify customer
    ├── Notify worker
    ├── Publish WebSocket event
    ├── Record analytics
    └── Update derived views
```

The booking domain does not need to know how SMS or WebSocket delivery works.

---

# 7. Why Events Are Useful in a Modular Monolith

Events are useful even before microservices.

Our architecture is:

```text
Java
Spring Boot
Modular Monolith
```

A module can publish:

```text
BookingConfirmed
```

and other modules can react without tightly coupling their implementation.

For example:

```text
booking
   ↓
BookingConfirmed
   ↓
notification
realtime
analytics
```

This keeps module responsibilities clearer.

---

# 8. In-Process Events

The initial implementation can use Spring's application event mechanism.

Conceptually:

```text
Booking Application Service
        ↓
Transaction
        ↓
Publish domain/application event
        ↓
Event listener
```

This is appropriate for early development.

However, there is an important reliability problem.

---

# 9. The Event Loss Problem

Suppose:

```text
DB transaction succeeds
```

and then:

```text
application crashes
```

before the event is delivered.

Now:

```text
Booking = CONFIRMED
```

but:

```text
Notification = never triggered
```

This creates inconsistency.

A simple in-memory event mechanism cannot provide durable delivery guarantees across crashes.

This leads to the **Transactional Outbox Pattern**.

---

# 10. Transactional Outbox Pattern

The outbox pattern stores an event in PostgreSQL as part of the same transaction that changes business state.

Example:

```text
BEGIN TRANSACTION

UPDATE bookings
SET status = 'CONFIRMED'

INSERT INTO outbox_events (...)

COMMIT
```

Both operations succeed or fail together.

Therefore:

```text
Booking confirmed
+
Event recorded
```

are atomic from the database's perspective.

---

# 11. Outbox Architecture

```text
                    PostgreSQL
                  ┌─────────────┐
                  │   Booking   │
                  │    State    │
                  └──────┬──────┘
                         │
                  same transaction
                         │
                         ↓
                  ┌─────────────┐
                  │   Outbox    │
                  │   Events    │
                  └──────┬──────┘
                         │
                         ↓
                 Outbox Processor
                         │
              ┌──────────┼──────────┐
              ↓          ↓          ↓
         Notification  Realtime  Analytics
```

---

# 12. Outbox Table

A future table can look conceptually like:

```text
outbox_events

id
event_id
event_type
aggregate_type
aggregate_id
payload
occurred_at
status
attempt_count
available_at
processed_at
last_error
created_at
```

Possible statuses:

```text
PENDING
PROCESSING
PUBLISHED
FAILED
```

The exact schema will be finalized during database/LLD implementation.

---

# 13. Important Outbox Invariant

The business transaction and outbox insertion must happen in the **same database transaction**.

Correct:

```text
BEGIN
    change business state
    create outbox event
COMMIT
```

Incorrect:

```text
change business state
COMMIT

later...

create event
```

The second design creates a gap where the event can be lost.

---

# 14. Outbox Processor

A background worker periodically reads pending events.

Example:

```text
Outbox Processor
      ↓
SELECT pending events
      ↓
Claim events
      ↓
Publish/process
      ↓
Mark successful
```

If processing fails:

```text
attempt_count++
available_at = future time
last_error = ...
```

Then retry.

---

# 15. At-Least-Once Delivery

The system should assume:

> Events may be delivered more than once.

For example:

```text
Event #123
    ↓
Consumer processes event
    ↓
Network failure
    ↓
Publisher does not know success
    ↓
Event retried
    ↓
Consumer receives Event #123 again
```

Therefore consumers must be idempotent.

---

# 16. Idempotent Event Consumers

Example:

```text
BookingConfirmed
```

Notification consumer receives:

```text
eventId = 123
```

It creates the notification.

If event 123 arrives again:

```text
eventId = 123
```

the consumer detects that it has already processed the event.

Possible mechanisms:

```text
processed_event_id
unique(event_id)
business-specific idempotency key
```

---

# 17. Exactly-Once Is Not the Default Assumption

The system should not depend on theoretical exactly-once delivery.

Instead design for:

```text
At-least-once delivery
+
idempotent consumers
```

This is easier to reason about and resilient to retries.

---

# 18. Event Envelope

Events should have consistent metadata.

Example:

```json
{
  "eventId": "01J...",
  "eventType": "BOOKING_CONFIRMED",
  "version": 1,
  "aggregateType": "BOOKING",
  "aggregateId": "01J...",
  "occurredAt": "2026-09-30T10:30:00Z",
  "payload": {
    "bookingId": "01J...",
    "workerId": "01J...",
    "customerId": "01J..."
  }
}
```

Important fields:

* unique event ID;
* event type;
* version;
* aggregate type;
* aggregate ID;
* occurrence timestamp;
* payload.

---

# 19. Event Versioning

Events may live for a long time.

Suppose version 1 contains:

```text
workerId
customerId
```

Later version 2 adds:

```text
scheduledStartTime
```

Consumers may need to support multiple versions during migration.

Therefore:

```text
BOOKING_CONFIRMED v1
BOOKING_CONFIRMED v2
```

should be considered during event design.

Do not casually change event meaning.

---

# 20. Event Payload Design

Events should contain enough information for the consumer to perform its responsibility.

But do not dump entire database entities into events.

Bad:

```text
entire Booking JPA entity
+
entire Worker entity
+
entire Customer entity
+
all relationships
```

Prefer:

```text
bookingId
customerId
workerId
event timestamp
relevant state
```

Consumers can retrieve additional data if necessary.

---

# 21. Event Immutability

Once an event represents a historical fact:

```text
BookingConfirmed
```

its meaning should not be rewritten.

If something later changes:

```text
BookingCancelled
```

should be a separate event.

Do not mutate:

```text
BookingConfirmed
```

into:

```text
BookingCancelled
```

---

# 22. Event Categories

Events can be categorized.

### Marketplace

```text
ServiceRequestSubmitted
MatchCreated
MatchExpired
```

### Booking

```text
BookingConfirmed
BookingCancelled
BookingRescheduled
```

### Job

```text
JobEnRoute
JobArrived
JobStarted
JobCompleted
JobNoShow
```

### Payment

```text
PaymentInitiated
PaymentSucceeded
PaymentFailed
RefundSucceeded
```

### Trust

```text
ReviewCreated
VerificationApproved
VerificationRevoked
DisputeOpened
DisputeResolved
```

### Platform

```text
NotificationRequested
MediaUploaded
MediaProcessingCompleted
```

---

# 23. Event Ownership

Events should be owned by the module that owns the underlying business state.

For example:

```text
booking
    → BookingConfirmed
```

not:

```text
notification
    → BookingConfirmed
```

Notification consumes the event; it does not own the booking fact.

---

# 24. Domain Event vs Integration Event

In a modular monolith, there is value in distinguishing:

### Domain Event

Internal business fact.

```text
BookingConfirmed
```

### Integration Event

Stable message intended for external infrastructure or future services.

Example:

```text
BookingConfirmedIntegrationEvent
```

Initially they may be represented similarly.

As the system evolves, the distinction becomes important when modules are extracted.

---

# 25. Async Processing Pipeline

A typical flow:

```text
API Request
     ↓
Application Service
     ↓
Domain Aggregate
     ↓
DB Transaction
     ├── business state
     └── outbox event
             ↓
          COMMIT
             ↓
       Background Worker
             ↓
        Event Handler
             ↓
      External Side Effect
```

---

# 26. Notification Example

Worker accepts a match.

```text
AcceptMatch
    ↓
Match = ACCEPTED
    ↓
Booking created/updated
    ↓
Transaction commits
    ↓
MatchAccepted event
    ↓
Outbox
    ↓
Notification worker
    ↓
Push notification
    ↓
SMS if policy requires
```

If push fails:

```text
retry
```

The booking remains accepted.

---

# 27. Realtime Example

Booking confirmed.

```text
Booking.confirm()
       ↓
BookingConfirmed
       ↓
Outbox
       ↓
Realtime consumer
       ↓
WebSocket
```

If WebSocket delivery fails:

```text
REST remains authoritative
```

The client can reconnect and fetch:

```text
GET /api/v1/bookings/{id}
```

---

# 28. Media Processing Example

Customer uploads an image.

Initial transaction:

```text
MediaObject = UPLOADED
```

Then:

```text
MediaUploaded
    ↓
Background worker
    ↓
Validate/process
    ↓
Generate thumbnail
    ↓
Media = AVAILABLE
```

Heavy image processing does not block the HTTP request.

---

# 29. Matching Example

Service request is submitted.

The synchronous transaction can establish:

```text
ServiceRequest = MATCHING
```

Then:

```text
ServiceRequestSubmitted
        ↓
Matching worker
        ↓
Candidate discovery
        ↓
WorkerMatch records
        ↓
MatchCreated events
        ↓
Notifications
```

This allows matching to scale independently from HTTP traffic.

---

# 30. Should Matching Be Async?

Not necessarily for every scenario.

For an early MVP, simple matching could happen synchronously:

```text
Submit request
    ↓
find candidates
    ↓
return matches
```

If matching becomes expensive:

```text
Submit request
    ↓
MATCHING
    ↓
async matching worker
```

The architecture should support both.

---

# 31. Background Worker Responsibilities

Workers should execute bounded tasks.

Examples:

```text
NotificationWorker
OutboxWorker
MediaProcessingWorker
MatchingWorker
CleanupWorker
ReconciliationWorker
```

Do not create a single:

```text
EverythingWorker
```

that contains unrelated business logic.

---

# 32. Worker Design

A worker should generally:

```text
1. Read task/event
2. Validate it
3. Claim/process it
4. Perform required action
5. Record result
6. Retry when appropriate
7. Move permanently failing work to dead-letter handling
```

---

# 33. Retry Strategy

Not every failure should be retried.

### Retryable

```text
network timeout
temporary provider outage
connection reset
HTTP 429
HTTP 5xx
temporary database connectivity issue
```

### Usually non-retryable

```text
invalid payload
invalid credentials
unsupported file type
authorization failure
permanently rejected payment
malformed provider event
```

Classification should be explicit.

---

# 34. Exponential Backoff

Example:

```text
Attempt 1 → immediate
Attempt 2 → short delay
Attempt 3 → longer delay
Attempt 4 → longer delay
...
```

Conceptually:

```text
delay = base × 2^attempt
```

with jitter.

This prevents thousands of failed tasks from retrying simultaneously.

---

# 35. Maximum Retry Count

A worker should not retry forever.

Example policy:

```text
MAX_ATTEMPTS = configurable
```

After exhaustion:

```text
FAILED
    ↓
dead-letter / manual review
```

The exact number should be configuration, not hardcoded business logic.

---

# 36. Dead-Letter Handling

Some tasks will never succeed automatically.

Example:

```text
Notification
   ↓
5 failed attempts
   ↓
DEAD_LETTER
```

Admin/operations should be able to inspect:

* event ID;
* task type;
* attempts;
* last error;
* timestamps;
* associated business entity.

Manual retry may be supported.

---

# 37. Poison Messages

A poison message is a task that repeatedly fails because the message itself is invalid.

Example:

```text
Malformed event
```

Retrying it forever causes:

```text
CPU waste
queue blockage
log noise
```

Therefore:

```text
retry limit
+
dead-letter handling
```

is mandatory for durable async processing.

---

# 38. Job Claiming

Multiple application instances may attempt to process the same task.

Example:

```text
Worker A → event 123
Worker B → event 123
```

Use an atomic claiming mechanism.

Possible approaches:

```text
SELECT ... FOR UPDATE SKIP LOCKED
```

or equivalent queue semantics.

The implementation will be finalized during LLD.

---

# 39. Processing State

An outbox event can have:

```text
PENDING
PROCESSING
PUBLISHED
FAILED
```

A worker claiming:

```text
PENDING
```

should atomically move it to:

```text
PROCESSING
```

with ownership/lease information if needed.

---

# 40. Worker Crash

Suppose:

```text
Worker A
claims event
```

Then crashes.

Without recovery:

```text
event stuck PROCESSING
```

Therefore processing leases/timeouts may be needed.

Example:

```text
claimedAt
leaseUntil
```

After lease expiration:

```text
PROCESSING
   ↓
eligible for retry
```

---

# 41. Async Work Must Be Idempotent

Suppose notification processing executes twice.

The customer should not receive:

```text
20 identical notifications
```

unless intentionally allowed.

Use deterministic idempotency keys.

For example:

```text
notification:{eventId}:{channel}
```

Then:

```text
UNIQUE
```

prevents accidental duplication.

---

# 42. Notification Deduplication

Example:

```text
BookingConfirmed
```

Could trigger:

```text
IN_APP
PUSH
SMS
```

Each channel is independent.

Therefore idempotency should operate at the correct granularity:

```text
eventId + recipient + channel
```

rather than simply:

```text
eventId
```

---

# 43. Async Processing and Transactions

Never hold a database transaction open while waiting for an external provider.

Bad:

```text
BEGIN
   update payment
   call payment provider
   wait 5 seconds
COMMIT
```

Better:

```text
short DB transaction
    ↓
state recorded
    ↓
commit
    ↓
external operation
    ↓
result recorded in another transaction
```

This reduces lock duration and improves throughput.

---

# 44. External Provider Calls

External calls include:

```text
payment provider
SMS provider
email provider
push provider
identity verification provider
object storage
maps provider
```

They should be isolated behind interfaces and handled with explicit retry/error policies.

---

# 45. Async Payment Processing

Payment requires special care.

Example:

```text
Create Payment
     ↓
Payment = INITIATED/PENDING
     ↓
Provider interaction
     ↓
Webhook
     ↓
Payment = SUCCESS
```

The webhook is itself an asynchronous external event.

It should be:

* verified;
* persisted;
* idempotently processed;
* auditable.

The payment document already defines the financial rules; this document defines the processing mechanism.

---

# 46. Event Ordering

Events may arrive out of order.

Example:

```text
JobCompleted
PaymentSucceeded
```

could be processed in a different order by different consumers.

Therefore consumers should not blindly assume global ordering.

Where necessary use:

```text
aggregate version
event sequence
business state validation
```

---

# 47. Aggregate Version

Example:

```text
Booking version = 7
```

Event:

```text
BookingConfirmed
version = 7
```

A consumer can detect:

```text
received version 6 after version 7
```

and decide whether it should ignore, reorder, or reconcile.

This is especially useful when realtime/event infrastructure becomes distributed.

---

# 48. Eventual Consistency

Async architecture naturally introduces eventual consistency.

Example:

```text
Job completed
```

Immediately:

```text
PostgreSQL = WORK_COMPLETED
```

But perhaps:

```text
notification = processing
analytics = pending
worker statistics = updating
```

These may catch up milliseconds or seconds later.

The system must distinguish:

```text
business transaction completed
```

from:

```text
all side effects completed
```

---

# 49. User Experience

The API response should communicate authoritative state.

Example:

```json
{
  "data": {
    "jobId": "01J...",
    "status": "WORK_COMPLETED"
  }
}
```

It should not wait for:

```text
push notification
analytics
email
WebSocket
```

to finish.

---

# 50. Async Events and WebSockets

The flow should be:

```text
Business transaction
      ↓
Commit
      ↓
Outbox
      ↓
Realtime event
      ↓
WebSocket
```

Never:

```text
WebSocket first
    ↓
DB transaction
```

because the client could see a state that was never committed.

---

# 51. Async Events and Notifications

Similarly:

```text
Commit
 ↓
Event
 ↓
Notification
```

not:

```text
Send notification
 ↓
Attempt DB transaction
```

The customer should never be notified of a business action that ultimately failed.

---

# 52. Scheduled Jobs

Some processes require scheduled execution.

Examples:

```text
expire stale service requests
expire match offers
cleanup temporary media
retry failed notifications
reconcile payments
detect stale worker presence
generate periodic reports
```

These should use durable scheduling/worker mechanisms rather than relying on a single application instance's in-memory scheduler once horizontal scaling begins.

---

# 53. Duplicate Scheduled Execution

With multiple application instances:

```text
App A scheduler → job
App B scheduler → same job
```

This is another distributed coordination problem.

Use:

* database claiming;
* distributed scheduler;
* queue;
* or distributed lock where appropriate.

Do not assume only one application instance exists.

---

# 54. Transactional Outbox vs Direct Queue Publish

Naive:

```text
DB transaction
    ↓
commit
    ↓
publish queue message
```

Crash between:

```text
commit
```

and:

```text
publish
```

can lose the message.

Outbox solves this:

```text
DB transaction
    ├── business state
    └── outbox record
          ↓
        commit
          ↓
      publisher
          ↓
       queue
```

---

# 55. When to Introduce Kafka

Do not introduce Kafka simply because the system has events.

Initially:

```text
PostgreSQL
+
Outbox
+
Background workers
```

may be enough.

Kafka becomes justified when there is a demonstrated need for:

* very high event throughput;
* multiple independent consumers;
* durable event streaming;
* replay;
* partitioned consumption;
* cross-service event backbone.

The exact threshold should be based on measured workload.

---

# 56. Async Architecture Evolution

### Stage 1 — MVP

```text
Spring Boot
   ↓
Spring Application Events
   ↓
Background processing
```

### Stage 2 — Production

```text
PostgreSQL
   ↓
Transactional Outbox
   ↓
DB-backed workers
```

### Stage 3 — Higher scale

```text
PostgreSQL
   ↓
Outbox Publisher
   ↓
Message Broker
   ↓
Consumers
```

### Stage 4 — Selective service extraction

```text
Booking Service
Payment Service
Notification Service
Matching Service
      ↓
Event Backbone
```

Only evolve when justified.

---

# 57. Async Module Structure

A possible production structure:

```text
async/
├── api/
├── application/
│   ├── command/
│   ├── query/
│   ├── service/
│   └── port/
│       ├── in/
│       └── out/
├── domain/
│   ├── model/
│   ├── event/
│   ├── valueobject/
│   └── exception/
└── infrastructure/
    ├── persistence/
    │   └── outbox/
    ├── worker/
    ├── scheduler/
    └── messaging/
```

However, event ownership should remain with the business module.

The async infrastructure should not become a dumping ground for business logic.

---

# 58. Better Module Responsibility

For example:

```text
booking/
    BookingConfirmed event

notification/
    handles BookingConfirmed

realtime/
    handles BookingConfirmed

analytics/
    handles BookingConfirmed
```

Not:

```text
async/
    Booking logic
    Notification logic
    Payment logic
    Matching logic
```

The async layer coordinates processing; business modules own their business behavior.

---

# 59. Observability

Every asynchronous operation should be traceable.

Useful fields:

```text
eventId
correlationId
causationId
aggregateId
eventType
attempt
workerId
startedAt
completedAt
error
```

This allows debugging:

```text
Customer request
    ↓
Booking
    ↓
Event
    ↓
Notification
    ↓
Provider
```

as one traceable chain.

---

# 60. Correlation ID

Suppose customer sends:

```text
POST /bookings
```

Request ID:

```text
req-123
```

The resulting event can carry:

```text
correlationId = req-123
```

Then background processing logs can retain it.

This makes production debugging significantly easier.

---

# 61. Metrics

Track:

```text
events_created_total
events_processed_total
events_failed_total
events_retried_total
events_dead_lettered_total
event_processing_latency
queue_depth
oldest_pending_event_age
worker_processing_latency
```

For notifications:

```text
notification_success_rate
provider_failure_rate
delivery_latency
```

For matching:

```text
matching_latency
matching_failures
candidate_count
```

---

# 62. Alerting

Potential alerts:

```text
outbox backlog growing
oldest event exceeds threshold
dead-letter count increasing
worker failures increasing
notification queue stuck
provider errors increasing
retry storm
```

Alerts should indicate operational impact.

---

# 63. Async Security

Events may contain sensitive information.

Therefore:

* minimize event payloads;
* do not put secrets into events;
* do not put payment credentials into events;
* do not expose identity documents;
* restrict event access;
* protect queue/database credentials;
* audit administrative event replay.

---

# 64. Event Replay

Replay can be useful for rebuilding derived data.

Example:

```text
ReviewCreated
JobCompleted
PaymentSucceeded
```

could theoretically rebuild an analytics projection.

But replay must be designed carefully.

Do not blindly replay financial or externally visible side effects.

For example:

```text
Replay PaymentSucceeded
```

must **not** accidentally send money or create a second payout.

Consumers should distinguish:

```text
rebuild projection
```

from:

```text
execute side effect
```

---

# 65. Event Retention

Outbox records should not necessarily remain forever in the primary table.

Potential lifecycle:

```text
PENDING
 ↓
PROCESSED
 ↓
retention period
 ↓
archive/delete
```

Financial/audit records follow separate retention requirements.

The outbox is an infrastructure mechanism, not the financial ledger.

---

# 66. Cleanup

Background cleanup can remove:

```text
old processed outbox events
expired temporary records
orphaned media metadata
expired upload intents
old rate-limit artifacts
```

Cleanup must be:

* idempotent;
* bounded;
* observable;
* safe to run repeatedly.

---

# 67. Async Failure Philosophy

The system should distinguish:

### Business failure

```text
Booking cannot be confirmed
```

This affects the API transaction.

### Side-effect failure

```text
Push notification failed
```

This should normally not undo the booking.

### Infrastructure failure

```text
Redis unavailable
```

Use fallback behavior according to feature criticality.

### External ambiguity

```text
Payment provider timeout
```

Do not automatically assume success or failure.

---

# 68. Example End-to-End Flow

Customer requests an electrician.

```text
1. Customer submits request
        ↓
2. ServiceRequest transaction
        ↓
3. ServiceRequest = SUBMITTED
        ↓
4. Outbox: ServiceRequestSubmitted
        ↓
5. Commit
        ↓
6. Matching worker receives event
        ↓
7. Candidate workers discovered
        ↓
8. WorkerMatch records created
        ↓
9. MatchCreated events
        ↓
10. Notification worker
        ↓
11. Worker receives offer
        ↓
12. Worker accepts
        ↓
13. Booking transaction
        ↓
14. Booking = CONFIRMED
        ↓
15. Outbox: BookingConfirmed
        ↓
16. Realtime + notifications
        ↓
17. Job execution
        ↓
18. JobCompleted
        ↓
19. Payment processing
        ↓
20. PaymentSucceeded
        ↓
21. Earnings update
        ↓
22. Review eligibility
```

The key point is that every critical state transition is persisted before asynchronous side effects execute.

---

# 69. MVP Recommendation

For the first production version:

```text
Synchronous
├── core business transactions
├── booking
├── job state changes
├── payment state transitions
└── review/dispute operations

Asynchronous
├── notifications
├── push/SMS
├── realtime events
├── media processing
├── analytics events
└── cleanup
```

Initially:

```text
Spring Application Events
```

can be used where reliability requirements are low.

For important asynchronous workflows:

```text
Transactional Outbox
```

should become the durable foundation.

---

# 70. Production Evolution Plan

### Phase 1

```text
Spring Boot
PostgreSQL
Spring Events
Redis
```

### Phase 2

```text
PostgreSQL
Transactional Outbox
Background Workers
Redis
```

### Phase 3

```text
PostgreSQL
Outbox
Message Broker
Multiple Consumers
```

### Phase 4

```text
Selective service extraction
+
shared event backbone
```

This prevents premature distributed-system complexity.

---

# 71. What We Should Avoid

Do not initially build:

* Kafka for every event;
* event sourcing;
* CQRS everywhere;
* dozens of queues;
* one queue per module without need;
* distributed transactions;
* exactly-once processing assumptions;
* synchronous external provider calls inside long DB transactions;
* unlimited retries;
* infinite event retention;
* giant event payloads;
* business logic inside generic workers;
* Redis-only durable queues for critical workflows;
* microservices merely because asynchronous events exist.

---

# 72. Core Invariants

The architecture must enforce:

1. Critical business state is committed before asynchronous side effects.
2. Business state and transactional outbox records are created in the same transaction.
3. Events represent facts, not commands.
4. Event ownership belongs to the module that owns the underlying business state.
5. Consumers must be idempotent.
6. At-least-once delivery is the default assumption.
7. Events must have unique IDs.
8. Event payloads must be intentionally designed and minimized.
9. Event versions must be explicit.
10. External calls must not hold long-running database transactions.
11. Retryable and non-retryable failures must be distinguished.
12. Retries require bounded attempts and backoff.
13. Permanently failing work requires dead-letter handling.
14. Worker crashes must not permanently lose claimed tasks.
15. Scheduled jobs must remain safe with multiple application instances.
16. Event ordering must not be blindly assumed.
17. Financial side effects must be idempotent.
18. Replaying events must not accidentally repeat irreversible side effects.
19. Async failure must not normally roll back successful core business transactions.
20. Every important async workflow must be observable.
21. Sensitive information must not unnecessarily appear in event payloads.
22. Background workers must remain focused on processing, not become a second business layer.
23. PostgreSQL remains the durable source of truth for transactional state.
24. Message brokers are introduced only when workload and operational requirements justify them.

---

# 73. Final Architecture

The intended architecture is:

```text
                     ┌─────────────────────┐
                     │      REST API       │
                     └──────────┬──────────┘
                                │
                                ↓
                     ┌─────────────────────┐
                     │ Application Service │
                     └──────────┬──────────┘
                                │
                         DB Transaction
                         ┌──────┴──────┐
                         ↓             ↓
                 Business State     Outbox
                         │             │
                         └──────┬──────┘
                                ↓
                              COMMIT
                                │
                                ↓
                        Background Worker
                                │
                 ┌──────────────┼──────────────┐
                 ↓              ↓              ↓
           Notification      Realtime      Analytics
                 │              │              │
                 ↓              ↓              ↓
             Providers       WebSocket      Read Models
```

The most important architectural rule is:

> **Commit the business fact first. Process its consequences asynchronously.**

This gives the platform:

* fast APIs;
* resilient external integrations;
* retryable side effects;
* horizontal worker scaling;
* clear module boundaries;
* better failure isolation;
* eventual migration to a message broker when needed;

without prematurely turning the modular monolith into a distributed system.

# End of Document
