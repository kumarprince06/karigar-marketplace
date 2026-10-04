# Caching, Redis & Distributed State Design

## 1. Purpose

The platform will eventually handle many concurrent:

* customers;
* workers;
* service requests;
* matching operations;
* job updates;
* notifications;
* API requests.

PostgreSQL remains the transactional source of truth, but repeatedly querying it for every read can become unnecessarily expensive.

Redis will therefore be used as a **supporting infrastructure component** for:

* caching;
* short-lived state;
* rate limiting;
* distributed coordination;
* presence;
* temporary data;
* selected performance-sensitive read paths.

The fundamental principle is:

> **Redis improves performance and coordination; PostgreSQL owns business truth.**

---

# 2. Redis Is Not the Primary Database

The architecture must never depend on Redis as the only copy of critical business state.

Do not store authoritative:

```text
booking status
job status
payment status
worker earnings
refund state
dispute resolution
verification decision
service request state
```

only in Redis.

Correct:

```text
PostgreSQL
    ↓
authoritative state

Redis
    ↓
cached/ephemeral representation
```

---

# 3. Why Use Redis?

Redis is useful because it provides very fast operations for data that does not require PostgreSQL's full transactional model.

Examples:

```text
Cache
Rate limiting
Presence
Short-lived locks
Temporary counters
Idempotency records
Session-related ephemeral state
Realtime connection metadata
```

---

# 4. Redis Responsibilities

For this platform, Redis can eventually support:

```text
1. Read caching
2. API rate limiting
3. OTP attempt/rate-limit counters
4. WebSocket presence
5. Distributed locks
6. Short-lived idempotency state
7. Matching-related temporary data
8. Temporary job/processing coordination
9. Hot catalog caching
10. Feature/configuration caching
```

Not all of these need to be implemented on day one.

---

# 5. Cache Categories

Separate cache by purpose.

```text
Reference Cache
    ↓
professions
skills
configuration

Read Cache
    ↓
worker profiles
catalog responses
selected marketplace views

Ephemeral State
    ↓
presence
temporary matching data

Coordination
    ↓
locks
rate limits
deduplication
```

This separation makes expiration and failure behavior easier to reason about.

---

# 6. Cache-Aside Pattern

The default caching strategy should be:

```text
Application
    ↓
Check Redis
    │
    ├── HIT → return cached data
    │
    └── MISS
           ↓
      Query PostgreSQL
           ↓
      Store in Redis
           ↓
      Return result
```

This is known as **cache-aside**.

It is generally simpler than making Redis the primary write path.

---

# 7. Example: Profession Catalog

Request:

```text
GET /api/v1/catalog/professions
```

Flow:

```text
API
 ↓
Redis
 ↓
HIT?
 ├── yes → return
 └── no
       ↓
 PostgreSQL
       ↓
 Redis
       ↓
 response
```

Catalog data changes infrequently, making it a strong caching candidate.

---

# 8. What Should Be Cached First?

Good initial candidates:

### High-value

* professions;
* skills;
* service categories;
* application configuration;
* frequently accessed public worker profile summaries.

### Potentially later

* worker search results;
* service-area queries;
* dashboard aggregates;
* recommendation results.

Avoid caching everything.

---

# 9. What Should NOT Be Cached Initially?

Avoid caching highly dynamic transactional data unless there is a measured need.

Examples:

```text
payment status
refund status
financial ledger
dispute resolution
booking state
critical job state
```

For these:

```text
PostgreSQL query
```

should normally remain authoritative.

---

# 10. Why Not Cache Booking State?

Suppose:

```text
Booking = CONFIRMED in DB
Redis = PENDING
```

Now different requests may see different states.

This becomes especially dangerous when state controls money or access.

Therefore:

> Critical state should be read from PostgreSQL or from a cache with a rigorously controlled consistency strategy.

For the MVP, simply read authoritative transactional state from PostgreSQL.

---

# 11. Cache Key Design

Keys should be predictable and namespaced.

Example:

```text
catalog:profession:{professionId}
catalog:skills:{professionId}
worker:profile:{workerId}
worker:summary:{workerId}
```

Use a consistent naming convention.

Avoid:

```text
12345
```

because the purpose becomes unclear.

---

# 12. Versioned Cache Keys

For some caches, versioning can help invalidate groups.

Example:

```text
worker-profile:v1:{workerId}
```

When representation changes:

```text
worker-profile:v2:{workerId}
```

This avoids complex migration of old cache entries.

