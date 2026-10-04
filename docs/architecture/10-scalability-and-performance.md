# Scalability & Performance Architecture

## 1. Purpose

The platform is intentionally starting as a modular monolith.

That does **not** mean the architecture should be designed only for a small number of users.

The system should be capable of evolving from:

```text
small MVP
    ↓
growing local marketplace
    ↓
multiple areas
    ↓
multiple cities
    ↓
large marketplace
```

without requiring a complete rewrite.

The goal is:

> **Build a system that scales by improving the existing architecture first, and extract services only when actual bottlenecks or organizational boundaries justify it.**

---

# 2. Scalability Principles

The architecture follows:

```text
id="scalability-principles"
Stateless application instances
PostgreSQL as source of truth
Redis for distributed support
Horizontal application scaling
Asynchronous processing for expensive work
Database-first correctness
Indexed queries
Bounded transactions
Cursor pagination
Efficient geographic queries
Idempotent operations
Measured optimization
```

---

# 3. What Does "Scale" Mean?

Scalability is not simply:

```text
more users
```

The platform has several dimensions:

```text
id="scale-dimensions"
Registered users
Active users
Workers online
Service requests
Matches
Bookings
Active jobs
Payments
Notifications
WebSocket connections
File uploads
Database records
Background events
API requests
```

Different dimensions create different bottlenecks.

---

# 4. Marketplace Scaling Model

A useful model is:

```text
Users
 ↓
Service Requests
 ↓
Matching
 ↓
Worker Offers
 ↓
Bookings
 ↓
Jobs
 ↓
Payments
 ↓
Reviews
```

Traffic will not necessarily grow uniformly.

For example:

```text
100,000 users
```

does not mean:

```text
100,000 active jobs
```

Therefore capacity planning must use actual workload characteristics.

---

# 5. Primary Architecture

The initial architecture remains:

```text
                    Internet
                       │
                       ↓
                Load Balancer
                       │
              ┌────────┴────────┐
              ↓                 ↓
        App Instance 1    App Instance 2
              │                 │
              └────────┬────────┘
                       ↓
                 PostgreSQL
                       │
                 ┌─────┴─────┐
                 ↓           ↓
               Redis      Object Storage
```

Application instances are preferably stateless.

---

# 6. Stateless Application

Application instances should not depend on local memory for durable business state.

Avoid:

```text
id="bad-state"
booking state in local memory
worker availability only in local memory
payment state only in local memory
```

Instead:

```text
PostgreSQL → authoritative business state
Redis → shared ephemeral/support state
```

This allows instances to be added or removed without losing business state.

---

# 7. Horizontal Scaling

When traffic increases:

```text
1 application
     ↓
2 applications
     ↓
5 applications
     ↓
10 applications
```

The architecture should support this without changing business logic.

The load balancer distributes requests.

---

# 8. Session Scaling

If authentication depends on server-side sessions, session state must not be stored only in local application memory.

Possible approaches:

```text
stateless access tokens
+
shared refresh/session state
```

or:

```text
shared session store
```

The exact authentication implementation will be finalized during LLD.

---

# 9. Database Is the First Scaling Challenge

For this marketplace, PostgreSQL will likely be one of the most important scaling components.

Potential pressure comes from:

```text
service requests
bookings
jobs
payments
worker availability
geo queries
notifications
audit events
analytics
```

The database therefore needs careful schema and query design before adding infrastructure complexity.

---

# 10. Scale Database Before Scale Architecture

The preferred progression:

```text
Good schema
   ↓
Correct indexes
   ↓
Efficient queries
   ↓
Connection pooling
   ↓
Caching
   ↓
Query optimization
   ↓
Read replicas
   ↓
Partitioning where justified
```

Do not jump directly to:

```text
sharding
microservices
multiple databases
```

---

# 11. Query-Driven Indexing

Indexes should come from actual query patterns.

Important queries include:

```text
id="query-indexes"
find nearby workers
find available workers
find requests by customer
find jobs by worker
find active bookings
find pending payments
find pending outbox events
find notifications for user
find reviews for worker
```

