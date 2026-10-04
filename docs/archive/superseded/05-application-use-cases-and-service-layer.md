# Application Use Cases & Service Layer Design

**Project:** Karigar Marketplace
**Status:** Draft for Product/Engineering Review
**Architecture:** Java + Spring Boot Modular Monolith
**Pattern:** Modular Monolith + Domain-Oriented Application Layer

---

# 1. Purpose

The previous documents defined:

```text
Product Scope
      ↓
User Journeys
      ↓
Functional Requirements
      ↓
Business Rules
      ↓
Domain Model
      ↓
Database Design
      ↓
REST API Contract
```

This document defines the layer between the REST API and the domain/infrastructure implementation.

Its purpose is to answer:

> When an API request arrives, exactly what application operation happens, what business rules are executed, what data is changed, what events are produced, and what transaction boundary is used?

The application layer is therefore the **orchestration layer of the business system**.

---

# 2. Core Architecture

The request flow is:

```text
HTTP Request
     │
     ▼
Controller
     │
     ▼
Request DTO
     │
     ▼
Application Use Case
     │
     ├──────────────► Domain Model
     │
     ├──────────────► Repository Ports
     │
     ├──────────────► External Ports
     │
     └──────────────► Domain Events
     │
     ▼
Transaction Commit
     │
     ▼
Response DTO
```

The most important rule is:

> Controllers translate HTTP into application operations. They should not implement business workflows.

---

# 3. What Is a Use Case?

A use case represents a meaningful business operation.

Examples:

```text
CreateServiceRequest
CancelServiceRequest
AcceptWorkerMatch
RejectWorkerMatch
ConfirmBooking
CancelBooking
StartJob
CompleteJob
CreatePayment
ApproveAdditionalWork
CreateReview
CreateDispute
```

These are better boundaries than generic services such as:

```text
ServiceRequestService
WorkerService
BookingService
PaymentService
```

because generic services tend to become large classes containing unrelated operations.

---

# 4. Use Case Naming

Use names based on business intent.

Good:

```text
CreateServiceRequest
CancelServiceRequest
FindMatchingWorkers
AcceptWorkerMatch
ConfirmBooking
StartJob
CompleteJob
CreatePayment
RefundPayment
CreateReview
OpenDispute
ResolveDispute
```

Avoid vague names:

```text
ServiceRequestManager
WorkerHelper
BookingManager
CommonService
UtilityService
BusinessService
```

The name should tell another engineer what business operation the class performs.

---

# 5. Command vs Query

The application layer should distinguish between:

### Commands

Operations that change state.

```text
CreateServiceRequest
CancelServiceRequest
AcceptWorkerMatch
ConfirmBooking
StartJob
CompleteJob
CreatePayment
RefundPayment
CreateReview
```

### Queries

Operations that read state.

```text
GetServiceRequest
ListCustomerServiceRequests
GetWorkerProfile
FindWorkerMatches
GetBooking
GetJob
GetWorkerReviews
GetPayment
```

The distinction does **not** mean we need full CQRS infrastructure.

It simply keeps read and write responsibilities clear.

---

# 6. Command Structure

A command represents the input required by a use case.

Example:

```java
public record CreateServiceRequestCommand(
    UUID customerId,
    UUID professionId,
    String description,
    double latitude,
    double longitude,
    String addressText,
    Instant scheduledAt,
    ServiceUrgency urgency
) {}
```

The command should contain application input.

It should not contain HTTP-specific concepts such as:

```text
HttpServletRequest
ResponseEntity
MultipartHttpServletRequest
```

The application layer should not know about HTTP.

---

# 7. Use Case Interface

A use case may be represented by an interface.

Example:

```java
public interface CreateServiceRequestUseCase {

    ServiceRequestResult execute(
        CreateServiceRequestCommand command
    );
}
```

Implementation:

```java
@Service
@Transactional
class CreateServiceRequestService
        implements CreateServiceRequestUseCase {

    @Override
    public ServiceRequestResult execute(
        CreateServiceRequestCommand command
    ) {
        // application workflow
    }
}
```

The exact interface-vs-class approach can remain pragmatic.

We should not create interfaces merely because a framework allows them.

Interfaces are particularly useful at module boundaries and external ports.

---

# 8. Application Layer Responsibilities

The application layer is responsible for:

* orchestrating a business operation
* loading required aggregates/entities
* invoking domain behavior
* calling repository ports
* calling external provider ports
* enforcing application-level rules
* managing transaction boundaries
* publishing domain events
* coordinating multiple domain objects
* converting domain results into application results

It should **not** contain:

* HTTP handling
* SQL implementation
* JPA mapping
* Redis implementation
* payment-provider SDK code
* notification SDK code
* complicated domain rules that belong inside domain objects

