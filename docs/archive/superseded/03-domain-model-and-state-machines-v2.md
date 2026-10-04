# Domain Model & State Machines

**Project:** Karigar Marketplace
**Architecture:** Modular Monolith
**Primary Backend:** Java + Spring Boot
**Database:** PostgreSQL + PostGIS
**Status:** Domain Design

---

# 1. Purpose

This document defines the core business objects of the Karigar Marketplace and, more importantly, the lifecycle of those objects.

The objective is to answer:

* What are the important business concepts?
* Who owns each concept?
* Which module owns it?
* What information belongs to each concept?
* What can change?
* What must remain historical?
* What states can an object enter?
* Which state transitions are allowed?
* Which transitions are triggered by customers, workers, admins, or external systems?
* Which concepts should be entities, value objects, aggregates, or events?

This document becomes the foundation for:

```text
Domain Model
      ↓
ERD / Database Design
      ↓
API Contracts
      ↓
Application Services
      ↓
Implementation
```

---

# 2. Core Domain Model

The first version of the platform revolves around:

```text
User
 │
 ├── Customer
 │      │
 │      ├── Address
 │      └── Service Request
 │
 └── Worker
        │
        ├── Skill
        ├── Verification
        ├── Availability
        └── Service Area

Service Request
       │
       ↓
     Match
       │
       ↓
    Booking
       │
       ↓
      Job
       │
       ├── Additional Work
       │
       └── Payment
              │
              ↓
           Review

Job
 │
 └── Dispute
```

Supporting concepts:

```text
Notification
Audit Event
Domain Event
```

---

# 3. Important Distinctions

Several concepts must remain separate.

## User ≠ Customer

A user represents an authenticated account.

A customer represents the person's role as a service consumer.

---

## Worker ≠ Availability

A worker can exist while currently unavailable.

Example:

```text
Worker:
ACTIVE

Availability:
NOT_ACCEPTING_JOBS
```

---

## Service Request ≠ Booking

A customer requesting a plumber does not mean a plumber has been booked.

```text
Request
   ↓
Matching
   ↓
Worker Selection
   ↓
Booking
```

---

## Booking ≠ Job

A booking means:

> The customer and worker have an agreed service appointment.

A job means:

> The actual service execution.

---

## Job ≠ Payment

A job can be completed while payment is:

```text
PENDING
```

or:

```text
FAILED
```

Payment therefore has its own lifecycle.

---

## Review ≠ Reputation

A review is an individual customer submission.

Reputation is an aggregate/derived concept.

We should retain the original reviews permanently even if reputation calculations change later.

---

# 4. Aggregate Concept

An aggregate is a consistency boundary.

We do not need to make every database table an aggregate.

Potential aggregates include:

```text
Worker
ServiceRequest
Booking
Job
Payment
Dispute
```

Some concepts such as:

```text
Skill
Address
Availability
```

may instead be entities/value objects within a larger boundary depending on the final design.

---

# 5. User

## Responsibility

Represents the authenticated platform account.

Potential information:

```text
User
├── id
├── phone
├── email
├── name
├── profilePhoto
├── status
├── createdAt
└── updatedAt
```

Possible statuses:

```text
ACTIVE
SUSPENDED
DEACTIVATED
```

The exact account lifecycle will be finalized with the identity/security design.

---

# 6. User State Machine

```text
                 ┌──────────────┐
                 │    ACTIVE    │
                 └──────┬───────┘
                        │
                 admin suspension
                        │
                        ▼
                 ┌──────────────┐
                 │  SUSPENDED   │
                 └──────┬───────┘
                        │
                    reinstated
                        │
                        ▼
                 ┌──────────────┐
                 │    ACTIVE    │
                 └──────────────┘

ACTIVE
   │
   │ deactivation
   ▼
DEACTIVATED
```

A suspended account should not be treated as deleted.

Historical transactions must remain intact.

---

# 7. Customer

A customer is a user acting as a service requester.

Conceptually:

```text
User
  │
  └── Customer Profile
```

A user may potentially become both:

```text
Customer
+
Worker
```

This should remain possible unless the product later decides otherwise.

---

# 8. Worker

The worker is one of the most important business entities.

A worker represents an independent skilled professional registered on the platform.

Potential information:

```text
Worker
├── id
├── userId
├── displayName
├── profession
├── experience
├── description
├── status
├── verificationStatus
├── createdAt
└── updatedAt
```

