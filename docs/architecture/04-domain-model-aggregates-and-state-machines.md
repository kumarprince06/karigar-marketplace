# Domain Model, Aggregates & State Machines

**Project:** Karigar Marketplace
**Status:** Draft for Product/Engineering Review
**Architecture:** Java + Spring Boot Modular Monolith
**Database:** PostgreSQL + PostGIS
**Primary Goal:** Define domain behavior before implementation

---

## Current Model (aligned with ERD and ADRs)

The ERD ([architecture/03](../architecture/03-erd-and-production-database-design.md)) is the source of truth. Where this document disagrees, the ERD wins.

* **User** — email + password login for MVP, phone OTP later ([ADR 0016](../adr/0016-email-password-login-phone-otp-later.md)); `email` unique case-insensitive, `phone` unique E.164, `preferred_locale`. ERD §7.
* **Worker** — `account_status` ONBOARDING | ACTIVE | SUSPENDED | DEACTIVATED; many trades (`worker_professions`: one primary, experience per trade); rates per trade (`worker_rates`: VISIT | HOURLY | HALF_DAY | DAILY | PER_UNIT | MINIMUM, history kept). Trades grouped in `trade_categories`; names from `*_translations`, resolved by the backend. ERD §10–14.2.
* **Verification** — PENDING → IN_REVIEW → VERIFIED | REJECTED; VERIFIED → EXPIRED | REVOKED; history in `worker_verification_events`. ERD §15–16.
* **Address** — saved service location in the customer's address book (`address_for` SELF | FAMILY | RELATIVE | TENANT | BUSINESS | OTHER, on-site contact name/phone); must be saved before booking. `service_zones` gate where requests are allowed. ERD §22–23.1.
* **ServiceRequest** — `addressId` + address snapshot; urgency NOW | TODAY | SCHEDULED; selected common problems. Status DRAFT, SUBMITTED, MATCHING, AWAITING_SELECTION, BOOKED, COMPLETED, CANCELLED, EXPIRED, FAILED_TO_MATCH. ERD §25–29, §34.1.
* **WorkerMatch** — customer picks the worker ([ADR 0017](../adr/0017-customer-picks-the-worker.md)): NOTIFIED → VIEWED → ACCEPTED → SELECTED | NOT_SELECTED, plus DECLINED, EXPIRED, WITHDRAWN; up to 3 shortlisted; selection creates the booking. ERD §32–34.2.
* **Booking** — SINGLE_VISIT | MULTI_DAY; agreed rate snapshot; `helper_count`; `payment_schedule` ON_COMPLETION | DAILY | WEEKLY | MILESTONE; one live booking per request. ERD §35–38.
* **Job** — SCHEDULED, IN_PROGRESS, ON_HOLD, WORK_COMPLETED, COMPLETED, CANCELLED. **JobVisit** (≥1 per job, one per day/trip): SCHEDULED → EN_ROUTE → ARRIVED → IN_PROGRESS → DONE, plus WORKER_NO_SHOW, CUSTOMER_NO_SHOW, RESCHEDULED, CANCELLED; check-in with a 4-digit start code; per-visit amounts; no overlapping visits per worker. ERD §39–40.1.
* **Quote** — INITIAL | REVISION | ADDITIONAL with line items (LABOUR, MATERIAL, HELPER, VISIT_CHARGE, TRANSPORT, DISCOUNT, OTHER); DRAFT (not used in MVP, LLD-017), SUBMITTED, ACCEPTED, REJECTED, EXPIRED, SUPERSEDED, WITHDRAWN; immutable after submit. Additional work is an ADDITIONAL quote. ERD §41–41.1.
* **Money** — integer paise ([ADR 0006](../adr/0006-money-integer-minor-units.md)); may be negative (discounts, adjustments); overflow-safe arithmetic. ERD §42.
* **Payment** — method UPI | CARD | NETBANKING | WALLET | CASH, `purpose`, `collected_by`; CREATED, PENDING, SUCCEEDED, FAILED, CANCELLED. **Refund** — REQUESTED, PROCESSING, SUCCEEDED, FAILED. Earnings, payouts, ledger and invoices: ERD §43–46.4.

---

# 1. Purpose

Previous documents established:

```text
Product Vision
      ↓
User Journeys
      ↓
Functional Requirements
      ↓
Business Rules
      ↓
Architecture
      ↓
Project Structure
      ↓
Database Design
      ↓
REST API
      ↓
Application Use Cases
```

This document defines the **business domain itself**.

It answers:

* What does each domain object represent?
* Who owns it?
* What can change?
* What must never change?
* What operations are allowed?
* What states can it enter?
* Which transitions are legal?
* Which object is responsible for enforcing each rule?
* Which events are generated?
* Which objects should belong to the same aggregate?

The objective is to prevent the implementation from becoming a collection of CRUD entities.

---

# 2. Domain Modeling Principle

The central principle is:

> The domain model should represent business behavior, not merely database structure.

A database table might contain:

```text
status
```

but the domain should contain meaningful operations:

```text
booking.confirm()
booking.cancel()
booking.reschedule()
```

Similarly, instead of:

```java
job.setStatus(IN_PROGRESS);
```

the domain should expose:

```java
job.start();
```

The domain object then controls whether the operation is valid.

---

# 3. Core Domain Concepts

The initial domain consists of:

```text
Identity
 ├── User
 ├── Customer
 └── Worker

Worker Capability
 ├── Trade Category / Profession (trade)
 ├── Worker Profession (trade + experience, one primary)
 ├── Worker Rate (per trade)
 ├── Skill
 ├── Verification
 ├── Availability
 └── Service Area

Service Lifecycle
 ├── Service Request
 ├── Worker Match
 ├── Booking
 ├── Job
 ├── Job Visit
 └── Quote (incl. additional work as ADDITIONAL quote)

Financial Lifecycle
 ├── Payment
 └── Refund

Trust Lifecycle
 ├── Review
 ├── Dispute
 └── Audit Event

Supporting
 ├── Address (saved service location)
 ├── Service Zone
 ├── Attachment
 └── Notification
```

