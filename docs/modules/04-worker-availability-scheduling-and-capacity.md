# Worker Availability, Scheduling & Capacity Management

**Project:** Karigar Marketplace
**Initial Market:** Howrah / Kolkata
**Initial Categories:** Electricians + Plumbers
**Architecture:** Java + Spring Boot Modular Monolith
**Database:** PostgreSQL + PostGIS
**Supporting Infrastructure:** Redis
**Document Type:** Product + Domain + System Architecture
**Status:** Draft for Architecture Review

---

# 1. Purpose

The matching engine needs more information than:

> "Is this worker active?"

It needs to answer:

> **Can this worker accept and perform this particular job at this particular time?**

For example:

```text
Worker:
Ramesh

Profession:
Electrician

Service area:
Howrah

Current status:
ACTIVE

Accepting jobs:
YES

Working hours:
10:00 AM – 8:00 PM

Existing jobs:
2

Maximum concurrent jobs:
2
```

A customer requests:

```text
Today
6:00 PM
Fan repair
```

The system needs to determine whether Ramesh can actually accept it.

---

# 2. Availability Is Not One Field

A common mistake is to model availability as:

```text
worker.available = true
```

That is insufficient.

Availability is composed of multiple dimensions:

```text
Worker Account
      │
      ├── Account Status
      ├── Job Acceptance
      ├── Working Schedule
      ├── Leave / Exceptions
      ├── Existing Bookings
      ├── Capacity
      ├── Current Location
      └── Service Area
```

Therefore:

> **Availability is a domain concept, not a boolean.**

---

# 3. Important Distinction

We need to distinguish:

### Account Status

```text
ACTIVE
SUSPENDED
DEACTIVATED
```

### Job Acceptance

```text
ACCEPTING
NOT_ACCEPTING
```

### Scheduled Availability

```text
10 AM – 8 PM
```

### Current Availability

```text
AVAILABLE_NOW
BUSY
```

### Capacity

```text
2 active jobs
```

These states are related but should not be collapsed into one field.

---

# 4. Example

Suppose:

```text
Worker Account:
ACTIVE

Accepting Jobs:
YES

Working Hours:
10 AM – 8 PM

Current Time:
3 PM

Active Jobs:
2

Maximum Capacity:
2
```

The worker is:

```text
ACTIVE = YES
ACCEPTING = YES
WITHIN_WORKING_HOURS = YES
CAPACITY_AVAILABLE = NO
```

Therefore:

```text
Available for new job = NO
```

---

# 5. Availability Model

Conceptually:

```text
WorkerAvailability
 ├── workerId
 ├── acceptingJobs
 ├── timezone
 ├── schedule
 ├── exceptions
 └── capacity
```

The exact Java classes and database mapping will be defined during LLD.

---

# 6. MVP Availability Model

We should not build a sophisticated calendar system immediately.

For MVP, support:

```text
1. Accepting jobs ON/OFF
2. Working hours
3. Basic unavailable/leave periods
4. Maximum active jobs
5. Existing booking conflict detection
```

This is enough for the initial marketplace.

---

# 7. Worker Toggle

Worker UI can expose:

```text
[ ON ] Accept new jobs
```

or:

```text
[ OFF ] Not accepting jobs
```

Example:

> "I am busy right now."

Worker switches:

```text
acceptingJobs = false
```

The worker should stop receiving new offers.

---

# 8. Existing Offers

Suppose a worker already received:

```text
Offer A
```

and then switches:

```text
Accepting Jobs = OFF
```

What happens?

This is a business rule that needs to be defined.

A practical initial rule:

```text
Existing accepted/confirmed work
→ remains valid

New offers
→ stop
```

An already-issued offer may either:

* remain valid until expiration, or
* be withdrawn immediately.

The exact choice should be configurable.

---

# 9. Working Hours

Workers should eventually be able to define:

```text
Monday:
10:00 – 20:00

Tuesday:
10:00 – 20:00

Wednesday:
OFF

Thursday:
10:00 – 20:00
```

