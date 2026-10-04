# System Architecture & Modular Monolith Design

**Project:** Karigar Marketplace
**Initial Market:** Howrah/Kolkata
**Architecture:** Modular Monolith
**Backend:** Java + Spring Boot
**Database:** PostgreSQL + PostGIS
**Cache / Temporary State:** Redis
**Object Storage:** S3-compatible storage
**API Style:** REST
**Status:** Draft for Architecture Review

---

# 1. Purpose

This document defines how the system will operate at runtime.

It answers:

* How should the Java application be structured?
* How should modules communicate?
* Where should business logic live?
* What belongs in PostgreSQL?
* What belongs in Redis?
* How should asynchronous processing work?
* How should external providers be integrated?
* How should concurrency be handled?
* How can the system scale without immediately becoming microservices?

The core architectural decision is:

> **Start with a modular monolith, but design clear business boundaries so modules can be extracted later if real scale or organizational requirements justify it.**

---

# 2. Architecture Overview

The initial architecture:

```text
                         CLIENTS
                ┌──────────┼──────────┐
                │          │          │
             Customer    Worker     Admin
                │          │          │
                └──────────┼──────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Load Balancer│
                    └──────┬──────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │     Spring Boot App     │
              │                         │
              │    MODULAR MONOLITH     │
              │                         │
              │ ┌─────────────────────┐ │
              │ │ Identity            │ │
              │ │ Customer            │ │
              │ │ Worker              │ │
              │ │ Catalog             │ │
              │ │ Service Request     │ │
              │ │ Matching            │ │
              │ │ Booking             │ │
              │ │ Job                 │ │
              │ │ Payment             │ │
              │ │ Review              │ │
              │ │ Dispute             │ │
              │ │ Notification        │ │
              │ │ Admin               │ │
              │ └─────────────────────┘ │
              └───────────┬─────────────┘
                          │
            ┌─────────────┼─────────────┐
            │             │             │
            ▼             ▼             ▼
       PostgreSQL       Redis      Object Storage
       + PostGIS
            │
            ▼
       External Providers
       ├── Payment
       ├── SMS
       ├── Push
       ├── Maps
       └── Identity Verification
```

---

# 3. Why Modular Monolith?

We deliberately do **not** start with:

```text
Worker Service
Booking Service
Payment Service
Matching Service
Notification Service
```

as independent deployments.

That would introduce:

* service-to-service networking
* distributed transactions
* service discovery
* deployment complexity
* independent monitoring
* distributed debugging
* message brokers
* additional infrastructure
* data ownership problems

before the product has demonstrated the need.

Instead:

```text
                    ONE APPLICATION
                         │
              ┌──────────┴──────────┐
              │                     │
           Business              Business
           Modules               Modules
              │                     │
              └──────────┬──────────┘
                         │
                  One deployment
```

The modules remain logically separated.

---

# 4. What Makes It "Modular"?

A modular monolith is **not simply a large application with folders**.

Each module should have:

* clear responsibility
* clear public interfaces
* controlled dependencies
* owned business rules
* owned application use cases
* controlled access to persistence

For example:

```text
booking
   ↓
can interact with
   ↓
worker public contract
```

but should not directly manipulate:

```text
worker.internal.SomePrivateEntity
```

---

# 5. Initial Business Modules

The system will initially contain:

```text
identity
customer
worker
catalog
service-request
matching
booking
job
payment
review
dispute
notification
admin
```

Conceptually:

```text
                    ┌────────────┐
                    │  Identity  │
                    └─────┬──────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
         Customer                   Worker
              │                       │
              └──────────┬────────────┘
                         ▼
                  Service Request
                         │
                         ▼
                      Matching
                         │
                         ▼
                      Booking
                         │
                         ▼
                         Job
                  ┌──────┼──────┐
                  ▼      ▼      ▼
             Payment   Review  Dispute

              Notification supports all modules
```

---

# 6. Module Responsibility

## Identity

Responsible for:

* user identity
* phone authentication
* OTP
* access tokens
* account lifecycle
* authentication authorization foundation

Not responsible for:

* worker business rules
* customer addresses
* bookings

---

## Customer

Responsible for:

* customer profile
* saved addresses
* customer preferences

---

## Worker

Responsible for:

* worker profile
* profession
* skills
* verification
* availability
* service areas
* worker lifecycle

---

## Catalog

Responsible for:

* professions
* skills
* service definitions
* platform-supported categories

---

## Service Request

Responsible for:

* creating service requests
* request lifecycle
* request media
* requested location
* preferred time
* urgency

---

## Matching

Responsible for:

* candidate discovery
* geographic filtering
* skill filtering
* availability filtering
* worker ranking
* match lifecycle

---

## Booking

Responsible for:

* customer-worker commitment
* scheduling
* confirmation
* cancellation
* rescheduling

---

## Job

Responsible for:

* actual service execution
* en route
* arrival
* work start
* work completion
* no-show
* additional work

---

## Payment

Responsible for:

* payment initiation
* provider integration
* payment status
* refunds
* payment reconciliation
* idempotency

---

## Review

Responsible for:

* review eligibility
* ratings
* comments
* review lifecycle
* reputation inputs

---

## Dispute

Responsible for:

* dispute creation
* evidence
* investigation
* resolution
* dispute history

---

## Notification

Responsible for:

* in-app notifications
* push
* SMS
* email
* WhatsApp where applicable
* delivery tracking

---

## Admin

Responsible for:

* moderation
* worker verification operations
* suspension
* dispute administration
* operational dashboards
* administrative actions

---

# 7. Internal Module Structure

Each business module should conceptually follow:

```text
module/
├── api/
├── application/
├── domain/
└── infrastructure/
```

Example:

```text
worker/
├── api/
│   ├── WorkerController
│   ├── WorkerRequest
│   └── WorkerResponse
│
├── application/
│   ├── CreateWorker
│   ├── UpdateWorkerProfile
│   ├── UpdateAvailability
│   └── VerifyWorker
│
├── domain/
│   ├── Worker
│   ├── WorkerSkill
│   ├── WorkerRepository
│   └── WorkerStatus
│
└── infrastructure/
    ├── persistence/
    └── verification/
```

This structure will be formalized further in the dedicated project-directory document.

---

# 8. API Layer

The API layer handles external HTTP communication.

Responsibilities:

```text
HTTP request
     ↓
authentication
     ↓
validation
     ↓
application use case
     ↓
response
```

Controllers should be thin.

Bad:

```java
@PostMapping
public ResponseEntity<?> create(...) {

    // 200 lines of business logic

}
```

Good:

```text
Controller
    ↓
Use Case
    ↓
Domain
    ↓
Repository
```

---

# 9. Application Layer

The application layer represents use cases.

Examples:

```text
CreateServiceRequest
AcceptMatch
ConfirmBooking
StartJob
CompleteJob
InitiatePayment
SubmitReview
OpenDispute
```

A use case orchestrates the operation.

Example:

```text
ConfirmBookingUseCase

1. Load request
2. Validate request state
3. Validate worker
4. Verify availability
5. Atomically create booking
6. Update request
7. Publish BookingConfirmed
```

The use case should not contain HTTP-specific logic.

---

# 10. Domain Layer

The domain layer contains business rules.

Examples:

```text
Worker
Booking
Job
Payment
ServiceRequest
```

and concepts such as:

```text
Money
GeoPoint
TimeRange
```

The domain should not know:

```text
Spring MVC
HTTP
Redis
Stripe
PostgreSQL
Kafka
```

This keeps business logic portable and testable.

---

# 11. Infrastructure Layer

Infrastructure implements technical details.

Examples:

```text
PostgreSQL
Redis
S3
Stripe
Paystack
SMS
Push
Maps
```

The domain/application layer should depend on abstractions where appropriate.

Example:

```text
PaymentGateway
```

with implementations:

```text
StripePaymentGateway
PaystackPaymentGateway
```

---

# 12. Dependency Direction

The desired dependency direction:

```text
API
 │
 ▼
Application
 │
 ▼
Domain
 ▲
 │
Infrastructure
```

Infrastructure implements interfaces required by the application/domain.

Avoid:

```text
Domain
  ↓
Stripe SDK
```

or:

```text
Domain
  ↓
Spring Data JPA
```

---

# 13. Repository Pattern

The domain/application side can define:

```text
WorkerRepository
BookingRepository
PaymentRepository
```

Infrastructure provides implementations using Spring Data/JPA/native SQL.

For example:

```text
domain
  WorkerRepository
       ▲
       │
infrastructure
  JpaWorkerRepository
```

This makes business logic less dependent on persistence technology.

---

# 14. JPA vs Native SQL

JPA/Hibernate is useful for normal relational operations.

However, this project has important PostGIS requirements.

Therefore:

```text
Simple CRUD
    ↓
JPA

Complex geospatial query
    ↓
Native SQL / PostGIS
```

We should not force PostGIS queries into awkward ORM abstractions simply for the sake of using JPA everywhere.

---

# 15. PostgreSQL

PostgreSQL is the authoritative transactional database.

It stores:

```text
Users
Customers
Workers
Skills
Requests
Matches
Bookings
Jobs
Payments
Reviews
Disputes
Notifications
Audit records
```

PostGIS provides geographic functionality.

---

# 16. Redis

Redis is a supporting system.

Use it for:

```text
OTP
Rate limiting
Short-lived cache
Temporary locks
Session/token-related temporary state
Temporary matching coordination
Worker availability signals
```

Do not use Redis as permanent storage for:

```text
Bookings
Payments
Jobs
Reviews
Disputes
```

---

# 17. Redis Example — OTP

Authentication flow:

```text
User
 │
 │ request OTP
 ▼
Spring Boot
 │
 ├── generate OTP
 │
 ├── Redis
 │     OTP + expiry
 │
 └── SMS Provider
```

Example:

```text
otp:user:uuid
TTL: 5 minutes
```

After successful verification:

```text
delete OTP
```

---

# 18. Redis Example — Rate Limiting

Potential limits:

```text
OTP requests
Login attempts
Service request creation
Worker match responses
Payment initiation
```

Redis can provide distributed rate limiting when multiple application instances are running.

---

# 19. Redis Locks

Redis can be useful for short-lived coordination.

For example:

```text
booking:request:{requestId}
```

However:

> Redis locking should not be the only protection for critical transactional invariants.

The database must still enforce important uniqueness and consistency rules.

---

# 20. Object Storage

Images and videos should be stored outside PostgreSQL.

Architecture:

```text
Client
  │
  ▼
Spring Boot
  │
  ▼
Object Storage
  │
  └── image/video

PostgreSQL
  │
  └── storage metadata/key
```

Potential storage:

```text
AWS S3
Cloudflare R2
MinIO
other S3-compatible provider
```

The application should abstract storage behind:

```text
StorageGateway
```

---

# 21. External Payment Providers

The payment module should use an abstraction:

```text
PaymentGateway
```

Possible implementations:

```text
StripePaymentGateway
PaystackPaymentGateway
```

The rest of the application should not care which provider is being used.

Flow:

```text
Payment Module
      │
      ▼
PaymentGateway
      │
 ┌────┴─────┐
 ▼          ▼
Stripe    Paystack
```

---

# 22. External Notification Providers

Similarly:

```text
SmsGateway
PushGateway
EmailGateway
WhatsAppGateway
```

can be abstracted.

This prevents provider-specific code from spreading through the business modules.

---

# 23. Maps / Geolocation Provider

The system may eventually use external maps services for:

* address search
* geocoding
* reverse geocoding
* route estimation
* distance estimation

However:

> **PostGIS should remain responsible for our internal geographic matching queries.**

A maps provider should not become the database for worker location/matching.

---

# 24. Authentication Architecture

Initial approach:

```text
Phone
  ↓
OTP
  ↓
Verify OTP
  ↓
Issue access token
  ↓
Spring Security
```

Requests:

```text
Authorization: Bearer <token>
```

The token identifies the authenticated user.

Authorization then determines:

```text
Customer?
Worker?
Admin?
```

and whether they can access a resource.

---

# 25. Authentication vs Authorization

These are separate.

Authentication:

> Who are you?

Authorization:

> What are you allowed to do?

Example:

```text
Worker A
```

may be authenticated but must not be allowed to:

```text
view Worker B's private information
```

Similarly, a customer should not be allowed to:

```text
complete another customer's job
```

---

# 26. Resource Authorization

Every resource should be checked for ownership/permission.

Example:

```text
GET /service-requests/{id}
```

The backend should verify:

```text
Is this request accessible to the authenticated user?
```

Not merely:

```text
Does this request ID exist?
```