---

# 9. Domain Layer Responsibilities

The domain layer owns business rules that describe the behavior of the business itself.

For example:

```java
booking.confirm();
```

The `Booking` domain model can ensure that confirmation is only possible from a valid state.

Likewise:

```java
job.start();
```

can enforce:

```text
ARRIVED → WORK_STARTED
```

and reject:

```text
CONFIRMED → WORK_STARTED
```

if the business rules do not permit skipping the arrival stage.

---

# 10. Application vs Domain

A useful distinction:

### Application

> What steps must happen to complete this use case?

### Domain

> What is legally/validly allowed according to the business rules?

Example:

```text
ConfirmBookingUseCase
```

might:

1. Load booking
2. Load service request
3. Verify customer access
4. Ask booking to confirm
5. Save booking
6. Publish event

The domain object decides whether:

```text
PENDING → CONFIRMED
```

is valid.

---

# 11. Repository Ports

The domain/application side should depend on repository abstractions.

Example:

```java
public interface WorkerRepository {

    Optional<Worker> findById(UUID id);

    Worker save(Worker worker);
}
```

The infrastructure module provides the implementation.

For example:

```text
domain/repository/WorkerRepository
             ▲
             │
             │ implements
             │
infrastructure/persistence/
WorkerPersistenceAdapter
```

This keeps business code independent of Spring Data/JPA details.

---

# 12. External Provider Ports

External systems should also be abstracted.

Examples:

```java
public interface PaymentGateway {
    PaymentResult createPayment(PaymentRequest request);
}
```

```java
public interface NotificationGateway {
    void send(NotificationRequest request);
}
```

```java
public interface StorageGateway {
    StorageObject store(...);
}
```

The domain/application layer should not directly depend on:

```java
StripeClient
PaystackClient
TwilioClient
S3Client
```

Those belong to infrastructure adapters.

---

# 13. Transaction Boundaries

Transactions should normally be defined around a business operation.

Example:

```java
@Transactional
public ServiceRequestResult execute(...) {
    ...
}
```

A transaction may contain:

```text
Load data
   ↓
Validate business state
   ↓
Modify domain objects
   ↓
Persist changes
   ↓
Create domain/outbox events
   ↓
Commit
```

The transaction should not remain open while waiting for an external network call unless there is a very specific reason.

---

# 14. Important Transaction Rule

Avoid:

```text
BEGIN TRANSACTION
    ↓
Update database
    ↓
Call payment provider
    ↓
Wait 5 seconds
    ↓
Call notification provider
    ↓
Commit
```

This creates:

* long database locks
* unnecessary resource usage
* external dependency coupling
* failure complexity

Prefer:

```text
Database transaction
      ↓
Persist local state
      ↓
Commit
      ↓
Async/event processing
      ↓
External provider
```

Financial operations require additional design, but the same principle should generally apply.

---

# 15. Create Service Request Use Case

API:

```http
POST /api/v1/service-requests
```

Maps to:

```text
CreateServiceRequestUseCase
```

Flow:

```text
Controller
   ↓
CreateServiceRequestCommand
   ↓
CreateServiceRequestUseCase
   ↓
Validate customer
   ↓
Validate profession
   ↓
Validate location
   ↓
Create ServiceRequest domain object
   ↓
Persist ServiceRequest
   ↓
Publish ServiceRequestSubmitted
   ↓
Return result
```

---

# 16. Create Service Request — Detailed Flow

```text
1. Authenticate customer
2. Verify customer can create requests
3. Validate profession
4. Validate description
5. Validate scheduled time
6. Validate geographic location
7. Create service request
8. Store request
9. Record initial status
10. Commit transaction
11. Trigger matching asynchronously
12. Notify customer if appropriate
```

The API controller should not perform these steps itself.

---

# 17. Example Application Service

Conceptual implementation:

```java
@Service
@RequiredArgsConstructor
class CreateServiceRequestService
        implements CreateServiceRequestUseCase {

    private final CustomerRepository customerRepository;
    private final ProfessionRepository professionRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final DomainEventPublisher eventPublisher;

    @Override
    @Transactional
    public ServiceRequestResult execute(
            CreateServiceRequestCommand command) {

        Customer customer = customerRepository
            .findById(command.customerId())
            .orElseThrow(CustomerNotFoundException::new);

        Profession profession = professionRepository
            .findById(command.professionId())
            .orElseThrow(ProfessionNotFoundException::new);

        ServiceRequest request =
            ServiceRequest.create(
                customer.id(),
                profession.id(),
                command.description(),
                command.latitude(),
                command.longitude(),
                command.addressText(),
                command.scheduledAt(),
                command.urgency()
            );

        serviceRequestRepository.save(request);

        eventPublisher.publish(
            new ServiceRequestSubmitted(request.id())
        );

        return ServiceRequestResult.from(request);
    }
}
```