Every high-frequency query should be examined for appropriate indexes.

---

# 12. PostGIS Scaling

Worker matching is one of the most important geographic workloads.

Typical query:

```text
Find workers
WHERE
profession matches
AND skill matches
AND availability matches
AND worker is active
AND location is within radius
```

PostGIS should use spatial indexes such as GiST.

---

# 13. Geographic Query Strategy

Do not retrieve every worker and calculate distance in Java.

Bad:

```text
PostgreSQL
 ↓
all workers
 ↓
Java calculates distance
 ↓
filter
```

Prefer:

```text
PostGIS
 ↓
spatially filter candidates
 ↓
application applies remaining business rules
```

This dramatically reduces data transferred and application work.

---

# 14. Candidate Funnel

Matching should progressively reduce the candidate set.

Example:

```text
All workers
   ↓
Active workers
   ↓
Profession match
   ↓
Skill match
   ↓
Service area
   ↓
Availability
   ↓
Capacity
   ↓
Verification requirements
   ↓
Distance/ranking
```

The expensive work should happen after the candidate pool has been reduced.

---

# 15. Matching Performance

Matching should not repeatedly perform expensive work unnecessarily.

Use:

```text
indexed queries
cached reference data
short-lived worker presence
bounded search radius
efficient candidate filtering
```

If matching becomes computationally expensive, it can move to background workers without changing the domain model.

---

# 16. Matching Burst Scenario

Imagine:

```text
100 customers
```

create requests during a local demand spike.

Instead of:

```text
100 requests
 ×
thousands of workers
```

performing uncontrolled scans, the matching engine should:

```text
id="burst-match"
scope by geography
scope by profession
scope by skill
scope by availability
limit candidates
rank candidates
```

This keeps workload bounded.

---

# 17. Matching Radius

Do not query an unlimited geographic area.

Use controlled search policies:

```text
initial radius
      ↓
expand if needed
      ↓
stop at maximum radius
```

This prevents an unmatched request from turning into a system-wide worker scan.

---

# 18. Matching Rounds

A future concept may be:

```text
Matching Round 1
 ↓
nearby candidates

Matching Round 2
 ↓
larger area

Matching Round 3
 ↓
broader candidate set
```

Each round can have its own:

```text
candidates
offers
expiry
results
```

This is especially useful as marketplace density grows.

---

# 19. Database Connection Pool

Each application instance should use a bounded database connection pool.

Do not assume:

```text
more threads = more DB connections = more performance
```

Too many concurrent connections can overload PostgreSQL.

Capacity should be calculated across:

```text
application instances
×
connections per instance
```

---

# 20. Connection Pool Scaling Example

Suppose:

```text
5 application instances
```

and each has:

```text
30 DB connections
```

Then PostgreSQL may see approximately:

```text
150 potential connections
```

before accounting for other consumers.

Scaling application instances therefore requires database capacity planning.

---

# 21. Transaction Duration

Short transactions are critical.

Avoid:

```text
BEGIN
 ↓
call payment provider
 ↓
wait 5 seconds
 ↓
call SMS
 ↓
COMMIT
```

Prefer:

```text
BEGIN
 ↓
update business state
 ↓
write outbox
 ↓
COMMIT
 ↓
external side effects asynchronously
```

---

# 22. Lock Duration

Database locks should be held for the minimum required time.

Long locks can cause:

```text
waiting transactions
 ↓
connection exhaustion
 ↓
latency increase
 ↓
cascading failure
```

---

# 23. Hot Rows

Certain records can become contention points.

Examples:

```text
single booking
single payment
worker availability
popular configuration
```

The architecture should minimize unnecessary updates to the same row.

---

# 24. Avoid Counter Hotspots

A single mutable counter can become a contention hotspot.

For example:

```text
worker.completed_jobs_count
```

should not necessarily be updated synchronously on every job if that creates unnecessary contention.

The authoritative job history can remain transactional while derived counters are maintained asynchronously or recomputed where appropriate.

---

# 25. Derived Data

Some data can be treated as derived:

```text
rating average
review count
completed job count
worker reliability indicators
analytics counters
```

