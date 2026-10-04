# Matching Engine & Geospatial Discovery Design

**Project:** Karigar Marketplace
**Status:** Architecture / Engineering Design
**Architecture:** Modular Monolith
**Primary Stack:** Java + Spring Boot + PostgreSQL + PostGIS + Redis

---

## Current Model (aligned with ERD and ADRs)

The [ERD](../architecture/03-erd-and-production-database-design.md) (§14.1, §22–34.2) is the source of truth for tables and statuses; [ADR 0017](../adr/0017-customer-picks-the-worker.md) decides who picks the worker; [ADR 0011](../adr/0011-explainable-rule-based-matching.md) covers rule-based ranking. Where an older passage below disagrees, this section wins.

- **Customer picks the worker.** The platform notifies nearby, verified, available workers who practise the requested trade (`worker_professions.status = 'ACTIVE'` for `service_requests.profession_id`). Interested workers **accept** with their visit charge and ETA / available-from time. The customer sees up to **3** accepted workers (the shortlist) and selects one; that selection creates the booking. Accepting never creates a booking.
- **`worker_matches` statuses:** `NOTIFIED → VIEWED → ACCEPTED → SELECTED | NOT_SELECTED`, plus `DECLINED`, `EXPIRED`, `WITHDRAWN` (worker pulls out before the customer picks). Each row carries `round_no`, `source` (`MATCHING` | `FAVOURITE`), `distance_meters`, `ranking_score`, `offered_visit_charge_minor`, `eta_minutes`, `available_from`, `decline_reason_code`, `expires_at`.
- **Rounds:** round 1 notifies the best N eligible workers in the first radius; if fewer than 3 have accepted when the round window ends, the radius widens and the next N are notified (`round_no` + 1). No acceptance after the last round → request `FAILED_TO_MATCH`. N, radius steps, round window, response window and shortlist size are **configuration**. Defaults: radius 3 → 6 → 10 km, shortlist 3, response window by urgency — NOW 30 min, TODAY 1 h, SCHEDULED 4 h, EMERGENCY 10 min. This is **not real-time dispatch**: offers arrive as a push notification plus a job inbox, and workers answer when they can ([LLD-007](../lld/lld-007-matching-candidate-search.md)).
- **Favourites first:** workers in the customer's `favourite_workers` ("My workers") are notified first with `source = FAVOURITE`.
- **Uniqueness:** at most one *live* offer per worker per request (partial unique index on `NOTIFIED`, `VIEWED`, `ACCEPTED`, `SELECTED`), so a later round may re-offer a worker whose earlier offer expired or was declined; at most one `SELECTED` match per request.
- **Geo:** match `service_requests.location` (a snapshot of the saved address, `geography(Point, 4326)`) against each worker's service area (center + `radius_meters`) with `ST_DWithin` in metres on `::geography`; join `worker_professions` (one row per worker, no duplicates), `ORDER BY` ranking, `LIMIT N`.
- **Request preconditions:** saved address (snapshot copied to the request), `service_zone` must be `ACTIVE`, urgency `NOW | TODAY | SCHEDULED`. Request statuses used here: `SUBMITTED → MATCHING → AWAITING_SELECTION → BOOKED`, or `FAILED_TO_MATCH` / `EXPIRED` / `CANCELLED`.
- **Selection transaction:** lock the request, check the match is `ACCEPTED` and not expired, set it `SELECTED`, set other accepted matches `NOT_SELECTED`, create the booking (one-live-booking index `WHERE status <> 'CANCELLED'`), job and planned `job_visits` (overlap blocked by `EXCLUDE USING gist`).

---

# 1. Purpose

The matching engine is responsible for answering:

> Given a customer's service request, which workers are suitable candidates for this job?

This is one of the core systems of the marketplace.

The matching system must consider more than geographic distance.

A worker being nearby does not necessarily mean the worker is suitable.

The system should consider:

```text
Profession
Skills
Location
Service Area
Availability
Verification
Worker Status
Scheduled Time
Current Workload
Reliability
Customer Requirements
```

The initial matching system should be:

> deterministic, explainable, measurable, and simple enough to operate.

We should **not** begin with machine learning.

---

# 2. Matching Problem

Suppose a customer creates:

```text
Service Request
-------------------------
Profession: Electrician
Problem: Fan not working (common problem ELEC_FAN_NOT_WORKING)
Location: saved address in Howrah (zone ACTIVE)
Preferred time: 6 PM
Urgency: TODAY
```

There may be 500 electricians in the broader marketplace.

The system should not send the request to all 500.

It should progressively reduce the candidate set.

```text
All Workers
     ↓
Active Workers
     ↓
Verified Workers
     ↓
Electricians
     ↓
Required Skills
     ↓
Available at requested time
     ↓
Within service area
     ↓
Geographically close
     ↓
Eligible candidates
     ↓
Rank candidates
     ↓
Notify workers (offers)
     ↓
Workers accept → customer shortlist (max 3)
     ↓
Customer selects one → booking
```

---

# 3. Matching Is Not Search

These are related but different concepts.

### Search

The customer explicitly searches:

> Electricians near me

The system returns workers.

### Matching

The customer creates:

> I need an electrician to fix my ceiling fan at 6 PM.

The system proactively determines:

> Which workers should receive this job?

Therefore:

```text
Worker Discovery
≠
Job Matching
```

The same underlying geographic and skill infrastructure may support both.

---

# 4. Core Matching Flow

The initial architecture:

