# Search, Discovery & Worker Profile / Professional Passport Architecture

## 1. Purpose

The marketplace has two fundamentally different discovery problems:

### Customer discovery

A customer wants to answer:

> “Which suitable workers are available for my problem, near my location, at the time I need them?”

### Worker discovery

A worker wants to answer:

> “Which relevant jobs are available near me that I can realistically accept?”

These are related but not identical problems.

The system therefore needs a dedicated **Search & Discovery capability** that sits between the underlying domain data and the user-facing experience.

The core objective is:

> **Return relevant, available, trustworthy workers and jobs without making search itself the source of truth for business state.**

---

# 2. Search vs Matching

Search and matching should not be treated as the same thing.

### Search

Search answers:

> “Show me workers matching these criteria.”

Example:

```text
Electricians
within 5 km
Howrah
verified
available today
```

### Matching

Matching answers:

> “Given this specific service request, which workers should receive an opportunity to perform this job?”

Example:

```text
Customer request
    ↓
Electrical fault
    ↓
Customer location
    ↓
Required skill
    ↓
Requested time
    ↓
Matching engine
    ↓
Eligible workers
```

Therefore:

```text
Search = discovery
Matching = transaction-oriented candidate selection
```

They may share underlying candidate-discovery infrastructure but should have separate business responsibilities.

---

# 3. Why Search Needs Its Own Architecture

A naive implementation might query the entire database:

```sql
SELECT *
FROM workers
WHERE profession = 'ELECTRICIAN';
```

This will not be sufficient.

A production search system must consider:

* profession;
* skills;
* service area;
* geographic distance;
* worker availability;
* verification;
* worker status;
* rating/review signals;
* completed jobs;
* reliability indicators;
* languages;
* experience;
* customer preferences;
* requested time;
* category-specific attributes.

It must also avoid exposing internal or sensitive information.

---

# 4. Search Is Not the Source of Truth

This is a critical architectural principle.

The authoritative state remains in the domain modules and PostgreSQL.

For example:

```text
Worker availability
    ↓
Worker module / PostgreSQL
```

not:

```text
Search index
    ↓
availability = true
```

Similarly:

```text
Worker verification
    ↓
Trust/Worker domain
```

not:

```text
Search index
    ↓
verified = true
```

Search data is a **read-optimized representation**.

---

# 5. Customer Search Journey

Example:

A customer opens the application and searches for an electrician.

```text
Customer
   ↓
Select profession
   ↓
Select problem/skill
   ↓
Provide location
   ↓
Select timing
   ↓
Search
   ↓
Candidate retrieval
   ↓
Eligibility filters
   ↓
Ranking
   ↓
Worker profiles
   ↓
Worker selected
   ↓
Service request
```

The customer should not directly create a booking from search results without going through the appropriate business workflow.

---

# 6. Worker Discovery Journey

Workers have a different flow.

```text
Worker
   ↓
Open available jobs
   ↓
Candidate jobs
   ↓
Filter by distance/category/time
   ↓
View job summary
   ↓
Accept/reject
   ↓
Booking flow
```

Worker discovery must protect customer privacy.

A worker should not automatically receive:

* exact customer address before appropriate stage;
* unnecessary personal information;
* sensitive customer information.

---

# 7. Worker Profile

A worker profile should answer the customer's major trust and suitability questions.

Example:

```text
Worker
├── Name
├── Profession
├── Skills
├── Experience
├── Verification
├── Completed jobs
├── Ratings
├── Reviews
├── Reliability indicators
├── Service area
├── Availability
└── Professional information
```

However, not every field should be exposed in every context.

---

# 8. Profile Visibility Levels

The system should support contextual visibility.

### Public/discovery profile

May expose:

```text
displayName
profession
skills
experience
verification badges
completedJobCount
rating
reviewCount
serviceAreaSummary
```

### Booking context

May expose additional information required to coordinate the job.

### Internal/admin profile

May contain:

```text
identity verification
documents
audit history
risk information
internal notes
financial information
```

These three views must not be confused.

---

