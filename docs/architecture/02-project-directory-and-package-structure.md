# Production Project Directory & Package Structure

**Project:** Karigar Marketplace
**Initial Market:** Howrah / Kolkata
**Architecture:** Modular Monolith
**Backend:** Java + Spring Boot
**Database:** PostgreSQL + PostGIS
**Cache:** Redis
**API:** REST / JSON
**Status:** Architecture / Engineering Design

---

# 1. Purpose

This document defines the physical structure of the Java/Spring Boot codebase.

The goal is to create a project that is:

* understandable by a new developer
* easy to test
* maintainable as the system grows
* strongly aligned with business domains
* resistant to accidental coupling
* capable of evolving into microservices later
* production-oriented without unnecessary complexity

The most important architectural decision is:

> **Organize the code primarily by business module, not by technical layer.**

We will therefore avoid a project like:

```text
controller/
service/
repository/
entity/
dto/
```

Instead, we will use:

```text
worker/
customer/
booking/
payment/
matching/
...
```

Each module owns its own controller/API, application logic, domain model and infrastructure.

---

# 2. Core Directory Design Decision

There are two common ways to structure Spring applications.

## Approach A — Package by technical layer

```text
controller/
service/
repository/
entity/
dto/
config/
```

This looks simple initially.

But as the application grows:

```text
service/
    UserService
    WorkerService
    BookingService
    PaymentService
    ReviewService
    MatchingService
    NotificationService
    ...
```

Eventually developers have to understand the entire application to know which classes belong together.

This creates accidental coupling.

---

# 3. Recommended Approach — Package by Business Module

Our project will use:

```text
identity/
customer/
worker/
catalog/
servicerequest/
matching/
booking/
job/
payment/
review/
dispute/
notification/
admin/
```

Each module owns its implementation.

For example:

```text
worker/
├── api/
├── application/
├── domain/
└── infrastructure/
```

And:

```text
booking/
├── api/
├── application/
├── domain/
└── infrastructure/
```

This gives us a **modular monolith** rather than a large collection of unrelated Spring packages.

---

# 4. High-Level Project Structure

The recommended repository structure is:

```text
karigar-marketplace/
│
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/
│   │   │       └── <organization>/
│   │   │           └── karigar/
│   │   │               │
│   │   │               ├── KarigarApplication.java
│   │   │               │
│   │   │               ├── identity/
│   │   │               ├── customer/
│   │   │               ├── worker/
│   │   │               ├── catalog/
│   │   │               ├── servicerequest/
│   │   │               ├── matching/
│   │   │               ├── booking/
│   │   │               ├── job/
│   │   │               ├── payment/
│   │   │               ├── review/
│   │   │               ├── dispute/
│   │   │               ├── notification/
│   │   │               ├── admin/
│   │   │               │
│   │   │               ├── shared/
│   │   │               │
│   │   │               └── config/
│   │   │
│   │   └── resources/
│   │       ├── application.yml
│   │       ├── application-local.yml
│   │       ├── application-dev.yml
│   │       ├── application-prod.yml
│   │       │
│   │       └── db/
│   │           └── migration/
│   │
│   └── test/
│       ├── java/
│       │   └── com/
│       │       └── <organization>/
│       │           └── karigar/
│       │
│       └── resources/
│
├── docker/
│   ├── postgres/
│   └── redis/
│
├── docs/
│
├── .github/
│   └── workflows/
│
├── docker-compose.yml
├── Dockerfile
├── pom.xml
├── README.md
├── .gitignore
└── .dockerignore
```

If Gradle is selected later, `pom.xml` becomes `build.gradle` / `settings.gradle`.

---

# 5. Root Package

The root package should represent the organization's namespace.

Example:

```text
com.karigar
```

or, if the future company/project has a real domain:

```text
com.company.karigar
```

The exact organization name is an open decision.

The Spring Boot entry point:

```text
KarigarApplication.java
```

should live at the root:

```text
com.karigar
```

This allows Spring Boot component scanning to naturally discover all modules.

---

# 6. Main Application Class

Example:

```text
com.karigar.KarigarApplication
```

Conceptually:

```java
@SpringBootApplication
public class KarigarApplication {

    public static void main(String[] args) {
        SpringApplication.run(KarigarApplication.class, args);
    }
}
```

This class should remain extremely small.

It should **not** contain:

* business logic
* database initialization
* matching logic
* payment logic
* worker logic
* application workflows

Its job is to bootstrap the application.

---

# 7. Business Modules

Our initial modules are:

```text
identity
customer
worker
catalog
servicerequest
matching
booking
job
payment
review
dispute
notification
admin
```

Each module represents a meaningful business capability.

---

# 8. Identity Module

Directory:

```text
identity/
├── api/
├── application/
├── domain/
└── infrastructure/
```

Responsibilities:

* registration
* authentication
* OTP
* access tokens
* refresh tokens
* authentication identity
* account status
* security credentials
* authorization primitives

Example:

```text
identity/
├── api/
│   ├── AuthController.java
│   ├── OtpController.java
│   └── response/
│
├── application/
│   ├── command/
│   ├── query/
│   ├── service/
│   └── port/
│
├── domain/
│   ├── model/
│   ├── valueobject/
│   ├── event/
│   ├── exception/
│   └── repository/
│
└── infrastructure/
    ├── persistence/
    ├── security/
    └── otp/
```

Identity should not contain customer-specific business logic.

---

# 9. Customer Module

```text
customer/
├── api/
├── application/
├── domain/
└── infrastructure/
```

Responsibilities:

