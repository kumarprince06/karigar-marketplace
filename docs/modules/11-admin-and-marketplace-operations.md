# Admin/Ops Platform & Marketplace Operations

## 1. Purpose

The Karigar Marketplace is a marketplace, not just a collection of customer and worker APIs.

A real marketplace requires an operational system that allows authorized staff to:

* verify workers
* monitor marketplace health
* investigate disputes
* manage problematic accounts
* inspect jobs and bookings
* investigate payment issues
* moderate reviews
* manage service categories
* handle incidents
* investigate fraud/abuse
* correct operational issues safely
* monitor system and business health

The Admin/Ops platform is therefore a **first-class product capability**.

It should not be treated as:

```text
an internal CRUD dashboard
```

Instead:

> **Admin/Ops is the operational control plane for the marketplace.**

---

# 2. Admin vs Operations

These concepts should be distinguished.

### Admin

Controls platform configuration and privileged actions.

Examples:

```text
worker suspension
verification decisions
category management
role management
platform configuration
```

### Operations

Runs the day-to-day marketplace.

Examples:

```text
dispute investigation
failed booking investigation
payment investigation
worker support
customer support
marketplace monitoring
```

A single person may perform both roles initially, but the architecture should not assume they are permanently the same role.

---

# 3. Core Admin/Ops Actors

Potential roles:

```text
SUPER_ADMIN
ADMIN
OPERATIONS
TRUST_AND_SAFETY
FINANCE
CUSTOMER_SUPPORT
WORKER_SUPPORT
ANALYST
```

The exact role set is an open organizational decision.

The architecture should support fine-grained permissions later.

---

# 4. Principle: Least Privilege

An operator should only access what they need.

For example:

```text
Customer Support
    ↓
customer/profile/job information

Finance
    ↓
payment/refund/settlement information

Trust & Safety
    ↓
verification/review/dispute information
```

Not every operator should have unrestricted access to everything.

---

# 5. Admin Authentication

Admin access should be stronger than ordinary customer authentication.

Potential requirements:

```text
strong authentication
shorter session lifetime
MFA
role-based authorization
device/session management
audit logging
```

The exact authentication mechanism is an implementation/security decision.

---

# 6. Admin Authorization

Every sensitive action must verify:

```text
authenticated admin
        ↓
role
        ↓
permission
        ↓
resource access
        ↓
business rule
```

Do not rely on:

```text
hidden UI buttons
```

as authorization.

The backend must enforce permissions.

---

# 7. Admin API Separation

Admin endpoints should remain clearly separated from customer/worker APIs.

Existing structure:

```text
/api/v1/admin/...
```

should remain distinct.

For example:

```text
GET /api/v1/admin/workers
POST /api/v1/admin/workers/{id}/suspend
GET /api/v1/admin/disputes
POST /api/v1/admin/disputes/{id}/resolve
```

---

# 8. Admin Actions Are Commands

Avoid:

```text
PATCH /admin/workers/{id}
```

with arbitrary fields such as:

```text
status
verification
rating
role
balance
```

Instead use explicit operations:

```text
suspend worker
approve verification
reject verification
resolve dispute
issue refund
```

This makes authorization, auditing, and business rules clearer.

---

# 9. Admin Dashboard

The dashboard should provide a marketplace overview.

Potential sections:

```text
Marketplace Health
Workers
Customers
Service Requests
Matching
Bookings
Jobs
Payments
Refunds
Reviews
Disputes
Verification
Notifications
System Health
Audit
```

---

# 10. Marketplace Overview

Important operational metrics include:

```text
requests today
matches today
bookings today
completed jobs today
active workers
active jobs
failed matches
cancellations
no-shows
payment failures
open disputes
pending verifications
```

These are operational indicators, not merely analytics.

---

# 11. Operational Dashboard

Example:

```text
Marketplace
────────────────────────────
Service Requests       1,245
Matches                 987
Bookings                742
Completed Jobs          681

Active Workers           316
Pending Verification      42
Open Disputes             17
Payment Issues             9
```

