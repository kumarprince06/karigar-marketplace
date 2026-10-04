# Analytics, Metrics, KPIs & Event Tracking

## 1. Purpose

The Karigar Marketplace needs an analytics architecture that can answer two different questions:

### Product/business analytics

> What is happening in the marketplace?

### Engineering/operational metrics

> Is the system working correctly and efficiently?

These must not be mixed together.

The analytics architecture should help answer:

```text
Are customers finding workers?
Are workers finding useful jobs?
Where are users dropping out?
Which areas have supply/demand imbalance?
How long does matching take?
How many jobs actually complete?
Where does money flow?
Where are trust problems occurring?
Is the platform technically healthy?
```

---

# 2. Analytics Philosophy

The platform should measure **real marketplace outcomes**, not vanity metrics.

For example:

```text
Downloads
    ↓
Users
    ↓
Requests
    ↓
Matches
    ↓
Acceptances
    ↓
Bookings
    ↓
Completed Jobs
```

The most important marketplace outcome is:

> **Successful completed jobs that create value for both the customer and worker.**

---

# 3. Three Metric Categories

The architecture should distinguish:

```text
Business KPIs
Product analytics
Technical/operational metrics
```

---

## 3.1 Business KPIs

Measure marketplace health.

Examples:

```text
completed jobs
gross transaction value
platform revenue
active customers
active workers
repeat customers
worker earnings
```

---

## 3.2 Product Analytics

Measure user behavior.

Examples:

```text
request created
request submitted
worker viewed
worker accepted
booking confirmed
job started
review submitted
```

---

## 3.3 Technical Metrics

Measure system behavior.

Examples:

```text
API latency
error rate
database latency
Redis latency
queue backlog
payment webhook processing
```

Technical metrics belong primarily to the observability system.

---

# 4. Source of Truth

Analytics must not replace transactional business data.

The architecture remains:

```text
PostgreSQL
     ↓
authoritative business state

Analytics
     ↓
derived measurement
```

For example:

```text
Payment SUCCESS
```

comes from the payment domain.

Analytics may record:

```text
PAYMENT_SUCCEEDED
```

but analytics must not decide whether the payment succeeded.

---

# 5. Analytics Architecture

Initial architecture:

```text
Business Transaction
        │
        ↓
Domain Event
        │
        ↓
Transactional Outbox
        │
        ↓
Analytics Consumer
        │
        ↓
Analytics/Event Storage
        │
        ↓
Reports / Dashboards
```

This follows the asynchronous architecture already defined.

---

# 6. Why Not Track Everything Directly From Controllers?

Avoid:

```text
Controller
   ↓
Business transaction
   ↓
Analytics API call
```

because analytics failures could interfere with business operations.

Instead:

```text
business transaction
       ↓
commit
       ↓
event
       ↓
analytics processing
```

Analytics should be downstream.

---

# 7. Event Types

Events should describe meaningful facts.

Examples:

```text
USER_REGISTERED
WORKER_REGISTERED
WORKER_VERIFICATION_SUBMITTED
WORKER_VERIFICATION_APPROVED

SERVICE_REQUEST_CREATED
SERVICE_REQUEST_SUBMITTED
MATCH_CREATED
MATCH_OFFERED
MATCH_ACCEPTED
MATCH_REJECTED

BOOKING_CONFIRMED
BOOKING_CANCELLED

JOB_STARTED
JOB_COMPLETED
JOB_CANCELLED
WORKER_NO_SHOW
CUSTOMER_NO_SHOW

PAYMENT_INITIATED
PAYMENT_SUCCEEDED
PAYMENT_FAILED
REFUND_SUCCEEDED

REVIEW_CREATED
DISPUTE_OPENED
DISPUTE_RESOLVED
```

---

# 8. Business Events vs Analytics Events

A domain event:

```text
JobCompleted
```

represents a business fact.

An analytics event:

```text
job_completed
```

represents the measurement of that fact.

The analytics layer should consume business facts rather than inventing a second independent source of truth.

---

# 9. Event Envelope

Analytics events should contain common metadata.

Example:

```json
{
  "eventId": "01J...",
  "eventType": "JOB_COMPLETED",
  "eventVersion": 1,
  "occurredAt": "2026-09-30T10:30:00Z",

  "actorType": "WORKER",
  "actorId": "01J...",

  "entityType": "JOB",
  "entityId": "01J...",

  "correlationId": "01J...",
  "properties": {
    "profession": "ELECTRICIAN",
    "serviceAreaId": "area-123"
  }
}
```

