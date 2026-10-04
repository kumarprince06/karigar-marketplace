# REST API Specification & Contract Design

**Project:** Karigar Marketplace
**Status:** Draft for Product/Engineering Review
**Architecture:** Java + Spring Boot Modular Monolith
**API Style:** REST
**API Version:** v1
**Primary Consumers:** Customer App, Worker App, Admin Portal

---

## 1. Purpose

This document defines the external API contract of the Karigar Marketplace.

The API is the boundary between:

* Customer applications
* Worker applications
* Admin portal
* Backend business logic
* Payment providers
* Notification providers
* Future third-party integrations

The API must expose **business capabilities**, not database tables.

The design principle is:

> An API should represent what the user or business is trying to do, not simply expose CRUD operations for every database entity.

For example:

```text
POST /workers/{id}/update-status
```

is less meaningful than:

```text
POST /workers/me/availability
```

And:

```text
PUT /bookings/{id}
```

should not be used to arbitrarily modify booking state.

Instead:

```text
POST /bookings/{id}/confirm
POST /bookings/{id}/cancel
POST /bookings/{id}/reschedule
```

make the allowed business operations explicit.

---

# 2. API Design Principles

The API follows these principles:

1. RESTful resource naming
2. Explicit business actions for state transitions
3. Versioned APIs
4. Consistent response structures
5. Consistent error structures
6. Resource-level authorization
7. Idempotency for critical commands
8. Pagination for collections
9. No unbounded collection responses
10. Stable public identifiers
11. No database entities exposed directly
12. DTOs at the API boundary
13. UTC timestamps
14. Explicit validation
15. Backward compatibility
16. Traceability through request IDs
17. Rate limiting
18. Secure file upload handling

---

# 3. Base URL

Initial API:

```text
/api/v1
```

Example:

```text
POST /api/v1/service-requests
```

Production domain might eventually be:

```text
https://api.example.com/api/v1
```

The actual production domain is an open decision.

---

# 4. API Versioning

The initial strategy is URL-based versioning:

```text
/api/v1/...
```

Example:

```text
/api/v1/workers/me
/api/v1/service-requests
/api/v1/bookings/{id}
```

A breaking API change would introduce:

```text
/api/v2/...
```

Non-breaking additions should normally remain in the existing version.

Examples of generally non-breaking changes:

* adding an optional response field
* adding a new endpoint
* adding a new optional request field

Examples of potentially breaking changes:

* changing field types
* removing fields
* changing meanings
* changing required fields
* changing authentication behavior

---

# 5. Authentication Model

Initial authentication:

```text
Phone Number
      ↓
OTP Request
      ↓
OTP Verification
      ↓
Access Token
      ↓
API Requests
```

Endpoints:

```text
POST /api/v1/auth/otp/request
POST /api/v1/auth/otp/verify
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
```

Authentication should be implemented using Spring Security.

The API should not trust a client-provided:

```json
{
  "userId": "..."
}
```

to determine the authenticated user.

The authenticated principal comes from the validated access token.

---

# 6. Standard Request Headers

Authenticated requests:

```http
Authorization: Bearer <access-token>
Content-Type: application/json
Accept: application/json
X-Request-Id: <request-id>
```

For critical idempotent operations:

```http
Idempotency-Key: <unique-key>
```

Example:

```http
POST /api/v1/payments
Authorization: Bearer ey...
Idempotency-Key: 3e7c...
```

---

# 7. Request ID

Every request should have a request ID.

If the client sends:

```http
X-Request-Id: abc-123
```

the backend may retain it.

If not provided, the backend generates one.

The request ID should appear in:

* application logs
* error responses
* distributed tracing
* audit information where appropriate

Example:

```json
{
  "error": {
    "code": "BOOKING_ALREADY_CONFIRMED",
    "message": "This service request already has a confirmed booking.",
    "traceId": "abc-123"
  }
}
```

---

# 8. Standard Success Response

For resource responses:

```json
{
  "data": {
    "id": "019...",
    "status": "CONFIRMED"
  }
}
```

For collections:

```json
{
  "data": [
    {
      "id": "019...",
      "name": "Ramesh Kumar"
    }
  ],
  "meta": {
    "page": 0,
    "size": 20,
    "totalElements": 45,
    "totalPages": 3
  }
}
```