For MVP, a simple weekly schedule is enough.

---

# 10. Multiple Time Ranges

A worker may have a split schedule:

```text
10:00 – 14:00
17:00 – 21:00
```

The domain should not fundamentally prevent multiple intervals.

However, the first UI may only expose one or two ranges per day.

---

# 11. Timezone

All backend timestamps should be stored in:

```text
UTC
```

using:

```text
TIMESTAMPTZ
```

Worker/customer schedules should have an explicit timezone.

For the initial Howrah/Kolkata market:

```text
Asia/Kolkata
```

But the system should not hard-code India into the domain.

---

# 12. Why Timezone Matters

Suppose the platform eventually expands to another country.

A schedule such as:

```text
10:00 – 18:00
```

must be interpreted in the worker's local timezone.

Therefore:

```text
Local Schedule
      ↓
Timezone
      ↓
UTC Instant
```

The database should store actual events as UTC instants.

---

# 13. Availability for a Specific Job

Suppose:

```text
Customer request:
6:00 PM
```

The matching engine asks:

> Can Worker A accept a job starting at 6 PM?

Availability must consider:

```text
working schedule
+
leave
+
existing bookings
+
service duration
+
travel time
+
capacity
```

MVP may simplify this.

---

# 14. Job Duration

A booking may have an expected duration.

Example:

```text
Fan repair:
60 minutes
```

If the worker has:

```text
5:00 – 6:00 PM → Existing job
```

and customer requests:

```text
5:30 PM – 6:30 PM
```

there is an overlap.

The worker should not be treated as freely available.

---

# 15. Scheduling Conflict

Conceptually:

```text
Existing Job:
5:00 ───────── 6:00

New Job:
      5:30 ───────── 6:30

         OVERLAP
```

Therefore:

```text
Availability = false
```

unless the business explicitly permits overlapping assignments.

---

# 16. MVP Scheduling

For the first version, avoid complex route optimization.

Use:

```text
Scheduled start
+
Expected duration
```

and check for overlapping confirmed bookings.

Later:

```text
Existing Job
+
Travel Time
+
New Job
```

can be considered.

---

# 17. Capacity

Capacity answers:

> How many active jobs can this worker handle?

Example:

```text
Worker A:
maxConcurrentJobs = 2
```

Current:

```text
Job 1 → WORK_STARTED
Job 2 → CONFIRMED
```

Then:

```text
capacity = FULL
```

Worker should not receive another assignment.

---

# 18. Why Capacity Is Different From Scheduling

Suppose:

```text
Current time = 2 PM

Existing jobs:
Job A = 6 PM
Job B = 7 PM
```

Worker has no active job now.

But the worker may already be fully booked for the requested future period.

Therefore:

```text
Current capacity
≠
Future schedule availability
```

Both should be evaluated.

---

# 19. Worker Capacity Models

Possible models:

### Model A — Maximum concurrent jobs

```text
maxConcurrentJobs = 2
```

### Model B — Maximum jobs per day

```text
maxJobsPerDay = 5
```

### Model C — Time-based schedule

```text
10 AM – 8 PM
```

### Model D — Hybrid

```text
Schedule
+
Capacity
+
Existing bookings
```

MVP should use the hybrid model in a simplified form.

---

# 20. Availability Calculation

Conceptually:

```text
isAvailable(worker, request) =
    worker.isActive()
    AND worker.acceptingJobs()
    AND withinWorkingHours(request)
    AND notOnLeave(request)
    AND hasCapacity(request)
    AND noScheduleConflict(request)
```

Matching can then use this as an eligibility condition.

---

# 21. Availability Should Be Deterministic

Given:

```text
Worker state
+
Request time
```

the system should produce a predictable answer.

Avoid hidden dependencies such as:

```text
random availability
```

or:

```text
application-memory state
```

that disappears after restart.

---

# 22. Current Online Presence

