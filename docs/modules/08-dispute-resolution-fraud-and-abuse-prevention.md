# Dispute Resolution, Fraud & Abuse Prevention

## 1. Purpose

The marketplace will eventually handle real money, real workers, real customers, real addresses, and real-world service outcomes.

That creates a second class of problems beyond normal business failures:

* customer claims work was not completed;
* worker claims the customer refused payment;
* customer disputes additional charges;
* worker does not arrive;
* customer is unavailable;
* fake accounts create fake jobs;
* users manipulate reviews;
* workers create multiple accounts;
* customers repeatedly cancel after worker arrival;
* users attempt to bypass platform payments;
* payment succeeds but the application does not receive the expected response;
* malicious users abuse notifications, OTPs, uploads, or APIs.

Therefore, the system needs a dedicated **Dispute, Fraud & Abuse Prevention capability**.

The goal is not to assume users are dishonest.

The goal is to make the platform capable of answering:

> **What happened, what evidence exists, what rules were violated, what action should be taken, and who authorized that action?**

---

# 2. Core Principles

The system should follow these principles.

### 2.1 Dispute ≠ Fraud

A dispute means:

> Two parties disagree about what happened or what should happen.

Fraud means:

> There is evidence or a sufficiently strong signal that someone intentionally manipulated the system for improper benefit.

A customer disputing a repair does **not** automatically mean the customer is fraudulent.

A worker receiving a complaint does **not** automatically mean the worker is dishonest.

These concepts must remain separate.

---

### 2.2 Abuse ≠ Fraud

Abuse can include behavior that violates platform rules without necessarily being financial fraud.

Examples:

* spam requests;
* abusive messages;
* repeated fake bookings;
* harassment;
* excessive cancellation;
* API abuse;
* review manipulation;
* bypassing platform communication/payment rules.

---

### 2.3 Evidence Before Enforcement

The platform should preserve evidence before taking serious action.

For example:

```text
Booking
   ↓
Job
   ↓
Timeline
   ↓
Payment
   ↓
Additional Work
   ↓
Messages/Notifications
   ↓
Location events (if collected)
   ↓
Review
   ↓
Dispute
```

A dispute should therefore be evaluated using the underlying historical data rather than only the user's description.

---

# 3. Types of Disputes

The initial system should support explicit dispute categories.

## 3.1 Service Quality Dispute

Example:

> Customer says the electrical repair was not properly completed.

Possible outcomes:

* customer refund;
* worker payment retained;
* partial refund;
* no action;
* request for additional evidence;
* manual reinspection.

---

## 3.2 Non-Arrival Dispute

Example:

> Worker accepted the booking but never arrived.

Relevant evidence:

* booking;
* job status;
* en-route event;
* arrival event;
* timestamps;
* cancellation reason;
* customer reports;
* worker reports.

---

## 3.3 Customer No-Show

Example:

> Worker arrived but customer was unavailable.

This should not be treated as worker failure.

---

## 3.4 Worker No-Show

Example:

> Worker accepted the job but did not appear.

This should be represented explicitly.

It may affect reliability metrics, but the platform should retain the actual event and evidence.

---

## 3.5 Payment Dispute

Examples:

* customer says payment was charged twice;
* customer says payment succeeded but booking was not updated;
* worker says earnings are missing;
* refund was expected but not received.

Payment disputes should connect directly to the financial system.

---

## 3.6 Additional Work Dispute

Example:

```text
Original service: ₹500

Worker proposes:
Replacement component: ₹300
Additional labour: ₹200

Customer claims:
"I never approved this."
```

The system should therefore preserve:

```text
AdditionalWork
├── proposedAmount
├── proposedAt
├── proposedBy
├── approvalStatus
├── approvedAt
└── resultingPayment
```

The platform should never rely only on the final amount.

---

## 3.7 Cancellation Dispute

Example:

> Customer claims worker cancelled.

while worker claims:

> Customer requested cancellation.

The system should preserve:

```text
cancelledBy
cancelledAt
cancellationReason
jobStage
```

---

## 3.8 Review Dispute

Examples:

* fake review;
* review unrelated to job;
* abusive content;
* retaliatory review;
* review manipulation.

Reviews should have their own moderation lifecycle rather than being silently deleted.

---

# 4. Dispute Lifecycle

Recommended lifecycle:

```text
OPEN
  ↓
UNDER_REVIEW
  ↓
EVIDENCE_REQUIRED
  ↓
EVIDENCE_COLLECTED
  ↓
RESOLVED
  ↓
CLOSED
```

Some cases may be closed without additional evidence:

```text
OPEN
  ↓
RESOLVED
```

Cancellation before investigation may also be supported:

```text
OPEN
  ↓
CLOSED
```

---

# 5. Dispute Aggregate

The `Dispute` aggregate should contain business information such as:

```text
Dispute
├── id
├── bookingId
├── jobId
├── openedByUserId
├── againstUserId
├── category
├── reason
├── description
├── status
├── resolution
├── resolutionNotes
├── resolvedBy
├── openedAt
├── resolvedAt
└── closedAt
```

Possible resolution values:

```text
CUSTOMER_FAVOUR
WORKER_FAVOUR
PARTIAL
NO_ACTION
OUTSIDE_SCOPE
DUPLICATE
```

---

# 6. Evidence Model

Evidence must be treated separately from the dispute itself.

Possible evidence:

```text
DisputeEvidence
├── id
├── disputeId
├── submittedBy
├── type
├── storageReference
├── description
├── createdAt
└── metadata
```

Evidence types may include:

```text
PHOTO
VIDEO
DOCUMENT
RECEIPT
PAYMENT_REFERENCE
MESSAGE_REFERENCE
JOB_EVENT
LOCATION_EVENT
SYSTEM_EVENT
OTHER
```

Not every evidence type should be user-uploaded.

The platform itself can provide system evidence.

Example:

```text
Evidence:
Worker marked ARRIVED at 14:07.

Evidence:
Customer approved additional work at 14:15.

Evidence:
Payment provider reported successful capture at 15:02.
```

---

# 7. Evidence Integrity

Evidence must not be silently modified.

For important evidence:

* retain original timestamp;
* retain uploader;
* retain creation time;
* retain storage reference;
* retain relevant system event ID;
* preserve audit history;
* avoid overwriting original evidence.

For uploaded files, object storage should be used.

Database:

```text
evidence_id
storage_key
mime_type
size
uploaded_by
created_at
```

Object storage:

```text
disputes/{disputeId}/evidence/{evidenceId}
```

---

# 8. Automated Fraud Detection

The MVP should **not** attempt sophisticated machine-learning fraud detection.

Start with deterministic rules.

Examples:

### Rule A — Multiple Accounts

Potential signal:

```text
same phone
same device
same payment instrument
same identity
```

However, these should be treated as **signals**, not automatic proof of fraud.

---

### Rule B — Review Manipulation

Potential signals:

```text
same customer repeatedly reviews
same worker
unusual review timing
multiple accounts
repeated reciprocal reviews
```

---

### Rule C — Fake Job Pattern

Example:

```text
Customer A
   ↓
creates jobs
   ↓
Worker B accepts
   ↓
job completed
   ↓
payment/refund cycle
   ↓
repeated pattern
```

This may require investigation.

---

### Rule D — Excessive Cancellation

Track:

```text
total bookings
customer cancellations
worker cancellations
cancellation stage
time before cancellation
```

Do not use raw cancellation count alone.

For example:

```text
2 cancellations / 3 jobs
```

and

```text
2 cancellations / 500 jobs
```

have very different contexts.

---

# 9. Risk Signals vs Decisions

This distinction is extremely important.

The system may produce:

```text
RiskSignal
```

but should not immediately produce:

```text
USER_IS_FRAUD
```

Example:

```text
RiskSignal:
"User has created 8 accounts using highly similar device/payment information."
```

An operations system can then decide:

```text
NO_ACTION
MONITOR
REQUEST_VERIFICATION
TEMPORARY_RESTRICTION
SUSPEND
```

This gives humans the ability to review important cases.

---

# 10. Risk Signal Model

Future model:

```text
RiskSignal
├── id
├── userId
├── entityType
├── entityId
├── signalType
├── severity
├── score
├── explanation
├── status
├── createdAt
└── resolvedAt
```

Example:

```text
signalType = DUPLICATE_ACCOUNT_PATTERN
severity = MEDIUM
score = 72
explanation =
"Multiple recently created accounts share strong identifiers."
```

The explanation is important.

Avoid an opaque:

```text
fraudScore = 0.93
```

with no explanation.

---

# 11. Risk Levels

A simple initial classification:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

These should represent operational severity, not a declaration of guilt.

Example:

| Risk     | Possible action                       |
| -------- | ------------------------------------- |
| LOW      | Monitor                               |
| MEDIUM   | Additional verification               |
| HIGH     | Manual review                         |
| CRITICAL | Temporary restriction + manual review |

The actual policy should remain configurable.

---

# 12. Abuse Prevention

The platform needs protections against abuse at multiple layers.

## 12.1 Authentication Abuse

Protect:

```text
OTP request
OTP verification
login
refresh token
password reset
```

Controls:

* rate limits;
* IP throttling;
* phone-number throttling;
* retry limits;
* OTP expiration;
* suspicious request detection.

---

# 13. Service Request Abuse

Customers should not be able to create unlimited requests.

Example policy:

```text
max active requests per customer
max requests per time window
max failed/cancelled requests per time window
```

But legitimate emergencies should not be unnecessarily blocked.

Therefore limits should be configurable.

---

# 14. Worker Offer Abuse

A worker should not be able to manipulate matching indefinitely.

Possible controls:

* maximum active offers;
* offer expiration;
* duplicate acceptance protection;
* request-level booking uniqueness;
* repeated automated acceptance monitoring.

---

# 15. Review Abuse

Protect against:

```text
self-review
fake job review
multiple reviews for one job
review exchange
retaliatory review
spam
abusive content
```

The strongest MVP protection is:

> **A review can only originate from an eligible completed job.**

This is much stronger than simply allowing any user to review a worker.

---

# 16. Platform Bypass / Disintermediation

Because workers and customers meet physically, there is a natural risk that users attempt to move transactions outside the platform.

Examples:

```text
"Don't pay through the app."
"Call me directly next time."
"Pay cash and I'll reduce the price."
```

The system should not assume every off-platform interaction is malicious.

Instead, it should establish platform rules and collect appropriate signals.

Possible controls:

* minimize unnecessary phone exposure;
* platform communication where appropriate;
* explain platform protections;
* payment history;
* dispute protection;
* worker/customer education;
* suspicious-pattern monitoring.

Do not attempt aggressive surveillance of private communication.

---

# 17. Account Takeover Protection

Potential attack:

```text
attacker
   ↓
obtains OTP
   ↓
logs into account
   ↓
changes profile/payment information
   ↓
performs fraudulent activity
```

Controls:

* OTP rate limiting;
* session/device tracking;
* refresh-token rotation;
* suspicious login detection;
* sensitive-action reauthentication where appropriate;
* notification when critical account information changes;
* account recovery controls.

---

# 18. Financial Fraud

Financial fraud must be coordinated with [modules/06](06-payments-refunds-settlement-and-ledger.md).

Potential signals:

```text
repeated payment failures
unusual refund patterns
multiple payment methods
rapid payment → refund cycles
chargebacks
suspicious account relationships
```

Payment provider webhooks remain the financial source of truth.

Fraud detection should not directly mutate payment state.

Instead:

```text
Payment event
      ↓
Risk analysis
      ↓
Risk signal
      ↓
Operational decision
      ↓
Business action
```

---

# 19. Chargebacks

A chargeback is not equivalent to a normal refund.

Conceptually:

```text
Customer payment
      ↓
Payment SUCCESS
      ↓
Provider chargeback
      ↓
Financial investigation
```

The platform should preserve:

* original payment;
* provider transaction;
* chargeback event;
* disputed amount;
* reason code;
* provider timestamps;
* resulting financial adjustment.

Future financial model:

```text
Chargeback
├── paymentId
├── provider
├── providerReference
├── amountMinor
├── currency
├── reason
├── status
└── timestamps
```

---

# 20. Admin Investigation Workflow

Admin operations should be explicit.

Example:

```text
Admin
  ↓
Open dispute
  ↓
Review booking
  ↓
Review job timeline
  ↓
Review payment
  ↓
Review additional work
  ↓
Review evidence
  ↓
Review previous disputes
  ↓
Make decision
  ↓
Record resolution
  ↓
Trigger financial/business actions
```

The administrator should never directly edit:

```text
booking.status
payment.status
worker.rating
```

through generic CRUD.

Instead:

```text
resolveDispute()
refundPayment()
suspendWorker()
restoreReview()
```

should be explicit operations.

---

# 21. Administrative Actions

Examples:

```text
REQUEST_EVIDENCE
APPROVE_REFUND
PARTIAL_REFUND
REJECT_REFUND
SUSPEND_USER
UNSUSPEND_USER
RESTRICT_USER
RESTORE_USER
HIDE_REVIEW
RESTORE_REVIEW
REQUIRE_VERIFICATION
CLOSE_DISPUTE
```

Each action should generate an audit event.

---

# 22. Temporary Restrictions

Suspension should not be the only enforcement mechanism.

Possible states:

```text
ACTIVE
RESTRICTED
SUSPENDED
DEACTIVATED
```

A restriction could mean:

```text
can login = YES
can view history = YES
can create jobs = NO
can accept jobs = NO
can receive payouts = REVIEW_REQUIRED
```

This is more precise than completely disabling the account.

---

# 23. Appeals

Important enforcement decisions should support appeals.

Example:

```text
Suspension
    ↓
Worker submits appeal
    ↓
Appeal under review
    ↓
Decision
```

Future model:

```text
Appeal
├── id
├── subjectUserId
├── actionId
├── reason
├── evidence
├── status
├── reviewedBy
└── timestamps
```

Possible statuses:

```text
SUBMITTED
UNDER_REVIEW
UPHELD
REVERSED
PARTIAL
CLOSED
```

---

# 24. Fraud and Trust Relationship

Fraud signals can influence operational decisions, but should not silently rewrite reputation.

For example:

```text
Worker has suspicious account signal
```

does not mean:

```text
rating = 1
```

and should not automatically delete:

```text
completedJobs
reviews
verificationHistory
```

Trust and fraud systems should remain separate but connected.

---

# 25. Data Model

Potential tables:

```text
disputes
dispute_evidence
risk_signals
risk_cases
abuse_reports
account_restrictions
appeals
fraud_events
```

Not all need to exist in MVP.

### MVP tables

Start with:

```text
disputes
dispute_evidence
account_restrictions
```

Then add:

```text
risk_signals
abuse_reports
appeals
```

when real operational patterns justify them.

---

# 26. Abuse Report

Users should be able to report another user or piece of content.

Example:

```text
POST /api/v1/reports
```

Possible report categories:

```text
FRAUD
HARASSMENT
SPAM
FAKE_PROFILE
FAKE_REVIEW
PAYMENT_BYPASS
SAFETY_CONCERN
OTHER
```

A report is an input for investigation.

It is **not proof**.

---

# 27. Auditability

Every important action should produce an audit event.

Examples:

```text
DisputeOpened
EvidenceSubmitted
DisputeResolved
RefundApproved
WorkerSuspended
WorkerUnsuspended
ReviewHidden
ReviewRestored
RiskSignalCreated
RestrictionApplied
RestrictionRemoved
AppealSubmitted
AppealResolved
```

Audit records should include:

```text
actor
action
entity
reason
timestamp
requestId
metadata
```

For sensitive actions, the audit record should be immutable/append-oriented.

---

# 28. Event-Driven Integration

The system can publish events such as:

```text
DisputeOpened
DisputeResolved
WorkerNoShow
CustomerNoShow
PaymentDisputed
ChargebackReceived
ReviewReported
RiskSignalCreated
WorkerSuspended
```

Other modules can react.

Example:

```text
DisputeResolved
       ↓
Payment module
       ↓
Refund
```

and:

```text
DisputeResolved
       ↓
Notification module
       ↓
Notify customer + worker
```

The dispute module should not directly own notification implementation.

---

# 29. Idempotency

Critical operations must be idempotent.

Examples:

```text
resolve dispute
apply restriction
refund payment
hide review
process provider event
```

A repeated request must not create:

```text
two refunds
two restrictions
two resolutions
```

Use database constraints and idempotency keys where appropriate.

---

# 30. Security Considerations

Dispute information can contain highly sensitive data.

Access must be restricted.

### Customer

Can see:

* own disputes;
* own evidence;
* relevant resolution.

### Worker

Can see:

* disputes involving them;
* permitted evidence;
* resolution.

### Admin

Can see:

* authorized investigation data.

Sensitive identity documents should **not** automatically become visible to the other party.

---

# 31. Location Evidence

Location data is particularly sensitive.

If location telemetry is eventually collected, it should not automatically be exposed to customers or workers.

Example:

Internal evidence:

```text
Worker device was within configured arrival radius
at 14:08.
```

The customer may instead see:

```text
Arrival was recorded at 14:08.
```

The raw coordinates can remain internal unless there is a legitimate reason to disclose them.

---

# 32. Fraud Detection Architecture