The exact pagination format may evolve toward cursor-based pagination for high-volume feeds.

---

# 9. Standard Error Response

All API errors should follow a predictable structure.

```json
{
  "error": {
    "code": "BOOKING_ALREADY_CONFIRMED",
    "message": "This service request already has a confirmed booking.",
    "details": {},
    "traceId": "abc-123"
  }
}
```

The client should primarily use:

```text
error.code
```

for programmatic handling.

The `message` is primarily human-readable.

---

# 10. Validation Error

Example:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "One or more fields are invalid.",
    "details": {
      "description": [
        "Description must contain at least 10 characters."
      ],
      "scheduledAt": [
        "Scheduled time must be in the future."
      ]
    },
    "traceId": "abc-123"
  }
}
```

This allows the mobile/web application to display field-specific errors.

---

# 11. Common HTTP Status Codes

| Status | Meaning                              |
| ------ | ------------------------------------ |
| 200    | Successful request                   |
| 201    | Resource created                     |
| 202    | Accepted for asynchronous processing |
| 204    | Successful request with no body      |
| 400    | Invalid request                      |
| 401    | Authentication required/invalid      |
| 403    | Authenticated but not authorized     |
| 404    | Resource not found                   |
| 409    | Business conflict                    |
| 422    | Validation/business rule failure     |
| 429    | Rate limit exceeded                  |
| 500    | Internal server error                |
| 502    | External provider failure            |
| 503    | Temporary service unavailable        |

---

# 12. Authentication APIs

## Request OTP

```http
POST /api/v1/auth/otp/request
```

Request:

```json
{
  "phone": "+919876543210"
}
```

Response:

```json
{
  "data": {
    "requestId": "019...",
    "expiresInSeconds": 300
  }
}
```

OTP itself must never be returned by the production API.

---

## Verify OTP

```http
POST /api/v1/auth/otp/verify
```

Request:

```json
{
  "requestId": "019...",
  "otp": "123456"
}
```

Response:

```json
{
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresIn": 3600,
    "user": {
      "id": "019...",
      "role": "CUSTOMER"
    }
  }
}
```

---

## Refresh Token

```http
POST /api/v1/auth/refresh
```

---

## Logout

```http
POST /api/v1/auth/logout
```

The backend should invalidate/revoke the refresh token according to the selected token strategy.

---

# 13. Current User APIs

```http
GET /api/v1/me
```

Returns the authenticated user's basic information.

Example:

```json
{
  "data": {
    "id": "019...",
    "phone": "+919876543210",
    "name": "Prince",
    "roles": [
      "CUSTOMER"
    ]
  }
}
```

Update profile:

```http
PATCH /api/v1/me
```

---

# 14. Customer Address APIs

List addresses:

```http
GET /api/v1/customer/addresses
```

Create:

```http
POST /api/v1/customer/addresses
```

Example:

```json
{
  "label": "Home",
  "addressText": "Shibpur, Howrah",
  "latitude": 22.58,
  "longitude": 88.31
}
```

Update:

```http
PATCH /api/v1/customer/addresses/{id}
```

Delete:

```http
DELETE /api/v1/customer/addresses/{id}
```

Set default:

```http
POST /api/v1/customer/addresses/{id}/set-default
```

The backend must verify that the address belongs to the authenticated customer.

---

# 15. Worker Registration

Initial worker creation:

```http
POST /api/v1/workers
```

Example:

```json
{
  "name": "Ramesh Kumar",
  "professionId": "019...",
  "experienceYears": 8,
  "description": "Residential electrical repair specialist"
}
```

The backend creates the worker profile associated with the authenticated user.

The API must not allow:

```json
{
  "userId": "some-other-user"
}
```

to create a worker profile for another user.

---

# 16. Worker Profile APIs

Current worker:

```http
GET /api/v1/workers/me
```

Update:

```http
PATCH /api/v1/workers/me
```

Public worker profile:

```http
GET /api/v1/workers/{workerId}
```

The public profile must expose only information that the business rules allow customers to see.

For example:

```json
{
  "data": {
    "id": "019...",
    "name": "Ramesh Kumar",
    "profession": "Electrician",
    "experienceYears": 8,
    "rating": 4.8,
    "completedJobs": 142,
    "verificationStatus": "VERIFIED"
  }
}
```

Sensitive information such as private documents, internal verification information, or unnecessary personal contact details must not be exposed.

---

# 17. Worker Skills APIs

Get skills:

```http
GET /api/v1/workers/me/skills
```

Replace/update skills:

```http
PUT /api/v1/workers/me/skills
```

Example:

```json
{
  "skillIds": [
    "019...",
    "019...",
    "019..."
  ]
}
```

The backend must validate that each skill exists and is applicable to the worker's profession.

---

# 18. Worker Availability

Get availability:

```http
GET /api/v1/workers/me/availability
```

Update:

```http
PATCH /api/v1/workers/me/availability
```

Example:

```json
{
  "acceptingJobs": true
}
```

Scheduled availability may eventually be represented separately.

Important distinction:

```text
Worker exists
        ≠