---

# 13. TTL

Every cache should have an expiration policy.

Example:

```text
Catalog
→ long TTL

Worker profile
→ shorter TTL

Search results
→ short TTL

Presence
→ seconds

Temporary lock
→ seconds
```

Exact TTL values should be determined through measurement and workload testing.

Never assume:

> “Redis data lives forever.”

---

# 14. Cache Invalidation

The difficult part of caching is not storing data.

It is invalidating stale data.

Example:

```text
Worker updates profile
       ↓
PostgreSQL updated
       ↓
Invalidate worker profile cache
```

The safest basic strategy is:

```text
DB write succeeds
       ↓
invalidate cache
```

The database transaction remains authoritative.

---

# 15. Failure During Cache Invalidation

Suppose:

```text
PostgreSQL update succeeds
       ↓
Redis invalidation fails
```

Redis may temporarily contain stale data.

The system should:

* use a short enough TTL;
* retry invalidation;
* provide cache fallback;
* monitor invalidation failures.

Do not roll back a successful business transaction simply because Redis is unavailable.

---

# 16. Cache Failure Strategy

Redis can fail.

The application should continue operating where practical.

Example:

```text
Redis unavailable
       ↓
Application
       ↓
PostgreSQL
```

Performance may degrade, but correctness should remain intact.

This is an important architectural principle:

> **Cache failure should usually cause slower reads, not incorrect business state.**

---

# 17. Cache Stampede

Suppose:

```text
popular worker profile
```

expires.

10,000 requests arrive simultaneously.

Without protection:

```text
10,000 requests
      ↓
PostgreSQL
```

This can overload the database.

Potential protections:

* TTL jitter;
* request coalescing;
* distributed locks;
* background refresh;
* stale-while-revalidate.

Do not implement all of them initially.

---

# 18. TTL Jitter

If every key has exactly:

```text
10 minutes
```

they may expire together.

Instead:

```text
base TTL + random small variation
```

can spread expiration.

This becomes useful when many similar keys are created at once.

---

# 19. Cache-Aside Race

Consider:

```text
Request A:
read DB

Request B:
update DB
invalidate cache

Request A:
write old DB result into Redis
```

Now Redis contains stale data.

This is a real cache consistency problem.

Possible solutions:

* short TTL;
* versioned values;
* compare-and-set;
* invalidation after write;
* event-driven cache updates;
* avoiding cache for highly mutable data.

For MVP, use caching primarily for data where brief staleness is acceptable.

---

# 20. Worker Profile Caching

Worker profiles are potentially high-read, lower-write data.

Example:

```text
worker:profile:{workerId}
```

Potential cached representation:

```json
{
  "workerId": "01J...",
  "displayName": "...",
  "profession": "Electrician",
  "skills": ["Wiring", "Fan Repair"],
  "rating": 4.8,
  "completedJobs": 127,
  "verification": {
    "identity": "VERIFIED",
    "profession": "VERIFIED"
  }
}
```

This should be a **read model**, not the worker aggregate itself.

---

# 21. Worker Search Results

Search results are much more dynamic.

Example:

```text
search:workers:{hashOfCriteria}
```

Potential criteria:

```text
profession
skill
location
radius
availability
verification
```

However, search-result caching can become difficult because:

* worker availability changes;
* locations change;
* bookings occur;
* profiles change.

Therefore, do not aggressively cache matching/search results until measurements demonstrate a need.

---

# 22. Geographic Queries

PostGIS remains the authoritative system for geographic discovery.

Example:

```text
ST_DWithin(
    worker.location,
    request.location,
    radius
)
```

Redis should not replace PostGIS for authoritative geospatial matching.

Possible future Redis geospatial structures can be considered for high-volume candidate discovery, but only after profiling demonstrates that PostgreSQL/PostGIS is insufficient.

---

# 23. Matching and Redis

A future matching optimization could use:

```text
Redis
  ↓
nearby candidate hints
  ↓
PostGIS/database verification
  ↓
final candidates
```

The important rule:

> Redis may help find candidates faster, but the final eligibility decision must remain based on authoritative data.

---

# 24. Worker Availability

Availability is business state.

Therefore:

```text
PostgreSQL
    ↓
authoritative availability/schedule
```

Redis can contain:

```text
worker:{id}:presence
worker:{id}:temporary-availability
```

where the data is explicitly ephemeral.

Do not let an expired Redis key accidentally mean:

> “Worker is unavailable.”