This prevents ID-based data leakage.

---

# 27. Service Request Flow

Normal request:

```text
Customer
   │
   ▼
POST /service-requests
   │
   ▼
API
   │
   ▼
CreateServiceRequest
   │
   ├── validate
   ├── create request
   └── commit transaction
   │
   ▼
ServiceRequestSubmitted
   │
   ▼
Matching
```

---

# 28. Matching Flow

```text
ServiceRequestSubmitted
          │
          ▼
      Matching
          │
          ├── profession
          ├── skills
          ├── geography
          ├── service area
          ├── availability
          └── verification
          │
          ▼
      Candidates
          │
          ▼
       Ranking
          │
          ▼
    Worker Matches
```

---

# 29. Matching Architecture

The first version should be simple and explainable.

Potential ranking factors:

```text
Distance
Skill compatibility
Availability
Verification
Reliability
Customer preferences
```

Example:

```text
Worker A
distance = 1.2 km
skill match = strong
available = yes
verified = yes

Worker B
distance = 0.8 km
skill match = partial
available = yes
verified = yes
```

The exact scoring algorithm is a product decision.

We should not start with machine learning.

---

# 30. Why Not AI Matching Initially?

We need actual marketplace data before sophisticated models become useful.

Initially we need to learn:

```text
Which workers accept?
Which workers reject?
Why do they reject?
How far are workers willing to travel?
Which skills correlate with successful completion?
Which customers select which workers?
Who actually completes jobs?
```

These become training/optimization data later.

First build a reliable transaction system.

---

# 31. Booking Concurrency

Booking is one of the most concurrency-sensitive areas.

Potential race:

```text
Worker A ──┐
           ├── accept request
Worker B ──┘
```

Both requests arrive at nearly the same time.

The database transaction must ensure:

```text
One request
     ↓
One confirmed booking
     ↓
One worker
```

Possible techniques:

```text
Database locking
Optimistic locking
Unique constraints
Serializable/appropriate isolation
```

We will benchmark and choose the simplest correct approach.

---

# 32. Payment Idempotency

Payment APIs must tolerate retries.

Example:

```text
Client
  │
  │ initiate payment
  ▼
Backend
  │
  ▼
Payment Provider
  │
  X timeout
```

Client retries.

Without idempotency:

```text
Payment 1
Payment 2
```

could accidentally be created.

With:

```text
Idempotency-Key: abc123
```

the backend can safely return the original operation/result.

---

# 33. Webhook Architecture

Payment providers may send:

```text
payment.success
payment.failed
refund.completed
```

The webhook flow:

```text
Payment Provider
       │
       ▼
Webhook Controller
       │
       ▼
Validate signature
       │
       ▼
Idempotency check
       │
       ▼
Payment Application Service
       │
       ▼
Update payment
       │
       ▼
Publish event
```

Webhook processing must be idempotent.

---

# 34. Asynchronous Processing

Not everything needs to happen during the HTTP request.

Examples:

```text
Send SMS
Send push notification
Send email
Generate thumbnails
Process media
Run non-critical matching work
Update analytics
```

can be asynchronous.

Initial architecture:

```text
Spring Application Events
```

with reliable persistence/outbox introduced where necessary.

---

# 35. Domain Events vs Message Broker

Having:

```text
BookingConfirmed
```

does not mean we immediately need Kafka.

Initially:

```text
Booking
  │
  ▼
Application Event
  │
  ├── Notification
  └── Other internal handlers
```

Later:

```text
Booking
  │
  ▼
Outbox
  │
  ▼
Message Broker
```

when reliability and scale justify it.

---

# 36. Transactional Outbox

For events that must not be lost:

```text
Database transaction
       │
       ├── business update
       │
       └── outbox event
```

Both are committed together.

Then:

```text
Outbox Worker
     │
     ▼
Message Broker / Consumer
```

This avoids:

```text
Database committed
BUT
event lost
```

---

# 37. Initial Async Architecture

For MVP:

```text
                    Spring Boot
                        │
              ┌─────────┴─────────┐
              │                   │
        Synchronous          Async events
              │                   │
              ▼                   ▼
        PostgreSQL          Application Events
                                  │
                         ┌────────┼────────┐
                         ▼        ▼        ▼
                    Notification Analytics ...
```

Later:

```text
PostgreSQL
    │
    ▼
Outbox
    │
    ▼
Kafka
    │
 ┌──┼──────────┐
 ▼  ▼          ▼
Notification Matching Analytics
```

---

# 38. Notification Flow

Example:

```text
Worker accepts match
       │
       ▼
Booking confirmed
       │
       ▼
BookingConfirmed
       │
       ▼
Notification module
       │
       ├── Push
       ├── SMS
       └── In-app
```

The booking transaction should not fail simply because:

```text
SMS provider is temporarily unavailable.
```

---

# 39. Error Handling

All APIs should return a consistent error structure.

Conceptually:

```json
{
  "code": "BOOKING_ALREADY_CONFIRMED",
  "message": "This service request already has a confirmed booking.",
  "details": {},
  "traceId": "..."
}
```

Errors should be meaningful but should not leak sensitive internal information.

---

# 40. Validation

Validation occurs at multiple levels.

### API validation

Example:

```text
description required
location required
preferred time valid
```

### Application validation

Example:

```text
customer owns request
worker is eligible
```

### Domain validation

Example:

```text
cannot complete a job before it has started
```

### Database constraints

Example:

```text
unique
not null
foreign key
check
```

These layers complement each other.

---

# 41. Observability

Production systems need visibility.

Initial observability should include:

```text
Structured logs
Metrics
Request IDs
Error tracking
Health checks
Database metrics
Redis metrics
External provider metrics
```

---

# 42. Request Correlation

Every incoming request should have a correlation/request ID.

Example:

```text
X-Request-ID: 7b2c...
```

That ID should appear in:

```text
HTTP logs
application logs
external calls
important async processing
```

This makes debugging much easier.

---

# 43. Logging

Use structured logs.

Instead of:

```text
Worker failed
```

prefer:

```json
{
  "event": "worker_match_failed",
  "workerId": "...",
  "requestId": "...",
  "reason": "OUTSIDE_SERVICE_AREA",
  "traceId": "..."
}
```

Never log:

```text
OTP
password
payment secrets
access tokens
sensitive personal data
```

---

# 44. Metrics

Initial metrics should include:

### Marketplace

```text
service_requests_created
matches_created
match_acceptance_rate
bookings_confirmed
jobs_completed
cancellations
no_shows
```

### Performance

```text
http_request_latency
database_latency
redis_latency
external_provider_latency
```

### Payments

```text
payments_success
payments_failed
refunds
webhook_failures
```

---

# 45. Health Checks

Spring Boot Actuator can provide:

```text
liveness
readiness
health
metrics
```

Readiness should consider dependencies required for serving traffic.

---

# 46. Security Architecture

Minimum security requirements:

```text
HTTPS
Spring Security
OTP protection
Rate limiting
Resource authorization
Input validation
Secure file uploads
Webhook signature validation
Secrets outside Git
Audit logging
```

---

# 47. File Upload Security

User-uploaded files must be treated as untrusted.

Validate:

```text
file type
file size
content type
extension
ownership
```

Potentially scan files for malware before making them accessible.

Never trust:

```text
filename
Content-Type header
client-provided metadata
```

alone.

---

# 48. Configuration Management

Environment-specific configuration:

```text
application.yml
application-local.yml
application-dev.yml
application-prod.yml
```

Secrets should come from:

```text
environment variables
secret manager
deployment platform secrets
```

Never:

```text
commit API keys to Git
```

---

# 49. Local Development

Recommended local environment:

```text
Docker Compose
   │
   ├── PostgreSQL + PostGIS
   ├── Redis
   └── MinIO
```

Spring Boot can run:

```text
directly from IDE
```

or inside Docker.

This makes development easier without requiring a Kubernetes cluster.

---

# 50. Testing Architecture

The testing strategy should include:

```text
Unit Tests
Integration Tests
Repository Tests
API Tests
Concurrency Tests
End-to-End Tests
```

Important infrastructure:

```text
Testcontainers
```

for realistic PostgreSQL/PostGIS/Redis testing.

---

# 51. Example Integration Test

A matching integration test could create:

```text
Worker A
location = Shibpur
skill = plumbing
available = true

Worker B
location = far away
skill = electrician
available = true

Service Request
location = Shibpur
profession = plumber
```

Then verify:

```text
Worker A → candidate
Worker B → not candidate
```