Worker is currently accepting jobs
```

---

# 19. Worker Verification

Submit verification:

```http
POST /api/v1/workers/me/verifications
```

Example:

```json
{
  "type": "IDENTITY",
  "documentType": "GOVERNMENT_ID",
  "documentReference": "..."
}
```

Verification information is sensitive and should have strict authorization.

Admin review:

```http
POST /api/v1/admin/workers/{workerId}/verifications/{verificationId}/approve
POST /api/v1/admin/workers/{workerId}/verifications/{verificationId}/reject
```

---

# 20. Catalog APIs

Professions:

```http
GET /api/v1/catalog/professions
```

Profession:

```http
GET /api/v1/catalog/professions/{id}
```

Skills:

```http
GET /api/v1/catalog/professions/{id}/skills
```

The initial catalog may contain:

```text
Electrician
Plumber
```

Additional categories can be introduced later without redesigning the API architecture.

---

# 21. Service Request APIs

Create request:

```http
POST /api/v1/service-requests
```

Example:

```json
{
  "professionId": "019...",
  "description": "Kitchen switchboard is not working.",
  "location": {
    "latitude": 22.58,
    "longitude": 88.31,
    "addressText": "Shibpur, Howrah"
  },
  "scheduledAt": "2026-10-01T15:00:00Z",
  "urgency": "NORMAL"
}
```

Response:

```json
{
  "data": {
    "id": "019...",
    "status": "SUBMITTED"
  }
}
```

---

# 22. Get Service Request

```http
GET /api/v1/service-requests/{id}
```

The response may contain:

* request information
* current status
* location summary
* scheduled time
* selected worker
* booking information
* job information
* payment status

depending on the user's authorization.

---

# 23. List Service Requests

```http
GET /api/v1/service-requests
```

Possible filters:

```text
status
profession
dateFrom
dateTo
```

Example:

```http
GET /api/v1/service-requests?status=COMPLETED&page=0&size=20
```

The backend must enforce ownership.

A customer must not be able to retrieve another customer's requests by manipulating query parameters.

---

# 24. Cancel Service Request

```http
POST /api/v1/service-requests/{id}/cancel
```

Request:

```json
{
  "reason": "NO_LONGER_REQUIRED"
}
```

The backend determines whether cancellation is allowed.

The client does not decide whether a state transition is legal.

---

# 25. Service Request Attachments

Upload:

```http
POST /api/v1/service-requests/{id}/attachments
```

The initial implementation may use multipart upload.

The backend should:

* validate file type
* validate file size
* generate safe storage keys
* scan where appropriate
* store metadata
* use object storage
* avoid storing large binary files directly in PostgreSQL

---

# 26. Matching APIs

Customer:

```http
GET /api/v1/service-requests/{id}/matches
```

Possible response:

```json
{
  "data": [
    {
      "matchId": "019...",
      "worker": {
        "id": "019...",
        "name": "Ramesh Kumar",
        "rating": 4.8,
        "completedJobs": 142,
        "experienceYears": 8
      },
      "distanceMeters": 850,
      "availability": "AVAILABLE"
    }
  ]
}
```

The matching engine determines candidate eligibility.

The API should not expose internal ranking formulas unnecessarily.

---

# 27. Worker Accepts Match

```http
POST /api/v1/matches/{id}/accept
```

The backend must verify:

* match belongs to worker
* match is still active
* worker is eligible
* request is still accepting matches
* worker is currently available
* request has not already been confirmed

Concurrency protection is mandatory.

Two workers may attempt to accept the same request at approximately the same time.

The backend must resolve this atomically.

---

# 28. Worker Rejects Match

```http
POST /api/v1/matches/{id}/reject
```

Request:

```json
{
  "reason": "TOO_FAR"
}
```

Worker rejection should not automatically be interpreted as poor worker performance.

---

# 29. Booking APIs

Get booking:

```http
GET /api/v1/bookings/{id}
```

Confirm:

```http
POST /api/v1/bookings/{id}/confirm
```

Cancel:

```http
POST /api/v1/bookings/{id}/cancel
```

Reschedule:

```http
POST /api/v1/bookings/{id}/reschedule
```

Example:

```json
{
  "scheduledAt": "2026-10-02T15:00:00Z"
}
```

The exact booking-confirmation flow remains a product decision.

The current working model is:

```text
Customer Request
       ↓
