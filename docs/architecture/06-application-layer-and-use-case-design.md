# Application Layer & Use-Case Design

**Project:** Karigar Marketplace
**Status:** Draft for Engineering Review
**Architecture:** Modular Monolith
**Backend:** Java + Spring Boot
**Database:** PostgreSQL + PostGIS
**Primary Goal:** Define how business use cases are executed between REST APIs and the domain model

---

# 1. Purpose

[architecture/05](05-java-domain-model-and-class-design.md) defined the Java domain model.

We now need to answer:

> When a user performs an action, which application component handles it, what does it load, what business operation does it execute, what gets persisted, and what events are produced?

For example:

```text
Customer clicks "Request Service"
             ↓
HTTP request
             ↓
Controller
             ↓
Application Use Case
             ↓
Domain Model
             ↓
Repository
             ↓
Database
             ↓
Domain Event
             ↓
Async processing
```

This document defines that layer.

---

# 2. What Is the Application Layer?

The application layer coordinates business use cases.

It sits between:

```text
API
```

and:

```text
Domain
```

Its responsibility is **orchestration**, not owning all business rules.

A useful mental model:

```text
Domain:
    "What is allowed?"

Application:
    "What steps do we perform?"

Infrastructure:
    "How do we communicate with external systems?"
```

---

# 3. Example

Suppose a worker wants to accept a job.

The controller should not do:

```java
booking.setStatus(CONFIRMED);
```

Instead:

```text
Worker
  ↓
POST /matches/{id}/accept
  ↓
AcceptMatchController
  ↓
AcceptMatchUseCase
  ↓
Load Match
  ↓
Authorize Worker
  ↓
match.accept()
  ↓
Persist
  ↓
Publish event
```

The domain determines whether:

```text
OFFERED → ACCEPTED
```

is legal.

The application layer coordinates the operation.

---

# 4. Application Layer Responsibilities

The application layer handles:

```text
1. Use-case orchestration
2. Transaction boundaries
3. Loading aggregates
4. Calling domain behavior
5. Authorization coordination
6. Repository interaction
7. External port interaction
8. Domain event publication
9. Idempotency coordination
10. Mapping results to application outputs
```

It should not become:

```text
"the place where all business logic goes."
```

---

# 5. Application Layer Structure

Each module follows:

```text
application/
├── command/
├── query/
├── service/
└── port/
    ├── in/
    └── out/
```

Example:

```text
service-request/
└── application/
    ├── command/
    │   ├── CreateServiceRequestCommand.java
    │   ├── CancelServiceRequestCommand.java
    │   └── SubmitServiceRequestCommand.java
    │
    ├── query/
    │   ├── GetServiceRequestQuery.java
    │   └── ListCustomerRequestsQuery.java
    │
    ├── service/
    │   ├── CreateServiceRequestService.java
    │   ├── SubmitServiceRequestService.java
    │   └── CancelServiceRequestService.java
    │
    └── port/
        ├── in/
        └── out/
```

---

# 6. Command

A command represents an instruction to change system state.

Example:

```java
public record CreateServiceRequestCommand(
    UUID customerId,
    UUID professionId,
    String description,
    UUID addressId,          // saved address; location and contact are snapshotted from it
    Instant scheduledAt,
    Urgency urgency
) {}
```

Commands should describe intent.

Good:

```text
CreateServiceRequest
CancelBooking
CompleteJob
AcceptMatch
```

Avoid:

```text
UpdateServiceRequestStatus
SetBookingStatus
ChangeJobStatus
```

because these expose implementation rather than business intent.

---

# 7. Query

A query retrieves information without changing business state.

Example:

```java
public record GetWorkerProfileQuery(
    UUID workerId
) {}
```

Another:

```java
public record SearchAvailableWorkersQuery(
    UUID professionId,
    GeoPoint location,
    double radiusMeters
) {}
```

Queries should normally avoid modifying domain state.

---

# 8. Command vs Query