This is conceptual architecture, not the final implementation.

---

# 18. Controller Responsibility

Controller:

```java
@PostMapping
public ResponseEntity<ServiceRequestResponse> create(
        @Valid @RequestBody CreateServiceRequestRequest request,
        Authentication authentication) {

    UUID customerId = authenticationService
        .getCurrentUserId(authentication);

    CreateServiceRequestCommand command =
        request.toCommand(customerId);

    ServiceRequestResult result =
        createServiceRequest.execute(command);

    return ResponseEntity
        .status(HttpStatus.CREATED)
        .body(ServiceRequestResponse.from(result));
}
```

The controller does not:

* query repositories directly
* calculate matching
* create domain objects manually
* call payment APIs
* send notifications
* implement state transitions

---

# 19. Matching Use Case

After service request creation:

```text
ServiceRequestSubmitted
        ↓
Matching
        ↓
Find eligible workers
        ↓
Rank candidates
        ↓
Create WorkerMatch records
        ↓
Notify workers
```

Potential use case:

```text
FindMatchingWorkers
```

or:

```text
StartMatchingForServiceRequest
```

The final naming can depend on whether matching is synchronous or asynchronous.

---

# 20. Matching Architecture

The application layer orchestrates:

```text
Service Request
       ↓
Matching Use Case
       ↓
Worker Candidate Query
       ↓
Skill Filtering
       ↓
Availability Filtering
       ↓
Geographic Filtering
       ↓
Verification Filtering
       ↓
Ranking
       ↓
Worker Matches
       ↓
Notifications
```

The matching algorithm itself should not be embedded inside the controller.

---

# 21. Matching Domain vs Application

Application layer:

```text
Get request
Get candidate workers
Call matching engine
Persist matches
Publish events
```

Domain/service logic:

```text
Is worker eligible?
How is candidate score calculated?
What constraints apply?
```

Infrastructure:

```text
PostGIS query
Redis lookup
Database implementation
```

This separation keeps matching replaceable.

---

# 22. Worker Match Acceptance

API:

```http
POST /api/v1/matches/{id}/accept
```

Use case:

```text
AcceptWorkerMatch
```

Flow:

```text
Authenticate worker
      ↓
Load match
      ↓
Verify ownership
      ↓
Load service request
      ↓
Verify request still active
      ↓
Verify worker availability
      ↓
Accept match
      ↓
Persist
      ↓
Publish WorkerMatchAccepted
```

---

# 23. Concurrency in Match Acceptance

Suppose:

```text
Worker A ─┐
          ├── accepts same request
Worker B ─┘
```

Both requests arrive simultaneously.

The application layer must coordinate with database concurrency control.

Possible approaches:

* optimistic locking
* pessimistic locking
* atomic conditional update
* unique database constraint

The exact strategy will be finalized during implementation.

The important invariant is:

> The system must never accidentally create two confirmed workers for a request when the MVP business rule allows only one.

---

# 24. Confirm Booking Use Case

Use case:

```text
ConfirmBooking
```

Flow:

```text
Customer
   ↓
ConfirmBookingCommand
   ↓
Load Booking
   ↓
Authorize Customer
   ↓
Check Booking State
   ↓
Check Service Request State
   ↓
Confirm Booking
   ↓
Create Job
   ↓
Persist
   ↓
Publish BookingConfirmed
```

This should normally happen inside one database transaction.

---

# 25. Booking Domain Behavior

The domain model owns the transition:

```text
PENDING → CONFIRMED
```

Conceptually:

```java
booking.confirm(customerId);
```

It can reject:

```text
CANCELLED → CONFIRMED
COMPLETED → CONFIRMED
EXPIRED → CONFIRMED
```

The application layer should not manually modify:

```java
booking.setStatus(CONFIRMED);
```

because that bypasses domain rules.

---

# 26. Cancel Booking Use Case

```text
CancelBooking
```

Flow:

```text
Authenticate
   ↓
Load booking
   ↓
Authorize actor
   ↓
Check cancellation policy
   ↓
booking.cancel(...)
   ↓
Persist
   ↓
Publish BookingCancelled
```

Potential side effects:

```text
Notification
Replacement matching
Payment adjustment
Audit event
```

These should be triggered through appropriate application/event mechanisms.

---

# 27. Job Lifecycle Use Cases

Each important transition should have a dedicated operation.

```text
MarkJobEnRoute
MarkJobArrived
StartJob
CompleteJob
ReportNoShow
```

This provides a clear audit trail.

Instead of:

```text
updateJobStatus(jobId, status)
```

we use:

```text
startJob(jobId)
```

because starting a job has business meaning.