```text
Customer
   │
   │ Create Service Request
   ▼
Service Request
   │
   ▼
Matching Engine
   │
   ├── Profession Filter
   ├── Skill Filter
   ├── Verification Filter
   ├── Availability Filter
   ├── Service Area Filter
   └── Geographic Filter
   │
   ▼
Candidate Workers
   │
   ▼
Ranking
   │
   ▼
Match Offers
   │
   ├── Worker A
   ├── Worker B
   ├── Worker C
   └── Worker D
```

---

# 5. Candidate Discovery vs Ranking

These should be separate stages.

## Candidate Discovery

Question:

> Who is eligible?

Example:

```text
Electrician
AND
active
AND
verified
AND
accepting jobs
AND
within geographic radius
AND
available
```

---

## Ranking

Question:

> Among eligible workers, who should receive the opportunity first?

Example:

```text
Worker A → 2.1 km
Worker B → 3.4 km
Worker C → 1.8 km
```

Distance alone should not necessarily determine ordering.

---

# 6. Matching Pipeline

Recommended pipeline:

```text
                 Service Request
                       │
                       ▼
              ┌─────────────────┐
              │ Eligibility     │
              │ Filters         │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Geospatial      │
              │ Candidate Query │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Skill / Time    │
              │ Validation      │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Candidate       │
              │ Ranking         │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Offer Strategy  │
              └────────┬────────┘
                       │
                       ▼
                 Worker Matches
```

---

# 7. PostgreSQL + PostGIS

The project uses:

```text
PostgreSQL
+
PostGIS
```

for geographic matching.

This allows the database to efficiently answer questions such as:

> Find workers within 5 km of this service request.

Instead of retrieving every worker and calculating distance inside Java.

---

# 8. Location Representation

Worker location should use:

```sql
GEOGRAPHY(Point, 4326)
```

Conceptually:

```text
worker_locations
------------------------
worker_id
location
updated_at
```

Example:

```text
POINT(longitude latitude)
```

The exact database representation should be handled carefully because PostGIS point coordinates use:

```text
longitude latitude
```

while many APIs represent coordinates as:

```json
{
  "latitude": ...,
  "longitude": ...
}
```

The application mapper must not accidentally reverse them.

---

# 9. Why Geography?

For this marketplace, `geography` is useful because we care about real-world distance.

Example:

```text
Worker:
22.5958, 88.2636

Customer:
22.5726, 88.3639
```

PostGIS can calculate distance in meters.

This makes queries such as:

```text
within 3 km
within 5 km
```

natural.

---

# 10. Spatial Index

The worker location column should have a spatial index.

Conceptually:

```sql
CREATE INDEX idx_worker_locations_location
ON worker_locations
USING GIST (location);
```

Without an appropriate spatial index, geographic queries can become expensive as the worker population grows.

---

# 11. Basic Radius Query

Conceptually:

```sql
SELECT wsa.worker_id
FROM worker_service_areas wsa
WHERE ST_DWithin(
    wsa.center::geography,
    :requestLocation::geography,   -- service_requests.location
    :radiusMeters                  -- metres, because both sides are geography
);
```

This means:

> Find workers whose service area is near the request, within the current round's radius (metres).

The actual production query should also incorporate the other eligibility constraints.

---

# 12. Do Not Load Every Worker Into Java

Bad architecture:

```text
PostgreSQL
   ↓
Load 1 million workers
   ↓
Java
   ↓
calculate distance
   ↓
filter
```

This causes:

* huge memory usage
* unnecessary network traffic
* CPU overhead
* slow requests
* poor scalability.

Prefer:

```text
PostgreSQL + PostGIS
        ↓
candidate subset
        ↓
Java ranking
```

---

# 13. Initial Search Radius

We should not search the entire city immediately.

Default strategy (configuration, not code):

```text
Round 1:
2 km

Round 2:
5 km

Round 3:
10 km
```

These are **configurable defaults**, not final product rules. Each round is recorded as `worker_matches.round_no`.

The correct values should eventually come from real marketplace data.

---

# 14. Progressive Radius Expansion

Suppose the customer requests an electrician.

First:

```text
Search radius = 2 km
```

If fewer than 3 workers have accepted when the round window ends:

```text
Search radius = 5 km
```

If still fewer than 3:

```text
Search radius = 10 km
```

If nobody has accepted after the last round:

```text
FAILED_TO_MATCH  (customer can retry or change the time)
```

This is preferable to immediately searching a massive geographic area.

---

# 15. Why Progressive Expansion Matters

Imagine:

```text
100,000 workers
```

across a large metropolitan region.

A request may have:

```text
300 workers within 2 km
```

There is no reason to evaluate all 100,000.

Geographic filtering drastically reduces the candidate set.

---

# 16. Worker Service Area

Worker location and worker service area are different.

A worker may currently be:

```text
Howrah
```

but serve:

```text
Howrah
Shibpur
Salkia
Bally
```

Therefore we need:

```text
Current Location
+
Service Area
```

---

# 17. Current Worker Location

Current location answers:

> Where is the worker now?

This is useful for:

* distance
* ETA
* nearby matching.

It can change frequently.

---

# 18. Service Area

Service area answers:

> Which areas is this worker willing to serve?

MVP representation:

```text
center point
+
radius
```

Example:

```text
Center:
Shibpur

Radius:
8 km
```

Future representation may support:

```text
multiple areas
localities
polygons
custom service zones
```

---

# 19. Worker Location Freshness

Location data becomes stale.

For example:

```text
Worker location updated:
10:00 AM

Current time:
5:00 PM
```

The worker may no longer be nearby.

Therefore the matching system should track:

```text
location_updated_at
```

and define a freshness policy.

Example:

```text
If location older than X minutes:
reduce confidence
or
require worker confirmation
```

The exact threshold is an open decision.

---

# 20. Availability

A worker being nearby does not mean they are available.

We distinguish:

```text
Worker exists
Worker active
Worker accepting jobs
Worker available at requested time
```

These are different states.

Example:

```text
Worker:
ACTIVE

Accepting jobs:
YES

Currently:
busy with another job

Requested time:
6 PM

Availability:
NO
```

That worker should not necessarily receive the request.

---

# 21. MVP Availability

The first version can use:

```text
accepting_jobs
```

plus current booking/job state.

Later:

```text
worker_availability
-------------------------
worker_id
day
start_time
end_time
```

can support schedules.

Future requirements may include:

```text
leave
breaks
maximum jobs
working hours
holidays
temporary unavailability
```

---

# 22. Skill Matching

Profession alone is not sufficient.

Example:

```text
Profession:
Electrician
```

Possible skills:

```text
Ceiling Fan Repair
Switch Repair
Wiring
MCB Installation
Inverter Installation
Lighting
```

A request can specify:

```text
required skill:
Ceiling Fan Repair
```

Matching should prioritize workers with that capability.

---

# 23. Skill Compatibility

Initial matching:

```text
Exact skill match
```

Then potentially:

```text
Related skill
```

Example:

```text
Request:
Ceiling Fan Repair

Worker:
Electrical Repair
Fan Installation
General Wiring
```

The system may consider the worker depending on the catalog relationships.

However, those relationships should be defined explicitly rather than guessed by an AI model.

---

# 24. Verification

Worker verification can influence eligibility.

Example:

```text
Worker A:
identity verified
profession verified

Worker B:
identity verified
profession pending
```

For certain jobs:

```text
Worker B
```

may not be eligible.

The matching engine should therefore be able to apply:

```text
verification requirements
```

defined by the marketplace.

---

# 25. Candidate Eligibility

A candidate might need to satisfy:

```text
worker.status = ACTIVE
AND
accepting_jobs = true
AND
profession = requested profession
AND
required skills compatible
AND
verification requirements satisfied
AND
service area compatible
AND
location sufficiently fresh
AND
available at requested time
```

Only then should ranking begin.

---

# 26. Candidate Ranking

Once candidates are eligible, calculate a ranking score.

Initial factors might include:

```text
distance
skill match
availability
verification
reliability
response behavior
customer preferences
```

But we should keep the first implementation explainable.

---

# 27. Example Ranking Model

Conceptually:

```text
score =
    distanceScore
  + skillScore
  + availabilityScore
  + verificationScore
  + reliabilityScore
```

The exact weights are not yet product decisions.

For example:

```text
distance:      40%
skill match:   25%
availability:  15%
verification:  10%
reliability:   10%
```

These numbers are illustrative only and should not be treated as the final algorithm.

---

# 28. Avoid Premature ML

Do not start with:

```text
neural network
machine learning ranking
AI matching agent
deep learning
```

The initial marketplace will not have enough high-quality historical data.

A deterministic ranking system gives us:

```text
explainability
debuggability
predictability
easy testing
```

---

# 29. Why Explainability Matters

Suppose a worker asks:

> Why didn't I receive this job?

The system should be able to explain:

```text
Not eligible:
outside service area
```

or:

```text
Not selected in current round:
another candidate had closer distance and matching skill
```

A black-box ranking model would make this harder.

---

# 30. Match Entity

The database already contains:

```text
worker_matches
```

Key columns (full definition in [ERD §32](../architecture/03-erd-and-production-database-design.md)):

```text
worker_matches
--------------------------------
id
service_request_id
worker_id
round_no                     -- matching round (radius widening)
source                       -- MATCHING | FAVOURITE
status                       -- see §31
distance_meters
ranking_score
offered_visit_charge_minor   -- worker's visit charge, stated on accept
eta_minutes                  -- NOW requests
available_from               -- TODAY / SCHEDULED requests
decline_reason_code
notified_at
viewed_at
responded_at
expires_at                   -- worker must respond before this
created_at
updated_at
```

This is important because a match is a business record.

We should not simply calculate candidates and forget them.

---

# 31. Match Lifecycle

State machine ([ADR 0017](../adr/0017-customer-picks-the-worker.md)):

```text
NOTIFIED → VIEWED → ACCEPTED → SELECTED        (customer picked this worker → booking created)
                         └──→ NOT_SELECTED     (customer picked someone else)
         └─────────→ DECLINED / EXPIRED
ACCEPTED → WITHDRAWN                           (worker pulls out before the customer picks)
```

There is no `SUPERSEDED` match state; losing offers become `NOT_SELECTED`, and unanswered live offers become `EXPIRED` once the request is booked or cancelled.

---

# 32. Match Expiration

A worker should not be able to accept an offer indefinitely.

Example:

```text
Offer sent (TODAY request):
2:00 PM

Expires:
3:00 PM
```

The response window depends on urgency (NOW 30 min, TODAY 1 h, SCHEDULED 4 h, EMERGENCY 10 min) and is a configurable default (`worker_matches.expires_at`).

When expired:

```text
match.status = EXPIRED
```

The worker drops out of this round. If the shortlist is still short when the round window ends, the next round widens the radius and may notify new workers (or re-offer this one, since only live offers are unique).

---

# 33. Multiple Workers

A critical design question:

> Can multiple workers accept the same request?

At the matching layer:

```text
YES
```

At the booking layer:

```text
NO
```

Multiple workers may accept; the customer sees up to 3 of them and picks one.

Only the customer's selection creates a booking, so only one worker becomes the booked worker.

---

# 34. Concurrency Problem

Two workers accepting at the same time is **not** a conflict: both matches become `ACCEPTED` and both appear on the shortlist.

The race is on **selection**. Suppose:

```text
Customer taps "Select Worker A" on the phone
Customer (or a family member) taps "Select Worker B" on another device
Worker A withdraws at the same moment
```

Without concurrency protection:

```text
Booking A → created
Booking B → created
```

This violates the business rule.

---

# 35. Atomic Confirmation

The backend needs an atomic operation.

Conceptually:

```text
BEGIN TRANSACTION

lock service request (status must be AWAITING_SELECTION)
check chosen match is ACCEPTED and not expired

if ok:
    match → SELECTED
    other ACCEPTED matches → NOT_SELECTED
    create booking, job and planned job_visits
    request → BOOKED
else:
    reject (409)

COMMIT
```

The exact implementation may use:

```text
database locking
optimistic locking
unique constraints
```

or a combination.

---

# 36. Database Constraint as Final Safety Net

The application should not rely only on Java logic.

A database constraint can enforce:

```text
Only one live booking per service request
At most one SELECTED match per service request
```

PostgreSQL partial unique indexes (ERD §33, §38):

```sql
CREATE UNIQUE INDEX ux_bookings_one_active_per_request
ON bookings(service_request_id)
WHERE status <> 'CANCELLED';

CREATE UNIQUE INDEX ux_matches_selected
ON worker_matches(service_request_id)
WHERE status = 'SELECTED';
```

Filtering on `status = 'CONFIRMED'` alone would stop protecting the request once the booking moves past `CONFIRMED`.

---

# 37. Match Acceptance and Selection Flow

Worker accepts (no booking yet):

```text
Worker
   │
   │ Accept (visit charge + ETA / available_from)
   ▼
Match API
   │
   ▼
Authorization + match validation (NOTIFIED/VIEWED, not expired)
   │
   ▼
Transaction
   │
   ├── match → ACCEPTED
   └── request MATCHING → AWAITING_SELECTION (first acceptance)
   │
   ▼
Commit → event → customer shortlist updated (max 3)
```

Customer selects (creates the booking):

```text
Customer
   │
   │ Select worker
   ▼
Selection API
   │
   ▼
Transaction (§35)
   │
   ├── lock request, check match ACCEPTED and not expired
   ├── revalidate worker eligibility
   ├── match → SELECTED, others → NOT_SELECTED
   ├── create booking + job + job_visits
   └── request → BOOKED
   │
   ▼
Commit
   │
   ▼
Event
   │
   ├── Selected worker notified
   └── Other workers told the job went to someone else
```

---

# 38. What Happens to Other Matches?

Suppose:

```text
Customer selected Worker A
```

and the booking is created.

Other matches become:

```text
ACCEPTED            → NOT_SELECTED
NOTIFIED / VIEWED   → EXPIRED
```

`WITHDRAWN` is only for a worker who pulls out before the customer picks.

Workers should not continue seeing a job that is already assigned.

---

# 39. Offer Strategy

There are two major strategies.

### Broadcast

Send to many workers:

```text
A
B
C
D
E
```

Advantage:

* fast response.

Disadvantage:

* many workers compete
* unnecessary notifications
* worker frustration
* potential race conditions.

---

### Sequential / Small Batch

Send to:

```text
A
B
```

wait for the round window.

If the shortlist is still short (fewer than 3 accepted):

```text
C
D
```

then:

```text
E
F
```

Advantages:

* better control
* lower notification volume
* easier marketplace management.

Disadvantages:

* potentially slower.

---

# 40. MVP Recommendation

Use a small-batch approach.

For example:

```text
Round 1 (2 km):
favourites first, then top N candidates

↓ fewer than 3 accepted when the round window ends

Round 2 (5 km):
next N

↓ fewer than 3 accepted

Round 3 (10 km):
next N

↓ nobody accepted → FAILED_TO_MATCH
```

The customer shortlist shows each worker as soon as they accept, so the customer can pick before later rounds finish. `N`, radius steps, windows and shortlist size are configurable.

Do not hard-code marketplace policy into the domain model.

---

# 41. Matching Rounds

Rounds are tracked by `worker_matches.round_no` (no separate table in MVP). A dedicated `matching_rounds` table can be added later if per-round metadata is needed.

Conceptually:

```text
Matching Round 1
 ├── Worker A
 ├── Worker B
 └── Worker C

Matching Round 2
 ├── Worker D
 ├── Worker E
 └── Worker F
```

This helps track:

* how many rounds were attempted
* which workers were contacted
* response rates
* time to match
* failure reasons.

---

# 42. Synchronous vs Asynchronous Matching

A service request may be created synchronously:

```text
POST /service-requests
```

But matching does not necessarily need to happen inside the HTTP transaction.

Preferred flow:

```text
Create Request
     ↓
Commit
     ↓
ServiceRequestSubmitted event
     ↓
Matching
     ↓
Candidates
     ↓
Offers
```

This keeps request creation fast.

---

# 43. Initial Async Mechanism

For the modular monolith:

```text
Spring Application Events
```

can initially be used.

Later:

```text
Transactional Outbox
```

provides stronger reliability.

Eventually, if scale requires:

```text
Kafka
```

or another broker can be introduced.

---

# 44. Why Not Kafka Immediately?

Kafka is powerful but introduces:

```text
operations
monitoring
partitioning
consumer groups
offset management
failure handling
deployment complexity
```

The MVP does not need this complexity.

The architecture should leave room for it without requiring it today.

---

# 45. Matching Transaction Boundary

Do not hold one large database transaction across:

```text
candidate discovery
SMS sending
push notification
worker response
```

Instead:

```text
transaction:
create match records
commit

async:
send notifications
```

External systems must not determine whether the database transaction commits.

---

# 46. Notification Failure

Suppose:

```text
Worker match created successfully
```

but:

```text
push notification failed
```

The match should remain valid.

The notification subsystem can retry.

Therefore:

```text
Notification failure
≠
Matching transaction failure
```

---

# 47. Redis in Matching

Redis can support:

```text
temporary matching state
worker availability cache
rate limits
short-lived locks
notification deduplication
```

But PostgreSQL remains the source of truth for:

```text
worker
service request
match
booking
job
```

---

# 48. Worker Availability Cache

For high traffic, repeatedly querying:

```text
Is worker accepting jobs?
```

for thousands of workers may become expensive.

Redis can eventually maintain:

```text
worker:availability:{workerId}
```

But the cache must be treated carefully.

The database/domain state remains authoritative.

---

# 49. Cache Invalidation

When worker availability changes:

```text
Worker
 ↓
availability update
 ↓
PostgreSQL
 ↓
invalidate/update Redis
```

A stale cache must never cause a confirmed booking to violate business rules.

Therefore final eligibility should be revalidated before booking.

---

# 50. Matching Query Architecture

A simplified query may conceptually be:

```sql
-- :requestLocation = service_requests.location (geography(Point, 4326))
-- :radiusMeters    = current round's radius in metres (configurable, default 2000 / 5000 / 10000)
SELECT
    w.id AS worker_id,
    ST_Distance(wsa.center::geography, sr.location::geography) AS distance_meters
FROM service_requests sr
JOIN worker_professions wp
    ON wp.profession_id = sr.profession_id
   AND wp.status = 'ACTIVE'                 -- PK (worker_id, profession_id): one row per worker
JOIN workers w
    ON w.id = wp.worker_id
JOIN worker_service_areas wsa
    ON wsa.worker_id = w.id
WHERE
    sr.id = :serviceRequestId
    AND w.status = 'ACTIVE'
    AND w.accepting_jobs = true
    -- request inside the worker's own service area ...
    AND ST_DWithin(wsa.center::geography, sr.location::geography, wsa.radius_meters)
    -- ... and inside this round's search radius
    AND ST_DWithin(wsa.center::geography, sr.location::geography, :radiusMeters)
    -- no live offer already open for this worker on this request
    AND NOT EXISTS (
        SELECT 1 FROM worker_matches m
        WHERE m.service_request_id = sr.id
          AND m.worker_id = w.id
          AND m.status IN ('NOTIFIED', 'VIEWED', 'ACCEPTED', 'SELECTED')
    )
ORDER BY distance_meters               -- placeholder; Java ranking (§26–27) refines the order
LIMIT :n;
```

Skills are **not** joined here: a `JOIN worker_skills` returns one row per skill and duplicates workers. Skill match is checked with `EXISTS` or applied as a ranking factor.

The actual query will also include:

* verification
* availability
* freshness
* booking/job constraints.

---

# 51. Database vs Java Filtering

The general rule:

### Database

Use PostgreSQL/PostGIS for:

```text
geographic filtering
basic relational filtering
indexed conditions
```

### Java

Use application logic for:

```text
business policies
complex ranking
explainable scoring
marketplace rules
```

This prevents both extremes:

```text
everything in SQL
```

and:

```text
everything in Java
```

---

# 52. Distance Calculation

The system should record:

```text
distance_meters
```

when the match is generated.

This is useful for:

* debugging
* analytics
* ranking explanation
* support
* historical analysis.

It should not necessarily be treated as permanently accurate because worker location can change.

---

# 53. Distance vs Travel Time

Geographic distance is not the same as travel time.

Example:

```text
Worker A:
2 km away
but heavy traffic

Worker B:
4 km away
but faster route
```

Future versions may use:

```text
routing provider
ETA
traffic information
```

But the MVP can begin with geographic distance.

---

# 54. Future ETA Architecture

Later:

```text
Matching Engine
      │
      ▼
Maps Gateway
      │
      ▼
Routing Provider
      │
      ▼
ETA
```

The application should use an abstraction:

```text
RoutingGateway
```

instead of directly coupling the domain to Google Maps, Mapbox, or another provider.

---

# 55. Worker Search API

The customer may eventually have:

```text
GET /api/v1/workers
```

with filters:

```text
profession
skill
location
radius
availability
verification
```

This is a discovery/search API.

It can reuse:

```text
geospatial repository
catalog
worker eligibility
```

but should not necessarily reuse the complete job-matching workflow.

---

# 56. Privacy Before Booking

The matching engine should avoid exposing unnecessary information.

Before booking, a customer may see:

```text
Worker name
Profession
Skills
Rating
Completed jobs
Verification status
Approximate distance
Experience
```

The customer should not necessarily see:

```text
worker's exact home location
private phone number
private address
```

Similarly, workers should receive only the customer information necessary to perform the job.

---

# 57. Duplicate Requests

The system should detect suspicious duplicate requests.

Example:

```text
Customer creates:

Electrician request
5:00 PM

then 10 seconds later:

Electrician request
same location
same problem
same time
```

Possible handling:

```text
warning
```

or:

```text
duplicate detection
```

