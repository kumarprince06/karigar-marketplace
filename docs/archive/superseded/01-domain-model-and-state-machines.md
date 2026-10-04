# Domain Model & State Machines

**Project:** Karigar Marketplace
**Initial Market:** Howrah/Kolkata
**Initial Categories:** Electricians and Plumbers
**Architecture Direction:** Modular Monolith
**Status:** Draft for Domain & Engineering Review

---

# 1. Purpose

This document defines the core business domain of the Karigar Marketplace.

The goal is to answer:

* What are the important business objects?
* What does each object represent?
* Who owns it?
* What is its lifecycle?
* Which data should be mutable?
* Which historical information must be preserved?
* Which states are allowed?
* Which objects should remain independent?

This document becomes the foundation for:

```text
Domain Model
      ↓
State Machines
      ↓
ERD
      ↓
Database Design
      ↓
Application Modules
      ↓
API Contracts
```

The most important architectural principle is:

> **Do not model the application around database tables or API endpoints first. Model it around real business concepts and their lifecycles.**

---

# 2. Core Domain

The initial business domain can be represented as:

```text
                         ┌─────────────┐
                         │    User     │
                         └──────┬──────┘
                                │
                 ┌──────────────┴──────────────┐
                 │                             │
          ┌──────▼──────┐              ┌──────▼──────┐
          │  Customer   │              │   Worker    │
          └──────┬──────┘              └──────┬──────┘
                 │                            │
                 │                            ├── Skills
                 │                            ├── Verification
                 │                            ├── Availability
                 │                            └── Service Area
                 │
                 ▼
        ┌──────────────────┐
        │ Service Request  │
        └────────┬─────────┘
                 │
                 ▼
        ┌──────────────────┐
        │      Match       │
        └────────┬─────────┘
                 │
                 ▼
        ┌──────────────────┐
        │     Booking      │
        └────────┬─────────┘
                 │
                 ▼
        ┌──────────────────┐
        │       Job        │
        └──────┬─────┬─────┘
               │     │
       ┌───────┘     └──────────┐
       ▼                        ▼
 Payment                 Additional Work
       │
       ▼
    Review

       Job
        │
        ▼
    Dispute
```

This is intentionally not one giant entity.

Each concept has a different responsibility.

---

# 3. User

## 3.1 Purpose

`User` represents an authenticated human account in the platform.

A user may eventually act as:

* Customer
* Worker
* Both

The identity of the person should not be duplicated simply because their role changes.

---

## 3.2 Conceptual data

```text
User
├── id
├── phone
├── phone_verified
├── email
├── status
├── created_at
├── updated_at
└── last_login_at
```

Potential statuses:

```text
ACTIVE
SUSPENDED
DEACTIVATED
```

---

# 4. Customer

`Customer` represents the customer's platform-specific profile.

Conceptually:

```text
User
  │
  └── Customer Profile
```

Possible information:

```text
Customer
├── user_id
├── display_name
├── profile_photo
└── preferences
```

Customer-specific information should not be placed directly into the `User` model unless it truly belongs to identity.

---

# 5. Worker

Worker is one of the most important domain concepts.

A worker represents an independent skilled professional who can receive jobs through the platform.

```text
Worker
├── user
├── professional profile
├── skills
├── experience
├── verification
├── service areas
├── availability
└── reputation
```

---

# 6. Worker Identity vs Professional Identity

These must remain conceptually separate.

Example:

```text
User
    ↓
"Ramesh Kumar"
    ↓
Worker Profile
    ↓
Electrician
    ↓
8 years experience
    ↓
Electrical repair
    ↓
Fan installation
    ↓
Wiring
```

The worker's phone number identifies the account.

The worker profile represents their professional identity.

This distinction becomes important when we later build the **Worker Professional Passport**.

---

# 7. Skill

A skill represents a capability recognized by the platform.

Examples:

```text
Electrical Wiring
Fan Installation
Switch Repair
MCB Replacement
Pipe Leakage Repair
Tap Installation
Water Tank Repair
```

A worker can have multiple skills.

```text
Worker
   │
   ├── Skill A
   ├── Skill B
   ├── Skill C
   └── Skill D
```

Skills should come from a controlled platform catalog rather than arbitrary strings.

For example:

```text
"fan repair"
"Fan Repair"
"Fan repairing"
```

should not become three different skills.

---

# 8. Profession / Category

Profession and skill are different.

Example:

```text
Profession:
Electrician

Skills:
- Wiring
- Fan installation
- Switch repair
- MCB replacement
- Inverter installation
```

