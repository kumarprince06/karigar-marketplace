# Product MVP Scope, Release Plan & Future Phases

## 1. Purpose

The previous documents defined how the system should be engineered.

This document defines **what should actually be built, in what order, and what should deliberately not be built yet**.

The objective is to prevent:

```text
over-engineering
feature creep
premature microservices
premature infrastructure
unclear MVP boundaries
building technically impressive features without validating the marketplace
```

The product should reach a real usable marketplace as early as possible while preserving the architectural foundations required for future growth.

---

# 2. Product Development Principle

The first release should not attempt to build the complete long-term vision.

The initial objective is to validate one fundamental loop:

```text
Customer needs a skilled worker
        ↓
Customer creates service request
        ↓
Suitable workers are discovered
        ↓
Worker accepts
        ↓
Booking is confirmed
        ↓
Worker performs the job
        ↓
Job is completed
        ↓
Payment is handled
        ↓
Customer reviews worker
```

This is the **MVP marketplace loop**.

Everything else should support this loop.

---

# 3. MVP Definition

MVP means:

> The smallest production-capable version that can support a real customer-worker transaction safely.

It does **not** mean:

```text
cheap implementation
poor security
no observability
no testing
no data integrity
```

The MVP should still have production-grade foundations.

---

# 4. Initial Marketplace Boundary

Initial geography:

```text
Howrah
```

Initial worker categories:

```text
Electrician
Plumber
```

Initial marketplace model:

```text
Customer requests work
        ↓
Platform notifies nearby suitable workers
        ↓
Interested workers accept
        ↓
Customer picks one worker → booking  (ADR 0017)
        ↓
Worker performs work
        ↓
Payment
        ↓
Review
```

The exact launch neighborhood/service radius remains a product validation decision.

---

# 5. MVP Actors

The MVP has three primary platform roles:

```text
CUSTOMER
WORKER
ADMIN
```

External systems:

```text
Payment Provider
SMS Provider
Push Notification Provider
Object Storage
Maps/Geolocation Provider
```

---

# 6. MVP Customer Capabilities

Customer must be able to:

```text
Register/login
Manage profile
Manage addresses
Create service request
Select profession
Select/request skills
Describe problem
Provide location
Select urgency/time
Upload photos
Submit request
View matching progress
View matched workers
Select/accept suitable worker where applicable
Confirm booking
View booking
Track job status
Cancel according to rules
Approve additional work
Make payment
View payment status
View completed job
Submit review
View worker profile
```

---

# 7. MVP Customer Request

A service request should capture enough information to enable useful matching.

Minimum conceptual data:

```text
profession
problem description
service location
preferred date/time or availability window
urgency
attachments
```

Optional fields should only be added if they improve the initial workflow.

---

# 8. MVP Worker Capabilities

Worker must be able to:

```text
Register/login
Create worker profile
Select profession
Select skills
Provide experience
Configure service area
Configure availability
Complete required verification
Turn accepting-jobs ON/OFF
Receive relevant job opportunities
Accept/reject opportunities
View booking
Update job status
Propose additional work
Complete job
View earnings
View payment/job history
Receive reviews
View professional profile
```

---

# 9. MVP Worker Profile

The worker profile should establish basic professional identity.

Example:

```text
Name
Profile photo
Profession
Skills
Experience
Service area
Verification status
Completed jobs
Rating
Review count
Availability indicator
```

Do not expose sensitive verification evidence.

---

# 10. MVP Worker Verification

Minimum verification should support trust without creating an excessively complex onboarding system.

Candidate MVP verification:

```text
Phone verification
Identity verification
Profession/skill verification
```

The exact verification mechanism/provider is an open product and compliance decision.

---

# 11. MVP Admin Capabilities

The admin platform is part of MVP.

Administrators should be able to:

```text
View customers
View workers
Review worker verification
Approve/reject verification
Suspend workers
Suspend customers where required
View service requests
View bookings
View jobs
View payments
View refunds
Review disputes
Moderate reviews
View audit events
Inspect operational failures
```

Admin actions must be:

```text
authorized
reasoned where appropriate
audited
```

---

# 12. MVP Service Request Lifecycle

The initial state machine:

```text
DRAFT
  ↓
SUBMITTED
  ↓
MATCHING
  ↓
MATCH_FOUND
  ↓
BOOKED
  ↓
COMPLETED
```

Alternative terminal states:

```text
CANCELLED
EXPIRED
FAILED_TO_MATCH
```

The exact transitions remain governed by the domain rules defined previously.

---

# 13. MVP Matching

Matching should initially be:

```text
deterministic
explainable
geographically aware
simple
fast
observable
```

Candidate filtering:

```text
Worker active
        ↓
Correct profession
        ↓
Required skills
        ↓
Serves location
        ↓
Available
        ↓
Has capacity
        ↓
Required verification
        ↓
Distance/ranking
```

---

# 14. MVP Matching Should Not Be AI

The first matching engine does not need:

```text
machine learning
LLMs
complex recommendation systems
dynamic pricing
black-box ranking
```

A deterministic policy is easier to:

```text
debug
test
explain
measure
change
```

Later data can justify more sophisticated matching.

---

# 15. MVP Worker Matching Experience

A worker may receive:

```text
New job available
Profession
General skill requirement
Approximate location
Requested time
Urgency
Expected compensation information if applicable
```

Do not expose customer-sensitive information unnecessarily before acceptance.

---

# 16. MVP Booking Model

Booking remains separate from:

```text
Service Request
Job
Payment
```

The system should support:

```text
one confirmed booking per service request
```

for the initial model unless product validation demonstrates a need for another workflow.

---

# 17. MVP Job Execution

Job lifecycle:

```text
CONFIRMED
    ↓
EN_ROUTE
    ↓
ARRIVED
    ↓
WORK_STARTED
    ↓
WORK_COMPLETED
```

Alternative outcomes:

```text
CANCELLED
WORKER_NO_SHOW
CUSTOMER_NO_SHOW
FAILED
```

---

# 18. MVP Additional Work

Initial additional-work flow:

```text
Worker proposes additional work
        ↓
Customer approves/rejects
        ↓
Approved work becomes part of financial/job record
```

Do not silently modify the original price or transaction.

---

# 19. MVP Payment

The MVP should support:

```text
Customer payment
Payment status
Provider transaction reference
Webhook handling
Payment idempotency
Payment history
Basic refunds
```

Use one payment provider initially.

The provider choice remains an implementation/business decision.

---

# 20. MVP Financial Model

The system should already distinguish:

```text
Customer payment
Platform fee
Worker earning
Refund
Settlement
```

Even if the initial implementation has a simple settlement process.

This prevents future financial redesign.

---

# 21. MVP Review System

Minimum:

```text
1–5 rating
Optional text review
One eligible review per job/reviewee
Completed-job eligibility
Basic moderation
```

Do not initially implement a complex reputation algorithm.

---

# 22. MVP Trust Signals

Display evidence-based information such as:

```text
Profession
Verified status
Skills
Experience
Completed jobs
Rating
Review count
Basic reliability indicators where sufficient data exists
```

Avoid an opaque:

```text
"Trust Score: 92"
```

in the first release.

---

# 23. Worker Professional Passport — MVP Version

The first version can be simple:

```text
Worker Identity
Profession
Skills
Experience
Verification
Completed Jobs
Rating
Reviews
Service Area
Basic Reliability Information
```

This establishes the foundation for the longer-term professional identity concept.

---

# 24. MVP Notifications

Initial channels:

```text
In-app notifications
Push notifications
Email via Brevo
```

Email via Brevo; no SMS in MVP ([ADR 0016](../adr/0016-email-password-login-phone-otp-later.md)). SMS and WhatsApp come later (TRAI DLT registration). Implemented by [LLD-013](../lld/lld-013-notifications.md).

---

# 25. MVP Realtime

Use realtime selectively for:

```text
booking updates
job status updates
matching status
additional work
important notifications
```

REST remains authoritative.

If WebSocket fails:

```text
REST resync
push/in-app notification
```

should preserve functionality where possible.

---

# 26. MVP File Handling

Support:

```text
Service request photos
Worker profile photo
Verification documents
Dispute evidence
```

Use:

```text
Object Storage
Upload Intent
Private Objects
Signed Access
Metadata
Validation
```

Video should be deferred unless field validation shows it is important.

