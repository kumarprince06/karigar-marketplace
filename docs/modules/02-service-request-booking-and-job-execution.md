# Service Request, Booking & Job Execution Architecture

**Project:** Karigar Marketplace
**Status:** Architecture / Engineering Design
**Architecture:** Modular Monolith
**Primary Stack:** Java + Spring Boot + PostgreSQL + PostGIS + Redis

---

## Current Model (aligned with ERD and ADRs)

The [ERD](../architecture/03-erd-and-production-database-design.md) (§22–41.1) is the source of truth for tables and statuses; [ADR 0017](../adr/0017-customer-picks-the-worker.md) decides that the customer picks the worker. Where an older passage below disagrees, this section wins.

- **Service request:** trade (`profession_id`), one or more selected `common_problems` (`service_request_problems`), optional description / voice note / photos, a **saved** `address_id` (the address must be saved first; a snapshot of location, address text, landmark, floor, lift and on-site contact is copied onto the request). The address's `service_zone` must be `ACTIVE`. Urgency `NOW | TODAY | SCHEDULED`.
  Statuses: `DRAFT`, `SUBMITTED`, `MATCHING`, `AWAITING_SELECTION`, `BOOKED`, `COMPLETED`, `CANCELLED`, `EXPIRED`, `FAILED_TO_MATCH`.