# 9. Worker Professional Passport

The Professional Passport is the long-term worker identity layer.

It should represent evidence accumulated through the platform.

Conceptually:

```text
Professional Passport
        │
        ├── Identity
        ├── Profession
        ├── Skills
        ├── Experience
        ├── Verification
        ├── Completed Work
        ├── Reviews
        ├── Reliability
        └── Professional History
```

This should not be implemented as one giant database table.

It is a **read model composed from multiple domain sources**.

---

# 10. Passport Data Ownership

Each domain should continue owning its own data.

```text
Worker Module
    → profession
    → experience

Catalog
    → skills

Verification
    → verification status

Job
    → completed jobs

Review
    → ratings/reviews

Availability
    → availability

Dispute
    → relevant operational signals
```

The Professional Passport combines these into a customer-facing representation.

---

# 11. Passport Read Model

Eventually:

```text
Worker domain
       ↓
WorkerUpdated
       ↓
Passport projection

Verification
       ↓
VerificationApproved
       ↓
Passport projection

Job
       ↓
JobCompleted
       ↓
Passport projection

Review
       ↓
ReviewCreated
       ↓
Passport projection
```

Result:

```text
worker_profile_projection
```

This is derived data.

The underlying domain tables remain authoritative.

---

# 12. Search Candidate Retrieval

The search pipeline should be divided into stages.

```text
Request
  ↓
Input validation
  ↓
Candidate retrieval
  ↓
Eligibility filtering
  ↓
Ranking
  ↓
Profile enrichment
  ↓
Response
```

This prevents ranking logic from becoming a giant SQL query.

---

# 13. Geographic Candidate Retrieval

PostGIS should be used for geographic filtering.

Conceptually:

```text
Customer location
       ↓
PostGIS
       ↓
Workers within radius
```

Example query concept:

```text
ST_DWithin(worker_location, customer_location, radius)
```

The exact implementation belongs to LLD.

The important architectural decision is:

> Geographic candidate retrieval should be delegated to the database's spatial capabilities rather than implemented using application-side distance calculations over large datasets.

---

# 14. Service Area vs Current Location

These are different concepts.

### Service area

Where the worker generally accepts jobs.

Example:

```text
Howrah
within 8 km
```

### Current location

Where the worker is currently located.

Example:

```text
Worker currently near Shibpur
```

A worker may:

```text
service area = Howrah
current location = Kolkata
```

or:

```text
service area = Howrah
current location = Howrah
```

They should never be represented as the same field.

---

# 15. Availability Filtering

Search may show availability, but availability must come from the availability system.

Possible filters:

```text
AVAILABLE_NOW
AVAILABLE_TODAY
AVAILABLE_AT_TIME
ACCEPTING_JOBS
```

For transactional matching:

```text
candidate worker
    ↓
availability check
    ↓
capacity check
    ↓
booking conflict check
```

A stale search result must never be treated as guaranteed availability.

---

# 16. Eligibility Before Ranking

Ranking should happen **after** mandatory eligibility filtering.

Example:

```text
Candidate Workers
       ↓
Profession filter
       ↓
Required skill
       ↓
Service area
       ↓
Availability
       ↓
Worker status
       ↓
Required verification
       ↓
Capacity
       ↓
Eligible Workers
       ↓
Ranking
```

Do not rank workers who are not actually eligible.

---

# 17. Eligibility Rules

Possible mandatory conditions:

```text
worker.status = ACTIVE
worker.acceptingJobs = true
profession matches
required skill matches
service area matches
requested time is feasible
required verification exists
worker is not suspended
worker has capacity
```

Some rules are category-specific.

For example, certain work may require a particular verified skill.

---

# 18. Ranking

After eligibility:

```text
Eligible Workers
      ↓
Ranking
      ↓
Ordered candidate list
```

MVP ranking should remain simple and explainable.

Potential signals:

```text
distance
availability
skill match
verification
reliability
completed jobs
rating
response behavior
```

Avoid a complicated opaque score initially.

---

# 19. Explainable Ranking

Instead of only:

```text
score = 87.42
```

the system should internally be able to explain:

```text
Worker ranked highly because:
- required skill matches;
- worker is available;
- worker is nearby;
- required verification is complete;
- worker has relevant completed jobs.
```

This becomes useful for:

* debugging;
* customer support;
* experimentation;
* fairness analysis;
* future ranking improvements.

---

# 20. Distance

Distance is one useful signal but should not automatically dominate every search.

For example:

```text
Worker A
distance = 1.2 km
experience = 1 month

Worker B
distance = 2.5 km
experience = 5 years
```

The platform may eventually need a balance between proximity and suitability.

The exact ranking policy is a product decision.

Architecture should allow the policy to evolve.

---

# 21. Rating

Rating may be used as one ranking signal.

But avoid:

```text
sort by rating DESC
```

as the entire ranking strategy.

Why?

A worker with:

```text
5.0 / 2 reviews
```

and one with:

```text
4.8 / 500 reviews
```

should not necessarily be treated identically.

Therefore ranking should consider review volume and other contextual signals.

---

# 22. New Worker Problem

New workers will naturally have little history.

If ranking depends heavily on:

```text
reviews
completed jobs
historical reliability
```

new workers may never receive enough jobs to build those signals.

This creates a marketplace cold-start problem.

The architecture should therefore allow:

* exploration policies;
* controlled exposure;
* verification-based visibility;
* skill relevance;
* distance;
* availability;
* new-worker participation.

The exact allocation strategy is a product experiment.

---

# 23. Search Result Example

Conceptual response:

```json
{
  "data": [
    {
      "workerId": "01J...",
      "displayName": "Amit",
      "profession": "Electrician",
      "skills": [
        "Wiring",
        "Switch Repair"
      ],
      "distanceMeters": 1800,
      "verification": {
        "identity": true,
        "profession": true
      },
      "rating": 4.8,
      "reviewCount": 87,
      "completedJobs": 142,
      "availability": "AVAILABLE"
    }
  ],
  "meta": {
    "nextCursor": "..."
  }
}
```

This response should contain only data appropriate to the caller.

---

# 24. Search Filters

MVP filters:

```text
profession
skill
location
distance
availability
verification
```

Potential future filters:

```text
rating
experience
language
price range
time slot
emergency availability
completed jobs
```

Do not expose filters simply because the database supports them.

Each filter adds product complexity and can reduce marketplace liquidity.

---

# 25. Sorting

Possible sort options:

```text
RELEVANCE
DISTANCE
AVAILABILITY
```

Future:

```text
EXPERIENCE
RATING
```

The default should be a relevance-based ranking rather than arbitrary database order.

---

# 26. Pagination

Search should use cursor pagination.

Avoid:

```text
OFFSET 100000
```

for large datasets.

Prefer:

```text
cursor
```

based on a stable ordering.

The cursor must encode enough information to continue the same search consistently.

---

# 27. Search Consistency

Search results are inherently somewhat stale.

For example:

```text
10:00 → Worker available
10:01 → Worker accepts another job
10:02 → Customer sees worker as available
10:03 → Customer attempts booking
```

This is acceptable.

The booking operation must perform the authoritative concurrency check.

Therefore:

```text
Search availability
       ≠
Booking guarantee
```

---

# 28. Search and Booking Race Condition

Two customers may simultaneously select the same worker.

```text
Customer A ──→ Worker
                 ↑
Customer B ──────┘
```

Search may show the worker to both.

Booking must protect the actual invariant:

```text
one worker
cannot accept conflicting jobs
```

using database transactions/constraints/locking as defined in the booking architecture.

Search does not solve this problem.

---

# 29. Search Index

For MVP:

> PostgreSQL + PostGIS should be the primary search engine.

Do not introduce Elasticsearch/OpenSearch immediately.

The initial query requirements are well within PostgreSQL capabilities if indexes are designed correctly.

Later, a dedicated search engine may become justified when:

* search dimensions become complex;
* full-text requirements increase;
* ranking becomes sophisticated;
* query volume requires independent scaling;
* search latency becomes a demonstrated bottleneck.