The exact metrics and presentation will be finalized later.

---

# 12. Marketplace Funnel

Operators should be able to inspect:

```text
Requests
   ↓
Matched
   ↓
Accepted
   ↓
Booked
   ↓
Started
   ↓
Completed
```

Unexpected drops can reveal operational problems.

For example:

```text
many requests
+
few matches
```

could indicate:

```text
worker supply problem
matching problem
availability problem
coverage problem
```

The dashboard should expose the facts; operators investigate the cause.

---

# 13. Worker Operations

Admin/Ops should be able to search workers by:

```text
name
phone/reference
profession
skill
verification status
worker status
service area
availability
rating
completed jobs
```

Search must remain:

```text
paginated
bounded
authorized
audited where sensitive
```

---

# 14. Worker Profile View

An authorized operator may need to see:

```text
worker identity summary
profession
skills
experience
verification status
verification history
availability
service area
job history
cancellations
no-shows
reviews
disputes
earnings summary
account status
```

Sensitive documents should not automatically be visible.

---

# 15. Verification Operations

Verification is a major operational workflow.

Admin should be able to:

```text
view pending verification
inspect permitted evidence
approve
reject
request resubmission
revoke
```

Every decision should record:

```text
actor
action
reason
timestamp
verification ID
```

---

# 16. Verification Rejection

A rejection should have a structured reason where practical.

Examples:

```text
DOCUMENT_UNCLEAR
DOCUMENT_EXPIRED
INFORMATION_MISMATCH
INSUFFICIENT_EVIDENCE
OTHER
```

The exact taxonomy is a product/operations decision.

---

# 17. Verification Evidence Access

Verification documents are sensitive.

Access should be:

```text
permission-controlled
audited
time-limited where appropriate
not exposed through normal worker APIs
```

Operators should see only what is necessary.

---

# 18. Worker Suspension

Authorized admins may need to suspend workers.

Possible reasons:

```text
safety concern
fraud investigation
verification issue
repeated policy violation
operational investigation
```

The reason should be recorded.

---

# 19. Suspension Behavior

When a worker becomes suspended:

```text
new matching offers → blocked
new bookings → blocked where policy requires
active work → handled according to policy
login → policy-dependent
historical records → preserved
```

Suspension should not erase history.

---

# 20. Customer Operations

Operators should also be able to search customers.

Potential fields:

```text
account status
service requests
bookings
jobs
payments
refunds
reviews
disputes
```

Access should follow privacy and role restrictions.

---

# 21. Customer Suspension

Customers may also require account restrictions.

Examples:

```text
fraudulent activity
payment abuse
review manipulation
platform abuse
```

The same principle applies:

```text
explicit action
+
reason
+
audit
```

---

# 22. Service Request Operations

Operators should be able to investigate:

```text
request ID
customer
profession
location area
status
created time
matching result
assigned worker
booking
```

They should be able to understand why a request is:

```text
unmatched
expired
cancelled
failed
```

---

# 23. Matching Investigation

The system should preserve enough information to explain matching decisions.

An operator may need to know:

```text
candidates considered
candidate excluded reason
distance
skill match
availability
verification requirement
capacity
offer status
```

Not necessarily every internal implementation detail, but enough to diagnose marketplace behavior.

---

# 24. Example Matching Investigation

```text
Request #123
Profession: Electrician

Candidate A
Distance: 1.2 km
Skill: MATCH
Availability: YES
Verification: APPROVED
Result: OFFERED

Candidate B
Distance: 0.8 km
Skill: NO MATCH
Result: EXCLUDED

Candidate C
Distance: 2.1 km
Skill: MATCH
Availability: NO
Result: EXCLUDED
```

This makes matching operationally explainable.

---

# 25. Booking Operations

Operators should be able to inspect:

```text
request
worker
customer
booking state
timestamps
cancellation
reschedule history
job
payment
```

The system should present the lifecycle as a timeline.

---

# 26. Job Timeline

Example:

```text
10:02 Request Submitted
10:03 Worker Matched
10:05 Worker Accepted
10:06 Booking Confirmed
10:22 Worker En Route
10:41 Worker Arrived
10:45 Work Started
11:35 Work Completed
11:40 Payment Successful
11:45 Review Submitted
```

This can dramatically improve operational investigation.

---

# 27. Job Intervention

Operators should be cautious about modifying active jobs.

Avoid arbitrary:

```text
change job status
```

Instead expose controlled operational commands where genuinely required.

Example:

```text
mark operationally cancelled
record no-show investigation
trigger customer support workflow
```

Every intervention should be audited.

---

# 28. No-Show Operations

No-show handling should preserve:

```text
who reported it
when reported
job stage
evidence
operator decision
```

Do not automatically treat every no-show report as confirmed wrongdoing.

---

# 29. Cancellation Investigation

Cancellation records should include:

```text
actor
reason
timestamp
job/request stage
policy applied
```

This allows operators to distinguish:

```text
normal cancellation
worker cancellation
customer cancellation
system expiration
no-show
```

---

# 30. Dispute Operations

The dispute system should provide:

```text
OPEN
   ↓
UNDER_REVIEW
   ↓
RESOLVED
```

Operators should see:

```text
customer statement
worker statement
job timeline
payment information
evidence
reviews
relevant audit events
```

---

# 31. Dispute Evidence

Evidence can include:

```text
photos
documents
job completion evidence
payment records
communication references
```

Sensitive evidence must remain permission-controlled.

---

# 32. Dispute Resolution

Resolution should require:

```text
outcome
reason
operator
timestamp
supporting evidence/reference
```

Possible outcomes already defined:

```text
CUSTOMER_FAVOUR
WORKER_FAVOUR
PARTIAL
NO_ACTION
```

---

# 33. Financial Operations

Finance-authorized users should be able to investigate:

```text
payments
provider transactions
refunds
worker earnings
settlements
reconciliation
```

They should not directly manipulate database balances.

---

# 34. Refund Operations

Refunds should be explicit actions.

For example:

```text
POST /admin/payments/{id}/refund
```

with:

```text
amount
reason
reference
```

The backend validates:

```text
payment state
remaining refundable amount
authorization
idempotency
```

---

# 35. Financial Correction

If a financial record is wrong, do not:

```text
edit payment amount directly
```

Prefer:

```text
correction/adjustment record
+
reason
+
actor
+
audit
```

Financial history should remain reconstructable.

---

# 36. Payment Reconciliation

Admin/Finance should be able to identify:

```text
internal payment
vs
provider payment
```

and detect:

```text
missing provider event
status mismatch
refund mismatch
amount mismatch
```

---

# 37. Provider Webhook Investigation

Operators may need to inspect:

```text
provider event ID
provider
received timestamp
signature validation result
processing status
attempt count
associated payment
```

Sensitive provider payloads should be access-controlled and minimized.

---

# 38. Review Operations

Review moderation should support:

```text
FLAGGED
UNDER_REVIEW
HIDDEN
RESTORED
```

Operators should see:

```text
review
job relationship
reviewer
worker
reported reason
history
```

---

# 39. Review Moderation

Do not permanently delete reviews merely because they are inconvenient.

Use:

```text
moderation state
+
reason
+
audit trail
```

Historical moderation decisions should remain reconstructable.

---

# 40. Abuse Operations

Potential abuse signals include:

```text
repeated account creation
OTP abuse
fake jobs
review manipulation
payment abuse
rapid cancellations
suspicious worker/customer relationships
```

These are signals for investigation, not automatic proof of wrongdoing.

---

# 41. Fraud System Evolution

Initial system:

```text
deterministic rules
+
operator investigation
```

Later:

```text
risk scoring
+
automated detection
+
manual review
```

Advanced ML should only be introduced when sufficient data and validated requirements exist.

---

# 42. Account Investigation

An operator should be able to inspect a user's operational timeline:

```text
account created
OTP activity summary
profile changes
requests
bookings
payments
reviews
disputes
suspensions
```

Sensitive authentication information should not be exposed unnecessarily.

---

# 43. Audit Timeline

For important entities, operators should see:

```text
timeline of significant events
```

Example:

```text
Worker created
Verification submitted
Verification approved
Skill updated
Booking accepted
Job completed
Review received
Dispute opened
Dispute resolved
```

---

# 44. Admin Audit Logging

Every privileged action should record:

```text
actor_user_id
actor_role
action
entity_type
entity_id
reason
metadata
request_id
occurred_at
```

This was defined in the observability/security architecture and is especially important for Admin/Ops.

---

# 45. Immutable Audit Principle

Admin audit events should be append-oriented.

Do not allow ordinary operators to:

```text
edit audit history
```

---

# 46. Admin Search

Search should support operational workflows without creating database overload.

Use:

```text
indexed fields
bounded date ranges
pagination
specific filters
```

Avoid unrestricted:

```text
SELECT * FROM everything
```

through the admin UI.

---

# 47. Admin Exports

Exports may eventually be useful for:

```text
finance
operations
compliance
analytics
```

Exports must have:

```text
authorization
purpose
scope
audit
expiration
```

Sensitive exports should not remain permanently accessible.

---

# 48. Bulk Operations

Bulk operations are powerful and dangerous.

Potential examples:

```text
bulk worker verification review
bulk notification
bulk suspension
```

MVP should keep bulk actions limited.

When introduced, bulk actions should have:

```text
preview
authorization
validation
idempotency
audit
result summary
failure handling
```

---

# 49. Dangerous Admin Actions

Examples:

```text
suspend account
approve verification
issue refund
modify configuration
```

should require explicit confirmation.

Potentially high-risk actions may require:

```text
reason
second approval
MFA re-authentication
```

depending on risk.

---

# 50. Dual Control

Financially sensitive or destructive actions may eventually require:

```text
Operator A proposes
        ↓
Operator B approves
```

This is especially relevant to:

```text
large refunds
financial adjustments
high-risk account actions
```

Exact thresholds remain an operations decision.

---

# 51. Admin Configuration

Platform configuration may include:

```text
profession activation
skill catalog
matching radius defaults
request expiry
notification settings
platform fees
feature flags
```

Configuration changes should be:

```text
versioned where appropriate
audited
permission-controlled
validated
```

---

# 52. Configuration History

For important configuration:

```text
old value
new value
actor
timestamp
reason
```

should be preserved.

This is critical when investigating:

```text
"Why did matching behavior change yesterday?"
```

---

# 53. Catalog Management

Admin should eventually manage:

```text
professions
skills
skill relationships
service categories
```

But catalog changes should not silently invalidate historical transactions.

---

# 54. Historical Snapshot Principle

Suppose:

```text
Electrician skill "AC Repair"
```

is renamed.

Historical jobs should not suddenly appear as if they originally used a different concept.

Transactions should preserve appropriate historical snapshots/references.

---

# 55. Marketplace Supply Operations

Operations should monitor worker supply by area:

```text
active workers
available workers
workers accepting jobs
pending verification
```

This helps identify marketplace density issues.

---

# 56. Marketplace Demand Operations

Monitor:

```text
requests per area
requests per profession
requests per time period
unmatched requests
average matching delay
```

This helps identify demand/supply imbalance.

---

# 57. Supply-Demand View

Conceptually:

```text
Area A

Demand
████████████████

Supply
██████
```

The dashboard should present factual measurements.

Operators can then investigate:

```text
worker recruitment
coverage
availability
matching configuration
```

---

# 58. Geographic Operations

The admin system should support geographic filtering.

Examples:

```text
workers in area
requests in area
unmatched requests in area
active jobs in area
```

PostGIS should handle geographic queries efficiently.

---

# 59. Location Privacy

Admin access to exact coordinates should be restricted.

For many operations:

```text
approximate area
```

is sufficient.