The underlying records remain authoritative.

Derived values can be:

```text
cached
materialized
recomputed
asynchronously updated
```

depending on performance requirements.

---

# 26. Cache Strategy

Redis should be used selectively.

Good candidates:

```text
profession catalog
skills
configuration
worker profile summary
frequently requested read models
short-lived presence
rate limits
```

Do not cache everything.

---

# 27. Cache-Aside

Default approach:

```text
Application
   ↓
Redis?
  / \
yes  no
 |    ↓
return PostgreSQL
      ↓
    cache
```

PostgreSQL remains authoritative.

---

# 28. Cache Invalidation

When data changes:

```text
DB transaction
   ↓
commit
   ↓
invalidate/update cache
```

If cache invalidation fails:

```text
business transaction remains successful
```

The system can retry or allow TTL expiration.

---

# 29. Cache Stampede

Suppose:

```text
popular worker profile cache expires
```

and:

```text
1,000 requests
```

arrive simultaneously.

All may query PostgreSQL.

Mitigations can include:

```text
TTL jitter
request coalescing
short locks
stale-while-revalidate
```

Use these only for genuinely hot data.

---

# 30. Cache Consistency

Never assume cached data is perfectly current.

For critical operations:

```text
booking
payment
refund
job state
verification
```

read authoritative state when necessary.

Cache is primarily a performance mechanism.

---

# 31. Pagination

Never return unbounded collections.

Bad:

```text
GET /workers
```

returning:

```text
every worker
```

Prefer:

```text
cursor pagination
```

with bounded page sizes.

---

# 32. Cursor Pagination

For large datasets:

```text
GET /jobs?cursor=...
```

is generally preferable to very large offset pagination.

The exact cursor strategy will be finalized in LLD/API implementation.

---

# 33. Sorting

Sorting must use indexed or otherwise bounded strategies where possible.

Avoid:

```text
huge dataset
+
arbitrary expensive sort
```

on every request.

---

# 34. API Payload Size

Large payloads increase:

```text
network cost
serialization CPU
memory
latency
```

Return only required fields.

Use specialized response DTOs.

---

# 35. Avoid N+1 Queries

Example:

```text
fetch 100 workers
 ↓
query skills for each worker
```

creates:

```text
1 + 100 queries
```

Prefer deliberate fetching/projections appropriate to the use case.

---

# 36. JPA Performance

JPA/Hibernate should be used carefully.

Avoid:

```text
EAGER everything
entity graph explosions
unbounded relationships
automatic serialization
```

Use:

```text
projections
DTO queries
controlled fetching
pagination
batching where appropriate
```

---

# 37. Database Read/Write Separation

Initially:

```text
application
      ↓
PostgreSQL
```

Later:

```text
writes ─────→ primary
reads  ─────→ replicas
```

Read replicas should be introduced only when read load justifies them.

---

# 38. Read Replica Consistency

A read replica may lag.

Therefore:

```text
immediately after booking confirmation
```

a critical read should not necessarily rely on a potentially stale replica.

Use primary reads when strong read-after-write consistency is required.

---

# 39. Analytics Isolation

Analytics queries should not eventually overwhelm the transactional database.

Initial approach:

```text
operational DB
 ↓
small analytics queries
```

Later:

```text
operational events
 ↓
analytics pipeline
 ↓
analytics store/warehouse
```

This separation should happen when actual workload requires it.

---

# 40. Audit Scaling

Audit events can become high-volume.

Do not allow:

```text
massive audit volume
 ↓
slow transactional queries
```

to damage core operations.

Use appropriate indexes, retention, and eventually separate storage if required.

---

# 41. Notification Scaling

Notifications are naturally asynchronous.

Architecture:

```text
business event
 ↓
outbox
 ↓
notification worker
 ↓
provider
```

Workers can scale horizontally.

Example:

```text
Notification Worker 1
Notification Worker 2
Notification Worker 3
```

All must process jobs idempotently.

---

# 42. Outbox Scaling

The outbox table can become busy.

Important indexes include queries for:

```text
pending events
available events
event type
created time
processing state
```

Workers should claim work in bounded batches.

---

# 43. Outbox Partitioning

Do not partition the outbox table immediately.

If event volume becomes very large, partitioning may be considered based on:

```text
volume
retention
query patterns
maintenance cost
```

---

# 44. Background Worker Scaling

Different workloads should not necessarily share one worker pool.

Potential pools:

```text
Notification
Matching
Media
Cleanup
Reconciliation
Analytics
```

This prevents one workload from starving another.

---

# 45. Worker Backpressure

If:

```text
incoming events > processing capacity
```

the system should allow a controlled backlog rather than collapsing.

Monitor:

```text
queue depth
oldest item age
processing rate
failure rate
retry count
```

---

# 46. Retry Storm Prevention

When an external provider fails, blindly retrying thousands of requests can make the outage worse.

Use:

```text
exponential backoff
jitter
bounded retries
circuit-breaking where justified
```

and distinguish temporary from permanent errors.

---

# 47. Circuit Breakers

Circuit breakers may eventually be useful for unreliable external providers.

Conceptually:

```text
healthy
 ↓
provider failures
 ↓
OPEN
 ↓
stop sending requests temporarily
 ↓
HALF-OPEN
 ↓
test provider
 ↓
healthy → CLOSED
```

Do not add circuit breakers everywhere before there is a real failure mode to solve.

---

# 48. Realtime Scaling

For one application instance:

```text
Spring WebSocket
```

is sufficient.

With multiple instances:

```text
Client A
   ↓
App Instance 1

Client B
   ↓
App Instance 2
```

events may need shared coordination.

Redis Pub/Sub can initially support this.

---

# 49. WebSocket Connection Capacity

Realtime capacity depends on:

```text
number of connections
messages/sec
payload size
connection duration
heartbeat frequency
network bandwidth
server memory
```

Do not estimate WebSocket capacity from HTTP request capacity alone.

---

# 50. WebSocket Backpressure

A slow client should not block the whole system.

Use:

```text
bounded buffers
small messages
disconnect unhealthy clients
drop non-critical realtime updates
allow client resync
```

The authoritative state remains available through REST.

---

# 51. Presence Scaling

Worker online presence is ephemeral.

Redis can maintain:

```text
worker:presence:{workerId}
```

with TTL/heartbeat.

Do not turn presence into a giant permanent database history.

---

# 52. Availability vs Presence

At scale:

```text
presence
≠
availability
```

A worker can be:

```text
online but not accepting jobs
```

or:

```text
offline but available for scheduled work
```

Matching should use business availability, not merely a WebSocket connection.

---

# 53. Media Scaling

Large files should bypass application servers where possible.

Preferred:

```text
Client
  ↓
upload intent
  ↓
Object Storage
```

rather than:

```text
Client
 ↓
Spring Boot
 ↓
Object Storage
```

for every large upload.

---

# 54. Media Processing

Image/video processing should be asynchronous.

Example:

```text
upload
 ↓
object stored
 ↓
event
 ↓
media worker
 ↓
resize/transcode/scan
 ↓
available
```

This prevents large processing workloads from blocking API requests.

---

# 55. Storage Scaling

Object storage should handle binary growth separately from PostgreSQL.

PostgreSQL stores:

```text
metadata
references
ownership
purpose
status
```

Object storage handles:

```text
binary content
```

---

# 56. Database Storage Growth

Transactional tables will grow continuously.

Examples:

```text
jobs
payments
audit_events
notifications
reviews
outbox_events
```

Monitor:

```text
row count
table size
index size
growth rate
vacuum behavior
query latency
```

---

# 57. Archival

Eventually, some data may need archival.

Possible strategy:

```text
active transactional data
        ↓
older historical data
        ↓
archive storage
```

Do not implement archival prematurely.

First measure actual data volume and access patterns.

---

# 58. Partitioning

Partitioning may eventually help for high-volume append-oriented tables.

Potential candidates:

```text
audit_events
notifications
outbox_events
location_history
analytics_events
```

Partitioning should be based on:

```text
volume
query patterns
retention
maintenance
```

not because partitioning sounds scalable.

---

# 59. Sharding

Database sharding should be considered much later.

Possible future shard dimensions could include:

```text
geography
city
tenant
hash-based distribution
```

But sharding creates major complexity:

```text
cross-shard transactions
cross-shard queries
routing
rebalancing
operational complexity
```

It is not an MVP requirement.

---

# 60. Geographic Scaling

The product is initially localized.

This is an advantage.

Instead of:

```text
entire India
```

the system can initially operate within:

```text
dense local geography
```

This reduces:

```text
matching search area
data locality challenges
operational complexity
marketplace cold-start difficulty
```

---

# 61. Multi-City Scaling

When additional cities are introduced:

```text
City A
City B
City C
```

the domain should support geography as data, not as hard-coded application logic.

Potential concepts:

```text
service region
city
zone
worker coverage
```

---

# 62. Regional Matching

Matching can eventually begin with:

```text
worker's active region
```

before expanding to broader geographic searches.

This prevents:

```text
one request
 ↓
global worker scan
```

---

# 63. Capacity Planning

Capacity planning should track:

```text
API requests/sec
DB transactions/sec
DB connections
Redis operations/sec
WebSocket connections
messages/sec
matching requests/sec
outbox events/sec
notification throughput
storage growth
```

---

# 64. Capacity Is a Measurement Problem

Do not decide:

```text
"we need Kafka because we have 100k users"
```

Users are not a sufficient capacity metric.

Instead ask:

```text
requests/sec?
jobs/day?
matching/sec?
events/sec?
DB load?
```

---

# 65. Scaling Triggers

Architecture changes should have measurable triggers.

Examples:

```text
Database CPU sustained high
Query latency consistently high
Connection pool saturation
Outbox backlog continuously growing
Redis memory pressure
WebSocket connection limits
API latency SLO degradation
Storage growth becoming expensive
```

---

# 66. Vertical Scaling

Before architectural changes, appropriately sized infrastructure can often solve early bottlenecks.

Example:

```text
more CPU
more RAM
faster disk
larger database instance
```

Vertical scaling is not a failure.

It is often the simplest first scaling step.

---

# 67. Horizontal Scaling

When one application instance becomes insufficient:

```text
instance 1
instance 2
instance 3
```

The stateless application architecture makes this straightforward.

---

# 68. Read Scaling

If read traffic becomes dominant:

```text
application
   ↓
read replicas
```

can reduce primary database load.

But critical read-after-write operations may continue using the primary.

---

# 69. Write Scaling

Write scaling is harder.

First optimize:

```text
schema
indexes
transactions
batching
connection pool
query patterns
derived data
```

before considering distributed writes.

---

# 70. Database Bottleneck Investigation

Before scaling infrastructure, identify:

```text
slow queries
lock contention
CPU
IO
connection saturation
large result sets
missing indexes
unnecessary writes
```

Scaling the wrong layer can make the system more expensive without solving the bottleneck.

---

# 71. Performance Budgets

Each critical workflow should eventually have measurable targets.

Example:

```text
API p95 latency
matching p95 latency
booking confirmation p95
payment status processing delay
notification delay
WebSocket delivery latency
```

The actual numbers should be established after baseline measurement.

---

# 72. Percentiles

Do not rely only on averages.

Measure:

```text
p50
p90
p95
p99
```

Averages can hide bad tail latency.

---

# 73. Tail Latency

Example:

```text
95% requests = fast
5% requests = extremely slow
```

Users may still experience poor reliability.

Important workflows should therefore monitor tail latency.

---

# 74. Cascading Failure

One bottleneck can cause others:

```text
DB slow
 ↓
connections held longer
 ↓
pool exhaustion
 ↓
API latency increases
 ↓
requests retry
 ↓
DB load increases
 ↓
system deteriorates
```

The architecture must prevent retry storms and unbounded concurrency.

---

# 75. Concurrency Limits

Not every operation should accept unlimited concurrent work.

Use bounded concurrency for:

```text
external provider calls
media processing
matching workers
notification workers
database-intensive jobs
```

---

# 76. Request Timeouts

Every external call should have appropriate timeouts.

Never allow:

```text
infinite wait
```

because one provider can consume application threads/connections.

---

# 77. Timeout Classification

A timeout should not automatically mean:

```text
business failure
```

Examples:

```text
payment timeout
→ status may be unknown

notification timeout
→ retry

maps timeout
→ fallback/error depending use case
```

---

# 78. API Rate Limits

Rate limits should protect:

```text
authentication
service requests
matching-triggering endpoints
payment operations
file operations
admin APIs
```

Limits should be based on abuse risk and capacity.

---

# 79. Backpressure at API Layer

When the system is overloaded, controlled rejection can be safer than accepting unlimited work.

Possible responses include:

```text
rate limited
temporarily unavailable
retry later
```

The exact behavior depends on the operation.

---

# 80. Graceful Degradation

Not every feature must fail together.

Example:

```text
Redis unavailable
 ↓
core booking still works
 ↓
cache disabled
```

Another:

```text
push provider unavailable
 ↓
in-app notification remains
```

Another:

```text
WebSocket unavailable
 ↓
REST + push remain
```

---

# 81. Critical vs Optional Dependencies

### Critical

```text
PostgreSQL
```

If unavailable, core transactional operations generally cannot continue safely.

### Important but degradable

```text
Redis
Object storage for upload operations
Maps
```

depending on operation.

### Optional side-effect

```text
push
email
SMS for non-auth messages
analytics
```

The architecture should classify dependencies explicitly.

---

# 82. Database Availability

For early production:

```text
PostgreSQL primary
+
automated backup
+
monitoring
```

Later:

```text
primary
+
standby
+
read replicas
```

High availability should be introduced when business requirements justify its complexity.

---

# 83. Redis Availability

Redis should be recoverable without losing business correctness.

If Redis is lost:

```text
cache → rebuild
presence → reconnect/repopulate
rate limits → reset/re-establish
locks → expire/recover
```

Business transactions should remain authoritative in PostgreSQL.

---

# 84. Object Storage Availability

If object storage is unavailable:

```text
upload
→ temporarily fail/retry
```

but existing job/payment state should remain intact.

The system should not corrupt the job because a photo upload failed.

---

# 85. Scalability of Admin Operations

Admin search can eventually become expensive because administrators may query broad datasets.

Admin APIs should also use:

```text
pagination
filters
indexed queries
bounded date ranges
```

Avoid unrestricted production database queries from admin screens.

---

# 86. Analytics Scaling

Analytics should eventually be decoupled from transactional workloads.

Possible progression:

```text
MVP
application events
 ↓
PostgreSQL analytics tables

Growing
 ↓
event pipeline

Large
 ↓
analytics warehouse/lake
```

Do not create a separate analytics infrastructure before the business needs it.

---

# 87. Search Scaling

The initial worker search should use PostgreSQL/PostGIS.

Only introduce a dedicated search engine if actual requirements demand:

```text
complex full-text search
large-scale ranking
faceted search
high read volume
advanced indexing
```

PostgreSQL should be allowed to handle the early workload.

---

# 88. API Caching

HTTP/API caching can eventually reduce load for relatively stable resources:

```text
catalog
profession list
skill list
public configuration
```

Avoid caching sensitive user-specific transactional responses without a clear invalidation strategy.

---

# 89. CDN

A CDN may eventually help with:

```text
public assets
profile images where intentionally public
static content
```

But sensitive worker verification documents should remain private.

---

# 90. Scaling Object Storage Delivery

For intentionally public/non-sensitive media:

```text
Object Storage
      ↓
CDN
      ↓
Client
```

For private media:

```text
Application authorization
      ↓
short-lived signed URL
      ↓
private object
```

---

# 91. Database Maintenance

Production scalability also depends on maintenance:

```text
vacuum
analyze
index maintenance
backup
statistics
connection monitoring
migration management
```

These operational concerns will be expanded in the deployment/DR documents.

---

# 92. Observability for Scaling