* customer profile
* customer preferences
* customer addresses
* customer-specific information

It should not contain booking implementation.

For example:

```text
customer/application/service/
```

can contain:

```text
CreateCustomerProfileService
UpdateCustomerProfileService
AddCustomerAddressService
```

But booking creation belongs to:

```text
booking/
```

---

# 10. Worker Module

The worker module is one of the most important domains.

```text
worker/
├── api/
├── application/
├── domain/
└── infrastructure/
```

A more complete structure:

```text
worker/
│
├── api/
│   ├── WorkerController.java
│   ├── WorkerProfileController.java
│   ├── WorkerAvailabilityController.java
│   │
│   ├── request/
│   │   ├── CreateWorkerRequest.java
│   │   ├── UpdateWorkerProfileRequest.java
│   │   └── UpdateAvailabilityRequest.java
│   │
│   └── response/
│       ├── WorkerResponse.java
│       ├── WorkerProfileResponse.java
│       └── WorkerAvailabilityResponse.java
│
├── application/
│   ├── command/
│   │   ├── CreateWorkerCommand.java
│   │   ├── UpdateWorkerProfileCommand.java
│   │   ├── UpdateAvailabilityCommand.java
│   │   └── AddWorkerSkillCommand.java
│   │
│   ├── query/
│   │   ├── GetWorkerQuery.java
│   │   └── GetWorkerProfileQuery.java
│   │
│   ├── service/
│   │   ├── CreateWorkerService.java
│   │   ├── UpdateWorkerProfileService.java
│   │   ├── UpdateWorkerAvailabilityService.java
│   │   └── AddWorkerSkillService.java
│   │
│   └── port/
│       ├── in/
│       └── out/
│
├── domain/
│   ├── model/
│   │   ├── Worker.java
│   │   ├── WorkerSkill.java
│   │   ├── WorkerAvailability.java
│   │   └── WorkerServiceArea.java
│   │
│   ├── valueobject/
│   │   ├── WorkerId.java
│   │   ├── Experience.java
│   │   └── ServiceRadius.java
│   │
│   ├── event/
│   │   ├── WorkerRegistered.java
│   │   └── WorkerAvailabilityChanged.java
│   │
│   ├── exception/
│   │   └── WorkerNotFoundException.java
│   │
│   └── repository/
│       └── WorkerRepository.java
│
└── infrastructure/
    ├── persistence/
    │   ├── WorkerJpaEntity.java
    │   ├── WorkerSpringDataRepository.java
    │   ├── WorkerPersistenceAdapter.java
    │   └── WorkerEntityMapper.java
    │
    ├── verification/
    │   └── WorkerVerificationAdapter.java
    │
    └── configuration/
        └── WorkerModuleConfiguration.java
```

This may look large.

That is intentional as a **structural pattern**, but we should not create every class on day one.

Create classes when the business actually requires them.

---

# 11. API Package

The `api` package is the module's external interface.

Example:

```text
worker/api/
```

contains:

```text
WorkerController.java
```

and API DTOs.

The controller should be thin.

Example conceptual flow:

```text
HTTP Request
     ↓
Controller
     ↓
Command
     ↓
Application Service
     ↓
Domain
     ↓
Repository
     ↓
Database
```

The controller should not perform business decisions.

Avoid:

```java
@PostMapping
public ResponseEntity<?> createWorker(...) {

    // validate everything manually

    // create entity

    // calculate reputation

    // save entity

    // send notification

    // update Redis

    // etc.
}
```

Instead:

```java
@PostMapping
public WorkerResponse createWorker(
        @Valid @RequestBody CreateWorkerRequest request
) {

    var command = mapper.toCommand(request);

    var worker = createWorkerService.execute(command);

    return mapper.toResponse(worker);
}
```

---

# 12. API Request DTOs

Example:

```text
worker/api/request/CreateWorkerRequest.java
```

This represents the HTTP contract.

Example conceptual fields:

```text
name
professions (primary + additional, experience per trade)
rates
skills
serviceAreas
```

It should not be the domain model.

---

# 13. API Response DTOs

Example:

```text
worker/api/response/WorkerResponse.java
```

This represents what the API exposes.

This separation prevents internal database/domain changes from automatically becoming API changes.

For example, we may internally have:

```text
WorkerJpaEntity
```

with 30 fields.

But the public API may expose only:

```text
id
name
profession
experience
rating
completedJobs
verified
```

---

# 14. Application Package

The application layer contains **use cases**.

Examples:

```text
CreateWorkerService
UpdateWorkerProfileService
UpdateWorkerAvailabilityService
AddWorkerSkillService
```

This layer answers:

> What does the system need to do?

The domain answers:

> What rules must always be true?

---

# 15. Command Objects

Commands represent an operation.

Example:

```text
CreateWorkerCommand
```

Conceptually:

```text
CreateWorkerCommand
    name
    professions (primary + additional, experience per trade)
    rates
    skills
    serviceArea
```

A command is not necessarily the same as an HTTP request.

This is useful because later the same use case could be triggered by:

* REST API
* admin operation
* internal module
* asynchronous workflow

without coupling the business operation directly to HTTP.

---

# 16. Query Objects

Queries represent read operations.

Examples:

```text
GetWorkerQuery
GetWorkerProfileQuery
SearchWorkersQuery
```

Commands change state.

Queries retrieve information.

We do not need full CQRS infrastructure initially.

This is simply a useful organizational distinction.

---

# 17. Application Ports

Ports define what the application needs from the outside world.

Example:

```text
worker/application/port/out/
```

could contain:

```text
WorkerRepositoryPort
WorkerVerificationPort
```

However, we should not create interfaces merely because "clean architecture says so."

Create a port when it provides a meaningful boundary.

---

# 18. Domain Package

The domain package contains business concepts.

Example:

```text
worker/domain/
├── model/
├── valueobject/
├── event/
├── exception/
└── repository/
```

The domain should ideally have **no dependency on Spring MVC, HTTP, Redis or database implementation details**.

For example:

```text
Worker.java
```

should represent a worker.

It should not know:

```text
@PostMapping
RedisTemplate
JpaRepository
HttpServletRequest
```

---

# 19. Domain Model

Example:

```text
Worker
```

may contain rules such as:

```text
worker must have a profession
worker cannot accept jobs when unavailable
worker cannot activate without required verification
```

The exact rules will evolve as we define the domain.

The important principle is:

> Business invariants should live close to the business concept that owns them.

---

# 20. Value Objects

Value objects represent concepts rather than database records.

Examples:

```text
WorkerId
Experience
ServiceRadius
Money
Coordinates
PhoneNumber
```

Instead of passing raw strings and integers everywhere:

```java
String phone;
int experience;
double latitude;
```

we can eventually introduce meaningful types:

```java
PhoneNumber
Experience
Coordinates
```

Do not create value objects for every primitive unnecessarily.

Use them where they improve correctness and readability.

---

# 21. Domain Events

Examples:

```text
WorkerRegistered
WorkerAvailabilityChanged
WorkerVerified
```

A domain event means:

> Something meaningful happened in the business domain.

For example:

```text
WorkerAvailabilityChanged
```

could later trigger:

```text
Matching
Notification
Analytics
```

without putting all those responsibilities into the worker module.

---

# 22. Domain Exceptions

Module-specific business exceptions belong inside the module.

Example:

```text
worker/domain/exception/
```

contains:

```text
WorkerNotFoundException
WorkerNotVerifiedException
WorkerUnavailableException
```

Global HTTP mapping should happen elsewhere.

---

# 23. Repository Interfaces

The domain/application side can define:

```text
WorkerRepository
```

while infrastructure implements it.

Conceptually:

```text
domain/repository/WorkerRepository
              ↑
              |
infrastructure/persistence/WorkerPersistenceAdapter
              |
              ↓
      Spring Data / JPA
```

This keeps the domain independent from the persistence technology.

---

# 24. Infrastructure Package

Infrastructure contains implementation details.

Example:

```text
worker/infrastructure/
```

may contain:

```text
persistence/
verification/
configuration/
```

This is where Spring/JPA/external integrations belong.

---

# 25. Persistence Structure

Recommended:

```text
worker/infrastructure/persistence/
├── WorkerJpaEntity.java
├── WorkerSpringDataRepository.java
├── WorkerPersistenceAdapter.java
└── WorkerEntityMapper.java
```

Responsibilities:

### WorkerJpaEntity

Database representation.

```text
WorkerJpaEntity
```

is not the same thing as:

```text
Worker
```

### WorkerSpringDataRepository

Spring Data implementation.

### WorkerPersistenceAdapter

Converts persistence operations into the domain repository contract.

### WorkerEntityMapper

Maps:

```text
Domain → JPA
JPA → Domain
```

---

# 26. Why Separate Domain and JPA Entity?

Because these objects have different responsibilities.

Domain:

```text
Worker
```

represents business behavior.

Persistence:

```text
WorkerJpaEntity
```

represents database storage.

If we use JPA entities directly everywhere, database concerns gradually leak into business logic.

That makes future changes harder.

---

# 27. Important Practical Rule

We should not blindly create:

```text
Entity
DTO
Mapper
Repository
Adapter
Port
Service
Factory
Builder
Handler
Facade
```

for every single object.

That would be architecture theater.

Instead:

> Introduce separation where it protects an actual boundary.

For important transactional modules such as:

```text
booking
payment
matching
service request
job
```

we should be stricter.

For simple read-only functionality, the structure can remain lighter.

---

# 28. Service Request Module

Directory:

```text
servicerequest/
├── api/
├── application/
├── domain/
└── infrastructure/
```

Potential structure:

```text
servicerequest/
├── api/
│   ├── ServiceRequestController.java
│   ├── request/
│   └── response/
│
├── application/
│   ├── command/
│   │   ├── CreateServiceRequestCommand.java
│   │   └── CancelServiceRequestCommand.java
│   ├── query/
│   └── service/
│
├── domain/
│   ├── model/
│   │   ├── ServiceRequest.java
│   │   └── ServiceRequestStatus.java
│   ├── valueobject/
│   ├── event/
│   ├── exception/
│   └── repository/
│
└── infrastructure/
    └── persistence/
```

---

# 29. Matching Module

Matching is intentionally separate.

```text
matching/
├── api/
├── application/
├── domain/
└── infrastructure/
```

It owns:

* candidate discovery
* geographic filtering
* skill matching
* availability filtering
* candidate ranking
* match lifecycle
* matching policies

It should not own the worker's profile.

Worker owns:

```text
Who is this worker?
What skills do they have?
Are they verified?
```

Matching asks:

> Which workers satisfy the requirements of this service request?

---

# 30. Booking Module

```text
booking/
├── api/
├── application/
├── domain/
└── infrastructure/
```

Booking owns:

* worker/customer assignment
* confirmation
* scheduled time
* cancellation
* booking state
* booking concurrency

The booking module should not become responsible for payment implementation.