- **Matching → selection:** nearby, verified, available workers with the trade are notified; interested workers accept with visit charge + ETA; the customer sees up to 3 accepted workers and **selects one**. `worker_matches`: `NOTIFIED → VIEWED → ACCEPTED → SELECTED | NOT_SELECTED`, plus `DECLINED`, `EXPIRED`, `WITHDRAWN`. Details in [modules/01](01-matching-engine-and-geospatial-discovery.md).
- **Booking** (created only by the customer's selection): `booking_type` `SINGLE_VISIT | MULTI_DAY`, `planned_days`, agreed rate **snapshot** (`agreed_rate_type` `VISIT | HOURLY | HALF_DAY | DAILY | PER_UNIT | MINIMUM | QUOTE`, `agreed_unit`, `agreed_amount_minor`), `helper_count` / `helper_day_rate_minor`, `payment_schedule` `ON_COMPLETION | DAILY | WEEKLY | MILESTONE`, and `cancelled_by` + `cancellation_reason_code` + `cancellation_fee_minor`. One live booking per request: unique index `WHERE status <> 'CANCELLED'`.
- **Job** (one per booking): `SCHEDULED`, `IN_PROGRESS`, `ON_HOLD`, `WORK_COMPLETED` (worker marked done, awaiting customer), `COMPLETED` (customer confirmed), `CANCELLED`.
- **Job visits:** every job has ≥ 1 `job_visits` row (one for a fan repair, one per working day for masonry/painting). Visit: `SCHEDULED → EN_ROUTE → ARRIVED → IN_PROGRESS → DONE`, or `WORKER_NO_SHOW`, `CUSTOMER_NO_SHOW`, `RESCHEDULED`, `CANCELLED`. Check-in records GPS and a 4-digit start code given by the customer / site contact; check-out records a work summary, helpers present and the per-visit amount; the customer confirms each day (auto-confirmed after a configurable window unless disputed). Overlapping visits for a worker are blocked by `EXCLUDE USING gist (worker_id WITH =, tstzrange(...) WITH &&)`.
- **Selection transaction:** match → `SELECTED`, other accepted → `NOT_SELECTED`, booking + job + planned visits created, request → `BOOKED`, all in one transaction.
- **Additional work** is a quote with `quote_kind = 'ADDITIONAL'` (`quotes` + `quote_line_items`), not a separate `additional_work` table.
- **Money is never on the job.** Payment, earnings and refunds have their own lifecycles ([modules/03](03-pricing-quotation-and-money-flow.md)).

---

# 1. Purpose

This document defines the complete lifecycle of a service transaction:

```text
Customer Request
       ↓
Matching
       ↓
Workers Accept (shortlist, max 3)
       ↓
Customer Selects Worker → Booking Confirmed
       ↓
Per visit: En Route → Arrived (start code) → In Progress → Done
       ↓
Additional Work (optional ADDITIONAL quote)
       ↓
Work Completed → Customer Confirms
       ↓
Payment
       ↓
Review
       ↓
Possible Dispute
```

The purpose is to make this lifecycle:

* consistent
* transactional
* auditable
* concurrency-safe
* recoverable
* scalable
* understandable to engineers
* independent from UI implementation.

A critical principle is:

> Service Request, Booking, and Job are different concepts and must remain separate.

---

# 2. Why We Need Three Concepts

It is tempting to create one table:

```text
jobs
```

and put everything into it.

That would make the system difficult to evolve.

Instead:

```text
Service Request
      ↓
Booking
      ↓
Job
```

represents three different business realities.

---

# 3. Service Request

A **Service Request** represents customer demand.

Example:

> "My kitchen tap is leaking. I need a plumber tomorrow at 6 PM."

It answers:

> What does the customer need?

It contains:

```text
requestId
customerId
profession (trade)
selected common problems
description / voice note (optional)
addressId (saved address) + address snapshot (location, text, landmark, floor, lift, on-site contact)
serviceZoneId (must be ACTIVE)
preferred time window
urgency (NOW | TODAY | SCHEDULED)
attachments (photos)
status
```

---

# 4. Booking

A **Booking** represents an agreed arrangement between the customer and worker.

It answers:

> Who is expected to perform the service, and when?

It contains:

```text
bookingId
serviceRequestId
customerId
workerId
professionId
bookingType (SINGLE_VISIT | MULTI_DAY)
scheduledStartAt / scheduledEndAt
plannedDays (MULTI_DAY)
agreed rate snapshot (agreedRateType, agreedUnit, agreedAmountMinor)
helperCount / helperDayRateMinor
paymentSchedule (ON_COMPLETION | DAILY | WEEKLY | MILESTONE)
status
cancelledBy / cancellationReasonCode / cancellationFeeMinor
```

A request can exist without a booking.

Example:

```text
Request:
SUBMITTED

Booking:
does not exist
```

---

# 5. Job

A **Job** represents actual service execution.

It answers:

> What actually happened during the service?

Example (one visit of a job):

```text
Visit:
EN_ROUTE
      ↓
ARRIVED (GPS + 4-digit start code)
      ↓
IN_PROGRESS
      ↓
DONE (work summary, helpers, amount; customer confirms the day)
```

A job has one or more visits (`job_visits`): one for a fan repair, one per working day for masonry or painting.

A job should preserve execution history independently from the original request.

---

# 6. Complete Lifecycle

The high-level lifecycle is:

```text
                         CUSTOMER
                            │
                            ▼
                    SERVICE REQUEST
                            │
                            ▼
                         MATCHING
                            │
                            ▼
                 WORKERS ACCEPT (max 3)
                            │
                            ▼
                 CUSTOMER SELECTS ONE
                            │
                            ▼
                         BOOKING
                            │
                            ▼
                  JOB + JOB_VISITS (≥ 1)
                            │
             ┌──────────────┼───────────────┐
             │              │               │
             ▼              ▼               ▼
     VISIT: EN_ROUTE     ARRIVED        CANCELLED
             │
             ▼
     VISIT: IN_PROGRESS → DONE   (repeat per day for MULTI_DAY)
             │
             ▼
      ADDITIONAL quote
        (optional)
             │
             ▼
   JOB: WORK_COMPLETED → COMPLETED (customer confirms)
             │
             ▼
          PAYMENT (separate lifecycle)
             │
             ▼
          REVIEW
             │
             ▼
        DISPUTE (optional)
```

---

# 7. Service Request State Machine

State machine (ERD §29):

```text
DRAFT
  │
  ▼
SUBMITTED
  │
  ▼
MATCHING                 -- workers being notified
  │
  ├──────────────► FAILED_TO_MATCH   (nobody accepted after the last round)
  │
  ▼
AWAITING_SELECTION       -- at least one worker accepted; customer to pick
  │
  ▼
BOOKED                   -- customer picked a worker
  │
  ▼
COMPLETED
```

Cancellation:

```text
DRAFT ──────────────► CANCELLED
SUBMITTED ──────────► CANCELLED
MATCHING ───────────► CANCELLED
AWAITING_SELECTION ─► CANCELLED
BOOKED ─────────────► CANCELLED
```

Expiration (preferred time passed without a booking):

```text
SUBMITTED / MATCHING / AWAITING_SELECTION
    │
    ▼
EXPIRED
```

The exact transition rules will be enforced by the domain model.

---

# 8. Booking State Machine

A booking is created only by the customer's selection, so it starts `CONFIRMED` (no `PENDING` step):

```text
CONFIRMED
   │
   ├────────► CANCELLED   (cancelled_by, cancellation_reason_code, cancellation_fee_minor)
   │
   ▼
COMPLETED
```

`EXPIRED` is also excluded from the one-live-booking index (ERD §38).

Rescheduling is not a booking status: a moved day is a `job_visits` row marked `RESCHEDULED` plus a new visit, with history kept in booking events.

---

# 9. Job State Machine

The job represents execution of the whole piece of work (ERD §40):

```text
SCHEDULED        -- booking confirmed, no visit started yet
    │
    ▼
IN_PROGRESS      -- at least one visit started
    │  ▲
    ▼  │
ON_HOLD          -- waiting for material, rain, customer away
    │
    ▼
WORK_COMPLETED   -- worker marked complete, waiting for customer confirmation
    │
    ▼
COMPLETED        -- customer confirmed
```

Plus `CANCELLED`.

Each visit (one day or one trip, ERD §40.1) has its own state machine:

```text
SCHEDULED → EN_ROUTE → ARRIVED → IN_PROGRESS → DONE
        ├── WORKER_NO_SHOW
        ├── CUSTOMER_NO_SHOW
        ├── RESCHEDULED
        └── CANCELLED
```

No-shows are visit outcomes, not job states.

---

# 10. Why We Need Explicit Job States

Without explicit states, the backend might accept invalid operations.

For example:

```text
Job: COMPLETED
      ↓
Job: IN_PROGRESS
```

should not be possible.

Similarly:

```text
Job: SCHEDULED
      ↓
Job: WORK_COMPLETED
```

is invalid, because at least one visit must have started (check-in with start code) before completion.

The domain should enforce these rules.

---

# 11. State Transitions Must Be Methods

Avoid:

```java
job.setStatus(WORK_COMPLETED);
```

Prefer:

```java
job.complete();
```

Similarly:

```java
visit.markEnRoute();
visit.checkIn(location, startCode);   // ARRIVED
visit.start();                        // IN_PROGRESS
visit.checkOut(workSummary, helpersPresent);  // DONE
job.complete();                       // WORK_COMPLETED
job.confirmByCustomer();              // COMPLETED
```

This allows the domain object to enforce business rules.

---

# 12. Service Request Creation

Customer calls:

```http
POST /api/v1/service-requests
```

The application validates:

```text
authenticated customer
profession (trade)
selected common problems (all from that trade)
description / voice note (optional when a problem is picked)
addressId — a saved address owned by the customer
service zone of the address is ACTIVE
preferred time window
urgency (NOW | TODAY | SCHEDULED)
```

The address fields and location are copied onto the request as a snapshot; later edits to the saved address do not change the request.

Then creates:

```text
ServiceRequest
status = DRAFT
```

or directly:

```text
SUBMITTED
```

depending on the API workflow.

---

# 13. Draft vs Submitted

A draft allows the customer to construct the request before matching begins.

Example:

```text
Customer selects:
Plumber
      ↓
Picks common problems (e.g. "Tap leaking")
      ↓
Adds description / voice note / photos (optional)
      ↓
Selects a saved address (or saves a new one first)
      ↓
Selects urgency / time
      ↓
Submit
```

Only after submission should the matching process start.

---

# 14. Submit Request

Submission is a business action.

Conceptually:

```text
POST /service-requests/{id}/submit
```

Flow:

```text
DRAFT
  ↓
validate all required data
  ↓
SUBMITTED
  ↓
publish ServiceRequestSubmitted
```

The event can trigger matching asynchronously.

---

# 15. Transaction Boundary

Request submission should be transactional.

Inside transaction:

```text
validate
update request
persist request
create relevant event/outbox record
commit
```

Outside the transaction:

```text
matching
notifications
SMS
push
```

This prevents external failures from corrupting the request transaction.

---

# 16. Matching Begins

After submission:

```text
ServiceRequestSubmitted
        ↓
Matching Engine
        ↓
Candidate discovery
        ↓
Worker offers
```

The service request becomes:

```text
MATCHING
```

---

# 17. Awaiting Selection

When the first worker accepts the offer:

```text
AWAITING_SELECTION
```

This does not mean a booking exists.

The customer sees up to 3 accepted workers (photo, rating, jobs done, distance, badges, visit charge, arrival time) and picks one ([ADR 0017](../adr/0017-customer-picks-the-worker.md)). The shortlist fills as workers accept, so the customer can pick before later matching rounds finish. Auto-assigning the first worker who accepts was rejected.

---

# 18. Booking Confirmation

When the customer selects a worker:

```text
WorkerMatch (chosen)   status = SELECTED
WorkerMatch (others)   ACCEPTED → NOT_SELECTED

Booking
status = CONFIRMED

Job
status = SCHEDULED  (+ planned job_visits)

ServiceRequest
status = BOOKED
```

These updates must happen consistently.

A transaction should protect the transition.

---

# 19. One Live Booking Rule

For MVP:

> A service request can have at most one live booking (any status except `CANCELLED`).

This should be enforced at two levels.

### Application

Check whether a live booking already exists.

### Database

Use partial unique indexes (ERD §33, §38):

```sql
CREATE UNIQUE INDEX ux_bookings_one_active_per_request
ON bookings(service_request_id)
WHERE status <> 'CANCELLED';

CREATE UNIQUE INDEX ux_matches_selected
ON worker_matches(service_request_id)
WHERE status = 'SELECTED';
```

Filtering on `status = 'CONFIRMED'` alone would stop protecting the request once the booking moves on.

This protects against race conditions.

---

# 20. Concurrent Selection

Two workers accepting at the same time is fine: both become `ACCEPTED` and appear on the shortlist. The race is on selection.

Example:

```text
Customer Request R1

Customer → Select Worker A   (phone)
Customer → Select Worker B   (second device / double tap)
Worker A → Withdraw          (same moment)
```

Requests arrive concurrently.

Without protection:

```text
Booking A → CONFIRMED
Booking B → CONFIRMED
```

This is invalid.

The database must become the final consistency boundary.

---

# 21. Atomic Booking Confirmation

Conceptually:

```text
BEGIN
   lock request (SELECT ... FOR UPDATE)
   verify request is AWAITING_SELECTION
   verify chosen match is ACCEPTED and not expired
   revalidate worker eligibility

   check live booking

   if no booking:
       match → SELECTED, other accepted → NOT_SELECTED
       create booking (CONFIRMED, rate snapshot)
       create job (SCHEDULED) + planned job_visits
       request → BOOKED

COMMIT
```

If another transaction already confirmed the request:

```text
409 CONFLICT
```

or an equivalent domain error should be returned.

---

# 22. Optimistic vs Pessimistic Concurrency

Two common approaches:

### Optimistic

Use a version field:

```text
version = 10
```

Update only if:

```text
version = 10
```

If another transaction changes it:

```text
version = 11
```

the update fails.

---

### Pessimistic

Lock the relevant database row while confirming.

Example:

```text
SELECT ... FOR UPDATE
```

The exact approach will be finalized during LLD/database implementation.

The important architectural requirement is:

> Confirmation must be atomic.

---

# 23. Job Creation

Once a booking is confirmed:

```text
Booking
   ↓
Job
```

The job and its planned visits are created **in the same transaction** as the customer's selection (§21). A `SINGLE_VISIT` booking gets one visit; a `MULTI_DAY` booking gets one visit per planned working day. The `job_visits` exclusion constraint rejects a visit that overlaps another live visit of the same worker:

```sql
EXCLUDE USING gist (
    worker_id WITH =,
    tstzrange(scheduled_start_at, scheduled_end_at) WITH &&
) WHERE (status NOT IN ('CANCELLED', 'RESCHEDULED', 'WORKER_NO_SHOW', 'CUSTOMER_NO_SHOW'))
```

Recommended invariant:

```text
one booking
    =
one job
```

for MVP.

Database:

```text
UNIQUE(job.booking_id)
```

---

# 24. Job Execution

The worker receives:

```text
confirmed booking
```

Then, **for each visit**:

```text
EN_ROUTE
```

when travelling.

Then:

```text
ARRIVED
```

on check-in: GPS location recorded and the 4-digit start code given by the customer / site contact is verified.

Then:

```text
IN_PROGRESS
```

when actual work begins (the job moves `SCHEDULED → IN_PROGRESS` on the first visit).

Then:

```text
DONE
```

on check-out: work summary, helpers present and the visit amount are recorded. The customer confirms the day (auto-confirmed after a configurable window, default 24 h, unless disputed).

When all work is finished the worker marks the job `WORK_COMPLETED`; the customer confirms → `COMPLETED`.

---

# 25. Timestamp Every Important Transition

Do not store only current status.

We need timestamps such as:

```text
bookings.confirmed_at / cancelled_at
job_visits.en_route_at / check_in_at / start_code_verified_at / check_out_at / customer_confirmed_at
jobs.started_at / completed_at
```

Per-visit timestamps live on `job_visits`, because a multi-day job has them once per day. This gives us operational history.

---

# 26. Why Timestamps Matter

Suppose a customer complains:

> "The worker took two hours to arrive."

We should be able to calculate:

```text
arrival time - en route time
```

Similarly:

```text
completion time - start time
```

can provide service-duration metrics.

---

# 27. Job Event History

For more detailed auditing, we may eventually maintain:

```text
job_status_history
```

Example:

```text
Job SCHEDULED
  18:00

Visit 1 EN_ROUTE
  18:12

Visit 1 ARRIVED (start code verified)
  18:31

Visit 1 IN_PROGRESS / Job IN_PROGRESS
  18:35

Visit 1 DONE / Job WORK_COMPLETED
  19:10

Job COMPLETED (customer confirmed)
  19:15
```

This is more reliable than relying only on the current job row.

---

# 28. Current State vs History

The main `jobs` row should contain:

```text
current status
```

History can contain:

```text
all transitions
```

Therefore:

```text
jobs.status
```

answers:

> What is happening now?

while:

```text
job_status_history
```

answers:

> What happened?

This is a common production pattern.

---

# 29. Should We Build Status History in MVP?

Recommended:

If the lifecycle is operationally important, record transitions from the beginning.

At minimum, preserve:

```text
status
timestamp
actor
```

This will help enormously with:

* disputes
* support
* analytics
* debugging
* SLA calculations
* fraud investigation.

---

# 30. Actor Tracking

A transition should identify who initiated it where relevant.

Example:

```text
Visit:
IN_PROGRESS

Actor:
Worker 123

Time:
18:35
```

Another:

```text
Job:
CANCELLED

Actor:
Customer 456
```

This becomes useful during disputes.

---

# 31. Cancellation

Cancellation is not the same as failure.

A customer may cancel because:

```text
changed plans
found another worker
wrong time
no longer needed
```

A worker may cancel because:

```text
emergency
vehicle problem
wrong job
too far
```

The system should preserve:

```text
cancelled_by               -- CUSTOMER | WORKER | ADMIN | SYSTEM
cancellation_reason_code   -- reason_codes (ERD §52.4)
cancellation_note
cancellation_fee_minor
cancelled_at
```

---

# 32. Cancellation State Rules

Example:

```text
DRAFT
  → CANCELLED

SUBMITTED
  → CANCELLED

MATCHING
  → CANCELLED

AWAITING_SELECTION
  → CANCELLED

BOOKED
  → CANCELLED
```

But:

```text
Job WORK_COMPLETED / COMPLETED
  → CANCELLED
```

must be rejected.

After completion, disputes/refunds may be used instead.

---

# 33. Cancellation Reason

Recommended structure (`bookings.cancelled_by`):

```text
CUSTOMER
WORKER
ADMIN
SYSTEM
```

plus a reason code (`cancellation_reason_code`):

```text
CUSTOMER_CHANGED_MIND
FOUND_ANOTHER_WORKER
SCHEDULE_CONFLICT
WORKER_UNAVAILABLE
WRONG_REQUEST
OTHER
```

This allows meaningful analytics.

---

# 34. Cancellation Policy

The exact cancellation policy is a product/business decision.

Potential future rules:

```text
free cancellation before confirmation
free cancellation before worker departure
fee after worker starts travelling
no cancellation after work starts
```

The architecture should support these rules without hard-coding one policy everywhere.

---

# 35. Cancellation Policy Object

Conceptually:

```text
CancellationPolicy
```

could determine:

```text
isCancellationAllowed()
calculateCancellationFee()
determineActor()
```

The domain model should not contain dozens of scattered `if` statements.

---

# 36. Rescheduling

Customer may request:

> Can we move this from 6 PM to 8 PM?

Rescheduling should be a business operation.

Conceptually:

```text
POST /bookings/{id}/reschedule
```

with:

```json
{
  "scheduledAt": "..."
}
```

The system must validate:

```text
new time is valid
worker can support new time
booking is reschedulable
```

---

# 37. Rescheduling Should Preserve History

Do not simply overwrite:

```text
scheduled_at
```

and lose the previous value.

At minimum, preserve:

```text
previous scheduled time
new scheduled time
actor
timestamp
```

This may be represented using:

```text
booking_events
```

or a dedicated history table.

---

# 38. Worker Cancellation

Suppose:

```text
Worker A
confirmed

then cancels.
```

The customer should not simply receive:

```text
booking cancelled
```

with no recovery path.

The marketplace may trigger:

```text
replacement matching
```

where appropriate.

Flow:

```text
Worker Cancellation
       ↓
Booking Cancelled
       ↓
Customer Notification
       ↓
Replacement Matching
       ↓
New Candidate
       ↓
New Booking
```

The exact product experience remains an open decision.

---

# 39. Customer Cancellation

Customer cancellation may stop the matching/job process.

Example:

```text
Customer cancels
      ↓
Request CANCELLED
      ↓
Booking CANCELLED if applicable (job + remaining visits CANCELLED)
      ↓
Live matches (NOTIFIED / VIEWED / ACCEPTED) → EXPIRED
      ↓
Workers notified if necessary
```

All relevant state transitions should be coordinated.

---

# 40. Worker No-Show

A no-show is not necessarily cancellation.

Example:

```text
Booking:
CONFIRMED

Scheduled time:
6 PM

Worker:
never arrived
```

This visit should become:

```text
job_visits.status = WORKER_NO_SHOW
```

where the workflow supports such a determination. No-show is a visit outcome; the job and booking then follow the cancellation or replacement path.

The system should preserve:

```text
reported_by
reported_at
evidence
```

where appropriate.

---

# 41. Customer No-Show

Similarly:

```text
Worker arrived
Customer unavailable
```

This visit can become:

```text
job_visits.status = CUSTOMER_NO_SHOW
```

Again:

```text
no-show
≠
cancellation
```

because the operational and financial consequences may differ.

---

# 42. No-Show Verification

A serious system should avoid allowing arbitrary no-show claims.

Potential evidence:

```text
arrival timestamp
location signal
worker/customer confirmation
communication records
photos
support/admin review
```

The exact verification mechanism should evolve with the marketplace.

---

# 43. Additional Work

A worker may discover:

> The leaking pipe also needs replacement.

The worker should not simply increase the bill.

Instead:

```text
Worker
  ↓
ADDITIONAL quote (quotes.quote_kind = 'ADDITIONAL', job_id set, with quote_line_items)
  ↓
Customer
  ↓
Accept / Reject
```

There is no separate `additional_work` table; every price the customer must approve is a quote (ERD §41).

---

# 44. Additional Work State

Uses the quote statuses:

```text
DRAFT → SUBMITTED
           │
           ├── ACCEPTED
           ├── REJECTED
           ├── EXPIRED
           └── WITHDRAWN
```

An accepted quote preserves:

```text
quote_line_items (description, quantity, unit, unit price, amount, supplied_by)
total_minor
submitted_at
decided_at
decided_by_user_id
```

Accepting an `ADDITIONAL` quote adds to the job's payable amount; rejecting it leaves the job unchanged.

---

# 45. Additional Work Immutability

Once approved:

```text
amount = ₹500
```

should not silently become:

```text
amount = ₹800
```

Instead:

```text
new REVISION quote (old one becomes SUPERSEDED)
```

should be created. Submitted quotes are immutable.

This provides financial auditability.

---

# 46. Work Completion

Worker calls:

```http
POST /api/v1/jobs/{id}/complete
```

Application validates:

```text
authenticated worker
assigned worker
job state
required completion information
```

Then:

```text
job.complete()
```

The domain validates:

```text
Job IN_PROGRESS → WORK_COMPLETED
(no visit still EN_ROUTE / ARRIVED / IN_PROGRESS)
```

---

# 47. Completion Evidence

Future jobs may require:

```text
completion photos
customer confirmation
work summary
parts used / material bills
accepted ADDITIONAL quotes
```

The architecture should allow completion metadata without making it mandatory for every category initially.

---

# 48. Customer Confirmation

The ERD settles this: the customer confirms.

Worker marks complete:

```text
Job WORK_COMPLETED   (waiting for customer confirmation)
```

Customer confirms.

Then:

```text
Job COMPLETED
```

Each visit is also confirmed by the customer / site contact (`job_visits.customer_confirmed_at`), auto-confirmed after a configurable window unless disputed. Disputes remain available afterwards.

---

# 49. Payment Relationship

Payment should not be embedded into the job status.

Bad:

```text
job.status = PAID
```

Instead:

```text
Job
  ↓
Payment
```

with independent payment state. Financial state (amounts paid, due, refunded) is never stored on the job; the job only records execution, and visits record the agreed per-visit amount from the booking's rate snapshot.

This was established in earlier documents.

---

# 50. Job Completion vs Payment Success

These can happen independently.

Example:

```text
Job:
COMPLETED

Payment:
FAILED
```

This is possible.

The system must then provide a payment recovery mechanism.

Conversely:

```text
Payment:
SUCCESS

Job:
not yet completed
```

may occur depending on the payment model.

Therefore:

```text
Job lifecycle
≠
Payment lifecycle
```

---

# 51. Payment Trigger

The booking's `payment_schedule` decides when payment is raised: `ON_COMPLETION` (after the job is `COMPLETED`), `DAILY` / `WEEKLY` (against confirmed visits, hajira-style), or `MILESTONE`.

Other possible models:

```text
pay after completion
preauthorization
prepayment
deposit
wallet
cash + digital
```

The architecture should isolate payment policy from job execution.

---

# 52. Service Transaction Timeline

Example:

```text
17:00  Request created
17:01  Request submitted
17:01  Matching started (round 1, 2 km)
17:02  Worker A accepts (visit ₹200)
17:03  Worker B accepts
17:04  Customer selects Worker A → booking confirmed, job + visit 1 created
18:30  Visit 1 en route
18:45  Visit 1 arrived (start code verified)
18:50  Visit 1 in progress
19:20  ADDITIONAL quote submitted
19:22  Customer accepted quote
19:50  Visit 1 done, job WORK_COMPLETED
19:51  Customer confirms → job COMPLETED
19:51  Payment initiated
19:52  Payment successful
19:55  Review submitted
```

This timeline becomes valuable for:

* support
* analytics
* disputes
* operational metrics
* fraud detection.

---

# 53. Transaction Boundaries

Do not use one giant transaction for the entire service lifecycle.

Incorrect:

```text
BEGIN
request
matching
worker response
booking
job
payment
notification
COMMIT
```

A service can last hours.

Transactions must be short.

Instead:

```text
Transaction 1:
create request

Transaction 2:
worker accepts offer

Transaction 3:
customer selects worker (booking + job + visits)

Transaction 4:
visit en route

Transaction 5:
visit check-in (arrive)

Transaction 6:
visit start / check-out

Transaction 7:
job complete / customer confirm

Transaction 8:
payment
```

Each state transition is independently committed.

---

# 54. Why Short Transactions Matter

Long-running transactions cause:

* database locks
* connection exhaustion
* contention
* poor scalability
* difficult failure recovery.

A job can exist for hours.

The database transaction should exist for milliseconds/seconds, not hours.

---

# 55. Domain Events

Important transitions should produce events.

Examples:

```text
ServiceRequestSubmitted
ServiceRequestCancelled
WorkerMatchAccepted
WorkerSelected

BookingConfirmed
BookingCancelled
VisitRescheduled

VisitEnRoute
VisitArrived
VisitStarted
VisitDone
VisitConfirmed
VisitNoShowReported
JobCompleted

QuoteSubmitted        (incl. ADDITIONAL)
QuoteAccepted

PaymentInitiated
PaymentSucceeded
PaymentFailed
```

---

# 56. Why Events?

Events allow supporting systems to react without coupling the core transaction to them.

Example:

```text
JobCompleted
     │
     ├── Payment module
     ├── Notification module
     ├── Review eligibility
     ├── Analytics
     └── Reputation
```

The job module does not need to directly call all of them.

---

# 57. Transactional Outbox

As reliability requirements increase, domain events should eventually use:

```text
Transactional Outbox
```

Flow:

```text
BEGIN
   update job
   create outbox event
COMMIT
```

Then:

```text
Outbox Processor
      ↓
publishes event
      ↓
consumers
```

This prevents the problem:

```text
database committed
but event lost
```

---

# 58. Initial Event Strategy

For early development:

```text
Spring Application Events
```

can be used.

But event handlers must not be treated as guaranteed delivery infrastructure.

Before production traffic becomes significant, important asynchronous workflows should move toward an outbox-based design.

---

# 59. Idempotency

State-changing APIs must be safe against retries.

For example:

```http
POST /jobs/123/complete
Idempotency-Key: abc123
```

If the request is accidentally sent twice:

```text
first request:
success

second request:
same logical operation
```

should not create duplicate side effects.

---

# 60. State-Based Idempotency

Some operations can also naturally be idempotent.

Example:

```text
Job already WORK_COMPLETED
```

A repeated completion request should not create another completion event or duplicate payment.

The API should return a deterministic result or a clear conflict depending on the operation semantics.

---

# 61. API Retry Behavior

Mobile networks are unreliable.

Example:

```text
Worker clicks "Complete"
       ↓
request sent
       ↓
server commits
       ↓
network disconnects
       ↓
worker sees error
```

The worker may retry.

Therefore:

```text
mobile retry
```

must not create:

```text
duplicate completion
duplicate payment
duplicate review
```

This is a major production concern.

---

# 62. Optimistic UI vs Server Truth

The frontend may display:

```text
Completed
```

immediately after a button click.

But the backend remains authoritative.

The client should eventually synchronize with:

```text
GET /jobs/{id}
```

or an event/WebSocket notification.

Never make frontend state the source of truth.

---

# 63. WebSocket Updates

The system may later provide real-time job updates:

```text
Worker En Route
Worker Arrived
Work Started
Work Completed
```

Architecture:

```text
Domain Event
     ↓
Notification / Realtime Module
     ↓
WebSocket
     ↓
Client
```

The job transaction itself should not depend on a WebSocket connection.

---

# 64. WebSocket Failure

If the customer loses internet:

```text
WebSocket disconnected
```

the job must continue normally.

The customer can retrieve current state using:

```text
GET /jobs/{id}
```

Therefore:

```text
Realtime communication
≠
business state
```

This is particularly important given the user's previous Laravel Reverb experience.

The same architectural principle will apply when implementing realtime behavior in Spring Boot.

---

# 65. Job Location Updates

A future worker app may periodically send location updates.

Example:

```text
Worker
  ↓
location update
  ↓
Worker Location Service
  ↓
PostGIS / Redis
```

But this should not mean every location update creates a database transaction on the Job aggregate.

High-frequency telemetry should be treated separately.

---

# 66. Avoid Polluting the Job Aggregate

Do not make:

```text
Job
```

contain:

```text
every GPS point
every notification
every payment event
every chat message
```

This creates a huge aggregate.

Instead:

```text
Job
 ├── execution state
 ├── timestamps
 └── relevant execution metadata

Location
 └── separate subsystem

Chat
 └── separate subsystem

Payment
 └── separate aggregate
```

---

# 67. Service Request Expiration

A request may become irrelevant.

Example:

```text
Customer needs electrician at 6 PM
Current time:
8 PM
```

The request should not remain:

```text
MATCHING
```

forever.

Possible state:

```text
EXPIRED
```

Expiration can be handled asynchronously.

---

# 68. Scheduled Operations

Future background processing may handle:

```text
expire service requests
expire match offers
detect missed appointments
detect possible no-shows
retry notifications
reconcile payments
cleanup temporary data
```

Initially this can use:

```text
Spring Scheduler
```

or scheduled jobs.

At higher scale:

```text
distributed job processing
message broker
```

can be introduced.

---

# 69. Worker Availability During Job

Suppose worker has:

```text
Job A
```

from:

```text
6 PM → 7 PM
```

The matching engine should not assign:

```text
Job B
```

for:

```text
6:30 PM
```

unless the worker explicitly supports concurrent work.

Therefore worker capacity is part of the matching/business architecture. The final guard is the `job_visits` exclusion constraint (§23): a selection that would create an overlapping visit for the same worker fails.

---

# 70. Customer Double Booking

Customer may create multiple requests intentionally.

Example:

```text
Plumber
Electrician
```

This is fine.

But identical duplicate requests may be suspicious.

The system can detect:

```text
same customer
same category
same location
same time
same description
```

and warn or restrict according to product policy.

---

# 71. Booking Modification Rules

Once confirmed, not every field should be editable.

For example:

```text
Worker
```

should not simply be changed through:

```text
PATCH /bookings/{id}
```

Worker replacement is a business operation.

Similarly:

```text
price
scheduled time
service location
```

may have special transition rules.

This is why action APIs are preferable to generic CRUD.

---

# 72. Service Location Changes

Changing the service location after booking can affect:

```text
distance
travel time
worker eligibility
price
availability
```

Therefore:

```text
PATCH booking.location
```

should not be treated as a normal field update.

It may require:

```text
reschedule
re-match
customer confirmation
worker confirmation
```

depending on the workflow.

---

# 73. Historical Snapshots

When the booking is created, preserve important request information.

For example:

```text
service_request (snapshot at creation)
-----------------------
location, address_text, landmark, pincode
property_type, floor_number, has_lift
address_for, contact_name, contact_phone

booking (snapshot at selection)
-----------------------
worker_id
scheduled_start_at / scheduled_end_at
agreed_rate_type / agreed_unit / agreed_amount_minor
helper_count / helper_day_rate_minor
```

Why?

Because the original request may later be edited or deactivated.

The booking represents what was agreed.

Historical data should not silently change because another record changed.

---

# 74. Data Ownership

Conceptually:

```text
ServiceRequest
    owns request lifecycle

Booking
    owns agreement lifecycle

Job
    owns execution lifecycle

Payment
    owns payment lifecycle

Review
    owns review lifecycle

Dispute
    owns dispute lifecycle
```

This keeps aggregate boundaries clear.

---

# 75. Cross-Domain References

Use IDs rather than loading giant object graphs.

Example:

```java
class Job {
    private UUID bookingId;
}
```

rather than:

```java
class Job {
    private Booking booking;
    private Customer customer;
    private Worker worker;
    private Payment payment;
    private List<Review> reviews;
}
```

The second approach can create:

* huge ORM graphs
* accidental queries
* N+1 problems
* unclear aggregate boundaries.

---

# 76. Database Model

Core relationships:

```text
Customer
   │
   └── ServiceRequest
          │
          ├── WorkerMatch
          │       │
          │       └── Worker
          │
          └── Booking
                  │
                  └── Job
                        │
                        ├── JobVisit (≥ 1)
                        ├── Quote (ADDITIONAL) + QuoteLineItem
                        ├── Payment
                        ├── Review
                        └── Dispute
```

This is the logical business relationship, not necessarily one ORM object graph.

---

# 77. Operational Failure Example

Suppose:

```text
Worker completes job
```

but:

```text
payment provider unavailable
```

The correct state might be:

```text
Job:
COMPLETED

Payment:
PENDING
```

A background process can retry payment.

The job should not be rolled back.

---

# 78. Notification Failure Example

Suppose:

```text
Booking confirmed
```

but:

```text
SMS failed
```

The booking remains:

```text
CONFIRMED
```

Notification retries independently.

---

# 79. Database Failure Example

Suppose:

```text
Customer selects a worker
```

but PostgreSQL fails before commit.

Then:

```text
Booking:
not confirmed
```

The customer can retry.

No external side effect should falsely tell the customer that the booking is confirmed before the database transaction commits.

---

# 80. External Provider Principle

The core transaction should not depend directly on:

```text
SMS provider
Payment provider
Maps provider
Push provider
```

Instead:

```text
Domain/Application
       ↓
Port
       ↓
Provider Adapter
```

This keeps external systems replaceable.

---

# 81. Scaling the Transaction System

The initial system:

```text
                Load Balancer
                     │
             ┌───────┼───────┐
             ▼       ▼       ▼
           App 1   App 2   App 3
             │       │       │
             └───────┼───────┘
                     │
                PostgreSQL
                     │
                   Redis
```

All instances can process requests.

Concurrency correctness comes from:

```text
database constraints
transactions
locking/versioning
idempotency
```

not from one particular application instance.

---

# 82. Background Processing

As traffic increases:

```text
HTTP API
   │
   ├── fast transaction
   │
   └── event/outbox
          │
          ▼
      Worker Pool
          │
          ├── matching
          ├── notifications
          ├── expiration
          ├── reconciliation
          └── analytics
```

This prevents slow background work from consuming API request threads.

---

# 83. High-Volume Job States

At large scale, thousands of jobs may transition simultaneously.

The system should avoid:

```text
global lock
```

or:

```text
one scheduler scans entire jobs table every second
```

Instead use:

```text
indexed timestamps
targeted queries
scheduled partitions/batches
event-driven processing
```

as scale increases.

---

# 84. Indexing Requirements

Common query patterns should have indexes.

Examples:

```text
service_requests(customer_id, created_at)
service_requests(status, scheduled_at)

bookings(customer_id, scheduled_start_at)
bookings(worker_id, scheduled_start_at)
bookings(service_request_id) WHERE status <> 'CANCELLED'   -- unique

jobs(booking_id)   -- unique
job_visits(worker_id, visit_date)
job_visits(job_id, visit_no)

worker_matches(service_request_id, status, responded_at)
worker_matches(worker_id, status, expires_at)
```

Exact indexes will be finalized in the database/production performance document.

---

# 85. Avoid Premature Partitioning

Even though we want to support large user numbers, do not immediately partition:

```text
jobs
bookings
service_requests
```

Partitioning adds complexity.

First measure:

```text
row count
query latency
write throughput
index size
vacuum behavior
storage growth
```

Then partition if actual requirements justify it.

---

# 86. Idempotency Across the Lifecycle

Important operations:

```text
submit request
accept match (worker)
select worker (customer; creates booking)
cancel booking
reschedule visit
mark en route
check in (arrive)
start
check out
confirm visit
complete job
submit ADDITIONAL quote
accept ADDITIONAL quote
create payment
refund
create review
```

must be evaluated for retry safety.

---

# 87. State Transition Authority

Only the appropriate actor can perform a transition.

Example:

```text
Worker:
EN_ROUTE
ARRIVED
START
COMPLETE
```

Customer cannot directly call:

```text
POST /jobs/123/complete
```

and successfully complete the worker's job.

Similarly:

```text
Customer:
select worker
confirm visit / confirm job completion
accept ADDITIONAL quote
```

Worker cannot accept their own quote or confirm their own visit.

---

# 88. State Transition Matrix

A simplified authorization matrix:

| Operation               |            Customer |          Worker | Admin |
| ----------------------- | ------------------: | --------------: | ----: |
| Create request          |                 Yes | Optional future |   Yes |
| Cancel own request      |                 Yes |              No |   Yes |
| Accept worker match     |                  No |             Yes |    No |
| Select worker (booking) |                 Yes |              No |   Yes |
| En route                |                  No |             Yes |   Yes |
| Arrived (start code)    |                  No |             Yes |   Yes |
| Start work              |                  No |             Yes |   Yes |
| Complete work           |                  No |             Yes |   Yes |
| Confirm visit / job     |                 Yes |              No |   Yes |
| Submit ADDITIONAL quote |                  No |             Yes |    No |
| Accept ADDITIONAL quote |                 Yes |              No |    No |
| Create review           |                 Yes |             Yes |   Yes |
| Open dispute            |                 Yes |             Yes |   Yes |

"Admin" here means authorized administrative personnel, not unrestricted access to every business action.

---

# 89. Dispute After Completion

Completion does not necessarily mean:

```text
everything is permanently accepted.
```

A customer may later report:

```text
work incomplete
damage
wrong charge
quality issue
```

Therefore:

```text
Job
COMPLETED

        ↓

Dispute
OPEN
```

The job remains historically completed.

The dispute becomes a separate lifecycle.

---

# 90. Never Rewrite History to Resolve Disputes

Bad:

```text
Job completed
   ↓
Admin edits job
   ↓
Job status changed to something else
```

Prefer:

```text
Original Job
    ↓
Dispute
    ↓
Resolution
    ↓
Refund / adjustment / action
```

Historical facts remain intact.

---

# 91. Audit Trail

Important operations should create audit records.

Example:

```text
Worker 123
completed
Job 456
at 19:50
```

or:

```text
Customer 789
accepted
ADDITIONAL Quote 321
₹500
```

or:

```text
Admin 10
cancelled
Booking 555
```

---

# 92. Domain Events vs Audit Events

They serve different purposes.

### Domain Event

Used to communicate:

> Something happened.

Example:

```text
JobCompleted
```

### Audit Event

Used to record:

> Who performed an important action?

Example:

```text
Worker 123 completed Job 456
```

Both can coexist.

---

# 93. Core Invariants

The system must enforce:

1. A service request belongs to one customer.
2. A cancelled request cannot become active again.
3. A request can have at most one live booking (not `CANCELLED`) and at most one `SELECTED` match; only the customer's selection creates it.
4. A booking belongs to one customer and worker.
5. A booking cannot be confirmed for an invalid request.
6. A booking cannot be reconfirmed after cancellation.
7. A booking has at most one job in MVP.
8. Only the assigned worker can execute worker job actions.
9. Job state transitions must be valid.
10. Completed jobs cannot be cancelled as normal cancellation.
11. Additional work (an `ADDITIONAL` quote) requires customer acceptance.
12. Submitted quotes are immutable; changes are `REVISION` quotes.
13. Payment lifecycle is independent from job lifecycle.
14. Duplicate payment operations must be prevented.
15. Reviews are only allowed for eligible jobs.
16. Disputes reference a specific job/transaction.
17. Historical transaction data is preserved.
18. Important state transitions are auditable.
19. Client retries must not create duplicate business effects.
20. Final consistency must be enforced by the database where appropriate.

---

# 94. Performance Principles

The transaction architecture should follow:

```text
Short transactions
Small aggregates
Indexed queries
No giant ORM graphs
No unnecessary synchronous calls
Async side effects
Idempotent commands
Database constraints
Horizontal application scaling
```

These principles matter more than prematurely choosing a particular framework feature.

---

# 95. What We Are Intentionally Not Doing Yet

We are not introducing:

```text
microservices
distributed transactions
event sourcing
CQRS everywhere
Kafka
Kubernetes
complex workflow engine
Temporal/Cadence
distributed locking for every operation
full event-sourced job history
```

The modular monolith can handle the initial complexity.

---

# 96. Future Evolution

The lifecycle can eventually evolve into:

```text
                 API
                  │
                  ▼
             Core Backend
                  │
        ┌─────────┼──────────┐
        │         │          │
    Matching   Booking    Payments
        │         │          │
        └─────────┼──────────┘
                  │
             Event Bus
                  │
       ┌──────────┼──────────┐
       ▼          ▼          ▼
 Notification  Analytics  Reputation
```

The important point is that the domain boundaries already exist.

We are not designing microservices first.

We are designing **good boundaries first**.

---

# 97. End-to-End Production Flow

The final conceptual flow is:

```text
CUSTOMER
   │
   ▼
Create Request
   │
   ▼
SUBMITTED
   │
   ▼
MATCHING
   │
   ├── nobody accepted after last round → FAILED_TO_MATCH
   │
   ▼
Worker Offers (rounds, favourites first)
   │
   ▼
Workers Accept → AWAITING_SELECTION (shortlist, max 3)
   │
   ▼
Customer Selects → Atomic Booking Confirmation
   │
   ▼
BOOKED  (booking CONFIRMED, job SCHEDULED, visits planned)
   │
   ▼
Per visit: EN_ROUTE → ARRIVED (start code) → IN_PROGRESS → DONE → customer confirms day
   │
   ├── ADDITIONAL quote
   │        │
   │        └── Customer Acceptance
   │
   ▼
Job WORK_COMPLETED → customer confirms → COMPLETED
   │
   ▼
PAYMENT
   │
   ├── SUCCESS
   ├── FAILED → Retry/Recovery
   └── REFUND
   │
   ▼
REVIEW
   │
   └── DISPUTE (if required)
```

---

# 98. Final Architectural Decisions

### Service Request

Represents:

> Customer demand.

### Booking

Represents:

> Agreed service arrangement.

### Job

Represents:

> Actual service execution.

### Payment

Represents:

> Financial transaction.

### Review

Represents:

> Customer/worker feedback.

### Dispute

Represents:

> Post-transaction disagreement.

Each has its own lifecycle.

---

# 99. Scalability Decisions

The transaction architecture is designed for growth through:

```text
Horizontal application scaling
        ↓
PostgreSQL transactional consistency
        ↓
PostGIS for location
        ↓
Redis for temporary/cache state
        ↓
Async background processing
        ↓
Transactional outbox
        ↓
Message broker when required
```

The system does not require microservices to achieve the first stages of scale.

---

# 100. Final Engineering Rules

1. Never combine request, booking, and job into one giant entity.
2. Keep lifecycles independent.
3. Use explicit state transitions.
4. Never expose generic status setters.
5. Keep transactions short.
6. Use database constraints for critical invariants.
7. Protect concurrent customer selection (booking confirmation).
8. Revalidate worker eligibility before confirmation.
9. Make command APIs retry-safe.
10. Preserve historical state.
11. Track important transition timestamps.
12. Distinguish cancellation from no-show.
13. Distinguish job completion from payment success.
14. Treat notifications as side effects.
15. Use domain events for cross-module reactions.
16. Move important asynchronous events toward transactional outbox.
17. Do not store high-frequency GPS data inside the Job aggregate.
18. Keep payment independent from job state.
19. Keep disputes independent from historical transaction state.
20. Design for horizontal scaling from the beginning.
21. Do not introduce distributed transactions prematurely.
22. Do not introduce microservices merely because the system may eventually become large.
23. Measure actual bottlenecks before partitioning databases.
24. Keep business policies replaceable.
25. Treat PostgreSQL as the source of truth for transactional state.

---

# 101. Next Document

The next document should define another major production concern:

## [modules/03](03-pricing-quotation-and-money-flow.md) — Pricing, Quotation, Additional Charges & Marketplace Money Flow

It will define:

```text
Service Request
      ↓
Pricing Model
      ↓
Base Price / Quote
      ↓
Worker / Customer Agreement
      ↓
Additional Work
      ↓
Final Amount
      ↓
Platform Fee
      ↓
Worker Earnings
      ↓
Payment
      ↓
Refund
      ↓
Settlement
```

It will also address:

* fixed vs quote-based pricing
* service fees
* platform commission
* taxes
* additional charges
* price snapshots
* money precision
* payment authorization/capture
* refunds
* worker earnings
* ledger design
* reconciliation
* idempotency
* financial auditability
* Stripe/Paystack abstraction
* scaling financial operations
* why financial data should be modeled differently from ordinary CRUD data.