---

# 4. Entity vs Value Object vs Aggregate

We need three important concepts.

## Entity

An object with a stable identity.

Examples:

```text
User
Worker
Customer
ServiceRequest
Booking
Job
Payment
Review
Dispute
```

Two entities may contain identical data but still be different because their IDs differ.

---

## Value Object

An object defined by its value rather than identity.

Examples:

```text
Money
GeoPoint
AddressSnapshot
PhoneNumber
TimeRange
Currency
```

If two `Money` objects both represent:

```text
500 INR
```

they are equivalent by value.

---

## Aggregate

A consistency boundary.

An aggregate defines:

> Which objects must be changed together under one business transaction and which object controls those changes?

The aggregate root is the entry point.

---

# 5. Proposed Aggregate Boundaries

Initial proposal:

```text
User Aggregate
Worker Aggregate
Customer Aggregate
ServiceRequest Aggregate
Booking Aggregate
Job Aggregate
Payment Aggregate
Review Aggregate
Dispute Aggregate
```

Some supporting concepts remain independent/reference data:

```text
Profession
Skill
Notification
AuditEvent
```

The exact aggregate boundaries can evolve during implementation.

---

# 6. Why Aggregate Boundaries Matter

Suppose:

```text
Booking
 ├── Worker
 ├── Customer
 ├── ServiceRequest
 └── Job
```

If we model all of them as one giant object, every operation becomes expensive and highly coupled.

Instead:

```text
Booking
   │
   ├── references Worker
   ├── references Customer
   └── references ServiceRequest

Job
   │
   └── references Booking
```

Each aggregate maintains its own consistency rules.

---

# 7. User

`User` represents the authenticated identity.

Core information:

```text
id
email              (login; unique, case-insensitive)
passwordHash
emailVerifiedAt
phone              (unique, E.164; verified later via OTP)
preferredLocale
status
createdAt
updatedAt
```

Login is email + password in the MVP; phone OTP is added later ([ADR 0016](../adr/0016-email-password-login-phone-otp-later.md)).

Possible statuses:

```text
ACTIVE
SUSPENDED
DEACTIVATED
```

A user may have one or more roles.

Initial roles:

```text
CUSTOMER
WORKER
ADMIN
```

Role and profile are different concepts.

---

# 8. User Invariants

Examples:

```text
email must be unique (case-insensitive)
phone must be unique and in E.164 format
email must be verified before protected operations
phone verification (OTP) applies only once SMS is available
deactivated users cannot authenticate normally
suspended users cannot perform restricted operations
```

The `User` entity should not contain:

```text
worker rating
worker skills
service request
booking
payment
```

Those belong to their respective domains.

---

# 9. Customer

A `Customer` represents the customer-side profile of a user.

Relationship:

```text
User
  │
  └── Customer Profile
```

Possible fields:

```text
customerId
userId
displayName
profileImage
createdAt
updatedAt
```

Customer owns:

```text
Service Requests
Addresses
Customer-side Booking access
Reviews written
Disputes created
```

---

# 10. Customer Invariants

Examples:

```text
Customer must belong to an existing User.
A User cannot have multiple customer profiles.
Only the customer can manage their private addresses.
A customer can only access their own service requests.
```

---

# 11. Worker

The `Worker` is one of the most important domain objects.

A worker represents a skilled professional offering services through the platform.

Possible fields:

```text
workerId
userId
professions      (one primary; each with experienceYears)
rates            (per profession: VISIT / HOURLY / HALF_DAY / DAILY / PER_UNIT / MINIMUM)
displayName
description
status
createdAt
updatedAt
```

Worker status:

```text
ONBOARDING
ACTIVE
SUSPENDED
DEACTIVATED
```

Verification progress is tracked separately (`verification_status` summary: UNVERIFIED | PARTIAL | VERIFIED).

---

# 12. Worker Is Not Availability

These concepts must remain separate.

```text
Worker
   ≠
Availability
```

A worker may exist and be verified but currently not accept jobs.

Example:

```text
Worker status = ACTIVE
Accepting jobs = false
```

This is completely valid.

---

# 13. Worker Capabilities

Worker capability comes from:

```text
Professions (trades) + rates
+
Skills
+
Verification
+
Service Area
+
Availability
```

Example:

```text
Professions:
Electrician (primary, 8 years)
AC technician (3 years)

Rates:
Electrician — VISIT ₹200, PER_UNIT ₹150 / POINT, MINIMUM ₹300
AC technician — VISIT ₹300

Skills (Electrician):
- Switchboard repair
- Wiring
- Fan installation
- MCB replacement

Service area:
5 km around configured location
```

---

# 14. Worker Aggregate Responsibilities

The worker aggregate should control worker-specific behavior such as:

```text
activate()
suspend()
deactivate()
updateProfile()
addProfession()
setPrimaryProfession()
changeRate()
addSkill()
removeSkill()
enableJobAcceptance()
disableJobAcceptance()
```

It should not control:

```text
booking.confirm()
job.complete()
payment.refund()
```

Those belong to their own aggregates.

---

# 15. Worker Invariants

Examples:

```text
Worker must belong to a valid user.
Every trade must exist; exactly one trade is primary.
Experience is per trade, between 0 and 60 years.
A rate change closes the current rate and adds a new one (history kept).
Suspended worker cannot accept new jobs.
Deactivated worker cannot accept new jobs.
Worker can only claim skills from a trade they have registered.
Worker must satisfy the mandatory verifications for a trade before receiving jobs in it.
```