This tests actual database/geospatial behavior instead of mocking everything.

---

# 52. Deployment Architecture — Initial

The first production deployment can be:

```text
                    Internet
                       │
                       ▼
                 Load Balancer
                       │
                       ▼
                 Spring Boot
                    Instance
                       │
             ┌─────────┼─────────┐
             ▼         ▼         ▼
        PostgreSQL   Redis    Object Storage
```

For early MVP traffic, even:

```text
Spring Boot
     │
     ├── PostgreSQL
     └── Redis
```

can be sufficient.

---

# 53. Horizontal Scaling

When one application instance becomes insufficient:

```text
                  Load Balancer
                  /     |     \
                 /      |      \
              App 1   App 2   App 3
                 \      |      /
                  PostgreSQL
                       │
                      Redis
```

The application should remain stateless enough that instances can be added horizontally.

---

# 54. Stateless Application Principle

Do not store important session state only inside one JVM instance.

Bad:

```text
App Instance 1
   └── user session
```

while:

```text
Load Balancer
   ↓
App Instance 2
```

cannot understand it.

Use:

```text
database
Redis
signed tokens
```

for appropriate shared state.

---

# 55. Database Scaling Path

Initial:

```text
Application
     │
     ▼
PostgreSQL Primary
```

Later:

```text
Application
     │
 ┌───┴────────────┐
 ▼                ▼
Primary       Read Replica
```

Read-heavy operations can eventually use replicas.

Examples:

```text
Worker discovery
Catalog
Public worker profiles
Analytics
```

while transactional writes remain on primary.

---

# 56. Caching Strategy

Cache only data where the performance benefit is meaningful.

Potential candidates:

```text
Profession catalog
Skill catalog
Frequently accessed worker profile summaries
Configuration
```

Do not blindly cache:

```text
Booking state
Payment state
Critical job state
```

without a strong consistency strategy.

---

# 57. Search Evolution

Initial:

```text
PostgreSQL
+
PostGIS
```

is sufficient.

Later, if discovery becomes much more complex:

```text
PostgreSQL
      │
      ▼
Search Index
```

could be introduced.

Possible technology:

```text
OpenSearch / Elasticsearch
```

But not initially.

---

# 58. Microservice Extraction Strategy

The architecture should allow future extraction.

Potential candidates:

```text
Notification
Matching
Payment
Search
```

For example:

```text
CURRENT

Spring Boot
├── Matching
├── Booking
└── Notification


FUTURE

Main Application
├── Booking
└── Worker

Matching Service
Notification Service
```

Extraction should happen only when there is a concrete reason.

---

# 59. What Should Probably NOT Be Extracted Early

Core transactional modules should remain together initially:

```text
Service Request
Booking
Job
```

These domains interact heavily and benefit from local transactions.

Separating them too early creates distributed transaction complexity.

---

# 60. Scaling Stages

### Stage 1 — MVP

```text
1 Spring Boot application
1 PostgreSQL
1 Redis
1 Object Storage
```

---

### Stage 2 — Growing traffic

```text
Multiple Spring Boot instances
+
Load Balancer
+
PostgreSQL
+
Redis
```

---

### Stage 3 — Higher workload

```text
Multiple app instances
+
Background workers
+
Read replicas
+
Transactional outbox
```

---

### Stage 4 — Significant scale

```text
App
 │
 ├── Matching Service
 ├── Notification Service
 ├── Payment Service
 └── Search Service

+
Message Broker
```

Only modules with clear scaling/ownership reasons should be extracted.

---

# 61. Technology Decisions

Initial direction:

| Concern              | Technology                     |
| -------------------- | ------------------------------ |
| Language             | Java                           |
| Backend              | Spring Boot                    |
| API                  | REST                           |
| Database             | PostgreSQL                     |
| Geospatial           | PostGIS                        |
| Cache                | Redis                          |
| ORM                  | JPA/Hibernate                  |
| Complex SQL          | PostgreSQL/Native SQL          |
| Migration            | Flyway                         |
| Object storage       | S3-compatible                  |
| Authentication       | Spring Security                |
| Testing              | JUnit + Testcontainers         |
| Local infrastructure | Docker Compose                 |
| Monitoring           | Spring Boot Actuator + metrics |
| Async                | Spring events initially        |
| Reliable async       | Outbox later                   |
| Message broker       | Later if justified             |