---

# 10. Event ID

Every analytics event needs a unique event ID.

Example:

```text
eventId = 01J...
```

This supports:

```text
deduplication
idempotent processing
reconciliation
debugging
```

---

# 11. Event Version

Events should be versioned.

Example:

```text
JOB_COMPLETED v1
JOB_COMPLETED v2
```

If the schema evolves, consumers should not silently interpret new data using old assumptions.

---

# 12. Immutable Event Meaning

Once emitted:

```text
JOB_COMPLETED
```

should retain the same semantic meaning.

New information should generally be added through:

```text
new event version
```

or:

```text
separate event
```

rather than changing historical meaning.

---

# 13. Core Marketplace Funnel

The primary product funnel is:

```text
Request Created
       ↓
Request Submitted
       ↓
Matched
       ↓
Worker Accepted
       ↓
Booking Confirmed
       ↓
Job Started
       ↓
Job Completed
       ↓
Payment Completed
       ↓
Review Submitted
```

This funnel should be measurable.

---

# 14. Request Creation

Track:

```text
SERVICE_REQUEST_CREATED
```

Useful properties:

```text
profession
requested time type
urgency
area
attachment presence
customer type
```

Avoid unnecessary personal data.

---

# 15. Request Submission

Track:

```text
SERVICE_REQUEST_SUBMITTED
```

Useful properties:

```text
profession
area
urgency
time-to-submit
```

This allows measurement of:

```text
created → submitted
```

conversion.

---

# 16. Matching Metrics

Track:

```text
match attempts
candidates discovered
offers created
offers accepted
offers rejected
offers expired
requests with no candidates
```

Important metrics:

```text
match rate
time to first match
candidate count
acceptance rate
```

---

# 17. Matching Funnel

Example:

```text
1,000 requests
      ↓
800 matched
      ↓
500 accepted
      ↓
450 booked
      ↓
400 completed
```

The system should preserve these measurements without presenting an overall judgment about marketplace performance.

---

# 18. Match Failure Analysis

Track why candidates were excluded.

Examples:

```text
TOO_FAR
WRONG_SKILL
NOT_AVAILABLE
CAPACITY_FULL
NOT_VERIFIED
ACCOUNT_INACTIVE
```

This helps distinguish:

```text
demand problem
```

from:

```text
supply problem
```

from:

```text
matching-rule problem
```

---

# 19. Worker Metrics

Important worker measurements:

```text
active workers
workers accepting jobs
workers receiving offers
worker acceptance rate
worker cancellation rate
worker no-show rate
completed jobs
repeat customers
earnings
```

These should be contextualized by:

```text
time period
profession
area
job volume
```

Avoid interpreting small sample sizes as definitive worker performance.

---

# 20. Customer Metrics

Track:

```text
registered customers
active customers
requesting customers
customers with completed jobs
repeat customers
requests/customer
cancellations
```

---

# 21. Repeat Customer Metric

A valuable marketplace signal is:

```text
customer completes first job
        ↓
customer returns
        ↓
another completed job
```

Measure:

```text
repeat customer rate
time to second request
jobs per repeat customer
```

---

# 22. Worker Retention

Workers may behave differently from customers.

Track:

```text
worker registered
worker activated
worker received first offer
worker completed first job
worker completed multiple jobs
```

Potential cohort metrics:

```text
Day 7
Day 30
Day 90
```

Exact retention definitions should be finalized during product analytics implementation.

---

# 23. Worker Activation Funnel

Example:

```text
Registered
    ↓
Profile Completed
    ↓
Verification Submitted
    ↓
Verification Approved
    ↓
Availability Enabled
    ↓
First Offer
    ↓
First Acceptance
    ↓
First Completed Job
```

This identifies onboarding friction.

---

# 24. Customer Activation Funnel

Example:

```text
Registered
    ↓
Address Added
    ↓
Request Created
    ↓
Request Submitted
    ↓
Booking Confirmed
    ↓
First Job Completed
```

---

# 25. Job Completion

Track:

```text
JOB_STARTED
JOB_COMPLETED
```

Important measurements:

```text
start → completion duration
completion rate
cancellation rate
no-show rate
```

---

# 26. Cancellation Metrics

Track cancellation separately for:

```text
customer
worker
system
```

Also track:

```text
reason
job stage
time before scheduled start
```

Cancellation should not automatically be interpreted as poor worker/customer behavior.

---