Initial architecture:

```text
Business Event
      ↓
Risk Signal Evaluator
      ↓
Deterministic Rules
      ↓
Risk Signal
      ↓
Operations Queue
      ↓
Human Review
      ↓
Action
```

Later:

```text
Business Events
      ↓
Feature Generation
      ↓
Risk Engine
      ↓
Rules + Statistical Models
      ↓
Risk Signals
      ↓
Human Review / Automated Low-Risk Actions
```

Machine learning should only be introduced after sufficient real operational data exists.

---

# 33. False Positives

False positives can seriously damage marketplace liquidity.

Example:

A legitimate worker uses:

```text
same phone
same device
same address
```

for a family member's account.

A simplistic rule might incorrectly flag the accounts.

Therefore:

> Fraud signals should increase investigation priority, not automatically establish guilt.

---

# 34. Marketplace-Specific Safety

Because workers and customers meet offline, some disputes can involve personal safety.

Future categories may include:

```text
THREAT
HARASSMENT
PROPERTY_DAMAGE
UNAUTHORIZED_ACCESS
PHYSICAL_SAFETY
```

These cases may require faster escalation than ordinary service-quality disputes.

The system should support priority:

```text
LOW
NORMAL
HIGH
CRITICAL
```

without automatically deciding the underlying claim.

---

# 35. Dispute SLA

Operations should eventually define expected response times.

Example:

```text
Critical safety issue
    → immediate/manual escalation

Payment issue
    → defined financial SLA

Normal service dispute
    → normal review queue

Review report
    → moderation queue
```

Exact SLA values are a product/operations decision and should remain configurable.

---

# 36. Metrics

Important metrics:

### Disputes

```text
disputes per 100 completed jobs
resolution time
refund rate
partial-refund rate
dispute reopen rate
```

### Fraud/abuse

```text
reports per 1,000 users
risk signals
confirmed abuse cases
false-positive rate
account restrictions
appeals
appeal reversal rate
```

### Marketplace health

```text
worker cancellation rate
customer cancellation rate
worker no-show rate
customer no-show rate
payment disputes
review disputes
```

Metrics should be segmented by:

```text
profession
area
worker tenure
customer tenure
job type
```

when statistically useful.

---

# 37. What Must NOT Happen

Avoid these designs:

### ❌ Automatically ban based on one signal

```text
riskScore > 80 → BAN
```

### ❌ Treat every dispute as fraud

```text
dispute → fraud
```

### ❌ Modify historical financial records

```text
payment.amount = 0
```

### ❌ Delete evidence

```text
DELETE dispute evidence
```

### ❌ Direct database manipulation by admins

```text
UPDATE workers SET rating = ...
```

### ❌ Hide enforcement reasons

```text
ACCOUNT_SUSPENDED
```

with no meaningful explanation where policy permits providing one.

### ❌ Build ML fraud detection before sufficient data exists

The MVP should begin with deterministic, explainable controls.

---

# 38. MVP Scope

### Include

* dispute creation;
* dispute categories;
* dispute lifecycle;
* dispute evidence;
* booking/job/payment linkage;
* admin investigation;
* resolution;
* partial/full refund integration;
* audit events;
* abuse reporting;
* account restriction;
* basic rate limiting;
* review abuse protection;
* no-show distinction;
* cancellation history;
* payment dispute handling.

### Defer

* ML fraud scoring;
* sophisticated device fingerprinting;
* graph-based fraud detection;
* automated bans;
* advanced behavioral models;
* cross-platform identity matching;
* dedicated fraud microservice;
* real-time fraud streaming infrastructure;
* complex appeals platform;
* automated legal/compliance workflows.

---

# 39. Module Structure

Following the existing modular-monolith architecture:

```text
dispute/
├── api/
│   ├── DisputeController
│   ├── EvidenceController
│   └── ReportController
│
├── application/
│   ├── command/
│   │   ├── OpenDispute
│   │   ├── SubmitEvidence
│   │   ├── ResolveDispute
│   │   ├── RequestEvidence
│   │   ├── ApplyRestriction
│   │   └── RemoveRestriction
│   │
│   ├── query/
│   │   ├── GetDispute
│   │   ├── ListDisputes
│   │   └── GetDisputeEvidence
│   │
│   ├── service/
│   └── port/
│
├── domain/
│   ├── model/
│   │   ├── Dispute
│   │   ├── DisputeEvidence
│   │   ├── AbuseReport
│   │   └── AccountRestriction
│   │
│   ├── valueobject/
│   ├── event/
│   ├── exception/
│   └── repository/
│
└── infrastructure/
    ├── persistence/
    ├── storage/
    └── configuration/
```

