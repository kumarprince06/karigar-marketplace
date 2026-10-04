# Karigar Marketplace

### Product Scope & Vision — Version 1.0

**Document Status:** Draft for Product/Engineering Review
**Initial Market:** Howrah / Kolkata, West Bengal
**Initial Categories:** Electricians and Plumbers
**Product Type:** Two-sided local skilled-worker marketplace
**Long-Term Direction:** Worker-first local service infrastructure

---

# 1. Product Vision

Build a local network where:

> **A customer can find a suitable, available and trustworthy skilled worker when they need one, while an independent worker can discover nearby jobs without depending entirely on personal referrals or intermediaries.**

The long-term vision is bigger than a service-booking application.

We want to create a **digital professional infrastructure for local skilled workers**.

A worker should eventually be able to use the platform to:

* Find work
* Build a professional identity
* Demonstrate skills and experience
* Build portable reputation
* Manage customers
* Manage jobs
* Receive payments
* Maintain work history
* Get training
* Access insurance/financial services
* Build a sustainable independent business

The customer's benefit is equally important:

* Find someone nearby
* Know who they are dealing with
* Understand their experience
* Know their availability
* See previous work/reputation
* Get a predictable process
* Have protection if something goes wrong

---

# 2. The Problem

## 2.1 Customer Problem

When a household needs an electrician, plumber or similar worker, the common process is often:

```text
Problem occurs
      ↓
Ask family/friend/neighbour
      ↓
Search WhatsApp/contact list
      ↓
Call multiple workers
      ↓
Check availability
      ↓
Discuss price
      ↓
Wait
      ↓
Worker may or may not arrive
      ↓
Work starts
```

This process has several weaknesses:

* The customer may not know whom to call.
* The trusted worker may be unavailable.
* The customer may need to call multiple people.
* Availability is usually unknown before calling.
* Skill level is difficult to verify.
* Price expectations may be unclear.
* There may be no formal job history.
* There may be no structured dispute process.
* Finding the same worker again can depend on keeping their phone number.
* A customer may have little information beyond a referral.

The actual customer problem is therefore not simply:

> "I need an electrician."

It is:

> **"I need someone trustworthy who can actually come and solve my problem."**

---

# 3. Worker Problem

Independent electricians, plumbers and similar workers often depend heavily on:

* Existing customers
* Personal referrals
* Friends and family
* Contractors
* Local shops
* Informal networks
* Phone contacts
* WhatsApp groups
* Local reputation

This creates a different problem:

> **A skilled worker can be available and capable of doing a job but still have no reliable way to discover nearby demand.**

Potential consequences:

* Unpredictable workload
* Empty working hours
* Dependence on intermediaries
* Difficulty acquiring new customers
* Difficulty proving experience to new customers
* Reputation remaining offline
* No structured work history
* Difficulty expanding beyond existing local contacts

---

# 4. The Core Opportunity

The platform connects two fragmented sides:

```text
                 LOCAL DEMAND
                      │
                      │
                      ▼
               ┌─────────────┐
               │   PLATFORM  │
               └─────────────┘
                      ▲
                      │
                      │
                 LOCAL SUPPLY
```

### Customer

"I need someone."

### Worker

"I am available and looking for work."

### Platform

"Here are suitable matches."

This sounds simple, but the difficult part is making the matching **trustworthy, reliable and useful in the real world**.

---

# 5. Product Thesis

Our central product thesis is:

> **Local skilled-worker markets are not only a discovery problem. They are a trust, availability, reputation and coordination problem.**

Therefore the platform should not primarily compete by saying:

> "We have more categories."

Instead, it should attempt to create a better local network around:

```text
Identity
   +
Skills
   +
Location
   +
Availability
   +
Reputation
   +
Job History
   +
Trust
   +
Payments
   +
Protection
```

---

# 6. What Makes This Different?

This is the most important strategic section.

We should **not position the product as "another Urban Company."**

The initial differentiation should be:

## Worker-first + marketplace-driven

Instead of primarily creating a centrally managed service workforce, the platform should enable **independent local professionals** to participate directly.

The worker controls:

* Which jobs to see
* Which jobs to accept
* When they are available
* Which areas they serve
* Which skills they offer
* Their professional profile

The customer gets:

* Multiple suitable workers
* Availability information
* Reputation
* Experience
* Location
* Work history
* Choice

---

# 7. The Potential Long-Term Differentiator

The strongest potential differentiator is not the booking screen.

It is the concept of a:

# Worker Professional Passport

Every worker can gradually build a digital professional identity.

Example:

```text
------------------------------------------------
              RAJU KUMAR
            Verified Electrician
------------------------------------------------

Experience:              8 years

Skills:
✓ House Wiring
✓ Fan Installation
✓ Switch/Socket Repair
✓ Inverter Installation

Completed Jobs:          487

Customer Rating:         4.8 / 5

Repeat Customers:        126

Verified Identity:       ✓

Verified Skills:         ✓

Work History:            ✓

Service Areas:
Shibpur
Howrah Maidan
Salkia
Liluah

Availability:
Today: 5 PM – 9 PM
------------------------------------------------
```

Over time, this profile becomes more valuable.

A worker should not merely have:

> "500 phone contacts."

They should have:

> **A verified professional reputation that can generate work.**

This can potentially become a significant long-term moat because the platform accumulates structured information about:

* Skills
* Jobs
* Reliability
* Customer feedback
* Experience
* Areas served
* Availability
* Work history

---

# 8. Customer Experience Vision

The customer's ideal experience should eventually become:

```text
Problem
   ↓
Describe problem
   ↓
Location
   ↓
Preferred time
   ↓
Available workers
   ↓
Compare
   ↓
Select
   ↓
Worker arrives
   ↓
Work completed
   ↓
Payment
   ↓
Review
```

But the platform should also understand the customer's problem.

For example:

> "My bathroom tap is leaking."

The system could eventually determine:

```text
Likely Category:
Plumbing

Possible Skill:
Tap/Faucet Repair

Urgency:
Normal

Required Worker:
Plumber

Suggested Search Radius:
3 km
```

This is an area where AI can eventually help, but AI is **not part of the core MVP requirement**.

---

# 9. Worker Experience Vision

The worker's experience should be:

```text
Go Available
      ↓
Nearby job appears
      ↓
See:
  - Location
  - Problem
  - Photos
  - Expected time
  - Estimated earning
      ↓
Accept / Reject
      ↓
Navigate
      ↓
Complete job
      ↓
Get paid
      ↓
Build reputation
```

The worker should not need to continuously browse a complicated application.

The system should proactively bring relevant opportunities to them.

---

# 10. Initial Product Scope

The initial MVP will support:

## Customer

### Account

* Registration
* Login
* Phone verification
* Profile

### Address

* Add address
* Location coordinates
* Address label
* Default address

### Service Request

Customer can create:

* Category
* Problem description
* Photos
* Location
* Preferred date
* Preferred time
* Urgency

### Worker Discovery

Customer can see suitable workers based on:

* Skill
* Distance
* Availability
* Reputation
* Experience

### Booking

Customer can:

* Select worker
* Confirm booking
* Cancel booking
* View status
* Contact worker through platform mechanisms

### Completion

* Job completed
* Payment recorded
* Review submitted

---

# 11. Initial Worker Scope

Workers can:

### Profile

* Name
* Profile photo
* Experience
* Service areas
* Skills
* Languages
* Description

### Verification

* Phone verification
* Identity verification
* Basic profile verification

Skill verification may initially be represented separately from identity verification.

### Availability

Worker can:

* Go online
* Go offline
* Define working hours
* Define service area

### Jobs

Worker can:

* Receive job opportunities
* View job details
* Accept
* Reject
* Mark en route
* Mark arrived
* Start work
* Complete work

### Reputation

Worker accumulates:

* Completed jobs
* Ratings
* Reviews
* Repeat customers
* Reliability metrics

---

# 12. Admin Scope

An administrative system is required from the beginning.

Admin can:

* View users
* View workers
* Review verification
* Suspend workers
* Suspend customers
* View jobs
* View cancellations
* View disputes
* Review payments
* Moderate reviews
* Handle complaints
* View marketplace metrics

The admin system is important because real marketplaces require operational control.

---

# 13. Initial Worker Categories

The MVP will begin with:

### 1. Electrician

### 2. Plumber

We deliberately avoid launching with:

* Carpenter
* Painter
* AC technician
* Appliance repair
* Mason
* Cleaner
* Driver
* etc.

These can be added later.

The reason is not technical difficulty.

The reason is **marketplace focus**.

We want to understand the behavior of one supply/demand system before introducing many different ones.

---

# 14. Initial Geography

The initial market should be geographically constrained.

Rather than:

> "Entire Kolkata."

We should begin with a small, dense area of Howrah/Kolkata.

Potential areas can be evaluated through field research rather than selected purely theoretically.

The objective is:

```text
Small geography
      ↓
High worker density
      ↓
Short travel distance
      ↓
Fast matching
      ↓
Frequent transactions
      ↓
Marketplace liquidity
```

The initial geography is a **testing laboratory**, not a permanent restriction.

---

# 15. Core Marketplace Model

The marketplace will operate around:

```text
SERVICE REQUEST
       ↓
MATCHING
       ↓
WORKER RESPONSE
       ↓
CUSTOMER SELECTION
       ↓
BOOKING
       ↓
JOB
       ↓
COMPLETION
       ↓
PAYMENT
       ↓
REPUTATION
```

This lifecycle becomes the central domain of the application.

---

# 16. Real-World Scenarios the Product Must Handle

The system must be designed around real-world failures, not only the happy path.

## Scenario A — No workers available

```text
Customer creates request
        ↓
Search nearby workers
        ↓
No suitable worker
        ↓
Expand search radius
        ↓
Still unavailable
        ↓
Inform customer
```

Potential future option:

> Notify me when someone becomes available.

---

## Scenario B — Multiple workers accept

```text
Job
 ├── Worker A accepts
 ├── Worker B accepts
 └── Worker C accepts
```

The system must prevent inconsistent bookings.

Only one worker ultimately becomes confirmed.

---

## Scenario C — Worker accepts but customer does not confirm

The job must have an expiration mechanism.

---

## Scenario D — Worker cancels

```text
Confirmed
    ↓
Worker cancels
    ↓
Customer notified
    ↓
Replacement matching
```

The system should record the cancellation.

---

## Scenario E — Customer cancels

Cancellation should record:

* Who cancelled
* When
* Reason
* Current job state

Cancellation rules may differ depending on job stage.

---

## Scenario F — Worker doesn't arrive

This should affect worker reliability metrics.

The platform should distinguish:

* Accepted
* Cancelled
* No-show
* Arrived
* Completed

These are not the same event.

---

## Scenario G — Customer isn't available

The worker arrives but cannot access the property.

This needs its own business state rather than simply marking the job cancelled.

---

## Scenario H — Additional work required

Original request:

> Repair fan — ₹300

Worker discovers additional work.

Worker submits:

```text
Additional Work
Reason: Capacitor replacement
Amount: ₹500
```

Customer:

```text
Approve
   OR
Reject
```

The additional amount should not automatically become payable without an appropriate authorization mechanism.

---

## Scenario I — Customer disputes completion

```text
Worker → Completed
Customer → Disputes
       ↓
Dispute
       ↓
Evidence
       ↓
Admin/Resolution
       ↓
Decision
```

---

## Scenario J — Payment failure

A job must not become incorrectly "paid" merely because a payment was initiated.

Payment states must be independent from job states.

---

## Scenario K — Worker and customer try to bypass the platform

This is a major marketplace problem.

If the platform only provides:

> "Here is a phone number."

the customer and worker may simply transact directly.

Therefore the platform needs continuing value through:

* Verified identity
* Job history
* Reputation
* Payment protection
* Dispute resolution
* Warranty/protection
* Repeat booking
* Invoices
* Worker professional identity
* Potential future benefits

---

# 17. What We Will NOT Build in MVP

To prevent scope explosion, MVP will initially exclude:

* Loans
* Insurance products
* Worker training marketplace
* Equipment marketplace
* Complex subscription plans
* AI agent
* Advanced dynamic pricing
* Full accounting system
* Multi-city operations
* Complex loyalty programs
* Microservices
* Kubernetes
* Advanced recommendation ML
* Large-scale analytics platform

These belong to later stages.

---

# 18. MVP Success Criteria

The project should not be considered successful merely because:

> "The API works."

The real question is whether the marketplace works.

We should measure:

### Demand

* Service requests created
* Requests per customer
* Repeat customers

### Supply

* Registered workers
* Verified workers
* Active workers
* Available workers

### Marketplace

* Match rate
* Worker acceptance rate
* Booking conversion
* Completion rate
* Cancellation rate
* No-show rate

### Customer

* Time to find worker
* Repeat booking rate
* Average rating
* Dispute rate

### Worker

* Jobs received
* Jobs completed
* Earnings generated
* Repeat customers
* Acceptance rate
* Cancellation rate

---

# 19. The Most Important Marketplace Metric

Initially, the key metric should be:

> **Successful completed jobs.**

Not:

* Registered users
* App downloads
* API requests
* Number of workers

A marketplace becomes meaningful when:

```text
Customer has a problem
        ↓
Worker is available
        ↓
They successfully connect
        ↓
Work gets completed
        ↓
Both sides are satisfied
```

Repeatedly.

---

# 20. Product Principles

## Principle 1 — Solve the real problem

Don't add features because competitors have them.

---

## Principle 2 — Worker is not merely supply

The worker is a professional using the platform to build a livelihood.

---

## Principle 3 — Trust is a product feature

Identity, reputation, history and reliability are core functionality.

---

## Principle 4 — Availability matters

A highly rated worker who is unavailable is not a useful match.

---

## Principle 5 — Location matters

For local services:

```text
Distance
+
Travel time
+
Service area
```