---

# 62. Technologies We Are Deliberately Not Starting With

```text
Kubernetes
Kafka
Elasticsearch/OpenSearch
MongoDB
Cassandra
GraphQL
Service Mesh
CQRS everywhere
Event Sourcing
Multiple databases
Microservices
```

This is not because these technologies are bad.

The principle is:

> **Infrastructure complexity should solve a demonstrated problem.**

---

# 63. End-to-End Example

Consider:

> Customer needs an electrician today at 6 PM.

Flow:

```text
Customer
   │
   ▼
POST /service-requests
   │
   ▼
Service Request Module
   │
   ▼
PostgreSQL
   │
   ▼
ServiceRequestSubmitted
   │
   ▼
Matching Module
   │
   ├── PostGIS
   ├── Skill filtering
   ├── Availability
   └── Verification
   │
   ▼
Worker Matches
   │
   ▼
Notification Module
   │
   ▼
Worker
   │
   ▼
Accept
   │
   ▼
Booking Module
   │
   ▼
Booking Confirmed
   │
   ├── Notification
   └── Job created
   │
   ▼
Worker
   │
   ▼
EN_ROUTE
   │
   ▼
ARRIVED
   │
   ▼
WORK_STARTED
   │
   ▼
WORK_COMPLETED
   │
   ▼
Payment
   │
   ▼
Payment SUCCESS
   │
   ▼
Review
```

This is the central transaction that the architecture must make reliable.

---

# 64. Architectural Invariants

The following rules should remain true throughout development.

### 1.

Business modules have clear ownership.

### 2.

Controllers do not contain business logic.

### 3.

PostgreSQL is the source of truth for permanent business state.

### 4.

Redis is not the permanent source of truth.

### 5.

External providers are isolated behind interfaces.

### 6.

Payment webhooks are idempotent.

### 7.

Critical state transitions are transactionally protected.

### 8.

Notifications do not normally block core transactions.

### 9.

Geospatial matching is performed using PostGIS.

### 10.

Application instances should be horizontally scalable.

### 11.

Async processing should be introduced where it solves a real problem.

### 12.

Microservices should be introduced only when justified by scale, ownership, or operational requirements.

---

# 65. Architecture Summary

The final initial architecture is:

```text
                           CLIENTS
                              │
                              ▼
                       ┌─────────────┐
                       │ Load Balancer│
                       └──────┬──────┘
                              │
             ┌─────────────────────────────────┐
             │          SPRING BOOT             │
             │                                 │
             │       MODULAR MONOLITH          │
             │                                 │
             │ Identity       Customer         │
             │ Worker         Catalog          │
             │ ServiceRequest Matching         │
             │ Booking        Job              │
             │ Payment        Review           │
             │ Dispute        Notification     │
             │ Admin                           │
             └───────────────┬─────────────────┘
                             │
          ┌──────────────────┼───────────────────┐
          │                  │                   │
          ▼                  ▼                   ▼
 PostgreSQL + PostGIS      Redis          Object Storage
          │
          │
          ├──── Payment Provider
          ├──── SMS Provider
          ├──── Push Provider
          ├──── Email Provider
          └──── Maps/Geocoding Provider
```

---

# 66. Final Architectural Direction

The project will begin as a **production-oriented modular monolith**, not a toy CRUD application and not an unnecessarily distributed microservice system.

The important property is:

```text
Simple deployment
        +
Strong domain boundaries
        +
Clear module ownership
        +
Reliable transactions
        +
PostGIS geospatial capability
        +
Redis for supporting workloads
        +
Asynchronous processing where useful
        =
Scalable foundation
```

The architecture should make the first version easy enough to build while ensuring that future growth does not require throwing away the entire codebase.

---

# 67. Next Architectural Step

With the domain and database model now defined, the next document should formalize the **actual Java/Spring Boot project directory and package structure**.

It will define exactly where things such as:

```text
WorkerController
CreateWorkerUseCase
Worker
WorkerRepository
JpaWorkerRepository
WorkerJpaEntity
WorkerMapper
```

belong, how modules communicate, how shared infrastructure is organized, and what dependency rules developers must follow.

That document will become the **actual project skeleton** we can use when implementation eventually starts.