Absence of ephemeral data must have clearly defined semantics.

---

# 25. Presence

Presence is a strong Redis use case.

Example:

```text
presence:user:{userId}
```

Value:

```text
connectionId
instanceId
lastSeen
```

with a short TTL.

Heartbeat:

```text
Client connected
    ↓
refresh TTL
```

If the heartbeat stops:

```text
TTL expires
    ↓
user considered offline
```

This is intentionally ephemeral.

---

# 26. Presence Is Not Business Availability

Again:

```text
Redis presence = technical connectivity

PostgreSQL availability = business availability
```

A worker can be:

```text
Connected
+
Not accepting jobs
```

or:

```text
Disconnected
+
Still accepting scheduled work
```

depending on business rules.

---

# 27. Distributed Locks

Redis can provide short-lived distributed locks for coordination.

Example:

```text
lock:matching:request:{requestId}
```

Purpose:

> Prevent multiple application instances from performing the same non-transactional processing simultaneously.

However:

> **A Redis lock must not replace database constraints or transactions.**

---

# 28. Example: Matching Lock

Two workers/processes receive the same trigger:

```text
Process A → match request
Process B → match request
```

A short-lived lock can help:

```text
Process A
   ↓
acquire lock
   ↓
perform matching

Process B
   ↓
lock unavailable
   ↓
skip/retry
```

But database constraints and idempotency must still protect correctness.

---

# 29. Lock Expiration

Every distributed lock must have a bounded lifetime.

Never create:

```text
lock with no expiration
```

Otherwise a crashed process could leave the resource permanently locked.

Use:

```text
lock
TTL
owner token
```

and release only when the lock owner can safely do so.

---

# 30. When NOT to Use Redis Locks

Do not automatically use Redis locks for every concurrent operation.

For example:

```text
Two workers accept same booking
```

The primary protection should be:

```text
PostgreSQL transaction
+
unique constraint
+
locking/version check
```

Redis may reduce duplicate work but should not determine the final winner.

---

# 31. Rate Limiting

Redis is well suited for distributed rate limiting.

Example:

```text
user:{userId}:api
ip:{ip}:auth
phone:{phone}:otp
```

This becomes especially important when there are multiple application instances.

Without Redis:

```text
App A → counter = 5
App B → counter = 5
```

Each instance may independently believe the user is under the limit.

With shared Redis:

```text
App A ─┐
App B ─┼→ Redis counter
App C ─┘
```

---

# 32. OTP Rate Limiting

Authentication is particularly sensitive.

Example controls:

```text
OTP requests per phone
OTP verification attempts
OTP requests per IP
failed verification attempts
```

Counters can have short TTLs.

This protects against:

* SMS abuse;
* credential attacks;
* account enumeration;
* provider cost abuse.

---

# 33. Idempotency Storage

Some APIs may need short-lived idempotency state.

Example:

```text
idempotency:{userId}:{key}
```

Possible stored information:

```text
request hash
status
response reference
createdAt
expiration
```

However, for financially critical commands, PostgreSQL persistence/constraints should remain part of the correctness mechanism.

Redis can accelerate duplicate detection but should not be the only guarantee for payment correctness.

---

# 34. Temporary Data

Redis can hold data such as:

```text
OTP state
temporary verification tokens
short-lived upload state
rate-limit counters
temporary matching locks
presence
connection metadata
```

These should have explicit TTLs.

---

# 35. Redis Data Classification

A useful classification:

| Data                  | Redis Role            | PostgreSQL Source of Truth |
| --------------------- | --------------------- | -------------------------- |
| Profession catalog    | Cache                 | Yes                        |
| Worker profile        | Cache                 | Yes                        |
| Search results        | Optional cache        | Yes                        |
| Booking status        | Avoid cache initially | Yes                        |
| Payment status        | Avoid cache           | Yes                        |
| Presence              | Ephemeral             | No                         |
| Rate limits           | Ephemeral             | No                         |
| Distributed lock      | Coordination          | No                         |
| OTP attempts          | Temporary             | No                         |
| Financial ledger      | Never cache as truth  | Yes                        |
| Verification decision | Avoid cache initially | Yes                        |

---

# 36. Cache Consistency Levels

Not every piece of data needs the same consistency.

### Strong consistency

Use authoritative DB reads:

```text
payment
refund
booking confirmation
financial balance
```

### Eventual consistency acceptable

Potentially cached:

```text
worker profile
catalog
review summary
completed-job count
```

### Ephemeral

