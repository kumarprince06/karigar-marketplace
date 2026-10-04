# REST API Contract, Endpoint Design & Error Model

**Project:** Karigar Marketplace
**Status:** Draft for Engineering Review
**Architecture:** Modular Monolith
**API Style:** REST
**API Version:** v1
**Backend:** Java + Spring Boot
**Primary Goal:** Define a stable, production-grade HTTP contract between clients and the backend

---

# 1. Purpose

The previous documents defined:

```text
Product
   ↓
Requirements
   ↓
Domain
   ↓
Java Classes
   ↓
Application Use Cases
```

This document defines the external interface:

```text
Frontend / Mobile App
          ↓
       REST API
          ↓
   Application Layer
```

The API should be treated as a **public contract**.

Internal Java classes, database tables, and implementation details must be allowed to change without unnecessarily breaking clients.

---

# 2. Core API Principles

The API follows these principles:

```text
1. Resource-oriented URLs
2. Explicit business actions
3. Stable API contracts
4. Consistent response structures
5. Consistent error structures
6. Strong validation
7. Explicit authorization
8. Idempotent retry-safe commands
9. Pagination for collections
10. No database entities exposed directly
11. Versioned APIs
12. Backward compatibility
```

---

# 3. Base URL

Production:

```text
https://api.example.com/api/v1
```

Local development:

```text
http://localhost:8080/api/v1
```

The actual production domain is intentionally not finalized yet.

---

# 4. API Versioning

Initial version:

```text
/api/v1
```

Example:

```http
GET /api/v1/workers/me
```

When a breaking API change becomes necessary:

```text
/api/v2
```

Do not create versions for every small change.

For example, adding an optional response field normally does not require:

```text
v2
```

---

# 5. Breaking vs Non-Breaking Changes

Usually non-breaking:

```text
Add optional response field
Add new optional request field
Add new endpoint
Add new enum value only when clients can tolerate unknown values
```

Potentially breaking:

```text
Remove field
Rename field
Change field type
Change meaning
Make optional field mandatory
Change authentication semantics
Change state meanings
```

Breaking changes require deliberate versioning or migration strategy.

---

# 6. Authentication

Initial authentication model (MVP): **email + password**. Phone OTP login is added later, when an SMS provider is in place — see [ADR 0016](../adr/0016-email-password-login-phone-otp-later.md).

```text
Email + Password
      ↓
Verify credentials
      ↓
Access Token
      +
Refresh Token
```

Authenticated requests:

```http
Authorization: Bearer <access-token>
```

## Language

Language is resolved by the backend only:

1. `users.preferred_locale` for authenticated users;
2. otherwise the `Accept-Language` header (e.g. `Accept-Language: bn`);
3. otherwise `en`.

The user's preferred locale travels in the access token (`loc` claim), so no lookup is needed per request ([LLD-003](../lld/lld-003-catalog-and-language.md)).

Translated catalog data (professions, skills) is returned as a single resolved `name`, never as per-language fields; a missing translation falls back to `en`. Responses include `Content-Language`. Supported locales are data, so new languages need no API change.

---

# 7. Authentication Endpoints

MVP:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/email/verify
POST /api/v1/auth/email/verify/resend
POST /api/v1/auth/password/forgot
POST /api/v1/auth/password/reset
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/logout-all
GET    /api/v1/me/sessions                 -- logged-in devices
DELETE /api/v1/me/sessions/{familyId}      -- log out one device
```

Sessions, rotation and token errors: [LLD-002](../lld/lld-002-identity-sessions-token-rotation.md).

Register request:

```json
{
  "role": "WORKER",
  "name": "Rahim Sheikh",
  "email": "rahim.sheikh@example.com",
  "phone": "+919876543210",
  "password": "********",
  "preferredLocale": "bn",
  "consents": {
    "termsVersion": "2026-10-01",
    "privacyNoticeVersion": "2026-10-01",
    "isAdult": true,
    "marketingEmail": false
  }
}
```

- `email` and `phone` must each be unique; a duplicate returns `409 Conflict`.
- Login is by email + password and returns the same token response as below.
- Full detail (validation, error codes, rate limits, sequence diagrams): [LLD-001](../lld/lld-001-identity-email-signup-login.md).
- `password/forgot` always returns `202 Accepted`, whether or not the email exists, to avoid account enumeration.

Phase 2 (when SMS is available) — sections 8–9 below:

```text
POST /api/v1/auth/otp/request
POST /api/v1/auth/otp/verify
```

---

# 8. Request OTP

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
    "requestId": "..."
  }
}
```

The API should not return the OTP itself in production.

Development environments may use a test OTP mechanism.

---

# 9. Verify OTP

```http
POST /api/v1/auth/otp/verify
```

Request:

```json
{
  "requestId": "...",
  "otp": "123456"
}
```

Response:

```json
{
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresIn": 900
  }
}
```

---

# 10. Refresh Token

```http
POST /api/v1/auth/refresh
```

Request:

```json
{
  "refreshToken": "..."
}
```

Response:

```json
{
  "data": {
    "accessToken": "...",
    "expiresIn": 900
  }
}
```

Refresh-token rotation policy will be finalized during the authentication design document.

---

# 11. Logout

```http
POST /api/v1/auth/logout
```

Request:

```json
{
  "refreshToken": "..."
}
```

Response:

```json
{
  "data": null
}
```

Logout should invalidate the appropriate refresh-token/session state.

---

# 12. Current User