Exact customer address/location should only be revealed when operationally necessary.

---

# 60. Worker Home Privacy

A worker's service-area center should not automatically be treated as:

```text
worker home address
```

Admin UI should preserve this distinction.

---

# 61. Notification Operations

Operators should be able to inspect:

```text
notification status
channel
provider
failure reason
retry count
recipient
```

This helps diagnose:

```text
"Why didn't the customer receive the booking update?"
```

---

# 62. Notification Retry

Operators may eventually be allowed to:

```text
retry failed notification
```

but the action must be idempotent.

It should not accidentally produce duplicate messages.

---

# 63. Background Job Operations

The operations platform should expose worker health:

```text
queue depth
oldest pending job
processing rate
failure rate
retry count
dead-letter count
```

This connects technical health with marketplace behavior.

---

# 64. Dead-Letter Operations

Failed events may eventually enter a dead-letter state.

Operators should be able to:

```text
inspect
classify
retry safely
discard where appropriate
```

Reprocessing must respect idempotency.

---

# 65. Operational Alerts

Potential alerts:

```text
payment failure spike
matching failure spike
booking failure spike
outbox backlog
notification backlog
database health
Redis health
worker processing stopped
```

Alerts should lead to actionable investigation.

---

# 66. Alert Fatigue

Do not alert on every warning.

An alert should generally answer:

```text
Is something important wrong?
Does someone need to act?
```

Otherwise operators stop trusting alerts.

---

# 67. Operational Runbooks

Each major alert should eventually link to a runbook.

Example:

```text
Alert:
Payment webhook backlog high

Runbook:
1. inspect provider
2. inspect webhook queue
3. inspect application errors
4. verify provider connectivity
5. check database
6. inspect reconciliation
7. escalate if required
```

---

# 68. Admin UX Principle

The Admin/Ops interface should answer:

```text
What happened?
Why did it happen?
Who was affected?
What state is the entity in?
What can I safely do?
What will happen if I do it?
```

---

# 69. Timeline-First Operations

For complicated cases, the most useful interface is often:

```text
entity
 ↓
timeline
 ↓
related entities
 ↓
evidence
 ↓
available actions
```

rather than dozens of disconnected CRUD pages.

---

# 70. Related Entity Navigation

An operator investigating a booking should easily navigate:

```text
Booking
  ↓
Service Request
  ↓
Customer
  ↓
Worker
  ↓
Job
  ↓
Payment
  ↓
Reviews
  ↓
Dispute
```

Authorization must be checked at every resource boundary.

---

# 71. Customer Support Workflow

A support operator may receive:

> "The worker did not arrive."

The system should allow:

```text
search customer
 ↓
find booking
 ↓
inspect job timeline
 ↓
inspect worker events
 ↓
inspect no-show/cancellation
 ↓
review available evidence
 ↓
create/assist dispute
```

This is much safer than directly changing job status.

---

# 72. Worker Support Workflow

Example:

> "I accepted the job but the customer cancelled."

Operator can inspect:

```text
match
 ↓
booking
 ↓
cancellation
 ↓
job state
 ↓
payment
 ↓
policy
```

and provide support without modifying historical facts.

---

# 73. Verification Support Workflow

Example:

> Worker says verification has been pending too long.

Operator sees:

```text
submission time
 ↓
current status
 ↓
review queue
 ↓
previous decisions
 ↓
missing evidence
```

This helps identify whether the issue is:

```text
normal queue delay
missing evidence
provider problem
operational backlog
```

---

# 74. Financial Support Workflow

Example:

> Customer says money was charged but booking failed.

Operator investigates:

```text
service request
 ↓
booking
 ↓
payment
 ↓
provider transaction
 ↓
webhook events
 ↓
refund
```

The system should preserve the chain.

---

# 75. Operational Corrections

When a correction is genuinely necessary:

```text
never silently overwrite history
```

Instead:

```text
correction action
+
reason
+
actor
+
audit
+
new resulting state
```

---

# 76. Emergency Operations