Redis:

```text
presence
rate-limit counters
locks
temporary processing state
```

The architecture should explicitly classify data rather than treating every read equally.

---

# 37. Review Summary Cache

A worker profile may display:

```text
rating = 4.8
reviewCount = 127
```

This can eventually be cached.

But the source of truth remains:

```text
reviews
```

If the cache is stale:

```text
4.8 / 127
```

instead of:

```text
4.8 / 128
```

the result is temporarily inconsistent but not financially or operationally destructive.

---

# 38. Cache Invalidation Through Events

As the system matures:

```text
WorkerProfileUpdated
       ↓
Cache invalidation
       ↓
worker:profile:{id}
```

Similarly:

```text
ReviewCreated
      ↓
invalidate worker review summary
```

This connects this document with the event architecture planned for [architecture/09](09-async-processing-domain-events-and-outbox.md).

---

# 39. Avoid Generic Cache Helpers Everywhere

Do not create:

```text
CommonCacheUtils
```

with arbitrary:

```text
get()
set()
delete()
```

used without business context.

Instead, use purpose-specific cache components:

```text
WorkerProfileCache
ProfessionCatalogCache
PresenceStore
RateLimitStore
```

This makes:

* ownership;
* TTL;
* serialization;
* invalidation;

explicit.

---

# 40. Serialization

Cached objects should use explicit representations.

Avoid blindly serializing JPA entities into Redis.

Bad:

```text
Redis
  ↓
Hibernate Entity
```

Problems can include:

* lazy relationships;
* schema coupling;
* excessive payload size;
* accidental sensitive data;
* serialization compatibility issues.

Prefer dedicated cache DTOs/read models.

---

# 41. Cache Security

Never accidentally cache sensitive data.

Avoid putting into general caches:

```text
OTP plaintext
passwords
payment credentials
identity documents
government ID numbers
private verification evidence
```

If temporary authentication state must be stored, store only what is necessary and protect it appropriately.

---

# 42. Redis Authentication & Network Security

Production Redis should not be treated as an openly accessible service.

Use:

* private network access;
* authentication;
* TLS where appropriate;
* restricted security groups/firewall rules;
* secret management;
* least-privilege access.

Application instances should be the intended clients.

---

# 43. Redis Availability

If Redis becomes unavailable:

```text
Cache
   ↓
bypass

Rate limiting
   ↓
fallback strategy

Presence
   ↓
temporarily unavailable

Distributed coordination
   ↓
retry/fallback
```

Different Redis features need different failure policies.

Do not blindly fail the entire API because Redis is unavailable.

---

# 44. Cache Failure Matrix

| Redis Feature           | Redis Down                 | Expected Behavior                |
| ----------------------- | -------------------------- | -------------------------------- |
| Catalog cache           | Safe                       | Read PostgreSQL                  |
| Worker profile cache    | Safe                       | Read PostgreSQL                  |
| Search cache            | Safe                       | Execute query                    |
| Presence                | Degraded                   | Presence temporarily unavailable |
| Rate limiting           | Important                  | Use controlled fallback          |
| Matching lock           | Degraded                   | Retry / DB protection            |
| Idempotency accelerator | Degraded                   | DB idempotency remains           |
| Payment state           | Should not depend on Redis | PostgreSQL                       |

---

# 45. Rate-Limit Fallback

Authentication endpoints require special care.

If Redis is unavailable, blindly allowing unlimited OTP requests could create provider-cost and abuse problems.

Possible strategy:

```text
Redis available
    ↓
distributed rate limiting

Redis unavailable
    ↓
conservative local limit
+
fail closed for particularly sensitive operations
```

Exact behavior is a security/product decision.

---

# 46. Redis Memory Management

Redis is memory-based.

Therefore:

* monitor memory;
* define max memory policy;
* avoid huge values;
* avoid unbounded collections;
* set TTLs;
* monitor key cardinality.

Do not store large images, videos, PDFs, or other media in Redis.

---

# 47. Cache Payload Size

Avoid caching large objects.

For example, do not cache:

```text
entire worker
+ jobs
+ reviews
+ disputes
+ addresses
```

Instead:

```text
worker summary
```

and retrieve detailed data separately.

---

# 48. Hot Keys

A single Redis key can become extremely popular.

Example:

```text
catalog:professions
```

10 million requests may hit one key.

Redis can handle high read rates, but hot-key patterns should still be monitored.

Potential solutions later:

* local in-process cache;
* key replication;
* CDN;
* precomputed responses.