---

# 9. Worker Lifecycle

Possible lifecycle:

```text
REGISTERED
     ↓
PROFILE_INCOMPLETE
     ↓
VERIFICATION_PENDING
     ↓
VERIFIED
     ↓
ACTIVE
     ↓
SUSPENDED
```

More accurately, verification and account availability should not be treated as one state machine.

Therefore we should separate:

```text
Worker Account Status
```

from:

```text
Worker Verification Status
```

and:

```text
Worker Availability
```

This is an important architectural decision.

---

# 10. Worker Account State

```text
ONBOARDING
    ↓
ACTIVE
    ↓
SUSPENDED
    ↓
ACTIVE

ACTIVE
    ↓
DEACTIVATED
```

---

# 11. Worker Verification State

```text
NOT_SUBMITTED
      ↓
PENDING
      ↓
VERIFIED
```

Alternative path:

```text
PENDING
   ↓
REJECTED
   ↓
RESUBMITTED
   ↓
PENDING
```

Potential verification types:

```text
PHONE
IDENTITY
SKILL
CERTIFICATION
BACKGROUND
```

The exact verification requirements are an open product decision.

---

# 12. Worker Availability

Availability is deliberately separate.

Possible state:

```text
ACCEPTING_JOBS
NOT_ACCEPTING_JOBS
```

Example:

```text
Worker Account: ACTIVE
Verification: VERIFIED
Availability: NOT_ACCEPTING_JOBS
```

The worker exists and is verified but should not receive new jobs.

---

# 13. Worker Skills

A worker can have multiple skills.

Example:

```text
Worker
  ├── Electrical Wiring
  ├── Fan Installation
  ├── Switch Repair
  └── MCB Installation
```

Skills should come from a platform-controlled catalog rather than arbitrary free text.

This improves matching.

---

# 14. Profession vs Skill

These should remain separate.

Profession:

```text
Electrician
Plumber
```

Skill:

```text
Wiring
Fan Installation
Pipe Leakage
Tap Installation
Motor Repair
```

A worker can therefore have:

```text
Profession:
Electrician

Skills:
Wiring
Fan Installation
Switch Repair
MCB Installation
```

---

# 15. Service Area

A worker may define where they are willing to work.

Example:

```text
Worker
   ↓
Service Area
   ↓
Radius / locality / geographic boundary
```

This is different from the worker's current location.

---

# 16. Current Location vs Service Area

These concepts must not be confused.

### Current Location

Where the worker currently is.

Used for:

```text
distance
ETA
nearby matching
```

### Service Area

Where the worker is willing to work.

Example:

```text
Shibpur
Howrah Maidan
Salkia
Santragachi
```

A worker may currently be in Shibpur but have a service area extending across several neighborhoods.

---

# 17. Address

Customer addresses represent service locations.

A customer may have:

```text
Home
Office
Shop
Other
```

An address should contain geographic coordinates.

Conceptually:

```text
Address
├── id
├── customerId
├── label
├── addressText
├── latitude
├── longitude
└── metadata
```

PostGIS will eventually store the spatial representation.

---

# 18. Service Request

This is the customer's initial demand.

Example:

> "Kitchen sink pipe is leaking. Need a plumber today."

A request may contain:

```text
ServiceRequest
├── id
├── customerId
├── category
├── description
├── location
├── preferredTime
├── urgency
├── status
├── createdAt
└── expiresAt
```

Photos may be attached separately.

---

# 19. Service Request Lifecycle

Recommended:

```text
DRAFT
  ↓
SUBMITTED
  ↓
MATCHING
  ↓
MATCH_FOUND
  ↓
BOOKED
  ↓
COMPLETED
```

Alternative terminal states:

```text
CANCELLED
EXPIRED
FAILED_TO_MATCH
```

---

# 20. Service Request State Machine

```text
                   ┌─────────────┐
                   │    DRAFT    │
                   └──────┬──────┘
                          │ submit
                          ▼
                   ┌─────────────┐
                   │  SUBMITTED  │
                   └──────┬──────┘
                          │
                       matching
                          ▼
                   ┌─────────────┐
                   │   MATCHING  │
                   └──────┬──────┘
                          │
                  candidate found
                          ▼
                   ┌─────────────┐
                   │ MATCH_FOUND │
                   └──────┬──────┘
                          │
                     booking
                          ▼
                   ┌─────────────┐
                   │    BOOKED   │
                   └──────┬──────┘
                          │
                     job completed
                          ▼
                   ┌─────────────┐
                   │  COMPLETED  │
                   └─────────────┘
```