# 27. No-Show Metrics

Track:

```text
WORKER_NO_SHOW
CUSTOMER_NO_SHOW
```

Separately from cancellations.

This distinction was established in the domain model.

---

# 28. Payment Metrics

Financial analytics may include:

```text
payment attempts
successful payments
failed payments
pending payments
refunds
refunded amount
worker earnings
platform fees
settlements
```

Financial analytics should derive from authoritative financial records.

---

# 29. Money Metrics

All monetary analytics should preserve:

```text
amountMinor
currency
```

and should never use floating-point calculations for financial truth.

Analytics may aggregate into reporting units, but the source data remains precise integer monetary values.

---

# 30. Gross Transaction Value

A future marketplace KPI may be:

```text
GTV = total value of completed/paid marketplace transactions
```

The exact business definition must be explicitly documented.

Do not casually mix:

```text
authorized
captured
refunded
completed
settled
```

amounts.

---

# 31. Platform Revenue

Platform revenue should be derived from explicit financial records.

Potential components:

```text
platform fee
service fee
other platform revenue
```

Do not calculate revenue simply as:

```text
total payments
```

because customer payment and platform revenue are different concepts.

---

# 32. Worker Earnings

Track:

```text
gross worker earning
platform fee
adjustments
refund effects
settlement
```

Worker earnings and settlement remain separate concepts.

---

# 33. Refund Metrics

Track:

```text
refund count
refund amount
refund reason
refund rate
time to refund
failed refunds
```

Refund metrics should be based on authoritative refund records.

---

# 34. Trust Metrics

Trust-related metrics include:

```text
verification submissions
verification approval rate
verification processing time
completed jobs
ratings
review volume
disputes
dispute rate
no-shows
```

Avoid creating an opaque single "trust score" as the primary analytics measure.

---

# 35. Review Metrics

Track:

```text
review eligible jobs
reviews submitted
review submission rate
rating distribution
flagged reviews
moderated reviews
```

Rating distributions should be viewed with job/customer/worker volume context.

---

# 36. Dispute Metrics

Track:

```text
disputes opened
disputes per completed job
dispute categories
resolution time
resolution outcomes
refund-related disputes
```

A dispute is not automatically evidence that one party acted improperly.

---

# 37. Verification Metrics

Track:

```text
pending verification count
submission volume
approval/rejection counts
processing time
resubmission rate
revocation count
```

This can expose operational bottlenecks.

---

# 38. Geographic Analytics

Since the marketplace begins in a geographically constrained area, geography is important.

Track:

```text
requests by area
workers by area
available workers by area
completed jobs by area
unmatched requests by area
```

---

# 39. Geographic Supply-Demand

A useful model:

```text
Area
 ├── Demand
 │    └── service requests
 │
 ├── Supply
 │    └── active/available workers
 │
 └── Outcomes
      ├── matches
      ├── bookings
      └── completed jobs
```

This can reveal geographic gaps.

---

# 40. Time-Based Analytics

Measure marketplace behavior by:

```text
hour
day
weekday/weekend
week
month
```

Potential questions:

```text
When are requests highest?
When are workers most available?
When do unmatched requests increase?
```

---

# 41. Profession Analytics

Since MVP starts with:

```text
electricians
plumbers
```

measure separately:

```text
request volume
matching
booking
completion
cancellation
payment
reviews
```

This avoids hiding category differences inside aggregate metrics.

---

# 42. Service Skill Analytics

Eventually measure:

```text
requests by skill
worker supply by skill
skill-specific match rate
```

This can inform catalog and worker onboarding decisions.

---

# 43. Event Properties

Events should include only properties useful for analysis.

Potential dimensions:

```text
profession
skill
area
urgency
request type
customer cohort
worker cohort
platform version
source/channel
```

Avoid dumping entire database records into analytics.

---

# 44. PII Minimization

Analytics is not a reason to collect everything.

Avoid storing:

```text
full phone number
full address
identity documents
payment credentials
exact home coordinates
private dispute content
```

unless there is a clearly defined analytical requirement.

---

# 45. User Identity in Analytics

Where user-level analysis is required, use:

```text
internal user ID
```

rather than:

```text
phone number
email
name
```

where possible.

---

# 46. Location Privacy in Analytics

Exact GPS data should be minimized.

Prefer:

```text
area ID
geohash with appropriate precision
service region
```

depending on analytical needs.

The precision should be sufficient for analysis without creating unnecessary location exposure.

---

# 47. Device Analytics