---

# 16. Profession

Profession is reference/catalog data.

Examples:

```text
Electrician
Plumber
```

A profession can have:

```text
id
code
categoryId        (trade_categories)
defaultRateType
active
```

Names and descriptions come from `profession_translations`, resolved by the backend from the user's locale.

The initial product intentionally starts with a small number of professions.

---

# 17. Skill

Skill represents a specific capability.

Examples:

```text
Electrical wiring
Fan installation
Switch repair
Pipe leakage repair
Tap installation
Water tank connection
```

Skills belong to a profession.

For example:

```text
Electrician
 ├── Wiring
 ├── Fan Installation
 ├── Switch Repair
 └── MCB Replacement
```

---

# 18. Worker Skill Relationship

A worker can have many skills.

A skill can belong to many workers.

Therefore:

```text
Worker
   │
   ├── WorkerSkill
   ├── WorkerSkill
   └── WorkerSkill
```

Database relationship:

```text
workers
    │
    └── worker_skills
             │
             └── skills
```

Duplicate worker-skill relationships must be prevented.

---

# 19. Verification

Verification is deliberately separate from worker registration.

A worker can register without necessarily being fully verified.

Possible verification types:

```text
EMAIL
PHONE                (later phase)
AADHAAR_EKYC
PAN
POLICE_VERIFICATION
SKILL_CERTIFICATE    (per trade)
ELECTRICAL_LICENSE   (per trade)
SELFIE_MATCH
BANK_ACCOUNT
```

Which checks are mandatory per trade is data (`verification_requirements`).

Initial MVP may use only the verification methods actually required by the product.

---

# 20. Verification State Machine

```text
PENDING
     ↓
IN_REVIEW
     ├──────────────► VERIFIED
     │                   ├──► EXPIRED   (expires_on passed)
     │                   └──► REVOKED   (became invalid)
     │
     └──────────────► REJECTED
```

A resubmission after rejection is a new `PENDING` verification row; every status change is kept in `worker_verification_events`.

---

# 21. Verification Invariants

```text
Only authorized systems/admins can approve verification.
Rejected verification should preserve history.
Approval must have an audit trail.
Revocation must preserve previous verification history.
Sensitive verification documents must not be publicly exposed.
```

---

# 22. Worker Availability

Availability represents whether a worker can currently receive work.

Minimum concept:

```text
acceptingJobs
```

Future model may include:

```text
working schedule
days
time ranges
temporary unavailability
leave
maximum concurrent jobs
```

The MVP should avoid unnecessarily complex scheduling.

---

# 23. Service Area

A worker may define a service area.

Initial model:

```text
center point
+
radius
```

Example:

```text
Center:
22.58, 88.31

Radius:
5,000 meters
```

This works well with PostGIS.

Later the model could support:

```text
polygon
multiple areas
locality-based coverage
dynamic travel distance
```

without changing the entire domain.

---

# 24. Address

An `Address` is a saved service location in the customer's address book — not necessarily the customer's own home. It records whose place it is (`addressFor`: SELF | FAMILY | RELATIVE | TENANT | BUSINESS | OTHER) and the on-site contact name/phone (required unless SELF). An address must be saved before booking; its `serviceZone` decides whether requests are allowed there.

However, a service request should preserve its own location snapshot.

Why?

Because:

```text
Customer changes Home address
        ↓
Old service request
        ↓
Must still point to historical job location
```

Therefore:

```text
Address
```

and:

```text
ServiceRequestLocation (address snapshot)
```

are separate concepts.

---

# 25. GeoPoint Value Object

A geographic point can be represented conceptually as:

```java
public record GeoPoint(
    double latitude,
    double longitude
) {}
```

Domain validation:

```text
latitude ∈ [-90, 90]
longitude ∈ [-180, 180]
```

The persistence representation will use PostGIS.

---

# 26. Service Request

The `ServiceRequest` represents customer demand.

It is one of the central aggregates.

It answers:

> What service does the customer need, where, and when?

Possible information:

```text
requestId
customerId
professionId
description           (optional when problems are selected)
selectedProblemIds    (common_problems)
addressId             (saved address)
serviceZoneId
addressSnapshot       (location, addressText, landmark, pincode, property/floor/lift, addressFor, contact)
preferredStartAt / preferredEndAt
urgency               (NOW | TODAY | SCHEDULED)
selectedWorkerId
status
expiresAt
createdAt
updatedAt
```

---

# 27. Service Request State Machine

Initial proposal:

```text
DRAFT
  ↓
SUBMITTED
  ↓
MATCHING             (workers being notified)
  ↓
AWAITING_SELECTION   (at least one worker accepted; customer to pick)
  ↓
BOOKED               (customer picked a worker)
  ↓
COMPLETED
```

Alternative terminal states:

```text
CANCELLED
FAILED_TO_MATCH
EXPIRED
```

Graphically:

```text
                    ┌───────────────┐
                    │               ▼
DRAFT → SUBMITTED → MATCHING → AWAITING_SELECTION → BOOKED → COMPLETED
                    │              │
                    │              └──────→ CANCELLED
                    │
                    ├──────────────→ FAILED_TO_MATCH
                    │
                    └──────────────→ EXPIRED

SUBMITTED/MATCHING/AWAITING_SELECTION/BOOKED
        │
        └──────────────→ CANCELLED
```

Exact transition rules will be finalized with product decisions.

---

# 28. Service Request Invariants

Examples:

```text
description, a voice note or at least one selected problem is required
selected problems must belong to the request's trade
profession must be active
address must be saved before booking; the snapshot is copied at creation
service zone must be ACTIVE
scheduled time must satisfy scheduling rules
cancelled request cannot become booked
completed request cannot return to matching
```