```http
GET /api/v1/me
```

Response:

```json
{
  "data": {
    "id": "uuid",
    "email": "rahim.sheikh@example.com",
    "emailVerified": true,
    "phone": "+919876543210",
    "phoneVerified": false,
    "preferredLocale": "bn",
    "roles": [
      "CUSTOMER"
    ],
    "status": "ACTIVE"
  }
}
```

---

# 13. Update Current User

```http
PATCH /api/v1/me
```

Request:

```json
{
  "displayName": "Prince",
  "preferredLocale": "bn"
}
```

Only permitted fields should be accepted.

The client should not be able to modify:

```text
role
status
verification
account ownership
createdAt
```

through this endpoint.


## Change phone number

```http
PUT /api/v1/me/phone
```

```json
{ "phone": "+919876543210" }
```

- Number must be E.164 and not used by any other account, otherwise `409 Conflict` (`PHONE_ALREADY_IN_USE`).
- MVP: updated immediately, `phoneVerified` stays `false`.
- Later phase: returns an OTP challenge; the number changes only after OTP verification.
- `phone` and `email` cannot be changed through `PATCH /api/v1/me`.
---

# 14. Customer Address APIs

```text
GET    /api/v1/customer/addresses
POST   /api/v1/customer/addresses
PATCH  /api/v1/customer/addresses/{addressId}
DELETE /api/v1/customer/addresses/{addressId}
```

---

# 15. Create Address

```http
POST /api/v1/customer/addresses
```

Request:

```json
{
  "label": "Maa's flat",
  "addressFor": "FAMILY",
  "contactName": "Anjali Das",
  "contactPhone": "+919830012345",
  "propertyType": "FLAT",
  "houseNo": "Flat 3B",
  "buildingName": "Shanti Apartment",
  "street": "14/2 G.T. Road",
  "locality": "Shibpur",
  "landmark": "near Shibpur Bazar bus stop",
  "city": "Howrah",
  "district": "Howrah",
  "stateCode": "WB",
  "pincode": "711102",
  "floorNumber": 2,
  "hasLift": false,
  "latitude": 22.5664,
  "longitude": 88.3097,
  "locationSource": "MAP_PIN",
  "isDefault": true
}
```

Response:

```json
{
  "data": {
    "id": "uuid",
    "label": "Maa's flat",
    "addressFor": "FAMILY",
    "formattedAddress": "Flat 3B, Shanti Apartment, 14/2 G.T. Road, Shibpur, near Shibpur Bazar bus stop, Howrah, WB 711102",
    "floorNumber": 2,
    "hasLift": false,
    "serviceArea": { "code": "HWH-SHIBPUR", "name": "Shibpur", "status": "ACTIVE" },
    "isDefault": true
  }
}
```

- `pincode` must be 6 digits; invalid input returns `422`.
- `contactName`, `contactPhone` and `"contactConsentConfirmed": true` are required unless `addressFor` is `SELF`.
- Waitlist for uncovered areas: `POST /api/v1/service-areas/waitlist`. Full detail: [LLD-005](../lld/lld-005-customer-addresses-service-zones.md).
- `POST /service-requests` takes an `addressId` of a saved address; free-text addresses are not accepted.
- `serviceArea` is resolved by the backend. If it is missing or not `ACTIVE`, the address is still saved, but creating a service request with it returns `422 SERVICE_AREA_NOT_AVAILABLE`.

Check coverage before asking for a full address:

```http
GET /api/v1/service-areas/check?pincode=711102
GET /api/v1/service-areas/check?latitude=22.5664&longitude=88.3097
```

---

# 16. Worker APIs

Worker profile:

```text
POST  /api/v1/workers
GET   /api/v1/workers/me
PATCH /api/v1/workers/me
```

Trades, rates and skills (skills are chosen per trade):

```text
PUT /api/v1/workers/me/professions                               -- full list; exactly one isPrimary; max 3
PUT /api/v1/workers/me/professions/{professionId}/rates          -- full list for one trade; changed rates close old rows
PUT /api/v1/workers/me/professions/{professionId}/skills         -- full list of skill ids for one trade
GET /api/v1/workers/me/readiness                                 -- checklist to start receiving jobs
PUT /api/v1/workers/me/service-area                              -- base point + travel radius (1–20 km)
PUT /api/v1/workers/me/online                                    -- { "online": true }

Customer: GET /api/v1/service-requests/{id}/matching (search progress), POST …/search-again.
Public: GET /api/v1/service-areas/emergency-availability. Details: [LLD-007](../lld/lld-007-matching-candidate-search.md).

Details and error codes: [LLD-004](../lld/lld-004-worker-profile-trades-rates.md).
```

Availability:

```text
PATCH /api/v1/workers/me/availability
```

Verification:

```text
POST /api/v1/workers/me/verifications
```

---

# 17. Create Worker Profile

```http
POST /api/v1/workers
```

Request:

```json
{
  "displayName": "Rahim Sheikh",
  "description": "House construction, plastering and floor tiling",
  "professions": [
    { "professionId": "uuid-raj-mistri", "isPrimary": true,  "experienceYears": 12 },
    { "professionId": "uuid-tiles-mistri", "isPrimary": false, "experienceYears": 4 }
  ],
  "rates": [
    { "professionId": "uuid-raj-mistri",   "rateType": "DAILY",    "amountMinor": 85000 },
    { "professionId": "uuid-raj-mistri",   "rateType": "HALF_DAY", "amountMinor": 45000 },
    { "professionId": "uuid-tiles-mistri", "rateType": "PER_UNIT", "unit": "SQ_FT", "amountMinor": 2800 }
  ]
}
```

