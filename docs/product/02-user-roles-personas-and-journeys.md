# User Roles, Personas & User Journeys

### Karigar Marketplace — Version 1.0

**Document Status:** Draft for Product/Engineering Review
**Related Document:** 01 — Product Scope & Vision
**Initial Market:** Howrah / Kolkata
**Initial Services:** Electrician + Plumber

---

# 1. Purpose

This document defines:

* Who uses the platform
* What each user wants
* What problems each user faces
* What each user is allowed to do
* How users interact with the platform
* What happens during normal operations
* What happens when things go wrong
* What information must be captured by the system

These journeys will later become the foundation for:

```text
User Journeys
      ↓
Functional Requirements
      ↓
Business Rules
      ↓
Domain Model
      ↓
ERD
      ↓
API Design
```

---

# 2. Primary Actors

The initial platform has three primary actors:

```text
┌─────────────────┐
│    CUSTOMER     │
└────────┬────────┘
         │
         │ requests service
         ▼
┌─────────────────┐
│    PLATFORM     │
└────────┬────────┘
         │
         │ matches work
         ▼
┌─────────────────┐
│     WORKER      │
└─────────────────┘

         +
         
┌─────────────────┐
│      ADMIN      │
└─────────────────┘
```

### Primary roles

1. Customer
2. Worker
3. Administrator

### Supporting actors

Future integrations may include:

* Payment provider
* SMS provider
* WhatsApp provider
* Maps/geolocation provider
* Identity verification provider
* Notification service

These are external systems, not primary users.

---

# 3. Persona 1 — Customer

## 3.1 Example Persona

**Name:** Ananya

**Age:** 31

**Location:** Howrah

**Situation:**

Ananya lives with her family and works during the day.

At 7:30 PM, the bathroom tap starts leaking heavily.

She doesn't have her usual plumber's number.

Her current process would probably be:

```text
Ask family
     ↓
Ask neighbour
     ↓
Search WhatsApp
     ↓
Call someone
     ↓
"Kal aaunga"
     ↓
Call another person
```

She doesn't want to become an expert at finding plumbers.

She simply wants:

> "Someone reliable who can come and fix this."

---

# 4. Customer Goals

The customer wants to:

* Find an appropriate worker quickly
* Know whether the worker is available
* Trust the worker
* Understand the expected cost/process
* Know when the worker will arrive
* Get the work completed
* Pay safely
* Have a way to complain if something goes wrong
* Find the same worker again later

---

# 5. Customer Frustrations

Potential frustrations include:

* Worker doesn't answer
* Worker says they are unavailable
* Worker accepts but doesn't arrive
* Price changes unexpectedly
* Worker isn't skilled enough
* Work is incomplete
* Worker damages something
* Worker asks for unreasonable payment
* Customer cannot contact support
* Customer cannot find the same worker again

The platform must be designed around these failures.

---

# 6. Customer Journey — Registration

```text
Customer
   ↓
Open application
   ↓
Enter phone number
   ↓
OTP verification
   ↓
Create profile
   ↓
Add address
   ↓
Account ready
```

### Important rules

* Phone number must be unique.
* OTP verification is required.
* Customer may have multiple addresses.
* One address can be marked default.
* Location should be captured with appropriate consent.

---

# 7. Customer Journey — Creating a Service Request

Example:

> "Kitchen tap is leaking."

Customer:

```text
Open application
      ↓
Select "Plumber"
      ↓
Describe problem
      ↓
Upload photo
      ↓
Select address
      ↓
Select preferred time
      ↓
Select urgency
      ↓
Submit request
```

The platform creates:

```text
Service Request
```

Example:

```text
Category: Plumbing

Problem:
"Kitchen tap leaking continuously."

Location:
Shibpur, Howrah

Preferred:
Today
6 PM – 8 PM

Urgency:
Normal
```

---

# 8. Customer Journey — Worker Matching

After request creation:

```text
Service Request
       ↓
Find eligible workers
       ↓
Skill filter
       ↓
Location filter
       ↓
Availability filter
       ↓
Worker status filter
       ↓
Ranking
       ↓
Candidate workers
```

Example:

```text
Worker A
1.2 km
4.8 rating
Available

Worker B
2.1 km
4.7 rating
Available

Worker C
3.4 km
4.9 rating
Available
```

The system should not blindly show every plumber.

It should find **appropriate candidates**.

---