It can request:

```text
Payment
```

through a well-defined boundary.

---

# 31. Job Module

Booking and job are deliberately separate.

```text
job/
├── api/
├── application/
├── domain/
└── infrastructure/
```

Job owns execution:

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

This separation allows us to distinguish:

> "A worker has been booked"

from:

> "The worker actually performed the service."

---

# 32. Payment Module

Payment should have strong isolation.

```text
payment/
├── api/
├── application/
├── domain/
└── infrastructure/
```

Infrastructure:

```text
payment/infrastructure/
├── persistence/
├── gateway/
│   ├── stripe/
│   └── paystack/
└── webhook/
```

Conceptually:

```text
PaymentGateway
       ↑
       |
StripePaymentGateway
PaystackPaymentGateway
```

The core payment domain should not depend directly on Stripe or Paystack.

---

# 33. Review Module

```text
review/
├── api/
├── application/
├── domain/
└── infrastructure/
```

Review owns:

* rating
* review
* review eligibility
* review lifecycle
* reputation inputs

The review module should not directly modify worker profile data.

Instead, it can publish an event such as:

```text
ReviewSubmitted
```

and another component can update derived reputation information.

---

# 34. Dispute Module

```text
dispute/
├── api/
├── application/
├── domain/
└── infrastructure/
```

It owns:

* dispute creation
* evidence
* investigation
* resolution
* dispute outcomes

A dispute references a job/payment/booking but should not own those entities.

---

# 35. Notification Module

```text
notification/
├── api/
├── application/
├── domain/
└── infrastructure/
```

Infrastructure may contain:

```text
notification/infrastructure/
├── push/
├── sms/
├── email/
└── whatsapp/
```

Example interfaces:

```text
NotificationGateway
SmsGateway
EmailGateway
PushGateway
```

Provider-specific implementations remain inside infrastructure.

---

# 36. Admin Module

```text
admin/
├── api/
├── application/
├── domain/
└── infrastructure/
```

Admin is not a "god module."

It should orchestrate administrative actions but should not directly modify other modules' databases.

For example:

```text
AdminController
      ↓
SuspendWorkerUseCase
      ↓
Worker Module
```

rather than:

```text
AdminController
      ↓
WorkerJpaRepository
      ↓
UPDATE workers ...
```

---

# 37. Shared Package

We will have:

```text
shared/
```

but this package must remain **small**.

Possible contents:

```text
shared/
├── domain/
│   ├── DomainEvent.java
│   └── AggregateRoot.java
│
├── error/
│   ├── ErrorCode.java
│   ├── ApiError.java
│   └── GlobalExceptionHandler.java
│
├── security/
│   └── CurrentUser.java
│
├── time/
│   └── ClockProvider.java
│
└── id/
    └── ...
```

---

# 38. What Must NOT Go Into Shared

Do not create:

```text
shared/
├── WorkerService.java
├── BookingService.java
├── UserRepository.java
├── GenericService.java
├── GenericRepository.java
├── WorkerEntity.java
├── BookingEntity.java
└── Utils.java
```

This would turn `shared` into a dumping ground.

The rule is:

> If something belongs to a specific business domain, it belongs to that domain.

---

# 39. The Dangerous `Utils` Package

Avoid:

```text
utils/
    DateUtils.java
    StringUtils.java
    WorkerUtils.java
    PaymentUtils.java
    BookingUtils.java
    LocationUtils.java
```

especially:

```text
CommonUtils.java
```

because eventually it becomes:

```text
CommonUtils
    ↓
everything depends on it
```

Instead, put behavior close to the module that owns it.

---

# 40. Configuration Package

Global application configuration can live under:

```text
config/
```

Example:

```text
config/
├── SecurityConfig.java
├── JacksonConfig.java
├── RedisConfig.java
├── PostgresConfig.java
├── OpenApiConfig.java
└── WebConfig.java
```

But module-specific configuration should remain inside the module.

For example:

```text
payment/infrastructure/configuration/
```

rather than:

```text
config/PaymentConfig.java
```

if the configuration is exclusively payment-specific.

---

# 41. Security Package

Security infrastructure can be organized as:

```text
config/
└── security/
    ├── SecurityConfig.java
    ├── JwtAuthenticationFilter.java
    ├── JwtTokenProvider.java
    └── CurrentUserProvider.java
```

Identity-specific authentication workflows remain in:

```text
identity/
```

This distinction is important.

Security infrastructure:

> How does Spring Security authenticate requests?

Identity domain:

> What is an account and how does authentication work as a business process?

---

# 42. Global Exception Handling

Do not create individual exception handlers everywhere unless needed.

Global API handling can live under:

```text
shared/error/
```

Example:

```text
GlobalExceptionHandler
ApiError
ErrorCode
```

A domain exception:

```text
WorkerNotVerifiedException
```

can be translated into:

```json
{
  "code": "WORKER_NOT_VERIFIED",
  "message": "Worker verification is required."
}
```

The domain should not know about HTTP status codes.

---

# 43. Database Migration Directory

Database migrations:

```text
src/main/resources/db/migration/
```

Example:

```text
db/
└── migration/
    ├── V1__create_users.sql
    ├── V2__create_workers.sql
    ├── V3__create_skills.sql
    ├── V4__create_service_requests.sql
    ├── V5__create_bookings.sql
    └── ...
```

The exact migration tool will be finalized between Flyway and Liquibase.

For this project, Flyway is a strong initial candidate because of its straightforward migration model.

---

# 44. Application Configuration

Recommended:

```text
src/main/resources/
├── application.yml
├── application-local.yml
├── application-dev.yml
└── application-prod.yml
```

Conceptually:

```text
application.yml
    ↓
common defaults

application-local.yml
    ↓
developer machine

application-dev.yml
    ↓
development environment

application-prod.yml
    ↓
production environment
```

Never commit:

```text
DATABASE_PASSWORD=real-password
STRIPE_SECRET_KEY=real-secret
JWT_SECRET=real-secret
```

Secrets should come from the environment/secret manager.

---

# 45. Test Directory

Tests should mirror the business modules.

Example:

```text
src/test/java/com/karigar/
│
├── identity/
├── customer/
├── worker/
├── catalog/
├── servicerequest/
├── matching/
├── booking/
├── job/
├── payment/
├── review/
├── dispute/
├── notification/
└── architecture/
```

This makes tests easy to locate.

---

# 46. Worker Tests

Example:

```text
worker/
├── api/
│   └── WorkerControllerTest.java
│
├── application/
│   ├── CreateWorkerServiceTest.java
│   └── UpdateWorkerAvailabilityServiceTest.java
│
├── domain/
│   ├── WorkerTest.java
│   └── WorkerAvailabilityTest.java
│
└── infrastructure/
    └── WorkerPersistenceIntegrationTest.java
```

Again, do not create empty test directories just for the sake of symmetry.

Create them when tests exist.

---

# 47. Integration Tests

Some tests need the real infrastructure.

For example:

```text
src/test/java/com/karigar/integration/
```

could contain:

```text
ServiceRequestIntegrationTest
BookingConcurrencyIntegrationTest
PaymentWebhookIntegrationTest
MatchingPostgisIntegrationTest
```

These may use Testcontainers.

Example infrastructure:

```text
PostgreSQL container
Redis container
```

This is especially important for:

* PostGIS queries
* transaction behavior
* concurrency
* Redis operations
* database constraints

---

# 48. Architecture Tests

Create:

```text
src/test/java/com/karigar/architecture/
```

Example:

```text
ModuleDependencyTest.java
DomainDependencyTest.java
```

These tests can use ArchUnit.

The purpose is to prevent architecture from degrading as the team grows.

---

# 49. Architectural Rules We Want to Enforce

For example:

```text
domain
    ↓
must not depend on
Spring MVC
JPA
Redis
HTTP
```

Another rule:

```text
API
    ↓
must not directly access
infrastructure
```

Another:

```text
worker
    ↓
must not directly access
booking.infrastructure
```

And:

```text
payment
    ↓
must not directly access
Stripe implementation from another module
```

These are architectural boundaries.

---

# 50. Module Dependency Direction

A simplified dependency direction:

```text
API
 ↓
Application
 ↓
Domain
 ↑
Infrastructure
```

More accurately:

```text
                ┌───────────────┐
                │      API      │
                └───────┬───────┘
                        ↓
                ┌───────────────┐
                │ Application   │
                └───────┬───────┘
                        ↓
                ┌───────────────┐
                │    Domain     │
                └───────────────┘
                        ↑
                ┌───────────────┐
                │Infrastructure │
                └───────────────┘
```

Infrastructure implements interfaces required by application/domain.

---

# 51. Module-to-Module Communication

Modules should not reach into each other's internals.

Bad:

```text
booking
   ↓
worker.infrastructure.persistence.WorkerJpaEntity
```

Very bad.

Instead:

```text
booking
   ↓
worker public application interface
```

or:

```text
booking
   ↓
domain event
   ↓
worker
```

depending on the use case.

---

# 52. Public vs Internal Module APIs

Conceptually:

```text
worker/
├── api/
├── application/
├── domain/
└── infrastructure/
```

Only selected classes should be treated as the module's public contract.

For example:

```text
worker.application.WorkerQueryService
```

may be intentionally exposed.

But:

```text
worker.infrastructure.persistence.WorkerJpaEntity
```

is internal.

Other modules should never depend on the latter.

---

# 53. Example: Creating a Service Request

Suppose the client calls:

```http
POST /api/v1/service-requests
```

The request travels through:

```text
HTTP
 ↓
ServiceRequestController
 ↓
CreateServiceRequestRequest
 ↓
CreateServiceRequestCommand
 ↓
CreateServiceRequestService
 ↓
ServiceRequest domain
 ↓
ServiceRequestRepository
 ↓
Persistence Adapter
 ↓
PostgreSQL
```

After successful commit:

```text
ServiceRequestSubmitted
        ↓
Matching
        ↓
Find candidate workers
```

The controller does not directly interact with PostGIS.

---

# 54. Example: Booking Confirmation

Request:

```http
POST /api/v1/bookings/{bookingId}/confirm
```

Flow:

```text
BookingController
       ↓
ConfirmBookingCommand
       ↓
ConfirmBookingService
       ↓
Booking domain
       ↓
Concurrency check
       ↓
BookingRepository
       ↓
PostgreSQL transaction
       ↓
BookingConfirmed event
       ↓
Notification
```

Payment should not be implemented inside:

```text
ConfirmBookingService
```

unless the business workflow explicitly requires it.

---

# 55. Example: Payment

Request:

```text
PaymentController
       ↓
CreatePaymentCommand
       ↓
PaymentApplicationService
       ↓
Payment domain
       ↓
PaymentGateway
       ↓
Stripe / Paystack
```

Provider implementation:

```text
payment/infrastructure/gateway/
```

This means changing payment providers does not require rewriting the payment domain.

---

# 56. Example: Matching