The request should preserve its historical location.

---

# 29. Service Request Behavior

Possible domain methods:

```java
request.submit();
request.startMatching();
request.markAwaitingSelection();
request.book(selectedWorkerId);
request.cancel(reason);
request.markFailedToMatch();
request.expire();
request.complete();
```

Not every transition necessarily needs to be directly exposed to external callers.

Some transitions may be driven internally by application workflows.

---

# 30. Worker Match

A `WorkerMatch` represents the relationship between:

```text
Service Request
        +
Worker
```

It answers:

> Is this worker a candidate for this particular request, and what happened to that candidate relationship?

Possible data:

```text
matchId
serviceRequestId
workerId
roundNo
source                 (MATCHING | FAVOURITE)
distanceMeters
rankingScore
offeredVisitCharge     (Money)
etaMinutes / availableFrom
declineReasonCode
status
notifiedAt / viewedAt / respondedAt / expiresAt
```

---

# 31. Worker Match State Machine

The customer picks the worker ([ADR 0017](../adr/0017-customer-picks-the-worker.md)):

```text
NOTIFIED → VIEWED → ACCEPTED → SELECTED        (customer picked this worker → booking created)
                         └──→ NOT_SELECTED     (customer picked someone else)
         └─────────→ DECLINED / EXPIRED
ACCEPTED → WITHDRAWN                           (worker pulls out before the customer picks)
```

Up to 3 accepted workers are shown on the customer's shortlist. At most one match per request can be `SELECTED`.

---

# 32. Important Match Rule

A worker declining a match does not automatically mean:

```text
Worker is unreliable
```

Possible reasons:

```text
TOO_FAR
BUSY
WRONG_SKILL
SCHEDULE_CONFLICT
NOT_INTERESTED
OTHER
```

Decline data may be useful operationally but should not automatically damage reputation.

---

# 33. Booking

A `Booking` represents a confirmed service arrangement.

It answers:

> Which worker and customer have agreed to this service engagement?

Possible fields:

```text
bookingId
serviceRequestId
customerId
workerId
professionId
bookingType            (SINGLE_VISIT | MULTI_DAY)
scheduledStartAt / scheduledEndAt
plannedDays            (MULTI_DAY only)
agreedRate             (snapshot: rateType, unit, amount — never a FK to worker_rates)
helperCount / helperDayRate
paymentSchedule        (ON_COMPLETION | DAILY | WEEKLY | MILESTONE)
status
cancellation details
createdAt
updatedAt
```

A booking is created only when the customer selects an accepted worker.

---

# 34. Booking State Machine

Initial:

```text
CONFIRMED   (created by the customer's selection)
   ├──────────────→ CANCELLED
   │
   └──────────────→ COMPLETED
```

Rescheduling changes visit times, not the booking status. There is no `PENDING` booking: the worker already accepted before the customer selected.

---

# 35. Booking Invariants

Examples:

```text
Booking must reference an existing service request.
Customer must belong to the service request.
Worker must be eligible.
Only one live booking per service request (enforced by a partial unique index).
Cancelled booking cannot become confirmed again.
Booking cannot be completed without appropriate job completion.
```

The database should reinforce critical invariants wherever possible.

---

# 36. Booking Behavior

Possible methods:

```java
Booking.fromSelection(match, agreedRate, ...);   // created CONFIRMED
booking.cancel(reason);
booking.reschedule(newTime);
booking.complete();
```

A booking should not expose arbitrary:

```java
setStatus(...)
```

to application code.

---

# 37. Job

The `Job` represents actual service execution.

This distinction is extremely important.

```text
Booking
    =
commercial/service arrangement

Job
    =
actual execution
```

A booking can exist before work begins.

Every job has one or more **JobVisits** — one per working day or trip. A fan repair has one visit; plastering a wall over three days has three. Arrival, check-in, attendance and per-visit amounts live on the visit, not on the job.

---

# 38. Job State Machine

Job (whole piece of work):

```text
SCHEDULED        (booking confirmed, no visit started)
    ↓
IN_PROGRESS      (at least one visit started)
    ⇅
ON_HOLD          (waiting for material, rain, customer away)
    ↓
WORK_COMPLETED   (worker marked complete, waiting for customer)
    ↓
COMPLETED        (customer confirmed)
```

Alternative terminal path:

```text
CANCELLED
```

JobVisit (one day or trip):

```text
SCHEDULED → EN_ROUTE → ARRIVED → IN_PROGRESS → DONE
        ├── WORKER_NO_SHOW
        ├── CUSTOMER_NO_SHOW
        ├── RESCHEDULED
        └── CANCELLED
```

`ARRIVED → IN_PROGRESS` requires the 4-digit start code from the customer or site contact.

---

# 39. Job State Rules

Allowed:

```text
Job:   SCHEDULED → IN_PROGRESS → WORK_COMPLETED → COMPLETED
Job:   IN_PROGRESS ⇄ ON_HOLD
Visit: SCHEDULED → EN_ROUTE → ARRIVED → IN_PROGRESS → DONE
```

Disallowed:

```text
Job:   SCHEDULED → WORK_COMPLETED
Job:   COMPLETED → IN_PROGRESS
Job:   CANCELLED → IN_PROGRESS
Visit: WORKER_NO_SHOW → ARRIVED
Visit: ARRIVED → IN_PROGRESS without a valid start code
```

A worker cannot have two overlapping live visits (database exclusion constraint).

unless a specific business rule later allows an exception.

---

# 40. Job Behavior