The platform may eventually provide controlled emergency switches:

```text
pause matching
disable payment provider
disable new worker registration
disable specific feature
pause notifications
```

These should be:

```text
strongly authorized
audited
visible
reversible
```

where possible.

---

# 77. Admin API Security

Admin APIs require:

```text
authentication
RBAC
resource authorization
rate limiting
audit
input validation
idempotency for commands
```

They should be treated as high-value attack targets.

---

# 78. Admin UI Security

The UI should additionally use:

```text
secure session management
CSRF protection where applicable
strict CORS
secure cookies where applicable
XSS protections
short-lived sessions
re-authentication for sensitive actions
```

---

# 79. Admin Data Privacy

Admin users may have access to sensitive information.

Therefore:

```text
access itself is a privilege
```

Potential controls:

```text
field-level masking
role-based visibility
audit
purpose restrictions
export restrictions
```

---

# 80. Sensitive Field Masking

For example, some roles may see:

```text
+91******1234
```

instead of the full phone number.

The exact masking policy depends on operational needs.

---

# 81. Verification Document Access

Verification documents should not appear in:

```text
normal worker list
```

They should require explicit access.

Access may itself be audited.

---

# 82. Payment Data Access

Operators generally need:

```text
amount
currency
provider reference
status
timestamps
```

but should not receive sensitive payment credentials.

---

# 83. Admin Performance

Admin queries can become expensive.

Use:

```text
server-side pagination
indexed search
bounded time ranges
read projections
```

Heavy analytics should eventually move away from transactional queries.

---

# 84. Admin Architecture

Proposed module:

```text
admin/
├── api/
│   ├── worker/
│   ├── customer/
│   ├── request/
│   ├── booking/
│   ├── payment/
│   ├── dispute/
│   ├── verification/
│   ├── review/
│   ├── notification/
│   └── audit/
│
├── application/
│   ├── command/
│   ├── query/
│   ├── service/
│   └── port/
│
├── domain/
│   ├── model/
│   ├── permission/
│   └── exception/
│
└── infrastructure/
    ├── persistence/
    ├── authorization/
    └── configuration/
```

The Admin module should orchestrate operations while respecting ownership of business rules in the relevant domain modules.

---

# 85. Admin Does Not Own Every Domain

For example:

```text
admin
   ↓
asks Worker module to suspend worker
```

rather than:

```text
admin
   ↓
directly updates worker.status
```

Similarly:

```text
admin
   ↓
asks Payment module to issue refund
```

rather than:

```text
admin
   ↓
updates payment table
```

---

# 86. Cross-Module Operations

An admin operation may involve multiple modules.

Example:

```text
suspend worker
 ↓
Worker status changes
 ↓
matching eligibility changes
 ↓
notifications
 ↓
audit
```

The Worker module owns the worker-state transition.

Other consequences happen through domain/application events.

---

# 87. Admin Commands

Potential command model:

```text
SuspendWorker
ApproveVerification
RejectVerification
ResolveDispute
IssueRefund
SuspendCustomer
ModerateReview
RetryNotification
PauseFeature
```

Commands should contain explicit intent.

---

# 88. Admin Queries

Queries may include:

```text
SearchWorkers
GetWorkerOperationalProfile
SearchRequests
GetBookingTimeline
SearchPayments
GetDisputeCase
GetVerificationQueue
GetMarketplaceHealth
GetAuditHistory
```

Queries should not mutate state.

---

# 89. Admin Event Trail

Important admin actions should generate events such as:

```text
WorkerSuspended
VerificationApproved
VerificationRejected
DisputeResolved
RefundIssued
ReviewModerated
FeatureDisabled
```

These can feed:

```text
audit
notifications where appropriate
analytics
```

---

# 90. Admin and Observability

Admin actions should correlate with:

```text
requestId
traceId
actorId
audit event
```

This makes investigations reconstructable.

---

# 91. Admin and Notifications

Some admin actions may trigger user notifications.

Example:

```text
worker suspension
verification rejection
dispute resolution
refund
```