Response:

```json
{
  "data": {
    "id": "uuid",
    "status": "PENDING_VERIFICATION"
  }
}
```

---

# 18. Worker Profile

```http
GET /api/v1/workers/me
```

Response:

```json
{
  "data": {
    "id": "uuid",
    "displayName": "Ramesh Kumar",
    "profession": {
      "id": "uuid",
      "name": "Electrician"
    },
    "experienceYears": 8,
    "status": "ACTIVE",
    "acceptingJobs": true,
    "verification": {
      "status": "APPROVED"
    }
  }
}
```

The exact response will evolve with the UI requirements.

---

# 19. Update Worker Profile

```http
PATCH /api/v1/workers/me
```

Example:

```json
{
  "displayName": "Ramesh Kumar",
  "experienceYears": 9,
  "description": "Residential and commercial electrical work"
}
```

The worker cannot directly modify:

```text
status
verification status
rating
completedJobs
reputation
```

Those are server-controlled.

---

# 20. Worker Skills

Replace the worker's selected skills for one trade:

```http
PUT /api/v1/workers/me/professions/{professionId}/skills
```

Request:

```json
{
  "skillIds": [
    "uuid-1",
    "uuid-2",
    "uuid-3"
  ]
}
```

The backend validates that:

```text
skill exists
skill is active
skill belongs to worker's profession
```

---

# 21. Worker Availability

```http
PATCH /api/v1/workers/me/availability
```

Request:

```json
{
  "acceptingJobs": true
}
```

Response:

```json
{
  "data": {
    "acceptingJobs": true
  }
}
```

Later this can expand to schedules without changing the fundamental concept.

---

# 22. Verification

Worker submits verification:

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

Sensitive documents should generally be uploaded through a secure upload mechanism rather than embedded directly in JSON.

---

# 23. Catalog APIs

Catalog data is mostly read-only for clients.

```text
GET /api/v1/catalog/categories                              -- categories with their active trades
GET /api/v1/catalog/professions
GET /api/v1/catalog/professions/{professionId}
GET /api/v1/catalog/professions/{professionId}/skills
GET /api/v1/catalog/professions/{professionId}/problems     -- common problems + price guide
GET /api/v1/catalog/search?q=pakha                          -- finds trades/problems in any language
```

Catalog endpoints are public (no login), so customers can browse before signing in. Names come back in the resolved language (see Language).

Example:

```http
GET /api/v1/catalog/professions
```

Response:

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Electrician"
    },
    {
      "id": "uuid",
      "name": "Plumber"
    }
  ]
}
```

---

# 24. Service Request APIs

Core endpoints:

```text
POST /api/v1/service-requests
GET  /api/v1/service-requests
GET  /api/v1/service-requests/{requestId}
POST /api/v1/service-requests/{requestId}/submit
POST /api/v1/service-requests/{requestId}/cancel
GET  /api/v1/service-requests/{requestId}/matches
POST /api/v1/service-requests/{requestId}/attachments
```

---

# 25. Create Service Request

```http
POST /api/v1/service-requests
```

Request:

```json
{
  "professionId": "uuid",
  "problemIds": ["uuid-elec-fan-not-working"],
  "description": "Fan in the bedroom stopped, makes humming sound",
  "mediaIds": [],
  "addressId": "uuid-of-saved-address",
  "urgency": "TODAY",
  "preferredWindow": { "start": "2026-10-03T12:30:00Z", "end": "2026-10-03T15:30:00Z" },
  "scheduledAt": "2026-10-02T18:30:00Z",
  "urgency": "NORMAL"
}
```

Response:

```json
{
  "data": {
    "id": "uuid",
    "status": "PENDING_PAYMENT"
  }
}
```

---

Creating a request returns `PENDING_PAYMENT` with checkout data for the advance; after the verified payment webhook it becomes `SUBMITTED` and matching starts. `urgency` can also be `EMERGENCY` (24×7, eligible problems, surcharge). Drafts: `/api/v1/service-request-drafts`. Validation, time-window rules, limits and error codes: [LLD-006](../lld/lld-006-create-service-request.md).

---

# 26. Submit Service Request (not used in MVP)

Not used in MVP: create already submits (LLD-006 D1). Kept for a future "save for later" draft feature.


```http
POST /api/v1/service-requests/{requestId}/submit
```

No request body is required.

Response:

```json
{
  "data": {
    "id": "uuid",
    "status": "SUBMITTED"
  }
}
```

This explicit action is preferable to:

```http
PATCH /service-requests/{id}
```

with:

```json
{
  "status": "SUBMITTED"
}
```

because the latter exposes internal state management.

---

# 27. Cancel Service Request

```http
POST /api/v1/service-requests/{requestId}/cancel
```

Request:

```json
{
  "reason": "NO_LONGER_NEEDED"
}
```

Response:

```json
{
  "data": {
    "id": "uuid",
    "status": "CANCELLED"
  }
}
```

---

# 28. Get Service Request

```http
GET /api/v1/service-requests/{requestId}
```

Response:

```json
{
  "data": {
    "id": "uuid",
    "profession": {
      "id": "uuid",
      "name": "Electrician"
    },
    "description": "Ceiling fan is not working",
    "status": "MATCHING",
    "scheduledAt": "2026-10-02T18:30:00Z"
  }
}
```

---

# 29. Matching APIs

The customer picks the worker ([ADR 0017](../adr/0017-customer-picks-the-worker.md)).

Customer:

```http
GET  /api/v1/service-requests/{requestId}/shortlist           -- workers who accepted (max 3)
POST /api/v1/service-requests/{requestId}/select-worker       -- { "matchId": "uuid" } → creates booking
POST /api/v1/service-requests/{requestId}/search-again        -- widen search / retry
GET    /api/v1/customer/favourite-workers                     -- "My workers"
PUT    /api/v1/customer/favourite-workers/{workerId}
DELETE /api/v1/customer/favourite-workers/{workerId}
```

Shortlist response:

```json
{
  "data": {
    "requestStatus": "AWAITING_SELECTION",
    "workers": [
      {
        "matchId": "uuid",
        "workerId": "uuid",
        "displayName": "Sujit Das",
        "photoUrl": "https://...",
        "primaryTrade": "Electrician",
        "experienceYears": 8,
        "rating": 4.7,
        "completedJobs": 132,
        "distanceMeters": 1800,
        "badges": ["ID_VERIFIED", "POLICE_VERIFIED"],
        "offer": { "rateType": "VISIT", "amountMinor": 20000, "availableFrom": "2026-10-03T11:00:00Z" },
        "isFavourite": true
      }
    ]
  }
}
```

- `select-worker` is idempotent (`Idempotency-Key`). If the worker withdrew or the offer expired, it returns `409 MATCH_NO_LONGER_AVAILABLE` and the app refreshes the shortlist.
- The worker's phone number and exact location are not shown until after selection.

Worker:

```http
GET  /api/v1/workers/me/offers?status=OPEN               -- job inbox (push + list, not real-time)
GET  /api/v1/workers/me/offers/{matchId}               -- detail; first open → VIEWED
POST /api/v1/workers/me/offers/{matchId}/accept        -- { "rate": { "rateType": "VISIT", "amountMinor": 20000 }, "availableFrom": "…" }
POST /api/v1/workers/me/offers/{matchId}/decline       -- { "reasonCode": "TOO_FAR" }
POST /api/v1/workers/me/offers/{matchId}/withdraw      -- before the customer picks
```

Details: [LLD-008](../lld/lld-008-offers-shortlist-selection.md).

---

# 30. Accept Match

```http
POST /api/v1/workers/me/offers/{matchId}/accept
```

The authenticated worker is determined from the access token.

Do not send:

```json
{
  "workerId": "..."
}
```

The backend determines:

```text
authenticated user
      ↓
