# Matching Engine & Geospatial Discovery Design

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

The matching engine is responsible for answering:

> **Which workers are suitable for a particular service request?**

and eventually:

> **In what order should those workers be considered or shown?**

For example:

```text
Customer
   │
   │ "Need electrician for fan repair"
   ↓
Service Request
   │
   ├── Profession: Electrician
   ├── Location: Customer location
   ├── Time: Today 6 PM
   ├── Urgency: Normal
   └── Description
          │
          ↓
     MATCHING ENGINE
          │
          ↓
 ┌────────┼────────┐
 ↓        ↓        ↓
Worker A Worker B Worker C
 2.1 km   3.4 km   5.2 km
```

The engine must determine:

* who is eligible
* who is nearby
* who has the required skill
* who is available
* who can serve the location
* who is verified
* who should receive the opportunity first
* how many workers should be notified
* what happens when workers reject
* what happens when workers do not respond
* what happens when multiple workers accept simultaneously.

---

# 2. Matching Is Not Just "Find Nearby Workers"

A naive implementation might do:

```sql
SELECT *
FROM workers
WHERE distance < 5km;
```

That is insufficient.

A nearby worker may:

* be a plumber instead of electrician
* not have the required skill
* be unavailable
* not accept jobs currently
* be suspended
* not serve the area
* already have too many jobs
* fail required verification
* be unavailable at the requested time.

Therefore:

> **Geospatial proximity is one matching signal, not the complete matching algorithm.**

---

# 3. Matching Responsibilities

The matching subsystem has several responsibilities.

```text
Candidate Discovery
        ↓
Eligibility Filtering
        ↓
Candidate Ranking
        ↓
Offer Creation
        ↓
Worker Notification
        ↓
Worker Response
        ↓
Booking Confirmation
```

These should remain conceptually separate.

---

# 4. Candidate Discovery

Candidate discovery answers:

> Which workers could potentially perform this job?

Example:

```text
Request:
Electrician
Location:
Howrah
Radius:
5 km
```

Candidate discovery might return:

```text
Worker A
Worker B
Worker C
Worker D
Worker E
```

At this stage we are **not yet deciding the final worker**.

---

# 5. Eligibility Filtering

Before ranking, eliminate workers who cannot perform the job.

Potential filters:

```text
Worker active
        AND
Required profession
        AND
Required skills
        AND
Required verification
        AND
Accepting jobs
        AND
Within service area
        AND
Available at requested time
        AND
Capacity available
```

Conceptually:

```text
Eligible =
    Active
    ∧ ProfessionMatch
    ∧ SkillMatch
    ∧ VerificationMatch
    ∧ AvailabilityMatch
    ∧ GeographicMatch
    ∧ CapacityMatch
```

---

# 6. Hard Constraints vs Ranking Signals

This distinction is extremely important.

Some conditions should be **hard constraints**.

Example:

```text
Worker is suspended
```

The worker should not be matched.

Other factors should be **ranking signals**.

Example:

```text
Worker is 2 km away
Worker is 3 km away
```

Both may be eligible, but the closer worker could be considered earlier.

Therefore:

```text
Hard Constraints
      ↓
Candidate Set
      ↓
Ranking
      ↓
Offers
```

---

# 7. Hard Constraints

Potential MVP hard constraints:

### Worker account

```text
ACTIVE
```

### Job acceptance

```text
acceptingJobs = true
```

### Profession

```text
Electrician
```

### Required skill

```text
Fan Installation
```

### Service area

Worker must serve the customer's location.

### Availability

Worker must be available for the requested time.

### Verification

Worker must satisfy minimum verification requirements.

### Capacity

Worker must not exceed configured active-job capacity.

---

# 8. Geographic Matching

The initial system should use:

> **PostgreSQL + PostGIS**

rather than calculating distance in Java.

Why?

Because the database can efficiently perform spatial filtering using spatial indexes.

Conceptually:

```text
Customer Point
      ↓
PostGIS
      ↓
Workers within radius
```

---

# 9. Location Representation

Use:

```text
geography(Point, 4326)
```

for worker/service-request coordinates.

Example conceptually:

```text
Worker:
latitude  = 22.xxxx
longitude = 88.xxxx
```

stored as a spatial point.

The service request should also preserve its own location snapshot.

---

# 10. Why the Request Must Preserve Location

Suppose the customer selects:

```text
Home A
```

and creates a request.

Later the customer edits their saved address:

```text
Home A → Home B
```

The old request must still point to:

```text
Home A
```

Therefore:

```text
Saved Address
       ↓
Request Location Snapshot
```