```java
visit.markEnRoute();
visit.markArrived(location);
visit.checkIn(startCode);        // → IN_PROGRESS; first visit moves the job to IN_PROGRESS
visit.checkOut(workSummary);     // → DONE
visit.reportCustomerNoShow();
visit.reportWorkerNoShow();
visit.reschedule(newRange);

job.hold(reason);
job.resume();
job.markWorkCompleted();         // worker
job.confirmCompletion();         // customer → COMPLETED
job.cancel();
```

Every method validates the current state.

---

# 41. Additional Work (Quotes)

Additional work represents work discovered after the original service scope. It is modelled as a **Quote** of kind `ADDITIONAL` on the running job — the same pattern as every other price the customer must approve (`INITIAL` after inspection, `REVISION` replacing an earlier quote). There is no separate additional-work entity.

A quote has line items: LABOUR, MATERIAL, HELPER, VISIT_CHARGE, TRANSPORT, DISCOUNT (negative), OTHER.

Example:

```text
Original request:
Repair leaking tap

During work:
Worker discovers damaged valve

Additional work:
Replace valve — ₹850
```

The worker submits an `ADDITIONAL` quote.

The customer accepts or rejects it.

---

# 42. Quote State Machine

Quote states (all kinds). `DRAFT` is not used in MVP: a quote is created already `SUBMITTED` ([LLD-017](../lld/lld-017-quotes-additional-work-material.md)).

```text
DRAFT   (not used in MVP)
   ↓
SUBMITTED
   ├──────────────→ ACCEPTED
   ├──────────────→ REJECTED
   ├──────────────→ EXPIRED
   ├──────────────→ SUPERSEDED   (replaced by a REVISION)
   └──────────────→ WITHDRAWN
```

---

# 43. Quote and Additional Work Invariants

```text
Worker must be associated with the job.
Quote total must be non-negative (DISCOUNT lines are negative).
A quote is immutable once submitted; a change is a new REVISION.
Customer approval is required.
Accepted amount cannot be silently modified.
Rejected additional work cannot be charged.
```

---

# 44. Money Value Object

Money should not be represented as:

```java
double amount;
```

because floating-point arithmetic can introduce precision problems.

Conceptually:

```java
public record Money(
    long amountMinor,
    Currency currency
) {}
```

Example:

```text
₹500
=
50000 paise
```

Currency:

```text
INR
```

---

# 45. Money Invariants

```text
amountMinor may be negative (discount lines, ledger adjustments)
arithmetic is overflow-safe (Math.addExact / subtractExact)
currency must be valid
currency must not be null
```

Non-negativity is a rule of the thing being priced (payment amount > 0, quote total ≥ 0), not of `Money` itself.

Arithmetic should preserve currency compatibility.

For example:

```text
500 INR + 300 INR
```

is valid.

But:

```text
500 INR + 300 USD
```

requires explicit currency conversion/business handling.

---

# 46. Payment

Payment represents a financial transaction associated with a service.

Possible information:

```text
paymentId
jobId
customerId
workerId
purpose            (VISIT_CHARGE | MATERIAL_ADVANCE | DAILY_WAGE | MILESTONE | FINAL | ADDITIONAL)
method             (UPI | CARD | NETBANKING | WALLET | CASH)
collectedBy        (PLATFORM | WORKER — cash)
amount
currency
provider           (none for cash)
providerPaymentId
status
idempotencyKey
allocations        (which visits / quotes this payment covers)
createdAt
updatedAt
```

---

# 47. Payment State Machine

Initial:

```text
CREATED
    ↓
PENDING
    ├────────────→ SUCCEEDED
    ├────────────→ FAILED
    └────────────→ CANCELLED
```

Refunds do not change the payment status; refunded amounts are the sum of the payment's `Refund` rows. Cash becomes `SUCCEEDED` when the customer confirms it (or after a set time without objection).

The exact provider lifecycle may require additional internal states.

---

# 48. Payment Invariants

```text
Amount must be positive.
Provider payment ID must be unique.
Payment cannot be captured twice.
Refund cannot exceed captured amount.
Duplicate provider webhook cannot duplicate state transition.
Payment history must be preserved.
```

---

# 49. Refund

Refund is a separate entity because one payment may have multiple refunds.

Example:

```text
Payment = ₹1,000

Refund #1 = ₹300
Refund #2 = ₹200

Total refunded = ₹500
Remaining refundable = ₹500
```

Never overwrite the original payment amount.

---

# 50. Refund State Machine

```text
REQUESTED
    ↓
PROCESSING
    ├──────────→ SUCCEEDED
    │
    └──────────→ FAILED
```

Provider-specific states can be mapped into the platform's internal states.

---

# 51. Review

Review represents customer/worker feedback after an eligible job.

Core information:

```text
reviewId
jobId
reviewerId
revieweeId
rating
comment
createdAt
```

Rating:

```text
1–5
```

---

# 52. Review Invariants

```text
Job must be eligible for review.
Reviewer must belong to the job.
Reviewee must belong to the job.
Rating must be between 1 and 5.
Duplicate review rules must be enforced.
Historical reviews should not be silently rewritten.
```

---

# 53. Reputation

Rating and reputation are related but not identical.

A worker's reputation may eventually consider:

```text
customer reviews
completed jobs
repeat customers
cancellations
no-shows
verification
dispute history
```

The initial MVP should avoid creating a complicated proprietary reputation algorithm before enough real-world data exists.

The database should retain the underlying events needed to evolve it later.

---

# 54. Dispute

A dispute represents a disagreement requiring platform intervention.

Examples:

```text
Incomplete work
Damage
Wrong charge
Additional work disagreement
Payment problem
Worker no-show
Customer no-show
```

---

# 55. Dispute State Machine

```text
OPEN
  ↓
UNDER_REVIEW
  ├──────────────→ RESOLVED
  │
  └──────────────→ CLOSED
```