# 9. Customer Journey — Selecting a Worker

Customer sees:

```text
--------------------------------
Ramesh Kumar

Plumber
4.8 ★

487 completed jobs

Experience: 8 years

Distance: 1.2 km

Available: 6–8 PM

Verified:
✓ Identity
✓ Phone
--------------------------------
```

Customer chooses the worker.

The platform creates a booking/assignment.

---

# 10. Customer Journey — Worker Accepts

There is an important distinction:

### Worker discovers job

vs.

### Worker accepts job

vs.

### Customer confirms worker

Depending on the final marketplace model, these may happen differently.

For MVP, we can initially use:

```text
Customer Request
       ↓
Eligible workers notified
       ↓
Worker accepts
       ↓
Customer sees accepted workers
       ↓
Customer selects one
       ↓
Booking confirmed
```

This allows the customer to retain choice.

---

# 11. Customer Journey — Worker En Route

After confirmation:

```text
BOOKED
  ↓
WORKER EN ROUTE
  ↓
ARRIVED
```

Customer should receive appropriate notifications.

Example:

> Your plumber has started travelling to your location.

Later:

> Your plumber has arrived.

---

# 12. Customer Journey — Work Begins

Worker:

```text
ARRIVED
   ↓
START WORK
```

Customer should know that the job has officially started.

The system records timestamps.

Example:

```text
Worker arrived:
18:42

Work started:
18:47
```

These timestamps become useful for:

* Disputes
* Analytics
* Worker reliability
* Customer support
* Future billing models

---

# 13. Customer Journey — Additional Work

This is an important real-world scenario.

Customer originally requested:

> Fix leaking tap.

Worker discovers:

> Tap cartridge is damaged.

Worker proposes:

```text
Additional Work

Description:
Replace tap cartridge

Additional amount:
₹350

Reason:
Existing cartridge damaged
```

Customer gets:

```text
Approve Additional Work
        OR
Reject Additional Work
```

### Rule

Additional work should not automatically become part of the payable amount without customer authorization, except for explicitly defined emergency rules in a future version.

---

# 14. Customer Journey — Job Completion

Worker completes work.

Worker selects:

```text
Complete Job
```

System records:

```text
completed_at
```

Customer receives:

> Worker has marked the job as completed.

Customer can:

* Confirm completion
* Raise an issue
* Proceed with payment/review

---

# 15. Customer Journey — Payment

The payment lifecycle must be independent from the job lifecycle.

Example:

```text
JOB
 ↓
COMPLETED
 ↓
PAYMENT INITIATED
 ↓
PAYMENT PROCESSING
 ↓
PAYMENT SUCCESS
 ↓
PAYMENT SETTLED
```

A failed payment must not make the job appear unpaid/paid incorrectly.

---

# 16. Customer Journey — Review

After successful completion:

```text
Rating:
★★★★★

Comment:
"Arrived on time and fixed the issue quickly."
```

The review contributes to worker reputation.

Potential future metrics:

```text
Average Rating
Completed Jobs
Repeat Customers
Cancellation Rate
No-show Rate
Response Rate
```

Not all metrics need to be exposed publicly.

---

# 17. Customer Journey — Repeat Worker

This is an important potential differentiator.

Suppose Ananya liked Ramesh's work.

Three months later:

> Kitchen sink is blocked.

Instead of starting from scratch:

```text
Customer
   ↓
Previous Workers
   ↓
Ramesh
   ↓
Request Again
```

This creates value for both sides.

Customer gets continuity.

Worker gets repeat business.

---

# 18. Customer Journey — Cancellation

A customer may cancel because:

* Worker took too long
* Problem was solved independently
* Customer found another worker
* Wrong request
* Emergency changed
* Worker became unavailable

System records:

```text
cancelled_by = CUSTOMER
cancelled_at
cancellation_reason
job_status
```

Cancellation rules may depend on the current state.

---

# 19. Customer Journey — Worker Cancellation

Example:

```text
BOOKED
   ↓
Worker cancels
   ↓
Customer notified
   ↓
Replacement matching
```

The customer should not have to recreate the request manually.

This is a key marketplace experience.

---

# 20. Customer Journey — Worker No-Show

A particularly important distinction:

```text
Worker cancels
```

is not the same as:

```text
Worker accepted
+
never arrived
```

No-show should be recorded separately.

Potential consequences:

* Reliability metric changes
* Customer notified
* Replacement matching
* Worker may receive warning
* Repeated no-shows may trigger restrictions

Exact penalty rules will be defined later.

---

# 21. Customer Journey — Customer No-Show

Worker arrives.

Customer isn't available.

Worker should be able to report:

```text
Customer unavailable
```

Potential evidence:

* Arrival timestamp
* Location
* Contact attempts

The system should avoid immediately treating this as a normal cancellation.

---

# 22. Customer Journey — Dispute

Customer believes:

> "The worker didn't solve the problem."

Flow:

```text
Job Completed
      ↓
Customer raises dispute
      ↓
Payment/dispute state created
      ↓
Evidence collected
      ↓
Worker response
      ↓
Admin review
      ↓
Resolution
```

Potential evidence:

* Photos
* Messages
* Job details
* Payment records
* Timeline
* Before/after images

---

# 23. Persona 2 — Worker

## Example Persona

**Name:** Ramesh

**Profession:** Electrician

**Experience:** 8 years

**Location:** Howrah

**Current customer acquisition:**

```text
Existing customers
      +
Neighbour referrals
      +
Contractors
      +
WhatsApp contacts
```

Ramesh may be very good at his job.

But if he has no jobs tomorrow, there is no systematic way for him to discover nearby demand.

---

# 24. Worker Goals

Worker wants:

* More relevant jobs
* Jobs close to current location
* Predictable work
* Control over which jobs to accept
* Fair payment
* Repeat customers
* Reputation
* Professional identity
* Reduced idle time

The platform should not treat workers as employees by default.

The initial model is an independent professional marketplace.

---

# 25. Worker Registration Journey

```text
Register
   ↓
Phone verification
   ↓
Personal information
   ↓
Select profession
   ↓
Select skills
   ↓
Experience
   ↓
Service area
   ↓
Verification
   ↓
Profile activated
```

Worker may initially have:

```text
Verification Status:
PENDING
```

After successful verification:

```text
VERIFIED
```

---

# 26. Worker Profile

Example:

```text
---------------------------------------
Ramesh Kumar

Electrician

Experience: 8 years

Skills:
• House wiring
• Fan repair
• Switch repair
• Inverter installation

Completed jobs:
487

Rating:
4.8 ★

Service area:
Howrah

Verification:
✓ Phone
✓ Identity

Availability:
Available
---------------------------------------
```

The profile should become more valuable over time.

---

# 27. Worker Availability

Worker controls availability:

```text
OFFLINE
   ↕
ONLINE
```

Additional availability can eventually include:

```text
Today
09:00 – 13:00
16:00 – 21:00
```

The platform should distinguish:

### Account active

from:

### Worker currently accepting jobs

These are different concepts.

---

# 28. Worker Receives Job

Example notification:

> New plumbing request 1.4 km away.

Worker sees:

```text
Category:
Plumbing

Problem:
Bathroom tap leaking

Distance:
1.4 km

Preferred:
6–8 PM

Photos:
2

Estimated job:
₹300–₹500
```

Worker can:

```text
ACCEPT
REJECT
```

---

# 29. Worker Rejection

Rejection should not necessarily be treated as a negative event.

Reasons may include:

* Too far
* Busy
* Wrong skill
* Price not suitable
* Outside service area
* Personal reason

This distinction matters.

A worker rejecting a job because it is 10 km away is not necessarily unreliable.

---

# 30. Worker Journey — Accepted Job

```text
ACCEPTED
    ↓
CONFIRMED
    ↓
EN ROUTE
    ↓
ARRIVED
    ↓
WORK STARTED
    ↓
COMPLETED
```

Every transition should be recorded.

---

# 31. Worker Journey — Additional Work

Worker discovers another issue.

Instead of verbally saying:

> "₹500 extra."

The platform can eventually support:

```text
Additional Work Request
        ↓
Customer Approval
        ↓
Approved
        ↓
Work continues
```

This creates transparency.

---

# 32. Worker Journey — Payment

Worker should eventually see:

```text
Job Amount
₹500

Platform Fee
₹X

Net Earnings
₹Y

Payment Status
PAID
```

Exact fee structure is deliberately **not defined yet**.

It should be treated as a business decision after marketplace validation.

---

# 33. Worker Journey — Cancellation

Worker can cancel an accepted job subject to defined rules.

System records:

```text
Cancellation reason
Timestamp
Job state
Customer impact
```