Matching
       ↓
Worker Accepts / Candidate Becomes Available
       ↓
Customer Selects/Confirms
       ↓
Booking Confirmed
```

This can be changed later without invalidating the rest of the API architecture.

---

# 30. Job APIs

A booking represents the commercial/service arrangement.

A job represents actual execution.

Worker lifecycle:

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

Endpoints:

```http
POST /api/v1/jobs/{id}/en-route
POST /api/v1/jobs/{id}/arrive
POST /api/v1/jobs/{id}/start
POST /api/v1/jobs/{id}/complete
```

Each endpoint performs the corresponding business transition.

---

# 31. No-Show

Customer or worker no-show should be represented explicitly.

Possible endpoint:

```http
POST /api/v1/jobs/{id}/no-show
```

Request:

```json
{
  "party": "CUSTOMER",
  "reason": "CUSTOMER_NOT_AVAILABLE"
}
```

The backend should determine:

* whether no-show is allowed at this point
* who is allowed to report it
* whether evidence is required
* whether cancellation/fees apply
* whether the job becomes eligible for dispute

These are business rules, not frontend decisions.

---

# 32. Additional Work

Worker proposes additional work:

```http
POST /api/v1/jobs/{id}/additional-work
```

Example:

```json
{
  "description": "Replacement of damaged switchboard",
  "amountMinor": 8500,
  "currency": "INR"
}
```

Customer approves:

```http
POST /api/v1/additional-work/{id}/approve
```

Customer rejects:

```http
POST /api/v1/additional-work/{id}/reject
```

The worker must not silently increase the final amount.

Customer authorization is required.

---

# 33. Payment APIs

Create payment:

```http
POST /api/v1/payments
```

Example:

```json
{
  "jobId": "019...",
  "amountMinor": 50000,
  "currency": "INR",
  "paymentMethod": "ONLINE"
}
```

For ₹500:

```text
amountMinor = 50000
currency = INR
```

The API should use integer minor units rather than floating-point monetary values.

---

# 34. Payment Status

```http
GET /api/v1/payments/{id}
```

Possible states:

```text
INITIATED
PENDING
SUCCESS
FAILED
REFUNDED
PARTIALLY_REFUNDED
```

Payment state is independent from job state.

A job being completed does not automatically mean a payment provider has successfully confirmed payment.

---

# 35. Payment Idempotency

Payment creation must support:

```http
Idempotency-Key: 7a5e...
```

If the client retries because of a network timeout, the backend must not create a second payment transaction.

Example:

```text
Request 1
    ↓
Payment created
    ↓
Network timeout
    ↓
Client retries same Idempotency-Key
    ↓