Matching may use:

```text
MatchingApplicationService
       ↓
PostGIS candidate query
       ↓
Candidate filtering
       ↓
Skill compatibility
       ↓
Availability
       ↓
Verification
       ↓
Ranking
       ↓
WorkerMatch
```

The worker module owns worker information.

The matching module owns the matching decision.

---

# 57. Location of PostGIS Code

PostGIS-specific SQL should not spread throughout the application.

Prefer:

```text
matching/infrastructure/persistence/
```

for matching-specific geographic queries.

For example:

```text
WorkerCandidateQueryRepository
```

can contain native SQL using:

```text
ST_DWithin
ST_Distance
geography
geometry
```

The application layer should receive meaningful domain/application data rather than raw SQL details.

---

# 58. Location of Redis Code

Redis-specific code belongs in infrastructure.

Examples:

```text
identity/infrastructure/otp/
matching/infrastructure/cache/
worker/infrastructure/cache/
```

depending on ownership.

Do not create:

```text
redis/
```

and put every Redis operation there.

Redis is a technology.

The business module should own the reason Redis is being used.

---

# 59. External Providers

External providers should follow the same pattern.

Example:

```text
payment/
└── infrastructure/
    └── gateway/
        ├── PaymentGateway.java
        ├── stripe/
        │   └── StripePaymentGateway.java
        └── paystack/
            └── PaystackPaymentGateway.java
```

Similarly:

```text
notification/
└── infrastructure/
    ├── sms/
    ├── email/
    └── push/
```

This gives us an anti-corruption boundary around external systems.

---

# 60. File Storage

Worker verification documents and service-request photos may eventually use object storage.

Example:

```text
shared/
    ...
```

should **not** contain all storage business logic.

Instead, the module that owns the file can define what it needs.

For example:

```text
worker/application/port/out/WorkerDocumentStorage.java
```

and implementation:

```text
worker/infrastructure/storage/S3WorkerDocumentStorage.java
```

---

# 61. Docker Structure

Root:

```text
docker-compose.yml
```

could initially provide:

```text
PostgreSQL
PostGIS
Redis
```

Potential structure:

```text
docker/
├── postgres/
│   └── init/
└── redis/
```

Application itself can run from IntelliJ/IDE during development initially.

Later:

```text
docker-compose.yml
```

can run the complete application stack.

---

# 62. Documentation Directory

```text
docs/
```

should contain architectural documents.

Recommended:

```text
docs/
├── 01-product-scope.md
├── 02-user-roles-and-journeys.md
├── 03-functional-requirements.md
├── 04-domain-model.md
├── 05-database-design.md
├── 06-system-architecture.md
├── 07-project-structure.md
├── 08-api-specification.md
├── 09-security.md
├── 10-testing-strategy.md
└── 11-deployment.md
```

These documents should evolve alongside the code.

---

# 63. GitHub Workflows

CI/CD configuration:

```text
.github/
└── workflows/
    ├── ci.yml
    └── cd.yml
```

Initially CI should perform things such as:

```text
compile
unit tests
integration tests
architecture tests
static analysis
build
```

Deployment automation can be added after the deployment architecture is finalized.

---

# 64. Full Recommended Package Tree

The conceptual production structure becomes:

```text
com.karigar
│
├── KarigarApplication.java
│
├── identity/
│   ├── api/
│   ├── application/
│   ├── domain/
│   └── infrastructure/
│
├── customer/
│   ├── api/
│   ├── application/
│   ├── domain/
│   └── infrastructure/
│
├── worker/
│   ├── api/
│   ├── application/
│   ├── domain/
│   └── infrastructure/
│
├── catalog/
│   ├── api/
│   ├── application/
│   ├── domain/
│   └── infrastructure/
│
├── servicerequest/
│   ├── api/
│   ├── application/
│   ├── domain/
│   └── infrastructure/
│
├── matching/
│   ├── api/
│   ├── application/
│   ├── domain/
│   └── infrastructure/
│
├── booking/
│   ├── api/
│   ├── application/
│   ├── domain/
│   └── infrastructure/
│
├── job/
│   ├── api/
│   ├── application/
│   ├── domain/
│   └── infrastructure/
│
├── payment/
│   ├── api/
│   ├── application/
│   ├── domain/
│   └── infrastructure/
│
├── review/
│   ├── api/
│   ├── application/
│   ├── domain/
│   └── infrastructure/
│
├── dispute/
│   ├── api/
│   ├── application/
│   ├── domain/
│   └── infrastructure/
│
├── notification/
│   ├── api/
│   ├── application/
│   ├── domain/
│   └── infrastructure/
│
├── admin/
│   ├── api/
│   ├── application/
│   ├── domain/
│   └── infrastructure/
│
├── shared/
│   ├── domain/
│   ├── error/
│   ├── security/
│   ├── time/
│   └── id/
│
└── config/
    ├── SecurityConfig.java
    ├── RedisConfig.java
    ├── JacksonConfig.java
    └── OpenApiConfig.java
```

This is the **logical package structure**.

The exact number of classes inside each directory will evolve.

---

# 65. Naming Conventions

Use clear names.

### Controllers

```text
WorkerController
BookingController
PaymentController
```

### Application services

Prefer names describing the use case:

```text
CreateWorkerService
ConfirmBookingService
CancelBookingService
CompleteJobService
CreatePaymentService
```

Avoid:

```text
WorkerManager
WorkerHelper
WorkerProcessor
WorkerHandler
WorkerUtil
```

unless the responsibility genuinely matches that concept.

---