Repeated cancellations may affect reliability.

But the system should distinguish legitimate cancellations from abuse.

---

# 34. Worker Journey — No-Show by Customer

Worker arrives but customer isn't available.

Worker:

```text
Mark Customer Unavailable
```

System records:

```text
Arrival time
Location
Contact attempts
Status
```

This protects the worker from being unfairly marked as unsuccessful.

---

# 35. Worker Journey — Dispute

Customer disputes work.

Worker receives:

> Customer has raised an issue with this job.

Worker can:

* View complaint
* Submit explanation
* Upload evidence
* Respond to dispute

Admin can review both sides.

---

# 36. Worker Reputation Journey

Every completed job contributes to a professional history.

```text
                 WORKER
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
 Completed       Reviews      Reliability
   Jobs                         Metrics
       │            │            │
       └────────────┼────────────┘
                    ▼
              Reputation
```

The reputation system should not be reduced to a simple star rating.

Future reputation could include:

* Completed jobs
* Customer rating
* Repeat customers
* On-time arrival
* Cancellation rate
* Dispute rate
* Verified skills

---

# 37. Persona 3 — Administrator

Admin is an operational role.

Admin does not normally participate in the service transaction.

Admin exists to keep the marketplace safe and functioning.

---

# 38. Admin Responsibilities

Admin can:

* Review workers
* Verify identity
* Manage categories
* Suspend accounts
* Investigate complaints
* Handle disputes
* Review suspicious behavior
* Monitor marketplace health
* Review payment issues
* Moderate reviews
* Investigate fraud

---

# 39. Admin Journey — Worker Verification

```text
Worker registers
      ↓
Verification pending
      ↓
Admin reviews information
      ↓
Approve
   OR
Reject
   OR
Request more information
```

The exact KYC/verification process will be defined separately.

---

# 40. Admin Journey — Dispute Resolution

```text
Dispute created
      ↓
Admin receives case
      ↓
Review customer evidence
      ↓
Review worker evidence
      ↓
Review job timeline
      ↓
Review payment
      ↓
Resolution
```

Possible resolution states:

```text
CUSTOMER_FAVOUR
WORKER_FAVOUR
PARTIAL_RESOLUTION
NO_ACTION
```

The exact financial consequences will be defined later.

---

# 41. Complete Customer Journey

```text
                CUSTOMER
                    │
                    ▼
                Register
                    │
                    ▼
             Create Request
                    │
                    ▼
              Find Matches
                    │
                    ▼
             View Workers
                    │
                    ▼
             Select Worker
                    │
                    ▼
              Booking
                    │
                    ▼
            Worker En Route
                    │
                    ▼
                 Arrived
                    │
                    ▼
              Work Started
                    │
                    ▼
             Additional Work?
                /       \
              No         Yes
              │           │
              │      Customer Approval
              │           │
              └─────┬─────┘
                    ▼
               Job Complete
                    │
                    ▼
                 Payment
                    │
                    ▼
                  Review
                    │
                    ▼
             Repeat Customer
```

---

# 42. Complete Worker Journey

```text
                 WORKER
                    │
                    ▼
                 Register
                    │
                    ▼
                Verification
                    │
                    ▼
             Create Profile
                    │
                    ▼
              Set Availability
                    │
                    ▼
              Receive Jobs
                    │
              ┌─────┴─────┐
              ▼           ▼
           Reject       Accept
                          │
                          ▼
                       Confirm
                          │
                          ▼
                       En Route
                          │
                          ▼
                        Arrive
                          │
                          ▼
                     Start Work
                          │
                          ▼
                 Additional Work?
                    /          \
                  No            Yes
                  │              │
                  │        Request Approval
                  │              │
                  └──────┬───────┘
                         ▼
                    Complete
                         │
                         ▼
                       Payment
                         │
                         ▼
                     Reputation
```

---

# 43. Marketplace Interaction

The most important relationship is:

```text
Customer
    │
    │ creates demand
    ▼
Service Request
    │
    │ matching
    ▼
Worker
    │
    │ accepts
    ▼
Booking
    │
    │ execution
    ▼
Job
    │
    ├── Payment
    ├── Review
    └── Reputation
```

This relationship will eventually become one of the most important parts of our domain model.

---

# 44. Important Distinctions

The system must not incorrectly combine concepts that look similar.

### User ≠ Customer

A user is an account.