| Operation              | Type    |
| ---------------------- | ------- |
| Create service request | Command |
| Submit request         | Command |
| Search workers         | Query   |
| Accept match           | Command |
| Get worker profile     | Query   |
| Confirm booking        | Command |
| Get booking            | Query   |
| Complete job           | Command |
| Get job                | Query   |
| Create review          | Command |
| Get reviews            | Query   |
| Open dispute           | Command |
| Get dispute            | Query   |

---

# 9. Input Port

The application layer can expose use cases through interfaces.

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
public class CreateServiceRequestService
        implements CreateServiceRequestUseCase {

    @Override
    public ServiceRequestResult execute(
        CreateServiceRequestCommand command
    ) {

        // orchestration
    }
}
```

This gives us:

```text
Controller
    ↓
CreateServiceRequestUseCase
    ↓
CreateServiceRequestService
```

---

# 10. Output Port

Application services may depend on ports for infrastructure.

Example:

```java
public interface PaymentGateway {

    PaymentResult createPayment(
        PaymentRequest request
    );
}
```

Another:

```java
public interface NotificationGateway {

    void send(NotificationMessage message);
}
```

Another:

```java
public interface StorageGateway {

    StoredFile store(
        FileUpload file
    );
}
```

The application/domain side defines what it needs.

Infrastructure implements it.

---

# 11. Repository Port

Example:

```java
public interface ServiceRequestRepository {

    Optional<ServiceRequest> findById(
        UUID serviceRequestId
    );

    ServiceRequest save(
        ServiceRequest request
    );
}
```

Application code depends on this abstraction.

It does not depend directly on:

```text
JpaRepository
EntityManager
Hibernate
SQL
```

---

# 12. Transaction Boundary

A major responsibility of the application layer is defining transaction boundaries.

For example:

```java
@Transactional
public BookingResult confirm(...) {
    ...
}
```

Conceptually:

```text
BEGIN TRANSACTION

Load Booking
Load ServiceRequest
Validate authorization
Execute domain operation
Save changes
Store domain events/outbox

COMMIT
```

The transaction should normally represent one coherent business operation.

---

# 13. Transaction Rule

Do not create transactions around arbitrary controller methods simply because they are HTTP endpoints.

Instead, define transactions around application use cases.

Example:

```text
ConfirmBooking
```

is a transaction.

```text
GET Worker Profile
```

usually does not need a write transaction.

---

# 14. Create Service Request Use Case

Flow:

```text
Customer
   ↓
CreateServiceRequest
   ↓
Validate customer
   ↓
Validate profession
   ↓
Create ServiceRequest
   ↓
Save
   ↓
Return request ID
```

Implementation concept:

```java
@Transactional
public ServiceRequestResult execute(
    CreateServiceRequestCommand command
) {

    Customer customer =
        customerRepository.findById(command.customerId())
            .orElseThrow(CustomerNotFoundException::new);

    Profession profession =
        professionRepository.findActiveById(
            command.professionId()
        ).orElseThrow(ProfessionNotFoundException::new);

    ServiceRequest request =
        ServiceRequest.create(
            customer.id(),
            profession.id(),
            command.description(),
            command.location(),
            command.addressText(),
            command.scheduledAt(),
            command.urgency()
        );

    requestRepository.save(request);

    return ServiceRequestResult.from(request);
}
```

Notice:

The service coordinates.

The domain object creates and validates its own state.

---

# 15. Submit Service Request

Creating a draft and submitting it should remain separate if the product supports drafts.

Flow:

```text
DRAFT
  ↓
submit()
  ↓
SUBMITTED
```

Application service:

```text
Load request
   ↓
Authorize customer
   ↓
request.submit()
   ↓
Save
   ↓
ServiceRequestSubmitted
```

---

# 16. Start Matching

This is where multiple modules interact.

Flow:

```text
ServiceRequestSubmitted
             ↓
StartMatching
             ↓
Find eligible workers
             ↓
Rank candidates
             ↓
Create WorkerMatch
             ↓
Notify workers
```

Potential application service:

```java
@Service
public class StartMatchingService {