Potential events may include:

```text
app opened
screen viewed
request form started
request form abandoned
```

These can help understand UX.

But event tracking should remain purposeful rather than recording every click indefinitely.

---

# 48. Product Event Naming

Use a consistent naming convention.

Example:

```text
USER_REGISTERED
SERVICE_REQUEST_CREATED
SERVICE_REQUEST_SUBMITTED
MATCH_ACCEPTED
BOOKING_CONFIRMED
JOB_COMPLETED
PAYMENT_SUCCEEDED
```

Avoid inconsistent names such as:

```text
userSignup
UserCreated
signup_user
new-user
```

within the same analytics system.

---

# 49. Event Naming Rules

Recommended:

```text
DOMAIN_OBJECT + ACTION/STATE
```

Examples:

```text
WORKER_REGISTERED
BOOKING_CONFIRMED
PAYMENT_SUCCEEDED
REVIEW_CREATED
```

Events should be understandable without reading implementation code.

---

# 50. Event Documentation

Every important analytics event should have an event specification:

```text
event name
version
description
producer
trigger
required properties
optional properties
PII classification
consumer
retention
```

This becomes an analytics contract.

---

# 51. Event Schema Registry

Initially, event schemas can be documented in:

```text
docs/events/
```

Later, a formal schema registry may be introduced if event volume and consumer count justify it.

---

# 52. Event Ownership

The module that owns the business fact owns the event.

Examples:

```text
Worker module
    → WORKER_REGISTERED

Booking module
    → BOOKING_CONFIRMED

Job module
    → JOB_COMPLETED

Payment module
    → PAYMENT_SUCCEEDED
```

Analytics consumes them.

---

# 53. Analytics Consumer

A dedicated analytics consumer can transform:

```text
domain event
```

into:

```text
analytics record
```

without modifying the original business event.

---

# 54. Analytics Storage

Initial options may include:

```text
PostgreSQL analytics tables
```

if scale is small.

Later, analytics may move to:

```text
data warehouse
```

or:

```text
analytical database
```

when query volume/data volume justifies it.

The architecture should avoid prematurely introducing a large data platform.

---

# 55. Operational Database vs Analytics Database

Do not allow expensive analytics queries to continuously compete with transactional workloads.

Eventually:

```text
PostgreSQL
     ↓
CDC/event pipeline
     ↓
Analytics storage
```

may be introduced.

---

# 56. Analytics Read Models

Examples:

```text
daily_marketplace_metrics
worker_cohort_metrics
customer_cohort_metrics
profession_metrics
area_metrics
funnel_metrics
financial_metrics
```

These are derived data.

---

# 57. Daily Aggregations

A common pattern:

```text
raw events
    ↓
daily aggregation
    ↓
weekly/monthly reporting
```

This can dramatically reduce repeated computation.

---

# 58. Event Deduplication

Because the system uses at-least-once processing:

```text
same event may arrive twice
```

Analytics consumers must be idempotent.

Use:

```text
event_id unique constraint
```

or equivalent deduplication.

---

# 59. Event Ordering

Analytics should not blindly assume perfect event ordering.

For example:

```text
JOB_COMPLETED
```

could be processed before:

```text
JOB_STARTED
```

if asynchronous delivery is delayed.

Use event timestamps/versioning where sequence matters.

---

# 60. Late Events

Events may arrive late.

Analytics pipelines should handle:

```text
event occurred yesterday
but processed today
```

without corrupting historical reporting.

---

# 61. Event Correction

If an event was incorrectly emitted, do not silently mutate the event's historical meaning.

Prefer:

```text
correction event
```

or:

```text
derived-data correction
```

depending on the problem.

---

# 62. Analytics Reprocessing

Derived analytics should be rebuildable from source events/business records where practical.

This is valuable when:

```text
analytics bug
schema change
aggregation bug
new KPI
```

occurs.

---

# 63. Replay Safety

Reprocessing analytics events should not cause:

```text
duplicate payment
duplicate notification
duplicate booking
```

Analytics consumers must remain side-effect-safe.

---

# 64. KPI Definitions

Every KPI should have a precise definition.

Example:

### Completed Jobs

```text
Count of jobs whose authoritative job state
reached WORK_COMPLETED during the selected period.
```

This is much better than:

```text
"successful jobs"
```

without a formal definition.

---

# 65. Metric Dictionary

Maintain a central metric dictionary.

Example:

```text
Metric: Match Rate
Definition:
Percentage of submitted service requests that
received at least one valid match within the defined
matching window.

Owner:
Marketplace

Dimensions:
profession
area
time period
```

---

# 66. Avoid Metric Ambiguity

Different teams should not calculate:

```text
"active worker"
```

differently.

Define whether active means:

```text
account active
profile active
accepting jobs
received an offer
completed a job
```

Each is a different metric.

---

# 67. Marketplace KPI Categories

A useful framework:

```text
Acquisition
Activation
Marketplace Liquidity
Conversion
Completion
Retention
Trust
Financial
Operations
```

---

# 68. Acquisition

Examples:

```text
new customers
new workers
registration source
referral source
```

---

# 69. Activation

Customer:

```text
registration → first completed job
```

Worker:

```text
registration → first completed job
```

---

# 70. Marketplace Liquidity

Important marketplace measurements:

```text
demand
supply
matching
acceptance
booking
completion
```

Liquidity should be analyzed geographically and by profession.

---

# 71. Conversion

Potential funnel metrics:

```text
request → match
match → acceptance
acceptance → booking
booking → start
start → completion
```

Each stage has different failure causes.

---

# 72. Retention

Customer retention:

```text
completed job
     ↓
returns for another job
```

Worker retention:

```text
completed job
     ↓
continues accepting/completing work
```

Definitions should use explicit time windows.

---

# 73. Trust

Track:

```text
verification
reviews
disputes
no-shows
repeat relationships
```

Do not reduce trust to a single score.

---

# 74. Financial

Track:

```text
transaction volume
payment success
refunds
platform fees
worker earnings
settlements
```

Financial definitions must align with the payment/ledger architecture.

---

# 75. Operations

Track:

```text
verification backlog
dispute backlog
support volume
notification failures
matching failures
payment issues
```

---

# 76. Cohort Analysis

Cohorts can be created by:

```text
registration week
first completed job week
profession
geographic area
acquisition channel
```

Example:

```text
September customer cohort
October repeat rate
November repeat rate
```

---

# 77. Cohort Privacy

Cohort sizes should be considered when displaying sensitive behavior.

Avoid exposing tiny groups in ways that could identify individuals.

---

# 78. Experimentation

Future product experiments may require:

```text
experiment ID
variant
assignment timestamp
user/worker eligibility
```

Experiment assignment should be deterministic where necessary.

---

# 79. Experiment Data

An experiment should measure:

```text
exposure
behavior
outcome
```

Example:

```text
New request flow shown
      ↓
Request submitted
      ↓
Booking completed
```

Do not use experimentation infrastructure until there is a real product question.

---

# 80. Feature Flags

Feature flags should be observable.

Record:

```text
feature
variant
environment
assignment
```

where needed.

---

# 81. Analytics and Technical Observability

Business analytics:

```text
"How many jobs completed?" id="zz0sg0"
```

Technical observability:

```text
"How long did job completion API take?" id="zv64o7"
```

These systems can correlate using:

```text
requestId
traceId
entityId
eventId
```

but should remain conceptually distinct.

---

# 82. Dashboard Categories

Initial dashboards:

### Marketplace Dashboard

```text
requests
matches
bookings
completed jobs
```

### Worker Dashboard

```text
active workers
worker activation
worker supply
```

### Customer Dashboard

```text
active customers
repeat usage
```

### Financial Dashboard

```text
payments
refunds
earnings
settlements
```

### Trust Dashboard

```text
verification
reviews
disputes
no-shows
```

---

# 83. Geographic Dashboard

Show:

```text
area
demand
supply
matching
completion
```

Potential visualization:

```text
Area A
Requests       320
Workers        120
Matched        270
Completed      210
```

---

# 84. Profession Dashboard

For:

```text
Electrician
Plumber
```

show:

```text
requests
active workers
match rate
bookings
completed jobs
```

This allows category-specific analysis.

---

# 85. Alerting from Analytics

Analytics can eventually produce business alerts such as:

```text
sudden increase in unmatched requests
payment failure increase
verification backlog increase
completion rate change
```

But alerts should use statistically and operationally meaningful thresholds.

---

# 86. Metric Cardinality

Avoid high-cardinality metric labels.

Bad:

```text
metric{userId="..."}
```

Better:

```text
metric{profession="ELECTRICIAN"}
```

or:

```text
metric{area="HOWRAH_AREA_1"}
```

User-level analysis belongs in analytics storage, not Prometheus-style operational metrics.

---

# 87. Event Volume Management