---

# 28. Start Job

API:

```http
POST /api/v1/jobs/{id}/start
```

Use case:

```text
StartJob
```

Flow:

```text
Authenticate worker
      ↓
Load job
      ↓
Authorize worker
      ↓
Verify current state
      ↓
job.start()
      ↓
Persist
      ↓
Publish JobStarted
```

---

# 29. Complete Job

API:

```http
POST /api/v1/jobs/{id}/complete
```

Use case:

```text
CompleteJob
```

Flow:

```text
Authenticate
      ↓
Authorize worker
      ↓
Load job
      ↓
Validate state
      ↓
Validate outstanding additional work
      ↓
Complete job
      ↓
Persist
      ↓
Publish JobCompleted
```

Potential asynchronous reactions:

```text
Payment workflow
Review eligibility
Customer notification
Worker earnings calculation
Analytics
```

---

# 30. Additional Work Use Case

Worker:

```text
RequestAdditionalWork
```

Customer:

```text
ApproveAdditionalWork
RejectAdditionalWork
```

Flow:

```text
Worker
  ↓
Additional Work Request
  ↓
Persist
  ↓
Notify Customer
  ↓
Customer Approves
  ↓
Additional Work Approved
  ↓
Payment amount updated/calculated
```

The worker cannot directly modify the final amount.

---

# 31. Payment Use Cases

Potential application use cases:

```text
CreatePayment
ConfirmPayment
HandlePaymentWebhook
RefundPayment
```

Payment provider interactions belong behind:

```text
PaymentGateway
```

Example:

```text
CreatePayment
      ↓
Validate Job
      ↓
Calculate Amount
      ↓
Create local Payment
      ↓
Call PaymentGateway
      ↓
Store provider reference
      ↓
Return payment information
```

The exact transaction/provider strategy depends on the chosen payment flow.

---

# 32. Payment Webhook Use Case

Webhook:

```http
POST /api/v1/webhooks/payments/{provider}
```

Application operation:

```text
HandlePaymentWebhook
```

Flow:

```text
Webhook Controller
       ↓
Verify provider signature
       ↓
Parse provider event
       ↓
HandlePaymentWebhook
       ↓
Find local payment
       ↓
Check idempotency
       ↓
Update payment
       ↓
Persist provider event
       ↓
Publish PaymentSucceeded/Failed
```

A duplicate webhook should not produce duplicate state changes.

---

# 33. Domain Events

Domain events represent something meaningful that happened.

Examples:

```text
ServiceRequestSubmitted
WorkerMatchCreated
WorkerMatchAccepted
BookingConfirmed
BookingCancelled
JobStarted
JobCompleted
AdditionalWorkRequested
AdditionalWorkApproved
PaymentSucceeded
PaymentFailed
ReviewCreated
DisputeOpened
DisputeResolved
```

An event should describe a fact.

For example:

```text
BookingConfirmed
```

means:

> A booking was confirmed.

It should not be:

```text
DoSendBookingNotification
```

because that describes an instruction rather than a business fact.

---

# 34. Domain Event Example

```java
public record BookingConfirmed(
    UUID bookingId,
    UUID serviceRequestId,
    UUID workerId,
    UUID customerId,
    Instant occurredAt
) {}
```

The event should contain enough information for downstream processing without forcing consumers to make unnecessary queries.

---

# 35. Event Consumers

Example:

```text
BookingConfirmed
       │
       ├── Notification Handler
       │
       ├── Audit Handler
       │
       └── Analytics Handler
```

Potentially later:

```text
       ├── Payment Handler
       └── Matching Handler
```

depending on business design.

---

# 36. Synchronous vs Asynchronous

Not every operation needs asynchronous processing.

### Synchronous

Use when the caller needs the immediate result.

Examples:

```text
Create worker
Confirm booking
Cancel booking
Start job
Complete job
Approve additional work
```

### Asynchronous

Use when processing can happen after the transaction.

Examples:

```text
Send notification
Generate analytics
Start broad worker matching
Send SMS
Generate report
Process webhook side effects
```

---

# 37. Initial Event Architecture

Initially:

```text
Application Use Case
       ↓
Database Transaction
       ↓
Domain Event
       ↓
Spring Application Event
       ↓
Event Handler
```

This is sufficient for a modular monolith.

We should not introduce Kafka merely because the architecture may eventually need Kafka.

---

# 38. Transactional Outbox

As reliability requirements increase, events should move toward:

```text
Business Transaction
       ↓
Database
 ┌───────────────┐
 │ Business Data │
 │ Outbox Event  │
 └───────────────┘
       ↓
Commit
       ↓
Outbox Processor
       ↓
Message Broker / Handler
```

This solves the classic problem:

```text
Database committed
       ↓
Application crashes
       ↓
Event never published
```

The outbox ensures the event is persisted with the business transaction.

---

# 39. Module-to-Module Communication

Modules should communicate through explicit contracts.

Prefer:

```text
Booking
   ↓
BookingConfirmed event
   ↓
Notification
```

over:

```text
BookingService
   ↓
NotificationService.sendSMS(...)
```

for loosely coupled side effects.

For direct business dependencies, application ports may be appropriate.

---

# 40. Example Module Interaction

Service request:

```text
servicerequest
      │
      │ ServiceRequestSubmitted
      ▼
matching
      │
      │ WorkerMatchCreated
      ▼
notification
```

Booking:

```text
booking
   │
   │ BookingConfirmed
   ▼
job
   │
   └──────────────► notification
```

Payment:

```text
payment
   │
   │ PaymentSucceeded
   ▼
job / review / notification
```

The exact event topology should remain intentionally simple.

---

# 41. Avoid Circular Dependencies

Bad:

```text
Booking → Job
Job → Booking
Booking → Payment
Payment → Booking
```

This can create an architecture that is difficult to understand and test.

Prefer clear ownership.

For example:

```text
Booking
   ↓
BookingConfirmed
   ↓
Job
```

and:

```text
JobCompleted
   ↓
Payment workflow
```

Events can reduce direct coupling.

---

# 42. Application Service Size

A use-case service should normally represent one coherent business operation.

Avoid a 2,000-line:

```java
BookingService
```

containing:

```text
create()
confirm()
cancel()
reschedule()
start()
complete()
refund()
notify()
review()
```

Instead:

```text
CreateBooking
ConfirmBooking
CancelBooking
RescheduleBooking
StartJob
CompleteJob
RefundPayment
CreateReview
```

This makes testing and maintenance significantly easier.

---

# 43. Domain Service

A domain service is appropriate when business logic:

* is genuinely domain logic
* does not naturally belong to one entity
* operates on domain concepts
* should remain independent of infrastructure

Example:

```text
WorkerMatchingPolicy
```

could determine whether:

```text
worker + service request
```

satisfies business constraints.

But the domain service should not directly query PostgreSQL.

---

# 44. Application Service vs Domain Service

### Application service

```text
Find request
Find workers
Call matching policy
Save matches
Publish events
```

### Domain service

```text
Given request and worker:
Are they compatible?
```

This distinction prevents domain logic from becoming dependent on repositories and infrastructure.

---

# 45. Query Services

Queries can have separate application services.

Example:

```text
GetWorkerProfile
GetServiceRequest
GetBooking
ListCustomerRequests
GetWorkerReviews
FindWorkerMatches
```

Query services can use optimized read queries.

They do not necessarily need to construct the full domain aggregate.

This is particularly useful for:

```text
Worker profile
Search results
Admin dashboards
Review lists
Matching candidate queries
```

---

# 46. Read Model vs Domain Model

A worker profile API might need:

```text
Worker
Profession
Rating
Completed Jobs
Verification
Distance
Availability
```

It may be inefficient to load every domain object separately.

A query can return a dedicated projection:

```java
public record WorkerProfileView(
    UUID workerId,
    String name,
    String profession,
    BigDecimal rating,
    long completedJobs,
    boolean verified,
    double distanceMeters
) {}
```

This is a read model.

It does not mean we need full CQRS.

---

# 47. Application Result Objects

Use cases should return application-level result objects.

Example:

```java
public record ServiceRequestResult(
    UUID id,
    String status,
    Instant createdAt
) {}
```

This avoids leaking domain entities into controllers.

---

# 48. Exception Strategy

Business exceptions should be meaningful.

Examples:

```text
CustomerNotFoundException
WorkerNotFoundException
ServiceRequestNotFoundException
BookingNotFoundException
InvalidBookingStateException
WorkerNotEligibleException
MatchExpiredException
PaymentAlreadyProcessedException
ReviewNotAllowedException
DisputeNotAllowedException
```

Avoid:

```text
RuntimeException("Something went wrong")
```

for expected business failures.

---

# 49. Domain Exceptions

Domain exceptions should represent invalid domain behavior.

Example:

```java
public void start() {

    if (status != JobStatus.ARRIVED) {
        throw new InvalidJobStateException(
            "Job can only be started after arrival"
        );
    }

    status = JobStatus.WORK_STARTED;
}
```

The domain model protects its invariants.

---

# 50. Error Translation

The application/domain exception eventually becomes an API error.

```text
Domain Exception
       ↓
Application Boundary
       ↓
Global Exception Handler
       ↓
HTTP Status
       ↓
API Error DTO
```

Example:

```text
InvalidJobStateException
       ↓
409 CONFLICT
       ↓
JOB_INVALID_STATE
```