Do not prematurely optimize.

---

# 49. Local Cache vs Redis

Some immutable/rarely changing data can eventually use an in-process cache:

```text
Application memory
      ↓
Redis
      ↓
PostgreSQL
```

But local cache introduces:

* per-instance copies;
* more invalidation complexity;
* stale data across instances.

Therefore use it selectively.

For MVP, Redis + PostgreSQL is sufficient.

---

# 50. Database Is Still the Performance Baseline

Before adding Redis to a slow query:

```text
1. Inspect query
2. Inspect execution plan
3. Add proper index
4. Reduce unnecessary columns
5. Fix N+1 queries
6. Optimize pagination
7. Measure
8. Then consider cache
```

Caching a bad query can hide the underlying problem rather than solving it.

---

# 51. Cache Metrics

Track:

```text
cache_hits_total
cache_misses_total
cache_errors_total
cache_evictions_total
cache_invalidations_total
cache_invalidation_failures
```

Calculate:

```text
cache hit rate
```

by cache category.

A global cache-hit percentage is less useful than category-specific metrics.

---

# 52. Redis Metrics

Monitor:

```text
memory usage
connected clients
commands/sec
latency
evictions
expired keys
CPU
network throughput
replication health
availability
```

Alerts should be based on operational impact, not arbitrary thresholds alone.

---

# 53. Cache Stampede Protection

For high-value cached resources, future architecture can use:

```text
Request
   ↓
Cache miss
   ↓
Acquire refresh lock
   ↓
One process loads DB
   ↓
Others wait briefly
   ↓
Cache populated
```

But this should only be introduced for proven hot keys.

---

# 54. Cache Warming

For data that is predictable and frequently accessed:

```text
Application startup
   ↓
Load catalog
   ↓
Populate Redis
```

This can reduce cold-start latency.

However, application startup should not fail simply because optional cache warming fails.

---

# 55. Cache Invalidation Strategy by Module

### Catalog

```text
ProfessionUpdated
SkillUpdated
      ↓
invalidate catalog cache
```

### Worker

```text
WorkerProfileUpdated
WorkerSkillsUpdated
VerificationChanged
      ↓
invalidate worker profile/summary
```

### Review

```text
ReviewCreated
ReviewModerated
      ↓
invalidate review summary
```

### Availability

Usually avoid long-lived cache because availability is dynamic.

### Booking

Prefer DB reads.

### Payment

Prefer DB reads.

---

# 56. Redis and Background Workers

Background workers may use Redis for:

```text
distributed locks
temporary processing state
rate limits
job coordination
```

But durable background work should eventually use:

```text
database outbox
+
queue/broker
```

rather than relying on Redis keys alone.

[architecture/09](09-async-processing-domain-events-and-outbox.md) will define this in detail.

---

# 57. Redis and WebSockets

From [architecture/07](07-realtime-and-websocket-architecture.md):

```text
App A
   ↓
Redis Pub/Sub
   ↓
App B
   ↓
WebSocket
```

This allows events generated on one application instance to reach connections maintained by another.

Again:

```text
Redis Pub/Sub
≠
business state
```

---

# 58. Distributed State Classification

Every piece of state should be classified as one of:

### Authoritative

```text
PostgreSQL
```

### Derived

```text
Redis cache
materialized read model
analytics
```

### Ephemeral

```text
Redis
in-memory state
presence
locks
```

### External authoritative

```text
Payment provider
Identity verification provider
```

This classification prevents accidental architectural coupling.

---

# 59. Example: Booking Confirmation

Correct:

```text
Worker accepts
      ↓
PostgreSQL transaction
      ↓
Booking = CONFIRMED
      ↓
Commit
      ↓
Event
      ↓
Redis/WebSocket
      ↓
Customer UI
```

Incorrect:

```text
Worker accepts
      ↓
Redis booking = CONFIRMED
      ↓
WebSocket
      ↓
Later PostgreSQL update
```

The second design makes Redis part of transactional correctness and should be avoided.

---

# 60. Example: Worker Presence

Correct:

```text
Worker connects
      ↓
Redis presence
      ↓
TTL
      ↓
heartbeat
      ↓
TTL refresh
```

No PostgreSQL transaction is needed for every heartbeat.

This keeps high-frequency ephemeral traffic away from the primary database.

---

# 61. Example: OTP Attempts

Correct:

```text
Request OTP
      ↓
Redis counter
      ↓
TTL
```