    private final WorkerSearchPort workerSearch;
    private final MatchingPolicy matchingPolicy;
    private final WorkerMatchRepository matchRepository;

    ...
}
```

---

# 17. Matching Ports

The matching module should not directly know the details of PostGIS.

Instead:

```java
public interface WorkerCandidateSearch {

    List<WorkerCandidate> findCandidates(
        MatchingCriteria criteria
    );
}
```

Infrastructure implementation:

```text
PostgisWorkerCandidateSearch
```

The name can be refined later.

---

# 18. Matching Criteria

Example:

```java
public record MatchingCriteria(
    UUID professionId,
    Set<SkillId> requiredSkills,
    GeoPoint location,
    double radiusMeters,
    Instant scheduledAt
) {}
```

This becomes the input to candidate discovery.

---

# 19. Matching Pipeline

The first implementation can be:

```text
Service Request
      ↓
Profession filter
      ↓
Skill filter
      ↓
Service area filter
      ↓
Availability filter
      ↓
Verification filter
      ↓
Distance
      ↓
Ranking
      ↓
Worker Matches
```

This is deliberately explainable.

---

# 20. Accept Match

Worker accepts an offered match.

```text
POST /matches/{id}/accept
```

Application flow:

```text
Load Match
      ↓
Authorize worker
      ↓
Check request still eligible
      ↓
match.accept()
      ↓
Confirm booking
      ↓
Persist
      ↓
Publish events
```

However, this operation requires special concurrency handling.

---

# 21. Concurrent Match Acceptance

Consider:

```text
Worker A ─── accept ──┐
                      ├── Service Request
Worker B ─── accept ──┘
```

Only one should become the confirmed worker.

Application layer:

```text
Transaction
+
Lock/optimistic concurrency
+
Database unique constraint
+
Domain state validation
```

must work together.

---

# 22. Confirm Booking

Potential flow:

```text
AcceptMatch
    ↓
Load Match
    ↓
Load ServiceRequest
    ↓
Verify request is bookable
    ↓
match.accept()
    ↓
Create Booking
    ↓
request.book()
    ↓
Save
    ↓
Publish BookingConfirmed
```

The exact workflow will depend on the final marketplace UX.

---

# 23. Booking Cancellation

Command:

```java
public record CancelBookingCommand(
    UUID bookingId,
    UUID actorId,
    CancellationReason reason
) {}
```

The application layer determines:

```text
Who is acting?
Is the actor allowed?
What resources must be loaded?
```

Then:

```java
booking.cancel(command.reason());
```

The domain determines whether cancellation is valid.

---

# 24. Job Lifecycle Use Cases

Each important transition gets an explicit use case.

```text
MarkJobEnRoute
MarkJobArrived
StartJob
CompleteJob
ReportWorkerNoShow
ReportCustomerNoShow
CancelJob
```

Avoid:

```text
UpdateJobStatus
```

because it allows arbitrary transitions.

---

# 25. Mark Job En Route

```text
Worker
 ↓
MarkJobEnRouteCommand
 ↓
Load Job
 ↓
Authorize Worker
 ↓
job.markEnRoute()
 ↓
Save
 ↓
JobEnRouteEvent
```

---

# 26. Complete Job

```text
Worker
 ↓
CompleteJobCommand
 ↓
Load Job
 ↓
Authorize Worker
 ↓
job.complete()
 ↓
Save
 ↓
JobCompletedEvent
```

After the transaction:

```text
JobCompleted
   ├── Payment workflow
   ├── Review eligibility
   ├── Notification
   └── Worker earnings
```

These should not all be tightly coupled to `CompleteJobService`.

---

# 27. Additional Work

Worker proposes additional work.

```text
ProposeAdditionalWork
```

Flow:

```text
Load Job
 ↓
Authorize Worker
 ↓
Validate job state
 ↓
Create AdditionalWork
 ↓
Save
 ↓
Notify Customer
```

Customer:

```text
ApproveAdditionalWork
```

Flow:

```text
Load AdditionalWork
 ↓