Every scaling component should have metrics.

### Application

```text
CPU
memory
request rate
latency
errors
threads
```

### PostgreSQL

```text
CPU
IO
connections
locks
query latency
storage
```

### Redis

```text
memory
latency
commands
connections
evictions
```

### Async

```text
backlog
throughput
retry rate
oldest item age
```

### WebSocket

```text
connections
messages
disconnects
delivery latency
```

---

# 93. Performance Testing

Use the testing strategy from [testing/01](../testing/01-testing-strategy-and-quality-engineering.md).

Realistic workload should include:

```text
customers
workers
matching
booking races
job updates
notifications
payments
WebSocket traffic
```

Not just generic GET requests.

---

# 94. Load Test Progression

Example:

```text
10 users
   ↓
100
   ↓
1,000
   ↓
10,000
   ↓
higher based on measurements
```

At each stage measure:

```text
latency
errors
DB load
Redis load
CPU
memory
async backlog
```

---

# 95. Capacity Model

Eventually document:

```text
Peak API RPS
Peak matching RPS
Peak booking transactions
Peak active workers
Peak concurrent WebSockets
Daily jobs
Daily payments
Daily notifications
Daily media uploads
```

This becomes the basis for infrastructure sizing.

---

# 96. Scaling Roadmap

### Stage 1 — MVP

```text
1 application instance
PostgreSQL
Redis
Object Storage
background workers
```

### Stage 2 — Growing Marketplace

```text
multiple application instances
load balancer
Redis shared coordination
dedicated worker processes
better database sizing
```

### Stage 3 — Higher Read Load

```text
read replicas
targeted caching
query optimization
analytics separation
```

### Stage 4 — Higher Async Load

```text
stronger worker pools
durable broker where justified
outbox scaling
```

### Stage 5 — Large Marketplace

```text
selective service extraction
partitioning
dedicated search/analytics infrastructure
regional architecture where justified
```

---

# 97. When to Introduce Kafka

Kafka should be considered when there is a demonstrated requirement such as:

```text
high event throughput
many independent consumers
durable event streaming
replay requirements
partitioned consumption
```

Not simply:

```text
"we want to be scalable."
```

---

# 98. When to Introduce Microservices

Extract a module when one or more of these become true:

```text
independent scaling requirement
independent deployment requirement
strong operational boundary
different reliability profile
different technology requirement
team ownership boundary
clear data ownership
```

Do not extract merely because a module is large.

---

# 99. Likely Future Extraction Candidates

Potential candidates—not commitments—could include:

```text
Matching
Notification
Media Processing
Payments
Analytics
```

because they may eventually have different workload characteristics.

The modular boundaries make this possible.

---

# 100. Modular Monolith as a Scaling Strategy

The modular monolith is not only a simplicity choice.

It creates:

```text
clear business boundaries
controlled dependencies
shared transactional database
low operational overhead
future extraction paths
```

The key requirement is enforcing module boundaries now.

---

# 101. Avoid Distributed Monolith

Bad evolution:

```text
Service A
Service B
Service C
Service D
   ↓
all call each other synchronously
   ↓
shared database
```

This creates distributed complexity without real independence.

If services are extracted later, each should have a meaningful boundary.

---

# 102. Scalability and Data Ownership

A future service extraction should follow data ownership.

Example:

```text
Payment module
   ↓
owns payment data

Notification module
   ↓
owns notification data
```

Other modules communicate through contracts/events rather than directly manipulating another module's tables.

---

# 103. Scalability and Transactions

The modular monolith has an advantage:

```text
multiple modules
        ↓
one PostgreSQL transaction
```

This makes early transactional correctness easier.

When services are extracted later, cross-service workflows may require:

```text
events
sagas
compensating actions
```

which is another reason not to distribute prematurely.

---

# 104. Performance vs Correctness

Never optimize by weakening critical business invariants.

Bad:

```text
skip booking transaction
```

just to improve throughput.

Bad:

```text
cache payment status permanently
```

just to reduce DB reads.

The priority is:

```text
correctness
 ↓
reliability
 ↓
performance
 ↓
cost optimization
```