Possible resolution:

```text
CUSTOMER_FAVOUR
WORKER_FAVOUR
PARTIAL
NO_ACTION
```

The final resolution model can evolve.

---

# 56. Dispute Invariants

```text
Dispute must reference a valid job.
Only eligible participants can open a dispute.
Evidence belongs to the dispute.
Resolution requires authorized action.
Resolution must be audited.
Historical transaction data should not be silently overwritten.
```

---

# 57. Evidence

Evidence may include:

```text
photos
documents
messages
payment records
timestamps
job information
```

Evidence should be immutable after submission except through controlled correction mechanisms.

---

# 58. Notification

Notification is a supporting entity.

Possible types:

```text
SERVICE_REQUEST_CREATED
JOB_OFFER (worker notified)
WORKER_ACCEPTED (shortlist updated)
WORKER_NOT_SELECTED
BOOKING_CONFIRMED
BOOKING_CANCELLED
WORKER_EN_ROUTE
WORKER_ARRIVED
JOB_COMPLETED
PAYMENT_SUCCESS
PAYMENT_FAILED
DISPUTE_UPDATED
```

Notification delivery status is separate from the business event.

---

# 59. Notification State

Example:

```text
CREATED
   ↓
QUEUED
   ↓
SENT
   ├──────→ DELIVERED
   │
   └──────→ FAILED
```

A failed notification should not normally roll back the business operation that generated it.

---

# 60. Audit Event

Audit events represent important administrative/security actions.

Examples:

```text
Worker approved
Worker suspended
Payment refunded
Dispute resolved
User deactivated
Verification revoked
```

Audit events should contain:

```text
actor
action
resourceType
resourceId
timestamp
requestId
metadata
```

Audit history should be append-oriented.

---

# 61. Entity Ownership

Ownership should remain clear.

```text
User
 ├── Customer
 └── Worker

Customer
 └── ServiceRequest

ServiceRequest
 └── WorkerMatch

Booking
 └── Job

Job
 ├── JobVisit
 ├── Quote (ADDITIONAL) / MaterialBill
 ├── Payment
 ├── Review
 └── Dispute
```

This does not necessarily mean every child is physically embedded in the same JPA aggregate.

It describes business ownership.

---

# 62. Aggregate Ownership vs Database Foreign Keys

A foreign key does not automatically mean:

> These objects belong to the same aggregate.

For example:

```text
jobs.booking_id
```

means Job references Booking.

It does not mean the Booking aggregate should load the entire Job graph every time.

Keep aggregate boundaries aligned with consistency requirements.

---

# 63. Service Request Aggregate

Root:

```text
ServiceRequest
```

Controls:

```text
request lifecycle
request location snapshot
request details
```

References:

```text
customerId
professionId
addressId
serviceZoneId
selectedProblemIds
```

It should not directly own:

```text
Worker entity
Payment
Review
Dispute
```

---

# 64. Worker Aggregate

Root:

```text
Worker
```

May manage:

```text
worker profile
worker status
worker professions (trades, primary, experience)
worker rates (per trade, history kept)
availability state
```

References:

```text
User
Profession (catalog)
Skills
Verification
```

The implementation may separate some of these persistence models while retaining clear domain ownership.

---

# 65. Booking Aggregate

Root:

```text
Booking
```

Controls:

```text
confirmation
cancellation
rescheduling
booking state
```

References:

```text
customerId
workerId
serviceRequestId
```

It should not directly mutate:

```text
Payment
Review
Dispute
```

---

# 66. Job Aggregate

Root:

```text
Job
```

Controls:

```text
execution state
visits (arrival, start-code check-in, check-out, no-show, per-visit amounts)
hold / resume
completion
```

Quotes (including `ADDITIONAL` quotes) are their own aggregate and reference the job.

Payment remains separate.

---

# 67. Payment Aggregate

Root:

```text
Payment
```

Controls:

```text
payment state
provider reference
captured amount
refundability
```

Refunds may be modeled as child entities of the Payment aggregate if the consistency requirements justify it.

---

# 68. Review Aggregate

Root:

```text
Review
```

Reviews should generally be immutable after publication except for controlled moderation/editing policies.

Avoid allowing arbitrary:

```text
review.setRating(...)
```

after publication.

---

# 69. Domain Events by Aggregate

## Service Request

```text
ServiceRequestSubmitted
ServiceRequestCancelled
ServiceRequestAwaitingSelection
ServiceRequestBooked
ServiceRequestFailedToMatch
ServiceRequestExpired
```

## Worker Match

```text
WorkerNotified
WorkerMatchAccepted
WorkerMatchDeclined
WorkerMatchExpired
WorkerMatchWithdrawn
WorkerSelected
WorkerNotSelected
```

## Booking

```text
BookingConfirmed
BookingCancelled
BookingRescheduled
```

## Job

```text
VisitEnRoute
VisitArrived
VisitStarted
VisitCompleted
VisitNoShowReported
JobWorkCompleted
JobCompleted
```

## Quote

```text
QuoteSubmitted
QuoteAccepted
QuoteRejected
```

## Payment

```text
PaymentCreated
PaymentSucceeded
PaymentFailed
RefundSucceeded
```

## Review

```text
ReviewCreated
```

## Dispute

```text
DisputeOpened
DisputeResolved
```

---

# 70. State Machine Rule

Every state-changing domain method must answer:

```text
1. What state am I currently in?
2. Is this transition legal?
3. Who is allowed to perform it?
4. What data must be present?
5. What state should result?
6. What event should be emitted?
```

This makes business behavior explicit.

---

# 71. Example — Booking Confirmation

Current:

```text
ServiceRequest = AWAITING_SELECTION
WorkerMatch    = ACCEPTED
```