Another example:

```text
Profession:
Plumber

Skills:
- Tap repair
- Pipe leakage
- Bathroom fitting
- Water tank repair
```

Therefore:

```text
Profession ≠ Skill
```

This distinction should remain in the domain model.

---

# 9. Worker Verification

Verification represents whether the platform has established certain facts about a worker.

Verification should not be represented by a single:

```text
is_verified = true
```

because verification can have multiple dimensions.

Potential verification types:

```text
PHONE_VERIFIED
IDENTITY_VERIFIED
SKILL_VERIFIED
CERTIFICATION_VERIFIED
BACKGROUND_CHECKED
```

Conceptually:

```text
Worker
  │
  ├── Phone verification
  ├── Identity verification
  ├── Skill verification
  └── Certification verification
```

Each verification should have its own status and history.

Possible states:

```text
PENDING
VERIFIED
REJECTED
EXPIRED
REVOKED
```

This allows the system to evolve without redesigning the worker model later.

---

# 10. Worker Availability

Availability is deliberately separate from worker status.

A worker can be:

```text
ACTIVE
```

but currently:

```text
NOT_ACCEPTING_JOBS
```

Therefore:

```text
Account Status
        ≠
Job Availability
```

Example:

```text
Worker Account
ACTIVE

Current availability
OFFLINE
```

Another example:

```text
Worker Account
ACTIVE

Current availability
AVAILABLE
```

The worker may also define schedules:

```text
Monday      09:00 - 18:00
Tuesday     09:00 - 18:00
Wednesday   09:00 - 18:00
```

---

# 11. Worker Service Area

A worker should define where they are willing to work.

This may eventually include:

* geographical coordinates
* radius
* localities
* service zones

For example:

```text
Worker:
Ramesh

Base Location:
Shibpur

Service Radius:
8 km
```

This is different from the worker's current real-time location.

Important distinction:

```text
Home/Base Location
        ≠
Service Area
        ≠
Current Location
```

We should not expose unnecessary precise worker location to customers.

---

# 12. Address

Customer addresses should be modeled separately from the user.

Example:

```text
Customer
   │
   ├── Home
   ├── Office
   └── Rental Property
```

An address may contain:

```text
label
address_line
locality
city
postal_code
latitude
longitude
```

The geographic coordinates are important for matching.

---

# 13. Service Request

This is one of the most important domain objects.

A service request represents:

> **A customer's demand for a particular service.**

Example:

```text
Customer:
Ananya

Request:
"My bathroom tap is leaking."

Category:
Plumbing

Location:
Howrah

Preferred Time:
Today 6 PM
```

The request is **not yet a booking**.

---

# 14. Service Request Lifecycle

Recommended initial lifecycle:

```text
DRAFT
  │
  ▼
SUBMITTED
  │
  ▼
MATCHING
  │
  ├──────────────► FAILED_TO_MATCH
  │
  ▼
MATCH_FOUND
  │
  ▼
BOOKED
  │
  ▼
COMPLETED
```

Cancellation can occur at appropriate stages:

```text
SUBMITTED ─────► CANCELLED

MATCHING ───────► CANCELLED

MATCH_FOUND ────► CANCELLED

BOOKED ─────────► CANCELLED
```

Expiration may also occur:

```text
MATCHING
    │
    ▼
EXPIRED
```

---

# 15. Why Request and Booking Are Separate

Consider:

```text
Customer creates request
        ↓
Matching starts
        ↓
5 workers become candidates
        ↓
2 workers accept
        ↓
Customer chooses one
        ↓
Booking created
```

The request describes **demand**.

The booking represents **commitment between customer and worker**.

Therefore:

```text
ServiceRequest ≠ Booking
```

This separation is fundamental.

---

# 16. Worker Match

A match represents the relationship between:

```text
Service Request
        +
Potential Worker
```

Example:

```text
Request #1001

Potential workers:

Worker A → 1.2 km
Worker B → 2.1 km
Worker C → 3.4 km
Worker D → 4.2 km
```

The match record can preserve information such as:

```text
request_id
worker_id
distance
match_score
match_reason
status
created_at
responded_at
```

Possible match states:

```text
OFFERED
VIEWED
ACCEPTED
REJECTED
EXPIRED
WITHDRAWN
```

---

# 17. Why Match Must Be Its Own Domain Concept

We should not simply put:

```text
worker_id
```

inside `service_requests`.

Because the platform may eventually consider many workers.