---

# 51. Authorization in Use Cases

Authorization should not rely only on controller-level annotations.

For example:

```text
POST /jobs/{id}/complete
```

The application operation must verify:

```text
authenticated user
        ↓
is worker assigned to this job?
```

The controller can enforce broad role checks:

```text
ROLE_WORKER
```

but the use case should enforce resource-specific authorization.

---

# 52. Example — Complete Job Authorization

```text
Request
  ↓
Authenticated user = Worker A
  ↓
Load Job 123
  ↓
Job.workerId = Worker B
  ↓
Reject
```

Even though both are workers, Worker A must not complete Worker B's job.

---

# 53. Idempotency in Application Layer

Idempotency belongs around the application operation.

Example:

```text
ConfirmBooking
```

with:

```text
Idempotency-Key = ABC
```

The system should ensure:

```text
First request
    ↓
Booking confirmed

Retry
    ↓
Same result
```

rather than:

```text
First request
    ↓
Booking confirmed

Retry
    ↓
Duplicate booking/payment
```

---

# 54. Application Layer and Redis

Redis can support application operations for:

* OTP
* rate limits
* temporary locks
* caching
* short-lived matching state
* idempotency records where appropriate

But Redis must not become the authoritative store for:

```text
booking state
payment state
job completion
review history
dispute history
```

PostgreSQL remains the source of truth.

---

# 55. Application Layer and PostGIS

Matching may use a repository port such as:

```java
List<WorkerCandidate> findNearbyEligibleWorkers(
    Point location,
    double radiusMeters
);
```

The application layer does not need to know that the implementation uses:

```sql
ST_DWithin(...)
```

That detail belongs to infrastructure.

---

# 56. Application Layer and Notifications

Bad:

```java
booking.confirm();

smsClient.send(...);
emailClient.send(...);
pushClient.send(...);
```

inside the core booking transaction.

Better:

```text
booking.confirm()
      ↓
BookingConfirmed
      ↓
Notification Handler
      ↓
Notification Gateway
      ├── Push
      ├── SMS
      └── Email
```

This keeps notification failures from unnecessarily breaking the booking operation.

---

# 57. Application Layer and Payment Providers

Bad:

```java
StripeClient stripe = ...
stripe.createPayment(...)
```

inside domain code.

Better:

```text
CreatePayment
      ↓
PaymentGateway
      ↓
StripePaymentAdapter
```

Later:

```text
PaymentGateway
      ├── StripeAdapter
      ├── PaystackAdapter
      └── FutureProviderAdapter
```

The core payment logic remains provider-independent.

---

# 58. Complete Customer Request Flow

The entire flow becomes:

```text
Customer App
     │
     ▼
POST /service-requests
     │
     ▼
ServiceRequestController
     │
     ▼
CreateServiceRequestCommand
     │
     ▼
CreateServiceRequestUseCase
     │
     ├── CustomerRepository
     ├── ProfessionRepository
     └── ServiceRequestRepository
     │
     ▼
ServiceRequestSubmitted
     │
     ▼
Transaction Commit
     │
     ▼
Matching Handler
     │
     ▼
Matching Use Case
     │
     ▼
PostGIS Candidate Query
     │
     ▼
Worker Matches
     │
     ▼
Notification
```

This is the first major business workflow of the platform.

---

# 59. Complete Booking Flow

```text
Worker accepts match
        ↓
AcceptWorkerMatch
        ↓
WorkerMatchAccepted
        ↓
Customer selects/confirms
        ↓
ConfirmBooking
        ↓
Booking.confirm()
        ↓
Job created
        ↓
BookingConfirmed
        ↓
Notification
        ↓
Worker starts execution
```

---

# 60. Complete Job Flow

```text
CONFIRMED
    ↓
MarkJobEnRoute
    ↓
EN_ROUTE
    ↓
MarkJobArrived
    ↓
ARRIVED
    ↓
StartJob
    ↓
WORK_STARTED
    ↓
CompleteJob
    ↓
WORK_COMPLETED
```

Each transition is:

* authorized
* validated
* persisted
* auditable
* capable of producing an event

---

# 61. Complete Payment Flow

```text
Job / Customer
      ↓
CreatePayment
      ↓
Local Payment = INITIATED
      ↓
PaymentGateway
      ↓
Provider
      ↓
Webhook
      ↓
HandlePaymentWebhook
      ↓
Payment = SUCCESS
      ↓
PaymentSucceeded
      ↓
Notifications / Earnings / Analytics
```

The local database remains the authoritative representation of the platform's payment state.

---

# 62. Complete Dispute Flow