Authorize Customer
 ↓
additionalWork.approve()
 ↓
Save
 ↓
Publish event
```

---

# 28. Payment Use Cases

Payment should have explicit operations:

```text
CreatePayment
ProcessPaymentWebhook
RefundPayment
ProcessRefundWebhook
```

Avoid a generic:

```text
UpdatePayment
```

---

# 29. Create Payment

Flow:

```text
Customer
 ↓
CreatePayment
 ↓
Load Job
 ↓
Validate payment eligibility
 ↓
Create Payment aggregate
 ↓
Call PaymentGateway
 ↓
Persist provider reference
 ↓
Return payment information
```

Important:

External provider interaction introduces failure possibilities.

We therefore need idempotency and careful transaction design.

---

# 30. Payment Webhook

Webhook flow:

```text
Payment Provider
       ↓
Webhook Controller
       ↓
Verify Signature
       ↓
ProcessPaymentWebhook
       ↓
Check Provider Event ID
       ↓
Load Payment
       ↓
Apply Valid State Transition
       ↓
Save
       ↓
Publish PaymentSucceeded
```

Webhook processing must be idempotent.

---

# 31. Review Creation

Command:

```java
public record CreateReviewCommand(
    UUID jobId,
    UUID reviewerId,
    int rating,
    String comment
) {}
```

Application service:

```text
Load Job
 ↓
Check job completed
 ↓
Check reviewer participated
 ↓
Check review not already submitted
 ↓
Create Review
 ↓
Save
 ↓
Publish ReviewCreated
```

The review itself validates:

```text
rating 1–5
```

---

# 32. Dispute Creation

Flow:

```text
Customer/Worker
       ↓
OpenDispute
       ↓
Load Job
       ↓
Check participant
       ↓
Check dispute eligibility
       ↓
Create Dispute
       ↓
Save
       ↓
Notify other party/admin
```

---

# 33. Dispute Resolution

Admin operation:

```text
ResolveDispute
```

Flow:

```text
Admin
 ↓
Load Dispute
 ↓
Authorize admin
 ↓
Load evidence
 ↓
Resolve dispute
 ↓
Save resolution
 ↓
Publish DisputeResolved
```

The actual resolution policy should remain explicit rather than hidden inside infrastructure code.

---

# 34. Authorization in Application Layer

Authentication answers:

```text
Who are you?
```

Authorization answers:

```text
What are you allowed to do?
```

Example:

```text
Worker A
    ↓
Complete Job 123
```

Application service must verify:

```text
Job 123.workerId == Worker A.id
```

before calling:

```java
job.complete();
```

---

# 35. Resource Authorization

Examples:

### Customer

Can access:

```text
their own requests
their own bookings
their own payments
their own addresses
```

### Worker

Can access:

```text
their own profile
their own matches
their own jobs
their own earnings
```

### Admin

Can access according to administrative permissions.

Authorization should not rely only on frontend restrictions.

---

# 36. Application Service Naming

Prefer business language.

Good:

```text
CreateServiceRequestService
SubmitServiceRequestService
AcceptMatchService
ConfirmBookingService
CompleteJobService
CreatePaymentService
OpenDisputeService
```

Avoid:

```text
GenericService
CommonService
DataService
BaseService
Manager
Processor
Helper
```

unless the name genuinely represents the responsibility.

---

# 37. Use-Case Granularity

Do not create a service for every line of code.

Bad:

```text
ValidateWorkerService
LoadWorkerService
CheckWorkerStatusService
SaveWorkerService
```

These aren't necessarily meaningful application use cases.

Prefer:

```text
UpdateWorkerProfileService
```

which internally performs the necessary steps.

---

# 38. Queries

Queries may be optimized differently from commands.

Example:

```text
GetWorkerProfile
```

might query:

```text
workers
professions
skills
verification
reviews
```

and return a projection.

It does not necessarily need to load a complete Worker aggregate.

---

# 39. Query DTO

Example:

```java
public record WorkerProfileView(
    UUID workerId,
    String name,
    String profession,
    int experienceYears,
    boolean verified,
    boolean acceptingJobs,
    double averageRating,
    long completedJobs
) {}
```

This is a read model.

It is not the Worker domain entity.

---

# 40. Query Repository

A query repository can be separate from the domain repository.

Example:

```java
public interface WorkerQueryRepository {