worker profile
      ↓
worker identity
```

---

# 31. Decline Offer

```http
POST /api/v1/workers/me/offers/{matchId}/decline
```

Request:

```json
{
  "reasonCode": "LOCATION_TOO_FAR"
}
```

Response:

```json
{
  "data": {
    "matchId": "uuid",
    "status": "DECLINED"
  }
}
```

---

# 32. Booking APIs

```text
GET  /api/v1/bookings/{bookingId}
POST /api/v1/bookings/{bookingId}/confirm
POST /api/v1/bookings/{bookingId}/cancel
POST /api/v1/bookings/{bookingId}/reschedule
```

The exact confirmation flow will depend on the final marketplace interaction.

---

# 33. Booking Confirmation

```http
POST /api/v1/bookings/{bookingId}/confirm
```

Response:

```json
{
  "data": {
    "id": "uuid",
    "status": "CONFIRMED",
    "scheduledAt": "2026-10-02T18:30:00Z"
  }
}
```

If another worker has already been confirmed:

```http
409 Conflict
```

with:

```json
{
  "error": {
    "code": "BOOKING_ALREADY_CONFIRMED",
    "message": "This service request already has a confirmed booking.",
    "details": {},
    "traceId": "..."
  }
}
```

---

# 34. Booking Cancellation

```http
POST /api/v1/bookings/{bookingId}/cancel
```

Request:

```json
{
  "reason": "CUSTOMER_CHANGED_MIND"
}
```

---

# 35. Booking Reschedule

```http
POST /api/v1/bookings/{bookingId}/reschedule
```

Request:

```json
{
  "scheduledAt": "2026-10-03T18:30:00Z"
}
```

The application layer validates whether rescheduling is currently allowed.

---

# 36. Job APIs

Job execution uses explicit state-changing endpoints:

```text
POST /api/v1/jobs/{jobId}/en-route
POST /api/v1/jobs/{jobId}/arrive
POST /api/v1/jobs/{jobId}/start
POST /api/v1/jobs/{jobId}/complete
POST /api/v1/jobs/{jobId}/no-show
POST /api/v1/jobs/{jobId}/cancel
```

---

# 37. Why Action Endpoints?

Avoid:

```http
PATCH /jobs/123
```

with:

```json
{
  "status": "WORK_COMPLETED"
}
```

because this allows the client to express arbitrary state transitions.

Prefer:

```http
POST /jobs/123/complete
```

Now the backend owns the transition:

```text
WORK_STARTED
       ↓
complete()
       ↓