Backend returns original result
```

This is critical for financial operations.

---

# 36. Refund APIs

Possible administrative/system endpoint:

```http
POST /api/v1/payments/{id}/refund
```

Example:

```json
{
  "amountMinor": 50000,
  "reason": "CUSTOMER_DISPUTE_RESOLVED"
}
```

The system must verify:

```text
total refunded <= captured amount
```

Multiple refunds may be supported.

Refund history must not be overwritten.

---

# 37. Payment Webhooks

Payment providers communicate asynchronously through webhooks.

Example:

```http
POST /api/v1/webhooks/payments/{provider}
```

Possible providers:

```text
stripe
paystack
...
```

The webhook layer must:

1. Authenticate/verify provider signature
2. Validate event
3. Store provider event if required
4. Ensure idempotency
5. Update payment state
6. Publish internal event
7. Return successful response

Provider webhooks must not directly manipulate unrelated business modules.

---

# 38. Review APIs

Create review:

```http
POST /api/v1/jobs/{id}/reviews
```

Example:

```json
{
  "rating": 5,
  "comment": "Arrived on time and fixed the issue."
}
```

Rules:

* job must be eligible
* reviewer must belong to the job
* rating must be between 1 and 5
* duplicate reviews must be prevented

---

# 39. Worker Reviews

Public worker reviews:

```http
GET /api/v1/workers/{workerId}/reviews
```

Pagination is required.

Example:

```http
GET /api/v1/workers/{id}/reviews?page=0&size=20
```

The public API should not expose private moderation information.

---

# 40. Dispute APIs

Create:

```http
POST /api/v1/jobs/{id}/disputes
```

Example:

```json
{
  "type": "INCOMPLETE_WORK",
  "description": "The reported issue was not fully resolved."
}
```

Get:

```http
GET /api/v1/disputes/{id}
```

Add evidence:

```http
POST /api/v1/disputes/{id}/evidence
```

Possible evidence:

* photos
* documents
* payment information
* job-related information

---

# 41. Notification APIs

Customer/worker may retrieve notifications:

```http
GET /api/v1/notifications
```

Mark read:

```http
POST /api/v1/notifications/{id}/read
```

Mark all read:

```http
POST /api/v1/notifications/read-all
```

Notification delivery itself should be handled asynchronously.

A failed SMS should not cause a successful booking transaction to roll back.

---

# 42. Admin APIs

Admin endpoints should be isolated under:

```text
/api/v1/admin
```

Examples:

```http
GET /api/v1/admin/workers
GET /api/v1/admin/users
GET /api/v1/admin/service-requests
GET /api/v1/admin/bookings
GET /api/v1/admin/disputes
GET /api/v1/admin/payments
```

Worker suspension:

```http
POST /api/v1/admin/workers/{id}/suspend
```

Worker reactivation:

```http
POST /api/v1/admin/workers/{id}/reactivate
```

Dispute resolution:

```http
POST /api/v1/admin/disputes/{id}/resolve
```

Admin operations must be audited.

---

# 43. Generic CRUD Should Be Avoided

Avoid APIs such as:

```http
PUT /bookings/{id}
```

where the client can send:

```json
{
  "status": "COMPLETED",
  "workerId": "...",
  "paymentStatus": "SUCCESS"
}
```

This creates a serious security and business-rule problem.

Instead:

```http
POST /jobs/{id}/complete
```

The server controls:

* whether completion is legal
* who can perform it
* required state
* timestamps
* events
* payment implications
* notifications
* audit records

---

# 44. State Transition APIs

Business state changes should normally use explicit commands.

Examples:

```text
POST /matches/{id}/accept
POST /matches/{id}/reject

POST /bookings/{id}/confirm
POST /bookings/{id}/cancel

POST /jobs/{id}/en-route
POST /jobs/{id}/arrive
POST /jobs/{id}/start
POST /jobs/{id}/complete
POST /jobs/{id}/no-show

POST /additional-work/{id}/approve
POST /additional-work/{id}/reject
```

This makes business operations:

* discoverable
* auditable
* testable
* authorization-friendly
* easier to evolve

---

# 45. Authorization Model

Authorization must happen at two levels.

## Role authorization

Example:

```text
CUSTOMER
WORKER
ADMIN
```

A customer cannot call:

```text
POST /admin/workers/{id}/suspend
```

A worker cannot resolve a dispute as an administrator.

---

## Resource authorization

Role authorization alone is insufficient.

For example, two customers are both:

```text
CUSTOMER
```

Customer A must not access Customer B's service request.

Therefore:

```text
authenticated user
       ↓
role check
       ↓
resource ownership check
       ↓
business rule check
       ↓
operation
```

---

# 46. Location Privacy

Location data is sensitive.

A worker's exact private location should not automatically be exposed to every customer.

The API should expose only the information required for the current workflow.

For example:

```text
Before booking:
approximate distance / service area