But notification failure should not undo the admin decision.

---

# 92. Admin and Idempotency

Commands should be safe against duplicate requests.

For example:

```text
POST suspend worker
```

should not create multiple contradictory effects if the request is retried.

---

# 93. Admin and Concurrency

Two operators may act on the same entity simultaneously.

Example:

```text
Operator A → approve verification
Operator B → reject verification
```

The system must prevent conflicting stale operations using:

```text
version checks
state validation
transactions
```

---

# 94. Optimistic Concurrency

Admin actions should preferably include entity/version validation where necessary.

Conceptually:

```text
version = 5
 ↓
operator opens case
 ↓
another operator changes case
 ↓
version = 6
 ↓
first operator attempts action
 ↓
stale operation rejected
```

---

# 95. Audit vs Operational Notes

These should be separate concepts.

### Audit

Immutable system record:

```text
who did what and when
```

### Operational note

Human investigation context:

```text
"Customer contacted support and provided photo."
```

Both can be useful, but they have different purposes and retention/access rules.

---

# 96. Admin Notes

Notes may eventually support:

```text
dispute cases
worker investigations
customer support cases
payment investigations
```

Notes should have:

```text
author
timestamp
content
visibility
```

Sensitive notes must be access-controlled.

---

# 97. Support Case Concept

A future support-case abstraction may connect:

```text
customer
worker
booking
job
payment
dispute
operator notes
```

This should only be introduced if operational workflows become complex enough to justify it.

---

# 98. Admin Metrics

Track operational performance such as:

```text
verification queue age
dispute resolution time
support case volume
refund processing time
notification failure rate
matching failure rate
```

These metrics help identify operational bottlenecks.

---

# 99. Marketplace Health Indicators

Useful indicators include:

```text
match rate
acceptance rate
booking conversion
completion rate
cancellation rate
no-show rate
payment success rate
dispute rate
verification backlog
```

These are measurements, not rankings of individual workers.

---

# 100. Operational Alerts

Potential examples:

```text
unmatched requests suddenly increase
payment failures increase
verification queue becomes stale
outbox backlog grows
notification failures spike
database latency increases
```

---

# 101. MVP Admin/Ops Scope

The initial Admin/Ops system should support:

```text
admin authentication
RBAC
worker search
customer search
worker verification
worker suspension
customer suspension
service request inspection
booking inspection
job timeline
payment inspection
basic refund operations
dispute management
review moderation
notification inspection
audit history
basic marketplace dashboard
```

---

# 102. MVP Admin/Ops Should Not Include

Avoid initially:

```text
complex workflow engine
AI fraud system
ML risk scoring
advanced BI platform
complex bulk automation
multi-level approval everywhere
custom CRM
full accounting system
complex workforce management
```

Build operational capabilities around real problems.

---

# 103. Future Admin/Ops Capabilities

Potential future additions:

```text
support cases
advanced fraud detection
automated risk rules
bulk operations
advanced financial reconciliation
regional operations dashboards
worker supply planning
experiment management
advanced feature flags
workflow automation
```

---

# 104. Admin Architecture Evolution

Initial:

```text
Admin UI
   ↓
Admin API
   ↓
Modular Monolith
```

Later:

```text
Admin UI
   ↓
Admin API
   ↓
Operational services/read models
   ↓
Domain modules
```

The admin interface should not require direct access to databases.

---

# 105. Admin Read Models

As operational queries become expensive, dedicated read models may be introduced.

Example:

```text
WorkerOperationalView
BookingOperationalView
PaymentOperationalView
MarketplaceHealthView
```

These are derived representations, not replacements for authoritative domain data.

---

# 106. Admin Search Engine

A dedicated search engine may eventually be introduced if operational search becomes too complex for PostgreSQL.

Until then:

```text
PostgreSQL
+
proper indexes
+
projections
```

should be sufficient.

---

# 107. Operational Data Retention

Admin logs, notes, audit events, and investigation data require explicit retention policies.

