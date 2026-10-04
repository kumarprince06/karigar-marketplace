# Functional Requirements & Business Rules

### Karigar Marketplace — Version 1.0

**Document Status:** Draft for Product/Engineering Review
**Related Documents:**

* 01 — Product Scope & Vision
* 02 — User Roles, Personas & User Journeys

**Initial Market:** Howrah / Kolkata
**Initial Categories:** Electrician + Plumber

---

# 1. Purpose

This document converts the product vision and user journeys into precise system requirements.

It defines:

* What the system must do
* What users can and cannot do
* Business rules
* State transitions
* Validation rules
* Marketplace rules
* Trust and verification rules
* Cancellation behavior
* Payment behavior
* Dispute behavior
* Notification requirements
* Administrative controls
* MVP boundaries

This document will be used to derive:

```text
Functional Requirements
        ↓
Business Rules
        ↓
Domain Entities
        ↓
State Machines
        ↓
ERD
        ↓
Database Constraints
        ↓
API Contracts
        ↓
Application Services
```

---

# 2. Requirement Classification

We will classify requirements as:

### Must Have

Required for the MVP.

### Should Have

Important but can be implemented after the core marketplace works.

### Future

Potential capability, not part of MVP.

---

# 3. Actors

| Actor                 | Description                       |
| --------------------- | --------------------------------- |
| Customer              | Person requesting a service       |
| Worker                | Independent skilled professional  |
| Admin                 | Platform operator                 |
| Payment Provider      | External payment system           |
| Notification Provider | SMS/WhatsApp/email provider       |
| Maps Provider         | External geolocation/maps service |

---

# 4. Customer Functional Requirements

## FR-CUS-001 — Customer Registration

The system shall allow a customer to register using email and password, and must collect a mobile number. ([ADR 0016](../adr/0016-email-password-login-phone-otp-later.md))

### Requirements

* Email required and must be unique (case-insensitive)
* Password required
* Mobile number required and must be unique
* Account cannot be considered verified until the email is verified
* Mobile OTP verification and phone-only login are added in a later phase, when an SMS provider is in place

### Priority

**Must Have**

---

# 5. Customer Profile

## FR-CUS-002 — Customer Profile

Customer shall be able to maintain:

* Name
* Profile photo
* Phone number
* Email (required; changing it requires re-verification)

The phone number can be changed by the user from the profile, but a number already used by another account is rejected. Once SMS OTP is available, changing the phone number requires OTP verification of the new number. ([ADR 0016](../adr/0016-email-password-login-phone-otp-later.md))

---

# 6. Customer Addresses

## FR-CUS-003 — Manage Addresses

Customer shall be able to:

* Add address
* Edit address
* Delete address
* Set default address
* Select address during service request

Each address should contain sufficient location information for service delivery.

Address data (Indian format):

```text
Address
├── label               (Home, Office, Parents' house, Shop ...)
├── property_type       (Flat, Independent house, Shop, Office, Other)
├── house_no            (required)
├── building_name
├── street
├── locality / para     (required)
├── landmark
├── city, district, state (required)
├── pincode             (required, 6 digits)
├── floor_number, has_lift
├── address_for         (Self, Family, Relative, Tenant, Business, Other)
├── contact name + phone (required unless the address is the customer's own)
└── map location        (required: GPS or map pin)
```

Rules:

* An address is a saved service location, not necessarily the customer's own home; customers can save addresses of family, relatives, tenants or shops.
* The customer must save an address before it can be used for a service request.
* The platform serves only listed service areas (localities / PIN codes). An address outside an active area can be saved, but a service request cannot be placed; the customer sees "We're not in your area yet".
* Each service request keeps its own copy of the address at the time of booking; editing an address later does not change past requests.
* The on-site contact phone is shown to the worker only after the booking is confirmed.

---

# 7. Create Service Request

## FR-CUS-004 — Create Service Request

Booking a worker must be possible in three short steps (about 30 seconds):