There is another concept:

> Is the worker currently online?

This is different from:

> Is the worker scheduled to work?

Example:

```text
Working hours:
10 AM – 8 PM

Current time:
3 PM

Phone/app:
Offline
```

The worker may technically be scheduled to work but unavailable to respond.

---

# 23. Presence

Future architecture may track:

```text
ONLINE
OFFLINE
LAST_SEEN
```

through:

```text
mobile app
   ↓
heartbeat
   ↓
Redis
```

But this should be treated as **soft state**.

If Redis says:

```text
ONLINE
```

that does not guarantee the worker will accept a job.

---

# 24. Redis Presence

Potential structure:

```text
worker:presence:{workerId}
```

with a short TTL.

Example:

```text
TTL = 60 seconds
```

If heartbeat stops:

```text
Redis key expires
```

Worker becomes effectively offline.

Again:

> Redis presence is not the source of truth for bookings.

---

# 25. Availability Source of Truth

Permanent worker availability configuration belongs in PostgreSQL.

For example:

```text
worker_availability
worker_schedule
worker_availability_exceptions
```

Redis can cache the current operational state.

---

# 26. Temporary Unavailability

Worker may say:

> "Don't send me jobs for the next 2 hours."

This can be represented as an availability exception.

Example:

```text
Worker
     ↓
Unavailable
2 PM – 4 PM
```

During this period:

```text
matching eligibility = false
```

---

# 27. Leave

Future workers may define:

```text
Leave:
1 Oct – 5 Oct
```

This should be separate from:

```text
acceptingJobs = false
```

because leave is scheduled information.

---

# 28. Availability Exceptions

Conceptually:

```text
Availability Exception
 ├── workerId
 ├── startAt
 ├── endAt
 ├── type
 └── reason
```

Types:

```text
LEAVE
PERSONAL
EMERGENCY
TEMPORARY_UNAVAILABLE
```

---

# 29. Availability Precedence

Suppose:

```text
Working hours:
10 AM – 8 PM

Leave:
2 PM – 5 PM

Accepting jobs:
ON
```

At:

```text
3 PM
```

the worker is unavailable.

Conceptually:

```text
Account status
      ↓
Acceptance flag
      ↓
Schedule
      ↓
Exceptions
      ↓
Bookings
      ↓
Capacity
```

The most restrictive applicable condition wins.

---

# 30. Booking and Availability

Once a booking is confirmed, the worker's future availability changes.

Example:

```text
Before:

10 AM – 8 PM
No bookings
```

After:

```text
Confirmed job:
4 PM – 5 PM
```

Matching should now recognize:

```text
4 PM – 5 PM unavailable
```

but potentially:

```text
5 PM – 6 PM available
```

---

# 31. Booking Cancellation

Suppose:

```text
Job:
4 PM – 5 PM
```

is cancelled.

That time may become available again.

Therefore availability must be calculated from current confirmed/active bookings rather than permanently marking a time slot unavailable.

---

# 32. Rescheduling

Suppose:

```text
Original:
4 PM
```

Customer changes to:

```text
6 PM
```

The system must re-check:

```text
worker availability
+
schedule
+
capacity
+
conflicts
```

A previously valid booking may no longer be valid at the new time.

---

# 33. Concurrency Problem

Consider:

```text
Worker capacity = 1
```

Two customers request the same worker:

```text
Customer A → Worker X
Customer B → Worker X
```

Both requests arrive simultaneously.

Without concurrency control:

```text
A sees capacity = 1
B sees capacity = 1

A accepts
B accepts
```

Now:

```text
capacity = 2
```

even though maximum is 1.

This must be prevented.

---

# 34. Availability Is Not Reservation

A worker being available during matching does not automatically reserve that time.

Example:

```text
10:00:00
Worker appears available

10:00:01
Customer A accepts

10:00:01
Customer B accepts
```

Therefore:

> Availability checks are not sufficient to guarantee booking correctness.