These policies should align with the privacy/compliance architecture.

---

# 108. Admin Disaster Recovery

The Admin/Ops system is operationally critical.

However:

```text
admin UI unavailable
```

does not necessarily mean:

```text
customer transactions unavailable
```

The core marketplace should remain independently functional whenever possible.

---

# 109. Admin Failure Isolation

Avoid allowing:

```text
expensive admin analytics query
```

to degrade:

```text
booking APIs
```

Admin workloads should have appropriate resource/query controls.

---

# 110. Operational Principle

The Admin/Ops system should provide:

```text
visibility
+
controlled intervention
```

not:

```text
unrestricted database access
```

---

# 111. Admin/Ops Invariants

The system must maintain:

1. Admin users are strongly authenticated.
2. Admin permissions are explicitly defined.
3. Least privilege is enforced.
4. Backend authorization cannot depend on UI behavior.
5. Admin APIs are separated from customer/worker APIs.
6. Sensitive actions use explicit commands.
7. Important admin actions are audited.
8. Audit history is append-oriented.
9. Historical transactional data is not silently overwritten.
10. Financial corrections use explicit adjustment/correction records.
11. Verification decisions preserve history.
12. Verification evidence is strictly access-controlled.
13. Worker suspension preserves historical data.
14. Customer suspension preserves historical data.
15. Dispute decisions preserve evidence and decision history.
16. Review moderation preserves moderation history.
17. Admin searches are bounded and paginated.
18. Exact customer/worker locations are exposed only when necessary.
19. Sensitive data is masked or restricted where appropriate.
20. Admin actions are idempotent where retry is possible.
21. Concurrent admin actions cannot silently overwrite each other.
22. Domain modules remain owners of their business rules.
23. Admin does not directly manipulate another module's persistence.
24. Critical financial operations remain inside the Payment domain/application boundary.
25. Admin interventions do not bypass security/business invariants.
26. Operational notes remain distinct from immutable audit records.
27. Bulk actions require additional safeguards.
28. Emergency controls are strongly authorized and audited.
29. Admin workloads cannot unnecessarily degrade customer/worker traffic.
30. Operational dashboards expose measurements rather than opaque judgments.
31. Sensitive admin access itself may be audited.
32. Admin capabilities evolve according to real operational needs.
33. The platform should remain functional even if non-critical admin capabilities fail.
34. Every high-risk intervention should answer who, what, why, when, and resulting state.

---

# 112. Final Admin/Ops Architecture

```text
                         Admin / Ops Users
                                │
                                ↓
                         Admin Web UI
                                │
                                ↓
                         Admin API Layer
                                │
                    ┌───────────┼───────────┐
                    ↓           ↓           ↓
                Commands     Queries      Audit
                    │           │
                    ↓           ↓
             Domain Modules   Read Models
                    │
        ┌───────────┼────────────────────┐
        ↓           ↓                    ↓
      Worker      Booking              Payment
      Domain      Domain               Domain
        │           │                    │
        └───────────┼────────────────────┘
                    ↓
               PostgreSQL
                    │
                    ↓
               Event / Outbox
                    │
       ┌────────────┼────────────┐
       ↓            ↓            ↓
 Notifications   Realtime    Analytics
```

---

# 113. Final Principle

The marketplace cannot operate reliably with only:

```text
customer application
+
worker application
```

It also needs:

```text
operational visibility
+
controlled intervention
+
auditability
+
support workflows
+
trust operations
+
financial operations
```

Therefore:

> **Admin/Ops is not a backdoor into the database. It is a controlled operational layer over the marketplace's domain capabilities.**

The system should make it possible for an operator to investigate a real-world problem from:

```text
User
 ↓
Request
 ↓
Match
 ↓
Booking
 ↓
Job
 ↓
Payment
 ↓
Review / Dispute
```

and understand **what happened, why it happened, what evidence exists, and what actions are safe to take**.

That operational capability will become increasingly important as the number of customers, workers, jobs, payments, and geographic areas grows.

# End of Document