---

# 27. MVP Location

Use:

```text
PostgreSQL + PostGIS
```

for geographic queries.

Support:

```text
Service location
Worker service area
Distance calculation
Location-based matching
```

Avoid permanent worker GPS history in MVP.

---

# 28. MVP Availability

Worker should be able to:

```text
Enable/disable accepting jobs
Configure working hours
Configure unavailable periods
Define service area
Respect active-job capacity
```

Availability must remain separate from worker account status.

---

# 29. MVP Async Processing

Background processing should handle:

```text
Notifications
Outbox processing
Media processing
Cleanup
Selected matching workloads
Payment reconciliation
```

Initially this can remain within the modular monolith.

---

# 30. MVP Redis Usage

Redis should initially support:

```text
Rate limiting
Caching
Worker presence
Short-lived coordination
Realtime coordination
```

Do not use Redis as authoritative storage.

---

# 31. MVP Database

Primary database:

```text
PostgreSQL
```

with:

```text
PostGIS
Flyway/Liquibase
Proper indexes
Transactions
Constraints
Audit data
```

No second database is required initially.

---

# 32. MVP API

API:

```text
REST
/api/v1
```

with:

```text
OpenAPI
DTOs
Validation
Authentication
Authorization
Idempotency
Cursor pagination
Stable error codes
Request IDs
```

---

# 33. MVP Security

Required before launch:

```text
OTP protection
Authentication
Authorization
RBAC
Ownership checks
Input validation
Rate limiting
Idempotency
Secure file handling
Private object storage
Webhook verification
Secret management
HTTPS
Audit logging
Sensitive-data redaction
```

Security is not a post-MVP feature.

---

# 34. MVP Privacy

Required:

```text
Data classification
PII minimization
Location privacy
Private verification documents
Sensitive admin access controls
PII-safe logs
Retention design
Account deactivation
Deletion/anonymization workflow design
Protected backups
Synthetic development data
```

Exact legal retention and legal-basis decisions require appropriate legal/compliance review.

---

# 35. MVP Observability

Required:

```text
Structured logs
Request IDs
Trace IDs where practical
Application metrics
Database metrics
Redis metrics
Background worker metrics
Payment metrics
Matching metrics
Booking metrics
Error monitoring
Health checks
Audit events
```

---

# 36. MVP Testing

Required automated coverage for:

```text
Authentication
Authorization
Service requests
Matching
Booking concurrency
Job state transitions
Payments
Refunds
Webhooks
Reviews
File authorization
Notifications
Outbox
Redis degradation
Critical E2E marketplace flow
```

The most financially/trust-sensitive paths receive the strongest testing.

---

# 37. MVP Deployment

Initial production architecture:

```text
Load Balancer
       ↓
Spring Boot Application
       ↓
PostgreSQL/PostGIS
Redis
Object Storage

Background Workers
       ↓
Outbox / Async Processing
```

Start with a simple deployment model capable of horizontal application scaling.

---

# 38. MVP Infrastructure Philosophy

The initial production environment should be:

```text
secure
repeatable
observable
backup-enabled
horizontally scalable
cost-conscious
operationally understandable
```

Avoid unnecessary infrastructure complexity.

---

# 39. Explicitly Out of MVP

The following should **not** be built initially unless validation creates a strong requirement:

```text
Microservices
Kubernetes
Kafka
Service Mesh
Multi-region active-active
Database sharding
Complex ML matching
AI agents
Dynamic pricing
Loans
Insurance marketplace
Training marketplace
Equipment marketplace
Worker subscriptions
Advanced accounting platform
Multi-currency
International payments
Complex recommendation engine
Advanced video processing
Large chat platform
Voice calling infrastructure
Portable cross-platform credentials
Blockchain reputation
```

---

# 40. Why These Features Are Deferred

The goal is not to say these features are bad.

They are deferred because they add complexity before the core marketplace has demonstrated sufficient usage.

For example:

```text
Kafka
```

becomes useful when durable event-streaming requirements justify it.

```text
Kubernetes
```

becomes useful when infrastructure scale/operational requirements justify it.

```text
ML matching
```

becomes useful when sufficient marketplace data exists to train/evaluate it.

---