Cancellation:

```text
DRAFT ─────────────→ CANCELLED
SUBMITTED ─────────→ CANCELLED
MATCHING ──────────→ CANCELLED
MATCH_FOUND ───────→ CANCELLED
BOOKED ────────────→ CANCELLED
```

Expiration:

```text
MATCHING → EXPIRED
```

Failure:

```text
MATCHING → FAILED_TO_MATCH
```

---

# 21. Why Service Request Has Its Own Lifecycle

Because a customer request can exist without becoming a booking.

Example:

```text
Customer:
"I need an electrician."

System:
No suitable verified worker is available.

Result:
FAILED_TO_MATCH
```

There was a legitimate service request, but no booking.

This distinction is important for marketplace analytics.

---

# 22. Match

A Match represents the relationship between:

```text
Service Request
+
Potential Worker
```

It is not a booking.

Example:

```text
Request #1001
     │
     ├── Worker A → candidate
     ├── Worker B → candidate
     ├── Worker C → candidate
     └── Worker D → candidate
```

Each candidate may have:

```text
distance
skill compatibility
availability
verification
ranking score
createdAt
status
```

---

# 23. Match Lifecycle

Possible states:

```text
CANDIDATE
   ↓
NOTIFIED
   ↓
VIEWED
   ↓
ACCEPTED
```

Alternative outcomes:

```text
REJECTED
EXPIRED
WITHDRAWN
```

---

# 24. Important Matching Rule

A worker accepting a match does **not automatically mean the booking is finalized** if the product workflow requires customer confirmation.

Possible flow:

```text
Request
   ↓
Match
   ↓
Worker accepts
   ↓
Customer selects
   ↓
Booking confirmed
```

Alternatively:

```text
Request
   ↓
Match
   ↓
Worker accepts
   ↓
Booking automatically confirmed
```

The exact marketplace rule is still an open decision.

The domain model must support either approach.

---

# 25. Matching Concurrency

Suppose:

```text
Customer requests plumber.
```

System notifies:

```text
Worker A
Worker B
Worker C
```

Worker A and Worker B accept almost simultaneously.

We must not end with:

```text
Booking:
Worker A

AND

Booking:
Worker B
```

for a request that only permits one worker.

The final assignment must be protected by a transaction/concurrency mechanism.

---

# 26. Booking

Booking represents an agreed appointment.

Potential information:

```text
Booking
├── id
├── serviceRequestId
├── customerId
├── workerId
├── scheduledAt
├── status
├── cancellationReason
├── createdAt
└── confirmedAt
```

---

# 27. Booking Lifecycle

```text
PENDING
   ↓
CONFIRMED
   ↓
CANCELLED
```

Or:

```text
PENDING
   ↓
EXPIRED
```

A confirmed booking can later lead to job execution.

---

# 28. Booking State Machine

```text
                 ┌────────────┐
                 │   PENDING  │
                 └─────┬──────┘
                       │ confirm
                       ▼
                 ┌────────────┐
                 │ CONFIRMED  │
                 └─────┬──────┘
                       │
                 service starts
                       │
                       ▼
                 Job lifecycle
```

Cancellation:

```text
PENDING ───→ CANCELLED

CONFIRMED ─→ CANCELLED
```

Expiration:

```text
PENDING ───→ EXPIRED
```

---

# 29. Booking vs Job

Example:

```text
10:00 AM
Customer books electrician.

Booking:
CONFIRMED
```

At 9:55:

```text
Worker:
EN_ROUTE
```

At 10:10:

```text
Worker:
ARRIVED
```

At 10:15:

```text
Job:
WORK_STARTED
```

The booking did not need to change through all those execution states.

The job did.

---

# 30. Job

The job represents actual service execution.

Potential information:

```text
Job
├── id
├── bookingId
├── startedAt
├── arrivedAt
├── completedAt
├── status
└── completionDetails
```

---

# 31. Job Lifecycle

```text
CONFIRMED
   ↓
EN_ROUTE
   ↓
ARRIVED
   ↓
WORK_STARTED
   ↓
WORK_COMPLETED
```

Potential exceptional states:

```text
CUSTOMER_NO_SHOW
WORKER_NO_SHOW
CANCELLED
```

---

# 32. Job State Machine

```text
                ┌─────────────┐
                │  CONFIRMED  │
                └──────┬──────┘
                       │
                       ▼
                ┌─────────────┐
                │  EN_ROUTE   │
                └──────┬──────┘
                       │
                       ▼
                ┌─────────────┐
                │   ARRIVED   │
                └──────┬──────┘
                       │
                       ▼
                ┌─────────────┐
                │ WORK_STARTED│
                └──────┬──────┘
                       │
                       ▼
                ┌─────────────┐
                │WORK_COMPLETED
                └─────────────┘
```

---

# 33. No-Show

No-show is not the same as cancellation.

Example:

```text
Booking:
Confirmed

Scheduled:
10:00 AM

Worker:
never arrives
```

Result:

```text
WORKER_NO_SHOW
```

Customer similarly may be unavailable:

```text
CUSTOMER_NO_SHOW
```

This distinction is important for worker/customer reliability metrics.

---

# 34. Additional Work

During a job, the worker may discover:

> "The pipe itself is damaged and needs replacement."

The worker should not silently charge the customer.

Instead:

```text
Worker
   ↓
Additional Work Request
   ↓
Customer Approval
   ↓
Approved
   ↓
Work
```

---

# 35. Additional Work Lifecycle

```text
PROPOSED
   ↓
APPROVED
   ↓
COMPLETED
```

Alternative:

```text
PROPOSED
   ↓
REJECTED
```

Potential information:

```text
AdditionalWork
├── id
├── jobId
├── description
├── amount
├── status
├── proposedAt
├── approvedAt
└── completedAt
```

---

# 36. Payment

Payment must have an independent lifecycle.

Potential states:

```text
INITIATED
PENDING
SUCCESS
FAILED
REFUNDED
PARTIALLY_REFUNDED
```

---

# 37. Payment State Machine

```text
             ┌─────────────┐
             │  INITIATED  │
             └──────┬──────┘
                    │
                    ▼
             ┌─────────────┐
             │   PENDING   │
             └──────┬──────┘
                    │
              ┌─────┴─────┐
              │           │
              ▼           ▼
          SUCCESS       FAILED
              │
              │ refund
              ▼
          REFUNDED
```

Partial refund:

```text
SUCCESS
   ↓
PARTIALLY_REFUNDED
```

---

# 38. Payment Provider Interaction

The payment lifecycle should not depend solely on the frontend.

Example:

```text
Customer
   ↓
Create Payment
   ↓
Payment Provider
   ↓
Webhook
   ↓
Backend
   ↓
Validate webhook
   ↓
Update Payment
```

The provider webhook is an important source of truth for asynchronous payment status.

---

# 39. Payment Idempotency

Suppose the client sends:

```text
POST /payments
```

twice because of a network retry.

The system must not create two charges.

Use:

```text
Idempotency-Key
```

and store the relevant request/result relationship.

This is a domain/system invariant, not merely an API convenience.

---

# 40. Review

A review belongs to a completed service interaction.

Potential information:

```text
Review
├── id
├── jobId
├── reviewerId
├── revieweeId
├── rating
├── comment
├── createdAt
└── status
```

The first version may primarily support:

```text
Customer → Worker
```

Later:

```text
Worker → Customer
```

can be added if the marketplace requires it.

---

# 41. Review Eligibility

A review should normally require:

```text
Job = WORK_COMPLETED
```

and:

```text
Reviewer participated in the job
```

The same job should not allow unlimited reviews from the same reviewer.

---

# 42. Review Lifecycle

Simple initial model:

```text
ELIGIBLE
   ↓
SUBMITTED
   ↓
PUBLISHED
```

Potential moderation:

```text
SUBMITTED
   ↓
UNDER_REVIEW
   ↓
PUBLISHED
```

or:

```text
SUBMITTED
   ↓
REJECTED
```

The exact moderation policy remains open.

---

# 43. Reputation

Reputation should not simply be:

```text
worker.rating = 4.8
```

Instead, underlying evidence should remain available.

Potential reputation inputs:

```text
Completed jobs
Reviews
Average rating
Rating distribution
Repeat customers
Cancellation rate
No-show rate
Disputes
Verification
```

The exact reputation algorithm should be designed later.

---

# 44. Dispute