for critical financial/trust workflows.

---

# 105. Performance Optimization Workflow

Use:

```text
Measure
 ↓
Identify bottleneck
 ↓
Form hypothesis
 ↓
Optimize
 ↓
Benchmark
 ↓
Regression test
 ↓
Monitor production
```

Do not optimize based purely on intuition.

---

# 106. Performance Anti-Patterns

Avoid:

```text
unbounded queries
N+1 queries
unbounded pagination
large JSON payloads
long transactions
external calls inside transactions
synchronous notification sending
synchronous media processing
global worker scans
unbounded WebSocket messages
unbounded background concurrency
premature microservices
premature sharding
premature Kafka
```

---

# 107. Scalability Invariants

The platform should maintain:

1. Application instances remain horizontally scalable.
2. Business state is not stored only in local application memory.
3. PostgreSQL remains the transactional source of truth.
4. Redis remains a support layer.
5. Critical operations use bounded transactions.
6. External calls do not unnecessarily hold DB transactions.
7. High-frequency queries have appropriate indexes.
8. Geographic filtering happens efficiently in PostGIS.
9. Matching searches remain geographically bounded.
10. APIs use bounded pagination.
11. Large collections are never returned without limits.
12. Critical financial state does not depend on cache freshness.
13. Async processing is idempotent.
14. Background workers use bounded concurrency.
15. Retry storms are prevented.
16. WebSocket traffic can degrade without corrupting business state.
17. File uploads bypass application servers where appropriate.
18. Derived data can be rebuilt from authoritative records.
19. Read replicas are introduced only with awareness of replication lag.
20. Partitioning is introduced only when workload justifies it.
21. Sharding is a later-stage option, not an MVP requirement.
22. Performance decisions are driven by measurements.
23. Scaling application instances does not accidentally overload PostgreSQL.
24. Critical workflows preserve correctness under concurrency.
25. Optional dependencies can fail without taking down unrelated core workflows.
26. Capacity planning is based on workload, not registered-user count alone.
27. Modular boundaries remain enforceable as the system grows.
28. Service extraction happens only when there is a clear operational or organizational reason.
29. Performance optimization never silently weakens business invariants.
30. Every major scaling change must be observable and measurable.

---

# 108. Final Scalability Architecture

The intended evolution is:

```text
                    ┌─────────────────────┐
                    │      Clients        │
                    └──────────┬──────────┘
                               │
                               ↓
                    ┌─────────────────────┐
                    │ Load Balancer / CDN │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┼─────────────┐
                 ↓             ↓             ↓
              App 1         App 2         App N
                 │             │             │
                 └─────────────┼─────────────┘
                               │
                  ┌────────────┼────────────┐
                  ↓            ↓            ↓
             PostgreSQL      Redis      Object Storage
                  │
                  ↓
             Background
               Workers
                  │
        ┌─────────┼──────────┐
        ↓         ↓          ↓
   Notification Matching   Media
```

The architecture can then evolve toward:

```text
                Modular Monolith
                       │
             ┌─────────┴─────────┐
             ↓                   ↓
       Horizontal Scale     Background Scale
             │                   │
             ↓                   ↓
       Read Replicas        Durable Broker
             │                   │
             └─────────┬─────────┘
                       ↓
              Selective Extraction
```

---

# 109. Final Principle

The platform should scale in this order:

```text
Correctness
   ↓
Good domain boundaries
   ↓
Good database design
   ↓
Good queries/indexes
   ↓
Efficient transactions
   ↓
Caching
   ↓
Async processing
   ↓
Horizontal application scaling
   ↓
Read scaling
   ↓
Specialized infrastructure
   ↓
Selective service extraction
```

not:

```text
Users increase
   ↓
Kafka
   ↓
Kubernetes
   ↓
Microservices
   ↓
Chaos
```

The architecture should earn complexity through measured need.

The most important scalability principle for this project is:

> **Do not build a distributed system because you expect to become large. Build a system whose boundaries allow you to become large, and introduce distributed complexity only when the workload proves that you need it.**

# End of Document