The exact business rule can be refined later.

---

# 58. Matching Failure

Not every request will find a worker.

Possible outcome:

```text
FAILED_TO_MATCH
```

Reasons should be measurable.

Examples:

```text
NO_WORKERS_NEARBY
NO_SKILL_MATCH
NO_AVAILABLE_WORKERS
NO_WORKER_ACCEPTED
REQUEST_EXPIRED
```

This data is extremely valuable.

---

# 59. Match Metrics

The system should measure:

```text
time_to_first_match
time_to_booking
candidate_count
offers_sent
acceptance_rate
rejection_rate
expiration_rate
distance_to_worker
match_failure_rate
```

These metrics allow us to improve the marketplace using actual data.

---

# 60. Worker Rejection Reasons

Workers should be able to decline an offer (`status = DECLINED`, reason in `decline_reason_code`).

Example reasons:

```text
TOO_FAR
BUSY
WRONG_SKILL
SCHEDULE_CONFLICT
NOT_INTERESTED
OTHER
```

This is useful for marketplace analysis.

Importantly:

> Worker rejection should not automatically reduce reputation.

A worker rejecting a job because it is 15 km away may be behaving appropriately.

---

# 61. Worker Reliability

Future ranking may use behavioral signals:

```text
offer response rate
acceptance rate
no-show rate
completion rate
cancellation rate
```

But these should be interpreted carefully.

For example:

```text
high rejection rate
```

does not necessarily mean:

```text
bad worker
```

because the worker may be rejecting irrelevant jobs.

---

# 62. Customer Preferences

Future ranking may incorporate:

```text
preferred worker
language
previous worker
price preference
availability
verification requirements
```

Example:

```text
Customer previously hired Worker A
```

The system could support:

```text
rebook Worker A
```

without making the customer search again.

In MVP this is `favourite_workers` ("My workers", ERD §34.2): favourite workers with the right trade are notified first with `worker_matches.source = FAVOURITE`, and still go through accept → customer selects.

---

# 63. Repeat Worker Flow

A strong marketplace feature:

```text
Previous Job
     ↓
Worker A
     ↓
Customer satisfied
     ↓
"Book again"
```

This can reduce the matching problem entirely for repeat relationships.

This supports the long-term product thesis of building a persistent worker/customer relationship.

---

# 64. Matching and Reputation

Matching should not simply become:

```text
highest rating wins
```

because ratings have different sample sizes.

Example:

```text
Worker A:
5.0 rating
3 jobs

Worker B:
4.8 rating
500 jobs
```

The system should eventually consider:

```text
rating
+
sample size
+
recent performance
+
job relevance
```

But the exact reputation model should be developed separately.

---

# 65. Matching and Pricing

The MVP should keep matching and pricing separate.

Matching answers:

> Who can do this job?

Pricing answers:

> What should the customer pay?

Do not create a single algorithm responsible for:

```text
worker selection
price
commission
surge
```

These are separate domains.

---

# 66. Matching and Payment

Similarly:

```text
Matching
≠
Payment
```

A worker accepting a match does not mean payment succeeded.

The lifecycle remains:

```text
Match
 ↓
Booking
 ↓
Job
 ↓
Payment
```

---

# 67. Failure Handling

Possible failure:

```text
Matching starts
 ↓
database temporarily unavailable
```

The service request should remain durable.

A retry mechanism can later retry matching.

This is another reason not to perform the entire matching process inside the initial request transaction.

---

# 68. Idempotency

Matching operations must be idempotent where appropriate.

Suppose:

```text
ServiceRequestSubmitted
```

is accidentally processed twice.

We should not create:

```text
duplicate matches
```

for the same:

```text
service_request + worker
```

The database should have a partial unique index on live offers (ERD §33) as a safety boundary:

```sql
CREATE UNIQUE INDEX ux_matches_live
ON worker_matches(service_request_id, worker_id)
WHERE status IN ('NOTIFIED', 'VIEWED', 'ACCEPTED', 'SELECTED');
```

A plain `UNIQUE(service_request_id, worker_id)` is too strict: it would stop a later round from re-offering a worker whose earlier offer expired or was declined.

---

# 69. Matching Job

The application can conceptually have:

```text
FindCandidatesForServiceRequest
```

responsibility.

Later this could run as:

```text
background worker
```

rather than:

```text
HTTP request thread
```

when scale requires it.

---

# 70. Initial Java Module

The matching module can eventually look like:

```text
matching/
├── api/
│   └── MatchingController.java
│
├── application/
│   ├── command/
│   ├── query/
│   ├── service/
│   │   ├── MatchingService.java
│   │   └── CandidateRankingService.java
│   │
│   └── port/
│       ├── in/
│       └── out/
│
├── domain/
│   ├── model/
│   │   ├── WorkerMatch.java
│   │   └── MatchCandidate.java
│   │
│   ├── policy/
│   │   ├── EligibilityPolicy.java
│   │   └── RankingPolicy.java
│   │
│   ├── valueobject/
│   │   ├── Distance.java
│   │   └── MatchScore.java
│   │
│   └── exception/
│
└── infrastructure/
    ├── persistence/
    ├── geospatial/
    └── configuration/
```

The exact classes belong to the later LLD stage.

---

# 71. Matching Policy

Matching logic should not become one enormous method:

```java
match(request) {
    // 500 lines
}
```

Instead, policies should be separable.

Conceptually:

```text
EligibilityPolicy
SkillMatchingPolicy
AvailabilityPolicy
DistancePolicy
RankingPolicy
OfferPolicy
```