A dispute represents a disagreement involving a completed/attempted transaction.

Examples:

```text
Customer:
"Worker did not complete the work."

Customer:
"I was charged for work I didn't approve."

Worker:
"Customer refused to pay."

Worker:
"Customer was unavailable."

Customer:
"Property was damaged."
```

---

# 45. Dispute Lifecycle

```text
OPEN
  ↓
UNDER_REVIEW
  ↓
RESOLVED
```

Potential resolution:

```text
CUSTOMER_FAVOUR
WORKER_FAVOUR
PARTIAL
NO_ACTION
```

These are resolution outcomes, not dispute states.

---

# 46. Dispute Evidence

Evidence may include:

```text
Job details
Booking details
Payment records
Additional work approval
Photos
Messages
Location/timestamps
Worker/customer responses
```

Historical evidence should not be silently overwritten.

---

# 47. Notification

Notification is an infrastructure/business-support concept.

Examples:

```text
ServiceRequestSubmitted
WorkerMatchFound
BookingConfirmed
WorkerEnRoute
WorkerArrived
AdditionalWorkRequested
PaymentSuccessful
JobCompleted
BookingCancelled
DisputeOpened
```

Notification itself can have:

```text
PENDING
SENT
FAILED
```

but notification delivery status should not change the underlying business transaction.

---

# 48. Notification State Machine

```text
PENDING
   ↓
PROCESSING
   ↓
SENT
```

Failure:

```text
PROCESSING
   ↓
FAILED
```

Retry may result in:

```text
FAILED
   ↓
PENDING
```

---

# 49. Audit Event

Important administrative/security actions should generate audit records.

Examples:

```text
Worker suspended
Worker verification approved
Dispute resolved
Payment manually adjusted
Refund initiated
Account deactivated
```

Audit records should be treated as historical records.

---

# 50. Domain Event vs State

This distinction is important.

State:

```text
Booking.status = CONFIRMED
```

Event:

```text
BookingConfirmed
```

State tells us:

> What is true now?

Event tells us:

> What happened?

Both can be useful.

---

# 51. Example

Before:

```text
Booking.status = PENDING
```

Action:

```text
Confirm booking
```

After:

```text
Booking.status = CONFIRMED
```

Event:

```text
BookingConfirmed
```

The event may trigger:

```text
Notification
Analytics
Matching cleanup
```

without making the booking module responsible for those tasks.

---

# 52. Core Lifecycle Relationship

The overall marketplace lifecycle becomes:

```text
Customer
    │
    ▼
Service Request
    │
    ▼
Matching
    │
    ▼
Worker Match
    │
    ▼
Booking
    │
    ▼
Job
    │
    ├───────────────┐
    ▼               ▼
Payment          Review
    │
    ▼
Dispute if needed
```

---

# 53. Important State Ownership Rule

Each lifecycle should have one owner.

For example:

```text
ServiceRequest
    → Service Request module

Match
    → Matching module

Booking
    → Booking module

Job
    → Job module

Payment
    → Payment module

Review
    → Review module

Dispute
    → Dispute module
```

Do not allow multiple modules to directly mutate the same lifecycle.

---

# 54. State Transition Ownership

For example:

```text
Booking
```

can transition:

```text
PENDING → CONFIRMED
```

only through a booking use case.

Not:

```text
WorkerService
   ↓
booking.status = CONFIRMED
```

Instead:

```text
Worker action
   ↓
Booking application use case
   ↓
Booking domain
   ↓
CONFIRMED
```

---

# 55. Immutable Historical Data

Certain information should never simply be overwritten.

Examples:

```text
Payment transaction
Review
Dispute resolution
Audit event
Job timestamps
Cancellation event
Verification history
```

Instead of:

```text
status = something
```

and losing history, we may eventually maintain:

```text
status
+
history/event records
```

where business/audit requirements justify it.

---

# 56. Current State vs History

For example:

```text
Booking.status = CANCELLED
```

Current state.

But history may show:

```text
09:00 PENDING
09:02 CONFIRMED
09:47 CANCELLED
```

This is valuable for:

* debugging
* disputes
* analytics
* customer support
* fraud detection
* reliability calculations

---

# 57. Time Handling

All important timestamps should be stored consistently.

Examples:

```text
createdAt
updatedAt
confirmedAt
arrivedAt
startedAt
completedAt
cancelledAt
```

