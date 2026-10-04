# Data Privacy, PII, Data Retention & Compliance Architecture

**Project:** Karigar Marketplace
**Status:** Architecture / Engineering Design
**Jurisdiction:** India (launch: Howrah / Kolkata, West Bengal)
**Primary law:** Digital Personal Data Protection Act, 2023 (DPDP Act) and DPDP Rules, 2025

---

## Current Model (aligned with ERD and DPDP)

> The ERD ([architecture/03](../architecture/03-erd-and-production-database-design.md)) is the source of truth for tables and columns. Where this document and the ERD disagree, the ERD wins. Legal points marked **verify with legal** must be confirmed by Indian counsel before launch.

* **Law and roles:** Karigar is a **Data Fiduciary** under the DPDP Act. Vendors (cloud, email, push, payments, KYC) are **Data Processors** under written contracts (§104). We are not a Significant Data Fiduciary at launch; SDF duties (DPO in India, DPIA, audit) apply only if the Central Government notifies us.
* **There is no "contract" or "legitimate interest" basis in India.** Processing is based on **consent** (s.6) after a **notice** (s.5), or on a **legitimate use** (s.7). Retention beyond the purpose is allowed only where another law requires it (s.8(7)). See §45 and §96.
* **Commencement:** DPDP Rules notified 13 Nov 2025. Board rules are already in force; Consent Manager rules from 13 Nov 2026; notice, consent, security, breach, rights and retention duties from **13 May 2027** (MeitY has proposed bringing this forward; **verify with legal**). We build to the full regime before launch.
* **Who is covered (ERD):** `users` (email + password login, phone stored, OTP later — ADR 0016), customers, workers, admin staff, and **third parties the customer names**: site contacts on `addresses` (`address_for`, `contact_name`, `contact_phone`, ERD §22).
* **Identity documents (ERD §15–16):** Aadhaar via DigiLocker / offline e-KYC only; we store **masked number (last 4), reference id, name, year of birth** — never the full number, a card copy or e-KYC XML (Aadhaar Act s.29). PAN: masked for display, full PAN **encrypted** (`document_number_encrypted`) only because TDS returns need it. Files sit in a private bucket.
* **Location:** customer service location (`addresses.location`), worker current location (`worker_locations`, overwritten, no history), and **visit check-in / check-out GPS** (`job_visits.check_in_location`, `check_out_location`, ERD §40.1) kept for dispute evidence only, then cleared (§102).
* **Payout accounts (ERD §46.2):** UPI VPA or bank **last 4 + IFSC** only; full account number is never stored. Card data is never stored (RBI card-on-file rules; the payment provider tokenises).
* **Sessions (ERD §52.2):** `refresh_sessions` (IP, user agent) and `user_devices` (FCM push token) are personal data with a 1-year log retention (§102).
* **Consent records (ERD §52.3):** `user_consents` is append-only; the latest row per (user, purpose) is the current state; withdrawal is one tap. Purpose codes are listed in §96.
* **Children:** customers and workers must be **18+**. Under-18 sign-up is refused, so verifiable parental consent is never needed (§99).
* **Rights (s.11–14):** access summary, correction / completion / updating, erasure, grievance redressal and nomination, through `/api/v1/me/...` endpoints (§97). GDPR-style "portability" is not a DPDP right and is not promised.
* **Breach:** CERT-In within **6 hours**; Data Protection Board and affected users **without delay**; detailed report to the Board within **72 hours** (§101).
* **Residency:** all production data, backups and logs in an **India cloud region** (§103).
* **Retention:** concrete periods per category in §102; deleted accounts are anonymised, not cascaded (§38–40).
* **New tables** needed in the ERD are listed in §105.

---

## 1. Purpose

The platform will handle personal and potentially sensitive information belonging to:

* customers;
* workers;
* administrators;
* payment participants;
* verification subjects;
* dispute participants.

Examples include:

```text
Phone numbers
Names
Email addresses
Home/service addresses
Location coordinates
Profile photographs
Identity verification information
Professional certificates
Job history
Payment references
Worker earnings
Reviews
Dispute evidence
Device/session information
Audit records
```

Security protects this information from unauthorized access.

Privacy additionally answers:

> **Why are we collecting this information, what are we doing with it, who actually needs it, and when should it stop being retained?**

---

# 2. Privacy Principles

The system should follow these principles:

```text
Purpose limitation
Data minimization
Need-to-know access
Privacy by default
Privacy by design
Accuracy
Retention limitation
Transparency
User control where applicable
Secure processing
Auditable access
```

The platform should collect data because there is a defined business, security, legal, or operational reason—not simply because it might become useful someday.

---

# 3. Privacy Scope

Privacy architecture applies to:

```text
Customer data
Worker data
Admin/operator data
Authentication data
Location data
Payment-related data
Verification data
Uploaded files
Communication data
Analytics data
Logs
Audit records
Backups
Third-party provider data
```

---

# 4. Data Classification

A useful initial classification is:

```text
PUBLIC
INTERNAL
PERSONAL
SENSITIVE
HIGHLY SENSITIVE
```

The exact legal classification can evolve after formal legal/privacy review.

---

# 5. PUBLIC Data

Examples:

```text
Profession
Skill categories
Public worker display name
Public profile photograph
Verified skill indicators
Aggregated rating
Completed-job count
Public service area
```

Only information intentionally designed for marketplace visibility belongs here.

---

# 6. INTERNAL Data

Examples:

```text
Operational metrics
Internal configuration
Non-public worker operational information
Internal matching metadata
System identifiers
Non-sensitive operational logs
```

Internal does not mean everyone inside the company can access it.

---

# 7. PERSONAL Data

Examples:

```text
Phone number
Email
Customer name
Worker legal/display identity
Saved address
User ID
Device identifiers
IP address
```

Personal data requires controlled access and appropriate retention.

---

# 8. Sensitive Data

Potential examples:

```text
Precise location
Identity verification records
Professional verification evidence
Dispute evidence
Financial information
Private communication information
```

Access should be more restrictive than ordinary profile data.

---

# 9. Highly Sensitive Data

Where applicable:

```text
Government identity documents
Sensitive verification evidence
Payment credentials if ever handled
Security credentials
Authentication secrets
```

The preferred architecture is to avoid storing highly sensitive information unless it is genuinely required.

---

# 10. Data Inventory

Before production, create a formal data inventory.

Example:

| Data | Source | Purpose | Stored Where | Access |
| --- | --- | --- | --- | --- |
| Email + password hash | User | Login (ADR 0016) | PostgreSQL `users` | Auth system |
| Phone | User | Contact; OTP login later | PostgreSQL `users` | Auth system, assigned job party |
| Name | User | Profile | PostgreSQL | Authorized users |
| Service address + location | Customer | Job execution/matching | PostgreSQL/PostGIS `addresses` | Customer; assigned worker during job |
| Site contact name/phone | Customer (third party's data) | Worker reaches the site | `addresses` | Customer; assigned worker during job |
| Check-in/out GPS | Worker device | Proof of attendance, disputes | `job_visits` | Customer, worker, dispute staff |
| Aadhaar (masked, ref id, YOB) | DigiLocker / e-KYC | Identity, 18+ check | `worker_verifications` | Verification staff |
| PAN (masked + encrypted) | Worker | TDS on payouts | `worker_verifications` | Finance staff |
| Verification document | Worker | Verification | Object storage (private) | Verification staff |
| Payout account (VPA or last 4 + IFSC) | Worker | Payouts | `worker_payout_accounts` | Worker, finance staff |
| Payment reference | Provider/Application | Financial tracking | PostgreSQL | Authorized financial roles |
| Session IP / user agent | Device | Security, session list | `refresh_sessions` | User, security staff |
| Push token | Device | Notifications | `user_devices` | Notification system |

This inventory is maintained alongside the ERD; a new personal-data column is not merged without a row here and a retention entry in §102.

---

# 11. Purpose Limitation

Every important personal-data field should have a purpose.

For example:

```text
email
→ login, account notices

phone number
→ contact during a job (OTP login later)

service location
→ matching/job execution

identity document
→ worker verification

bank/payout information
→ worker settlement
```

Do not automatically reuse data for unrelated purposes.

---

# 12. Data Minimization

Collect the minimum necessary information.

For example, if matching only requires:

```text
location
profession
skills
availability
```

then the matching engine does not need:

```text
identity document
payment history
private address book
dispute evidence
```

---

# 13. Separate Public Profile from Private Identity

A worker profile should distinguish between:

```text
Public Worker Profile
```

and:

```text
Private Worker Identity
```

For example:

### Public

```text
display name
profession
skills
experience
verification indicators
service area
ratings
completed jobs
```

### Private

```text
legal identity information
verification documents
phone
payout details
internal review notes
```

This separation is important for both privacy and authorization.

---

# 14. Customer Data Separation

Similarly:

### Marketplace-visible

```text
service request requirements
approximate location
job category
job description
```

### Private

```text
full address
phone
payment information
personal notes
identity information
```

The worker should receive only the information necessary to perform the assigned job.

---

# 15. Location Privacy

Location deserves special treatment.

The system may process:

```text
customer service location
worker location
worker service area
distance
travel route
location timestamps
```

But these should not automatically become public information.

---

# 16. Exact Coordinates

Exact coordinates should be exposed only when required.

For example:

```text
matching engine
→ exact coordinates may be required
```

while:

```text
public worker profile
→ exact home coordinates are unnecessary
```

The API should return the least precise information sufficient for the use case.

---

# 17. Location Lifecycle

Different location types should have different retention policies.

```text
Saved address location (addresses.location)
→ kept while the address is saved; removed 30 days after soft delete

Job address snapshot (service_requests)
→ exact point and house no. coarsened 180 days after job closure

Worker current location (worker_locations)
→ single row, overwritten; no history table

Visit check-in / check-out GPS (job_visits)
→ cleared 180 days after job closure unless disputed or on legal hold
```

Do not build permanent movement history merely because GPS data is available. Exact periods: §102.

---

# 18. Worker Service Area

The worker service area can be represented as:

```text
center point
+
radius
```

or an equivalent geographic model.

The system should not automatically interpret the center as the worker's home address.

This is a privacy-preserving design choice.

---

# 19. Address Data

Addresses should be stored separately from public profile data.

For example:

```text
Customer
 ├── Profile            (no address columns on users/customers)
 └── Addresses          (address book of service locations, ERD §22)
       ├── SELF         own home / shop
       └── FAMILY | RELATIVE | TENANT | BUSINESS | OTHER
                        someone else's place → contact_name + contact_phone required
```

Only the address of the booked job is shown, and only to the assigned worker from booking confirmation until the job closes. Site contacts are third parties; rules in §100.

---

# 20. Historical Address Snapshots

When a job occurs, the system may need to preserve the location/address relevant to that job.

This should be treated as a historical snapshot.

Why?

Because:

```text
Customer changes address later
        ↓
old job
        ↓
historical record must still describe where that job occurred
```

The snapshot keeps full detail only while it is needed (job, disputes): 180 days after job closure the house number, site contact and exact point are removed and only locality, city, pincode and service zone remain (§102).

---

# 21. Verification Data

Verification information is particularly sensitive.

Potential data:

```text
identity document
profession certificate
verification result
reviewer notes
verification timestamps
provider reference
```

The system should separate:

```text
verification status
```

from:

```text
verification evidence
```

A customer may see:

```text
Profession verified
```

without seeing:

```text
actual certificate/document
```

---

# 22. Verification Evidence Access

Access should generally be limited to:

```text
authorized trust/verification staff
authorized compliance personnel
approved verification provider workflows
```

Ordinary customers should not have access.

Workers should only access their own information where appropriate.

---

# 23. Payment Data

The platform should minimize payment data stored internally.

Prefer storing:

```text
provider
provider transaction ID
payment status
amount
currency
timestamps
refund information
financial references
```

rather than raw payment credentials.

This reduces both security and privacy exposure.

---

# 24. Worker Payout Data

Worker payout information is sensitive.

It should be accessible only to:

```text
worker
authorized financial/operations personnel
required payment provider integration
```

It should not appear in:

```text
public profile
customer API
ordinary worker search response
reviews
notifications
```

---

# 25. Reviews and Public Information

Reviews can become public marketplace information.

However, avoid unnecessarily exposing:

```text
reviewer phone number
private address
payment information
internal dispute information
```

A review should be associated with the legitimate job relationship without exposing unrelated personal information.

---

# 26. Dispute Data

Disputes may contain:

```text
customer statements
worker statements
photos
receipts
payment information
internal investigation notes
```

Differentiate:

```text
customer-visible
worker-visible
admin-only
```

information.

---

# 27. Internal Notes

Internal administrative notes should never accidentally become API response fields.

For example:

```text
internalRiskNote
adminInvestigationComment
verificationReviewerNote
```

must not be included in normal worker/customer DTOs.

---

# 28. Communication Data

If messaging/chat is introduced later, the system must define:

```text
who can communicate
what is stored
who can access it
how long it is retained
whether moderation is possible
whether messages are searchable
```

The initial platform does not need a full persistent chat system merely because notifications exist.

---

# 29. Notification Privacy

Notifications may expose personal information through:

```text
lock-screen previews
SMS
email
push notifications
```

Therefore notification templates should use data minimization.

Sensitive details should generally be available inside the authenticated application rather than fully embedded in external notification channels.

---

# 30. Analytics Data

Analytics should avoid collecting unnecessary PII.

Prefer:

```text
userId
workerId
requestId
event name
timestamp
category
coarse location
```

where sufficient.

Avoid putting:

```text
phone number
full address
identity document
```

into analytics events.

---

# 31. Event Payload Privacy

Domain/outbox events should contain the minimum data consumers need.

Bad:

```text
UserRegisteredEvent
{
  full user object,
  private address,
  payment details,
  verification information
}
```

Prefer:

```text
UserRegisteredEvent
{
  eventId,
  userId,
  occurredAt
}
```

Consumers can retrieve additional authorized information if genuinely required.

---

# 32. Logs and PII

Logs are not a free data warehouse.

Avoid logging:

```text
OTP
access token
refresh token
payment credentials
identity documents
full addresses
signed private URLs
```

Prefer:

```text
userId
requestId
traceId
entityId
errorCode
```

where possible.

---

# 33. Audit Data

Audit records are different from ordinary logs.

Audit records should capture important actions such as:

```text
worker verification approved
worker suspended
refund issued
dispute resolved
private evidence accessed
account security action
```

Audit records may require longer retention than ordinary operational logs.

---

# 34. Data Retention

Every important data category should eventually have:

```text
purpose
retention period
deletion/anonymization rule
legal hold rule
access policy
backup treatment
```

Do not create a single:

```text
"delete everything after X days"
```

rule.

Different data has different purposes.

---

# 35. Retention Categories

A useful conceptual model:

```text
SHORT-LIVED
Temporary OTPs
Temporary upload state
Presence data
Ephemeral locks

OPERATIONAL
Notifications
Device tokens
Operational logs

TRANSACTIONAL
Bookings
Jobs
Payments
Refunds

TRUST
Reviews
Verification history
Disputes

AUDIT
Security/admin/financial actions

ANALYTICS
Aggregated/derived metrics
```

Each category needs its own policy.

---

# 36. Retention Policy Structure

Each entry in the retention schedule (§102) defines:

```text
Data Category
Purpose
Default Retention
Deletion Trigger
Legal Hold?
Anonymization Possible?
Owner
```

The concrete periods are in §102. Periods marked "proposed — confirm with legal" are the engineering default until counsel signs off; they are configuration, not code.

---

# 37. Legal Hold

Some records may need preservation despite normal deletion rules.

Examples:

```text
active dispute
legal investigation
fraud investigation
financial reconciliation
regulatory requirement
```

A legal hold (`legal_holds`, §105) stops automated deletion and anonymisation of the held records until it is released. Retention jobs check for an active hold before acting.

---

# 38. Deletion

Deletion should not mean:

```text
DELETE FROM every_table WHERE user_id = ...
```

because relationships and legal/financial requirements may require preserving records.

Instead determine:

```text
what can be deleted
what can be anonymized
what must be retained
what must be disconnected from public identity
```

---

# 39. Anonymization

For certain historical records, personal identity may be removed while preserving aggregate/business information.

Example:

```text
completed job
customer identity → anonymized
job category → retained
price → retained where required
date → retained where required
```

The exact implementation depends on accounting, legal, and analytics requirements.

---

# 40. Account Deletion Lifecycle

A conceptual workflow:

```text
User requests deletion
        ↓
Verify identity
        ↓
Check restrictions/legal holds
        ↓
Determine deletable data
        ↓
Delete/anonymize eligible data
        ↓
Retain legally/business-required records
        ↓
Revoke sessions
        ↓
Confirm completion
```

Deletion should be an explicit workflow, not an uncontrolled SQL cascade.

Concretely: `POST /api/v1/me/erasure-request` creates a `data_principal_requests` row (§97); blockers are an active booking, unpaid cash-job fees, an open dispute or a legal hold. When clear, the account is anonymised (§102, last row), sessions and push tokens are revoked, and records other laws require (invoices, ledger, payouts, TDS) are kept with the person's identity removed wherever the law allows.

---

# 41. Deleting Active Users

If a customer has:

```text
active booking
```

the system may need to resolve the booking before fully deleting/deactivating the account.

Similarly, a worker with:

```text
active job
```

may need an operational transition first.

Privacy workflows must therefore understand business state.

---

# 42. Access Summary (DPDP s.11)

DPDP does not grant GDPR-style data portability. It grants a right to a **summary** of the personal data being processed, the processing activities, and the **identities of all other Data Fiduciaries and Data Processors** it was shared with, with a description of what was shared. Endpoint and SLA: §97.

The summary covers:

```text
profile
addresses
service requests
bookings
jobs
reviews
notifications
financial records visible to the user
consents (from user_consents)
processors / fiduciaries the data was shared with (from data_processors, §104)
```

Internal fraud scores, reviewer notes and other users' data are not included. A machine-readable export (JSON) may be offered as a convenience but is not promised as a legal right.

---

# 43. Data Correction

DPDP s.12 gives a right to correction, completion and updating. Users correct ordinary profile fields themselves:

Examples:

```text
name
email
profile information
saved address
```

But some historical/verified information may require controlled workflows.

For example:

```text
verified identity
```

should not simply be overwritten by an arbitrary profile update. Changes to verified data go through a `CORRECTION` request (§97) and re-verification.

---

# 44. Data Accuracy

Incorrect data can cause marketplace harm.

Examples:

```text
wrong worker skill
wrong verification status
incorrect address
incorrect payment status
```

Important data should have controlled update workflows and historical records where appropriate.

---

# 45. Consent

The DPDP Act has only two grounds for processing: **consent** (s.6, after a notice under s.5) and **legitimate uses** (s.7). There is no "contract" or "legitimate interest" ground, so core service processing also rests on consent given at sign-up.

| Processing | Ground | Notes |
|---|---|---|
| Account, login, matching, booking, job execution, payments, reviews, disputes | Consent (`PRIVACY_NOTICE` + `TERMS_OF_SERVICE`) | Only data necessary for these purposes (s.6(1)). Withdrawing it means closing the account (s.6(6)). |
| Worker identity and background checks | Consent (`WORKER_KYC`, proposed) | Aadhaar e-KYC also needs the worker's explicit consent under the Aadhaar Act; DigiLocker captures it in its own flow. |
| Location sharing during a job (check-in GPS) | Consent (`LOCATION_DURING_JOB`) | Without it the worker uses the start code only. |
| Marketing by email / WhatsApp / push | Consent per channel (`MARKETING_*`) | Separate, optional, unticked by default. |
| Data the person volunteers for a stated purpose (e.g. phone given for a callback) | s.7(a) | Only until the person objects. |
| TDS / GST / income-tax filings, disclosure to police or a court on lawful order | s.7(d), s.7(e) | PAN, invoices, payouts. |
| Worker injured on site, fire or similar emergency | s.7(f), s.7(h) | Share emergency contact / location with responders. |
| Fraud prevention, security logs | Stated purpose in the consented notice + Rule 6 / Rule 8(3) security and log duties; s.17(1)(c) exemption for prevention / detection of offences | **Verify with legal** how far this covers fraud scoring. |
| Keeping records after the purpose ends | Not a ground; an exception to erasure where another law requires retention (s.8(7), Rule 8) | Financial records, §102. |

---

# 46. Marketing Consent

Marketing communications should be separated from operational notifications.

For example:

```text
Booking confirmation
≠
Marketing promotion
```

Turning marketing off never turns off booking, payment or security notices; those are part of the core service purpose.

---

# 47. Privacy Preferences

The system can eventually support:

```text
marketing communication
email preferences
push preferences
SMS preferences
optional analytics preferences
```

But mandatory service/security notifications should be controlled separately.

---

# 48. Third-Party Data Sharing

External providers may receive data for legitimate processing.

Examples:

```text
Payment provider
SMS provider
Push notification provider
Maps/geolocation provider
Identity verification provider
Object storage provider
```

Each integration is listed in the processor register (§104) with a signed data processing agreement, and documents:

```text
data shared
purpose
provider
retention
security mechanism
failure behavior
```

---

# 49. Provider Data Minimization

Example:

A maps provider may need:

```text
coordinates
```

but does not necessarily need:

```text
customer name
phone number
payment information
```

Send only what the provider needs.

---

# 50. Payment Provider Boundary

The application should ideally send:

```text
amount
currency
transaction reference
required customer/payment metadata
```

rather than unnecessary personal information.

Provider-specific requirements should be isolated behind the payment integration boundary.

---

# 51. Identity Verification Provider

If an external verification provider is used, the system should avoid unnecessarily copying the provider's entire identity dataset into PostgreSQL.

Prefer:

```text
verification status
provider reference
required result metadata
audit information
```

while keeping raw evidence in the appropriate protected system.

---

# 52. Data Residency

Decided: PostgreSQL, Redis, object storage, backups and logs run in an India cloud region. Details and the vendor list: §103–104.

---

# 53. Cross-Border Processing

DPDP s.16 allows transfer outside India except to countries the Central Government restricts by notification (**verify with legal** whether any list has been notified at launch). Sector rules can be stricter: RBI requires payment system data to be stored only in India. Transfers we expect (§104):

```text
payment
identity verification
SMS
email
analytics
cloud infrastructure
```

---

# 54. Privacy by Architecture

Privacy should be enforced structurally.

Example:

```text
PublicWorkerProfileDTO
PrivateWorkerDTO
VerificationAdminDTO
CustomerJobDTO
WorkerJobDTO
```

rather than:

```text
WorkerDTO
```

containing every possible field.

This reduces accidental disclosure.

---

# 55. Database Schema and Privacy

Sensitive data should be logically separated where useful.

For example:

```text
workers
worker_verifications
verification_documents
worker_payout_accounts
```

instead of placing every field in:

```text
workers
```

This helps control access at the application/repository level.

---

# 56. Object Storage Organization

Use purpose-specific storage namespaces.

Example:

```text
verification/{workerId}/...
service-request/{requestId}/...
dispute/{disputeId}/...
profile/{userId}/...
```

Different purposes can have different:

```text
access rules
retention
processing
scanning
```

---

# 57. Backup Privacy

Backups contain personal data too.

Therefore:

```text
backups
=
protected copies of production data
```

They require:

```text
encryption
access controls
retention policy
secure deletion/expiration
audit
```

Deleting production data does not necessarily mean it immediately disappears from every backup.

The retention architecture must document this.

---

# 58. Disaster Recovery and Privacy

Disaster recovery systems must not bypass privacy controls.

A restored database should still have:

```text
authorization
encryption
access controls
audit
```

and should not become an unrestricted copy of production.

---

# 59. Admin Privacy

Admins should see only the information required for their role.

Example:

```text
Support Admin
→ booking details

Trust Reviewer
→ verification details

Finance Operator
→ payment/settlement details
```

This supports least privilege.

---

# 60. Sensitive Data Access Auditing

For highly sensitive information, it can be useful to record:

```text
who accessed
what they accessed
why
when
from which operation/request
```

Examples:

```text
identity document viewed
dispute evidence downloaded
financial record accessed
```

This is separate from simply recording that the underlying object exists.

---

# 61. Privacy and Realtime

Realtime events must follow the same authorization and minimization principles as REST APIs.

Do not send:

```text
full customer address
payment details
private verification status
```

to every connected client merely because an event occurred.

---

# 62. Privacy and Caching

Redis can accidentally become a privacy leak if keys or values are poorly designed.

Avoid caching sensitive information unnecessarily.

If personal data is cached:

```text
explicit purpose
short TTL where possible
access controls
safe serialization
no sensitive logs
```

must be considered.

---

# 63. Privacy and Analytics

Analytics should preferably use pseudonymous identifiers.

Example:

```text
event:
JOB_COMPLETED
workerId: 01...
category: ELECTRICIAN
cityZone: HOWRAH_ZONE_3
```

rather than:

```text
customerPhone
fullAddress
identityData
```

---

# 64. Privacy and Search

If the platform eventually introduces advanced search infrastructure, personal data should not automatically be indexed.

Search indexes should contain only the fields necessary for the search experience.

---

# 65. Privacy and Event Replay

Historical events may contain personal information.

Therefore event retention and replay systems must have:

```text
access controls
retention policies
payload minimization
audit
```

Do not assume that an internal event stream is automatically safe because it is not customer-facing.

---

# 66. Privacy and Logs

Logs may be copied into:

```text
log storage
monitoring systems
incident tools
developer environments
```

Therefore the safest policy is:

> **Do not put sensitive personal data into logs unless there is a compelling operational reason.**

---

# 67. Development Environment

Production personal data should not casually be copied into:

```text
local development
test database
developer laptop
staging environment
```

Use:

```text
synthetic data
anonymized datasets
purpose-built fixtures
```

for development and testing.

---

# 68. Production Data Access

Developers should not automatically have unrestricted production database access.

Use controlled access mechanisms.

Possible controls:

```text
temporary access
approval
read-only access
auditing
break-glass procedures
```

---

# 69. Break-Glass Access

Emergency access may be required during severe incidents.

A break-glass process should:

```text
require explicit authorization
be time-limited
be audited
be reviewed afterward
```

Emergency access should not become the normal operating model.

---

# 70. Privacy Incident Response

A privacy incident may involve:

```text
accidental address disclosure
private document exposure
database leak
misconfigured object bucket
notification data leakage
unauthorized admin access
```

The response process (deadlines in §101) includes:

```text
detect
contain
identify affected data
identify affected users
investigate
remediate
document
perform required notifications
```

Every incident is recorded in `data_breach_incidents` (§105), including ones later judged not to involve personal data or not reportable to CERT-In, with the reason.

---

# 71. Data Breach Preparedness

The system should make it possible to answer:

```text
What data was exposed?
Whose data?
When?
Through which component?
Who accessed it?
Was it downloaded?
Was it encrypted?
What systems were affected?
What remediation occurred?
```

This is one reason auditability and data classification matter.

---

# 72. Privacy Testing

Privacy tests should verify:

```text
unauthorized users cannot access private data
public profiles contain only intended fields
admin DTOs do not leak internal fields
logs do not contain sensitive values
notifications do not leak unnecessary data
signed URLs require authorization
development fixtures contain no real PII
```

---

# 73. API Privacy Tests

Example:

```text
Customer A
    ↓
requests Customer B address
    ↓
403/404 according to API security design
```

Worker:

```text
Worker A
    ↓
requests Worker B verification document
    ↓
DENIED
```

Customer:

```text
Customer
    ↓
requests identity document of assigned worker
    ↓
DENIED
```

Authorized trust admin:

```text
Trust Reviewer
    ↓
requests verification evidence
    ↓
ALLOWED
+
AUDITED
```

---

# 74. Privacy Documentation

The project should maintain a:

```text
Data Inventory
Data Classification Matrix
Retention Schedule
Access Control Matrix
Third-Party Data Flow Register
Privacy Incident Procedure
Deletion/Anonymization Rules
```

These become living documents.

---

# 75. Recommended Data Flow Documentation

For every sensitive data category:

```text
Source
  ↓
Collection
  ↓
Processing
  ↓
Storage
  ↓
Access
  ↓
Sharing
  ↓
Retention
  ↓
Deletion/Anonymization
```

Example:

```text
Worker
 ↓
Identity document upload
 ↓
Object storage
 ↓
Verification workflow
 ↓
Authorized reviewer
 ↓
Verification decision
 ↓
Retention period
 ↓
Deletion according to policy
```

---

# 76. Privacy Ownership

Each major data domain should have an owner.

Example:

| Data Domain      | Technical Owner     |
| ---------------- | ------------------- |
| Authentication   | Identity module     |
| Customer profile | Customer module     |
| Worker identity  | Worker module       |
| Verification     | Trust module        |
| Payments         | Payment module      |
| Jobs             | Job module          |
| Reviews          | Review module       |
| Disputes         | Dispute module      |
| Notifications    | Notification module |
| Audit            | Platform/Admin      |

Ownership means the module understands:

```text
what data exists
why it exists
who needs it
how it changes
how it is retained
```

---

# 77. Privacy in API Design

The API should intentionally expose different views.

For example:

```text
GET /workers/{id}
```

returns public profile information.

An internal/admin endpoint can expose additional information only to authorized staff.

Do not use one universal endpoint containing every worker field.

---

# 78. Privacy in Database Queries

Repositories should query only the fields necessary where practical.

For example:

```text
matching query
```

does not need to retrieve:

```text
verification documents
private payout details
```

This reduces unnecessary data movement.

---

# 79. Privacy in Object Access

The application should authorize access before generating a signed URL.

Flow:

```text
User
 ↓
Request file
 ↓
Authenticate
 ↓
Authorize business relationship
 ↓
Check file purpose
 ↓
Generate short-lived URL
 ↓
Return
```

Not:

```text
User
 ↓
Guess object URL
 ↓
Access file
```

---

# 80. Privacy and Worker Professional Passport

The Worker Professional Passport is intended to expose evidence-based professional information.

It should expose:

```text
profession
skills
verification indicators
experience
completed jobs
ratings/reviews
reliability indicators
service area
```

It should not expose:

```text
identity documents
private addresses
payout information
internal trust notes
private disputes
```

---

# 81. Privacy and Reputation

Reputation calculations should use necessary data internally.

The platform should not expose the underlying private inputs unless there is a clear product reason.

For example:

```text
"No-show rate: 2%"
```

may be appropriate.

But:

```text
"Worker missed job at [private address] on [exact date]"
```

may expose unnecessary personal information.

---

# 82. Privacy and Fraud Detection

Fraud prevention may legitimately require analyzing multiple signals.

However:

```text
fraud detection
≠
permission to retain everything forever
```

Fraud systems should have:

```text
defined purpose
limited access
appropriate retention
auditability
```

---

# 83. Privacy and AI

If AI features are introduced later, do not automatically send all platform data to an AI provider.

Before introducing an AI feature, determine:

```text
what data is sent
why
whether personal data is necessary
whether data is retained externally
whether provider uses it for training
how sensitive data is removed
```

AI-specific privacy architecture should be documented before production use.

---

# 84. Privacy and Third-Party Analytics

If third-party analytics are introduced:

```text
minimize payload
avoid unnecessary PII
use pseudonymous IDs
document provider
control retention
```

Do not add analytics SDKs merely because they are popular.

---

# 85. Privacy and Cookies

If the web application uses cookies, document:

```text
authentication cookies
security cookies
analytics cookies
preference cookies
```

and their purposes.

Cookie behavior must align with the final privacy/legal requirements.

---

# 86. Privacy Configuration

Environment configuration should not accidentally disable privacy controls.

For example:

```text
production
→ strict object privacy

development
→ synthetic data
```

A development convenience setting must not accidentally ship to production.

---

# 87. Privacy Defaults

Secure/privacy-preserving defaults should be used.

Examples:

```text
files private
profiles minimally public
location minimally precise
notifications minimally revealing
logs minimally identifying
new users not automatically discoverable beyond intended product behavior
```

---

# 88. What We Should Avoid

Do not:

* collect data without a defined purpose;
* expose exact addresses unnecessarily;
* expose worker identity documents to customers;
* store raw payment credentials;
* copy production PII into developer machines;
* put phone numbers in logs unnecessarily;
* send sensitive data through push/SMS;
* make object-storage buckets public;
* retain GPS history indefinitely without a defined need;
* keep all data forever "just in case";
* use one retention period for every data category;
* let every admin access every data type;
* include complete entities in event payloads;
* assume internal systems do not need privacy controls;
* treat deletion as a simple database cascade.

---

# 89. MVP Privacy Scope

Before production, implement:

```text
data classification
data inventory
purpose documentation
PII minimization
public/private profile separation
location minimization
private object storage
verification evidence access controls
payment data minimization
PII-safe logging
admin access controls
audit for sensitive access/actions
basic retention policies
account deactivation workflow
deletion/anonymization workflow (§40, §102)
development synthetic data
backup protection
third-party data-flow documentation
DPDP notice in English, Bengali, Hindi (§96)
consent capture and one-tap withdrawal (§96)
rights endpoints and grievance handling (§97–98)
18+ age gate (§99)
breach runbook with CERT-In / Board deadlines (§101)
retention jobs for the schedule in §102
India-region hosting and signed DPAs (§103–104)
```

---

# 90. Future Privacy Capabilities

Depending on product scale and legal requirements:

```text
Consent Manager integration (DPDP Rule 4, from 13 Nov 2026)
machine-readable data export
privacy preference center
data-access audit UI
automated retention enforcement
legal-hold workflows
data-processing inventory automation
privacy impact assessments
advanced anonymization
regional data controls
```

---

# 91. Compliance Work

Laws this design is built against (sources in §106):

```text
DPDP Act 2023 + DPDP Rules 2025         personal data
IT Act 2000 s.70B + CERT-In Directions  incident reporting, logs, clock sync
  (28 Apr 2022)
Aadhaar Act 2016 s.29 + UIDAI rules     Aadhaar storage and display
RBI payment data storage (6 Apr 2018)   payment data in India
  + card-on-file tokenisation
CGST Act s.36, Income-tax Act,          financial record retention
  Companies Act s.128
Consumer Protection (E-Commerce)        marketplace grievance officer, disclosures
  Rules 2020                              (verify with legal)
```

Legal review before launch must sign off every item marked "verify with legal" or "proposed — confirm with legal".

---

# 92. Privacy Architecture

The resulting architecture is:

```text
                    USER DATA
                        │
                        ↓
              ┌─────────────────┐
              │ Collection Layer │
              │ purpose-limited  │
              └────────┬────────┘
                       │
                       ↓
              ┌─────────────────┐
              │ Application      │
              │ authorization    │
              │ minimization     │
              └───────┬─────────┘
                      │
          ┌───────────┼────────────┐
          ↓           ↓            ↓
     PostgreSQL     Redis      Object Storage
          │           │            │
          │           │            │
          └───────────┼────────────┘
                      ↓
              Access Controls
                      ↓
                  Audit
                      ↓
              Retention Policy
                      ↓
            Delete / Anonymize
```

---

# 93. Privacy Decision Framework

Whenever a new feature requires personal data, ask:

```text
1. Do we actually need the data?
2. Why do we need it?
3. Who needs access?
4. Can we collect less?
5. Can we use approximate data?
6. How long do we need it?
7. Can it be deleted/anonymized later?
8. Does a third party receive it?
9. Is it logged or replicated?
10. What happens if it leaks?
```

If the answer to the first question is no:

> **Do not collect it.**

---

# 94. Core Privacy Invariants

The platform must enforce:

1. Every significant personal-data category has a defined purpose.
2. Personal data is collected only when necessary.
3. Public profile data is separated from private identity data.
4. Exact locations are not exposed unnecessarily.
5. Customer addresses are accessible only to authorized parties.
6. Worker verification evidence is private.
7. Payment credentials are not stored unnecessarily.
8. Sensitive financial information is access-controlled.
9. Logs minimize PII.
10. Events minimize personal information.
11. Notifications minimize sensitive information.
12. Development environments use synthetic/anonymized data.
13. Object storage is private by default.
14. Signed URLs are issued only after authorization.
15. Retention is defined by data category and purpose.
16. Legal holds can prevent deletion where required.
17. Deletion is an explicit workflow, not uncontrolled cascading.
18. Historical records are preserved only where justified.
19. Anonymization is considered where deletion would destroy necessary non-personal history.
20. Admin access follows least privilege.
21. Sensitive data access can be audited.
22. Third-party data sharing is documented.
23. Data residency and cross-border processing are explicit decisions.
24. Backups receive equivalent privacy protection.
25. Privacy controls apply to REST, WebSocket, async events, storage, logs, analytics, and administrative tools.
26. New features must undergo privacy consideration before collecting new categories of personal data.

---

# 95. Final Principle

The platform should follow:

> **Collect the minimum necessary data, use it only for defined purposes, expose it only to the people who need it, retain it only as long as justified, and make the entire lifecycle auditable.**

The security architecture protects the data from attackers.

The privacy architecture ensures that:

```text
we do not unnecessarily collect it
        ↓
we do not unnecessarily expose it
        ↓
we do not unnecessarily retain it
```

This distinction will become increasingly important as the marketplace grows and the Worker Professional Passport becomes a long-term professional identity layer.

---

# 96. Notice and Consent (DPDP s.5–6, Rule 3)

**Notice.** Shown before or with the consent request, readable on its own (not buried in the terms), and contains:

* an itemised list of the personal data collected and the specific purpose of each;
* an itemised description of the services that processing enables (finding a worker, booking, payments, payouts, verification);
* how to withdraw consent, how to exercise rights (§97), how to complain to us (§98) and to the Data Protection Board;
* a link to the app / web page where all of this can be done.

**Language.** DPDP s.5(3) lets the person read the notice in English or any Eighth Schedule language. We ship **English, Bengali and Hindi** at launch, chosen from `users.preferred_locale`; the shown `locale` and `notice_version` are stored on every `user_consents` row. A changed notice gets a new version and is re-shown; affected consents are captured again.

**Purposes and `user_consents.purpose_code`:**

| purpose_code | Who | Required? | Covers |
|---|---|---|---|
| `TERMS_OF_SERVICE` | All | Yes | Platform terms |
| `PRIVACY_NOTICE` | All | Yes | Core purposes: account, matching, booking, job execution, payments, payouts, invoices, reviews, disputes, security and fraud prevention |
| `AGE_18_PLUS_DECLARATION` (proposed) | All | Yes | User declares they are 18+ (§99) |
| `WORKER_KYC` (proposed) | Workers | Yes, to receive jobs | Aadhaar e-KYC via DigiLocker, PAN, selfie match, police / skill / licence documents (ERD §15) |
| `LOCATION_DURING_JOB` | Workers | Optional | Check-in / check-out GPS on `job_visits` |
| `MARKETING_EMAIL` | All | Optional | Promotional email |
| `MARKETING_WHATSAPP` | All | Optional | Promotional WhatsApp |
| `MARKETING_PUSH` | All | Optional | Promotional push |

Rules:

* Optional consents are separate, unticked by default, and never a condition of using the service.
* **Withdrawal is as easy as giving:** one toggle per purpose in Settings → Privacy, available in the same app screen where consent was given. Withdrawal writes a new `granted = false` row and takes effect immediately; already-queued marketing is cancelled.
* Withdrawing `PRIVACY_NOTICE` or `TERMS_OF_SERVICE` starts account erasure (§40); withdrawing `WORKER_KYC` stops new job offers and removes the trade badges.
* Consent is proof the fiduciary must be able to show (s.6(10)); `user_consents` is never edited or deleted while the account exists (retention §102).
* **Consent Managers** (Rule 4, registration from 13 Nov 2026): not integrated at launch. If a user arrives through a registered Consent Manager, we accept and record it with the manager's reference; **verify with legal** whether integration is required for our class.

---

# 97. Data Principal Rights and SLAs (DPDP s.11–14, Rule 14)

All requests are logged in `data_principal_requests` (§105). The user is identified by their logged-in session; requests by email to the grievance officer are matched to the account by registered email + phone (Rule 14(5) identifiers).

| Right | Endpoint | Proposed SLA |
|---|---|---|
| Summary of data, processing and sharing (s.11) | `GET /api/v1/me/data-summary` | Instant in app; written requests 30 days |
| View / change consents | `GET /api/v1/me/consents`, `POST /api/v1/me/consents` `{purposeCode, granted}` | Immediate |
| Correction / completion / updating (s.12) | `PATCH /api/v1/me` (own fields); `POST /api/v1/me/correction-requests` (verified fields) | Self-serve immediate; reviewed 15 days |
| Erasure (s.12) | `POST /api/v1/me/erasure-request`; `GET /api/v1/me/privacy-requests/{id}` | Completed 30 days after blockers clear |
| Nomination (s.14) | `PUT /api/v1/me/nominee`, `DELETE /api/v1/me/nominee` | Immediate |
| Grievance (s.13) | `POST /api/v1/grievances`; `GET /api/v1/me/grievances` | Acknowledge 48 hours, resolve 30 days; legal cap 90 days (Rule 14(3)) |

Admin side: `GET/POST /api/v1/admin/privacy-requests`, `/api/v1/admin/grievances` (permission `privacy.handle`, every action audited).

Rules:

* The data summary lists categories held, purposes, processors and other fiduciaries the data went to (from `data_processors`) and what was shared. It never includes other people's data or internal risk notes.
* Erasure cannot remove what another law requires us to keep (§102); the response says what was kept, why, and until when.
* A nominee can act only on proof of the user's death or incapacity, reviewed by staff (**verify with legal** the proof required).
* All SLAs are published in the app and privacy notice, as Rule 14(3) requires.

---

# 98. Grievance Officer and Contact Person

* DPDP s.8(9) / Rule 9: publish the business contact of a person who can answer questions about our processing — in the app, on the website, and in every reply to a rights request.
* The same named **Grievance Officer** (name, designation, email, phone) also covers the marketplace grievance officer duty under the Consumer Protection (E-Commerce) Rules, 2020 (**verify with legal**).
* A person must first use our grievance process before going to the Data Protection Board (s.13(3)); the reply always says how to approach the Board.
* Site contacts and other non-users can file a grievance without an account (`grievances.user_id` nullable).

---

# 99. Children and Age Gate

* Under DPDP a child is anyone **under 18**. Processing a child's data needs verifiable parental consent (s.9, Rule 10) and bans tracking, behavioural monitoring and targeted advertising.
* We avoid this entirely: **customers and workers must be 18+.**
  * Sign-up shows an 18+ declaration (`AGE_18_PLUS_DECLARATION`); without it the account is not created.
  * Workers are confirmed 18+ from `worker_verifications.year_of_birth` at Aadhaar e-KYC; under 18 is rejected (also required by child-labour law).
* If we learn an account belongs to a minor, it is suspended and erased (§40) except records another law requires.
* A job at a home where children live is normal; we do not collect children's data in job descriptions or photos. Support staff remove such details from free text when reported.

---

# 100. Third-Party Data (Site Contacts and Relatives)

ERD §22 lets a customer save a place that is not theirs, with `contact_name` and `contact_phone` of the person there.

* The customer confirms, when saving the address, that the contact has agreed to be contacted for the job. This is a customer responsibility in the terms; **verify with legal** that this is enough under DPDP for a person who never signed up.
* Minimal use: the contact's name and phone are shown only to the assigned worker, only from booking confirmation to job closure, and used only for job coordination (calls, start code). Never marketing, never matching, never analytics.
* The contact is not sent any message other than job coordination. If a later SMS / WhatsApp message is sent, it names Karigar, the customer who booked, and how to object.
* The contact can ask us to remove their details (grievance, §98); we clear them from saved addresses and future jobs.
* Retention: removed from the job snapshot 180 days after job closure; removed from the saved address when the customer deletes it (§102).

---

# 101. Breach Response Timeline

Clock starts when we become aware of the incident. DPDP has **no materiality threshold**: every personal data breach is reported to the Board and to affected people.

| When | To whom | What | Basis |
|---|---|---|---|
| Within **6 hours** of noticing | CERT-In (incident@cert-in.org.in, prescribed format) | Incident types listed in the Directions (data breach, data leak, unauthorised access, etc.) | CERT-In Directions 28 Apr 2022, para (ii) |
| **Without delay** (internal target: 24 hours) | Data Protection Board | Preliminary intimation: description, nature, extent, timing, location, likely impact | DPDP Rule 7(2)(a) |
| **Without delay** (internal target: 24 hours) | Each affected Data Principal, via app inbox + email in their locale | Nature, extent, timing; likely consequences; mitigation done; what they should do (e.g. change password); contact person | DPDP Rule 7(1) |
| Within **72 hours** of becoming aware (longer only if the Board allows in writing) | Data Protection Board | Detailed report: updated facts, circumstances, cause, person responsible if known, mitigation, remedial measures, report of user notifications | DPDP Rule 7(2)(b) |
| Immediately, if payment data is involved | Payment provider | Facts needed for their RBI reporting | Provider contract (**verify with legal**) |
| Within 14 days | Internal | Post-incident review, actions tracked in `data_breach_incidents` | Internal |

* Incident commander: engineering lead on call; legal and Grievance Officer informed within 1 hour.
* Logs needed for the reports are available because of §102 log retention and clock sync (§103).
* Penalties under the DPDP Schedule: up to ₹250 crore for failing to take reasonable security safeguards and up to ₹200 crore for failing to notify a breach.

---

# 102. Retention Schedule

Retention jobs run nightly, skip anything under legal hold, and record what they deleted (counts only). "Closure" means the job reached a final state and any dispute is closed. "FY" means Indian financial year (April–March).

| Data category | ERD tables | Retention | Then | Basis / status |
|---|---|---|---|---|
| Active account | `users`, `customers`, `workers` | While account is active | — | Purpose |
| Inactive account | same | 3 years after last login and last transaction | Notify 48 hours before, then anonymise | DPDP Rule 8 + Third Schedule (mandatory only for e-commerce entities with 2 crore+ users; we adopt it voluntarily). Proposed — confirm with legal |
| Deleted account | `users` and all linked rows | Erasure completed within 30 days of the request once blockers clear | Anonymise: name → "Deleted user", email / phone removed, photo deleted, `anonymised_at` set; id kept so financial rows stay valid | DPDP s.12. Proposed — confirm with legal |
| Saved addresses | `addresses` | While saved | Hard-delete 30 days after `deleted_at` if no open job references it | Proposed — confirm with legal |
| Job address snapshot, site contact | `service_requests` snapshot | 180 days after closure | Keep locality, city, pincode, zone; drop house no., landmark, contact, exact point | Dispute window. Proposed — confirm with legal |
| Requests, bookings, jobs, visits, quotes, reviews | `service_requests`, `bookings`, `jobs`, `job_visits`, `quotes`, `reviews` | 8 years from end of FY of closure (amounts back invoices and ledger) | Personal identifiers anonymised on account erasure; free text cleared | Same as financial records. Proposed — confirm with legal |
| Visit check-in / check-out GPS | `job_visits.check_in_location`, `check_out_location` | 180 days after closure | Set to NULL (keep timestamps, `start_code_verified_at`) | Proposed — confirm with legal |
| Worker current location | `worker_locations`, Redis | Overwritten; no history | Row deleted when worker deactivates | Purpose |
| Payments, refunds, earnings, payouts, ledger, invoices | `payments`, `refunds`, `worker_earnings`, `payouts`, `ledger_*`, `invoices` | **8 years from end of the FY** of the transaction (longer if under assessment, appeal or investigation) | Delete or archive | Companies Act s.128(5): 8 FYs; CGST s.36: 72 months from annual-return due date; Income-tax record rules. Confirm with CA |
| Payout account details | `worker_payout_accounts` | While active; then with the payouts that used it (8 years) | Delete | As above |
| PAN (encrypted) | `worker_verifications.document_number_encrypted` | 8 years from end of FY of the last payout with TDS | Delete encrypted value; keep masked | TDS records. Confirm with CA |
| Aadhaar (masked, reference id, YOB) and verification status / events | `worker_verifications`, `worker_verification_events` | Worker account life + 3 years | Delete masked value and reference; keep anonymised event counts | Fraud re-registration checks. Proposed — confirm with legal |
| Document hash for duplicate detection | `worker_verifications.document_number_hash` | Same as above | Delete | **Verify with legal** whether an HMAC of the Aadhaar number is permitted under UIDAI rules (§105 note) |
| Verification files (certificates, selfie) | `verification_documents` + private bucket | Rejected: 90 days after decision. Verified: until expiry or replacement + 90 days. Selfie: 30 days after decision (match score kept) | Delete object and row | Proposed — confirm with legal |
| Disputes and evidence | `disputes`, `dispute_evidence` | 3 years after closure | Delete evidence files; keep outcome | Consumer complaint limitation (2 years) + margin. Proposed — confirm with legal |
| Consents | `user_consents` | Account life + 3 years | Delete | Burden of proof s.6(10). Proposed — confirm with legal |
| Rights requests, grievances | `data_principal_requests`, `grievances` | 3 years after closure | Delete | Proposed — confirm with legal |
| Breach records | `data_breach_incidents` | 5 years after closure | Delete | Proposed — confirm with legal |
| Sessions, devices | `refresh_sessions`, `user_devices` | **1 year** after expiry / revocation / last use; push token cleared at once when disabled | Delete | DPDP Rule 8(3) (1 year logs); CERT-In (180 days) |
| Application, access and security logs | log store | **1 year**, in India | Delete | DPDP Rule 8(3); CERT-In 180 days rolling |
| Audit events | `audit_events` | 8 years | Delete | Covers financial actions. Proposed — confirm with legal |
| Notifications | `notifications` | 90 days | Delete | Proposed |
| Email-verify / reset tokens | `user_auth_tokens` | 7 days after use or expiry | Delete | Only hashes stored |
| OTP (later phase) | Redis only | TTL 5 minutes; never written to PostgreSQL or logs | — | security/01 |
| Outbox / processed events | `outbox_events`, `processed_events` | 30 days after publish | Delete | Payloads hold ids, not PII (§31) |
| Analytics events | analytics store | 2 years, pseudonymous ids only | Aggregate | Proposed |
| Backups (PITR) | backup store | 35 days | Expire | Erasures re-applied after any restore from the `data_principal_requests` log |

---

# 103. Data Residency (India Region)

* PostgreSQL, Redis, object storage, backups and logs: one **India cloud region** (e.g. AWS `ap-south-1` Mumbai), DR copy in a second India region (e.g. `ap-south-2` Hyderabad). Cloudflare R2 is not used for personal data unless India-only storage is contractually guaranteed.
* CERT-In: logs of all ICT systems kept for 180 days rolling in India (we keep 1 year, §102); all servers sync time via NTP to NIC / NPL servers or sources traceable to them.
* RBI: payment system data must be stored only in India. The payment provider holds the card / UPI data; we store only provider ids, amounts and status, and those also stay in the India region.
* Data that leaves India (allowed under DPDP s.16 unless the destination is restricted): email via Brevo (EU) and push via Firebase Cloud Messaging (Google, global). Payloads are minimal: no address, no phone, no document data (§29).

---

# 104. Processors and Data Processing Agreements

No processor receives personal data before a signed **data processing agreement** that covers: processing only on our instructions, security safeguards (Rule 6), breach notice to us within 24 hours, sub-processor list, return / deletion at contract end, India storage where required, and help with rights requests. Tracked in `data_processors` (§105), reviewed yearly.

| Processor | Service | Personal data | Location |
|---|---|---|---|
| Cloud provider (e.g. AWS India) | Hosting, DB, storage, backups, logs | All | India |
| Brevo | Transactional email (ADR 0016) | Email, name, message content | EU — cross-border |
| Firebase Cloud Messaging | Push | Push token, short message | Global — cross-border |
| Payment provider (Razorpay / Cashfree, ADR 0007, still open) | Payments, split settlement, payouts, penny drop | Name, phone, email, amounts, VPA / bank details | India (RBI) |
| KYC vendor / DigiLocker | Aadhaar e-KYC, PAN check, selfie match | Aadhaar via DigiLocker consent, PAN, selfie | India — **verify with legal** vendor's UIDAI / DigiLocker authorisation |
| Maps provider (when chosen) | Geocoding, maps | Coordinates only, no name / phone | Check before choosing |
| WhatsApp / SMS provider (later phase) | Messages, OTP | Phone, message | Check before choosing; TRAI DLT |

The DigiLocker issuer side is a government service, not our processor; the KYC vendor that calls it is.

---

# 105. Proposed ERD Additions

**Added to the ERD in [architecture/03 §52.7](../architecture/03-erd-and-production-database-design.md)** (with `users.anonymised_at`, the new consent purposes, and Aadhaar duplicate detection moved to the e-KYC reference). Kept here for reference.

```text
data_principal_requests
------------------------------------------------
id                   UUID PK
user_id              UUID FK → users.id
request_type         VARCHAR(30) NOT NULL   -- ACCESS_SUMMARY | CORRECTION | ERASURE | INACTIVITY_ERASURE | NOMINATION
status               VARCHAR(20) NOT NULL   -- RECEIVED | IN_PROGRESS | BLOCKED | COMPLETED | REJECTED | CANCELLED
channel              VARCHAR(20) NOT NULL   -- APP | EMAIL | NOMINEE | SYSTEM
nominee_id           UUID FK → data_principal_nominees.id NULL
details              JSONB NULL             -- e.g. fields to correct
blocked_reason_code  VARCHAR(40) NULL       -- ACTIVE_BOOKING | UNPAID_FEES | OPEN_DISPUTE | LEGAL_HOLD
notice_sent_at       TIMESTAMPTZ NULL       -- 48-hour notice before inactivity erasure (Rule 8(2))
due_at               TIMESTAMPTZ NOT NULL
completed_at         TIMESTAMPTZ NULL
handled_by_admin_id  UUID FK → admin_users.id NULL
response_summary     TEXT NULL              -- what was done, what was kept and why
created_at           TIMESTAMPTZ NOT NULL
updated_at           TIMESTAMPTZ NOT NULL

UNIQUE INDEX (user_id, request_type) WHERE status IN ('RECEIVED','IN_PROGRESS','BLOCKED')
```

```text
data_principal_nominees
------------------------------------------------
id, user_id FK, name VARCHAR(100), relationship VARCHAR(30), phone VARCHAR(16), email VARCHAR(254) NULL,
created_at, revoked_at NULL
UNIQUE INDEX (user_id) WHERE revoked_at IS NULL
```

```text
grievances
------------------------------------------------
id                   UUID PK
reference_no         VARCHAR(20) NOT NULL UNIQUE
user_id              UUID FK → users.id NULL      -- NULL for non-users (site contacts)
contact_name         VARCHAR(100) NOT NULL
contact_email        VARCHAR(254) NULL
contact_phone        VARCHAR(16) NULL
category             VARCHAR(30) NOT NULL         -- PRIVACY | CONSENT | RIGHTS_REQUEST | BREACH | THIRD_PARTY_DATA | OTHER
related_request_id   UUID FK → data_principal_requests.id NULL
description          TEXT NOT NULL
status               VARCHAR(20) NOT NULL         -- OPEN | IN_PROGRESS | RESOLVED | REJECTED
acknowledged_at      TIMESTAMPTZ NULL
due_at               TIMESTAMPTZ NOT NULL
resolved_at          TIMESTAMPTZ NULL
resolution           TEXT NULL
assigned_admin_id    UUID FK → admin_users.id NULL
created_at           TIMESTAMPTZ NOT NULL
updated_at           TIMESTAMPTZ NOT NULL

CHECK (due_at <= created_at + INTERVAL '90 days')
CHECK (contact_email IS NOT NULL OR contact_phone IS NOT NULL)
```

```text
data_breach_incidents
------------------------------------------------
id                          UUID PK
reference_no                VARCHAR(20) NOT NULL UNIQUE
aware_at                    TIMESTAMPTZ NOT NULL     -- starts the 6h / 72h clocks
occurred_from               TIMESTAMPTZ NULL
occurred_to                 TIMESTAMPTZ NULL
status                      VARCHAR(20) NOT NULL     -- OPEN | CONTAINED | CLOSED
description                 TEXT NOT NULL
data_categories             TEXT[] NOT NULL          -- e.g. {EMAIL, ADDRESS, PAN}
systems_affected            TEXT NULL
affected_count              INTEGER NULL
cert_in_reported_at         TIMESTAMPTZ NULL
cert_in_reference           VARCHAR(50) NULL
board_preliminary_at        TIMESTAMPTZ NULL
board_detailed_report_at    TIMESTAMPTZ NULL
principals_notified_at      TIMESTAMPTZ NULL
not_reportable_reason       TEXT NULL                -- only "no personal data involved" or "not a CERT-In listed type"
root_cause                  TEXT NULL
remediation                 TEXT NULL
owner_admin_id              UUID FK → admin_users.id
created_at, updated_at      TIMESTAMPTZ NOT NULL

data_breach_affected_users (incident_id FK, user_id FK, notified_at NULL, channel VARCHAR(10))  PK (incident_id, user_id)
```

```text
data_processors
------------------------------------------------
id, name VARCHAR(100), service VARCHAR(100), data_categories TEXT[], purpose TEXT,
processing_location VARCHAR(60), cross_border BOOLEAN, dpa_signed_on DATE NULL,
dpa_media_id UUID NULL, review_due_on DATE, status VARCHAR(20) -- ACTIVE | ENDED,
created_at, updated_at
```

```text
legal_holds
------------------------------------------------
id, entity_type VARCHAR(40), entity_id UUID, user_id UUID NULL, reason_code VARCHAR(40),
placed_by_admin_id FK, placed_at, released_at NULL
INDEX (entity_type, entity_id) WHERE released_at IS NULL
```

Changes to existing tables:

* `users`: add `anonymised_at TIMESTAMPTZ NULL`; allow `email` and `phone` to be NULL only when anonymised (`CHECK (anonymised_at IS NOT NULL OR (email IS NOT NULL AND phone IS NOT NULL))`). This also releases the phone and email for reuse after erasure, which today's "unique including deactivated" rule blocks.
* `user_consents.purpose_code`: add `WORKER_KYC` and `AGE_18_PLUS_DECLARATION`.
* `worker_verifications.document_number_hash` for `AADHAAR_EKYC`: **verify with legal**. UIDAI expects Aadhaar numbers held by an entity to sit only in an Aadhaar Data Vault; a keyed hash may be treated as a derived Aadhaar number. Alternative: use the DigiLocker / e-KYC reference (or UIDAI-issued token) for duplicate detection.

---

# 106. References

Checked October 2026.

* DPDP Act 2023, s.5–9, 11–14, 16, 17 — text and commentary: https://dpdpa.com/dpdpa2023/chapter-2/section7.html, https://www.dpdpa.com/dpdpa2023/chapter-3/section11.html
* DPDP Rules 2025 (notified 13 Nov 2025): Rule 3 https://dpdpa.com/dpdparules/rule3.html, Rule 7 https://dpdpa.com/dpdparules/rule7.html, Rule 8 https://dpdpa.com/dpdparules/rule8.html, Rule 9 https://dpdpa.com/dpdparules/rule9.html, Rule 14 https://dpdpa.com/dpdparules/rule14.html
* Phased commencement: AZB & Partners, https://www.azbpartners.com/bank/update-indias-digital-personal-data-protection-framework-comes-into-effect/; Hogan Lovells, https://www.hoganlovells.com/en/publications/indias-digital-personal-data-protection-act-2023-brought-into-force-
* Proposed compression of timeline: S.S. Rana, https://ssrana.in/articles/meity-plans-to-cut-short-dpdp-compliance-timeline-and-notify-cross-border-restrictions-for-sdfs/
* Grievance 90 days, 1-year logs, Third Schedule: KPMG, https://assets.kpmg.com/content/dam/kpmgsites/in/pdf/2025/12/dpdp-act-and-rules-compliance-roadmap.pdf.coredownload.pdf; Cyril Amarchand Mangaldas / Cyril Shroff client alert, https://www.cyrilshroff.com/wp-content/uploads/2025/11/Client-Alert-DPDP-Rules-Nov-2025.pdf
* CERT-In Directions 28 Apr 2022 (6 hours, 180-day logs, NTP): Trilegal, https://trilegal.com/knowledge-repository/2022-cert-in-directions-on-reporting-cyber-incidents/; CERT-In FAQs, Nishith Desai, https://nishithdesai.com/research-and-articles/hotline/technology-law-analysis/cert-in-releases-faqs-explaining-the-direction-on-cybersecurity-6139
* Aadhaar Data Vault and masking: UIDAI ADV FAQ, https://uidai.gov.in/images/resource/FAQs_Aadhaar_Data_Vault_v1_0_13122017.pdf; Khaitan & Co, https://www.khaitanco.com/sites/default/files/2025-12/ERGO%20-%20Aadhaar%20Data%20Vault%20-%2010%20December%202025.pdf
* RBI Storage of Payment System Data (6 Apr 2018) FAQ: https://rbi.org.in/Scripts/FAQView.aspx?Id=130
* Companies Act s.128(5): https://ca2013.com/128-books-of-account/; CGST Act s.36: https://www.knowyourgst.com/gstlaw/cgst-act/36-period-of-retention-of-accounts-36/

---

# End of Document