# 66. Repository Naming

Domain repository:

```text
WorkerRepository
```

Spring Data implementation:

```text
WorkerSpringDataRepository
```

Persistence adapter:

```text
WorkerPersistenceAdapter
```

This makes responsibilities immediately visible.

---

# 67. Mapper Naming

Use explicit names.

```text
WorkerEntityMapper
WorkerApiMapper
```

instead of:

```text
Mapper
CommonMapper
GenericMapper
```

because generic names become difficult to search and understand.

---

# 68. DTO Naming

Avoid:

```text
WorkerDTO
```

for everything.

Prefer:

```text
CreateWorkerRequest
UpdateWorkerRequest
WorkerResponse
WorkerProfileResponse
WorkerSummaryResponse
```

This tells developers what the object is used for.

---

# 69. Entity Naming

Avoid ambiguous:

```text
WorkerEntity
```

when multiple representations exist.

Use:

```text
WorkerJpaEntity
```

to clearly communicate:

> This object exists for JPA persistence.

The domain object remains:

```text
Worker
```

---

# 70. Avoid Giant Services

This is a major rule.

Do not create:

```text
WorkerService.java
```

with:

```text
create()
update()
delete()
verify()
activate()
deactivate()
search()
assign()
acceptJob()
rejectJob()
completeJob()
calculateRating()
...
```

Instead:

```text
CreateWorkerService
UpdateWorkerProfileService
VerifyWorkerService
UpdateWorkerAvailabilityService
```

As the domain grows, responsibilities remain understandable.

---

# 71. Avoid Giant Controllers

Do not create:

```text
WorkerController
```

with 40 endpoints.

Split controllers by responsibility if needed:

```text
WorkerController
WorkerProfileController
WorkerAvailabilityController
WorkerVerificationController
```

But don't split prematurely.

---

# 72. Avoid Giant Modules

Similarly:

```text
user/
```

should not become:

```text
customer
worker
admin
authentication
payment
profile
address
```

all inside one module.

Those are separate business concerns.

---

# 73. What Happens When the Project Grows?

Initial:

```text
One Spring Boot application
        |
        +-- identity
        +-- worker
        +-- booking
        +-- payment
        +-- matching
        +-- ...
```

Later, if scale/business requirements justify it:

```text
API Gateway
    |
    +-- Core Application
    |
    +-- Matching Service
    |
    +-- Notification Service
    |
    +-- Payment Service
```

The modular boundaries make this transition easier.

We are **not** building microservices now.

We are creating boundaries that make extraction possible later.

---

# 74. Why This Helps Future Microservice Extraction

Suppose matching eventually becomes its own service.

Currently:

```text
matching/
```

already owns:

```text
matching/api
matching/application
matching/domain
matching/infrastructure
```

The extraction becomes conceptually:

```text
Spring Boot Monolith
        ↓
Extract matching module
        ↓
Matching Spring Boot Service
```

Rather than searching through:

```text
services/
repositories/
controllers/
```

for every piece of matching logic.

---

# 75. But Microservice Extraction Is Not Guaranteed

A clean module does not mean it must become a microservice.

Some modules may remain together permanently.

For example:

```text
customer
worker
booking
job
review
```

may continue operating inside the core application.

The architecture should allow extraction, not force it.

---

# 76. Architectural Anti-Patterns

We explicitly avoid:

### God module

```text
user/
```

containing the entire application.

### God service

```text
ApplicationService
```

containing everything.

### God repository

```text
GenericRepository
```

accessed by every module.

### God utility

```text
CommonUtils
```

containing unrelated logic.

### Shared database model

```text
shared/entity/
    WorkerEntity
    BookingEntity
    PaymentEntity
```

### Direct cross-module database access

```text
booking → WorkerJpaRepository
```

### Business logic inside controllers

```text
Controller → DB
```

### Business logic inside JPA entities only

```text
JPA entity = entire application architecture
```

### Everything asynchronous

Not every operation needs events or queues.

---

# 77. Dependency Rules

The project should follow these principles:

### Rule 1

A module owns its domain.

### Rule 2

A module owns its persistence implementation.

### Rule 3

Other modules cannot access another module's infrastructure directly.

### Rule 4

Domain code should not depend on web technology.

### Rule 5

Domain code should not depend on Redis.

### Rule 6

Domain code should not depend on payment providers.

### Rule 7

External providers are adapters.

### Rule 8

Shared code must be genuinely shared.

### Rule 9

Business logic belongs in application/domain layers.

### Rule 10

Controllers translate HTTP into application calls.

---

# 78. Example Dependency

Correct:

```text
BookingController
       ↓
ConfirmBookingService
       ↓
Booking
       ↓
BookingRepository
       ↑
BookingPersistenceAdapter
       ↓
PostgreSQL
```

Incorrect:

```text
BookingController
       ↓
BookingJpaRepository
       ↓
WorkerJpaRepository
       ↓
Redis
       ↓
Stripe
```

The second design quickly becomes impossible to maintain.

---

# 79. Request Lifecycle Across the Architecture

For a typical request:

```text
             HTTP
              │
              ▼
       ┌──────────────┐
       │ API Controller│
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │ Application  │
       │   Use Case   │
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │    Domain    │
       │ Business Rule│
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │ Repository   │
       │   Contract   │
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │Infrastructure│
       └──────┬───────┘
              │
              ▼
        PostgreSQL
```

External systems follow the same principle:

```text
Application
     ↓
Port
     ↓
Adapter
     ↓
External Provider
```

---

# 80. What We Should Actually Build First