    Optional<WorkerProfileView> findProfile(
        UUID workerId
    );

    List<WorkerSummaryView> searchWorkers(
        WorkerSearchCriteria criteria
    );
}
```

This allows efficient SQL projections.

---

# 41. Do Not Force CQRS Everywhere

We are separating command/query responsibilities conceptually.

That does **not** mean:

```text
two databases
two applications
event sourcing
Kafka
separate read/write services
```

are required.

For the MVP:

```text
One PostgreSQL database
One Spring Boot application
Separate application services
Optimized query repositories where useful
```

is sufficient.

---

# 42. Application Events

Application services may publish events after successful state changes.

Example:

```java
eventPublisher.publish(
    new JobCompletedEvent(...)
);
```

But the event should represent a completed business action.

---

# 43. Event Handling

Example:

```text
JobCompleted
      │
      ├──► NotificationHandler
      │
      ├──► ReviewEligibilityHandler
      │
      └──► PaymentHandler
```

Initially these can be Spring application event listeners.

Later:

```text
Outbox
 ↓
Message Broker
```

can be introduced if required.

---

# 44. Critical vs Non-Critical Work

A useful distinction:

### Critical

Must succeed as part of the transaction:

```text
booking confirmation
payment state update
job state transition
review creation
```

### Non-critical

Can happen asynchronously:

```text
push notification
SMS
email
analytics
search indexing
```

A notification failure should generally not cause:

```text
Job completion
```

to fail.

---

# 45. External API Calls

Be careful with:

```text
DB transaction
      +
slow external HTTP request
```

For example:

```text
BEGIN
 ↓
update database
 ↓
call payment provider
 ↓
wait 5 seconds
 ↓
COMMIT
```

This can create long transactions.

The exact payment flow should therefore be designed around provider semantics and idempotency.

---

# 46. Idempotency

Command APIs that can be retried should support idempotency.

Example:

```http
Idempotency-Key: 6b4f...
```

Potential operations:

```text
CreatePayment
ConfirmBooking
AcceptMatch
CompleteJob
RefundPayment
```

The application layer should coordinate idempotency handling.

---

# 47. Idempotency Flow

```text
Request
 ↓
Idempotency Store
 ↓
Already processed?
 ├── YES → return previous result
 │
 └── NO
       ↓
   Execute use case
       ↓
   Store result
       ↓
   Return result
```

Redis may be used for some short-lived idempotency cases, but critical durable operations should have an appropriate persistent strategy.

---

# 48. Retry Safety

A request may be retried because of:

```text
mobile network failure
timeout
reverse proxy retry
client retry
provider retry
```

Therefore:

```text
retry ≠ duplicate business operation
```

The system must be designed accordingly.

---

# 49. Application Result

Application services should return explicit results.

Example:

```java
public record CreateServiceRequestResult(
    UUID serviceRequestId,
    ServiceRequestStatus status
) {}
```

Do not return JPA entities.

---

# 50. Error Handling

Application services can throw domain/application exceptions:

```text
CustomerNotFoundException
WorkerNotFoundException
BookingNotFoundException
UnauthorizedOperationException
BookingAlreadyConfirmedException
InvalidJobStateException
PaymentAlreadyProcessedException
```

The API layer maps them into HTTP responses.

Example:

```text
BOOKING_ALREADY_CONFIRMED
```

rather than leaking:

```text
HibernateException
```

---

# 51. Application Error Categories

We should distinguish:

```text
Validation Error
Authorization Error
Resource Not Found
Business Rule Violation
Concurrency Conflict
External Provider Failure
Infrastructure Failure
```

This will become important in [api/01](../api/01-rest-api-contract-endpoints-and-error-model.md)'s API/error contract refinement.

---

# 52. Example Full Use Case

## Complete Job

```text
HTTP
 ↓
