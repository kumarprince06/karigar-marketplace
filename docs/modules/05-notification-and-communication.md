# Notification & Communication Architecture

**Project:** Karigar Marketplace
**Document Type:** System Architecture / High-Level Design
**Status:** Draft for Product & Engineering Review
**Scope:** Notifications, communication channels, delivery, preferences, reliability, scalability

---

## 1. Purpose

The platform needs to communicate important events to customers, workers, and administrators.

Examples:

* A service request has been submitted.
* Matching has started.
* A worker accepted an opportunity.
* A booking has been confirmed.
* A worker is travelling to the customer.
* A worker has arrived.
* Additional work requires approval.
* A job has been completed.
* Payment succeeded or failed.
* A booking was cancelled.
* A dispute requires action.

The notification system should therefore be treated as a **platform capability**, not something implemented independently inside every business module.

The core principle is:

> Business modules generate business events; the notification system decides how and where those events should be communicated.

---

# 2. Why Notifications Need Their Own Architecture

A naive implementation might do this:

```text
BookingService
    |
    +--> sendSMS()
    +--> sendEmail()
    +--> sendPushNotification()
    +--> sendWhatsApp()
```

This creates several problems.

### Problem 1 — Business logic becomes coupled to providers

The booking module now knows about:

* SMS provider
* push provider
* email provider
* WhatsApp provider

### Problem 2 — Provider failures can affect transactions

Imagine:

```text
Booking confirmed
      |
      +--> SMS provider
              |
              X FAILURE
```

The booking itself should not become failed simply because an SMS provider is unavailable.

### Problem 3 — Adding channels becomes expensive

Today:

```text
SMS
Push
Email
```

Tomorrow:

```text
WhatsApp
In-app
Voice
```

The booking module should not need to change every time a new communication channel is introduced.

### Problem 4 — Duplicate notifications

Retries can accidentally send:

```text
Booking confirmed
Booking confirmed
Booking confirmed
```

The architecture therefore needs:

* asynchronous delivery
* idempotency
* retries
* delivery tracking
* user preferences
* provider abstraction.

---

# 3. Communication Channels

The platform can eventually support:

| Channel                      | Primary Purpose                           |
| ---------------------------- | ----------------------------------------- |
| In-app                       | General updates                           |
| Push                         | Real-time mobile notifications            |
| SMS                          | Critical fallback                         |
| WhatsApp                     | User communication where appropriate      |
| Email                        | Receipts, summaries, formal communication |
| WebSocket                    | Live application updates                  |
| Internal notification center | Persistent notification history           |

These channels should not all be treated equally.

For example:

```text
Job completed
    |
    +--> In-app
    +--> Push
    +--> Email/receipt
```

Whereas:

```text
OTP
    |
    +--> SMS
```

OTP is fundamentally different from a normal notification.

---

# 4. Notification Categories

Notifications should be categorized according to business importance.

## 4.1 Authentication

Examples:

```text
OTP requested
OTP delivered
Login security event
```

OTP should have its own security-oriented implementation.

It should not depend on the normal notification pipeline.

---

## 4.2 Service Request

Examples:

```text
SERVICE_REQUEST_SUBMITTED
MATCHING_STARTED
MATCH_FOUND
MATCHING_FAILED
SERVICE_REQUEST_CANCELLED
```

---

## 4.3 Booking

Examples:

```text
BOOKING_CONFIRMED
BOOKING_CANCELLED
BOOKING_RESCHEDULED
```

---

## 4.4 Job Execution

Examples:

```text
WORKER_EN_ROUTE
WORKER_ARRIVED
JOB_STARTED
JOB_COMPLETED
WORKER_NO_SHOW
CUSTOMER_NO_SHOW
```

These events are often time-sensitive.

---

## 4.5 Additional Work

Examples:

```text
ADDITIONAL_WORK_PROPOSED
ADDITIONAL_WORK_APPROVED
ADDITIONAL_WORK_REJECTED
```

---

## 4.6 Payment

Examples:

```text
PAYMENT_INITIATED
PAYMENT_SUCCESS
PAYMENT_FAILED
REFUND_INITIATED
REFUND_COMPLETED
```

Financial notifications should be generated from the payment domain rather than directly from the UI.

---

## 4.7 Review

Examples:

```text
REVIEW_REQUESTED
REVIEW_RECEIVED
```

---

## 4.8 Dispute

Examples:

```text
DISPUTE_OPENED
DISPUTE_EVIDENCE_REQUIRED
DISPUTE_RESOLVED
```

---

# 5. Notification vs Communication

These concepts should be separated.

## Notification

A system-generated event informing a user about something.

Example:

```text
Your electrician is on the way.
```

## Communication

An actual conversation between participants.

Example:

```text
Customer → Worker

"Are you reaching in 10 minutes?"
```

This distinction becomes important later.

The notification system should **not automatically become a chat system**.

A future communication module can handle:

```text
Customer
    |
    v
Conversation
    |
    +--> Messages
    +--> Attachments
    +--> Read status
```

Notification remains responsible for:

```text
"Worker has arrived"
```

---

# 6. Core Architecture

The high-level architecture should be:

```text
                 BUSINESS MODULES
                        |
                        v
               Domain / Application Event
                        |
                        v
              Notification Application
                        |
              +---------+---------+
              |         |         |
              v         v         v
            Push       SMS      Email
              |         |         |
              v         v         v
           Provider   Provider  Provider
```

The business transaction should not synchronously call the providers.

Instead:

```text
Business Transaction
       |
       v
Persist business state
       |
       v
Publish event
       |
       v
Notification processing
       |
       +--> Push
       +--> SMS
       +--> Email
```

---

# 7. Event-Driven Notification Flow

Consider:

> Worker accepts a service request.

Flow:

```text
Worker
   |
   v
Accept Match
   |
   v
Matching Module
   |
   v
WorkerMatchAccepted
   |
   v
Notification Module
   |
   v
Customer notification
```

The matching module does not need to know whether the customer receives:

* push
* SMS
* email
* in-app notification.

It only knows:

```text
WorkerMatchAccepted
```

---

# 8. Domain Event Example

Conceptually:

```text
WorkerMatchAccepted
{
    matchId
    serviceRequestId
    workerId
    customerId
    occurredAt
}
```

The notification module consumes the event and resolves:

```text
recipient
template
channel
priority
```

For example:

```text
Recipient:
Customer #123

Template:
WORKER_MATCH_ACCEPTED

Channels:
PUSH
IN_APP
```

---

# 9. Notification Entity

The system should maintain a notification record.

Conceptually:

```text
Notification
-------------------------
id
recipientUserId
type
title
body
channel
priority
status
referenceType
referenceId
createdAt
sentAt
deliveredAt
failedAt
```

Possible status:

```text
CREATED
QUEUED
PROCESSING
SENT
DELIVERED
FAILED
CANCELLED
```

The exact state model can evolve during LLD.

---

# 10. Notification History

Notifications should generally be persisted.

Why?

Because users may want to see:

```text
Notifications
------------------------------
Worker accepted your request
2 minutes ago

Payment completed
1 hour ago

Job completed
Yesterday
```

Therefore:

```text
Notification
      |
      +--> delivery state
      |
      +--> user-visible history
```

The in-app notification center should not depend solely on push notifications.

---

# 11. Push Notification vs In-App Notification

These are different.

### Push

Delivered through:

```text
FCM / APNs / equivalent provider
```

Purpose:

> Wake/inform the user when the app is not active.

### In-App

Stored in the application's database.

Purpose:

> Provide persistent notification history.

Therefore:

```text
Booking confirmed
       |
       +--> Notification DB
       |
       +--> Push provider
```

If push fails:

```text
Notification DB = still available
```

The user can see the notification when opening the application.

---

# 12. Notification Templates

Notification content should not be hardcoded throughout services.

Bad:

```java
notificationService.send(
    "Your booking with " + worker.getName() + " is confirmed"
);
```

Better:

```text
Template:
BOOKING_CONFIRMED
```