---

# 30. Full-Text Search

Customer descriptions may eventually contain:

```text
"switch board sparking"
"water leaking from bathroom pipe"
"geyser connection problem"
```

A future search layer may map these descriptions to:

```text
profession
skill
service category
```

But this should not initially become an AI dependency.

MVP can use structured categories and skills.

---

# 31. Search Architecture

Initial architecture:

```text
                  ┌────────────────────┐
                  │   REST API         │
                  └─────────┬──────────┘
                            ↓
                  ┌────────────────────┐
                  │ Search Application │
                  └─────────┬──────────┘
                            ↓
                  ┌────────────────────┐
                  │ Candidate Query    │
                  └─────────┬──────────┘
                            ↓
                  ┌────────────────────┐
                  │ PostgreSQL/PostGIS │
                  └─────────┬──────────┘
                            ↓
                  Candidate Workers
                            ↓
                  Eligibility Filter
                            ↓
                       Ranking
                            ↓
                  Profile Projection
                            ↓
                       API Response
```

---

# 32. Future Search Architecture

If scale demands it:

```text
Domain Modules
      ↓
Domain Events
      ↓
Search Projection
      ↓
Search Index
      ↓
Search API
```

Potential technology:

```text
OpenSearch / Elasticsearch
```

But only after actual requirements justify it.

The architecture should therefore keep search behind an abstraction where useful without prematurely introducing infrastructure.

---

# 33. Search Projection

A future denormalized projection might contain:

```text
worker_search_projection
├── worker_id
├── profession_id
├── skill_ids
├── verification_flags
├── service_area
├── current_location
├── availability_summary
├── completed_job_count
├── rating
├── review_count
├── reliability_summary
└── searchable_profile_fields
```

This is derived data.

It should never become the only copy of the underlying information.

---

# 34. Projection Updates

Example:

```text
WorkerUpdated
      ↓
Update search projection
```

```text
VerificationApproved
      ↓
Update search projection
```

```text
JobCompleted
      ↓
Update completed job count
```

```text
ReviewCreated
      ↓
Update rating/review summary
```

```text
WorkerLocationUpdated
      ↓
Update location representation
```

The projection may be temporarily stale.

The transactional domain remains authoritative.

---

# 35. Cache Strategy

Frequently viewed worker profiles may be cached.

Example:

```text
Redis
  ↓
worker-profile:{workerId}
```

But profile cache must be invalidated when relevant data changes.

Do not cache authoritative business decisions.

For example:

```text
Cached profile
```

is acceptable.

But:

```text
Redis says worker can accept booking
```

should not replace the database transaction.

Caching will be covered in detail in [architecture/08](../architecture/08-caching-redis-and-distributed-state.md).

---

# 36. Profile Versioning

A useful future technique is a profile version.

Example:

```text
profileVersion = 42
```

When worker profile data changes:

```text
42 → 43
```

This can help:

* cache invalidation;
* debugging;
* detecting stale clients;
* auditability;
* synchronization.

It is not mandatory for MVP but is worth keeping in mind.

---

# 37. Worker Profile Privacy

The profile should not expose:

* government ID;
* identity documents;
* personal address;
* private phone number unnecessarily;
* bank information;
* internal risk signals;
* private dispute evidence;
* sensitive verification metadata.

Instead expose derived information:

```text
Identity verified
Profession verified
```

rather than:

```text
Aadhaar document uploaded
```

---

# 38. Customer Privacy

Workers should similarly not receive unnecessary customer information.

Before booking:

```text
approximate location
service category
problem description
requested time
```

After the workflow reaches the appropriate stage:

```text
address/coordination information
```

The exact exposure policy is a product/privacy decision.

---

# 39. Search Security

Search endpoints should have:

* authentication where required;
* authorization;
* rate limiting;
* pagination limits;
* query validation;
* location input validation;
* maximum radius;
* protection against scraping;
* privacy-aware response fields.

Do not allow unrestricted:

```text
GET /workers?latitude=...&longitude=...
```

with unlimited radius and unlimited pagination.

That could become a worker directory scraping mechanism.

---

# 40. Search Abuse

Potential abuse:

```text
bot
 ↓
enumerates workers
 ↓
collects profiles
 ↓
extracts contact information
```

Controls:

* authentication;
* pagination limits;
* rate limits;
* no unnecessary contact information;
* anomaly detection;
* response minimization;
* possibly different API limits for different clients.

---

# 41. Worker Profile Quality

A profile should not become a giant form.

The system should distinguish:

### Core identity

```text
name
profession
```

### Professional capability

```text
skills
experience
```

### Trust

```text
verification
reviews
completed jobs
```

### Availability

```text
accepting jobs
working hours
```

### Operational signals

```text
reliability
```

This separation keeps the profile understandable.

---

# 42. Professional Passport Timeline

A future profile may show evidence chronologically:

```text
2026
✓ Identity verified

2026
✓ Profession verified

2026
✓ Completed 50 jobs

2027
✓ Completed 100 jobs

2027
✓ Added plumbing certification
```

This is more informative than simply displaying:

```text
Trusted Worker ⭐ 4.9
```

The actual UI is a product concern, but the underlying architecture should support this evidence.

---

# 43. Category-Specific Profiles

Electrician and plumber profiles may eventually require different skills.

Example:

### Electrician

```text
House Wiring
MCB
Switchboard
Fan Installation
Inverter
```

### Plumber

```text
Pipe Leakage
Tap Repair
Bathroom Fitting
Water Tank
Drainage
```

The catalog module owns the taxonomy.

Worker profiles reference skills rather than hardcoding category-specific fields into the Worker entity.

---

# 44. Multi-Profession Workers

A worker may eventually be:

```text
Electrician
+
Plumber
```

Therefore:

```text
Worker
   ↓
Profession(s)
   ↓
Skills
```

should be architecturally possible.

MVP may restrict one primary profession if product simplicity requires it.

That restriction should be a business rule, not a database design limitation that makes future expansion painful.

---

# 45. Discovery and Matching Relationship

The shared pipeline can look like:

```text
                Candidate Retrieval
                       │
          ┌────────────┴────────────┐
          ↓                         ↓
      Customer Search           Matching
          ↓                         ↓
    Ranking Policy            Eligibility
          ↓                         ↓
    Profile Results          Match Offers
```

The systems share infrastructure but not necessarily the same ranking policy.

---

# 46. Search Events

Useful events:

```text
WorkerProfileViewed
WorkerSearchPerformed
WorkerSelected
SearchResultClicked
```

These are analytics events, not domain events.

They can later help answer:

* which profiles attract attention;
* where customers drop off;
* which search filters are useful;
* whether ranking is producing useful results.

Analytics will be covered separately.

---

# 47. Search Metrics

Important metrics:

### Quality

```text
search → profile view
profile view → request
request → booking
booking → completed job
```

### Performance

```text
p50 search latency
p95 search latency
p99 search latency
candidate retrieval latency
ranking latency
database query latency
```

### Marketplace

```text
eligible workers per request
requests with zero candidates
requests with insufficient candidates
search-to-booking conversion
```

The most important business question remains:

> Does discovery lead to successful completed jobs?

---

# 48. Zero-Result Search

A production marketplace must handle:

```text
No workers found.
```

Do not return an empty screen without context.

Possible responses:

```text
No workers currently available nearby.
```

Then optionally:

```text
Try a larger radius
Try another time
Create a service request
```

The exact UX is a product decision.

---

# 49. Insufficient-Candidate Situation

There may be:

```text
2 eligible workers
```

but the marketplace wants to contact several workers.

Matching should handle this separately.

Search should not pretend there are more workers than actually exist.

---

# 50. Search Failure

If search infrastructure fails:

```text
Redis unavailable
```

the system should ideally still be able to query PostgreSQL.

If a future dedicated search index fails:

```text
Search index unavailable
```

the platform should have a defined fallback for critical customer flows.