Although the architecture supports many modules, the first implementation should not contain hundreds of empty classes.

The initial implementation should probably start with the core path:

```text
identity
worker
customer
catalog
servicerequest
matching
booking
job
```

Then:

```text
payment
review
notification
dispute
admin
```

can be implemented according to the development sequence.

The architectural boundaries exist from the beginning, but implementation depth can vary.

---

# 81. Initial Core Business Flow

The first meaningful vertical slice should eventually be:

```text
Customer
   ↓
Create Service Request
   ↓
Matching
   ↓
Worker Candidate
   ↓
Worker Accepts
   ↓
Booking
   ↓
Job
   ↓
Completion
```

This is much more valuable than building:

```text
100 CRUD endpoints
```

before testing the actual marketplace workflow.

---

# 82. Project Structure and Domain Design Must Agree

The directory structure is not arbitrary.

It reflects the domain model:

```text
User
Customer
Worker
Skill
ServiceRequest
Match
Booking
Job
Payment
Review
Dispute
Notification
```

The package structure should make these boundaries visible.

If the domain model changes, the package structure may also change.

That is expected.

---

# 83. Recommended Final Repository Structure

The complete repository should approximately look like:

```text
karigar-marketplace/
│
├── .github/
│   └── workflows/
│       ├── ci.yml              -- PR + main pipeline (operations/02)
│       └── deploy.yml          -- reusable deploy to staging / production
│
├── docs/                       -- see docs/README.md
│   ├── product/  architecture/  api/  modules/
│   ├── security/  operations/  testing/
│   ├── lld/  adr/  archive/
│
├── docker/                     -- local docker compose support files
│   ├── postgres/
│   └── redis/
│
├── infra/
│   └── terraform/              -- AWS ap-south-1 infrastructure (operations/02 §6)
│
├── ops/
│   └── scripts/                -- migrate.sh, deploy.sh, smoke.sh, rollback.sh
│
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/karigar/
│   │   │       ├── KarigarApplication.java
│   │   │       │
│   │   │       ├── identity/
│   │   │       ├── customer/
│   │   │       ├── worker/
│   │   │       ├── catalog/
│   │   │       ├── servicerequest/
│   │   │       ├── matching/
│   │   │       ├── booking/
│   │   │       ├── job/
│   │   │       ├── payment/
│   │   │       ├── review/
│   │   │       ├── dispute/
│   │   │       ├── notification/
│   │   │       ├── admin/
│   │   │       │
│   │   │       ├── shared/
│   │   │       └── config/
│   │   │
│   │   └── resources/
│   │       ├── application.yml
│   │       ├── application-local.yml
│   │       ├── application-dev.yml
│   │       ├── application-prod.yml
│   │       └── db/
│   │           └── migration/
│   │
│   └── test/
│       ├── java/
│       │   └── com/karigar/
│       │       ├── identity/
│       │       ├── customer/
│       │       ├── worker/
│       │       ├── servicerequest/
│       │       ├── matching/
│       │       ├── booking/
│       │       ├── payment/
│       │       ├── integration/
│       │       └── architecture/
│       │
│       └── resources/
│
├── Dockerfile
├── docker-compose.yml
├── pom.xml
├── README.md
├── .gitignore
└── .dockerignore
```

---

# 84. Final Architectural Rule

The most important rule for this project is:

> **Organize around business capabilities, then use technical layers inside those capabilities.**

Not:

```text
Controller
Service
Repository
Entity
```

as global application concepts.

Instead:

```text
Worker
    API
    Application
    Domain
    Infrastructure

Booking
    API
    Application
    Domain
    Infrastructure

Payment
    API
    Application
    Domain
    Infrastructure
```

This keeps the codebase understandable as the business becomes more complex.

---

# 85. Final Recommended Structure

The architecture we are committing to for the initial project is:

```text
                 KARIGAR MARKETPLACE 
                         │
                 MODULAR MONOLITH
                         │
        ┌────────────────┴────────────────┐
        │                                 │
  Business Modules                 Shared Infrastructure
        │                                 │
        ├── Identity                      ├── Security
        ├── Customer                      ├── Error Handling
        ├── Worker                        ├── Configuration
        ├── Catalog                       └── Common Primitives
        ├── Service Request
        ├── Matching
        ├── Booking
        ├── Job
        ├── Payment
        ├── Review
        ├── Dispute
        ├── Notification
        └── Admin
```

Each business module:

```text
API
 │
Application
 │
Domain
 │
Infrastructure
```

while maintaining strict boundaries between modules.

---

# 86. Open Decisions

The following should remain open until later design documents:

1. Maven vs Gradle
2. Exact Java version
3. Exact Spring Boot version
4. Exact package/company namespace
5. Flyway vs Liquibase
6. JWT implementation details
7. Domain entity vs aggregate boundaries
8. Exact module dependency graph
9. API versioning strategy
10. Exact database schema
11. PostGIS data representation
12. Event naming conventions
13. Outbox implementation
14. Exact CI/CD platform
15. Cloud provider

These should be decided based on the next architectural/database/API work rather than prematurely.

---

# 87. Document Status

**this document — Production Project Directory & Package Structure**

Status:

**Architecture Approved for Initial Implementation**

This document establishes the physical code organization.

It does **not** yet define:

* exact database tables
* exact API endpoints
* exact domain aggregates
* exact state machines
* exact event contracts

Those belong to subsequent documents.

The next important design step is therefore to define the **actual domain model and state machines**, followed by the **ERD/database design** and then the **API contracts**.