The final booking operation must atomically enforce the relevant constraints.

---

# 35. Database Concurrency

Potential mechanisms:

```text
optimistic locking
pessimistic locking
database constraints
transaction isolation
```

The exact strategy depends on the final data model.

The important architectural rule:

> **Booking correctness must not depend only on an availability read.**

---

# 36. Overlapping Booking Constraint

For time-based scheduling, PostgreSQL can eventually support strong overlap prevention using appropriate range-based constraints.

Conceptually:

```text
Worker X
4 PM – 5 PM
```

and:

```text
Worker X
4:30 PM – 5:30 PM
```

should conflict when the worker cannot have overlapping bookings.

The exact PostgreSQL implementation will be finalized during database/LLD work.

---

# 37. Worker Acceptance Window

An offer should expire.

Example:

```text
Offer:
11:00

Expires:
11:02
```

If the worker tries at:

```text
11:05
```

the offer should be rejected.

Even if the worker was previously available.

---

# 38. Availability Revalidation

When the worker accepts:

```text
Do not blindly trust the availability result from offer creation.
```

Re-check relevant conditions during confirmation:

```text
Worker active
+
Offer valid
+
Booking still available
+
Schedule still valid
+
Capacity still available
```

This protects against stale state.

---

# 39. Current Location and Availability

Current GPS location can affect operational availability.

Example:

```text
Worker has a 5 PM job in Shibpur.

New job:
5:15 PM
Location:
Bally
```

Even if there is no strict time overlap, travel may make the assignment unrealistic.

MVP:

```text
Use distance/radius.
```

Future:

```text
Use routing/ETA.
```

---

# 40. Service Duration

Different services have different expected durations.

Example:

```text
Tap repair:
30–60 min

House wiring:
4–8 hours
```

The catalog can eventually provide:

```text
estimatedDuration
```

Matching can use that when evaluating schedules.

---

# 41. Duration Is an Estimate

Do not assume:

```text
estimatedDuration = actualDuration
```

Actual work may take longer.

Therefore the system should distinguish:

```text
estimated duration
actual duration
```

This becomes valuable for future scheduling optimization.

---

# 42. Buffer Time

Workers may need travel/setup time.

Future scheduling:

```text
Job A:
4:00 – 5:00

Travel buffer:
30 min

Next job:
5:30
```

This is more realistic than:

```text
Job A ends 5:00
Next job starts 5:00
```

MVP can use a simple configurable buffer.

---

# 43. Worker Preference

Workers may configure:

```text
Maximum distance:
8 km

Preferred areas:
Howrah
Shibpur
Salkia
```

These can influence matching.

They may be treated as:

* hard constraints
* soft preferences.

For example:

```text
Maximum distance = hard
Preferred locality = ranking signal
```

---

# 44. Emergency Jobs

Urgent requests may require different availability rules.

Example:

```text
URGENT
"Water pipe burst"
```

The platform may search:

```text
workers available NOW
```

instead of:

```text
scheduled tomorrow
```

This should be a distinct matching policy.

---

# 45. Scheduled vs Immediate Jobs

The platform may support:

### Immediate

```text
Need worker now
```

### Scheduled

```text
Need worker tomorrow at 4 PM
```

### Flexible

```text
Any time tomorrow
```

These require different availability evaluation.

---

# 46. Availability for Immediate Jobs

For immediate jobs:

```text
acceptingJobs
+
online/presence
+
current location
+
capacity
```

may be more important.

For scheduled jobs:

```text
working schedule
+
leave
+
existing bookings
+
expected duration
```

becomes more important.

---

# 47. Flexible Time Windows

Future requests may specify:

```text
Preferred:
Tomorrow
10 AM – 6 PM
```

rather than an exact start time.

Matching could search for workers with overlapping availability.

This can be added later without changing the fundamental domain.

---

# 48. Availability Query

Conceptually:

```text
AvailabilityService
        ↓
isWorkerAvailable(
    worker,
    requestedStart,
    requestedDuration
)
```