with variables:

```text
workerName
bookingDate
bookingTime
```

Conceptually:

```text
BOOKING_CONFIRMED

Title:
Booking Confirmed

Body:
Your booking with {{workerName}} is confirmed for {{bookingDate}} at {{bookingTime}}.
```

This makes future changes easier.

---

# 13. Template Localization

The system should eventually support multiple languages.

For the initial Howrah/Kolkata market, potential languages include:

```text
English
Bengali
Hindi
```

The notification system should therefore avoid assuming one language.

Conceptually:

```text
Template
    |
    +--> en-IN
    +--> bn-IN
    +--> hi-IN
```

The user's preferred language can determine which template is selected.

MVP can initially support a smaller language set and expand later.

---

# 14. Notification Preferences

Users should eventually control non-critical notifications.

Example:

```text
Notification Preferences
-----------------------------
Booking updates       ON
Payment updates       ON
Marketing             OFF
Review reminders      ON
Promotional offers    OFF
```

However, not everything should be disableable.

For example:

```text
Security alerts
Payment-critical notifications
Dispute-related notifications
```

may be considered mandatory.

Therefore notifications should have categories:

```text
MANDATORY
IMPORTANT
OPTIONAL
MARKETING
```

---

# 15. Notification Priority

Not every notification has the same urgency.

Example:

### High priority

```text
Worker is arriving
Payment failed
Booking cancelled
Dispute requires action
```

### Normal priority

```text
Review reminder
Job summary
```

### Low priority

```text
Promotional communication
```

Priority can influence:

* retry behavior
* channel selection
* delivery timing
* batching.

---

# 16. Channel Selection Policy

The system should have a policy layer.

Example:

```text
BookingConfirmed
       |
       v
Notification Policy
       |
       +--> In-App
       +--> Push
```

For a critical event:

```text
PaymentFailure
       |
       +--> In-App
       +--> Push
       +--> Email
```

For marketing:

```text
MarketingEvent
       |
       +--> Push
       |
       +--> Email
```

subject to user preferences.

---

# 17. Provider Abstraction

The notification module should not depend directly on a specific vendor.

Conceptually:

```text
NotificationProvider
```

with implementations:

```text
PushNotificationProvider
SmsNotificationProvider
EmailNotificationProvider
WhatsAppNotificationProvider
```

The exact Java interfaces and classes will be designed during the LLD phase.

The architecture should allow:

```text
Provider A
```

to be replaced by:

```text
Provider B
```

without modifying business modules.

---

# 18. Provider Response Handling

External providers may return:

```text
SUCCESS
REJECTED
TIMEOUT
RATE_LIMITED
TEMPORARY_FAILURE
PERMANENT_FAILURE
```

These should not simply become:

```text
FAILED
```

internally.

The system needs enough information to determine whether retrying is appropriate.

For example:

```text
TIMEOUT
    -> retry

RATE_LIMITED
    -> retry with backoff

INVALID_PHONE
    -> permanent failure

INVALID_EMAIL
    -> permanent failure
```

---

# 19. Retry Strategy

Notification delivery should support controlled retries.

Example:

```text
Attempt 1
   |
   X
   |
wait
   |
Attempt 2
   |
   X
   |
wait
   |
Attempt 3
   |
   v
FAILED
```

Use exponential backoff with jitter.

Conceptually:

```text
1 minute
5 minutes
15 minutes
```

Exact values should be configuration, not hardcoded business logic.

---

# 20. Dead-Letter Handling

Some notifications will repeatedly fail.

Instead of retrying forever:

```text
Notification
   |
   +--> retry
   +--> retry
   +--> retry
   |
   v
Dead Letter / Failed State
```

Operations/admin should be able to inspect:

```text
notificationId
recipient
channel
provider
failure reason
attempt count
last attempted time
```

This is important for production debugging.

---

# 21. Idempotency

Notification delivery must be idempotent.

Suppose:

```text
BookingConfirmed
```

is accidentally processed twice.

Without protection:

```text
Push #1
Push #2
```

The user receives duplicates.