Not every UI interaction needs a backend event.

High-volume events should be evaluated for:

```text
analytical value
storage cost
processing cost
privacy impact
```

---

# 88. Event Sampling

Sampling may be appropriate for:

```text
high-volume low-value behavioral events
```

but should not be used blindly for:

```text
payments
bookings
job completion
financial events
security events
```

Critical business events should remain complete.

---

# 89. Analytics Retention

Different data may require different retention:

```text
raw events
aggregated metrics
financial analytics
product behavior
```

Retention should follow:

```text
business need
privacy requirements
storage cost
legal/compliance requirements
```

Exact durations remain an explicit decision.

---

# 90. Data Quality

Analytics must have its own quality checks.

Examples:

```text
event count consistency
duplicate detection
missing event detection
schema validation
referential integrity
aggregation reconciliation
```

---

# 91. Business Reconciliation

For example:

```text
PostgreSQL completed jobs
        vs
analytics completed jobs
```

should be periodically compared.

Differences should be explainable.

---

# 92. Financial Reconciliation

Similarly:

```text
payment records
        vs
financial analytics
```

must reconcile.

Analytics must never become an alternate financial ledger.

---

# 93. Analytics Failure

If analytics processing fails:

```text
customer booking should still work id="y0aj6v"
```

because analytics is downstream.

Outbox/event processing should retry.

---

# 94. Analytics Backlog

Monitor:

```text
pending analytics events
oldest event age
processing rate
failure rate
```

A growing backlog means analytics is becoming stale.

It should not silently be treated as real-time.

---

# 95. Real-Time vs Batch Analytics

Initial:

```text
near-real-time operational metrics
+
periodic aggregate reports
```

Later:

```text
streaming analytics
real-time dashboards
warehouse
BI tools
```

only when justified.

---

# 96. Data Warehouse Evolution

As scale increases:

```text
PostgreSQL
      ↓
Outbox / CDC
      ↓
Event pipeline
      ↓
Data warehouse
      ↓
BI / Analytics
```

This isolates analytical workloads from transactional workloads.

---

# 97. CDC

Change Data Capture may eventually help replicate transactional changes.

However:

> CDC should not replace domain events for business semantics.

Database changes describe persistence changes.

Domain events describe business facts.

---

# 98. Analytics Security

Analytics systems should enforce:

```text
role-based access
data minimization
encryption
audit
export controls
```

Financial and sensitive analytics require restricted access.

---

# 99. Analyst Access

Analysts may need:

```text
aggregated marketplace data
```

without access to:

```text
identity documents
private addresses
payment credentials
private dispute evidence
```

---

# 100. Analytics API

The product APIs should not directly expose internal analytics tables.

If customer/worker-facing analytics are needed:

```text
Analytics Application Service
```

should expose an intentional read model.

---

# 101. Worker-Facing Analytics

Workers may eventually see:

```text
completed jobs
earnings
customer ratings
repeat customers
acceptance information
```

Only information appropriate to their role should be exposed.

---

# 102. Customer-Facing Analytics

Customers may eventually see:

```text
booking history
spending history
completed jobs
```

Again, these should come from authorized business read models.

---

# 103. Admin Analytics

Admin/Ops can see broader metrics:

```text
marketplace health
supply/demand
payments
trust
operations
```

but access remains role-controlled.

---

# 104. Analytics Architecture Module

The application can initially contain:

```text
analytics/
├── api/
├── application/
│   ├── query/
│   ├── service/
│   └── port/
├── domain/
│   ├── event/
│   └── model/
└── infrastructure/
    ├── persistence/
    ├── aggregation/
    └── event/
```

At first, analytics may remain relatively lightweight.

---

# 105. Event Documentation Directory

Recommended:

```text
docs/
└── analytics/
    ├── event-catalog.md
    ├── metric-dictionary.md
    ├── kpi-definitions.md
    ├── funnel-definitions.md
    └── data-retention.md
```

---

# 106. Example Event Catalog

```text
USER_REGISTERED
    Producer: Identity
    Consumer: Analytics

WORKER_REGISTERED
    Producer: Worker
    Consumer: Analytics

SERVICE_REQUEST_CREATED
    Producer: Service Request
    Consumer: Analytics

MATCH_ACCEPTED
    Producer: Matching
    Consumer: Analytics

BOOKING_CONFIRMED
    Producer: Booking
    Consumer: Analytics

JOB_COMPLETED
    Producer: Job
    Consumer: Analytics

PAYMENT_SUCCEEDED
    Producer: Payment
    Consumer: Analytics

REVIEW_CREATED
    Producer: Review
    Consumer: Analytics
```