The matching engine should use the request snapshot, not a mutable customer address.

---

# 11. PostGIS Radius Query

Conceptually:

```sql
SELECT worker_id
FROM worker_locations
WHERE ST_DWithin(
    location,
    :requestLocation,
    :radiusMeters
);
```

The actual production query and indexes will be finalized during implementation/LLD.

The important architectural decision is:

> **Use indexed database-level geospatial filtering rather than loading all workers into the application.**

---

# 12. Spatial Index

The worker location table should have a spatial index.

Conceptually:

```sql
CREATE INDEX idx_worker_locations_geo
ON worker_locations
USING GIST(location);
```

This allows PostgreSQL/PostGIS to efficiently find nearby candidates.

---

# 13. Initial Matching Radius

Do not assume one global radius forever.

Example:

```text
Round 1 → 2 km
Round 2 → 5 km
Round 3 → 10 km
```

The exact values are product/business decisions.

The architecture should allow radius expansion.

---

# 14. Progressive Radius Expansion

Suppose there are no suitable electricians within 2 km.

Instead of immediately searching the entire city:

```text
2 km
 ↓
5 km
 ↓
10 km
 ↓
No match
```

This can improve:

* worker relevance
* response time
* customer experience
* notification efficiency.

---

# 15. Matching Rounds

Matching can therefore be modeled as rounds.

Example:

```text
Matching Round 1
Radius = 2 km
Candidates = 4
```

If no worker accepts:

```text
Matching Round 2
Radius = 5 km
Candidates = 8
```

Then:

```text
Matching Round 3
Radius = 10 km
Candidates = 15
```

Eventually:

```text
MATCHED
```

or:

```text
FAILED_TO_MATCH
```

---

# 16. Why Matching Rounds Matter

Without rounds, the system may notify:

```text
100 workers
```

for a single job.

That creates:

* notification spam
* unnecessary competition
* poor worker experience
* more database writes
* more concurrent acceptance attempts.

Instead:

```text
Small candidate group
       ↓
Wait for responses
       ↓
Expand if necessary
```

---

# 17. Candidate Ranking

After hard filtering, candidates can be ranked.

Potential signals:

```text
Distance
Skill compatibility
Availability
Verification
Reliability
Expected travel time
Current workload
Customer preference
Recent acceptance behavior
```

For MVP, keep ranking simple and explainable.

---

# 18. Example Ranking

Suppose:

| Worker | Distance | Skill   | Available | Verification |
| ------ | -------: | ------- | --------- | ------------ |
| A      |   1.5 km | Strong  | Yes       | Verified     |
| B      |   2.0 km | Strong  | Yes       | Verified     |
| C      |   1.0 km | Partial | Yes       | Verified     |
| D      |   3.0 km | Strong  | Yes       | Verified     |

A simplistic distance-only ranking would produce:

```text
C
A
B
D
```

But if C lacks the required skill, it should not even enter the candidate set.

Then:

```text
A
B
D
```

This demonstrates:

> Eligibility comes before ranking.

---

# 19. Matching Score

A conceptual score could be:

```text
score =
    skillScore
  + availabilityScore
  + verificationScore
  + reliabilityScore
  + proximityScore
  + capacityScore
```

But do not immediately build a complicated mathematical model.

For MVP:

```text
Eligibility
    ↓
Distance
    ↓
Availability
    ↓
Verification
```

is sufficient.

---

# 20. Explainability

Workers and customers should not be affected by an opaque algorithm without understanding basic reasons.

Internally, the system should be able to answer:

> Why was Worker A considered?

Example:

```text
Profession matched
Required skill matched
Within service area
Available
Verified
Distance: 2.1 km
```

This will be valuable for debugging and marketplace operations.

---

# 21. Ranking Must Not Be Stored as Permanent Truth

Suppose:

```text
Worker A score = 87
```

That score depends on:

* current location
* current availability
* requested time
* request requirements
* worker state.

Therefore:

> Match score is contextual, not a permanent worker property.

Do not store:

```text
worker.matchScore = 87
```

as part of the worker profile.

---

# 22. Worker Location

The system should distinguish between:

### Service area

Where the worker is willing to work.

and:

### Current location

Where the worker currently is.

Example:

```text
Service area:
Howrah, up to 10 km

Current location:
Shibpur
```

Both can influence matching.

---

# 23. Location Privacy

Customers do not necessarily need to see:

```text
Worker exact GPS location
```

before booking.

They may only see:

```text
Approx. 2.1 km away
```

Similarly, worker location should only be exposed when operationally necessary.

---

# 24. Current Location Storage

Worker current location may change frequently.