```text
Request
   │
   ├── Match → Worker A
   ├── Match → Worker B
   ├── Match → Worker C
   └── Match → Worker D
```

This gives us:

* matching history
* worker responses
* response time
* ranking data
* rejection reasons
* matching analytics

It also prepares the system for future matching improvements.

---

# 18. Booking

Booking represents a confirmed commitment between customer and worker.

Conceptually:

```text
Customer
    │
    └── Booking ─── Worker
                      │
                      ▼
                     Job
```

A booking contains things such as:

```text
customer
worker
service_request
scheduled_time
status
created_at
confirmed_at
cancelled_at
```

---

# 19. Booking Lifecycle

Initial proposal:

```text
PENDING
   │
   ▼
CONFIRMED
   │
   ├────────► CANCELLED
   │
   ▼
COMPLETED
```

Potential expiration:

```text
PENDING
   │
   ▼
EXPIRED
```

The exact booking flow will be finalized after we define the marketplace interaction rules.

---

# 20. Job

A booking represents the commitment.

A job represents the **actual service execution**.

Example:

```text
Booking
  ↓
Worker travels
  ↓
Worker arrives
  ↓
Worker starts work
  ↓
Worker completes work
```

That execution is represented by `Job`.

---

# 21. Job Lifecycle

Recommended initial lifecycle:

```text
CONFIRMED
    │
    ▼
EN_ROUTE
    │
    ▼
ARRIVED
    │
    ▼
WORK_STARTED
    │
    ▼
WORK_COMPLETED
```

Exceptional states may include:

```text
CUSTOMER_NO_SHOW
WORKER_NO_SHOW
CANCELLED
DISPUTED
```

These should not be treated as random status changes.

The domain should explicitly model why the normal workflow stopped.

---

# 22. Why Booking and Job Are Separate

Consider:

```text
Booking:
Confirmed for 6:00 PM
```

But:

```text
Worker:
Arrived at 6:15 PM
```

and:

```text
Work:
Started at 6:20 PM
```

Those are execution facts.

Booking answers:

> "Did the customer and worker agree to this service?"

Job answers:

> "What happened while the service was being performed?"

Therefore:

```text
Booking ≠ Job
```

---

# 23. Additional Work

During a job, the worker may discover additional work.

Example:

```text
Original request:
Repair leaking tap

During inspection:
Pipe also needs replacement

Additional cost:
₹500
```

The worker should not silently add the charge.

Instead:

```text
Worker
   │
   ▼
Additional Work Request
   │
   ▼
Customer Approval
   │
   ├── APPROVED
   │
   └── REJECTED
```

Possible lifecycle:

```text
PROPOSED
   │
   ├──► APPROVED
   │
   └──► REJECTED
```

Potentially:

```text
PROPOSED → EXPIRED
```

---

# 24. Payment

Payment represents the financial transaction.

Payment must remain independent from job status.

Example:

```text
Job
WORK_COMPLETED

Payment
PENDING
```

This is possible and must be supported.

Similarly:

```text
Job
WORK_COMPLETED

Payment
SUCCESS
```

---

# 25. Payment Lifecycle

Initial conceptual lifecycle:

```text
INITIATED
    │
    ▼
PENDING
    │
    ├────────► FAILED
    │
    ▼
SUCCESS
    │
    ├────────► PARTIALLY_REFUNDED
    │
    └────────► REFUNDED
```

The actual provider-specific states should be mapped into our internal payment states.

The database should not become dependent on Stripe/Paystack-specific status names.

---

# 26. Review

A review represents feedback about a completed service.

Example:

```text
Customer
   │
   ▼
Review
   │
   ├── Rating: 5
   └── Comment
```

Review eligibility should generally require a completed job.

```text
Job = WORK_COMPLETED
        ↓
Review Eligible
```

A review should reference the actual transaction/job rather than simply:

```text
customer_id → worker_id
```

This prevents arbitrary reviews.

---

# 27. Reputation

Reputation is broader than a rating.

A worker's professional reputation could eventually incorporate:

```text
Completed Jobs
Customer Ratings
Reviews
Repeat Customers
Cancellation History
No-Shows
Disputes
Verification
Experience
```

Therefore:

```text
Rating ≠ Reputation
```

A worker with:

```text
4.8 rating
```

is not adequately represented by that one number alone.

For the first version, we can keep reputation relatively simple while preserving the underlying events and history needed to improve it later.

---

# 28. Dispute

A dispute represents a formal disagreement concerning a job or transaction.

Examples:

```text
Customer:
"Work was incomplete."

Customer:
"Worker damaged my property."

Worker:
"Customer refused to pay."

Customer:
"Additional charge was unauthorized."
```

A dispute should reference the relevant business transaction.

---

# 29. Dispute Lifecycle

Initial lifecycle:

```text
OPEN
  │
  ▼
UNDER_REVIEW
  │
  ▼
RESOLVED
```

Resolution outcome:

```text
CUSTOMER_FAVOUR
WORKER_FAVOUR
PARTIAL
NO_ACTION
```

These are **resolution outcomes**, not political or evaluative rankings of users.

Evidence may include:

```text
Job information
Photos
Messages
Payment records
Additional work requests
Timestamps
Worker response
Customer response
```

---

# 30. Notification

Notification is a supporting domain.

Examples:

```text
Worker accepted request
Booking confirmed
Worker en route
Worker arrived
Additional work requested
Payment successful
Booking cancelled
Dispute updated
```

Notification should be asynchronous wherever possible.

Important principle:

> Notification failure should not normally cause the underlying business transaction to fail.

For example:

```text
Booking confirmed
       │
       ├── Database transaction succeeds
       │
       └── Notification attempted asynchronously
```

If SMS fails, the booking should not roll back.

---

# 31. Audit Event

Important administrative and sensitive operations should produce audit records.

Examples:

```text
Worker suspended
Worker verification approved
Payment refunded
Dispute resolved
Admin changed booking
```

Audit records should preserve:

```text
actor
action
target
timestamp
reason
metadata
```

Audit history should generally be append-only.

---

# 32. Domain Relationship Summary

The conceptual relationship is:

```text
User
 │
 ├────────────── Customer
 │                   │
 │                   └── Addresses
 │
 └────────────── Worker
                     │
                     ├── Skills
                     ├── Verifications
                     ├── Availability
                     └── Service Areas


Customer
   │
   ▼
Service Request
   │
   ├──── Match ───── Worker
   │
   ▼
Booking
   │
   ▼
Job
   │
   ├── Additional Work
   ├── Payment
   ├── Review
   └── Dispute
```

---

# 33. State Machine Principle

We should avoid one giant status machine.

Bad design:

```text
status =
REQUESTED
MATCHING
ACCEPTED
BOOKED
EN_ROUTE
ARRIVED
WORKING
PAYMENT_PENDING
COMPLETED
CANCELLED
REFUNDED
DISPUTED
```

This mixes completely different lifecycles.

Instead:

```text
Service Request Status
        ↓
Booking Status
        ↓
Job Status
        ↓
Payment Status
        ↓
Dispute Status
```

Each domain object owns its own lifecycle.

---

# 34. Service Request State Machine

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
                    ▼
             ┌─────────────┐
             │  MATCHING   │
             └──────┬──────┘
                    │
             ┌──────┴──────┐
             │             │
             ▼             ▼
      MATCH_FOUND     FAILED_TO_MATCH
             │
             ▼
          BOOKED
             │
             ▼
        COMPLETED
```

Cancellation/expiration can terminate the request where business rules permit.

---

# 35. Match State Machine

```text
OFFERED
   │
   ├──────────────► REJECTED
   │
   ├──────────────► EXPIRED
   │
   ▼
VIEWED
   │
   ▼
ACCEPTED
```

A match should also be capable of being withdrawn when another worker has already been confirmed.

---

# 36. Booking State Machine

```text
PENDING
   │
   ├──────────► EXPIRED
   │
   ├──────────► CANCELLED
   │
   ▼
CONFIRMED
   │
   ├──────────► CANCELLED
   │
   ▼
COMPLETED
```

The exact relationship between booking completion and job completion will be finalized during implementation design.

---

# 37. Job State Machine

```text
CONFIRMED
    │
    ▼
EN_ROUTE
    │
    ▼
ARRIVED
    │
    ▼
WORK_STARTED
    │
    ▼
WORK_COMPLETED
```

Exceptional paths:

```text
CONFIRMED ─────► WORKER_NO_SHOW

CONFIRMED ─────► CUSTOMER_NO_SHOW

CONFIRMED ─────► CANCELLED
```

---

# 38. Additional Work State Machine

```text
PROPOSED
   │
   ├────────► APPROVED
   │
   └────────► REJECTED
```

Only approved additional work should become part of the billable service amount.

---

# 39. Payment State Machine

```text
INITIATED
    │
    ▼
PENDING
    │
    ├────────► FAILED
    │
    ▼