Command:

```text
selectWorker(matchId)   (customer)
```

Validation:

```text
Is the request AWAITING_SELECTION?
Is the match ACCEPTED and not expired?
Is worker still eligible?
Is there no live booking for this request?
```

Result:

```text
WorkerMatch = SELECTED (other accepted matches → NOT_SELECTED)
ServiceRequest = BOOKED
Booking = CONFIRMED, Job = SCHEDULED, planned JobVisits created
```

Event:

```text
WorkerSelected
BookingConfirmed
```

---

# 72. Example — Invalid Booking Confirmation

Current:

```text
CANCELLED
```

Command:

```text
reschedule(newTime)
```

Result:

```text
InvalidBookingStateException
```

API:

```http
409 CONFLICT
```

Error:

```json
{
  "error": {
    "code": "BOOKING_INVALID_STATE",
    "message": "The booking cannot be rescheduled from its current state."
  }
}
```

---

# 73. Example — Job Completion

Current:

```text
IN_PROGRESS
```

Command:

```text
markWorkCompleted()   (worker), then confirmCompletion() (customer)
```

Result:

```text
WORK_COMPLETED → COMPLETED
```

Event:

```text
JobCompleted
```

If current state is:

```text
SCHEDULED
```

then:

```text
markWorkCompleted()
```

should fail unless a deliberately defined shortcut exists.

---

# 74. Why State Machines Matter

Without explicit state machines, code often becomes:

```java
if (status == X) ...
else if (status == Y) ...
else if (status == Z) ...
```

spread across:

* controllers
* services
* repositories
* scheduled jobs
* event handlers

Eventually different parts of the system disagree about what is valid.

Centralizing transition rules prevents that.

---

# 75. Domain Invariant vs Business Policy

These should be distinguished.

### Invariant

A rule that must always be true.

Example:

```text
rating must be between 1 and 5
```

### Policy

A configurable business decision.

Example:

```text
Customer may cancel without fee up to 30 minutes before arrival.
```

The policy may change.

Therefore cancellation policy should not necessarily be hardcoded deep inside the entity.

---

# 76. Policy Objects

Where rules become configurable, use domain/application policies.

Example:

```text
CancellationPolicy
MatchingPolicy
VerificationPolicy
RefundPolicy
ReviewEligibilityPolicy
```

Example:

```java
public interface CancellationPolicy {

    CancellationDecision evaluate(
        Booking booking,
        CancellationActor actor,
        Instant now
    );
}
```

This allows policy evolution without turning entities into giant classes.

---

# 77. Time Handling

All persisted timestamps should use UTC.

Java should preferably use:

```java
Instant
```

for absolute timestamps.

Example:

```java
Instant createdAt;
Instant completedAt;
```

Local timezone should be applied only at presentation/business-boundary levels where necessary.

---

# 78. Domain Clock

Avoid directly calling:

```java
Instant.now()
```

everywhere in domain code.

Use a clock abstraction where deterministic testing matters.

Example:

```java
public interface ClockProvider {
    Instant now();
}
```

Then tests can use a fixed clock.

---

# 79. Immutability

Some domain information should be immutable.

Examples:

```text
payment provider transaction ID
historical service-request location
review creation timestamp
audit event
financial transaction reference
```

Changing historical information can destroy auditability.

---

# 80. Historical Snapshots

Certain values should be copied rather than referenced forever.

Example:

Customer address:

```text
Current Address
```

may change.

But the historical service request should retain:

```text
addressText at request creation
location (latitude, longitude)
landmark, pincode, floor, lift
addressFor, contact name and phone
```

Similarly, a booking preserves the agreed rate snapshot (type, unit, amount) and scheduled time agreed at selection, and an accepted quote is never edited.

---

# 81. Domain Model Does Not Equal JPA Model

Important:

```text
Domain Model
      ≠
JPA Entity
```

The domain model represents business behavior.

The JPA model represents persistence.

For simple objects they may look similar.

But they should not be coupled unnecessarily.

Example:

```text
Worker
```

domain model:

```text
Worker
 ├── activate()
 ├── suspend()
 ├── enableJobAcceptance()
 └── disableJobAcceptance()
```

JPA entity:

```text
WorkerJpaEntity
 ├── id
 ├── userId
 ├── status
 ├── ...
```

---

# 82. Why Separate Them?

This protects the domain from:

* Hibernate proxies
* lazy-loading behavior
* persistence annotations
* database concerns
* accidental writes
* framework coupling

It also makes unit testing easier.

---

# 83. Practical Warning

We should not blindly create:

```text
Domain Worker
WorkerJpaEntity
WorkerDto
WorkerResponse
WorkerRequest
WorkerMapper
WorkerRepository
WorkerRepositoryAdapter
WorkerFactory
WorkerAssembler
WorkerBuilder
```

for every tiny operation.

That would create unnecessary complexity.

The architecture should be production-grade **without becoming ceremony-heavy**.

---

# 84. Aggregate Loading Rule

When loading an aggregate:

> Load what is required to enforce the aggregate's invariants, not the entire relational graph.

For example:

```text
Booking
```

does not need to eagerly load:

```text
all worker reviews
all customer addresses
all job history
all payment history
```

This is critical for performance.

---

# 85. Aggregate Transaction Rule

Changes inside one aggregate should normally be committed atomically.

For example:

```text
Booking confirmation
```

must not leave:

```text
Booking = CONFIRMED
```

while the same transaction expects an essential invariant to remain broken.

Cross-aggregate workflows should use:

* application orchestration
* domain events
* transactional outbox
* compensating actions where necessary

rather than giant distributed-style transactions.

---

# 86. Cross-Aggregate Example

Suppose:

```text
JobCompleted
```