1. **What:** pick a category and trade, or search in any language ("fan", "পাখা", "पंखा"); tap one or more common problems (e.g. "Fan not working"). Typing is optional; a photo or voice note can be added instead.
2. **Where and when:** a saved address (default preselected, can be someone else's place) and **Now**, **Today** or a chosen date/time.
3. **Confirm:** see the price guide for the chosen problems, then "Find worker".

Rules:

* Customers can browse categories, trades and price guides without logging in; login is required only to submit.
* The request contains: trade, selected problems, optional description / photos / voice note, saved address, urgency (NOW / TODAY / SCHEDULED) and preferred time.
* **Emergency (24×7):** for urgent problems (burst pipe, sparking, no power, overflowing toilet) the customer can request help at any hour; an emergency surcharge is shown before confirming; only police-verified workers who opted in receive emergency jobs.
* **Drafts:** a request can be saved and finished later on any device; drafts expire after 30 days.
* **Advance payment:** an advance is paid online when placing the request; matching starts only after payment. It is refunded in full if no worker is booked (cancelled, expired, no match) and deducted from the final bill if a worker is booked.
* "Book again" repeats a past request (same trade, problems, address, worker) in one tap.
* Customers can save workers to "My workers"; a request can be sent to a saved worker first.

Example:

```text
Category:
PLUMBING

Description:
Kitchen tap leaking continuously.

Preferred:
Today
18:00–20:00

Location:
Customer address
```

---

# 8. Service Request Validation

A request cannot be created unless:

* Customer is authenticated
* Category is valid
* Description is present
* Location is available
* Preferred time is valid
* Requested service is currently supported

---

# 9. Request Lifecycle

A service request should have its own lifecycle.

Initial proposed states:

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

Important:

**Service Request status and Job status should not automatically be treated as the same thing.**

This distinction will matter when designing the domain model.

---

# 10. Worker Registration

## FR-WRK-001 — Worker Registration

A worker shall be able to create an account using:

* Email (unique)
* Password
* Mobile number (unique; OTP verification added in a later phase)
* Name
* Primary trade (profession) and experience in it

Additional trades, rates and other profile information can be added later.

A worker may register more than one trade (e.g. raj mistri + tiles mistri), with exactly one primary trade and separate experience per trade.

---

# 11. Worker Profile

## FR-WRK-002 — Worker Profile

Worker profile should support:

* Name
* Photo
* Trades (one primary, optional additional), with experience per trade
* Rates per trade: visit charge, hourly, half-day, daily wage (hajira), per unit (sq ft, point, piece…), minimum charge
* Skills (only within registered trades)
* Service areas
* Description
* Languages
* Verification status

Example:

```text
Ramesh Kumar

Profession:
Electrician

Experience:
8 years

Skills:
- House Wiring
- Fan Repair
- Switch Repair
- Inverter Installation

Service Area:
Howrah
```

---

# 12. Worker Skills

## FR-WRK-003 — Worker Skills

Worker shall be associated with one or more skills.

Example:

```text
Worker
   │
   ├── Electrician
   │      ├── Fan Repair
   │      ├── Wiring
   │      └── Switch Repair
   │
   └── Other Skills
```

The system must not assume that:

> Profession = Skill.

A worker can belong to a profession and have multiple specific skills.

---

# 13. Worker Verification

## FR-WRK-004 — Worker Verification

Worker verification shall be represented independently from worker registration.

Initial verification may include:

* Mobile verification
* Identity verification
* Profile verification

Future verification may include:

* Skill verification
* Certifications
* Background verification

The system should therefore not use a simple:

```text
is_verified = true
```

for all future verification requirements.

Instead, verification should eventually support multiple verification types.

Verification types (India):

* Email (MVP), phone OTP (later phase)
* Aadhaar e-KYC via DigiLocker or offline e-KYC; only the masked number is kept, never the full Aadhaar number or card copy
* PAN (needed for TDS on payouts)
* Police verification certificate
* Skill certificates (ITI, NSDC / Skill India) and trade licences (e.g. electrical wireman permit), per trade
* Selfie match against the ID photo
* Bank / UPI account verification before payouts

Rules:

* Which checks are mandatory is configured per trade; a worker receives jobs for a trade only when its mandatory checks are verified and not expired.
* Workers must be 18 or older.
* The same Aadhaar, PAN or licence cannot verify two worker accounts.
* Expiring documents (licences, police verification) trigger a reminder 30 days before expiry and stop jobs when expired.
* Customers see badges only (e.g. "ID verified", "Police verified"), never the documents.

---

# 14. Worker Availability

## FR-WRK-005 — Worker Availability

Worker shall be able to indicate whether they are currently accepting jobs.

Initial states:

```text
AVAILABLE
UNAVAILABLE
```

Future versions may support detailed schedules.

---

# 15. Worker Service Area

## FR-WRK-006 — Service Area

Worker shall define where they are willing to provide services.

This may initially be represented by:

* Location
* Radius

or:

* Selected localities

Later this can become more sophisticated.

---

# 16. Worker Job Discovery

## FR-WRK-007 — Receive Relevant Jobs

The system shall identify suitable workers based on:

1. Required skill
2. Service area
3. Geographic distance
4. Availability
5. Account/verification status
6. Other marketplace rules

The matching system should not send every job to every worker.

---

# 17. Worker Job Response

## FR-WRK-008 — Accept/Reject

Worker shall be able to:

```text
ACCEPT
REJECT
```

a job opportunity.

A rejection does not automatically imply poor worker performance.

For example:

```text
Worker rejects:
"Too far away"
```

should not necessarily negatively affect worker reputation.

---

# 18. Matching Requirements

## FR-MAT-001 — Find Eligible Workers

Given:

```text
Service Request
+
Location
+
Required Skill
+
Requested Time
```

the system shall produce a set of eligible workers.

---

# 19. Matching Eligibility

A worker is initially eligible if:

```text
Worker is active
AND
Worker is available
AND
Worker has required skill
AND
Worker serves requested area
AND
Worker account is allowed to receive jobs
```

Additional rules may be added later.

---

# 20. Geographic Matching

The system shall support distance-based matching.

For example:

```text
Initial radius:
3 km
```

If insufficient workers exist:

```text
3 km
 ↓
5 km
 ↓
8 km
```

The exact radius strategy will be determined after marketplace testing.

The system should use proper geospatial queries rather than calculating distance in application code for every worker.

---

# 21. Worker Acceptance Race Condition

Multiple workers may accept the same request simultaneously.

Example:

```text
Job #1001

Worker A → Accept
Worker B → Accept
Worker C → Accept
```

The system must handle this safely.

Only valid candidates may proceed to the customer selection/confirmation process.

The final confirmed booking must never produce inconsistent state such as:

```text
Job #1001
Confirmed Worker = A
Confirmed Worker = B
```

Concurrency control will therefore be required.

---

# 22. Customer Worker Selection

## FR-MAT-002

**The customer picks the worker** ([ADR 0017](../adr/0017-customer-picks-the-worker.md)).

* Nearby verified, available workers with the right trade are notified; interested workers accept, stating their visit charge and how soon they can come.
* The customer sees up to 3 accepted workers as soon as each one accepts, and picks one; that creates the booking.
* Workers not picked are informed. If no one accepts, the search widens; if still no one, the customer can retry or change the time.

Shown for each accepted worker:

Worker information may include:

* Name
* Skills
* Experience
* Rating
* Completed jobs
* Distance
* Availability
* Verification indicators

---

# 23. Worker Information Privacy

Customer should only receive information necessary to complete the transaction.

The platform should avoid unnecessarily exposing:

* Government ID
* Sensitive personal information
* Internal worker data
* Private verification documents

Phone-number exposure will be a separate product decision.

---

# 24. Booking Creation

## FR-BOOK-001

A booking is created when the customer selects/accepts a worker according to the marketplace workflow.

A booking must reference:

* Customer
* Worker
* Service request
* Scheduled time
* Booking status

---

# 25. Booking Uniqueness

For the initial model:

> One service request can have at most one confirmed worker.

Multiple candidate workers may exist before confirmation.

---

# 26. Booking State

Initial booking states:

```text
PENDING
CONFIRMED
CANCELLED
EXPIRED
COMPLETED
```

Additional states may be introduced if real-world workflows require them.

---

# 27. Worker Journey State

Once a booking is confirmed:

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

These states represent execution, not payment.

---

# 28. State Transition Rule

The system must prevent invalid transitions.

For example:

```text
CANCELLED → WORK_STARTED
```

must not be allowed.

Likewise:

```text
WORK_COMPLETED → EN_ROUTE
```

should not normally be allowed.

All allowed transitions should eventually be explicitly documented.

---

# 29. Worker En Route

## FR-JOB-001

Worker can mark:

```text
EN_ROUTE
```

after the booking is confirmed.

Customer receives appropriate notification.

---

# 30. Worker Arrival

Worker can mark:

```text
ARRIVED
```

The system records:

```text
arrived_at
```

Future versions may validate arrival location.

---

# 31. Start Work

Worker can mark:

```text
WORK_STARTED
```

System records:

```text
work_started_at
```

---

# 32. Complete Work

Worker can request completion.

System records:

```text
completed_at
completed_by
```

Customer may subsequently confirm completion or raise a dispute according to the final workflow.

---

# 32.1 Multi-Day Jobs and Daily Attendance

## FR-JOB-003

A booking can be a single visit (e.g. tap repair) or multi-day (e.g. masonry, painting, renovation).

* Every job has one or more visits; a multi-day job has one visit per working day.
* For each visit the worker checks in (with location) and enters a 4-digit start code given by the customer or on-site contact, then checks out with a short work summary.
* Each visit records day type (visit, half day, full day) and helpers (jogare) present.
* The amount due per visit is calculated by the backend from the agreed rate; the customer or on-site contact confirms the day, or it is auto-confirmed after a set time unless disputed.
* The payment schedule is agreed at booking: on completion, daily, weekly or by milestone.
* Extra days beyond the planned days need customer approval.
* A worker cannot be booked for two overlapping visits.

---

# 33. Additional Work

## FR-JOB-002

Worker shall be able to request additional work/charges.

Example:

```text
Original:
Fan repair ₹300

Additional:
Capacitor replacement ₹200
```

The request must contain:

* Description
* Reason
* Amount
* Worker
* Job
* Timestamp

Quotes and additional work are itemised:

* Each quote (initial, revision or additional) has line items: labour, material, helpers, visit charge, transport, discount.
* Each material line states who supplies it (worker or customer); customer-supplied material is listed at ₹0 so the scope is clear.
* Quantities use real units (sq ft, running ft, point, piece, day, bag, kg, litre, metre, cft).
* A submitted quote cannot be edited; changes create a revision that the customer must accept.
* The worker uploads shop bills for material bought; amounts above the quoted material need customer acknowledgement.

---

# 34. Additional Work Authorization

Additional charges should require customer approval.

States:

```text
REQUESTED
   ↓
APPROVED
```

or:

```text
REQUESTED
   ↓
REJECTED
```

Potential future:

```text
EXPIRED
CANCELLED
```

---

# 35. Customer Cancellation

Customer can cancel subject to booking/job state.

The cancellation must record:

* Cancelled by
* Timestamp
* Reason
* Current state

---

# 36. Worker Cancellation

Worker can cancel subject to booking/job state.

The system must record:

* Worker
* Reason
* Timestamp
* Customer impact

---

# 37. Cancellation Is Not No-Show

The system must distinguish:

```text
WORKER_CANCELLED
```

from:

```text
WORKER_NO_SHOW
```

because they represent different behaviors.

Similarly:

```text
CUSTOMER_CANCELLED
```

is different from:

```text
CUSTOMER_NO_SHOW
```

---

# 38. Replacement Worker

If a confirmed worker cancels before service:

```text
Worker cancellation
       ↓
Customer notification
       ↓
Replacement matching
```

The customer should not necessarily have to create a new service request.

---

# 39. Payment

## FR-PAY-001

The platform shall maintain payment records independently from job status.

Possible initial payment states:

```text
INITIATED
PENDING
SUCCESS
FAILED
REFUNDED
PARTIALLY_REFUNDED
```

## FR-PAY-002 — Payment Methods and Schedules

* Customers can pay online (UPI, card, net banking, wallet) through the payment provider, or in **cash** to the worker.
* A job can have several payments: visit charge, material advance, daily/weekly wages, milestones and the final balance.
* Cash payments are recorded when the worker marks them received and the customer confirms. The platform fee on cash jobs is owed by the worker and recovered from their next online payout.
* The payment amount is always calculated by the backend from confirmed visits and accepted quotes.

## FR-PAY-003 — Worker Earnings and Payouts

* Workers must add and verify a **bank account** (IFSC, penny-drop check) before they can receive their first job; a UPI ID can be added as an extra payout option.
* Each payment shows the worker their gross amount, platform fee, taxes deducted and net amount.
* Payouts go to the verified account with a bank reference (UTR) shown to the worker.
* Refunds after a payout are recovered from the worker's future earnings.

## FR-PAY-004 — GST Invoices

* A GST-compliant invoice is issued for each paid job, with consecutive invoice numbers per financial year.
* Business customers can add their GSTIN to receive a B2B invoice.
* Applicable GST, TCS and TDS rules must be confirmed with a chartered accountant before launch.

---

# 40. Payment Principle

A critical rule:

> Payment success does not automatically mean job completion, and job completion does not automatically mean payment success.

These are separate domain concepts.

---

# 41. Payment Idempotency

Payment operations must support idempotency.

Example:

Customer presses:

```text
PAY
```

twice.

The system must not accidentally create:

```text
₹500 payment
+
₹500 payment
```

for a single intended transaction.

---

# 42. Payment Provider Webhooks

External payment provider notifications must be treated as asynchronous events.

Example:

```text
Payment initiated
       ↓
Provider
       ↓
Webhook
       ↓
Backend
       ↓
Validate webhook
       ↓
Update payment
```

The system must not trust only the client-side payment result.

---

# 43. Worker Earnings

Worker earnings should be derived from completed/settled transactions.

Potential future calculation:

```text
Gross Amount
     -
Platform Fee
     -
Applicable Adjustments
     =
Worker Earnings
```

Exact business rules are intentionally not finalized in MVP.

---

# 44. Reviews

## FR-REV-001

After eligible completed jobs, customers can submit a review.

Initial review:

```text
Rating: 1–5
Comment: optional
```

---

# 45. Review Rules

Possible initial rules:

* Only eligible customers can review.
* A review must belong to a completed service.
* One customer should not create unlimited reviews for the same job.
* Reviews should not be editable indefinitely.
* Deleted/suspended accounts should not automatically erase historical marketplace records.

Exact moderation rules will be finalized later.

---

# 46. Worker Reputation

Reputation should not be stored as only:

```text
worker.rating = 4.8
```

The system should retain the underlying historical events.

For example:

```text
Reviews
Completed Jobs
Cancellations
No-shows
Repeat Customers
Disputes
```

The displayed reputation can then be calculated from underlying data.

This preserves flexibility.

---

# 47. Disputes

## FR-DIS-001

Customer or worker may create a dispute for an eligible job.

Examples:

* Work incomplete
* Poor workmanship
* Damage
* Payment issue
* Incorrect additional charge
* Customer unavailable
* Worker did not arrive

---

# 48. Dispute Lifecycle

Initial model:

```text
OPEN
  ↓
UNDER_REVIEW
  ↓
RESOLVED
```

Possible terminal resolution:

```text
CUSTOMER_FAVOUR
WORKER_FAVOUR
PARTIAL
NO_ACTION
```

These are resolution outcomes, not user ratings.

---

# 49. Evidence

Disputes may reference:

* Job details
* Photos
* Messages
* Payment records
* Timestamps
* Worker/customer responses

Future evidence types can be added.

---

# 50. Admin Controls

Admin must be able to:

### Users

* Search
* View
* Suspend
* Reactivate

### Workers

* Review verification
* Approve
* Reject
* Suspend

### Jobs

* Search
* View lifecycle
* View participants
* View payment
* View dispute

### Reviews

* Investigate
* Moderate where justified

---

# 51. Worker Suspension

A suspended worker:

```text
Cannot receive new jobs
```

but historical jobs should remain available for audit/history.

Existing active bookings require a defined operational policy.

---

# 52. Account Deactivation

Deactivating an account must not necessarily delete transactional history.

For example:

```text
Customer deleted account
```

should not cause:

```text
Payment disappears
Job disappears
Dispute disappears
```

Financial and operational records need appropriate retention.

---

# 53. Notifications

Important events should generate notifications.

Examples:

```text
Service Request Created
Worker Accepted
Booking Confirmed
Worker En Route
Worker Arrived
Additional Work Requested
Additional Work Approved
Job Completed
Payment Successful
Payment Failed
Booking Cancelled
Worker Cancelled
Dispute Created
Dispute Updated
```

---

# 54. Notification Delivery

Notifications may eventually use:

```text
In-app
Push
SMS
WhatsApp
Email
```

MVP can start with a smaller subset.

The business event should not be tightly coupled to one notification provider.

---

# 55. Notification Failure

If an SMS/WhatsApp notification fails:

> The underlying booking/job transaction must not automatically fail.

Example:

```text
Booking confirmed
      ↓
Notification provider fails
      ↓
Booking remains CONFIRMED
```

Notification delivery is a separate concern.

---

# 56. Authentication

All protected operations require authentication.

Examples:

```text
Create service request
Accept job
View personal bookings
Submit review
Make payment
```

---

# 57. Authorization

Authentication asks:

> Who are you?

Authorization asks:

> Are you allowed to perform this operation?

Example:

Customer A must not be able to:

```text
Cancel Customer B's booking
```

Worker A must not be able to:

```text
Complete Worker B's job
```

Admin permissions should be separately controlled.

---

# 58. Resource Ownership

The system must verify ownership before modifying resources.

Example:

```text
GET /bookings/123
```

does not mean every authenticated user can see booking 123.

The system must verify whether the requester is authorized to access it.

---

# 59. Location Requirements

The system must support:

* Latitude
* Longitude
* Address
* Service area
* Distance calculation

Location information must be handled carefully because it can reveal sensitive information about users.

Only necessary location information should be exposed to each actor.

---

# 60. Worker Matching Rules

Initial candidate ranking may consider:

```text
Distance
+
Skill compatibility
+
Availability
+
Verification
+
Reliability
+
Customer preference
```

The exact scoring algorithm should remain replaceable.

We should avoid hard-coding the entire marketplace strategy into one SQL query.

---

# 61. Matching Must Be Explainable

If a worker is selected as a candidate, the system should eventually be able to explain why.

Example:

```text
Matched because:

✓ Plumber
✓ 1.8 km away
✓ Available
✓ Service area includes customer
✓ Verified
```

This becomes especially useful when matching becomes more sophisticated.

---

# 62. Service Request Expiration

Requests should not remain active forever.

Example:

```text
Customer requested:
Today 6–8 PM
```

After the relevant window passes:

```text
EXPIRED
```

The exact expiration mechanism will be finalized during workflow design.

---

# 63. Duplicate Requests

The platform should eventually detect obvious duplicate requests.

Example:

Customer creates:

```text
Request #100
Fan not working
```

and immediately creates:

```text
Request #101
Fan repair
```

The system may warn the customer or allow it depending on the final UX.

This should not initially block legitimate requests automatically.

---

# 64. Worker Duplicate Acceptance

The system must prevent a worker from accepting the same assignment multiple times due to:

* Double-click
* Retry
* Network timeout
* Duplicate request
* Concurrent requests

This requires idempotent command handling.

---

# 65. Network Failure

Real mobile networks are unreliable.

Example:

Worker taps:

```text
Accept
```

but receives no response.

Worker taps again.

The system must avoid creating duplicate acceptance records.

This is a backend correctness requirement.

---

# 66. API Retry Safety

Operations such as:

* Accept job
* Cancel booking
* Complete job
* Initiate payment

should be designed for safe retry where appropriate.

---

# 67. Time Handling

All important events should record timestamps.

Examples:

```text
created_at
accepted_at
confirmed_at
en_route_at
arrived_at
started_at
completed_at
cancelled_at
```

The backend should use a consistent timezone strategy.

User-facing times can be localized.

---

# 68. Audit Trail

Important business operations should be auditable.

Example:

```text
Booking #1001

18:01 Created
18:03 Worker A accepted
18:05 Customer confirmed
18:40 Worker en route
18:52 Worker arrived
19:30 Work completed
19:35 Payment successful
19:40 Review submitted
```

This becomes extremely useful for:

* Disputes
* Debugging
* Customer support
* Fraud detection
* Analytics

---

# 69. Business Rule Categories

We will maintain business rules under these categories:

```text
BR-A  Account
BR-W  Worker
BR-C  Customer
BR-M  Matching
BR-B  Booking
BR-J  Job
BR-P  Payment
BR-R  Review
BR-D  Dispute
BR-N  Notification
BR-S  Security
BR-L  Location
```

---

# 70. Core Business Rules

## BR-A-001

A phone number can belong to only one active user account.

---

## BR-W-001

A worker cannot receive marketplace jobs until the minimum required verification is complete.

---

## BR-W-002

Worker availability is independent from account existence.

---

## BR-W-003

A worker marked unavailable must not receive new marketplace assignments.

---

## BR-W-004

Worker skills must come from supported platform-defined skills.

---

## BR-M-001

A worker must satisfy minimum matching criteria before receiving a job.

---

## BR-M-002

Distance must be calculated using geographic coordinates rather than simple textual addresses.

---

## BR-M-003

Multiple workers may be candidates for one request, but only one worker can ultimately hold the confirmed booking in the MVP.

---

## BR-M-004

Concurrent acceptance must be handled atomically.

---

## BR-B-001

A booking cannot be confirmed without a valid service request.

---

## BR-B-002

A cancelled booking cannot transition back to an active execution state.

---

## BR-B-003

A confirmed worker cancellation should trigger customer notification and, where applicable, replacement matching.

---

## BR-J-001

A job cannot be marked completed before the appropriate execution stage.

---

## BR-J-002

Additional work requires customer authorization.

---

## BR-J-003

Worker no-show and worker cancellation must be represented separately.

---

## BR-P-001

Payment state must be independent from job state.

---

## BR-P-002

Payment provider callbacks must be validated before updating payment state.

---

## BR-P-003

The same logical payment operation must not produce duplicate charges.

---

## BR-R-001

Only eligible completed jobs can generate customer reviews.

---

## BR-R-002

The system must retain the underlying review records used to calculate reputation.

---

## BR-D-001

Disputes must reference a specific transaction/job context.

---

## BR-D-002

Dispute resolution must not silently modify historical job data.

---

## BR-S-001

Users can only access resources they are authorized to access.

---

## BR-S-002

Administrative actions must be auditable.

---

## BR-L-001

Worker/customer location must only be exposed where necessary for service execution.

---

# 71. Critical State Machines

The next architecture phase will define these formally.

### Service Request

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

Alternative:

```text
SUBMITTED → FAILED_TO_MATCH
SUBMITTED → CANCELLED
MATCHING → CANCELLED
MATCH_FOUND → CANCELLED
```

---

### Booking

```text
PENDING
   ↓
CONFIRMED
   ↓
CANCELLED
```

or:

```text
CONFIRMED
   ↓
COMPLETED
```

---

### Job

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

Exceptions:

```text
CONFIRMED → WORKER_CANCELLED
CONFIRMED → CUSTOMER_CANCELLED
EN_ROUTE → WORKER_NO_SHOW
ARRIVED → CUSTOMER_NO_SHOW
WORK_COMPLETED → DISPUTED
```

---

### Payment

```text
INITIATED
    ↓
PENDING
    ↓
SUCCESS
```

Alternative:

```text
PENDING → FAILED
SUCCESS → REFUNDED
SUCCESS → PARTIALLY_REFUNDED
```

---

### Dispute

```text
OPEN
  ↓
UNDER_REVIEW
  ↓
RESOLVED
```

---

# 72. Important Design Decision

We should **not create one giant status field** such as:

```text
job.status
```

and attempt to represent:

```text
matching
booking
worker travel
work
payment
dispute
```

inside it.

These are different business dimensions.

A future domain model should separate them appropriately.

---

# 73. MVP Functional Requirement Summary

The MVP must support:

```text
ACCOUNT
 ├── Customer registration
 └── Worker registration

WORKER
 ├── Profile
 ├── Skills
 ├── Verification
 ├── Availability
 └── Service area

CUSTOMER
 ├── Profile
 ├── Addresses
 └── Service requests

MARKETPLACE
 ├── Worker matching
 ├── Job acceptance
 └── Worker selection/confirmation

JOB
 ├── En route
 ├── Arrived
 ├── Started
 ├── Completed
 └── Cancellation

PAYMENT
 ├── Payment creation
 ├── Provider integration
 ├── Webhook
 └── Payment state

TRUST
 ├── Reviews
 ├── Worker reputation
 └── Verification

OPERATIONS
 ├── Admin
 ├── Disputes
 └── Audit history

NOTIFICATIONS
 └── Important lifecycle events
```

---

# 74. Explicitly Deferred Decisions

The following should **not** be prematurely fixed:

### Pricing

* Fixed pricing
* Worker quote
* Platform estimate
* Negotiation

### Platform fee

Exact commission not decided.

### Payment timing

* Before service
* After service
* Authorization/hold
* Hybrid

### Worker verification

Exact KYC and skill verification process not finalized.

### Communication

* Direct phone
* Masked phone
* In-app chat
* WhatsApp

### Matching algorithm

Initial deterministic matching first; advanced ranking later.

### Reputation formula

Stars alone are insufficient; final formula not yet defined.

### Cancellation penalties

To be determined after marketplace behavior is understood.

These are deliberate open decisions.

---

# 75. Non-Functional Requirements — Initial

The system should eventually satisfy:

## NFR-001 — Reliability

A successful booking must not be lost because of transient network failures.

## NFR-002 — Consistency

Critical operations such as booking confirmation and payment state changes must maintain correct state.

## NFR-003 — Security

Authentication, authorization and sensitive data protection are mandatory.

## NFR-004 — Observability

Important business events should be traceable.

## NFR-005 — Scalability

The architecture should allow increasing:

* Customers
* Workers
* Jobs
* Locations
* Notifications

without immediately requiring a complete rewrite.

## NFR-006 — Maintainability

Business rules should be isolated from controllers and infrastructure code.

This is especially important because the project is also intended to teach production-grade Spring Boot architecture.

---

# 76. Engineering Principle

The application should be designed so that:

```text
Business Rule
      ↓
Domain/Application Layer
      ↓
Infrastructure
```

rather than:

```text
Controller
   ↓
Everything
```

For example:

```text
POST /jobs/{id}/accept
```

should not contain the entire business process inside the controller.

The controller should invoke an appropriate application/domain operation.

---

# 77. MVP Definition of Done

The MVP is not complete when:

> "All APIs return 200."

It is complete when a complete real-world transaction can successfully occur:

```text
Customer
   ↓
Creates real service request
   ↓
System finds real worker
   ↓
Worker receives request
   ↓
Worker accepts
   ↓
Customer confirms
   ↓
Worker travels
   ↓
Worker arrives
   ↓
Work happens
   ↓
Work completes
   ↓
Payment succeeds
   ↓
Customer reviews
   ↓
Worker reputation updates
```

And the system can correctly handle the major failure paths.

---

# 78. Requirements Traceability

Every major requirement should eventually map to:

```text
Requirement
    ↓
User Journey
    ↓
Business Rule
    ↓
Domain Entity
    ↓
API
    ↓
Database
    ↓
Test Case
```

Example:

```text
BR-J-002
Additional work requires customer authorization
        ↓
AdditionalWorkRequest entity
        ↓
POST /jobs/{id}/additional-work
        ↓
additional_work_requests table
        ↓
Integration test
```

This prevents us from building undocumented features.

---

# 79. Current Product Boundary

At this point our core domain consists of:

```text
User
Customer
Worker
Skill
Verification
Availability
Address
Service Request
Worker Match
Booking
Job
Additional Work
Payment
Review
Dispute
Notification
Audit Event
```

This is **not yet the final ERD**.

These are candidate domain concepts derived from the requirements.

We will validate and refine them before creating tables.

---

# 80. Next Document

The next document should be:

# 04 — Domain Model & State Machines

Before writing SQL or creating JPA entities, we will determine:

```text
What is an entity?
What is a value object?
What is an event?
What belongs to whom?
What has its own lifecycle?
What can exist independently?
What must be immutable?
What needs historical records?
```

Then we will formally model:

```text
User
Customer
Worker
Skill
Address
Service Request
Match
Booking
Job
Payment
Review
Dispute
...
```

and produce the first proper **domain relationship diagram**.

Only after that should we create:

**05 — ERD & Database Design**

because the ERD should be the result of the business domain, not the other way around.