SUCCESS
    │
    ├────────► REFUNDED
    │
    └────────► PARTIALLY_REFUNDED
```

Provider webhooks may cause transitions.

Those transitions must be idempotent.

---

# 40. Review Lifecycle

A review can be modeled more simply:

```text
ELIGIBLE
   │
   ▼
SUBMITTED
   │
   ▼
PUBLISHED
```

Potential future moderation:

```text
SUBMITTED
   │
   ├──► PUBLISHED
   │
   └──► HIDDEN
```

The original review record should remain preserved.

---

# 41. Dispute State Machine

```text
OPEN
 │
 ▼
UNDER_REVIEW
 │
 ▼
RESOLVED
```

A resolved dispute should not silently modify historical job/payment records.

If a refund is required, it should happen through the payment domain.

---

# 42. Important Invariants

These are rules that should always remain true.

### Invariant 1 — One user identity

A person's account identity should not be duplicated merely because they have multiple roles.

---

### Invariant 2 — One confirmed worker per booking

For the MVP:

```text
Booking
   ↓
exactly one confirmed worker
```

---

### Invariant 3 — Request ≠ Booking

A service request may exist without a booking.

---

### Invariant 4 — Booking ≠ Job

A booking can exist before actual execution.

---

### Invariant 5 — Job ≠ Payment

A completed job does not automatically mean payment is successful.

---

### Invariant 6 — Review requires eligible transaction

Reviews should be tied to an eligible completed job.

---

### Invariant 7 — Additional charges require authorization

A worker should not be able to silently increase the customer's payable amount.

---

### Invariant 8 — Historical transactions are preserved

Deactivating a user or worker must not delete:

```text
Jobs
Payments
Reviews
Disputes
Audit records
```

---

### Invariant 9 — State transitions must be valid

The API must not allow:

```text
WORK_COMPLETED
       ↓
EN_ROUTE
```

or:

```text
CANCELLED
       ↓
CONFIRMED
```

unless a deliberately designed business process explicitly supports it.

---

### Invariant 10 — Concurrent operations must be safe

Two workers may attempt to accept the same request simultaneously.

The system must guarantee that the final confirmed booking does not accidentally contain two workers.

This will be addressed through database-level concurrency control.

---

# 43. Entity vs Value Object vs Event

Not every concept needs to be an entity.

### Entity

Has identity and lifecycle.

Examples:

```text
User
Worker
Customer
ServiceRequest
Booking
Job
Payment
Dispute
Review
```

### Value Object

Defined primarily by its values.

Examples:

```text
Money
Address
GeoPoint
TimeRange
PhoneNumber
```

For example:

```text
Money
amount = 500
currency = INR
```

The important thing is the value, not a separate identity.

### Domain Event

Represents something that happened.

Examples:

```text
ServiceRequestSubmitted
WorkerMatched
BookingConfirmed
WorkerArrived
JobCompleted
PaymentSucceeded
ReviewSubmitted
DisputeOpened
```

Events are especially useful for asynchronous workflows.

---

# 44. Aggregate Boundaries

We should not make every table its own aggregate.

A useful initial conceptual approach is:

```text
User Aggregate
    └── identity

Worker Aggregate
    ├── professional profile
    ├── worker skills
    └── worker configuration

Service Request Aggregate
    └── request lifecycle

Booking Aggregate
    └── booking lifecycle

Job Aggregate
    ├── execution lifecycle
    └── additional work

Payment Aggregate
    └── payment lifecycle

Dispute Aggregate
    └── dispute lifecycle
```

The exact aggregate boundaries will be refined during implementation.

The purpose is to establish **transactional ownership**.

---

# 45. Domain Events

Important events can eventually look like:

```text
UserRegistered
WorkerProfileCreated
WorkerVerified
WorkerAvailabilityChanged

ServiceRequestSubmitted
ServiceRequestMatched
ServiceRequestExpired
ServiceRequestCancelled

WorkerAcceptedMatch
WorkerRejectedMatch

BookingCreated
BookingConfirmed
BookingCancelled

WorkerEnRoute
WorkerArrived
WorkStarted
WorkCompleted

AdditionalWorkProposed
AdditionalWorkApproved
AdditionalWorkRejected

PaymentInitiated
PaymentSucceeded
PaymentFailed
PaymentRefunded

ReviewSubmitted
DisputeOpened
DisputeResolved
```

These events should initially remain **internal application/domain events**.

We do not need Kafka simply because events exist.

---

# 46. Business Flow Using Domain Objects

A complete normal transaction becomes:

```text
CUSTOMER
   │
   │ creates
   ▼