Instead, derive a deterministic notification key.

Conceptually:

```text
eventId + recipient + notificationType + channel
```

can form an idempotency boundary.

The exact implementation will be finalized during LLD/database design.

---

# 22. Event Delivery Reliability

There is an important distinction:

```text
Domain event generated
```

does not automatically mean:

```text
Notification delivered
```

The system should track the stages independently.

```text
Business transaction
        |
        v
Event persisted
        |
        v
Notification created
        |
        v
Notification queued
        |
        v
Provider called
        |
        v
Provider accepted
        |
        v
Delivered
```

Each stage can fail independently.

---

# 23. Transactional Outbox

As the system grows, notification events should use a transactional outbox.

Example:

```text
DB Transaction
--------------------------------
UPDATE booking
INSERT outbox_event
COMMIT
```

Then:

```text
Outbox Processor
       |
       v
Notification Module
```

This prevents the dangerous situation:

```text
Booking committed
       |
       X
Application crashes before event publication
```

Without an outbox, the notification could be lost.

With an outbox:

```text
Booking + Event
```

are committed atomically.

The event can be processed later.

---

# 24. Why We Don't Need Kafka Immediately

The initial architecture does **not** require Kafka.

For the MVP:

```text
Spring Boot
    |
    +--> transactional DB
    |
    +--> application events / outbox
    |
    +--> background workers
```

This is sufficient for a small-to-moderate deployment.

Kafka becomes useful when event volume, independent consumers, replay requirements, or cross-service architecture justify it.

The architecture should therefore make event processing replaceable rather than requiring Kafka from day one.

---

# 25. Notification Queue

Delivery should be asynchronous.

Conceptually:

```text
Notification Created
       |
       v
Queue
       |
       v
Notification Worker
       |
       v
Provider
```

Benefits:

* business APIs stay fast
* provider latency does not block requests
* retries are easier
* worker count can scale independently.

---

# 26. Multiple Notification Workers

As traffic grows:

```text
                    Queue
                      |
          +-----------+-----------+
          |           |           |
          v           v           v
       Worker 1    Worker 2    Worker 3
          |           |           |
          +-----------+-----------+
                      |
                      v
                  Providers
```

Workers can process notifications concurrently.

The system must ensure that two workers do not process the same notification incorrectly.

This is a concurrency problem that will be addressed in LLD and persistence design.

---

# 27. Redis Usage

Redis may be useful for:

```text
Rate limiting
Short-lived delivery locks
Provider throttling
Temporary OTP state
Presence
Caching notification preferences
```

But:

> Redis should not be the permanent source of truth for notification history.

Permanent records belong in PostgreSQL.

---

# 28. Rate Limiting

External providers often have limits.

For example:

```text
SMS Provider
100 requests/sec
```

The platform should avoid accidentally exceeding provider limits.

A rate-limiting layer can control:

```text
per provider
per channel
per tenant/environment
per notification category
```

Redis is a possible implementation for distributed rate limiting.

---

# 29. Notification Deduplication

Certain events may generate repeated notifications.

Example:

```text
Worker location:
EN_ROUTE
EN_ROUTE
EN_ROUTE
EN_ROUTE
```

The system should not send four customer notifications.

For high-frequency events:

```text
GPS/location update
```

should generally use realtime state updates rather than notification messages.

For example:

```text
Worker moved 100 meters
```

doesn't require a push notification.

Instead:

```text
WebSocket / realtime channel
```

can update the UI.

---

# 30. Notification vs Realtime Architecture

Important distinction:

```text
Notification
    |
    v
"Worker is on the way"
```

Realtime:

```text
Worker location
    |
    v
Map marker moves
```

Therefore:

```text
Business Event
   |
   +--> Notification
   |
   +--> Realtime Update
```

They may share event sources but have different delivery mechanisms.

Realtime architecture will be documented separately.

---

# 31. Customer Example

Suppose:

```text
Customer creates request
```

The system performs:

```text
ServiceRequestSubmitted
        |
        v
Matching
        |
        v
WorkerMatchCreated
        |
        v
Worker notification
```