A customer is a role/persona using the platform to request services.

---

### Worker ≠ Availability

A worker can exist without currently being available.

---

### Service Request ≠ Booking

A customer can create a request without having a confirmed worker.

---

### Booking ≠ Job

A booking represents an agreed assignment.

The job represents execution.

---

### Job ≠ Payment

A completed job does not necessarily mean payment succeeded.

---

### Rating ≠ Reputation

A rating is one input.

Reputation can eventually contain multiple signals.

---

### Cancellation ≠ No-show

These are different operational events.

---

# 45. Key Lifecycle Concepts

At minimum, the system will eventually need separate lifecycle models for:

```text
User
Worker Verification
Service Request
Worker Match
Booking
Job
Payment
Dispute
Review
```

We should **not** attempt to put all of these into one giant `status` field.

This is an important design principle for the future domain model.

---

# 46. Critical Real-World Questions Exposed by These Journeys

Before designing the ERD, we must answer:

### Matching

1. How long does a worker have to respond?
2. Can multiple workers accept?
3. How many workers receive a request?
4. How far should the initial search go?
5. Does the customer choose among workers?
6. Can a worker see customer details before accepting?

### Booking

7. When exactly does a booking become confirmed?
8. Can a customer change the appointment?
9. Can the worker reschedule?
10. What happens if both sides agree outside the platform?

### Pricing

11. Is pricing fixed?
12. Is it estimated?
13. Does the worker quote?
14. Can the customer negotiate?
15. How are additional charges handled?

### Cancellation

16. Can anyone cancel?
17. When can they cancel?
18. Are there cancellation fees?
19. How are repeated cancellations handled?

### Trust

20. What does "verified worker" actually mean?
21. How do we verify skills?
22. How do we detect fake reviews?
23. How do we handle fraud?

### Payment

24. When is the customer charged?
25. When does the worker receive money?
26. What happens if payment fails?
27. What happens during a refund?
28. What happens during a dispute?

### Geography

29. How is worker location represented?
30. What is the service radius?
31. What happens when the worker leaves the service area?

### Communication

32. Can customer and worker call each other?
33. Should phone numbers be hidden?
34. Should chat be inside the platform?
35. How do we prevent abuse?

These questions will become the basis of the next document.

---

# 47. Core Product Loop

The entire product ultimately revolves around one loop:

```text
         CUSTOMER
             │
             ▼
       Creates Demand
             │
             ▼
          MATCHING
             │
             ▼
          WORKER
             │
             ▼
       Accepts Job
             │
             ▼
          SERVICE
             │
             ▼
         COMPLETION
             │
       ┌─────┴─────┐
       ▼           ▼
    PAYMENT      REVIEW
       │           │
       └─────┬─────┘
             ▼
         REPUTATION
             │
             ▼
      MORE TRUST
             │
             ▼
      MORE BOOKINGS
```

This creates a potential network effect:

```text
More good workers
      ↓
Better availability
      ↓
Better customer experience
      ↓
More customers
      ↓
More jobs
      ↓
More worker earnings
      ↓
More workers
```

However, this network effect is only a **hypothesis until validated**.

---

# 48. Product Principle Derived From User Journeys

The platform should optimize for:

> **Successful local service completion.**

Not simply:

> "A worker accepted a job."

The actual success event is:

```text
Right Worker
     +
Right Customer
     +
Right Time
     +
Successful Service
     +
Successful Payment
     +
Trust Maintained
```

That becomes the central concept for our future marketplace metrics.

---

# 49. Next Step

These personas and journeys expose the business decisions that must be formalized.

Therefore the next document is:

## 03 — Functional Requirements & Business Rules

It will define things such as:

```text
FR-001 Customer registration
FR-002 Worker registration
FR-003 Worker verification
FR-004 Create service request
FR-005 Match workers
FR-006 Worker accepts job
FR-007 Customer confirms worker
...
```

And, more importantly:

```text
BR-001 A worker cannot accept a job outside their active service area.

BR-002 A cancelled booking cannot transition directly to COMPLETED.

BR-003 Additional work requires customer authorization.

BR-004 Payment status is independent from job status.

BR-005 A worker no-show must be recorded separately from cancellation.

BR-006 Only one worker can ultimately hold a confirmed booking for a service request.
```

Those **functional requirements + business rules** will give us the exact foundation needed to design the domain model and ERD correctly.
