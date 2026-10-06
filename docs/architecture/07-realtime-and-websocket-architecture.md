# Realtime & WebSocket Architecture

> Implemented by [LLD-021](../lld/lld-021-realtime-updates.md) (per-user queue only, no resource topics, no status in envelope).

## 1. Purpose

The marketplace contains several workflows where users benefit from immediate updates.

Examples:

* worker receives a new job opportunity;
* customer sees that a worker accepted;
* worker status changes to en route;
* customer sees arrival;
* additional work is proposed;
* customer approves additional work;
* payment status changes;
* dispute status changes;
* notifications appear without refreshing;
* worker availability changes.

Polling every few seconds can work at very small scale, but it becomes inefficient as concurrent users increase.

The platform therefore needs a **realtime communication architecture**.

The primary technology considered for the initial implementation is:

> **WebSocket communication through Spring Boot.**

However, WebSocket should be treated as a **delivery mechanism**, not as the authoritative source of business state.

---

# 2. Core Principle

The most important rule is:

```text
WebSocket ≠ Source of Truth
```

The source of truth remains:

```text
PostgreSQL
+
Domain State
+
Transactional Business Operations
```

WebSocket only tells clients:

> “Something changed. You may want to update your view.”

For example:

```text
Booking
CONFIRMED
```

is authoritative database state.

WebSocket:

```text
BOOKING_CONFIRMED
```

is merely a notification that the client should receive the update.

---

# 3. Why This Distinction Matters

Imagine:

```text
Server
   ↓
Booking confirmed
   ↓
Database committed
   ↓
WebSocket send
   ↓
Network failure
```

The customer may not receive the WebSocket event.

That does **not** mean the booking failed.

The client can later call:

```text
GET /api/v1/bookings/{id}
```

and retrieve:

```text
status = CONFIRMED
```

Therefore:

> **Realtime delivery may fail; business state must remain correct.**

---

# 4. Realtime Use Cases

## 4.1 Customer

Potential realtime events:

```text
MATCH_FOUND
WORKER_ACCEPTED
BOOKING_CONFIRMED
WORKER_EN_ROUTE
WORKER_ARRIVED
JOB_STARTED
ADDITIONAL_WORK_PROPOSED
PAYMENT_UPDATED
JOB_COMPLETED
DISPUTE_UPDATED
```

---

## 4.2 Worker

Potential events:

```text
NEW_JOB_MATCH
MATCH_EXPIRED
BOOKING_CONFIRMED
CUSTOMER_CANCELLED
CUSTOMER_ARRIVED
ADDITIONAL_WORK_APPROVED
PAYMENT_UPDATED
DISPUTE_UPDATED
```

---

## 4.3 Admin

Potential events:

```text
NEW_DISPUTE
VERIFICATION_SUBMITTED
PAYMENT_EXCEPTION
FRAUD_SIGNAL
SYSTEM_ALERT
```

Admin realtime functionality should remain limited initially.

---

# 5. WebSocket vs Push Notification

These are different systems.

### WebSocket

Best for:

> User currently has the application open and connected.

### Push notification

Best for:

> User is not actively connected to the realtime session.

Example:

```text
Booking confirmed
       ↓
WebSocket → active app
Push      → background app
In-app    → notification history
```

The same business event may therefore produce multiple delivery mechanisms.

---

# 6. WebSocket vs Notification

A WebSocket event might be:

```json
{
  "type": "JOB_STATUS_CHANGED",
  "jobId": "01J..."
}
```

An in-app notification might be:

```json
{
  "type": "JOB_UPDATE",
  "title": "Your worker has arrived",
  "body": "The worker has marked the job as arrived."
}
```

They serve different purposes.

WebSocket:

> synchronize UI state.

Notification:

> communicate an event to the user.

---

# 7. Initial Architecture

For the modular monolith:

```text
                         ┌─────────────────┐
                         │   Spring Boot   │
                         └────────┬────────┘
                                  │
                       WebSocket Gateway
                                  │
                         ┌────────┴────────┐
                         │ Connected Users │
                         └─────────────────┘
```

Initially:

* one application;
* one WebSocket layer;
* PostgreSQL source of truth;
* Redis available for distributed coordination when multiple instances are introduced.