occurs.

The Job aggregate changes:

```text
IN_PROGRESS → WORK_COMPLETED → COMPLETED
```

Then:

```text
JobCompleted
```

can trigger:

```text
Payment workflow
Review eligibility
Notification
Worker earnings
```

The Job aggregate itself should not directly modify all those systems.

---

# 87. Core Domain vs Supporting Domain

The most strategically important domain is:

```text
Service Request
Matching
Worker
Booking
Job
Trust/Reputation
```

Supporting domains:

```text
Authentication
Notifications
Storage
Payments
Admin
```

Payments are operationally critical but should remain separated from the service execution model.

---

# 88. Domain Complexity Priority

Initial engineering focus should be:

```text
1. Service Request
2. Matching
3. Booking
4. Job
5. Worker
6. Trust
7. Payment
8. Dispute
```

This is not a ranking of business value. It reflects the dependency sequence for implementing the core service workflow.

---

# 89. End-to-End Domain Flow

The core domain can now be visualized as:

```text
CUSTOMER
   │
   ▼
ServiceRequest
   │
   ▼
Matching
   │
   ▼
WorkerMatch
   │
   ▼
Booking
   │
   ▼
Job
   │
   ├──────────────► JobVisit(s)
   ├──────────────► Quote (ADDITIONAL)
   │
   ▼
Payment
   │
   ├──────────────► Refund
   │
   ▼
Review
   │
   ▼
Reputation
```

If something goes wrong:

```text
Job
 │
 └──► Dispute
```

---

# 90. Core Domain Invariants

The most important initial invariants are:

```text
1. A worker must belong to a valid user.
2. A worker cannot accept work while suspended/deactivated.
3. A worker must satisfy required verification rules.
4. A service request must have a valid profession.
5. A service request must have valid location information.
6. A cancelled request cannot become active again.
7. A match must reference an existing worker and request.
8. Only eligible workers can accept matches; only the customer selects one.
9. Only one live booking exists per request.
10. A cancelled booking cannot be reactivated.
11. Job and visit transitions must follow the defined lifecycle; a worker's live visits never overlap.
12. Additional work (an ADDITIONAL quote) requires customer approval.
13. Payment amounts must be positive (Money itself may be negative for discounts/adjustments).
14. Refunds cannot exceed captured payment.
15. Duplicate payment processing must be prevented.
16. Reviews require an eligible completed job.
17. Ratings must be between 1 and 5.
18. Disputes must reference an eligible job.
19. Financial history must be preserved.
20. Important administrative actions must be auditable.
```

---

# 91. Domain Events Summary

```text
ServiceRequestSubmitted
        ↓
MatchingStarted
        ↓
WorkerNotified
        ↓
WorkerMatchAccepted
        ↓
WorkerSelected
        ↓
BookingConfirmed
        ↓
VisitEnRoute
        ↓
VisitArrived
        ↓
VisitStarted
        ↓
JobCompleted
        ↓
PaymentSucceeded
        ↓
ReviewCreated
```

Alternative paths include:

```text
Cancellation
No-show
Payment failure
Dispute
Refund
```

---

# 92. Final Domain Model

Conceptually:

```text
                         USER
                       /      \
                      /        \
                 CUSTOMER     WORKER
                    │           │
                    │           ├── Professions + Rates
                    │           ├── Skills
                    │           ├── Verification
                    │           ├── Availability
                    │           └── Service Area
                    ├── Addresses
                    ▼
             SERVICE REQUEST
                    │
                    ▼
             WORKER MATCH
                    │
                    ▼
                 BOOKING
                    │
                    ▼
                   JOB ── JobVisits
                 /  │  \
                /   │   \
               ▼    ▼    ▼
         Quote   Payment  Dispute
      (ADDITIONAL)   │
                     ▼
                   Refund

JOB
 │
 ▼
REVIEW
 │
 ▼
REPUTATION
```

---

# 93. Final Domain Design Rules

The implementation must preserve these principles:

### Rule 1

Entities own their business behavior.

### Rule 2

State transitions are explicit.

### Rule 3

Aggregates protect consistency boundaries.

### Rule 4

Do not expose generic `setStatus()` methods for important lifecycle state.

### Rule 5

Historical financial and trust information should be preserved.

### Rule 6

Policies should be separated from immutable invariants where appropriate.

### Rule 7

Cross-module side effects should generally use events.

### Rule 8

External systems are accessed through ports.

### Rule 9

Database structure must not dictate domain behavior.

### Rule 10

Do not over-engineer the domain before real complexity appears.

---

# 94. Conclusion

We now have a defined conceptual domain model.

The architecture can be represented as:

```text
PRODUCT
   ↓
BUSINESS RULES
   ↓
DOMAIN
   ↓
AGGREGATES
   ↓
STATE MACHINES
   ↓
USE CASES
   ↓
API
   ↓
DATABASE
```

The next document should move one level closer to actual implementation.

We need to define exactly how the domain model maps to Java classes, including:

* class responsibilities
* fields
* constructors/factories
* domain methods
* value objects
* enums
* aggregate roots
* domain events
* repository interfaces
* persistence entities
* mappers
* transaction boundaries
* package placement
* sample Java code

# Next Document

**[architecture/05](05-java-domain-model-and-class-design.md) — Java Domain Model & Class Design**

It will provide the first real **code-level blueprint** for the project without yet implementing the entire application.

It will define classes such as:

```text
User
Customer
Worker
WorkerProfession
WorkerRate
Profession
Skill
WorkerVerification
ServiceRequest
WorkerMatch
Booking
Job
JobVisit
Quote
QuoteLineItem
Payment
Refund
Review
Dispute
Money
GeoPoint
```

and show how those classes should be structured in the Spring Boot project.