```text
Customer/Worker
      ↓
OpenDispute
      ↓
Dispute = OPEN
      ↓
Admin Review
      ↓
UNDER_REVIEW
      ↓
Evidence Collection
      ↓
ResolveDispute
      ↓
RESOLVED
      ↓
Possible payment/refund action
      ↓
Audit + Notification
```

Dispute resolution should not silently rewrite historical job/payment records.

---

# 63. Service-to-Service Calls Inside the Monolith

Even though this is one application, modules should behave as if they have boundaries.

For example:

```text
booking
   ↓
booking application API
   ↓
job application API/event
```

Avoid allowing every module to directly access every other module's repositories.

Bad:

```text
WorkerController
    ↓
BookingRepository
    ↓
PaymentRepository
    ↓
JobRepository
```

Better:

```text
WorkerController
    ↓
Worker Use Case
    ↓
Worker Module
```

The module owns its data and operations.

---

# 64. Dependency Direction

Preferred:

```text
API
 ↓
Application
 ↓
Domain
 ↑
Infrastructure
```

More explicitly:

```text
API ──────────────► Application
                      │
                      ▼
                    Domain
                      ▲
                      │
                Infrastructure
```

Infrastructure implements ports defined by the application/domain side.

---

# 65. Dependency Rule

A module should not depend on another module's infrastructure package.

Bad:

```text
booking
  ↓
worker.infrastructure.persistence.WorkerJpaRepository
```

Better:

```text
booking
  ↓
worker application/domain contract
```

or an event:

```text
WorkerVerified
```

depending on the use case.

---

# 66. Application Events vs Domain Events

### Domain event

Represents a business fact.

```text
JobCompleted
```

### Application event

May represent an internal workflow event.

```text
ProcessWorkerNotification
```

The architecture should primarily expose domain facts between business modules.

---

# 67. Event Naming Rule

Use past tense for facts:

```text
ServiceRequestSubmitted
BookingConfirmed
JobCompleted
PaymentSucceeded
ReviewCreated
```

Avoid command-like event names:

```text
ConfirmBookingEvent
CompleteJobEvent
SendNotificationEvent
```

The latter sound like instructions.

---

# 68. Audit Events

Important operations should create audit information.

Examples:

```text
Worker verification approved
Worker suspended
Booking cancelled
Payment refunded
Dispute resolved
Admin changed worker status
```

Audit events should capture:

```text
actor
action
resource
resourceId
timestamp
requestId
metadata
```

Audit history should not be casually mutable.

---

# 69. Testing Application Use Cases

Each use case should have focused tests.

Example:

```text
ConfirmBookingTest
```

Cases:

```text
✓ confirms valid booking
✓ rejects cancelled booking
✓ rejects expired booking
✓ rejects unauthorized customer
✓ prevents duplicate confirmation
✓ creates job
✓ publishes BookingConfirmed
```

---

# 70. Domain Tests

Domain tests should not require Spring Boot.

Example:

```java
@Test
void cannotStartJobBeforeArrival() {
    Job job = Job.confirmed(...);

    assertThrows(
        InvalidJobStateException.class,
        job::start
    );
}
```

This makes domain logic fast and easy to test.

---

# 71. Integration Tests

Integration tests verify:

```text
Controller
    ↓
Application
    ↓
Repository
    ↓
PostgreSQL/PostGIS
```

Examples:

```text
CreateServiceRequestIntegrationTest
ConfirmBookingIntegrationTest
PaymentWebhookIntegrationTest
WorkerMatchingIntegrationTest
```

Testcontainers should eventually provide realistic PostgreSQL/PostGIS and Redis instances.

---

# 72. Architecture Tests

ArchUnit can enforce:

```text
Controller → Application
Application → Domain
Infrastructure → Application/Domain
```

and prevent:

```text
Domain → Spring MVC
Domain → JPA
Domain → Controller
```

It can also enforce module boundaries.

Example architectural rule:

```text
booking
must not access
worker.infrastructure
```

This prevents architectural degradation as the codebase grows.

---

# 73. What Must Never Be Done

## Do not put business logic in controllers

Bad:

```java
if (booking.getStatus() == CONFIRMED) {
    booking.setStatus(COMPLETED);
}
```

---

## Do not put everything in services

Bad:

```text
BookingService.java
  3,000 lines
```

---

## Do not expose JPA entities

Bad:

```java
return workerRepository.findById(id).get();
```

---

## Do not let domain models call external APIs

Bad:

```java
booking.confirm();
stripe.charge();
```

inside the domain.

---

## Do not let modules access each other's tables directly

Bad:

```text
booking → worker JPA repository
payment → booking JPA repository
```

---

## Do not use events for every method call

Events are useful for meaningful decoupling.

They should not turn simple synchronous logic into an unnecessarily complicated distributed-style workflow.

---

# 74. Practical Use Case Package Structure

Example:

```text
worker/
└── application/
    ├── command/
    │   ├── CreateWorkerCommand.java
    │   ├── UpdateWorkerProfileCommand.java
    │   └── UpdateWorkerAvailabilityCommand.java
    │
    ├── query/
    │   ├── GetWorkerProfileQuery.java
    │   └── FindWorkersQuery.java
    │
    ├── service/
    │   ├── CreateWorkerService.java
    │   ├── UpdateWorkerProfileService.java
    │   ├── UpdateWorkerAvailabilityService.java
    │   └── FindWorkersService.java
    │
    └── port/
        ├── in/
        └── out/
```

For larger modules, commands and queries can be organized into feature-specific packages.

---

# 75. Practical Rule About Interfaces

Do not create an interface for every class automatically.

This:

```text
WorkerService
IWorkerService
WorkerServiceImpl
```

does not automatically improve architecture.

Prefer interfaces where they provide a meaningful boundary:

```text
PaymentGateway
NotificationGateway
StorageGateway
WorkerRepository
ServiceRequestRepository
```

and application use-case interfaces where they improve module/API boundaries.

---

# 76. Recommended Application Layer Pattern

For this project:

```text
api/
    ↓
application/
    ├── command/
    ├── query/
    ├── service/
    └── port/
    ↓
domain/
    ├── model/
    ├── valueobject/
    ├── event/
    ├── exception/
    └── repository/
    ↓
infrastructure/
```

This gives us:

* clear responsibility
* testability
* modularity
* controlled dependencies
* future extraction capability

without prematurely implementing microservices.

---

# 77. End-to-End Architecture

The resulting architecture is:

```text
                         CLIENTS
                            │
             ┌──────────────┼──────────────┐
             │              │              │
          Customer        Worker         Admin
             │              │              │
             └──────────────┼──────────────┘
                            ▼
                         REST API
                            │
                            ▼
                    Application Layer
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
       Commands           Queries           Events
          │                 │                 │
          ▼                 ▼                 ▼
                    Domain Layer
                            │
              ┌─────────────┼─────────────┐
              │             │             │
          Repository      Domain        Ports
             Ports        Events          │
              │                           │
              ▼                           ▼
       PostgreSQL/PostGIS          External Providers
              │                    ├── Payments
              │                    ├── SMS
              │                    ├── Push
              │                    ├── Storage
              │                    └── Maps
              │
             Redis
```

---

# 78. Architectural Invariants

The following rules should remain true throughout development.

### Invariant 1

Controllers do not contain business workflows.

### Invariant 2

Domain objects protect their own invariants.

### Invariant 3

Application services orchestrate use cases.

### Invariant 4

Repositories hide persistence implementation.

### Invariant 5

External providers are accessed through ports/adapters.

### Invariant 6

Modules do not directly access another module's infrastructure.

### Invariant 7

Critical operations are idempotent.

### Invariant 8

State transitions are explicit.

### Invariant 9

PostgreSQL remains the source of truth for transactional data.

### Invariant 10

Asynchronous processing must not silently lose important business events.

---

# 79. Final Architecture Decision

The application layer for the Karigar Marketplace will follow:

```text
Business Operation
       ↓
Use Case
       ↓
Application Service
       ↓
Domain Model / Domain Service
       ↓
Repository / External Port
       ↓
Infrastructure Adapter
```

The architecture intentionally avoids:

```text
Controller
   ↓
God Service
   ↓
Everything
```

and also avoids premature complexity such as:

```text
Microservices
CQRS everywhere
Event sourcing
Kafka for every operation
Distributed transactions
```

The first implementation should remain understandable to one engineer while still enforcing production-grade boundaries.

---

# 80. Conclusion

At this point, the project architecture has now been defined from:

```text
Product
   ↓
Requirements
   ↓
Business Rules
   ↓
Domain
   ↓
Database
   ↓
API
   ↓
Application Use Cases
```

The next major step is to define the **actual domain objects and their state machines in code-level detail**.

That document should answer questions such as:

```text
What exactly is a Worker?
What exactly is a ServiceRequest?
What makes a Booking valid?
What states can a Job enter?
Who owns each entity?
Which fields are immutable?
Which operations belong to each aggregate?
What are the domain invariants?
What events are generated?
```

Therefore the next document is:

# [architecture/04](../../architecture/04-domain-model-aggregates-and-state-machines.md) — Domain Model, Aggregates & State Machines

It will define the actual domain behavior for:

* User
* Customer
* Worker
* Skill
* Verification
* Service Request
* Worker Match
* Booking
* Job
* Additional Work
* Payment
* Refund
* Review
* Dispute
* Notification
* Audit Event

including their **state machines, aggregate boundaries, invariants, commands, events, and ownership rules**.