Do not immediately introduce a dedicated realtime microservice.

---

# 8. Connection Lifecycle

Conceptually:

```text
Client
  ↓
Connect WebSocket
  ↓
Authenticate
  ↓
Authorize subscriptions
  ↓
Connection established
  ↓
Receive events
  ↓
Reconnect if disconnected
  ↓
Resynchronize state
```

Authentication should occur during the WebSocket handshake or through an appropriate authenticated protocol flow.

---

# 9. Authentication

A WebSocket connection must not be anonymous by default.

The server needs to establish:

```text
userId
roles
session
permissions
```

before allowing private subscriptions.

For example:

```text
Customer A
   ↓
connects
   ↓
authenticated as User A
```

The server must never trust:

```text
client says:
userId = worker-123
```

The authenticated identity comes from server-validated credentials.

---

# 10. Authorization

Authentication answers:

> Who are you?

Authorization answers:

> What realtime data are you allowed to receive?

Example:

```text
Customer A
    ↓
can subscribe to
    ↓
their own booking

Customer A
    ✗
cannot subscribe to
Worker B's private events
```

Similarly:

```text
Worker A
    ✗
cannot subscribe to every worker's job feed.
```

---

# 11. Subscription Model

The client should subscribe only to resources it is authorized to observe.

Possible conceptual destinations:

```text
user:{userId}
booking:{bookingId}
job:{jobId}
service-request:{requestId}
```

For example:

```text
user:01JABC
booking:01JXYZ
```

The server must validate subscription ownership.

---

# 12. Avoid Arbitrary Topic Subscription

Do not allow:

```text
SUBSCRIBE *
```

or:

```text
SUBSCRIBE worker:*
```

unless the server explicitly authorizes that scope.

Otherwise WebSocket becomes a data-exfiltration mechanism.

---

# 13. Event Envelope

Realtime events should use a consistent envelope.

Example:

```json
{
  "eventId": "01J...",
  "type": "BOOKING_CONFIRMED",
  "version": 1,
  "occurredAt": "2026-09-30T10:30:00Z",
  "entityType": "BOOKING",
  "entityId": "01J...",
  "payload": {
    "status": "CONFIRMED"
  }
}
```

Important fields:

```text
eventId
type
version
occurredAt
entityType
entityId
payload
```

---

# 14. Why Event IDs Matter

Suppose:

```text
BOOKING_CONFIRMED
```

is delivered twice.

The client can use:

```text
eventId
```

to detect duplicates if necessary.

Realtime systems should generally assume:

> **At-least-once delivery is possible.**

Do not build the architecture assuming perfect exactly-once delivery.

---

# 15. Event Ordering

Network conditions can produce:

```text
JOB_STARTED
JOB_ARRIVED
```

arriving in the wrong order.

The client should therefore not blindly trust event arrival order.

Possible solution:

```text
entityVersion
```

Example:

```json
{
  "type": "JOB_STATUS_CHANGED",
  "jobId": "01J...",
  "version": 7,
  "status": "WORK_STARTED"
}
```

A later event could have:

```text
version = 8
```

Clients can ignore stale events.

---

# 16. State Synchronization

A robust client strategy is:

```text
Realtime event
    ↓
Identify affected resource
    ↓
Fetch authoritative state
    ↓
Update UI
```

For example:

```text
WebSocket:
JOB_STATUS_CHANGED

        ↓

GET /jobs/{id}

        ↓

Database:
WORK_STARTED
```

For lightweight state changes, the event payload can contain enough information to update the UI directly.

But the architecture must always support resynchronization.

---

# 17. Reconnection

Mobile networks are unreliable.

Users can experience:

* Wi-Fi → mobile network;
* temporary signal loss;
* backgrounding;
* app restart;
* laptop sleep;
* network switching.

Therefore:

```text
Disconnected
   ↓
Retry connection
   ↓
Authenticate
   ↓
Resubscribe
   ↓
Synchronize missed state
```

The client should not assume it received every event during disconnection.

---

# 18. Missed Events

There are two broad approaches.

### Approach A — Refetch current state

Simple MVP approach:

```text
Reconnect
   ↓
GET active bookings/jobs
```

### Approach B — Event replay

Future architecture:

```text
lastEventId
      ↓
server
      ↓
replay missed events
```

MVP should prefer state refetch unless event replay is genuinely needed.

---

# 19. Why Not Build Event Replay Immediately?

Event replay requires:

* durable event storage;
* sequence management;
* retention;
* replay semantics;
* ordering;
* client checkpointing;
* operational complexity.

For the first version:

```text
Reconnect
   ↓
Fetch authoritative state
```

is significantly simpler and more reliable.

---

# 20. Business Event → Realtime Event

Domain event:

```text
BookingConfirmed
```

may result in:

```text
Realtime:
BOOKING_CONFIRMED
```

and:

```text
Notification:
"Your booking has been confirmed."
```

The domain event is the business event.

Realtime and notification are delivery mechanisms.

---

# 21. Transaction Boundary

Consider:

```text
Booking transaction
    ↓
UPDATE booking
    ↓
COMMIT
```

Only after successful commit should downstream delivery occur.

Bad architecture:

```text
Send WebSocket
   ↓
Database transaction fails
```

The user could see:

```text
Booking confirmed
```

when the database actually rolled back.

Therefore:

> **Realtime notifications must not be emitted as if the business transaction succeeded before the transaction commits.**

---

# 22. Transactional Outbox

As the platform grows, use the transactional outbox pattern.

Flow:

```text
Database Transaction
      │
      ├── Update Booking
      │
      └── Insert Outbox Event
               ↓
             COMMIT
               ↓
        Background Publisher
               ↓
        Realtime Delivery
```

This ensures the business state and event record are committed together.

Transactional outbox was already introduced in the notification and payment architecture and will be expanded in [architecture/09](09-async-processing-domain-events-and-outbox.md).

---

# 23. MVP Event Delivery

Initially, if the system is a single application instance, a simple mechanism may be enough:

```text
Domain Event
   ↓
Spring Application Event
   ↓
Realtime Publisher
   ↓
WebSocket
```

But this should not be treated as durable event delivery.

If delivery fails:

```text
business state remains correct
```

and the client can resynchronize.

---

# 24. Multiple Application Instances

When the application scales horizontally:

```text
                 Load Balancer
                      │
          ┌───────────┼───────────┐
          ↓           ↓           ↓
       App A       App B       App C
          │           │           │
          └─────── WebSocket ─────┘
```

A user's WebSocket connection may exist on App A while the business transaction occurs on App B.

Example:

```text
Customer connection → App A

Worker accepts job → App B
```

App A still needs to receive:

```text
BOOKING_CONFIRMED
```

This is where Redis pub/sub or another broker becomes useful.

---

# 25. Redis Pub/Sub

A future flow:

```text
App B
  ↓
Redis Pub/Sub
  ↓
App A
  ↓
Customer WebSocket
```

Redis becomes a **delivery coordination layer**, not the source of truth.

If Redis loses an event:

```text
Redis event lost
```

the database state remains correct.

The client can resynchronize.

---

# 26. Redis Streams / Durable Messaging

If the platform later requires:

* durable event delivery;
* replay;
* stronger event guarantees;
* high event volume;

then a durable messaging system may be considered.

Possibilities include:

```text
Kafka
Redis Streams
another durable message broker
```

The choice should depend on demonstrated requirements.

Do not introduce Kafka solely because the architecture contains WebSockets.

---

# 27. Connection Scaling

WebSocket connections are long-lived.

If:

```text
100,000 concurrent users
```

the system may have:

```text
many thousands of open TCP connections
```

This requires consideration of:

* connection limits;
* memory;
* file descriptors;
* network capacity;
* load balancing;
* heartbeat traffic.

The application should be horizontally scalable.

---

# 28. Sticky Sessions

Sticky sessions can simplify some WebSocket deployments, but they should not be a hard dependency.

Preferred architecture:

```text
Any instance
    ↓
WebSocket connection
    ↓
shared coordination
```

This allows instances to be added/removed more easily.

If a load balancer requires connection affinity for operational reasons, that can be configured, but application correctness should not depend on a specific instance.

---

# 29. Heartbeats

Long-lived connections need health detection.

Conceptually:

```text
Client → ping
Server → pong
```

or protocol-level heartbeat support.