WORK_COMPLETED
```

---

# 38. En Route

```http
POST /api/v1/jobs/{jobId}/en-route
```

Response:

```json
{
  "data": {
    "jobId": "uuid",
    "status": "EN_ROUTE",
    "enRouteAt": "2026-10-02T18:10:00Z"
  }
}
```

---

# 39. Arrived

```http
POST /api/v1/jobs/{jobId}/arrive
```

Transition:

```text
EN_ROUTE → ARRIVED
```

---

# 40. Start Job

```http
POST /api/v1/jobs/{jobId}/start
```

Transition:

```text
ARRIVED → WORK_STARTED
```

---

# 41. Complete Job

```http
POST /api/v1/jobs/{jobId}/complete
```

Transition:

```text
WORK_STARTED → WORK_COMPLETED
```

---

# 42. No-Show

```http
POST /api/v1/jobs/{jobId}/no-show
```

Request:

```json
{
  "type": "WORKER_NO_SHOW",
  "reason": "Worker did not arrive"
}
```

The backend must verify who is allowed to report which type of no-show.

---

# 43. Additional Work

Worker:

```http
POST /api/v1/jobs/{jobId}/additional-work
```

Request:

```json
{
  "description": "Replace damaged capacitor",
  "amountMinor": 35000,
  "currency": "INR"
}
```

Response:

```json
{
  "data": {
    "id": "uuid",
    "status": "PROPOSED",
    "amountMinor": 35000,
    "currency": "INR"
  }
}
```

---

# 44. Approve Additional Work

```http
POST /api/v1/additional-work/{additionalWorkId}/approve
```

Customer approves.

Transition:

```text
PROPOSED → APPROVED
```

---

# 45. Reject Additional Work

```http
POST /api/v1/additional-work/{additionalWorkId}/reject
```

Transition:

```text
PROPOSED → REJECTED
```

---

# 46. Payment APIs

```text
POST /api/v1/payments
GET  /api/v1/payments/{paymentId}
POST /api/v1/payments/{paymentId}/refund
```

Provider webhooks:

```text
POST /api/v1/webhooks/payments/{provider}
```

---

# 47. Create Payment

```http
POST /api/v1/payments
```

Request:

```json
{
  "jobId": "uuid",
  "amountMinor": 50000,
  "currency": "INR",
  "provider": "STRIPE"
}
```

Header:

```http
Idempotency-Key: 01JXYZ...
```

Response:

```json
{
  "data": {
    "paymentId": "uuid",
    "status": "PENDING",
    "provider": "STRIPE"
  }
}
```

---

# 48. Why Money Uses amountMinor

Never send:

```json
{
  "amount": 500.50
}
```

for financial calculations where floating-point ambiguity matters.

Prefer:

```json
{
  "amountMinor": 50050,
  "currency": "INR"
}
```

Meaning:

```text
₹500.50
```

---

# 49. Refund

```http
POST /api/v1/payments/{paymentId}/refund
```

Request:

```json
{
  "amountMinor": 50000,
  "reason": "CUSTOMER_CANCELLED"
}
```

The backend must enforce:

```text
total refunded <= captured amount
```

---

# 50. Payment Webhook

```http
POST /api/v1/webhooks/payments/{provider}
```

This endpoint is different from normal authenticated APIs.

Authentication uses:

```text
provider signature
```

rather than:

```text
Bearer user token
```

The webhook handler must:

```text
1. Validate signature
2. Validate provider
3. Validate event
4. Check duplicate event
5. Locate payment
6. Apply valid transition
7. Persist
8. Return provider-compatible response
```

---

# 51. Review APIs

Create:

```http
POST /api/v1/jobs/{jobId}/reviews
```

Get worker reviews:

```http
GET /api/v1/workers/{workerId}/reviews
```

Request:

```json
{
  "rating": 5,
  "comment": "Arrived on time and fixed the issue."
}
```

---

# 52. Review Authorization

The backend must verify:

```text
job completed
reviewer participated
reviewer is allowed to review reviewee
review has not already been submitted
```

Never trust:

```json
{
  "revieweeId": "..."
}
```

from the client if the relationship can be derived from the job.

---

# 53. Dispute APIs

```text
POST /api/v1/jobs/{jobId}/disputes
GET  /api/v1/disputes/{disputeId}
POST /api/v1/disputes/{disputeId}/evidence
```

Admin:

```text
POST /api/v1/disputes/{disputeId}/review
POST /api/v1/disputes/{disputeId}/resolve
```

---

# 54. Open Dispute

```http
POST /api/v1/jobs/{jobId}/disputes
```

Request:

```json
{
  "type": "INCOMPLETE_WORK",
  "description": "The reported issue was not resolved."
}
```

Response:

```json
{
  "data": {
    "id": "uuid",
    "status": "OPEN"
  }
}
```

---

# 55. Add Evidence

```http
POST /api/v1/disputes/{disputeId}/evidence
```

Evidence may reference:

```text
photos
documents
messages
payment records
other permitted evidence
```

Actual files should be stored in object storage, not PostgreSQL blobs by default.

---

# 56. Notification APIs

Most notifications should be server-generated.

Client may retrieve notification history:

```http
GET /api/v1/notifications
POST /api/v1/notifications/{notificationId}/read
POST /api/v1/notifications/read-all
```

---

# 57. Admin APIs

Admin APIs should be under:

```text
/api/v1/admin
```

Examples:

```text
GET  /api/v1/admin/workers
GET  /api/v1/admin/workers/{workerId}
POST /api/v1/admin/workers/{workerId}/suspend

GET  /api/v1/admin/verifications
POST /api/v1/admin/verifications/{id}/approve
POST /api/v1/admin/verifications/{id}/reject

GET  /api/v1/admin/disputes
POST /api/v1/admin/disputes/{id}/resolve