Therefore it should not be treated exactly like normal profile data.

Potential architecture:

```text
Worker GPS
    ↓
Location ingestion
    ↓
Redis / location store
    ↓
Matching
```

while:

```text
Worker profile
Service area
Verification
Skills
```

remain in PostgreSQL.

For MVP, current worker location may be simplified depending on product requirements.

---

# 25. Do Not Store High-Frequency GPS in the Job Table

Bad approach:

```text
jobs
-----
latitude
longitude
updated every few seconds
```

This creates unnecessary transactional writes.

High-frequency telemetry should be separated from core transactional data.

Future architecture may use:

```text
Location Service / Redis / specialized location store
```

if real-time tracking becomes necessary.

---

# 26. Worker Availability

Matching should not simply check:

```text
worker.active = true
```

There are two different states:

```text
Account active
```

and:

```text
Currently accepting jobs
```

Example:

```text
Worker account:
ACTIVE

Accepting jobs:
FALSE
```

The worker exists but should not receive new requests.

---

# 27. Capacity

A worker may accept only a certain number of active jobs.

Example:

```text
Maximum active jobs = 3
Current active jobs = 3
```

The worker may be:

```text
acceptingJobs = true
```

but still should not receive another job if capacity is exhausted.

Therefore:

```text
Eligible =
Active
AND Accepting
AND CapacityAvailable
```

---

# 28. Scheduling

Suppose:

```text
Worker available:
2 PM – 6 PM

Customer request:
7 PM
```

Worker should not be considered eligible.

Future scheduling can become more sophisticated:

```text
Calendar
+
Travel time
+
Existing bookings
+
Service duration
```

But MVP can use a simpler availability model.

---

# 29. Skill Matching

Profession alone may not be enough.

Example:

```text
Profession:
Electrician
```

Skills:

```text
Fan Installation
MCB Repair
Wiring
Inverter Installation
AC Wiring
```

A request:

```text
Need inverter installation
```

should prioritize workers with:

```text
Inverter Installation
```

rather than every electrician.

---

# 30. Required Skills

Service catalog can define required capabilities.

Conceptually:

```text
Service:
Fan Installation

Required Skill:
Fan Installation
```

Then:

```text
Service Request
       ↓
Required Skills
       ↓
Worker Skills
```

This allows structured matching.

---

# 31. Skill Matching Levels

Future matching may support:

```text
Exact skill
Related skill
Profession-level capability
Certification
Experience
```

But MVP should avoid complicated inference.

Use explicitly defined skills.

---

# 32. Verification Matching

Different services may require different verification.

Example:

```text
Basic electrical repair
→ identity verification

Complex electrical installation
→ identity + profession verification
```

Therefore verification requirements should be configurable.

Conceptually:

```text
Service
   ↓
Verification Requirements
   ↓
Worker Verification Status
```

---

# 33. Reliability

Future ranking may consider:

* completed jobs
* cancellation rate
* worker no-show rate
* customer no-show rate
* response rate
* response time
* repeat customers
* dispute history.

However:

> These metrics should not become hidden punitive scoring without careful product validation.

A worker rejecting a job because it is too far should not automatically be treated as unreliable.

---

# 34. Worker Rejection Reasons

Useful structured reasons:

```text
TOO_FAR
BUSY
WRONG_SKILL
SCHEDULE_CONFLICT
NOT_INTERESTED
PRICE_NOT_SUITABLE
OTHER
```

These reasons can improve matching analytics.

Example:

```text
Too far:
42%

Busy:
31%

Wrong skill:
12%
```

This tells the product team where the marketplace has problems.

---

# 35. Offer Creation

After selecting candidates:

```text
Worker Match
```

records should be created.

Conceptually:

```text
ServiceRequest
      │
      ├── Match → Worker A
      ├── Match → Worker B
      └── Match → Worker C
```

Each match represents:

> This worker is eligible for this particular request.

---

# 36. Match Lifecycle

Conceptually:

```text
CREATED
   ↓
OFFERED
   ├── ACCEPTED
   ├── REJECTED
   ├── EXPIRED
   └── WITHDRAWN
```

This is separate from booking.

---

# 37. Match Is Not Booking

This distinction is critical.

Example:

```text
Worker Match
```

means:

> Worker has been offered this job.

While:

```text
Booking
```

means:

> Customer and worker have a confirmed service arrangement.

Therefore:

```text
Match
≠
Booking
```

---

# 38. Multiple Workers Can Accept

Suppose three workers receive an offer:

```text
Worker A → ACCEPT
Worker B → ACCEPT
Worker C → ACCEPT
```