Heartbeats help detect:

* dead connections;
* network failures;
* stale sessions.

They should not be excessively frequent because thousands of connections multiply heartbeat traffic.

---

# 30. Connection Registry

A realtime layer may maintain ephemeral state:

```text
userId
connectionId
instanceId
lastSeen
```

Redis can be used for this when multiple instances exist.

Example:

```text
user:{userId}:connections
```

This is not business state.

Losing the registry should not corrupt:

* bookings;
* jobs;
* payments;
* worker availability history.

---

# 31. Presence

Presence means:

> Is this user currently connected?

Examples:

```text
Worker online
Customer connected
Admin active
```

Presence is inherently ephemeral.

It should therefore be stored in:

```text
memory / Redis
```

rather than PostgreSQL as the source of truth.

---

# 32. Presence vs Availability

These must remain separate.

```text
WebSocket connected
        ≠
Accepting jobs
```

A worker can be:

```text
connected = true
acceptingJobs = false
```

or:

```text
connected = false
acceptingJobs = true
```

depending on the product design.

Availability remains a business concept.

Presence is a technical/runtime signal.

---

# 33. Worker Live Location

If the product later tracks worker location during an active job:

```text
Worker GPS
   ↓
Location subsystem
   ↓
Realtime map updates
```

Do not send every GPS coordinate through the core Job aggregate.

Location telemetry should be a separate subsystem.

[modules/04](../modules/04-worker-availability-scheduling-and-capacity.md) already established this separation.

---

# 34. Location Update Frequency

Sending GPS updates every second can become expensive.

A future policy may use:

```text
distance threshold
+
time interval
+
job state
+
battery/network considerations
```

For example, higher frequency while:

```text
EN_ROUTE
```

and lower/no frequency when:

```text
WORK_COMPLETED
```

Exact values are a product/infrastructure decision.

---

# 35. Security

WebSocket security must include:

* authentication;
* authorization;
* origin validation where applicable;
* rate limiting;
* message-size limits;
* subscription validation;
* connection limits;
* idle timeout where appropriate;
* abuse detection.

Do not allow clients to send arbitrary business commands over WebSocket unless there is a deliberate reason.

---

# 36. Commands vs Events

A useful boundary:

### REST/API

Primarily handles commands:

```text
accept match
confirm booking
cancel job
complete job
approve additional work
```

### WebSocket

Primarily handles events:

```text
booking confirmed
worker arrived
payment updated
new job available
```

This keeps business mutation semantics explicit.

---

# 37. Avoid Business Logic in WebSocket Handlers

Bad:

```text
WebSocket message
   ↓
change booking status
   ↓
process payment
   ↓
send notification
```

Better:

```text
REST command
   ↓
Application service
   ↓
Domain operation
   ↓
Database
   ↓
Domain event
   ↓
WebSocket delivery
```

WebSocket becomes a transport mechanism rather than a second application API.

---

# 38. WebSocket Message Types

A clean taxonomy:

```text
SYSTEM
  CONNECTED
  ERROR
  HEARTBEAT

DOMAIN
  SERVICE_REQUEST_UPDATED
  MATCH_CREATED
  BOOKING_UPDATED
  JOB_UPDATED
  PAYMENT_UPDATED

NOTIFICATION
  NOTIFICATION_CREATED

PRESENCE
  USER_ONLINE
  USER_OFFLINE

LOCATION
  WORKER_LOCATION_UPDATED
```

Not every category needs to be implemented in MVP.

---

# 39. Event Versioning

Events can evolve.

Initial:

```json
{
  "type": "JOB_UPDATED",
  "version": 1
}
```

Future:

```json
{
  "type": "JOB_UPDATED",
  "version": 2,
  "payload": {
    "status": "ARRIVED",
    "estimatedArrival": "..."
  }
}
```

Clients should be able to handle supported versions gracefully.

Avoid changing event meaning without versioning.

---

# 40. Event Payload Size

Realtime events should remain small.

Prefer:

```json
{
  "type": "BOOKING_UPDATED",
  "bookingId": "01J...",
  "status": "CONFIRMED"
}
```

over:

```json
{
  "type": "BOOKING_UPDATED",
  "booking": {
    "...": "entire booking graph..."
  }
}
```