GET  /api/v1/admin/jobs
GET  /api/v1/admin/payments
GET  /api/v1/admin/audit-events
```

Administrative authorization will be stricter than normal user authorization.

---

# 58. Standard Success Response

Default:

```json
{
  "data": {}
}
```

Collection:

```json
{
  "data": []
}
```

With metadata:

```json
{
  "data": [],
  "meta": {}
}
```

Do not unnecessarily wrap every response in multiple layers.

---

# 59. Standard Error Response

Every API error should follow one structure:

```json
{
  "error": {
    "code": "BOOKING_ALREADY_CONFIRMED",
    "message": "This service request already has a confirmed booking.",
    "details": {},
    "traceId": "01JXYZ..."
  }
}
```

---

# 60. Error Code

The machine-readable code is:

```text
BOOKING_ALREADY_CONFIRMED
```

not:

```text
"Something went wrong"
```

Frontend code can react to stable error codes without parsing human-readable messages.

---

# 61. Error Message

The message is for humans.

Example:

```text
This service request already has a confirmed booking.
```

Messages may change.

The stable integration contract is:

```text
error.code
```

---

# 62. Trace ID

Example:

```text
traceId: 01JXYZ...
```

This allows:

```text
Client
  ↓
API
  ↓
Logs
  ↓
Trace
  ↓
Database/external operation
```

to be correlated.

The actual tracing implementation will be defined later.

---

# 63. Validation Error

Example request:

```json
{
  "description": "",
  "latitude": 999
}
```

Response:

```http
400 Bad Request
```

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": {
      "fields": {
        "description": [
          "Description is required."
        ],
        "latitude": [
          "Latitude must be between -90 and 90."
        ]
      }
    },
    "traceId": "..."
  }
}
```

---

# 64. HTTP Status Codes

Recommended baseline:

| Status  | Meaning                                            |
| ------- | -------------------------------------------------- |
| 200     | Successful read/update/action                      |
| 201     | Resource created                                   |
| 202     | Accepted for asynchronous processing               |
| 204     | Successful operation with no body                  |
| 400     | Invalid request                                    |
| 401     | Unauthenticated                                    |
| 403     | Authenticated but not allowed                      |
| 404     | Resource not found                                 |
| 409     | Conflict/business concurrency                      |
| 422     | Semantically invalid business input, where adopted |
| 429     | Rate limited                                       |
| 500     | Unexpected server error                            |
| 502/503 | Upstream/dependency/service failure                |

We should use these consistently rather than inventing status meanings.

---

# 65. 401 vs 403

### 401

User is not authenticated.

Example:

```text
No access token
Invalid access token
Expired access token
```

### 403

User is authenticated but lacks permission.

Example:

```text
Worker attempts admin operation.
```

---

# 66. 404 vs Authorization

Carefully consider resource enumeration.

For example:

```http
GET /service-requests/some-id
```

If the request belongs to another customer, returning:

```text
404
```

may be preferable in some cases to revealing that the resource exists.

The exact security policy will be finalized in the security design.

---

# 67. 409 Conflict

Use for state/concurrency conflicts.

Examples:

```text
BOOKING_ALREADY_CONFIRMED
MATCH_ALREADY_ACCEPTED
PAYMENT_ALREADY_PROCESSED
JOB_ALREADY_COMPLETED
RESOURCE_VERSION_CONFLICT
```

---

# 68. Pagination

Collection endpoints should not return unlimited data.

Example:

```http
GET /api/v1/service-requests?page=0&size=20
```

Response:

```json
{
  "data": [
    {}
  ],
  "meta": {
    "page": 0,
    "size": 20,
    "totalElements": 120,
    "totalPages": 6
  }
}
```

---

# 69. Cursor Pagination

For high-volume feeds, cursor pagination may eventually be better.

Example:

```http
GET /api/v1/notifications?limit=20&cursor=abc123
```

Response:

```json
{
  "data": [],
  "meta": {
    "nextCursor": "def456"
  }
}
```

Do not introduce cursor pagination everywhere prematurely.

Use it where large, frequently changing datasets justify it.

---

# 70. Sorting

Example:

```http
GET /api/v1/workers?sort=distance
```

The backend must whitelist allowed fields.

Never allow arbitrary SQL-style sorting input.

Bad:

```text
?sort=some_raw_sql
```

---

# 71. Filtering

Example:

```http
GET /api/v1/admin/jobs?status=COMPLETED
```

Multiple filters:

```http
GET /api/v1/admin/jobs?status=COMPLETED&professionId=...
```

Filters should be explicitly supported.

Do not expose arbitrary database query expressions.

---

# 72. Search Workers

Example:

```http
GET /api/v1/workers/search
```

Potential parameters:

```text
professionId
skillIds
latitude
longitude
radiusMeters
availability
```

Example:

```http
GET /api/v1/workers/search?professionId=...&latitude=22.58&longitude=88.31&radiusMeters=5000
```

PostGIS performs candidate discovery.

---

# 73. Do Not Expose Internal Matching Score

Internally:

```text
matchScore = 0.87
```

may exist.

The public API should not necessarily expose:

```json
{
  "matchScore": 0.87
}
```

unless there is a clear product reason.

Instead, expose understandable information:

```text
distance
verified
skills
experience
availability
rating
completed jobs
```

This makes the product more explainable.

---

# 74. API Field Naming

Use consistent JSON naming.

Recommended:

```json
{
  "workerId": "...",
  "scheduledAt": "...",
  "experienceYears": 8,
  "acceptingJobs": true
}
```

Use camelCase for JSON.

Java can also use camelCase.

---

# 75. Date and Time

API timestamps should use ISO-8601.

Example:

```text
2026-10-02T18:30:00Z
```

Backend should store timestamps as:

```text
TIMESTAMPTZ
```

and use UTC internally.

The client can display local time.

---

# 76. Location

Do not use ambiguous:

```json
{
  "location": "Howrah"
}
```

for machine operations.

Use:

```json
{
  "latitude": 22.58,
  "longitude": 88.31
}
```

Optionally:

```json
{
  "addressText": "Shibpur, Howrah"
}
```

The coordinates drive geographic calculations.

---

# 77. Location Privacy

Do not expose unnecessary worker location precision.

For example, a worker's exact home location should not automatically be returned to customers.

Possible customer-facing representation:

```text
approximately 1.8 km away
```

rather than:

```text
worker's exact coordinates
```

The precise exposure policy will be defined in the security/privacy document.

---

# 78. Idempotency Header

For retry-sensitive commands:

```http
Idempotency-Key: <unique-key>
```

The server uses:

```text
HTTP method
+
endpoint
+
authenticated principal
+
idempotency key
```

to determine whether a request has already been processed.

The exact storage model will be finalized later.

---

# 79. Idempotent Example

Client sends:

```http
POST /api/v1/payments
Idempotency-Key: abc123
```

Network fails.

Client retries:

```http
POST /api/v1/payments
Idempotency-Key: abc123
```

The backend should return the result of the original operation rather than creating another payment.

---

# 80. Idempotency-Key Rules

Keys should be:

```text
unique
opaque
client-generated
sufficiently unpredictable
```

The backend should reject reuse of the same key with a materially different request.

Example error:

```text
IDEMPOTENCY_KEY_REUSED
```

---

# 81. Optimistic Concurrency

Some resources may use:

```text
version
```

Example response:

```json
{
  "data": {
    "id": "uuid",
    "version": 5
  }
}
```

A later mutation can include:

```http
If-Match: "5"
```

This is optional initially and should be introduced where concurrent editing is a real concern.

---

# 82. API Resource Ownership

The backend derives ownership from authentication.

For example:

```http
GET /api/v1/service-requests/{id}
```

does not mean:

```text
"any authenticated user can read it."
```

The application layer verifies:

```text
request.customerId == authenticatedCustomerId
```

or the caller has an appropriate administrative permission.

---

# 83. API Rate Limiting

Rate limits should exist for abuse-sensitive endpoints.

Especially:

```text
OTP request
OTP verification
Login/authentication
Payment creation
Review submission
Dispute creation
File upload
Search endpoints
```

Example response:

```http
429 Too Many Requests
```

with:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": {},
    "traceId": "..."
  }
}
```

---

# 84. API Security Headers

Production API should use appropriate security headers through the gateway/application stack.

We should also consider:

```text
TLS
CORS
CSRF strategy
Content-Type validation
Request size limits
File upload validation
Rate limiting
Authentication
Authorization
```

These will be covered more deeply in the security document.

---

# 85. File Upload API

For photos/documents, avoid sending huge multipart payloads through every application request.

A future design can use:

```text
1. Request upload authorization
2. Generate pre-signed upload URL
3. Client uploads directly to object storage
4. Client sends uploaded object reference
5. Backend validates/records attachment
```

Example conceptual endpoint:

```http
POST /api/v1/service-requests/{id}/attachments/upload-url
```

This is not required for the first coding iteration if a simpler upload mechanism is sufficient.

---

# 86. API Contract and Database Independence

This is critical.

Database:

```text
worker_profiles
worker_skills
worker_verifications
```

does not imply APIs:

```text
/workers
/worker-skills
/worker-verifications
```

The API should represent **business resources and use cases**, not database tables.

---

# 87. API Contract and Domain Independence

Similarly:

```text
ServiceRequest
```

does not mean the API must expose every internal domain field.

For example, internal:

```text
matchScore
internalRankingReason
fraudRisk
internalAdminNotes
```

should not automatically appear in:

```text
ServiceRequestResponse
```

---

# 88. OpenAPI

The API should be formally documented using OpenAPI.

Spring Boot can expose:

```text
/api-docs
/swagger-ui
```

during development.

The exact documentation URL and production exposure policy will be finalized later.

---

# 89. OpenAPI Contract

The OpenAPI specification should document:

```text
paths
parameters
request bodies
responses
schemas
authentication
error codes
pagination
examples
```

The OpenAPI specification should be treated as part of the engineering contract.

---

# 90. API Testing

Every important endpoint should have:

### Unit tests

For:

```text
mapping
validation
application behavior
```

### Integration tests

For:

```text
database
security
transactions
repositories
```

### API tests

For:

```text
HTTP status
request validation
response JSON
authorization
error contract
```

---

# 91. Example API Test

Request:

```http
POST /api/v1/jobs/123/complete
Authorization: Bearer <worker-token>
```

Expected:

```http
200 OK
```

and:

```json
{
  "data": {
    "jobId": "123",
    "status": "WORK_COMPLETED"
  }
}
```

If job is already completed:

```http
409 Conflict
```

with:

```json
{
  "error": {
    "code": "INVALID_JOB_STATE",
    "message": "The job cannot be completed from its current state.",
    "details": {},
    "traceId": "..."
  }
}
```

---

# 92. Complete Endpoint Map

```text
AUTH
POST   /auth/otp/request
POST   /auth/otp/verify
POST   /auth/refresh
POST   /auth/logout