After booking:
necessary arrival/location information
```

The exact policy remains a product/security decision.

---

# 47. Rate Limiting

Rate limits should exist for:

### Authentication

```text
OTP requests
OTP verification
```

### Public APIs

```text
worker discovery
reviews
```

### Sensitive operations

```text
payment creation
refunds
disputes
```

### Admin APIs

More restrictive limits may apply.

Redis can initially support rate limiting.

---

# 48. Idempotent Commands

Critical commands should be designed for retry safety.

Examples:

```text
Create payment
Confirm booking
Cancel booking
Complete job
Submit refund
```

Where appropriate, use:

```http
Idempotency-Key
```

The server should persist enough information to return the previous result.

---

# 49. API Endpoint Map

## Authentication

```text
POST   /api/v1/auth/otp/request
POST   /api/v1/auth/otp/verify
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
```

## User

```text
GET    /api/v1/me
PATCH  /api/v1/me
```

## Customer

```text
GET    /api/v1/customer/addresses
POST   /api/v1/customer/addresses
PATCH  /api/v1/customer/addresses/{id}
DELETE /api/v1/customer/addresses/{id}
POST   /api/v1/customer/addresses/{id}/set-default
```

## Worker

```text
POST   /api/v1/workers
GET    /api/v1/workers/me
PATCH  /api/v1/workers/me
GET    /api/v1/workers/{id}
GET    /api/v1/workers/me/skills
PUT    /api/v1/workers/me/skills
GET    /api/v1/workers/me/availability
PATCH  /api/v1/workers/me/availability
POST   /api/v1/workers/me/verifications
```

## Catalog

```text
GET    /api/v1/catalog/professions
GET    /api/v1/catalog/professions/{id}
GET    /api/v1/catalog/professions/{id}/skills
```

## Service Requests

```text
POST   /api/v1/service-requests
GET    /api/v1/service-requests
GET    /api/v1/service-requests/{id}
POST   /api/v1/service-requests/{id}/cancel
POST   /api/v1/service-requests/{id}/attachments
GET    /api/v1/service-requests/{id}/matches
```

## Matching

```text
POST   /api/v1/matches/{id}/accept
POST   /api/v1/matches/{id}/reject
```

## Booking

```text
GET    /api/v1/bookings/{id}
POST   /api/v1/bookings/{id}/confirm
POST   /api/v1/bookings/{id}/cancel
POST   /api/v1/bookings/{id}/reschedule
```

## Job

```text
POST   /api/v1/jobs/{id}/en-route
POST   /api/v1/jobs/{id}/arrive
POST   /api/v1/jobs/{id}/start
POST   /api/v1/jobs/{id}/complete
POST   /api/v1/jobs/{id}/no-show
POST   /api/v1/jobs/{id}/additional-work
```

## Additional Work

```text
POST   /api/v1/additional-work/{id}/approve
POST   /api/v1/additional-work/{id}/reject
```

## Payment

```text
POST   /api/v1/payments
GET    /api/v1/payments/{id}
POST   /api/v1/payments/{id}/refund
```

## Reviews

```text
POST   /api/v1/jobs/{id}/reviews
GET    /api/v1/workers/{id}/reviews
```

## Disputes

```text
POST   /api/v1/jobs/{id}/disputes
GET    /api/v1/disputes/{id}
POST   /api/v1/disputes/{id}/evidence
```

## Notifications

```text
GET    /api/v1/notifications
POST   /api/v1/notifications/{id}/read
POST   /api/v1/notifications/read-all
```

## Webhooks

```text
POST   /api/v1/webhooks/payments/{provider}
```

## Admin

```text
GET    /api/v1/admin/users
GET    /api/v1/admin/workers
GET    /api/v1/admin/service-requests
GET    /api/v1/admin/bookings
GET    /api/v1/admin/payments
GET    /api/v1/admin/disputes

POST   /api/v1/admin/workers/{id}/suspend
POST   /api/v1/admin/workers/{id}/reactivate

POST   /api/v1/admin/disputes/{id}/resolve
```

---

# 50. Example — Complete Service Request Flow

Client:

```http
POST /api/v1/service-requests
Authorization: Bearer ...
Idempotency-Key: req-123
```

Request:

```json
{
  "professionId": "019...",
  "description": "Kitchen switchboard stopped working.",
  "location": {
    "latitude": 22.58,
    "longitude": 88.31,
    "addressText": "Shibpur, Howrah"
  },
  "scheduledAt": "2026-10-01T15:00:00Z",
  "urgency": "NORMAL"
}
```

Backend:

```text
Authenticate
    ↓