The backend should use a consistent time standard, typically UTC for persistence.

User-facing times can be converted to the relevant local timezone.

---

# 58. State Transition Validation

The application must reject invalid transitions.

Example:

```text
COMPLETED
   ↓
EN_ROUTE
```

must be impossible.

Similarly:

```text
CANCELLED
   ↓
CONFIRMED
```

should not silently occur.

A state machine should explicitly define valid transitions.

---

# 59. State Transition Pattern

Instead of:

```java
booking.setStatus(CONFIRMED);
```

everywhere, prefer domain behavior such as:

```java
booking.confirm();
```

Then the domain can enforce:

```text
Only PENDING bookings can be confirmed.
```

Similarly:

```text
booking.cancel();
job.start();
job.arrive();
job.complete();
payment.markSuccessful();
```

This keeps lifecycle rules centralized.

---

# 60. Example Domain Behavior

Conceptually:

```text
Booking.confirm()

IF status != PENDING
    reject

ELSE
    status = CONFIRMED
    confirmedAt = now
```

This is more reliable than allowing every service to modify the status field.

---

# 61. Aggregate Boundary — Booking

Booking may protect invariants such as:

```text
A booking cannot be confirmed twice.
A cancelled booking cannot be confirmed.
A booking must have a worker.
A booking must reference a valid service request.
```

The exact aggregate boundary will be refined during database design.

---

# 62. Aggregate Boundary — Service Request

Service request may protect:

```text
Cannot submit without required information.
Cannot cancel after an irreversible stage.
Cannot be booked twice if only one booking is allowed.
```

Again, exact behavior depends on the final marketplace workflow.

---

# 63. Aggregate Boundary — Payment

Payment protects:

```text
A payment cannot transition from FAILED to SUCCESS arbitrarily.
A successful payment cannot be charged twice for the same idempotency operation.
A refund cannot exceed the captured amount.
```

These are strong financial invariants.

---

# 64. Aggregate Boundary — Job

Job protects:

```text
Cannot start before arrival.
Cannot complete before starting.
Cannot arrive after cancellation.
Cannot complete twice.
```

This is a clear state machine.

---

# 65. Marketplace-Level Invariant

One of the most important invariants:

> A service request that permits only one worker assignment must not have two simultaneously confirmed workers.

This is not just an application convention.

It must be protected transactionally.

---

# 66. Another Marketplace Invariant

A worker marked:

```text
NOT_ACCEPTING_JOBS
```

should not receive new assignments.

This should be enforced both in:

```text
Matching
```

and when finalizing:

```text
Booking
```

because availability can change between candidate discovery and booking.

---

# 67. Matching Is Eventually Consistent

Matching may operate asynchronously.

Example:

```text
Service Request created
        ↓
Transaction committed
        ↓
Event published
        ↓
Matching starts
        ↓
Candidates calculated
```

There can therefore be a short delay between:

```text
SUBMITTED
```

and:

```text
MATCHING
```

This is acceptable.

The final booking transaction must still enforce the important invariants synchronously.

---

# 68. Synchronous vs Asynchronous Operations

Good candidates for synchronous processing:

```text
Create request
Confirm booking
Cancel booking
Start job
Complete job
Create payment record
Approve additional work
```

Good candidates for asynchronous processing:

```text
Send notification
Calculate candidates
Send SMS
Send email
Analytics
Search indexing
Non-critical provider operations
```

The exact boundaries will evolve.

---

# 69. Initial State Machines Summary

## User

```text
ACTIVE
SUSPENDED
DEACTIVATED
```

## Worker Account

```text
ONBOARDING
ACTIVE
SUSPENDED
DEACTIVATED
```

## Worker Verification

```text
NOT_SUBMITTED
PENDING
VERIFIED
REJECTED
```

## Worker Availability

```text
ACCEPTING_JOBS
NOT_ACCEPTING_JOBS
```

## Service Request

```text
DRAFT
SUBMITTED
MATCHING
MATCH_FOUND
BOOKED
COMPLETED

CANCELLED
EXPIRED
FAILED_TO_MATCH
```

## Match

```text
CANDIDATE
NOTIFIED
VIEWED
ACCEPTED

REJECTED
EXPIRED
WITHDRAWN
```

## Booking

```text
PENDING
CONFIRMED

CANCELLED
EXPIRED
```

## Job