# 41. Release Strategy

The product should be released incrementally.

Recommended conceptual stages:

```text
Phase 0 — Foundation
Phase 1 — Internal Alpha
Phase 2 — Closed Pilot
Phase 3 — Controlled Local Launch
Phase 4 — MVP Expansion
Phase 5 — Growth
Phase 6 — Platform Expansion
```

---

# 42. Phase 0 — Engineering Foundation

Build:

```text
Project structure
Architecture boundaries
Database
Authentication
Authorization
CI/CD
Docker
Migration framework
Observability foundation
Testing infrastructure
Storage abstraction
External-provider abstractions
Error model
API foundation
```

No need to expose the product publicly yet.

---

# 43. Phase 1 — Internal Alpha

Complete the core workflow using controlled test accounts.

Target:

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

Use:

```text
synthetic/test data
payment sandbox
controlled workers
controlled customers
```

---

# 44. Phase 1 Exit Criteria

The complete transaction should work repeatedly without manual database intervention.

Success means:

```text
No broken state transitions
No duplicate booking under concurrency
Payment lifecycle works
Webhook processing works
Notifications recover
Worker/customer roles are enforced
Audit records exist
Critical E2E tests pass
```

---

# 45. Phase 2 — Closed Pilot

Use a small number of real workers and customers.

Focus on discovering:

```text
Can customers describe jobs accurately?
Can workers understand requests?
Do workers accept jobs?
How long does matching take?
Where do customers abandon?
Where do workers abandon?
Are service locations accurate?
How often are jobs cancelled?
How often does additional work occur?
How are payments handled in reality?
```

These are product validation questions.

---

# 46. Pilot Instrumentation

Measure the marketplace funnel:

```text
Request Created
      ↓
Request Submitted
      ↓
Workers Matched
      ↓
Worker Offer Accepted
      ↓
Booking Confirmed
      ↓
Job Started
      ↓
Job Completed
      ↓
Payment Successful
      ↓
Review Submitted
```

Every transition should produce appropriate analytics events.

---

# 47. Phase 3 — Controlled Local Launch

Expand the number of participants within the selected initial geography.

Priorities:

```text
Marketplace liquidity
Matching quality
Worker reliability
Customer trust
Payment reliability
Operational response
```

Avoid expanding geography before understanding the initial market.

---

# 48. Marketplace Liquidity

A marketplace can fail even when the software works.

Two critical problems:

```text
Too few workers
Too few customers
```

Therefore marketplace health should be monitored separately from software health.

---

# 49. Supply-Side Metrics

Measure:

```text
Registered workers
Verified workers
Active workers
Workers accepting jobs
Workers receiving offers
Worker acceptance rate
Worker rejection rate
Worker response time
Completed jobs per worker
Worker cancellation rate
Worker no-show rate
Worker retention
```

These are descriptive measurements, not rankings.

---

# 50. Demand-Side Metrics

Measure:

```text
Registered customers
Active customers
Service requests
Requests per customer
Matching success
Booking conversion
Completion rate
Cancellation rate
Repeat usage
Customer response time
Review rate
```

---

# 51. Core Marketplace Metric

The central marketplace outcome is:

```text
Successful completed jobs
```

not:

```text
downloads
registered accounts
API calls
page views
```

Those are supporting indicators.

---

# 52. Product Funnel

The primary funnel:

```text
Requests
   ↓
Matched Requests
   ↓
Accepted Offers
   ↓
Confirmed Bookings
   ↓
Started Jobs
   ↓
Completed Jobs
   ↓
Successful Payments
   ↓
Reviews
```

Each conversion point should be measured.

---

# 53. Failure Funnel

Also measure where transactions fail:

```text
Request creation failure
No match
Worker rejection
Booking failure
Customer cancellation
Worker cancellation
No-show
Job failure
Payment failure
Refund
Dispute
```

This helps identify actual marketplace problems.

---

# 54. Product Validation Questions

The pilot should answer:

### Customer

```text
Do customers trust unknown workers?
Do customers understand the booking process?
Is matching fast enough?
Are profiles sufficient for choosing a worker?
Are prices understandable?
```

### Worker

```text
Do workers want nearby job discovery?
Is job information sufficient?
Do workers respond quickly?
Do workers prefer accepting or being directly assigned?
What causes rejection?
```