Authorize
    ↓
Validate request
    ↓
Validate profession
    ↓
Validate location
    ↓
Create ServiceRequest
    ↓
Commit transaction
    ↓
Publish ServiceRequestSubmitted
    ↓
Matching process
```

Response:

```json
{
  "data": {
    "id": "019...",
    "status": "SUBMITTED"
  }
}
```

Matching then finds eligible workers.

---

# 51. Example — Booking Confirmation

```http
POST /api/v1/bookings/{id}/confirm
Authorization: Bearer ...
Idempotency-Key: booking-confirm-123
```

Backend:

```text
Authenticate
    ↓
Authorize customer
    ↓
Load booking
    ↓
Verify booking state
    ↓
Verify worker still eligible
    ↓
Acquire concurrency protection
    ↓
Confirm booking
    ↓
Create/update job
    ↓
Commit
    ↓
Publish BookingConfirmed
    ↓
Notification
```

The notification should happen asynchronously where practical.

---

# 52. Example — Job Completion

```http
POST /api/v1/jobs/{id}/complete
```

Backend checks:

```text
Does job exist?
        ↓
Does worker have access?
        ↓
Is current state WORK_STARTED?
        ↓
Are required conditions satisfied?
        ↓
Mark WORK_COMPLETED
        ↓
Record completed timestamp
        ↓
Publish JobCompleted
        ↓
Trigger payment/review/notification workflows
```

The client cannot simply send:

```json
{
  "status": "WORK_COMPLETED"
}
```

and bypass the state machine.

---

# 53. DTO Strategy

Never return JPA entities directly from controllers.

Bad:

```java
@GetMapping("/{id}")
public WorkerEntity getWorker(...) {
    return repository.findById(id);
}
```

Preferred:

```java
@GetMapping("/{id}")
public WorkerResponse getWorker(...) {
    return workerQueryService.getWorker(id);
}
```

API DTO:

```java
public record WorkerResponse(
    UUID id,
    String name,
    String profession,
    Integer experienceYears,
    BigDecimal rating
) {}
```

This prevents persistence models from becoming public API contracts.

---

# 54. OpenAPI

The API should be documented using OpenAPI.

The project can use Springdoc OpenAPI or the selected equivalent.

The generated documentation should describe:

* endpoints
* authentication
* request schemas
* response schemas
* error responses
* status codes
* validation
* examples

The OpenAPI specification becomes an important contract between backend and frontend teams.

---

# 55. API Testing Strategy

Every important API should have multiple levels of testing.

### Controller/API tests

Verify:

* request validation
* HTTP status
* response structure
* authentication
* authorization

### Application tests

Verify:

* business rules
* state transitions
* idempotency
* failure handling

### Integration tests

Verify:

```text
API
 ↓
Application
 ↓
Database
 ↓
Redis/external adapters where appropriate
```

Testcontainers should eventually be used for PostgreSQL/PostGIS and Redis integration testing.

---

# 56. Backward Compatibility

Once mobile applications are released, old clients may continue using older API behavior.

Therefore:

> Never casually break an existing API.

For example, if:

```json
{
  "name": "Ramesh"
}
```

already exists, adding:

```json
{
  "profileCompletionPercentage": 85
}
```

is normally safe.

Removing `name` could break existing clients.

---

# 57. API Deprecation

When an endpoint must eventually be replaced:

```text
Current:
POST /api/v1/...
```

New:

```text
POST /api/v2/...
```

The old API should have a defined migration/deprecation period.

Deprecation should be documented rather than silently breaking clients.

---

# 58. What the API Must NOT Do

The API layer must not contain:

* complex matching algorithms
* payment provider implementation
* database-specific business logic
* large business workflows
* direct SQL everywhere
* notification delivery logic
* domain state-machine logic

The API layer should primarily:

```text
HTTP Request
    ↓
Authentication
    ↓
Validation
    ↓
DTO → Command
    ↓
Application Use Case
    ↓