The platform still needs:

```text
ONE CONFIRMED BOOKING
```

in the MVP.

Therefore, the booking confirmation process must be atomic.

---

# 39. Concurrent Acceptance

This is one of the most important concurrency problems.

Two workers may accept at almost exactly the same time.

```text
Worker A
   ↓
ACCEPT

Worker B
   ↓
ACCEPT
```

Both requests may reach different application instances.

The system cannot depend on:

```text
Java synchronized
```

because:

* there may be multiple application instances
* threads may run on different machines
* application restart loses locks.

---

# 40. Database-Level Guarantee

The database should enforce:

> At most one confirmed booking exists for a service request.

Conceptually:

```sql
UNIQUE(service_request_id)
WHERE status = 'CONFIRMED'
```

using an appropriate PostgreSQL partial unique index.

This gives a durable consistency guarantee.

---

# 41. Transactional Confirmation

Conceptually:

```text
BEGIN TRANSACTION

Check request state
Check match state
Attempt booking confirmation

Database guarantees:
one confirmed booking/request

Update request
Update match
Create booking
Create job
Create outbox event

COMMIT
```

Exact transaction boundaries will be designed during LLD.

---

# 42. What Happens to Other Matches?

Once Worker A is confirmed:

```text
Worker A → ACCEPTED → CONFIRMED
Worker B → ACCEPTED → SUPERSEDED
Worker C → OFFERED → WITHDRAWN
```

Those workers should receive appropriate notifications.

---

# 43. Customer-Selection Model

There are multiple possible marketplace designs.

### Model A — Worker-first acceptance

System sends job to workers.

First suitable worker accepts.

```text
Request
 ↓
Workers
 ↓
First accepted
```

### Model B — Customer chooses worker

System shows workers.

Customer selects one.

```text
Request
 ↓
Worker list
 ↓
Customer chooses
 ↓
Booking
```

### Model C — Hybrid

Workers accept interest first, then customer chooses from eligible/available workers.

These are product decisions.

The matching architecture should support evolution between them.

---

# 44. Initial Recommendation for Architecture

For the initial MVP, a practical flow is:

```text
Customer creates request
        ↓
Matching engine finds candidates
        ↓
Small number of workers receive offers
        ↓
Eligible worker accepts
        ↓
System atomically confirms booking
```

The exact customer interaction can be adjusted after product validation.

---

# 45. Notification Timing

A worker offer should have an expiration time.

Example:

```text
Offer created:
11:00

Expires:
11:02
```

If worker does not respond:

```text
OFFERED
   ↓
EXPIRED
```

Then another candidate can be considered.

---

# 46. Avoid Endless Matching

Every request needs an expiration policy.

Example:

```text
Request
 ↓
Round 1
 ↓
Round 2
 ↓
Round 3
 ↓
FAILED_TO_MATCH
```

Otherwise a request could remain:

```text
MATCHING
```

forever.

---

# 47. Matching Failure

Possible reasons:

```text
NO_ELIGIBLE_WORKERS
NO_AVAILABLE_WORKERS
NO_WORKER_ACCEPTED
REQUEST_EXPIRED
AREA_UNSUPPORTED
SERVICE_UNSUPPORTED
```

This is useful operational data.

---

# 48. Duplicate Requests

Customers may accidentally create:

```text
Request A:
Fan repair

Request B:
Fan repair
```

within a short period.

The system can detect possible duplicates using:

```text
customer
profession
location
time window
request similarity
```

Initially, the system may simply warn the customer.

Do not automatically merge requests without clear business rules.

---

# 49. Matching Event Flow

Conceptually:

```text
ServiceRequestSubmitted
          ↓
MatchingRequested
          ↓
CandidateDiscovery
          ↓
EligibilityFiltering
          ↓
CandidateRanking
          ↓
WorkerMatchCreated
          ↓
WorkerNotified
          ↓
WorkerAccepts
          ↓
BookingConfirmation
```

---

# 50. Synchronous vs Asynchronous Matching

For a small MVP, matching may initially be:

```text
POST /service-requests
        ↓
Create request
        ↓
Start matching
        ↓
Return response
```

But as scale increases:

```text
Create request
        ↓
Commit transaction
        ↓
Event
        ↓
Matching worker
        ↓
Candidates
```

becomes preferable.

---

# 51. Recommended Evolution

### Stage 1

```text
Spring Boot
   ↓
Matching application service
   ↓
PostGIS
```

### Stage 2

```text
Service Request
   ↓
Outbox
   ↓
Background worker
   ↓
Matching
```

### Stage 3