### Operations

```text
How much manual intervention is required?
Which disputes occur?
Which verification failures occur?
Which notifications matter?
Which payment problems occur?
```

---

# 55. Pricing Is Still an Open Decision

The architecture supports multiple models:

```text
Commission
Customer service fee
Worker service fee
Fixed platform fee
Subscription
Hybrid
```

The product should not hard-code a business model into domain logic prematurely.

Fee calculation should be represented as a policy.

---

# 56. Pricing Architecture

Conceptually:

```text
Job
 ↓
Pricing Policy
 ↓
Customer Charge
 ↓
Platform Fee
 ↓
Worker Earning
```

Historical transactions must retain the pricing/fee snapshot used at the time.

---

# 57. Phase 4 — MVP Expansion

Only after the core loop works should the platform expand functionality such as:

```text
Better worker profiles
Improved availability
Better matching
Additional communication channels
Improved dispute handling
More payment capabilities
Worker earnings history
Customer repeat booking
Saved workers
Service history
```

Features should be selected based on observed user problems.

---

# 58. Repeat Customer Workflow

A useful future enhancement:

```text
Previous worker
      ↓
Previous job
      ↓
Request similar service
```

This can reduce discovery friction.

It should still respect:

```text
worker availability
service area
account status
current business rules
```

---

# 59. Future Worker Infrastructure

Once marketplace usage is established, the product can expand toward:

```text
Worker Professional Passport
Work history
Portfolio
Certificates
Business identity
Customer management
Earnings insights
Invoices
Scheduling
Professional tools
```

---

# 60. Worker Business Infrastructure

Long-term direction:

```text
Find Work
   ↓
Get Trusted Work
   ↓
Manage Work
   ↓
Build Reputation
   ↓
Build Professional Identity
   ↓
Run Worker Business
```

The marketplace becomes the foundation rather than the entire product.

---

# 61. Financial/Professional Services

Potential future capabilities:

```text
Worker payouts
Financial records
Insurance integrations
Equipment financing
Training
Certification
Professional services
```

These are explicitly future concepts, not MVP commitments.

---

# 62. Geographic Expansion

Expansion should be treated as a separate scaling phase.

Potential progression:

```text
Initial Howrah area
       ↓
Larger Howrah coverage
       ↓
Selected Kolkata areas
       ↓
Other cities
```

Do not assume that marketplace behavior is identical across locations.

---

# 63. Multi-City Architecture

The architecture should make geography data-driven.

Avoid hard-coding:

```text
if city == Howrah
```

Instead represent:

```text
service areas
geographic boundaries
worker coverage
market configuration
```

This allows later expansion without redesigning the domain.

---

# 64. Category Expansion

Possible future categories:

```text
Carpenter
Painter
AC technician
Appliance technician
Mason
Welder
Other skilled professions
```

But each category should be introduced only after defining:

```text
skill taxonomy
verification requirements
job characteristics
pricing model
risk profile
matching rules
```

---

# 65. Category-Specific Policies

Different professions may require different:

```text
skills
verification
job duration
equipment
pricing
safety requirements
evidence
```

Therefore the domain should support category-specific policies without creating entirely separate systems for every profession.

---

# 66. Matching Evolution

### Version 1

```text
Filter + deterministic ranking
```

### Version 2

```text
Better historical reliability signals
Travel distance/time
Worker preferences
Customer preferences
```

### Version 3

Potentially:

```text
ML-assisted ranking
```

Only if sufficient data and measurable improvement exist.

---

# 67. Matching Must Remain Explainable

Even if advanced ranking is introduced later, the system should retain meaningful signals such as:

```text
Profession match
Skill match
Distance
Availability
Capacity
Verification
Historical reliability
```

This supports:

```text
debugging
admin operations
worker trust
product analysis
```

---

# 68. Reputation Evolution

Initial:

```text
Rating
Reviews
Completed jobs
Basic reliability indicators
```

Later:

```text
Repeat customers
Timeliness
Cancellation context
No-show history
Dispute outcomes
Category-specific history
```

Any future composite reputation model should be explainable and versioned.

---

# 69. Communication Evolution

Initial:

```text
In-app
Push
SMS
```

Future:

```text
WhatsApp
Email
Potentially controlled customer-worker communication
```

A full chat system should only be introduced if real usage demonstrates a need.

---

# 70. Analytics Evolution

Initial:

```text
Operational metrics
Marketplace funnel
Basic product events
```

Later:

```text
Cohort analysis
Worker retention
Customer retention
Geographic liquidity
Category performance
Unit economics
Experimentation
```

Analytics architecture should remain separate from transactional domain logic.

---

# 71. Experimentation

Eventually the product may test:

```text
onboarding flow
matching rules
profile presentation
notification timing
pricing presentation
request flow
```

Experiments must not compromise:

```text
financial correctness
security
privacy
auditability
```

---

# 72. What Should Not Be Optimized Too Early

Avoid optimizing for:

```text
millions of users
millions of WebSockets
billions of events
multi-region active-active
microsecond matching
complex ML ranking
```

before actual workload demonstrates the need.

The architecture should be capable of scaling without requiring those systems on day one.

---

# 73. Engineering Scaling Roadmap

Conceptual progression:

```text
Correctness
   ↓
Modular boundaries
   ↓
Database optimization
   ↓
Query/index optimization
   ↓
Caching
   ↓
Async processing
   ↓
Horizontal app scaling
   ↓
Dedicated worker capacity
   ↓
Read scaling
   ↓
Event infrastructure
   ↓
Selective service extraction
```

---

# 74. Business Scaling Roadmap

Conceptual progression:

```text
Validate customer problem
        ↓
Validate worker problem
        ↓
Validate marketplace transaction
        ↓
Improve liquidity
        ↓
Improve repeat usage
        ↓
Expand geography
        ↓
Expand categories
        ↓
Build worker infrastructure
        ↓
Build broader professional ecosystem
```

---

# 75. Architecture Must Support Growth Without Premature Complexity

The MVP should therefore already have:

```text
Modular monolith
PostgreSQL/PostGIS
Redis
Object storage
Async processing
Transactional outbox capability
REST/OpenAPI
WebSocket/realtime abstraction
Payment abstraction
Notification abstraction
Verification abstraction
Observability
Security
Privacy
Testing
CI/CD
Backups/DR
```

But it does not require:

```text
Microservices
Kafka
Kubernetes
Service mesh
Sharding
Multi-region
```

---

# 76. MVP Definition of Done

The MVP is not complete merely because the UI works.

It should satisfy:

### Product

```text
Customer can request work
Worker can receive and accept work
Booking can be confirmed
Job can be executed
Payment can be processed
Review can be submitted
```

### Engineering

```text
State transitions are protected
Concurrency is handled
Critical commands are idempotent
External failures are recoverable
Background work is retryable
```

### Security

```text
Authentication works
Authorization works
Sensitive resources are protected
Files are protected
Payment webhooks are verified
```

### Operations

```text
Logs exist
Metrics exist
Audit exists
Backups exist
Recovery procedure exists
Admin controls exist
```

### Quality

```text
Critical automated tests pass
E2E flow passes
Migration process is tested
Deployment is repeatable
```

---

# 77. MVP Launch Gate

Before real users are onboarded:

```text
[ ] Critical domain rules finalized
[ ] Database migrations stable
[ ] Authentication tested
[ ] Authorization tested
[ ] Booking concurrency tested
[ ] Payment flow tested
[ ] Refund flow tested
[ ] Webhook idempotency tested
[ ] Matching tested
[ ] File authorization tested
[ ] Notification retry tested
[ ] Outbox recovery tested
[ ] E2E flow tested
[ ] Security review completed
[ ] Privacy review completed
[ ] Backup verified
[ ] Restore tested
[ ] Monitoring active
[ ] Alerts configured
[ ] Admin workflow tested
[ ] Incident runbooks available
[ ] Production deployment tested
```

---

# 78. MVP Success Should Be Measured in Transactions

The strongest evidence that the product is working is not:

```text
10,000 downloads
```

It is evidence such as:

```text
real customers request work
        ↓
real workers accept work
        ↓
jobs actually happen
        ↓
customers complete payment
        ↓
customers return when they need work again
        ↓
workers continue participating
```