POST /jobs/{id}/complete
 ↓
Controller
 ↓
CompleteJobCommand
 ↓
CompleteJobService
 ↓
Load Job
 ↓
Authorize Worker
 ↓
job.complete()
 ↓
Repository.save()
 ↓
Commit
 ↓
JobCompletedEvent
 ↓
Async consumers
```

This is the pattern we want throughout the application.

---

# 53. Use-Case Catalogue

The initial application layer should contain approximately:

## Identity

```text
RequestOtp
VerifyOtp
RefreshToken
Logout
GetCurrentUser
UpdateCurrentUser
```

## Customer

```text
UpdateCustomerProfile
AddAddress
UpdateAddress
DeleteAddress
```

## Worker

```text
CreateWorkerProfile
UpdateWorkerProfile
UpdateWorkerSkills
EnableJobAcceptance
DisableJobAcceptance
SubmitVerification
```

## Service Request

```text
CreateServiceRequest
SubmitServiceRequest
CancelServiceRequest
GetServiceRequest
ListCustomerServiceRequests
```

## Matching

```text
StartMatching
AcceptMatch
RejectMatch
ExpireMatch
GetRequestMatches
```

## Booking

```text
CreateBooking
ConfirmBooking
CancelBooking
RescheduleBooking
GetBooking
```

## Job

```text
MarkJobEnRoute
MarkJobArrived
StartJob
CompleteJob
ReportWorkerNoShow
ReportCustomerNoShow
CancelJob
```

## Additional Work

```text
ProposeAdditionalWork
ApproveAdditionalWork
RejectAdditionalWork
```

## Payment

```text
CreatePayment
ProcessPaymentWebhook
RequestRefund
ProcessRefundWebhook
```

## Review

```text
CreateReview
GetWorkerReviews
```

## Dispute

```text
OpenDispute
AddDisputeEvidence
StartDisputeReview
ResolveDispute
```

## Admin

```text
VerifyWorker
RejectWorkerVerification
SuspendWorker
ReactivateWorker
ReviewDispute
```

---

# 54. Use-Case Naming Convention

Use:

```text
Verb + Noun
```

Examples:

```text
CreateWorker
UpdateWorkerProfile
AcceptMatch
ConfirmBooking
CompleteJob
CreatePayment
OpenDispute
```

Avoid:

```text
WorkerHandler
BookingManager
PaymentProcessor
WorkerOperations
```

unless those components genuinely represent those broader responsibilities.

---

# 55. Controller Responsibility

Controller should be extremely thin.

Example:

```java
@PostMapping
public ResponseEntity<ServiceRequestResponse> create(
    @Valid @RequestBody CreateServiceRequestRequest request
) {

    CreateServiceRequestCommand command =
        mapper.toCommand(
            currentUser.id(),
            request
        );

    var result =
        createServiceRequestUseCase.execute(command);

    return ResponseEntity
        .status(HttpStatus.CREATED)
        .body(mapper.toResponse(result));
}
```

The controller should not:

```text
query database
calculate matching
change entity status
call Stripe
send SMS
```

---

# 56. Application Service Responsibility Boundary

A good application service should answer:

```text
What use case is happening?
What aggregates are needed?
Who is performing it?
What domain operation should execute?
What needs to be persisted?
What events should be emitted?
```

It should not become a 1,500-line class.

If it becomes too large, split the use case.

---

# 57. Domain Service vs Application Service

These are different.

### Application Service

Coordinates:

```text
repositories
aggregates
ports
transactions
events
```

### Domain Service

Contains domain logic that does not naturally belong to one entity.

Example:

```java
public final class WorkerEligibilityPolicy {

    public boolean isEligible(
        Worker worker,
        ServiceRequest request
    ) {
        ...
    }
}
```

This is domain logic.

---

# 58. Example Domain Policy

```java
public interface WorkerEligibilityPolicy {