This avoids writing every attempt into PostgreSQL.

The security-sensitive authentication workflow can still persist the appropriate permanent account/authentication state separately.

---

# 62. Example: Worker Search

Initial:

```text
Search request
      ↓
PostGIS
      ↓
PostgreSQL
      ↓
results
```

Later:

```text
Search request
      ↓
Redis candidate hints
      ↓
PostGIS verification
      ↓
PostgreSQL business filters
      ↓
results
```

The optimized design should only be introduced after measuring the first design.

---

# 63. Configuration

Redis-related settings should be environment-specific.

Examples:

```text
REDIS_HOST
REDIS_PORT
REDIS_USERNAME
REDIS_PASSWORD
REDIS_TLS_ENABLED
CACHE_DEFAULT_TTL
```

Sensitive credentials must come from secret management, not source control.

---

# 64. Testing

### Cache tests

* cache hit;
* cache miss;
* invalidation;
* stale cache;
* serialization;
* Redis unavailable;
* TTL expiration.

### Distributed tests

* multiple application instances;
* concurrent lock acquisition;
* lock expiration;
* duplicate processing.

### Rate limiting

* limit reached;
* TTL reset;
* concurrent requests;
* Redis failure.

### Presence

* connect;
* heartbeat;
* disconnect;
* TTL expiration;
* reconnect.

---

# 65. MVP Implementation

Initially implement only what provides clear value:

```text
Redis
├── catalog caching
├── OTP/rate limiting
├── basic API rate limiting
├── WebSocket presence
└── selected short-lived coordination
```

Potentially:

```text
worker profile cache
```

only if profiling indicates meaningful read load.

---

# 66. Scale-Up Implementation

When traffic increases:

```text
Redis
├── distributed rate limiting
├── WebSocket pub/sub
├── presence
├── distributed coordination
├── hot read caches
├── matching candidate optimization
└── temporary processing state
```

Still:

```text
PostgreSQL = transactional source of truth
```

---

# 67. What We Should Avoid

Do not introduce:

* Redis as primary database;
* Redis-only booking state;
* Redis-only payment state;
* giant serialized object graphs;
* unlimited TTL-less keys;
* arbitrary global cache helpers;
* caching every database query;
* Redis for large media;
* Redis locks as the only concurrency mechanism;
* complex distributed cache invalidation before measurement;
* multiple Redis clusters without a real requirement.

---

# 68. Core Invariants

The architecture must enforce:

1. PostgreSQL remains the source of truth for transactional business state.
2. Redis is an optimization/coordination layer.
3. Redis failure must not corrupt business state.
4. Every cache has an explicit purpose.
5. Every cache has a TTL or explicit lifecycle.
6. Sensitive data must not accidentally enter general caches.
7. Critical financial state must not depend on Redis.
8. Distributed locks do not replace database transactions.
9. Rate limiting must work across application instances.
10. Presence remains separate from worker availability.
11. Cached objects should use dedicated DTO/read models.
12. Cache keys must be namespaced and predictable.
13. Cache invalidation must be tied to known business changes.
14. Cache misses must have a safe database fallback where applicable.
15. Large files must remain in object storage.
16. Search caching must not bypass authoritative eligibility checks.
17. Ephemeral Redis data must have explicit failure semantics.
18. Background processing must not depend solely on volatile Redis state.
19. Redis should be introduced where measurement demonstrates value.
20. Performance optimization must never weaken correctness.

---

# 69. Final Architecture Principle

The platform should think about Redis as:

> **a fast assistant to the database, not a second database.**

The intended architecture is:

```text
                    ┌──────────────────┐
                    │    PostgreSQL    │
                    │ Source of Truth  │
                    └────────┬─────────┘
                             │
             ┌───────────────┼────────────────┐
             │               │                │
             ↓               ↓                ↓
          REST/API        Domain Events     Jobs
             │               │                │
             ↓               ↓                ↓
           Redis         Realtime         Workers
             │
      ┌──────┼─────────┐
      ↓      ↓         ↓
   Cache  Presence  Rate Limits
```

The design should therefore optimize in this order:

```text
Correct database model
        ↓
Correct indexes/queries
        ↓
Correct transactions
        ↓
Measure performance
        ↓
Add Redis where justified
        ↓
Measure again
        ↓
Scale only the bottleneck
```

This prevents Redis from becoming an unnecessary source of architectural complexity while still giving the platform a clear path toward high concurrency and horizontal scaling.

# End of Document