Exact success thresholds should be determined through the pilot rather than invented in advance.

---

# 79. Product vs Architecture Decision

A critical distinction:

```text
Architecture asks:
"Can the system support this capability safely?"
```

while:

```text
Product asks:
"Should we build this capability now?"
```

A capability may be architecturally possible but still intentionally deferred.

---

# 80. Feature Introduction Rule

Before adding a significant feature, ask:

```text
What user problem does it solve?
What evidence do we have?
Which workflow does it improve?
What operational complexity does it add?
What security/privacy implications exist?
What data does it require?
Can it be measured?
Can it be removed safely?
```

---

# 81. MVP Anti-Pattern

Do not turn the MVP into:

```text
Customer App
+ Worker App
+ Admin Panel
+ Chat
+ Wallet
+ Loans
+ Insurance
+ Training
+ AI
+ Analytics Platform
+ Accounting
+ Multi-city
+ Microservices
+ Kubernetes
```

before proving:

```text
Customer ↔ Worker ↔ Job
```

---

# 82. Long-Term Product Architecture

The eventual platform may look like:

```text
┌─────────────────────┐
                    │ Customer Marketplace │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Skilled Worker Core │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
      Marketplace          Professional         Financial
       Services              Identity            Services
          │                    │                    │
          ▼                    ▼                    ▼
       Jobs                 Passport            Earnings
       Matching             Reputation           Payouts
       Booking              Portfolio            Future Finance
       Payments             Verification
```

The MVP implements only the necessary foundation of this vision.

---

# 83. Release Sequence Summary

```text
PHASE 0
Engineering Foundation
        ↓
PHASE 1
Internal Alpha
        ↓
PHASE 2
Closed Real-World Pilot
        ↓
PHASE 3
Controlled Local Launch
        ↓
PHASE 4
MVP Expansion
        ↓
PHASE 5
Growth + Geographic Expansion
        ↓
PHASE 6
Worker Professional Infrastructure
        ↓
PHASE 7
Broader Platform Ecosystem
```

Each phase should be entered based on evidence, not simply because the calendar says it is time.

---

# 84. Final MVP Architecture Boundary

The MVP boundary is:

```text
Customer
   │
   ├── Authentication
   ├── Profile
   ├── Address
   ├── Service Request
   ├── Matching
   ├── Booking
   ├── Job
   ├── Payment
   └── Review

Worker
   │
   ├── Authentication
   ├── Profile
   ├── Profession
   ├── Skills
   ├── Verification
   ├── Availability
   ├── Matching
   ├── Booking
   ├── Job
   └── Earnings

Admin
   │
   ├── Worker Verification
   ├── Marketplace Operations
   ├── Disputes
   ├── Reviews
   ├── Payments
   └── Audit

Platform
   │
   ├── PostgreSQL/PostGIS
   ├── Redis
   ├── Object Storage
   ├── Async/Outbox
   ├── Notifications
   ├── Realtime
   ├── Observability
   ├── Security
   └── Recovery
```

---

# 85. Final Principles

The MVP should follow these rules:

1. Build the marketplace transaction first.
2. Keep the initial geography intentionally narrow.
3. Start with electricians and plumbers.
4. Keep matching deterministic and explainable.
5. Treat worker verification as a trust capability.
6. Keep request, booking, job, and payment separate.
7. Preserve financial history from the beginning.
8. Preserve worker professional history from the beginning.
9. Build admin/operations into the MVP.
10. Build security and privacy into the MVP.
11. Build observability before production launch.
12. Build recovery procedures before trusting production.
13. Measure completed jobs, not vanity metrics.
14. Validate both customer and worker sides.
15. Treat marketplace liquidity as a first-class problem.
16. Keep pricing configurable through policies.
17. Do not hard-code future business decisions.
18. Defer advanced features until evidence justifies them.
19. Scale infrastructure progressively.
20. Keep the modular monolith until extraction has a concrete reason.
21. Do not build microservices merely because the product may become large.
22. Do not build AI before the underlying workflow and data are mature.
23. Do not confuse architectural possibility with product priority.
24. Every major feature should have a measurable reason to exist.
25. The MVP exists to prove the marketplace loop safely in the real world.

---

# End of Document