are fundamental to matching.

---

## Principle 6 — The platform should reduce uncertainty

Customer uncertainty:

> "Will this person come?"

Worker uncertainty:

> "Will I actually get paid?"

The platform should progressively reduce both.

---

# 21. Long-Term Product Evolution

The product can evolve through several stages.

## Stage 1 — Find Work

```text
Customer ↔ Worker
```

---

## Stage 2 — Get Trusted Work

```text
Identity
Skills
Reputation
Job history
```

---

## Stage 3 — Manage Work

```text
Bookings
Customers
Scheduling
Invoices
Payments
```

---

## Stage 4 — Build a Professional Identity

```text
Worker Passport
       ↓
Verified skills
       ↓
Experience
       ↓
Work history
       ↓
Reputation
```

---

## Stage 5 — Worker Business Infrastructure

```text
Payments
Accounting
CRM
Customer management
Scheduling
Communication
```

---

## Stage 6 — Worker Financial/Professional Services

Potential future areas:

* Insurance
* Training
* Equipment financing
* Business financing
* Certification
* Professional services

These are **future possibilities**, not commitments.

---

# 22. Potential Competitive Position

We should not define our positioning as:

> "Urban Company but cheaper."

Nor:

> "Urban Company but with more categories."

Instead, our intended product direction is:

> **A worker-first local network where independent skilled professionals build their own verified reputation and receive relevant nearby work directly.**

The marketplace then serves both sides:

```text
              CUSTOMER
                  │
       ┌──────────┴──────────┐
       │                     │
   Find Worker          Trust Worker
       │                     │
       └──────────┬──────────┘
                  │
             PLATFORM
                  │
       ┌──────────┴──────────┐
       │                     │
    Find Work          Build Reputation
       │                     │
       └──────────┬──────────┘
                  │
                WORKER
```

This is our **product hypothesis**, not yet a proven competitive advantage.

We must validate it through actual worker/customer interviews and usage.

---

# 23. What Success Would Eventually Look Like

A customer should be able to say:

> "I don't need to ask ten people for an electrician anymore. I can see who is available nearby and choose someone I trust."

And a worker should be able to say:

> "I don't need to depend only on people I already know. When I'm available, I can see relevant work near me."

And eventually:

> "My profile itself proves my professional history."

That is the product we should attempt to build.

---

# 24. MVP Boundary

The first engineering version should therefore focus on:

```text
                MVP
                 │
       ┌─────────┴─────────┐
       │                   │
    CUSTOMER             WORKER
       │                   │
       ▼                   ▼
 Create Request       Create Profile
       │                   │
       ▼                   ▼
 Find Matches         Set Availability
       │                   │
       └─────────┬─────────┘
                 ▼
              MATCH
                 │
                 ▼
             BOOKING
                 │
                 ▼
                JOB
                 │
                 ▼
             COMPLETION
                 │
          ┌──────┴──────┐
          ▼             ▼
       PAYMENT        REVIEW
```

Everything else should support this core loop.

---

# 25. Product Definition

### One-line description

> **A local worker-first marketplace connecting customers with available, verified skilled professionals while helping workers build a trusted digital professional identity.**

### Initial users

* Customers
* Independent electricians
* Independent plumbers
* Platform administrators

### Initial market

Howrah/Kolkata

### Initial services

Electrician + Plumber

### Core transaction

```text
Request → Match → Accept → Confirm → Work → Complete → Pay → Review
```

### Core differentiation hypothesis

**Worker-first marketplace + persistent professional reputation + local availability + direct job discovery.**

### Long-term vision

**Become digital infrastructure for independent skilled workers rather than merely a platform for booking home services.**

---

# 26. Important Product Caveat

This document describes our **product hypothesis**.

It does not prove that workers or customers will prefer this model.

Before treating the differentiation as validated, we need real-world evidence from:

* Workers
* Customers
* Existing local service providers
* Existing platforms

Therefore the next documents should translate this hypothesis into **personas, user journeys, requirements and real-world scenarios**, after which we can identify where the product concept needs to change.

---

## Next Document

**02 — User Roles, Personas & User Journeys**

We will define the actual people interacting with the system:

```text
Customer
Worker
Admin
```

and then walk through their real lives:

```text
Customer wakes up
     ↓
Problem occurs
     ↓
Needs electrician
     ↓
Searches for help
     ↓
Creates request
     ↓
Receives workers
     ↓
Chooses worker
     ↓
Worker travels
     ↓
Work happens
     ↓
Payment
     ↓
Review
```

We'll do the same for the worker, including **idle time, accepting jobs, rejection, cancellation, travel, additional work, payment, disputes and repeat customers**.

Only after those flows are completely clear should we freeze the **domain model and ERD**.