    boolean isEligible(
        Worker worker,
        ServiceRequest request
    );
}
```

Potential checks:

```text
worker active
profession compatible
required skill available
verification sufficient
service area compatible
availability compatible
```

Some of these checks may require repositories, in which case the application layer assembles the necessary information and passes it into the domain policy.

---

# 59. Avoid Hidden Database Queries in Domain Objects

Bad:

```java
worker.canAccept(request);
```

where internally Worker somehow queries:

```text
database
Redis
maps API
```

Domain objects should not perform hidden I/O.

Prefer:

```text
Application
    ↓
Load required information
    ↓
Domain Policy
    ↓
Decision
```

---

# 60. Time Handling

Do not scatter:

```java
Instant.now()
```

through complex domain logic.

Prefer:

```java
Clock clock;
```

in application services.

Example:

```java
Instant now = clock.instant();

job.complete(now);
```

Then tests can use:

```java
Clock.fixed(...)
```

This makes time-dependent behavior deterministic.

---

# 61. Transaction and Event Ordering

We must avoid:

```text
Save DB
 ↓
Publish event
 ↓
DB rollback
```

because consumers may believe something happened when the transaction actually failed.

The safer future design is:

```text
DB Transaction
 ├── Business state
 └── Outbox event
        ↓
     Commit
        ↓
Outbox publisher
        ↓
Consumers
```

This is why the Outbox pattern remains part of the architecture roadmap.

---

# 62. Application Layer and Module Boundaries

Example:

```text
service-request
     ↓
matching
```

A service request module should not directly manipulate:

```text
WorkerJpaEntity
```

Instead:

```text
ServiceRequest
     ↓
ServiceRequestSubmittedEvent
     ↓
Matching Application Handler
```

This preserves module boundaries.

---

# 63. Cross-Module Example

When a request is submitted:

```text
Service Request Module
        │
        │ ServiceRequestSubmitted
        ▼
Matching Module
        │
        ├── find candidates
        ├── create matches
        └── notify workers
```

The Service Request module does not need to know the internal implementation of Matching.

---

# 64. One Use Case, One Transaction

As a default:

```text
One application command
        ↓
One transaction
```

However, external workflows may span multiple transactions.

Example:

```text
Create payment
     ↓
Payment provider
     ↓
Webhook later
     ↓
Payment success
```

This is not one database transaction.

It is a distributed workflow.

---

# 65. Distributed Workflow Mindset

Even though we are building a modular monolith, we already interact with external systems.

Therefore we must understand:

```text
success
failure
timeout
retry
duplicate
partial success
eventual consistency
```

This is much more important than simply knowing how to write controllers.

---

# 66. Application Layer Testing

Each use case should have tests.

Example:

```text
CreateServiceRequestServiceTest
SubmitServiceRequestServiceTest
AcceptMatchServiceTest
ConfirmBookingServiceTest
CompleteJobServiceTest
CreatePaymentServiceTest
ProcessPaymentWebhookServiceTest
CreateReviewServiceTest
OpenDisputeServiceTest
```

Tests should verify orchestration and authorization.

---

# 67. Domain vs Application Tests

### Domain test

Tests:

```text
booking.confirm()
```

without Spring.

### Application test

Tests:

```text
ConfirmBookingService
```

with repository mocks/fakes or integration infrastructure.

### Integration test

Tests:

```text
Application
+
PostgreSQL
+
PostGIS
```

### API test

Tests:

```text
HTTP
+
Security
+
Validation
+
Application
```

All four levels have different purposes.

---

# 68. Test Pyramid

Initial target:

```text
                 E2E
                /   \
           API/Integration
              /     \
        Application Tests
            /       \
       Domain Unit Tests