Response DTO
```

---

# 59. API Architectural Flow

The overall request path is:

```text
Client
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
  ▼
Domain Model
  │
  ▼
Repository / Port
  │
  ▼
Infrastructure
  │
  ▼
PostgreSQL / Redis / External Provider
```

And response:

```text
Infrastructure
      ↓
Domain/Application
      ↓
Response DTO
      ↓
Controller
      ↓
JSON
      ↓
Client
```

---

# 60. API Security Invariants

The following must always remain true:

```text
1. Authentication cannot be bypassed.
2. Authorization is checked server-side.
3. Resource ownership is verified.
4. Sensitive data is minimized.
5. Critical operations are idempotent.
6. State transitions are server-controlled.
7. Payment webhooks are authenticated.
8. File uploads are validated.
9. Rate limits protect sensitive endpoints.
10. Errors do not leak internal implementation details.
11. IDs alone never grant authorization.
12. Admin actions are audited.
```

---

# 61. Final API Architecture

The API is intentionally divided around business capabilities:

```text
                    REST API
                       │
        ┌──────────────┼──────────────┐
        │              │              │
     Customer        Worker         Admin
        │              │              │
        └──────────────┼──────────────┘
                       │
                 Business APIs
                       │
       ┌───────────────┼────────────────┐
       │               │                │
 Service Request    Matching         Booking
       │               │                │
       └───────────────┼────────────────┘
                       │
                      Job
                       │
             ┌─────────┴─────────┐
             │                   │
          Payment              Review
             │                   │
             └─────────┬─────────┘
                       │
                    Dispute
```

The API does not mirror the database.

It represents the **business workflow**.

---

# 62. Current Endpoint Design Principle

The most important API rule for this project is:

> **Use CRUD for data management where appropriate, but use explicit command/action endpoints for business state transitions.**

Examples:

```text
Good:
POST /jobs/{id}/start

Avoid:
PUT /jobs/{id}
{
    "status": "WORK_STARTED"
}
```

```text
Good:
POST /matches/{id}/accept

Avoid:
PATCH /matches/{id}
{
    "status": "ACCEPTED"
}
```

```text
Good:
POST /payments/{id}/refund

Avoid:
PATCH /payments/{id}
{
    "status": "REFUNDED"
}
```

This becomes especially important once the platform handles real money, disputes, reputation, and worker/customer trust.

---

# 63. Open Decisions

The following are intentionally not finalized yet:

### Authentication

* JWT vs opaque access tokens
* access-token lifetime
* refresh-token storage
* device/session management

### Booking

* whether worker acceptance immediately creates a booking
* whether customer must explicitly select worker
* whether multiple workers can temporarily accept
* booking expiration

### Matching

* push vs pull matching
* candidate visibility
* matching timeout
* candidate ranking details

### Payments

* payment-before-service vs payment-after-service
* authorization/hold vs immediate capture
* platform commission
* worker payout timing
* payment-provider selection

### API pagination

* offset pagination for initial endpoints
* cursor pagination for high-volume feeds

### Public worker information

* exact location visibility
* phone number visibility
* work history visibility
* review visibility

These should be finalized after the product/business rules are sufficiently validated.

---

# 64. Conclusion

The API architecture now provides a stable boundary between the clients and the modular monolith.

The important architectural chain is:

```text
Product Requirements
        ↓
Business Rules
        ↓
Domain Model
        ↓
Database Model
        ↓
REST API Contract
        ↓
Application Use Cases
        ↓
Implementation
```

We should **not start coding controllers yet**.

The next step is to define exactly how each API operation maps to application use cases, domain commands, domain events, repositories, transactions, and module boundaries.

Therefore the next document is:

# [archive/05](05-application-use-cases-and-service-layer.md) — Application Use Cases & Service Layer Design

It will define:

* command/query separation
* use-case classes
* application services
* transaction boundaries
* domain services
* repository ports
* input/output models
* domain events
* event handlers
* synchronous vs asynchronous workflows
* service-request creation flow
* matching flow
* booking confirmation flow
* job lifecycle flow
* payment flow
* dispute flow
* module-to-module communication
* what belongs in application vs domain
* what must never go into controllers
* complete end-to-end request execution examples

That document will bridge the gap between the **API contract** and the actual **Spring Boot code structure**.