It may evaluate:

```text
Account
Acceptance
Schedule
Exceptions
Existing jobs
Capacity
```

Matching consumes the result.

---

# 49. Avoid Putting Availability Logic Everywhere

Bad:

```java
if (worker.active
    && worker.available
    && time > ...)
```

inside:

* controller
* matching service
* booking service
* notification service
* admin service.

This causes inconsistent business rules.

Instead, centralize availability policy.

---

# 50. Availability Module Boundary

Conceptually:

```text
availability/
├── schedule
├── exceptions
├── capacity
├── presence
├── conflict detection
└── availability policies
```

The exact package placement can be refined later.

It may be a dedicated module or part of the worker/scheduling boundary depending on final domain decomposition.

---

# 51. Relationship With Matching

```text
Service Request
      ↓
Matching
      ↓
Candidate Worker
      ↓
Availability Check
      ↓
Eligible
```

Matching should consume availability rather than duplicate its rules.

---

# 52. Relationship With Booking

```text
Booking Request
      ↓
Availability Revalidation
      ↓
Concurrency Check
      ↓
Booking Confirmation
```

The booking process is the final authority for reservation correctness.

---

# 53. Relationship With Job

Job execution changes operational state.

Example:

```text
Job starts
   ↓
Worker busy
```

When completed:

```text
Job completes
   ↓
Capacity released
```

Therefore job lifecycle affects availability.

---

# 54. Worker Availability Lifecycle

Conceptually:

```text
AVAILABLE
   │
   ├── Worker toggles OFF
   ↓
NOT_ACCEPTING

AVAILABLE
   │
   ├── Job confirmed
   ↓
BUSY / CAPACITY_REDUCED

BUSY
   │
   ├── Job completed
   ↓
AVAILABLE

AVAILABLE
   │
   ├── Leave starts
   ↓
UNAVAILABLE
```

These are operational states, not necessarily a single persisted enum.

---

# 55. Event-Driven Updates

Important events:

```text
BookingConfirmed
BookingCancelled
JobStarted
JobCompleted
WorkerAvailabilityChanged
WorkerLeaveCreated
```

may trigger:

```text
availability cache update
matching refresh
worker notification
```

---

# 56. Redis Cache Strategy

Potential cache:

```text
worker:availability:{workerId}
```

Example:

```json
{
  "acceptingJobs": true,
  "availableNow": true,
  "activeJobs": 1
}
```

But this should have a TTL and be derived from authoritative data.

---

# 57. Cache Invalidation

If worker changes:

```text
Accepting Jobs:
ON → OFF
```

the cache must update quickly.

Potential flow:

```text
Update PostgreSQL
      ↓
Commit
      ↓
Publish event
      ↓
Update/invalidate Redis
```

This prevents cache from becoming permanently stale.

---

# 58. Availability Failures

What if Redis is down?

The platform should still be able to determine critical availability from PostgreSQL.

Potential strategy:

```text
Redis available
→ use cache/fast path

Redis unavailable
→ fallback to database
```

For critical booking correctness:

```text
database remains authoritative.
```

---

# 59. Performance

Availability checks can become expensive at scale.

Suppose:

```text
100,000 workers
```

and every request checks all workers.

That is unacceptable.

Instead:

```text
PostGIS
 ↓
small geographic candidate set
 ↓
availability filter
 ↓
ranking
```

This works with the matching architecture from [modules/01](01-matching-engine-and-geospatial-discovery.md).

---

# 60. Availability Query Order

A practical approach:

```text
1. Geographic filtering
2. Profession
3. Skill
4. Active status
5. Accepting jobs
6. Schedule
7. Exceptions
8. Capacity
9. Existing booking conflicts
10. Ranking
```

The exact order can be optimized using query plans.

---

# 61. Availability and Database Load

Do not execute:

```text
SELECT all bookings
```

for every worker.

Instead use targeted queries/indexes.