CURRENT USER
GET    /me
PATCH  /me

CUSTOMER
GET    /customer/addresses
POST   /customer/addresses
PATCH  /customer/addresses/{id}
DELETE /customer/addresses/{id}

WORKER
POST   /workers
GET    /workers/me
PATCH  /workers/me
PUT    /workers/me/professions
PUT    /workers/me/professions/{id}/rates
PUT    /workers/me/professions/{id}/skills
GET    /workers/me/readiness
PATCH  /workers/me/availability
POST   /workers/me/verifications

CATALOG
GET    /catalog/professions
GET    /catalog/professions/{id}
GET    /catalog/professions/{id}/skills

SERVICE REQUEST
POST   /service-requests
GET    /service-requests
GET    /service-requests/{id}
POST   /service-requests/{id}/submit
POST   /service-requests/{id}/cancel
GET    /service-requests/{id}/matches
POST   /service-requests/{id}/attachments

MATCHING
POST   /workers/me/offers/{id}/accept
POST   /workers/me/offers/{id}/decline

BOOKING
GET    /bookings/{id}
POST   /bookings/{id}/confirm
POST   /bookings/{id}/cancel
POST   /bookings/{id}/reschedule

JOB
POST   /jobs/{id}/en-route
POST   /jobs/{id}/arrive
POST   /jobs/{id}/start
POST   /jobs/{id}/complete
POST   /jobs/{id}/no-show
POST   /jobs/{id}/cancel

ADDITIONAL WORK
POST   /jobs/{id}/additional-work
POST   /additional-work/{id}/approve
POST   /additional-work/{id}/reject

PAYMENT
POST   /payments
GET    /payments/{id}
POST   /payments/{id}/refund

REVIEWS
POST   /jobs/{id}/reviews
GET    /workers/{id}/reviews

DISPUTES
POST   /jobs/{id}/disputes
GET    /disputes/{id}
POST   /disputes/{id}/evidence

NOTIFICATIONS
GET    /notifications
POST   /notifications/{id}/read
POST   /notifications/read-all

WEBHOOKS
POST   /webhooks/payments/{provider}

ADMIN
GET    /admin/workers
GET    /admin/workers/{id}
POST   /admin/workers/{id}/suspend
GET    /admin/verifications
POST   /admin/verifications/{id}/approve
POST   /admin/verifications/{id}/reject
GET    /admin/disputes
POST   /admin/disputes/{id}/resolve
GET    /admin/jobs
GET    /admin/payments
GET    /admin/audit-events
```

---

# 93. Important API Design Rule

We should never create an endpoint simply because:

```text
"there is a database table."
```

Instead ask:

```text
What user/system action does this represent?
```

For example:

```text
POST /jobs/{id}/complete
```

represents a meaningful business action.

Whereas:

```text
PATCH /jobs/{id}
```

with arbitrary status changes exposes internal implementation.

---

# 94. API Contract Stability

Once mobile/web clients depend on:

```text
/api/v1
```

we should assume that the API will live for a long time.

Therefore:

```text
Do not casually rename fields.
Do not casually change enum semantics.
Do not expose internal entities.
Do not leak database structure.
Do not return unstable error messages as machine contracts.
```

---

# 95. API Evolution Strategy

When requirements change:

```text
Requirement
    ↓
Domain change?
    ↓
Application change?
    ↓
API contract change?
    ↓
Breaking?
    ├── NO → backward-compatible change
    └── YES → migration/version strategy
```

This prevents unnecessary API version proliferation.

---

# 96. Final API Architecture

```text
                    CLIENT
                      │
                      ▼
              ┌───────────────┐
              │ REST API v1   │
              └───────┬───────┘
                      │
             ┌────────┴────────┐
             │                 │
             ▼                 ▼
        Authentication    Validation
             │                 │
             └────────┬────────┘
                      ▼
              Application Layer
                      │
             ┌────────┼─────────┐
             ▼        ▼         ▼
          Domain   Repositories  Ports
             │        │         │
             ▼        ▼         ▼
          Rules   PostgreSQL   Providers
```

---

# 97. Current Design Position

We now have:

```text
PRODUCT
   ↓
REQUIREMENTS
   ↓
BUSINESS RULES
   ↓
DOMAIN MODEL
   ↓
JAVA MODEL
   ↓
APPLICATION USE CASES
   ↓
REST API CONTRACT
```

This is a significant milestone.

The API is now defined independently from the database and Java persistence implementation.

---

# 98. Next Document

The next document should address the most security-sensitive part of the platform:

# [security/01](../security/01-authentication-authorization-and-identity.md) — Authentication, Authorization & Identity Security Design

It will define:

```text
User identity
Phone/OTP authentication
Access tokens
Refresh tokens
Sessions
JWT vs opaque tokens
Spring Security
Roles
Permissions
Resource ownership
Worker/customer/admin authorization
Token rotation
Logout
OTP security
Rate limiting
Account takeover protection
Device/session management
Security boundaries
```

After that we will design the **Matching Engine**, followed by **Payments**, **Notifications**, **Redis**, **Outbox/Async Processing**, **Testing**, **Security hardening**, and **Deployment**.

The important thing is that we are now designing the system **from the business outward**, rather than starting with Spring Boot controllers and database tables and trying to invent the business later.