Worker sees:

```text
New electrician job nearby.
Distance: 1.8 km
Preferred time: 6:00 PM
```

Worker accepts:

```text
WorkerMatchAccepted
        |
        v
Customer notification
```

Customer sees:

```text
Ramesh accepted your request.
```

Booking confirmed:

```text
BookingConfirmed
        |
        +--> Customer push
        +--> Customer in-app
        +--> Worker push
        +--> Worker in-app
```

---

# 32. Job Execution Example

Worker starts travelling:

```text
JobEnRoute
```

Customer:

```text
Your electrician is on the way.
```

Worker arrives:

```text
JobArrived
```

Customer:

```text
Your electrician has arrived.
```

Job completes:

```text
JobCompleted
```

Customer:

```text
Your job is completed.
Please review your experience.
```

Payment succeeds:

```text
PaymentSucceeded
```

Customer:

```text
Payment successful.
```

The important point is that each message originates from the relevant domain event.

---

# 33. Notification Failure Must Not Break Business Transactions

Consider:

```text
Booking Confirmation
```

Transaction:

```text
Booking -> CONFIRMED
```

Then:

```text
Push provider -> DOWN
```

Correct result:

```text
Booking = CONFIRMED
Notification = RETRY_PENDING
```

Incorrect result:

```text
Booking = FAILED
```

The external communication system should not determine the correctness of the core business transaction.

---

# 34. Security

Notifications can contain sensitive information.

Avoid sending excessive information through channels such as SMS.

Bad:

```text
Full customer address
Phone number
Payment details
```

Better:

```text
Your worker is arriving for your scheduled service.
Open the app for details.
```

Sensitive data should be shown only after authenticated access when possible.

---

# 35. Notification Security

The system should protect against:

* notification spoofing
* unauthorized notification creation
* malicious deep links
* account takeover
* provider credential leakage
* sensitive information leakage
* notification flooding.

Only trusted application flows should be able to generate user-facing system notifications.

---

# 36. Deep Links

Notifications should be actionable where appropriate.

Example:

```text
Booking confirmed.
```

Clicking:

```text
Notification
     |
     v
Mobile App
     |
     v
Booking Details
```

The notification should contain a safe internal reference rather than exposing sensitive database identifiers unnecessarily.

---

# 37. Notification Preferences Storage

Conceptually:

```text
notification_preferences
-------------------------
id
user_id
notification_type
channel
enabled
updated_at
```

But preferences should not be allowed to disable mandatory security/business-critical notifications.

---

# 38. Notification Delivery Tracking

The system should track:

```text
created
queued
processing
provider accepted
delivered
failed
```

This gives operations visibility.

For example:

```text
Notification #89213

Channel: SMS
Provider: X
Attempts: 2
Status: FAILED
Reason: Provider timeout
```

---

# 39. Operational Metrics

Important metrics include:

### Volume

```text
notifications_created_total
notifications_sent_total
notifications_failed_total
```

### Latency

```text
notification_queue_latency
notification_delivery_latency
```

### Reliability

```text
delivery_success_rate
provider_failure_rate
retry_rate
```

### Provider-specific

```text
sms_failure_rate
push_failure_rate
email_failure_rate
```

### Business

```text
booking_notification_success
payment_notification_success
```

---

# 40. Alerts

Production alerts may include:

```text
SMS failure rate > threshold
Push delivery failure spike
Notification queue growing continuously
Provider timeout spike
Dead-letter count increasing
Worker processing latency increasing
```

These should be monitored independently from core application health.

---

# 41. Data Retention

Not every notification needs indefinite retention.

Potential policy:

```text
User-visible notification history
    -> retain according to product policy

Operational delivery logs
    -> shorter retention

Security/audit records
    -> longer retention where required
```

Exact retention periods belong in the Data Privacy & Compliance document.

---

# 42. Architecture for Future Scale

Initial:

```text
Spring Boot
   |
PostgreSQL
   |
Background notification worker
   |
External providers
```

Growing:

```text
Spring Boot Instances
        |
        v
     Outbox
        |
        v
     Queue
        |
   +----+----+
   |    |    |
   v    v    v
Push  SMS  Email
```

Large scale:

```text
Business Services
       |
       v
Event Backbone
       |
       +----------------+
       |                |
       v                v
Notification       Analytics
Service
       |
   +---+---+---+
   |   |   |   |
 Push SMS Email WhatsApp
```

The architecture can evolve without changing the business domain contracts.

---

# 43. Failure Scenarios

## Provider unavailable

```text
Business event
      |
      v
Notification queued
      |
      X provider unavailable
      |
      v
Retry
```

Business transaction remains successful.

---

## Application crashes after DB commit

Transactional outbox allows the event to be recovered.

```text
DB
 |
 +--> Business state
 +--> Outbox event
```

---

## Duplicate event

Idempotency prevents duplicate notification delivery.

---

## User has disabled optional notification

The policy layer suppresses that channel.

---

## Push token invalid

The system should mark/remove the invalid device token rather than retrying indefinitely.

---

## SMS provider rate limit

Retry with backoff or route through an allowed fallback strategy.

---

# 44. Device Token Management

For push notifications, users may have multiple devices.

Conceptually:

```text
user
 |
 +--> device token A
 +--> device token B
 +--> device token C
```

The system should support:

* token registration
* token refresh
* token invalidation
* device logout
* duplicate token prevention.

A user may be logged into:

```text
Android phone
iPhone
tablet
```

simultaneously.

---

# 45. Worker-Specific Notification Requirements

Workers have different notification needs.

Important examples:

```text
New job opportunity
Job accepted
Customer cancelled
Customer approved additional work
Customer location/details changed
Payment received
Earnings updated
```

Workers may need faster notifications for job opportunities because these are time-sensitive.

Therefore matching notifications may have higher delivery priority than marketing or review reminders.

---

# 46. Customer-Specific Notification Requirements

Customers need:

```text
Worker found
Booking confirmed
Worker en route
Worker arrived
Additional work requested
Payment result
Job completed
Review reminder
Dispute updates
```

The customer experience should avoid notification spam.

---

# 47. Admin Notifications

Admins may receive operational alerts:

```text
High dispute volume
Payment failure spike
Provider outage
Worker verification backlog
Fraud signal
System incident
```

Admin notifications should be separated from normal customer/worker notifications.

---

# 48. Architecture Boundary

The notification module owns:

```text
Notification creation
Template selection
Channel selection
Preferences
Delivery
Retry
Provider integration
Delivery tracking
```

It should **not** own:

```text
Booking rules
Payment rules
Worker matching
Job lifecycle
Review rules
```

Those remain in their respective modules.

---

# 49. Proposed Module Structure

At high level:

```text
notification/
├── api/
├── application/
│   ├── command/
│   ├── query/
│   ├── service/
│   └── policy/
├── domain/
│   ├── model/
│   ├── event/
│   ├── valueobject/
│   └── exception/
└── infrastructure/
    ├── persistence/
    ├── provider/
    │   ├── push/
    │   ├── sms/
    │   ├── email/
    │   └── whatsapp/
    ├── queue/
    └── configuration/
```

Detailed Java classes, interfaces, method signatures and dependency relationships will be designed during the later **LLD phase**.

---

# 50. Core Invariants

The notification architecture should enforce:

### NI-001

A notification must have a valid recipient.

### NI-002

A notification must have a recognized notification type.

### NI-003

Mandatory notifications cannot be disabled through normal preferences.

### NI-004

Provider failure must not roll back the underlying business transaction.

### NI-005

Retries must be bounded.

### NI-006

Notification processing must be idempotent.

### NI-007

Sensitive information must not be unnecessarily exposed.

### NI-008

Notification history must not depend solely on external providers.

### NI-009

High-frequency realtime updates should not become push-notification spam.

### NI-010

External provider credentials must remain outside business/domain logic.

### NI-011

Provider-specific failures must be observable.

### NI-012

Notification generation and notification delivery are separate concerns.

---

# 51. MVP Scope