Fraud/risk evaluation can initially live inside this module or a small dedicated `risk` package.

It does **not** need to become a microservice.

---

# 40. Important Cross-Module Relationships

```text
Service Request
      ↓
Booking
      ↓
Job
      ↓
Payment
      ↓
Review
      ↓
Dispute
```

The dispute system reads information from these modules.

It should not take ownership of them.

For example:

```text
Dispute
   └── references jobId
```

rather than:

```text
Dispute
   └── owns a duplicate copy of Job
```

Historical snapshots should still be captured where the dispute requires them.

---

# 41. Decision Matrix

| Problem                        | Primary system          | Dispute involvement |
| ------------------------------ | ----------------------- | ------------------- |
| Worker doesn't arrive          | Job                     | Possible            |
| Customer doesn't arrive        | Job                     | Possible            |
| Payment failed                 | Payment                 | Possible            |
| Payment charged twice          | Payment                 | Yes                 |
| Work quality complaint         | Job/Dispute             | Yes                 |
| Additional charge disagreement | Additional Work/Dispute | Yes                 |
| Fake review                    | Review                  | Yes                 |
| Account abuse                  | Identity/Risk           | Possible            |
| Payment bypass                 | Risk/Operations         | Possible            |
| Chargeback                     | Payment                 | Yes                 |
| Safety report                  | Dispute/Operations      | Yes                 |

This prevents the dispute module from becoming a dumping ground for every business problem.

---

# 42. Long-Term Evolution

As the marketplace grows, the fraud and dispute system may evolve into:

```text
Business Events
       ↓
Event Stream
       ↓
Risk Feature Store
       ↓
Rules Engine
       ↓
Fraud Models
       ↓
Risk Cases
       ↓
Operations
       ↓
Enforcement
```

But this is a future architecture.

The initial system should remain:

```text
PostgreSQL
+
Spring Boot
+
Deterministic rules
+
Background processing
+
Admin investigation
```

---

# 43. Core Invariants

The system must enforce:

1. A dispute must reference a legitimate business relationship.
2. A dispute cannot be resolved twice.
3. Evidence must belong to the dispute.
4. Evidence history must be preserved.
5. A dispute is not automatically proof of fraud.
6. A risk signal is not automatically proof of fraud.
7. Refunds must follow the payment system's financial invariants.
8. Historical payment records must not be rewritten.
9. Admin actions must be auditable.
10. Account restrictions must have explicit reasons.
11. Suspension must not delete historical trust/financial data.
12. Reviews must remain linked to their eligible jobs.
13. No-show and cancellation remain distinct.
14. Sensitive evidence must have access control.
15. Raw location data must not be exposed unnecessarily.
16. Fraud detection should be explainable.
17. Critical actions must be idempotent.
18. Human review should remain available for significant enforcement decisions.

---

# 44. Final Architecture Principle

The marketplace will eventually encounter users who make mistakes, users who disagree, users who abuse the system, and potentially users who deliberately attempt fraud.

The architecture should therefore avoid both extremes:

```text
Trust everyone
```

and

```text
Treat everyone as suspicious
```

Instead:

```text
Capture events
      ↓
Preserve evidence
      ↓
Detect signals
      ↓
Investigate
      ↓
Apply explicit policy
      ↓
Record decision
      ↓
Allow appropriate recourse
```

The fundamental principle is:

> **The platform should be able to reconstruct what happened and explain why an operational or financial action was taken.**

That principle will become increasingly important as transaction volume, worker count, customer count, and financial exposure grow.

---

# 45. Open Decisions

The following should remain product/operations decisions rather than being invented at the architecture stage:

* exact dispute SLA;
* refund policy;
* compensation policy;
* worker/customer liability rules;
* safety escalation procedure;
* evidence retention duration;
* exact identity/KYC requirements;
* exact platform-bypass policy;
* account restriction thresholds;
* appeal eligibility;
* automated vs manual enforcement thresholds;
* chargeback handling policy;
* legal/compliance requirements;
* whether location telemetry can be used as dispute evidence;
* whether workers can challenge customer reviews;
* whether customers can challenge worker reviews.

These should be documented as explicit decisions later.

# End of Document