```

Most business-rule tests should be fast domain tests.

---

# 69. Observability

Application services should provide useful operational information.

For example:

```text
requestId
userId
useCase
resourceId
duration
result
failure reason
```

Avoid logging sensitive information such as:

```text
OTP
payment secrets
identity documents
private credentials
```

---

# 70. Application Layer Logging

Good:

```text
CompleteJob succeeded
jobId=...
workerId=...
duration=...
```

Bad:

```text
Customer OTP = 834291
```

or full sensitive payment payloads.

---

# 71. Application Layer Security

Every command should ask:

```text
Who is performing this action?
```

Not every caller-provided ID should be trusted.

For example:

```http
POST /jobs/123/complete
```

should derive worker identity from the authenticated principal, not:

```json
{
  "workerId": "some-other-worker"
}
```

The server determines identity.

---

# 72. Avoid Trusting Client State

Never rely on:

```text
frontend says worker is verified
frontend says payment succeeded
frontend says job is completed
frontend says user owns resource
```

The backend must determine authoritative state.

---

# 73. Application Layer Dependency Rules

Allowed:

```text
Application
 ├── Domain
 ├── Repository Ports
 ├── External Ports
 └── Application DTOs
```

Avoid:

```text
Application
 ├── Controller
 ├── JPA Entity
 ├── Stripe SDK
 ├── Redis implementation
 └── PostgreSQL-specific code
```

Those belong elsewhere.

---

# 74. Final Use-Case Architecture

The resulting structure is:

```text
                         REST
                           │
                           ▼
                    ┌─────────────┐
                    │ Controller  │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Input Port  │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Application │
                    │   Service   │
                    └──────┬──────┘
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
        Repository      Domain        Port
           Port          Model      External API
             │             │             │
             ▼             ▼             ▼
       PostgreSQL      Business       Provider
                       Rules
```

---

# 75. End-to-End Example

The core marketplace flow now becomes:

```text
CUSTOMER
   │
   │ Create request
   ▼
CreateServiceRequest
   │
   ▼
ServiceRequest
   │
   │ submit
   ▼
ServiceRequestSubmitted
   │
   ▼
MATCHING
   │
   ├── find workers
   ├── rank workers
   └── create matches
   │
   ▼
WORKER
   │
   │ accept
   ▼
AcceptMatch
   │
   ▼
Booking
   │
   ▼
Job
   │
   ├── EN_ROUTE
   ├── ARRIVED
   ├── WORK_STARTED
   └── WORK_COMPLETED
   │
   ▼
Payment
   │
   ▼
Review
   │
   ▼
Reputation
```

This is the central application workflow.

---

# 76. What We Have Completed

The architecture is now becoming progressively more concrete:

```text
01  Product Scope & Vision
02  User Roles & User Journeys
03  Functional Requirements & Business Rules
06  System Architecture
07  Project Directory & Package Structure
09  ERD & Database Design
12  Domain Model & State Machines
13  Java Domain Model & Class Design
14  Application Layer & Use-Case Design
```

We now have:

```text
WHAT the product does
        ↓
WHAT rules govern it
        ↓
WHAT entities exist
        ↓
WHAT states exist
        ↓
WHAT Java classes represent them
        ↓
HOW use cases execute them
```

---

# 77. Next Document

The next major document should connect the application layer to the external world:

# [api/01](../api/01-rest-api-contract-endpoints-and-error-model.md) — REST API Contract, Endpoint Design & Error Model

It will define:

```text
API versioning
Authentication
Authorization
HTTP methods
Endpoints
Request DTOs
Response DTOs
Error codes
HTTP status codes
Pagination
Filtering
Sorting
Idempotency
Validation
Resource ownership
State-transition endpoints
Webhooks
API examples
OpenAPI structure
Backward compatibility
```

After that, we can move into:

```text
16 — Authentication & Authorization Design
17 — Matching Engine Design
18 — Payment & Financial Workflow Design
19 — Notification & Event Architecture
20 — Caching & Redis Design
21 — Async Processing & Outbox
22 — Observability & Production Operations
23 — Testing Strategy
24 — Security Design
25 — Deployment & Infrastructure
26 — CI/CD
27 — Production Readiness Checklist
```

Only after these design documents are sufficiently stable should we start implementing the Spring Boot project.