The source of truth must remain available.

---

# 51. Data Freshness

Different fields can tolerate different staleness.

| Data             | Tolerance    |
| ---------------- | ------------ |
| Profession       | High         |
| Skills           | High         |
| Reviews          | Moderate     |
| Completed jobs   | Moderate     |
| Verification     | Low/Moderate |
| Availability     | Low          |
| Current location | Very low     |
| Booking capacity | Very low     |

Therefore one generic cache/index freshness policy is inappropriate.

---

# 52. Recommended MVP Architecture

```text
PostgreSQL
   +
PostGIS
   +
Redis for selected caching
   +
Spring Boot search application layer
```

No Elasticsearch.

No OpenSearch.

No separate search microservice.

No ML ranking.

No recommendation engine.

No vector database.

---

# 53. Future Evolution

### Stage 1

```text
PostgreSQL + PostGIS
```

### Stage 2

```text
PostgreSQL
+
Redis
+
search projections
```

### Stage 3

```text
PostgreSQL
+
Search projection
+
OpenSearch/Elasticsearch
```

### Stage 4

```text
Search
+
Personalized ranking
+
experimentation
+
advanced relevance models
```

### Stage 5

Potentially:

```text
structured request
+
natural-language understanding
+
semantic skill matching
```

But only after the marketplace has sufficient real data.

---

# 54. Module Structure

Within the modular monolith:

```text
search/
├── api/
│   └── SearchController
│
├── application/
│   ├── query/
│   │   ├── SearchWorkers
│   │   ├── GetWorkerProfile
│   │   └── GetWorkerPassport
│   │
│   ├── service/
│   │   ├── WorkerSearchService
│   │   ├── CandidateRetrievalService
│   │   └── RankingService
│   │
│   └── port/
│       ├── in/
│       └── out/
│
├── domain/
│   ├── model/
│   │   ├── WorkerSearchCriteria
│   │   ├── WorkerSearchResult
│   │   └── RankingExplanation
│   └── valueobject/
│
└── infrastructure/
    ├── persistence/
    ├── postgis/
    ├── cache/
    └── projection/
```

The search module should depend on other modules through defined interfaces/read models rather than importing their internal implementation classes.

---

# 55. Architectural Boundary

The most important boundary is:

```text
DOMAIN
   ↓
AUTHORITATIVE STATE
```

versus:

```text
SEARCH
   ↓
READ-OPTIMIZED VIEW
```

For example:

```text
Worker
   owns worker state

Booking
   owns booking state

Job
   owns job state

Payment
   owns payment state

Search
   owns no transactional truth
```

This prevents search from becoming a hidden second database.

---

# 56. Core Invariants

The search/discovery system must respect:

1. Search results are not booking guarantees.
2. Search results may become stale.
3. PostgreSQL remains the transactional source of truth.
4. PostGIS is responsible for geographic candidate retrieval.
5. Worker availability is owned by the availability system.
6. Search cannot directly mutate worker/job/booking state.
7. Ranking happens after mandatory eligibility.
8. Ranking should initially be explainable.
9. Sensitive worker information must not be exposed.
10. Sensitive customer information must not be exposed.
11. Search must use bounded pagination.
12. Search endpoints must be protected against scraping.
13. Professional Passport is a derived read model.
14. Passport data must preserve domain ownership.
15. New workers must be able to participate in discovery.
16. Multi-profession support should remain architecturally possible.
17. Search failure must not corrupt transactional state.
18. A dedicated search engine should be introduced only when actual requirements justify it.
19. Search and matching may share candidate-retrieval infrastructure but remain separate business capabilities.
20. The final ranking algorithm must remain replaceable.

---

# 57. Final Architecture Principle

The search system should not attempt to answer:

> “Who is the best worker?”

Instead, it should answer:

> **“Which workers are eligible and relevant for this specific context, and what evidence can we show about their professional capability and history?”**

That distinction is important.

The platform should build the infrastructure for **relevant discovery**, while leaving final customer choice and transactional authorization to the appropriate business workflows.

# End of Document