```text
CONFIRMED
EN_ROUTE
ARRIVED
WORK_STARTED
WORK_COMPLETED

WORKER_NO_SHOW
CUSTOMER_NO_SHOW
CANCELLED
```

## Additional Work

```text
PROPOSED
APPROVED
REJECTED
COMPLETED
```

## Payment

```text
INITIATED
PENDING
SUCCESS
FAILED
REFUNDED
PARTIALLY_REFUNDED
```

## Review

```text
ELIGIBLE
SUBMITTED
PUBLISHED
REJECTED
```

## Dispute

```text
OPEN
UNDER_REVIEW
RESOLVED
```

## Notification

```text
PENDING
PROCESSING
SENT
FAILED
```

---

# 70. What We Are Deliberately NOT Modeling Yet

We should not prematurely introduce:

```text
Subscription
Wallet
Loan
Insurance
Training
Equipment Marketplace
Referral Program
Loyalty Points
Dynamic Pricing
AI Agent
Corporate Accounts
Multi-City Hierarchy
```

These may become future domains.

They should not distort the initial architecture.

---

# 71. Core Domain Graph

The current domain can be summarized as:

```text
                         USER
                          │
              ┌───────────┴───────────┐
              │                       │
          CUSTOMER                  WORKER
              │                       │
           ADDRESS               ┌────┼────┐
              │                  │    │    │
              │               SKILL  AREA  VERIFY
              │
              ▼
       SERVICE REQUEST
              │
              ▼
          MATCHING
              │
              ▼
            MATCH
              │
              ▼
           BOOKING
              │
              ▼
             JOB
          ┌───┼────┐
          │   │    │
       PAYMENT  ADDITIONAL
          │      WORK
          │
          ▼
        REVIEW

             JOB
              │
              ▼
           DISPUTE
```

---

# 72. Most Important Design Principle

The system should not be modeled as:

```text
User
Booking
Payment
Review
```

as disconnected CRUD tables.

It should be modeled around the real-world lifecycle:

```text
A customer has a problem
        ↓
Customer requests help
        ↓
System finds suitable workers
        ↓
Worker accepts
        ↓
Appointment is confirmed
        ↓
Worker travels
        ↓
Worker performs service
        ↓
Customer approves additional work if needed
        ↓
Payment occurs
        ↓
Review is submitted
        ↓
Reputation improves
        ↓
Future customers gain trust
```

That lifecycle is the actual product.

---

# 73. Domain Design Principle

The most important rule for the implementation is:

> **Do not let database structure dictate business structure.**

We first define:

```text
What happened?
Who owns it?
What rules apply?
What states are possible?
```

Then we design:

```text
Tables
Indexes
Foreign keys
API endpoints
Java classes
```

---

# 74. Open Domain Decisions

The following remain intentionally unresolved:

### Matching

* Can multiple workers accept simultaneously?
* Does customer choose the worker?
* Does first qualified worker win?
* How many candidates receive the request?
* How long does a match remain valid?

### Booking

* Does worker acceptance automatically create a booking?
* Does customer confirmation remain necessary?
* Can booking be rescheduled?
* Can another worker replace a cancelled worker?

### Pricing

* Fixed price?
* Worker quote?
* Customer budget?
* Negotiation?
* Hybrid model?

### Payment

* Before service?
* After service?
* Partial authorization?
* Cash support?
* Platform commission timing?

### Verification

* Which verification is mandatory?
* Identity verification?
* Skill certification?
* Background verification?

### Reputation

* Which signals affect reputation?
* Are no-shows weighted?
* Are cancellations weighted?
* How are disputes reflected?

These are product/business decisions and should not be hidden inside technical implementation.

---

# 75. Domain Model Status

**Status: Approved as the working domain model**

The model is intentionally detailed enough to design the database, but flexible enough to accommodate unresolved marketplace rules.

The next document should convert this model into a concrete persistence design.

---

# 76. Next Document

**[architecture/03](../../architecture/03-erd-and-production-database-design.md) — ERD & Production Database Design**

That document will define:

```text
Tables
Columns
Primary Keys
Foreign Keys
Relationships
Indexes
Constraints
Enums
PostGIS types
Spatial indexes
Unique constraints
Audit/history tables
Soft deletion rules
Timestamps
Migration strategy
Transaction boundaries
Database-level concurrency protection
```

The database design will be based on the state machines defined here rather than simply creating one table per screen.