Potential future optimization:

```text
precomputed availability windows
```

or:

```text
Redis availability index
```

when volume justifies it.

---

# 62. Scalability Evolution

### Stage 1

```text
PostgreSQL
+
simple availability queries
```

### Stage 2

```text
PostgreSQL
+
Redis cache
```

### Stage 3

```text
PostgreSQL
+
Redis
+
background availability updates
```

### Stage 4

If actual scale requires:

```text
Dedicated scheduling/availability service
```

Again:

> The logical module should exist before the physical microservice.

---

# 63. Testing Requirements

Availability is highly state-dependent and needs extensive tests.

Test:

```text
Worker active
Worker suspended
Accepting on/off
Working hours
Outside working hours
Leave
Existing booking
Overlapping booking
Capacity full
Capacity available
Immediate request
Scheduled request
Rescheduled request
Cancelled booking
Concurrent booking
Timezone conversion
Offer expiry
```

---

# 64. Important Edge Cases

### Edge Case 1 — Worker turns off availability during offer

```text
Offer sent
      ↓
Worker OFF
      ↓
Worker accepts old offer
```

The system must decide whether acceptance is still allowed and revalidate state.

### Edge Case 2 — Worker gets another booking

```text
Availability checked
      ↓
Another booking confirmed
      ↓
Original worker accepts
```

Final booking must revalidate capacity.

### Edge Case 3 — Worker leaves app offline

Presence expires.

### Edge Case 4 — Schedule crosses midnight

Example:

```text
22:00 – 02:00
```

The scheduling model must support it if eventually allowed.

---

# 65. No-Show Relationship

A worker no-show should not necessarily permanently reduce availability.

However, the event can influence future reliability metrics.

Example:

```text
Worker no-show
      ↓
Job outcome
      ↓
Reputation / reliability data
```

This is separate from scheduling.

---

# 66. Availability vs Reliability

Do not mix:

```text
"Can worker do this job?"
```

with:

```text
"How reliably does worker perform?"
```

Availability answers the first.

Reputation/reliability answers the second.

Matching may consume both.

---

# 67. Worker Controls

The worker application should eventually expose:

```text
Accepting Jobs
Working Hours
Days Off
Temporary Unavailability
Service Areas
Maximum Active Jobs
```

The worker should have control over their marketplace participation.

---

# 68. Admin Controls

Admin may need:

```text
force suspend
override availability
block worker from new jobs
modify supported schedule rules
```

Admin overrides must be:

```text
audited
```

and should not silently overwrite worker history.

---

# 69. Auditability

Important availability changes:

```text
WORKER_ENABLED_ACCEPTING_JOBS
WORKER_DISABLED_ACCEPTING_JOBS
SCHEDULE_UPDATED
LEAVE_CREATED
LEAVE_CANCELLED
CAPACITY_UPDATED
ADMIN_AVAILABILITY_OVERRIDE
```

should be traceable.

---

# 70. Core Invariants

The availability subsystem should guarantee:

```text
1. Suspended workers cannot receive new assignments.
2. Workers not accepting jobs should not receive new offers.
3. Workers outside their schedule should not be considered available.
4. Leave overrides normal working hours.
5. Capacity cannot become negative.
6. Confirmed bookings must affect future availability.
7. Cancelled bookings must release capacity/time.
8. Rescheduling must revalidate availability.
9. Offer acceptance must revalidate relevant conditions.
10. Availability reads cannot replace booking concurrency guarantees.
11. Redis failure must not corrupt booking correctness.
12. Time calculations must respect worker timezone.
```

---

# 71. Conceptual Architecture

```text
                    WORKER
                      │
          ┌───────────┼────────────┐
          ↓           ↓            ↓
     Schedule     Acceptance    Capacity
          │           │            │
          └───────────┼────────────┘
                      ↓
                 Availability
                      │
              ┌───────┴────────┐
              ↓                ↓
           Matching         Booking
              │                │
              ↓                ↓
         Worker Offer     Reservation
              │                │
              └───────┬────────┘
                      ↓
                     JOB
                      │
              ┌───────┴────────┐
              ↓                ↓
           Started          Completed
              │                │
              └───────┬────────┘
                      ↓
              Capacity Released
```