---

# 107. Example Metric Definition

```text
Metric:
Completed Jobs

Definition:
Number of jobs that transitioned into WORK_COMPLETED
during the selected reporting period.

Source:
Job domain

Dimensions:
profession
area
time period

Exclusions:
test/internal jobs

Authority:
Job state
```

---

# 108. Example Funnel Definition

```text
Marketplace Completion Funnel

Population:
Submitted service requests

Stage 1:
Submitted

Stage 2:
At least one valid match

Stage 3:
Worker accepted

Stage 4:
Booking confirmed

Stage 5:
Job started

Stage 6:
Job completed
```

The exact attribution window must be defined so that historical reporting remains consistent.

---

# 109. Test Jobs

Analytics should identify:

```text
test/sandbox jobs
```

so they do not pollute production KPIs.

This should be handled through explicit environment/type metadata rather than manual cleanup.

---

# 110. Internal/Admin Activity

Internal operational actions should not accidentally appear as normal customer behavior.

For example:

```text
admin-created test request
```

should be distinguishable from a real customer request.

---

# 111. Analytics and Versioning

Track application version where useful:

```text
appVersion
releaseVersion
featureFlag
```

This helps investigate:

```text
"Did this metric change after deployment?" 
```

---

# 112. Event Correlation

For a marketplace transaction:

```text
Request
  ↓
Match
  ↓
Booking
  ↓
Job
  ↓
Payment
```

events should preserve identifiers that allow analytics to connect the journey.

Possible identifiers:

```text
requestId
bookingId
jobId
paymentId
correlationId
```

---

# 113. End-to-End Marketplace Analytics

A complete customer journey can therefore be reconstructed:

```text
Customer
   ↓
Request
   ↓
Matching
   ↓
Worker
   ↓
Booking
   ↓
Job
   ↓
Payment
   ↓
Review
```

This is one of the most valuable analytical capabilities of the platform.

---

# 114. Analytics and Worker Professional Passport

The Worker Professional Passport can eventually derive evidence such as:

```text
completed jobs
profession
skills
verification
ratings
review count
reliability indicators
```

But the passport should derive from authoritative domain records rather than independently maintaining conflicting values.

---

# 115. Analytics and Marketplace Learning

Analytics should help answer product questions such as:

```text
Which requests fail to match?
Where is worker supply insufficient?
Which onboarding step causes worker drop-off?
Which request types require longer completion times?
Where are cancellations concentrated?
How often do customers return?
```

These answers should inform future product decisions.

---

# 116. Avoid Vanity Metrics

Examples that should not become primary success measures:

```text
app downloads
page views
total registered accounts
number of API requests
raw notification count
total events processed
```

These can be useful secondary measurements but do not represent marketplace value by themselves.

---

# 117. North-Star Marketplace Metric

A candidate north-star metric is:

```text
Completed jobs per defined period
```

potentially segmented by:

```text
customer
worker
profession
area
```

The exact north-star definition remains a business decision.

---

# 118. Marketplace Health Is Multi-Dimensional

One number is not enough.

The system should simultaneously observe:

```text
Demand
Supply
Matching
Acceptance
Booking
Completion
Trust
Financial health
Retention
```

This prevents over-optimizing one metric while damaging another.

---

# 119. Example Marketplace Health Model

```text
                 Marketplace Health
                        │
       ┌────────────────┼────────────────┐
       ↓                ↓                ↓
     Demand           Supply          Liquidity
       │                │                │
    Requests        Workers          Matching
                                      Booking
                                        │
                                        ↓
                                    Completion
                                        │
                       ┌────────────────┼───────────────┐
                       ↓                ↓               ↓
                     Trust           Money          Retention
```

---

# 120. KPI Governance

Every important KPI should have:

```text
owner
definition
source
calculation
dimensions
refresh frequency
retention
```

This prevents teams from producing multiple incompatible versions of the same metric.

---

# 121. Analytics Governance

Changes to critical metrics should be documented.

Example:

```text
Match Rate v1
```

is not silently changed into:

```text
Match Rate v2
```

without recording the definition change.

Historical dashboards should remain interpretable.

---

# 122. Analytics Privacy Invariants

Analytics must:

1. Collect only purposeful data.
2. Minimize PII.
3. Avoid unnecessary exact location.
4. Avoid identity documents.
5. Avoid payment credentials.
6. Restrict sensitive analytics access.
7. Protect exports.
8. Apply retention policies.
9. Respect data deletion/anonymization requirements where applicable.
10. Prevent analytics from becoming a shadow database of personal information.

---

# 123. Analytics Technical Invariants

The system must:

1. Treat PostgreSQL/domain state as authoritative.
2. Generate meaningful events from business facts.
3. Use unique event IDs.
4. Version event schemas.
5. Make consumers idempotent.
6. Expect at-least-once delivery.
7. Handle late events.
8. Avoid assuming event ordering.
9. Support safe reprocessing.
10. Prevent analytics failures from affecting core transactions.
11. Preserve correlation identifiers.
12. Validate event schemas.
13. Monitor analytics backlog.
14. Reconcile important analytics against source data.
15. Separate analytics workloads from transactional workloads when necessary.
16. Avoid high-cardinality operational metrics.
17. Keep critical financial analytics aligned with financial source records.
18. Keep derived data distinguishable from authoritative state.

---

# 124. Analytics Business Invariants

The platform should preserve:

1. Completed jobs are derived from authoritative job state.
2. Payment metrics are derived from authoritative payment records.
3. Refund metrics are derived from authoritative refund records.
4. Worker earnings are derived from financial records.
5. Verification metrics are derived from verification state/history.
6. Review metrics are derived from legitimate review records.
7. Dispute metrics are derived from dispute records.
8. Matching metrics distinguish candidate discovery from worker acceptance.
9. Cancellation and no-show metrics remain separate.
10. Geographic metrics use defined geographic boundaries.
11. Profession metrics use stable catalog references.
12. KPI definitions are explicit and versioned where necessary.
13. Historical reports remain interpretable after schema changes.

---

# 125. MVP Analytics Scope

For the MVP, implement:

```text
event catalog
business event tracking
transactional outbox integration
core marketplace funnel
customer activation
worker activation
completed jobs
matching metrics
booking metrics
cancellation/no-show metrics
payment/refund metrics
review/dispute metrics
basic geographic metrics
basic profession metrics
admin marketplace dashboard
metric dictionary
analytics data retention policy
event deduplication
basic reconciliation
```

---

# 126. What We Do Not Need Initially

Avoid:

```text
large data lake
complex streaming platform
Kafka solely for analytics
real-time ML pipelines
AI analytics agents
massive BI infrastructure
custom recommendation engine
full customer data platform
complex attribution system
```

The marketplace should first generate useful, trustworthy data.

---

# 127. Future Analytics Evolution

As the marketplace grows:

```text
Phase 1
PostgreSQL + outbox + basic analytics

        ↓

Phase 2
Dedicated analytics storage

        ↓

Phase 3
Data warehouse + ETL/ELT

        ↓

Phase 4
Advanced experimentation

        ↓

Phase 5
Predictive analytics / ML
```

Each phase should be triggered by actual analytical requirements.

---

# 128. Final Analytics Architecture

```text
                 Business Modules
                       │
             ┌─────────┼─────────┐
             ↓         ↓         ↓
          Request    Booking    Payment
             │         │         │
             └─────────┼─────────┘
                       ↓
                Domain Events
                       │
                       ↓
              Transactional Outbox
                       │
                       ↓
              Analytics Consumers
                       │
             ┌─────────┼─────────┐
             ↓         ↓         ↓
           Events   Aggregates  Reports
             │         │         │
             └─────────┼─────────┘
                       ↓
               Analytics Storage
                       │
             ┌─────────┼─────────┐
             ↓         ↓         ↓
          Product    Business   Admin
         Analytics    KPIs      Ops
```

---

# 129. Final Principle

Analytics should answer:

> **What is actually happening in the marketplace?**

without becoming a second source of truth.

The architecture should therefore follow:

```text
Business Fact
     ↓
Domain Event
     ↓
Reliable Event Delivery
     ↓
Analytics Processing
     ↓
Metric
     ↓
Decision Support
```

The key principle is:

> **Measure the real marketplace outcome, preserve the meaning of the data, minimize personal information, and never let analytics compromise transactional correctness.**

For this product, the most important analytical chain is:

```text
Request
   ↓
Match
   ↓
Accept
   ↓
Book
   ↓
Start
   ↓
Complete
   ↓
Pay
   ↓
Review
   ↓
Return
```

That chain should become the foundation for understanding whether the marketplace is actually creating durable value for both customers and skilled workers.

# End of Document