```text
Event Broker
   ↓
Dedicated Matching Workers
```

### Stage 4

If actual scale requires it:

```text
Matching Service
```

The domain boundary should exist before the physical microservice does.

---

# 52. Redis in Matching

Redis can support:

* short-lived worker availability
* candidate cache
* rate limiting
* distributed locks where genuinely necessary
* temporary offer state
* cooldowns
* request deduplication.

But:

> Redis must not become the authoritative source for permanent booking state.

PostgreSQL remains the source of truth.

---

# 53. Distributed Locking

Redis locks can sometimes be useful.

But do not use:

```text
Redis lock
```

as the only guarantee for booking correctness.

The strongest invariant should still be protected by:

```text
Database transaction
+
Database constraint
```

A distributed lock is an optimization/coordination mechanism, not the ultimate source of truth.

---

# 54. Matching Cache

Potential cache:

```text
requestId → candidate worker IDs
```

But candidate eligibility changes.

For example:

```text
Worker available at 11:00
Worker unavailable at 11:01
```

Therefore cached matching results must have short TTLs and/or revalidation.

Never assume cached availability is permanently correct.

---

# 55. Candidate Query Optimization

A scalable query should filter early.

Bad:

```text
Load 100,000 workers
       ↓
Java filters them
```

Better:

```text
PostGIS
 ↓
Geographic filtering
 ↓
SQL filters
 ↓
Small candidate set
 ↓
Java ranking
```

This minimizes:

* network transfer
* memory usage
* CPU usage.

---

# 56. Query Strategy

Potential sequence:

```text
1. Geographic filtering
2. Worker active status
3. Profession
4. Skills
5. Verification
6. Availability
7. Capacity
8. Ranking
9. Limit candidates
```

The exact SQL plan must be benchmarked.

---

# 57. Indexing

Potential indexes:

```text
worker_locations(location)
worker_skills(worker_id, skill_id)
worker_skills(skill_id, worker_id)
workers(profession_id, status)
worker_availability(...)
worker_service_areas(...)
```

The final index set must be based on actual query patterns and `EXPLAIN ANALYZE`.

---

# 58. Pagination vs Candidate Limits

Matching usually does not need:

```text
10,000 candidates
```

It may only need:

```text
Top 20 candidates
```

Then offer:

```text
5
```

and continue if necessary.

This limits work.

---

# 59. Fairness and Worker Opportunity

A marketplace must eventually consider more than pure ranking.

Suppose one worker is always selected because:

```text
Distance = 1 km
Rating = high
Response = fast
```

Other workers may receive almost no opportunities.

That can create marketplace imbalance.

Future ranking may need to consider:

```text
worker opportunity
recent jobs
idle time
availability
service quality
```

This should be evaluated using marketplace data rather than arbitrarily encoded early.

---

# 60. Avoid Rating-Only Matching

A common mistake:

```text
ORDER BY rating DESC
```

This can produce undesirable outcomes.

Why?

Because:

* rating count matters
* new workers have little history
* ratings may be noisy
* distance matters
* availability matters
* skill matters
* worker opportunity matters.

Rating should be one signal, not the entire algorithm.

---

# 61. Cold Start Problem

New worker:

```text
0 jobs
0 reviews
```

Established worker:

```text
500 jobs
4.9 rating
```

If ranking relies heavily on historical reputation, the new worker may never receive enough jobs to build reputation.

Therefore the system should eventually support a cold-start strategy.

For example:

```text
Eligibility
+
Basic ranking
+
Controlled exposure
```

The exact policy should be decided using real marketplace data.

---

# 62. Customer Preferences

Future customers may specify:

```text
Preferred worker
Nearest worker
Highly rated
Available now
Lowest estimated price
Same worker as previous job
```

These can become ranking or filtering inputs.

---

# 63. Repeat Worker Matching

Suppose customer previously used:

```text
Worker A
```

and wants the same worker again.

Flow:

```text
Customer
   ↓
Book Again
   ↓
Check Worker Availability
   ↓
If available
   ↓
Offer / Booking
```

This can improve repeat usage without bypassing the marketplace.

---

# 64. Worker Service Area vs Radius

MVP:

```text
center point + radius
```

Future:

```text
multiple service areas
localities
postal codes
polygons
travel-time zones
dynamic service radius
```

Do not prematurely build polygon management.

---

# 65. Travel Time

Distance is not always equal to travel time.

Example:

```text
Worker A:
2 km away
Heavy traffic

Worker B:
4 km away
Easy road
```

Worker B could potentially arrive sooner.

Future matching can use:

```text
routing provider
+
ETA
```

But external routing APIs have:

* cost
* latency
* quotas
* availability issues.

Therefore initial matching should use straight-line geospatial distance.

---

# 66. Matching and Pricing

Matching should generally not become a pricing engine.

For example:

```text
Matching:
Who can do this job?
```

Pricing:

```text
How much should this job cost?
```

These are different responsibilities.

Matching may use price information as a ranking signal later, but it should not own the pricing rules.

---

# 67. Matching and Reputation

Similarly:

```text
Matching
```

may consume reputation information.

But:

```text
Reputation
```

should be owned by the trust/reputation domain.

This keeps module boundaries clean.

---

# 68. Matching Module Boundary

Conceptually:

```text
matching/
├── candidate discovery
├── eligibility
├── ranking
├── match creation
├── matching rounds
└── matching policies
```

It should consume information from:

```text
worker
catalog
availability
service request
reputation
```

without taking ownership of those domains.

---

# 69. Matching Policies

The algorithm should be policy-driven.

Conceptually:

```text
CandidateEligibilityPolicy
CandidateRankingPolicy
MatchingRadiusPolicy
OfferExpirationPolicy
CandidateSelectionPolicy
```

This makes future experimentation easier.

For example:

```text
MVP ranking
```

can later become:

```text
v2 ranking
```

without rewriting the whole matching subsystem.

---

# 70. Avoid ML Initially

Do not start with:

```text
AI matching model
```

The platform initially lacks sufficient data.

You need real data about:

* worker acceptance
* rejection
* completion
* travel
* cancellations
* customer satisfaction
* repeat jobs
* job complexity
* actual duration.

Start with deterministic rules.

Later, data can improve ranking.

---

# 71. Future ML Architecture

Eventually:

```text
Historical Marketplace Data
          ↓
Feature Engineering
          ↓
Ranking Model
          ↓
Candidate Score
          ↓
Policy / Safety Layer
          ↓
Worker Offers
```

But the model should not directly bypass hard business constraints.

For example:

```text
ML score = 99
```

must not make a suspended worker eligible.

---

# 72. Observability

Matching needs dedicated metrics.

Important metrics:

```text
match_success_rate
time_to_first_offer
time_to_match
candidate_count
offer_count
acceptance_rate
rejection_rate
offer_expiration_rate
no_eligible_worker_rate
distance_at_match
worker_response_time
```

These help diagnose marketplace health.

---

# 73. Example Matching Metrics

Suppose:

```text
10,000 service requests
```

Results:

```text
8,500 matched
1,000 expired
500 no eligible worker
```

Then:

```text
Match success = 85%
```

The next question becomes:

> Why did 500 requests have no eligible worker?

Maybe:

```text
60% insufficient workers
25% skill mismatch
10% availability
5% verification
```

This is much more actionable than simply measuring app downloads.

---

# 74. Failure Handling

Matching can fail because:

* PostGIS unavailable
* database timeout
* Redis unavailable
* notification provider unavailable
* worker notification fails
* worker responds after offer expiry
* duplicate matching event
* application restart.

The system should safely retry where appropriate.

---

# 75. Matching Must Be Idempotent

Suppose:

```text
ServiceRequestSubmitted
```

is processed twice.

Without idempotency:

```text
WorkerMatch A
WorkerMatch A
WorkerMatch A
```

could be created multiple times.

Use uniqueness:

```text
(service_request_id, worker_id)
```

and/or idempotency keys.

---

# 76. Eventual Consistency

Matching does not need every component to update synchronously.

Example:

```text
Request created
   ↓
Matching
   ↓
Worker notification
```

Notification can be eventually consistent.

But:

```text
Booking confirmation
```

must be strongly consistent.

Therefore:

```text
Matching discovery → eventual consistency acceptable
Booking confirmation → strong transactional consistency required
```

---

# 77. Horizontal Scaling

Suppose the application grows from:

```text
1 instance
```

to:

```text
10 instances
```

Matching must still behave correctly.

The design should rely on:

```text
PostgreSQL constraints
+
transactions
+
idempotency
+
distributed-safe background processing
```

not:

```text
in-memory variables
```

such as:

```java
Map<UUID, Boolean> activeRequests;
```

---

# 78. Scaling Architecture

Initial:

```text
                 ┌─────────────┐
Customer ───────→│ Spring Boot │
                 └──────┬──────┘
                        ↓
                 ┌─────────────┐
                 │ PostgreSQL  │
                 │ + PostGIS   │
                 └─────────────┘
```

Growth:

```text
                 ┌─────────────┐
                 │ LoadBalancer│
                 └──────┬──────┘
                        ↓
              ┌─────────┼─────────┐
              ↓         ↓         ↓
           App-1     App-2     App-3
              │         │         │
              └─────────┼─────────┘
                        ↓
                  PostgreSQL
                   + PostGIS
```

Later:

```text
Service Request
      ↓
Outbox / Broker
      ↓
Matching Workers
      ↓
PostGIS
      ↓
Worker Offers
```

---

# 79. What Should Remain in PostgreSQL?

Source of truth:

```text
Worker profile
Worker skills
Worker verification
Service request
Worker match
Booking
Job
```

Redis may accelerate:

```text
availability
temporary candidate data
locks
rate limits
```

but should not replace the transactional database.

---

# 80. Security

Matching must respect authorization.

A customer should not be able to query:

```text
all workers' private information
```

or:

```text
exact worker GPS coordinates
```

unless explicitly allowed.

The matching service may know more internally than the API exposes.

---

# 81. Abuse Prevention

Potential abuse:

```text
Customer creates 1,000 fake requests
```

This could spam workers.

Therefore:

```text
rate limiting
request quotas
duplicate detection
account reputation
fraud detection
```

will eventually be required.

For MVP, basic rate limiting is sufficient.

---

# 82. Worker Spam Protection

Workers should not receive excessive irrelevant jobs.

The system should track:

```text
offers per worker
offer frequency
category relevance
distance
response rate
```

This protects worker trust in the platform.

---

# 83. Marketplace Feedback Loop

Matching creates valuable feedback.

```text
Request
 ↓
Candidates
 ↓
Offers
 ↓
Accept/Reject
 ↓
Booking
 ↓
Completion
 ↓
Review
```

This data can later improve:

```text
matching
pricing
service catalog
worker onboarding
coverage planning
```

---

# 84. Example End-to-End Matching Scenario

Customer:

> "My ceiling fan stopped working."

Location:

```text
Howrah
```

Required:

```text
Profession = Electrician
Skill = Fan Repair
```

### Step 1

Request created.

### Step 2

Matching starts.

### Step 3

PostGIS searches:

```text
2 km
```

### Step 4

10 nearby workers found.

### Step 5

Filters:

```text
3 suspended/unavailable
2 lack required skill
```

Remaining:

```text
5 eligible workers
```

### Step 6

Ranking:

```text
Worker A → 1.2 km
Worker B → 1.7 km
Worker C → 2.0 km
Worker D → 2.0 km
Worker E → 2.0 km
```

### Step 7

Offer sent to:

```text
A, B, C
```

### Step 8

A rejects:

```text
TOO_FAR
```

### Step 9

B accepts.

### Step 10

Atomic booking confirmation:

```text
Request → BOOKED
Match B → ACCEPTED
Booking → CONFIRMED
Job → CONFIRMED
```

### Step 11

Other offers withdrawn.

---

# 85. Example Concurrent Scenario

At the same time:

```text
Worker A → ACCEPT
Worker B → ACCEPT
```

Both requests arrive.

Database transaction:

```text
A:
INSERT CONFIRMED BOOKING
      ↓
SUCCESS

B:
INSERT CONFIRMED BOOKING
      ↓
UNIQUE CONSTRAINT FAILURE
```

Result:

```text
Worker A → confirmed
Worker B → superseded
```

This is the kind of invariant that must remain correct even under high concurrency.

---

# 86. Initial MVP Matching Algorithm

The first implementation can be:

```text
1. Validate service request
2. Determine required profession
3. Determine required skills
4. Search nearby workers using PostGIS
5. Filter active workers
6. Filter accepting workers
7. Filter verified workers
8. Filter service-area compatibility
9. Filter availability
10. Filter capacity
11. Rank by distance + basic relevance
12. Select limited candidates
13. Create worker matches
14. Send notifications
15. Wait for responses
16. Expand radius if required
17. Confirm booking atomically
18. End matching
```

This is intentionally simple.

---

# 87. Future Matching Evolution

### Version 1

```text
Distance
+
Skills
+
Availability
```

### Version 2

```text
Distance
+
Skills
+
Availability
+
Reliability
+
Capacity
```

### Version 3

```text
ETA
+
Customer preference
+
Worker opportunity
+
Historical outcomes
```

### Version 4

```text
ML-assisted ranking
```

The underlying domain does not need to change drastically.

---

# 88. Key Architectural Decisions

### Decision 1

Use PostgreSQL + PostGIS for primary geospatial candidate discovery.

### Decision 2

Separate eligibility from ranking.

### Decision 3

Use hard constraints for safety/business correctness.

### Decision 4