For the first production MVP:

### Include

```text
In-app notifications
Push notifications
SMS for OTP
Basic notification preferences
Notification history
Notification templates
Retry handling
Idempotency
Provider abstraction
Basic delivery tracking
Background notification processing
Structured logging/metrics
```

### Initially avoid

```text
Complex marketing automation
AI-generated notifications
Multi-provider routing engines
Voice calls
Complex notification campaigns
Sophisticated personalization
Large event streaming infrastructure
Kafka
Dedicated notification microservice
```

The goal is a reliable notification capability, not a notification platform startup.

---

# 52. Future Extensions

Later the platform could support:

```text
WhatsApp notifications
Email receipts
Provider failover
Smart channel selection
Notification batching
Notification scheduling
Localization expansion
Marketing campaigns
Worker-specific notification preferences
Customer communication preferences
Communication/chat module
Automated reminders
Intelligent notification prioritization
```

These should be added only when real product requirements justify them.

---

# 53. End-to-End Architecture

The resulting architecture is:

```text
                         CUSTOMER / WORKER
                                |
                                v
                         Spring Boot API
                                |
              +-----------------+-----------------+
              |                 |                 |
              v                 v                 v
        Service Request      Booking            Job
              |                 |                 |
              +-----------------+-----------------+
                                |
                                v
                         Domain Events
                                |
                                v
                       Transactional Outbox
                                |
                                v
                       Notification Worker
                                |
                     +----------+----------+
                     |          |          |
                     v          v          v
                   Push       SMS       Email
                     |          |          |
                     v          v          v
                 Providers / External Systems
```

PostgreSQL remains the source of truth for business and notification history.

Redis can support:

```text
rate limits
locks
temporary state
caching
provider throttling
```

The notification system remains independently scalable from the core API processing path.

---

# 54. Final Architecture Principles

1. **Business modules generate events; notification handles delivery.**
2. **Never make core transactions depend on external notification providers.**
3. **Use asynchronous processing for delivery.**
4. **Persist notification history.**
5. **Use idempotency to prevent duplicate notifications.**
6. **Use retries with bounded exponential backoff.**
7. **Separate notification from realtime communication.**
8. **Separate OTP/security messages from ordinary notifications.**
9. **Abstract external providers.**
10. **Treat Redis as supporting infrastructure, not permanent notification storage.**
11. **Use transactional outbox when reliable event publication is required.**
12. **Design for horizontal scaling without introducing microservices prematurely.**
13. **Protect sensitive customer and worker information.**
14. **Make notification policies configurable.**
15. **Keep detailed implementation decisions for the LLD phase.**

---

# 55. Decision Summary

| Area                      | Decision                                   |
| ------------------------- | ------------------------------------------ |
| Notification architecture | Event-driven                               |
| Initial deployment        | Modular monolith                           |
| Notification persistence  | PostgreSQL                                 |
| Delivery                  | Asynchronous                               |
| In-app history            | Yes                                        |
| Push                      | Yes                                        |
| SMS                       | Primarily OTP initially                    |
| Email                     | MVP via Brevo: verification, password reset, critical account notices ([ADR 0016](../adr/0016-email-password-login-phone-otp-later.md)) |
| Provider abstraction      | Yes                                        |
| Retry                     | Yes                                        |
| Idempotency               | Required                                   |
| Transactional outbox      | Introduce as reliability requirement grows |
| Kafka                     | Not initially                              |
| Redis                     | Supporting role                            |
| WebSocket                 | Separate realtime architecture             |
| Localization              | Designed for, limited MVP                  |
| Notification preferences  | Yes                                        |
| Marketing engine          | Not MVP                                    |
| Dedicated microservice    | Not initially                              |

---

## Final Principle

The notification system should be **boring, reliable infrastructure**.

When a booking is confirmed, the most important fact is:

```text
BOOKING = CONFIRMED
```

If SMS works:

```text
Great.
```

If SMS fails:

```text
Booking is still CONFIRMED.
Notification retries.
```

That separation is fundamental to building a reliable marketplace.