SERVICE REQUEST
   │
   │ matching
   ▼
MATCHES
   │
   │ worker accepts / customer selects
   ▼
BOOKING
   │
   │ service starts
   ▼
JOB
   │
   ├── Additional Work
   │
   └── Completion
           │
           ▼
        PAYMENT
           │
           ▼
         REVIEW
```

If something goes wrong:

```text
JOB
 │
 └────► DISPUTE
```

This is the central business lifecycle of the entire platform.

---

# 47. What We Should NOT Model Yet

The following should remain future concepts unless requirements force them into MVP:

```text
Worker Loans
Worker Insurance
Training Marketplace
Equipment Marketplace
Subscriptions
Dynamic Pricing
AI Matching
AI Customer Support
Accounting Platform
Worker Payroll
Multi-city Marketplace
Corporate Workforce Management
```

The domain model should remain extensible without prematurely implementing these concepts.

---

# 48. Proposed Initial Domain Modules

Based on this domain model, the application can eventually contain:

```text
identity
customer
worker
catalog
service-request
matching
booking
job
payment
review
dispute
notification
admin
```

With supporting infrastructure:

```text
shared
security
storage
messaging
```

These module boundaries will be validated against the ERD in [archive/02](02-erd-and-postgis-database-design.md).

---

# 49. Domain Design Principles

The following principles should guide implementation.

### Principle 1

**Business concepts own their lifecycle.**

### Principle 2

**Do not combine unrelated state machines.**

### Principle 3

**Historical business facts should be preserved.**

### Principle 4

**External provider states must be mapped into internal domain states.**

### Principle 5

**Business rules should not live in controllers.**

### Principle 6

**Database entities should not automatically become domain models.**

### Principle 7

**Do not use generic `status` fields to represent unrelated concepts.**

### Principle 8

**Concurrency-sensitive operations require transactional protection.**

### Principle 9

**The platform should preserve enough history to explain what happened.**

### Principle 10

**Design today's domain so tomorrow's service extraction remains possible, without building microservices prematurely.**

---

# 50. Open Domain Decisions

The following should remain explicitly open before implementation.

### Matching

* How many workers receive a request?
* Does the first worker to accept automatically get the job?
* Does the customer choose from candidates?
* How long does a worker have to respond?
* How is ranking calculated?
* What happens when nobody accepts?

### Booking

* Who confirms the booking?
* Can the worker propose another time?
* Can the customer reschedule?
* How many reschedules are allowed?

### Pricing

* Fixed price?
* Worker quote?
* Customer-defined budget?
* Platform-estimated price?
* Negotiation?

### Payment

* Pay before service?
* Pay after service?
* Authorization/hold?
* Cash support?
* Partial payment?
* Refund policy?

### Trust

* What verification is mandatory?
* What constitutes a verified skill?
* Are certifications required for some categories?

### Reputation

* How should no-shows affect reputation?
* How should cancellations affect reputation?
* How should disputes affect reputation?
* Should repeat customers contribute to reputation?

These are product/business decisions, not assumptions we should silently hard-code.

---

# 51. Final Domain Model

The current conceptual model is:

```text
                           ┌───────────────┐
                           │     USER      │
                           └───────┬───────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
             ┌──────▼──────┐               ┌──────▼──────┐
             │  CUSTOMER   │               │   WORKER    │
             └──────┬──────┘               └──────┬──────┘
                    │                              │
                    │                              ├── Skills
                    │                              ├── Verification
                    │                              ├── Availability
                    │                              └── Service Area
                    │
                    │
                    ▼
           ┌──────────────────┐
           │ SERVICE REQUEST  │
           └────────┬─────────┘
                    │
                    ▼
           ┌──────────────────┐
           │      MATCH       │
           └────────┬─────────┘
                    │
                    ▼
           ┌──────────────────┐
           │     BOOKING      │
           └────────┬─────────┘
                    │
                    ▼
           ┌──────────────────┐
           │       JOB        │
           └───────┬──────────┘
                   │
          ┌────────┼──────────┐
          │        │          │
          ▼        ▼          ▼
   Additional   Payment    Review
      Work
                   │
                   ▼
                Dispute
```

This is the **domain foundation** for the project.

The next document should turn this conceptual model into the actual relational design:

```text
this document
Domain Model
     ↓
archive/02
ERD & Database Design
     ↓
architecture/01
Architecture
     ↓
architecture/02
Production Project Structure
     ↓
archive/03
API Specification
```