This makes future changes easier.

---

# 72. Example Policy Chain

```text
Service Request
      ↓
EligibilityPolicy
      ↓
GeospatialPolicy
      ↓
SkillPolicy
      ↓
AvailabilityPolicy
      ↓
VerificationPolicy
      ↓
RankingPolicy
      ↓
OfferPolicy
```

The implementation may combine some of these into efficient database queries where appropriate.

The conceptual separation is still valuable.

---

# 73. Scalability Strategy

The matching architecture should evolve gradually.

### Stage 1

```text
Spring Boot
PostgreSQL + PostGIS
Redis
```

Matching runs within the modular monolith.

---

### Stage 2

```text
Multiple application instances
        ↓
Shared PostgreSQL
Shared Redis
```

Matching remains part of the monolith.

---

### Stage 3

```text
Application
     ↓
Background workers
     ↓
Matching jobs
```

Heavy matching work moves off HTTP threads.

---

### Stage 4

```text
Event / Message Broker
        ↓
Matching Workers
```

Kafka or another broker can be introduced if traffic justifies it.

---

### Stage 5

If matching becomes an independent scaling bottleneck:

```text
                   API
                    │
          ┌─────────┴─────────┐
          │                   │
     Core Backend       Matching Service
                              │
                         PostGIS/Search
```

This is an architectural option, not an MVP requirement.

---

# 74. Scaling to Large Worker Populations

Suppose the platform eventually has:

```text
1 million workers
```

We still should not query all workers.

The query should progressively reduce the search space:

```text
Geographic index
       ↓
profession
       ↓
skill
       ↓
availability
       ↓
verification
       ↓
ranking
```

Indexes and query planning become critical.

---

# 75. Scaling to High Request Volume

Suppose:

```text
100,000 service requests/day
```

The architecture should avoid:

```text
100,000 synchronous matching operations
```

on HTTP request threads if matching becomes expensive.

Instead:

```text
Request creation
      ↓
event/outbox
      ↓
matching workers
      ↓
candidate generation
      ↓
offers
```

This allows matching throughput to scale independently.

---

# 76. Hot Geographic Areas

A major marketplace characteristic is geographic concentration.

For example:

```text
Howrah
   ↓
Shibpur
   ↓
high demand
```

One area may generate significantly more traffic than another.

The system should therefore eventually support:

```text
partitioned workloads
regional workers
queue partitioning
geographic caching
```

if the traffic pattern requires it.

Do not prematurely partition PostgreSQL.

---

# 77. Hot Worker Problem

A popular worker may receive many simultaneous requests.

The system must prevent:

```text
Worker accepts:
Job A

and simultaneously:

Job B
Job C
Job D
```

when the worker has only one available slot.

A worker may hold several `ACCEPTED` offers at once, because a booking only exists once a customer selects. The customer's **selection** must therefore revalidate:

```text
worker availability
current workload
booking state
```

inside a transaction. The `job_visits` exclusion constraint (`EXCLUDE USING gist (worker_id WITH =, tstzrange(...) WITH &&)`) rejects a second selection that would overlap a visit the worker already has.

---

# 78. Final Eligibility Check

A candidate discovered at:

```text
5:00 PM
```

may become unavailable by:

```text
5:03 PM
```

Therefore:

> Candidate discovery is not final authorization to assign the job.

Before booking:

```text
revalidate worker eligibility
```

This is critical.

---

# 79. Race Conditions to Test

The matching system must explicitly test:

### Case 1

```text
Two workers accept simultaneously.
```

Expected:

```text
both ACCEPTED, both on the shortlist, no booking yet
```

### Case 1b

```text
Customer selects two workers simultaneously (double tap / two devices).
```

Expected:

```text
one SELECTED match, one live booking; the other call gets 409
```

### Case 2

```text
Same worker is selected for two overlapping requests simultaneously.
```

Expected:

```text
one booking succeeds; job_visits overlap exclusion rejects the other
```

### Case 3

```text
Match expires (or worker withdraws) while the customer selects it.
```

Expected:

```text
one deterministic outcome
```

### Case 4

```text
Customer cancels while a worker accepts or while selecting.
```

Expected:

```text
no invalid booking
```

### Case 5

```text
Matching event processed twice.
```

Expected:

```text
no duplicate match
```

---

# 80. Observability

Matching needs dedicated metrics.

Examples:

```text
matching.requests.started
matching.requests.completed
matching.requests.failed
matching.candidates.found
matching.offers.sent
matching.offers.accepted
matching.offers.declined
matching.offers.expired
matching.offers.withdrawn
matching.shortlist.time_to_first_accept
matching.time_to_booking
matching.radius_expansion_count
```

These metrics will eventually tell us where the marketplace is failing.

---

# 81. Important Business Metrics

Technical metrics are not enough.

The product should measure:

```text
% requests successfully matched
% requests completed
median time to worker acceptance
median distance
worker response rate
customer cancellation rate
worker cancellation rate
worker no-show rate
customer no-show rate
repeat booking rate
```

The most important marketplace metric remains:

> Successful completed jobs.

---

# 82. Matching Failure Analysis

Suppose:

```text
1,000 requests
```

and:

```text
800 matched
200 failed
```

We need to know why.

For example:

```text
80:
no workers nearby

50:
no skill match

40:
workers unavailable

20:
workers rejected

10:
request expired
```

Without these categories, improving the matching engine becomes guesswork.

---

# 83. Initial Architecture Decision

For MVP:

```text
PostgreSQL + PostGIS
        +
simple relational filtering
        +
explainable ranking
        +
small-batch offers
        +
Redis for temporary/cached state
        +
Spring events initially
```

This gives us a strong foundation without unnecessary infrastructure.

---

# 84. Technologies Explicitly Deferred

We are not introducing initially:

```text
Elasticsearch
MongoDB geospatial
Kafka
machine-learning ranking
real-time traffic routing
Kubernetes
dedicated matching microservice
complex geospatial polygons
AI agents
```

These can be introduced when actual bottlenecks justify them.

---

# 85. Important Design Principle

The matching engine should be designed so that:

> The implementation can become more sophisticated without changing the fundamental domain model.

For example:

### Today

```text
distance + skill + availability
```

### Later

```text
distance
+
travel time
+
skill confidence
+
historical completion rate
+
customer preference
+
worker reliability
```

### Much later

```text
ML ranking
```

The external behavior can remain:

```text
Find suitable workers
→ rank candidates
→ offer jobs
```

---

# 86. End-to-End Example

Customer:

```text
Need plumber
Location: Shibpur
Time: 7 PM
Problem: leaking kitchen pipe
```

### Step 1 — Request

```text
ServiceRequest
status = SUBMITTED
```

### Step 2 — Matching

```text
status = MATCHING
```

### Step 3 — Geographic discovery

Search:

```text
2 km
```

Find:

```text
12 workers
```

### Step 4 — Eligibility

Remove:

```text
3 unavailable
2 unverified
1 wrong profession
```

Remaining:

```text
6 candidates
```

### Step 5 — Ranking

Rank based on:

```text
skill
distance
availability
verification
reliability
```

### Step 6 — Offer

Send to:

```text
Worker A
Worker B
Worker C
```

### Step 7 — Acceptance

Worker B accepts (visit charge ₹200, can reach by 6:45 PM); Worker C accepts too. Both appear on the customer's shortlist and the request becomes:

```text
AWAITING_SELECTION
```

### Step 8 — Customer selects

The customer picks Worker B. Backend verifies atomically:

```text
request still AWAITING_SELECTION
match still ACCEPTED and not expired
worker still eligible
no live booking
```

### Step 9 — Booking

```text
Booking = CONFIRMED (job + first job_visit created in the same transaction)
```

### Step 10 — Other matches

```text
Worker B → SELECTED
Worker C → NOT_SELECTED
Worker A (no reply) → EXPIRED
```

### Step 11 — Notification

Worker B receives:

```text
You have been booked
```

Worker C is told the job went to someone else.

The request becomes:

```text
BOOKED
```

---

# 87. Final Matching Architecture

The complete conceptual architecture is:

```text
                         SERVICE REQUEST
                                │
                                ▼
                       MATCHING ORCHESTRATOR
                                │
               ┌────────────────┼────────────────┐
               │                │                │
               ▼                ▼                ▼
          PROFESSION         SKILL          AVAILABILITY
               │                │                │
               └────────────────┼────────────────┘
                                │
                                ▼
                           POSTGIS
                                │
                       Geographic Candidates
                                │
                                ▼
                       Eligibility Policies
                                │
                                ▼
                       Ranking Policies
                                │
                                ▼
                         Matching Rounds
                                │
                                ▼
                         Worker Matches
                                │
                                ▼
                            Offers
                                │
                                ▼
                     ACCEPT (workers, max 3 shown)
                                │
                                ▼
                       CUSTOMER SELECTS ONE
                                │
                                ▼
                    Atomic Booking Confirmation
                                │
                                ▼
                           BOOKING
```

---

# 88. Final Engineering Rules

1. Matching is not the same as worker search.
2. Candidate discovery and ranking are separate concepts.
3. Use PostGIS for geographic candidate discovery.
4. Use spatial indexes.
5. Do not load all workers into Java.
6. Filter candidates before ranking.
7. Profession and skill are separate.
8. Availability is separate from worker account status.
9. Current location is separate from service area.
10. Location freshness matters.
11. Do not expose unnecessary precise location information.
12. Use deterministic ranking initially.
13. Do not introduce ML without sufficient data.
14. Keep ranking explainable.
15. Store match records.
16. Match records require idempotency.
17. Multiple workers may accept; the customer picks one, and only that selection creates the booking.
18. Protect customer selection with transactional concurrency control.
19. Use database constraints as final consistency protection.
20. Revalidate eligibility before confirmation.
21. Do not hold transactions across external notifications.
22. Redis is supporting infrastructure, not business source of truth.
23. Matching can start synchronously but should be architecturally ready for async execution.
24. Track match failure reasons.
25. Track marketplace metrics.
26. Design for horizontal scaling.
27. Do not prematurely create a matching microservice.
28. Do not prematurely introduce Kafka.
29. Do not prematurely introduce Elasticsearch.
30. Design the matching interface so ranking can evolve independently.

---

# 89. Next Document

The next document will move into another important part of the platform:

## [modules/02](02-service-request-booking-and-job-execution.md) — Service Request, Booking & Job Execution Architecture

This will formally connect:

```text
Customer Request
       ↓
Matching
       ↓
Booking
       ↓
Worker En Route
       ↓
Arrived
       ↓
Work Started
       ↓
Additional Work (ADDITIONAL quote)
       ↓
Work Completed
       ↓
Payment
       ↓
Review
       ↓
Dispute
```

It will define the transaction lifecycle, concurrency, cancellation/rescheduling, no-shows, state transitions, idempotency, timestamps, transactional boundaries, domain events, failure scenarios, and how this flow should scale as the number of users and jobs grows.