Large payloads:

* consume bandwidth;
* increase memory;
* increase serialization cost;
* increase coupling.

The client can fetch additional details when required.

---

# 41. Backpressure

A connected client may not consume messages quickly enough.

The server needs safeguards against unbounded buffering.

Possible policies:

```text
slow client
   ↓
bounded queue
   ↓
drop non-critical transient events
   ↓
force resynchronization if needed
```

For example, missing:

```text
WORKER_LOCATION_UPDATED
```

may be acceptable.

Missing:

```text
PAYMENT_UPDATED
```

should trigger resynchronization.

---

# 42. Event Priority

Realtime events can have priorities.

### Critical

```text
PAYMENT_UPDATED
BOOKING_CONFIRMED
DISPUTE_UPDATED
```

### Normal

```text
JOB_UPDATED
MATCH_UPDATED
```

### Ephemeral

```text
PRESENCE_UPDATED
LOCATION_UPDATED
TYPING
```

This helps when bandwidth or processing becomes constrained.

---

# 43. Realtime Failure Strategy

Suppose WebSocket infrastructure is unavailable.

The marketplace should still support:

```text
REST APIs
+
push notifications
+
in-app notification history
```

The user might need to refresh, but the transaction should continue working.

This creates graceful degradation.

---

# 44. Example: Worker Accepts a Job

Complete flow:

```text
Worker
   ↓
POST /matches/{id}/accept
   ↓
Application Service
   ↓
Validate match
   ↓
Transaction
   ↓
Booking confirmed
   ↓
Job created
   ↓
Domain events
   ↓
COMMIT
   ↓
Outbox/event delivery
   ↓
WebSocket
   ↓
Customer UI updates
```

Customer can then call:

```text
GET /bookings/{id}
```

if the realtime event was missed.

---

# 45. Example: Worker Arrives

```text
Worker
   ↓
POST /jobs/{id}/arrive
   ↓
Job transition
   ↓
Database commit
   ↓
JobArrived event
   ↓
Realtime event
   ↓
Customer sees:
"Worker has arrived"
```

The WebSocket does not itself change:

```text
JOB.status
```

---

# 46. Example: Additional Work

```text
Worker
   ↓
POST /jobs/{id}/additional-work
   ↓
AdditionalWork = PROPOSED
   ↓
Database commit
   ↓
AdditionalWorkProposed
   ↓
Customer receives:
"Additional work requires approval"
```

Customer then uses the normal command:

```text
POST /additional-work/{id}/approve
```

The WebSocket only communicates the result.

---

# 47. Example: Payment

```text
Payment Provider
       ↓
Webhook
       ↓
Payment module
       ↓
Payment SUCCESS
       ↓
Database commit
       ↓
PaymentSucceeded
       ↓
Realtime
       +
Notification
```

The browser/client's payment response must never be treated as authoritative.

[modules/06](../modules/06-payments-refunds-settlement-and-ledger.md) remains the financial source of truth.

---

# 48. Realtime Observability

Track:

```text
active_connections
connections_opened_total
connections_closed_total
connection_failures
authentication_failures
subscription_denials
messages_sent
messages_failed
messages_dropped
reconnects
delivery_latency
```

For important events:

```text
event_created_at
event_published_at
event_delivered_at
```

This can help measure realtime delivery latency.

---

# 49. Operational Alerts

Potential alerts:

```text
WebSocket connection failures increase
Redis unavailable
event delivery latency increases
message queue backlog increases
authentication failures spike
connection count exceeds expected capacity
```

Realtime should be observable like any other production subsystem.

---

# 50. Testing Strategy

Realtime testing should include:

### Connection

* valid authentication;
* invalid authentication;
* expired token;
* reconnect.

### Authorization

* valid subscription;
* unauthorized subscription;
* cross-user access attempt.

### Delivery

* event delivered;
* duplicate event;
* delayed event;
* connection lost.

### Recovery

* disconnect;
* reconnect;
* missed event;
* state resynchronization.

### Scaling

* multiple application instances;
* Redis coordination;
* connection on instance A;
* business event generated on instance B.

---

# 51. MVP Architecture

Initial:

```text
Client
   ↓
WebSocket
   ↓
Spring Boot
   ↓
Application Events
   ↓
Connected Clients
```