---

# 72. Complete Matching + Availability Flow

```text
Customer
   ↓
Service Request
   ↓
Matching Engine
   ↓
PostGIS Candidate Discovery
   ↓
Profession / Skill Filter
   ↓
Availability Check
   ├── Schedule
   ├── Leave
   ├── Acceptance
   ├── Capacity
   └── Booking Conflicts
   ↓
Eligible Workers
   ↓
Ranking
   ↓
Worker Offer
   ↓
Worker Accepts
   ↓
Availability Revalidation
   ↓
Atomic Booking Confirmation
   ↓
Job
```

---

# 73. Final Architectural Decisions

### Decision 1

Availability is a domain concept, not a boolean.

### Decision 2

Worker account status and job acceptance are separate.

### Decision 3

Scheduled availability and current presence are separate.

### Decision 4

Capacity and schedule are separate concepts.

### Decision 5

PostgreSQL is authoritative for persistent availability and booking state.

### Decision 6

Redis may accelerate presence and operational availability.

### Decision 7

Availability must be revalidated during booking.

### Decision 8

Booking concurrency must be enforced independently of availability checks.

### Decision 9

MVP scheduling remains intentionally simple.

### Decision 10

Future scheduling can incorporate duration, travel time and routing.

### Decision 11

Worker timezone must be represented explicitly.

### Decision 12

Availability logic should be centralized rather than duplicated across modules.

### Decision 13

Availability changes should be auditable.

### Decision 14

The logical availability/scheduling boundary should be designed so it can later become an independent service.

---

# 74. MVP Scope

Implement:

```text
✓ Accepting jobs ON/OFF
✓ Weekly working hours
✓ Basic temporary unavailability
✓ Maximum active jobs
✓ Basic booking conflict detection
✓ Availability revalidation
✓ UTC timestamps
✓ Worker timezone
✓ Basic Redis presence if realtime behavior requires it
```

Defer:

```text
✗ Advanced calendar
✗ Route optimization
✗ Travel-time scheduling
✗ AI scheduling
✗ Complex recurring exceptions
✗ Multi-region scheduling
✗ Dedicated scheduling microservice
```

---

# 75. Final Principle

The most important concept from this document is:

> **"Available" does not mean merely online.**

A worker is available for a particular job only when the worker:

```text
can perform the service
+
accepts new work
+
serves the location
+
is available at the requested time
+
has sufficient capacity
+
does not have a conflicting booking
+
meets required verification
```

This makes availability a **contextual calculation** rather than a single worker property.

---

## Document Status

**Completed:** High-level Worker Availability, Scheduling & Capacity Architecture.

**LLD remains intentionally postponed.**

When we eventually enter LLD, we will define the exact Java implementation for:

* availability aggregates
* schedule value objects
* time-window models
* availability policies
* conflict detection
* repository queries
* PostgreSQL range/index strategy
* Redis presence
* optimistic/pessimistic locking
* booking concurrency
* scheduled background jobs
* Spring transactions
* tests.

Those details should come **after the complete architecture documentation set**, as planned.

## Next Document

**[modules/05](05-notification-and-communication.md) — Notification & Communication Architecture**

That document will define how the platform communicates events such as:

```text
Service Request Created
Worker Match Found
Worker Accepted
Booking Confirmed
Worker En Route
Worker Arrived
Additional Work Requested
Payment Successful
Job Completed
Cancellation
Dispute
```

It will cover **in-app notifications, push notifications, SMS, WhatsApp, email, WebSockets, notification preferences, templates, retries, delivery status, idempotency, queues, provider abstraction, rate limiting, failure handling, and scaling to millions of notifications**.