Start with a deterministic, explainable ranking algorithm.

### Decision 5

Use progressive matching rounds.

### Decision 6

Use limited candidate offers rather than notifying everyone.

### Decision 7

Keep Match separate from Booking.

### Decision 8

Guarantee one confirmed booking through database constraints and transactions.

### Decision 9

Keep high-frequency GPS telemetry separate from core transactional tables.

### Decision 10

Use Redis for acceleration/temporary state, not permanent transactional truth.

### Decision 11

Make matching idempotent.

### Decision 12

Design the matching module so it can eventually become an independent service.

### Decision 13

Do not introduce ML before sufficient real marketplace data exists.

### Decision 14

Do not introduce a dedicated matching microservice merely because the system is called "scalable."

---

# 89. Core Matching Invariants

The system must guarantee:

```text
1. Suspended workers cannot receive jobs.
2. Workers without required capabilities cannot be matched.
3. Unavailable workers should not receive new offers.
4. Workers outside supported geography should not be matched.
5. Match records are unique per request/worker.
6. Expired offers cannot become valid bookings.
7. One request has at most one confirmed booking in MVP.
8. Booking confirmation is concurrency-safe.
9. Matching retries do not duplicate offers incorrectly.
10. Customer and worker private locations are protected.
11. Matching failure eventually terminates.
12. Matching state is recoverable after application restart.
```

---

# 90. Final Architecture

```text
                     SERVICE REQUEST
                           │
                           ↓
                  ┌─────────────────┐
                  │ MATCHING ENGINE │
                  └────────┬────────┘
                           │
             ┌─────────────┴─────────────┐
             ↓                           ↓
      Candidate Discovery          Request Requirements
             │                           │
             ↓                           ↓
          PostGIS                  Skills / Profession
             │                           │
             └─────────────┬─────────────┘
                           ↓
                  Eligibility Filter
                           │
                           ↓
                     Candidate Set
                           │
                           ↓
                       Ranking
                           │
                           ↓
                   Matching Round
                           │
                           ↓
                    Worker Matches
                           │
                           ↓
                    Notifications
                           │
                           ↓
                   Worker Response
                           │
                    ┌──────┴──────┐
                    ↓             ↓
                 Reject         Accept
                    │             │
                    │             ↓
                    │       Atomic Booking
                    │             │
                    │             ↓
                    │       Confirmed Job
                    │
                    └──── Next Matching Round
```

---

# 91. Final Principles

The matching system should follow these principles:

1. **Matching is a marketplace engine, not a simple SQL search.**
2. **Eligibility comes before ranking.**
3. **Geographic distance is a signal, not the entire algorithm.**
4. **Worker capability must be explicit.**
5. **Availability must be separate from worker account status.**
6. **Service area must be separate from current location.**
7. **Match must remain separate from booking.**
8. **Multiple workers may receive an offer, but MVP confirms only one.**
9. **Concurrent acceptance must be handled at the database/transaction level.**
10. **Matching should be explainable.**
11. **Start with deterministic rules, not ML.**
12. **Use progressive radius expansion.**
13. **Do not spam every nearby worker.**
14. **Use Redis as an accelerator, not the source of truth.**
15. **Keep high-frequency location data separate from transactional job data.**
16. **Make matching idempotent and restart-safe.**
17. **Design for horizontal scaling from the beginning.**
18. **Keep the physical architecture simple until real scale requires extraction.**
19. **Preserve module boundaries so the matching engine can later become an independent service.**
20. **Optimize for successful completed jobs, not merely successful matches.**

---

## Document Status

**Completed:** High-level Matching Engine & Geospatial Discovery Architecture.

**LLD intentionally postponed.**

The eventual LLD phase will define the concrete Java/Spring Boot implementation, including:

* `MatchingService`
* candidate discovery interfaces
* PostGIS repository implementation
* ranking policies
* matching-round orchestration
* concurrency handling
* transaction boundaries
* domain events
* Redis integration
* database queries
* JPA/native query boundaries
* test strategy
* exact class/interface relationships.

That will be done **after the remaining architecture/product documentation is complete**.

## Next Document

**[modules/04](../../modules/04-worker-availability-scheduling-and-capacity.md) — Worker Availability, Scheduling & Capacity Management**

That document will define how a worker tells the platform:

> “I am currently available, I work in these areas, I can accept this many jobs, and I am available at these times.”

It will cover **online/offline state, working hours, time slots, leave, existing bookings, overlapping jobs, capacity, scheduling conflicts, timezone handling, Redis presence, race conditions, and future real-time availability**, while keeping the design scalable without prematurely overengineering it.