With:

```text
PostgreSQL
    ↓
Source of truth
```

And:

```text
REST
+
In-app Notifications
+
Push/SMS where applicable
```

No Kafka.

No dedicated realtime microservice.

No event replay system.

No distributed event bus unless required.

---

# 52. Scale-Up Architecture

When multiple application instances are required:

```text
                       Load Balancer
                            │
              ┌─────────────┼─────────────┐
              ↓             ↓             ↓
            App A         App B         App C
              │             │             │
              └─────────────┼─────────────┘
                            ↓
                       Redis Pub/Sub
                            ↓
                   Connected Clients
```

PostgreSQL remains the authoritative transactional database.

---

# 53. Larger-Scale Architecture

Eventually:

```text
                    Domain Services
                          ↓
                    Event Backbone
                          ↓
              ┌───────────┴───────────┐
              ↓                       ↓
        Notification              Realtime
              ↓                       ↓
       Push/SMS/etc.              WebSocket
```

Potentially:

```text
Location Service
      ↓
Realtime Location Stream
      ↓
Customer Map
```

This is a future evolution, not MVP architecture.

---

# 54. Module Structure

Within the modular monolith:

```text
realtime/
├── api/
│   └── WebSocketConfiguration
│
├── application/
│   ├── service/
│   │   ├── RealtimePublisher
│   │   ├── ConnectionService
│   │   └── SubscriptionService
│   │
│   └── port/
│       ├── in/
│       └── out/
│
├── domain/
│   ├── model/
│   │   ├── RealtimeEvent
│   │   ├── Connection
│   │   └── Subscription
│   └── valueobject/
│
└── infrastructure/
    ├── websocket/
    ├── redis/
    └── configuration/
```

Connection state is runtime/ephemeral and should not be treated like transactional business state.

---

# 55. Relationship With Other Modules

```text
Service Request
       ↓
Domain Event
       ↓
Realtime
       ↓
Customer

Booking
       ↓
Domain Event
       ↓
Realtime
       ↓
Customer + Worker

Job
       ↓
Domain Event
       ↓
Realtime
       ↓
Customer + Worker

Payment
       ↓
Domain Event
       ↓
Realtime
       ↓
Customer + Worker

Dispute
       ↓
Domain Event
       ↓
Realtime
       ↓
Relevant parties
```

Realtime should consume events.

It should not own these domain states.

---

# 56. What Realtime Should NOT Own

Realtime should not become responsible for:

* booking state;
* payment state;
* job state;
* worker availability;
* dispute state;
* user identity;
* financial balances.

Those remain owned by their respective modules.

---

# 57. Core Invariants

The system must enforce:

1. WebSocket is not the source of truth.
2. Business transactions do not depend on successful realtime delivery.
3. WebSocket clients must authenticate.
4. Subscriptions must be authorized.
5. Clients cannot subscribe to arbitrary users/resources.
6. Business commands remain explicit API/application operations.
7. Realtime primarily delivers events.
8. Event IDs should be unique.
9. Clients must tolerate duplicate/missed events.
10. Clients must be able to resynchronize authoritative state.
11. Event ordering must not be blindly assumed.
12. Presence is not worker availability.
13. Sensitive data must not be sent through unauthorized channels.
14. Event payloads should remain small.
15. Long-lived connections require rate and resource controls.
16. Multiple application instances require shared realtime coordination.
17. Redis is ephemeral coordination, not business truth.
18. Critical business state must remain recoverable through REST/database-backed APIs.
19. Realtime infrastructure should degrade gracefully.
20. Location telemetry must remain separate from core Job state.

---

# 58. Final Architecture Principle

The platform should never depend on:

> “The user received the WebSocket event.”

It should depend on:

> **“The business transaction committed successfully.”**

The realtime layer then makes the experience feel immediate:

```text
Business State
      ↓
Committed Transaction
      ↓
Domain Event
      ↓
Realtime Delivery
      ↓
Fast UI Update
```

If delivery succeeds:

> the user sees the change immediately.

If delivery fails:

> the user can reconnect or refresh and recover the authoritative state.

That separation gives the marketplace both **realtime user experience and transactional reliability**.

# End of Document
