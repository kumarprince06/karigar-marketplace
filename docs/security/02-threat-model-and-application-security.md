# Security Threat Model & Application Security Architecture

## 1. Purpose

Security must be designed into the platform rather than added after the application is built.

This marketplace handles several sensitive areas:

* customer accounts;
* worker identities;
* phone numbers;
* addresses and locations;
* verification documents;
* job history;
* payments;
* refunds;
* worker earnings;
* disputes;
* reviews;
* admin operations;
* uploaded files;
* realtime connections.

A security failure could therefore cause:

* account takeover;
* privacy violations;
* financial loss;
* fraudulent bookings;
* fake workers;
* unauthorized admin actions;
* malicious file uploads;
* marketplace abuse;
* reputational damage.

The objective is not to make the system theoretically impossible to attack.

The objective is to build a system where:

> **Important assets are identified, trust boundaries are explicit, attacks are anticipated, and failures are contained.**

---

# 2. Security Principles

The platform should follow:

```text
Least privilege
Defense in depth
Zero trust between components
Explicit authorization
Secure defaults
Data minimization
Fail safely
Audit sensitive actions
Never trust client-controlled state
Protect secrets
Assume external systems can fail
```

---

# 3. Threat Modeling

Threat modeling means asking:

> What can go wrong, who could cause it, what could they gain, and how would we prevent or contain it?

The primary actors are:

```text
1. Normal customer
2. Worker
3. Malicious customer
4. Malicious worker
5. Unauthenticated attacker
6. Compromised user account
7. Malicious admin/insider
8. Automated bot
9. Malicious file uploader
10. Compromised external dependency
11. Attacker targeting infrastructure
```

---

# 4. Assets

Important assets include:

```text
User accounts
Authentication credentials/tokens
Worker verification data
Customer addresses
Location information
Service requests
Bookings
Job history
Payments
Refunds
Worker earnings
Reviews
Disputes
Uploaded files
Admin capabilities
Audit history
Application secrets
Database credentials
Infrastructure credentials
```

---

# 5. Security Priorities

Not all assets have equal impact.

High-impact areas include:

```text
Authentication
Authorization
Payments
Admin actions
Identity verification
Private documents
Location privacy
Worker/customer personal data
```

These require stronger controls than ordinary catalog information.

---

# 6. Trust Boundaries

The system contains multiple trust boundaries.

```text
Customer App
       ↓
Public API
       ↓
Application
       ↓
Database

Application
       ↓
Redis

Application
       ↓
Object Storage

Application
       ↓
Payment Provider

Application
       ↓
SMS/Push/Email Providers
```

Every boundary should be treated as potentially hostile or unreliable.

---

# 7. Never Trust the Client

The client is not authoritative.

Never trust the client for:

```text
price
payment status
worker verification
role
permissions
booking ownership
job ownership
rating eligibility
location authorization
completion status
refund amount
```

For example, the client must not be able to send:

```json
{
  "amount": 500
}
```

and determine the amount charged.

The server determines authoritative business values.

---

# 8. Authentication

Authentication answers:

> Who is this user?

The initial platform can use phone-based OTP authentication.

Conceptually:

```text
Phone
 ↓
OTP request
 ↓
OTP delivery
 ↓
OTP verification
 ↓
Authenticated session/token
```

Authentication and authorization remain separate concepts.

---

# 9. OTP Security

OTP systems are common attack targets.

Protect against:

* OTP brute force;
* OTP flooding;
* SMS abuse;
* account enumeration;
* repeated verification attempts;
* automated requests.

Use:

```text
short OTP lifetime
attempt limits
request rate limits
phone/IP throttling
single-use OTP
secure random generation
```

OTP values must never appear in logs.

---

# 10. OTP Storage

Never store OTPs as plain text if avoidable.

A secure design should store a protected representation and enough metadata to validate:

```text
challengeId
phone reference
protected OTP representation
expiresAt
attemptCount
createdAt
status
```

The exact authentication implementation will be finalized during LLD.

---

# 11. Session / Token Security

After authentication, the user needs an authenticated session.

Possible architecture:

```text
Access Token
+
Refresh Token
```

Access tokens should be short-lived relative to refresh credentials.

Refresh tokens require stronger protection and rotation/revocation strategy.

---

# 12. Token Storage

The storage strategy depends on the client type.

For browser applications, avoid casually storing long-lived credentials in places accessible to JavaScript.

For mobile applications, use platform-secure credential storage where available.

The exact client implementation is outside the backend domain model, but the backend must assume tokens can eventually be stolen.

---

# 13. Token Revocation

The system should be able to invalidate sessions in cases such as:

```text
logout
account suspension
account deactivation
security incident
refresh-token compromise
administrative security action
```

This is especially important for high-risk account state changes.

---

# 14. Authorization

Authorization answers:

> What is this authenticated user allowed to do?

Example:

```text
Customer
   ↓
manage own service requests

Worker
   ↓
manage own worker profile/jobs

Admin
   ↓
perform authorized operational actions
```

Authentication alone is insufficient.

---

# 15. RBAC

The initial authorization model can use Role-Based Access Control.

Roles:

```text
CUSTOMER
WORKER
ADMIN
```

Future roles may include:

```text
SUPPORT
OPERATIONS
FINANCE
TRUST_REVIEWER
SUPER_ADMIN
```

Do not give every admin every permission forever.

---

# 16. Resource-Level Authorization

Role checks are not enough.

Suppose:

```text
Customer A
```

tries:

```text
GET /service-requests/{Customer B's request}
```

Even though Customer A is authenticated:

```text
access = DENIED
```

The server must verify resource ownership or legitimate relationship.

---

# 17. Object-Level Authorization

Every sensitive resource should answer:

> Does this actor have permission to access this specific object?

Examples:

```text
ServiceRequest
Booking
Job
Payment
Dispute
Review
Worker profile
Private attachment
```

This prevents IDOR/BOLA-style vulnerabilities.

---

# 18. Example: Booking Authorization

Request:

```text
GET /api/v1/bookings/123
```

Server checks:

```text
authenticated?
    ↓
role?
    ↓
customer owns booking?
OR
worker belongs to booking?
OR
authorized admin?
```

Only then:

```text
return booking
```

---

# 19. State Transition Authorization

A user may own a resource but still not be allowed to perform every action.

Example:

```text
Customer owns Job
```

does not automatically mean:

```text
Customer can mark job WORK_COMPLETED
```

Business action permissions must be explicit.

---

# 20. Worker Authorization

Workers should only be able to:

```text
modify own worker profile
modify own skills
modify own availability
accept own matches
update assigned jobs
propose additional work for assigned jobs
view permitted earnings
```

A worker must not be able to manipulate another worker's jobs or earnings by changing an ID.

---

# 21. Admin Authorization

Admin endpoints are particularly sensitive.

Avoid:

```text
PATCH /admin/workers/{id}
{
  "status": "..."
}
```

with arbitrary field updates.

Prefer explicit operations:

```text
POST /admin/workers/{id}/suspend
POST /admin/verifications/{id}/approve
POST /admin/verifications/{id}/reject
POST /admin/disputes/{id}/resolve
POST /admin/reviews/{id}/hide
```

This makes authorization and auditing clearer.

---

# 22. Privilege Separation

As the platform grows, separate permissions such as:

```text
verification.review
finance.refund
dispute.resolve
account.suspend
review.moderate
audit.view
```

The full permission catalog and role matrix are in [LLD-020 §3.2, §4.1](../lld/lld-020-admin-operations.md).

An employee who can review verification documents may not need permission to issue refunds.

---

# 23. Admin Actions Must Be Audited

Sensitive operations should produce audit events.

Examples:

```text
Worker suspended
Verification approved
Refund issued
Dispute resolved
Review hidden
Account deactivated
```

Audit should capture:

```text
actor
action
target
timestamp
reason
request/correlation ID
```

---

# 24. Horizontal Privilege Escalation

Example attack:

```text
Worker A
    ↓
changes workerId in request
    ↓
accesses Worker B
```

Defense:

```text
resource ownership
relationship checks
server-side identity
```

Never trust:

```text
workerId
customerId
userId
```

provided by the client when the authenticated identity already determines them.

---

# 25. Vertical Privilege Escalation

Example:

```text
Customer
    ↓
calls admin endpoint
```

Defense:

```text
authenticated role
+
permission check
+
endpoint authorization
```

Do not hide an admin endpoint and assume that provides security.

---

# 26. API Security

Every protected API should enforce:

```text
authentication
authorization
input validation
rate limiting where appropriate
resource ownership
safe error handling
```

---

# 27. Input Validation

Validate:

* type;
* length;
* range;
* enum values;
* required fields;
* formats;
* relationships;
* business constraints.

Example:

```text
rating ∈ [1,5]
```

Do not rely only on database constraints.

Use both:

```text
application validation
+
database invariants
```

---

# 28. SQL Injection

Never construct SQL by concatenating untrusted input.

Prefer:

```text
parameterized queries
JPA parameters
prepared statements
```

Dynamic query builders must also parameterize values.

---

# 29. JPA Security

Avoid exposing JPA entities directly through APIs.

Bad:

```text
Entity
 ↓
JSON
```

Problems include:

* accidental sensitive fields;
* lazy loading;
* relationship traversal;
* unstable API contracts.

Use:

```text
Entity
 ↓
Mapper
 ↓
Response DTO
```

---

# 30. Mass Assignment

Do not allow arbitrary JSON fields to map directly onto entities.

Bad:

```text
PATCH /worker
{
  "status": "ACTIVE",
  "verificationStatus": "APPROVED"
}
```

A customer/worker must not be able to change server-controlled fields.

Use explicit commands/DTOs.

---

# 31. API Enumeration

Sequential or predictable identifiers can make resource discovery easier.

The platform will use UUID-style identifiers for app-visible resources.

However:

> UUIDs are not authorization.

Even if an attacker cannot guess an ID, authorization must still be enforced.

---

# 32. Error Messages

Errors should be useful without revealing sensitive information.

Avoid:

```text
User does not exist with phone +91...
```

or:

```text
Database table users failed because...
```

Prefer:

```text
Invalid authentication request.
```

Internal details belong in secure logs.

---

# 33. Authentication Enumeration

Be careful about revealing whether a phone number belongs to an account.

For example, authentication endpoints should avoid unnecessarily exposing:

```text
"This phone number has no account."
```

because attackers can enumerate users.

Response behavior should be deliberately designed.

---

# 34. Rate Limiting

Rate limiting should apply to sensitive operations.

Examples:

```text
OTP requests
OTP verification
login attempts
password/credential operations if added
review creation
dispute creation
file uploads
payment creation
refund requests
admin endpoints
```

Use Redis-based distributed rate limiting where multiple application instances exist.

---

# 35. Abuse Protection

Rate limiting alone is not enough.

Potential abuse:

```text
fake service requests
fake worker accounts
review spam
job creation spam
notification abuse
payment abuse
file upload abuse
```

The platform needs business-level abuse controls in addition to technical rate limits.

---

# 36. Idempotency

Sensitive commands should support idempotency where duplicate requests could create duplicate effects.

Examples:

```text
payment creation
refund
booking confirmation
additional-work approval
review submission
webhook processing
```

This reduces accidental duplication and some classes of abuse.

---

# 37. Concurrency Security

Security and concurrency overlap.

Example:

```text
Two users attempt to confirm the same booking.
```

The system must guarantee:

```text
exactly one valid business result
```

through:

```text
transaction
+
database constraints
+
locking/versioning
+
idempotency
```

Redis locks alone are insufficient.

---

# 38. Payment Security

The application should avoid handling raw payment credentials where possible.

Use payment-provider mechanisms such as:

```text
provider-hosted payment
tokenized payment method
provider-generated payment intent
```

Never store:

```text
CVV
raw card credentials
provider secret keys
```

in ordinary application tables.

---

# 39. Payment Webhook Security

Webhook endpoints are public-facing.

Never trust a webhook merely because it came from a provider URL.

Verify:

```text
signature
provider identity
event structure
event ID
timestamp/replay protections where supported
```

Then process idempotently.

---

# 40. Webhook Replay Attack

An attacker may attempt:

```text
valid PaymentSucceeded webhook
       ↓
send same event repeatedly
```

Defense:

```text
unique provider event ID
+
idempotent processing
+
provider signature verification
```

---

# 41. Location Privacy

Location is highly sensitive operational data.

The system should avoid exposing:

```text
exact worker home location
exact customer home location
historical movement
private addresses
```

unless required for a legitimate workflow.

---

# 42. Location During Matching

Matching may need:

```text
worker location
customer service location
distance
service area
```

But clients do not necessarily need to receive the exact underlying coordinates.

The API should expose the minimum necessary information.

---

# 43. Worker Home Location

A worker may define a service area centered around an area.

Do not automatically expose:

```text
exact service-area center coordinates
```

to every customer.

Instead expose suitable marketplace-level information such as:

```text
service coverage area
approximate locality
distance estimate
```

when sufficient.

---

# 44. Customer Address Privacy

A customer's saved addresses should only be visible to:

```text
the customer
authorized workers involved in a legitimate job
authorized operations/admin users
```

and only when necessary.

---

# 45. Realtime Security

WebSocket connections must authenticate.

After authentication:

```text
user
 ↓
allowed subscriptions
```

must be checked.

Do not allow:

```text
subscribe booking:ANY_BOOKING_ID
```

---

# 46. WebSocket Subscription Authorization

Example:

```text
Worker A
 ↓
subscribe booking:123
```

Server checks:

```text
Worker A belongs to booking 123?
```

If no:

```text
subscription denied
```

---

# 47. WebSocket Message Security

WebSocket messages should not bypass normal application authorization.

Avoid:

```text
WebSocket
 ↓
change booking status
```

unless the command is deliberately designed and authorized.

The initial architecture should keep business commands behind application services/API contracts.

---

# 48. File Upload Threats

Uploaded files are an important attack surface.

Threats include:

```text
malware
executable content
fake MIME types
oversized files
zip bombs
polyglot files
path traversal
malicious metadata
resource exhaustion
```

---

# 49. File Upload Security

Use:

```text
allowlisted file types
size limits
count limits
content validation
opaque object keys
private storage
authorization
malware scanning where appropriate
processing isolation
```

Never trust:

```text
filename
Content-Type
file extension
```

alone.

---

# 50. Object Key Security

Do not use:

```text
uploads/{userProvidedFilename}
```

Prefer server-generated keys:

```text
service-requests/{requestId}/{opaqueId}
```

This reduces:

* collisions;
* traversal risks;
* information leakage.

---

# 51. Signed URLs

Private files can be accessed using short-lived signed URLs.

The application should verify authorization **before issuing the signed URL**.

Do not make a sensitive object public merely because it is inconvenient to authorize access.

---

# 52. Verification Documents

Verification documents require stronger controls.

Examples:

```text
identity document
professional certificate
background-check evidence
```

Access should be restricted to authorized trust/admin workflows.

Customers and ordinary workers should never receive these documents simply because they can view a worker profile.

---

# 53. File Metadata

Be careful with:

```text
EXIF
GPS coordinates
device information
original filenames
timestamps
```

Image metadata may reveal information the uploader did not intend to publish.

Processing policies should explicitly decide what metadata is preserved or removed.

---

# 54. SSRF

The application may eventually interact with external URLs or provider callbacks.

If users can supply URLs that the backend fetches, protect against SSRF.

Do not allow arbitrary server-side requests to:

```text
localhost
private IP ranges
cloud metadata endpoints
internal admin services
```

The safest approach is to avoid server-side URL fetching unless genuinely required.

---

# 55. CSRF

If browser authentication uses cookies, CSRF protection becomes important for state-changing requests.

Possible protections include:

```text
SameSite cookies
CSRF tokens
origin validation
secure cookie configuration
```

If bearer tokens are used in a manner that does not rely on ambient browser credentials, the threat model differs.

The final approach should be determined by the client architecture.

---

# 56. CORS

CORS should be restrictive.

Do not use:

```text
Access-Control-Allow-Origin: *
```

for authenticated browser APIs without a deliberate reason.

Explicitly configure trusted origins.

---

# 57. Security Headers

For browser-facing applications, consider appropriate headers such as:

```text
Content-Security-Policy
X-Content-Type-Options
Referrer-Policy
Strict-Transport-Security
Frame protections
```

Exact configuration depends on frontend architecture.

---

# 58. TLS

Production traffic should use HTTPS.

Internal connections involving sensitive information should also use appropriate encryption and network controls.

Examples:

```text
Client → API
API → database where supported
API → Redis where appropriate
API → external providers
```

---

# 59. Secrets Management

Secrets include:

```text
database passwords
JWT signing secrets
payment provider keys
SMS provider keys
storage credentials
Redis credentials
encryption keys
```

Never store production secrets in Git.

Use environment-specific secret management.

---

# 60. Secret Rotation

The architecture should support rotation.

For example:

```text
old API key
      ↓
new API key
      ↓
deployment
      ↓
old key revoked
```

Avoid designs where changing a secret requires rewriting application code.

---

# 61. Encryption at Rest

Sensitive data should be protected at rest through appropriate infrastructure controls.

Potentially:

```text
database encryption
object storage encryption
encrypted backups
secret-manager encryption
```

Highly sensitive application-level fields may additionally require application-level encryption depending on the final privacy requirements.

---

# 62. Application-Level Encryption

Do not automatically encrypt every database column.

Application-level encryption can complicate:

* searching;
* indexing;
* migrations;
* key rotation;
* debugging.

Use it selectively for especially sensitive values where infrastructure-level encryption is insufficient.

---

# 63. Passwords

If password authentication is introduced later:

```text
never store plaintext passwords
```

Use a modern password hashing algorithm and appropriate work factor.

The initial OTP-first model avoids much of this attack surface.

---

# 64. Account Suspension

Suspension should be enforced centrally.

A suspended user should not simply lose UI access.

The backend should prevent appropriate operations:

```text
login/session use where appropriate
new bookings
worker job acceptance
payment actions
other sensitive operations
```

The exact policy depends on suspension reason.

---

# 65. Deactivation

Deactivation is different from suspension.

Suspension:

```text
temporary restriction
```

Deactivation:

```text
account lifecycle change
```

Historical transactional records should remain where required.

Do not casually delete:

```text
jobs
payments
reviews
disputes
audit events
```

because the user was deactivated.

---

# 66. Insider Threat

An employee/admin may have legitimate access but misuse it.

Controls:

```text
least privilege
role separation
audit logs
sensitive-data access logging
approval workflows for high-risk actions
reason fields
periodic access review
```

For example:

```text
refund
+
large amount
+
admin action
```

may eventually require additional authorization.

---

# 67. Support Staff

As the platform grows, support personnel should not automatically receive full admin permissions.

Possible permission model:

```text
view booking
view limited customer information
assist cancellation
view dispute status
```

while excluding:

```text
refund issuance
verification approval
worker suspension
financial configuration
```

unless explicitly authorized.

---

# 68. Data Access Boundaries

A useful rule:

> Access only the data necessary to perform the operation.

For example, a worker needs enough customer information to perform a job.

They do not necessarily need:

```text
all customer addresses
payment history
identity verification
previous disputes
```

---

# 69. Business Logic Security

Security should live close to business rules.

Example:

```text
Booking.confirm()
```

should enforce valid state transitions.

Controllers should not be the only place checking:

```text
booking is pending
```

because other entry points may exist:

* REST;
* admin;
* scheduled job;
* event consumer.

---

# 70. Domain Invariants as Security Controls

Examples:

```text
only assigned worker can update job
only eligible user can review
refund <= captured amount
one confirmed booking/request
only authorized actor can cancel
verification state transitions are controlled
```

These are both business and security protections.

---

# 71. Database Security

Application database users should have only required permissions.

Avoid running the application as:

```text
database superuser
```

Use least privilege.

Separate migration privileges from normal application runtime privileges where practical.

---

# 72. Database Network Security

PostgreSQL should not be directly exposed to the public internet.

Typical architecture:

```text
Internet
   ↓
Load Balancer
   ↓
Application
   ↓
Private Database Network
   ↓
PostgreSQL
```

---

# 73. Redis Network Security

Similarly:

```text
Internet
   X
   ↓
Redis

Application
   ↓
Private Redis Network
```

Redis should not be publicly reachable.

---

# 74. Object Storage Security

Buckets should generally be private.

Use:

```text
private bucket
server-controlled object keys
signed URLs
IAM permissions
encryption
access logging where appropriate
```

Do not rely on secret filenames as security.

---

# 75. Dependency Security

Third-party dependencies can introduce vulnerabilities.

The build pipeline should include:

```text
dependency scanning
vulnerability monitoring
version updates
software bill of materials where appropriate
```

Do not blindly upgrade production dependencies without compatibility testing.

---

# 76. Container Security

When Docker is used:

* use minimal base images where practical;
* avoid running as root;
* scan images;
* pin important versions;
* keep secrets outside images;
* remove unnecessary packages;
* use read-only filesystem where practical.

---

# 77. CI/CD Security

CI/CD credentials can be extremely powerful.

Protect:

```text
cloud credentials
deployment credentials
container registry credentials
signing keys
production secrets
```

Use short-lived credentials where possible.

Separate:

```text
development
staging
production
```

permissions.

---

# 78. Supply Chain Security

Potential risks include:

```text
compromised dependency
malicious package
compromised Docker image
CI action compromise
stolen registry credentials
```

Mitigations include:

* trusted dependencies;
* lock files;
* vulnerability scanning;
* controlled CI actions;
* image scanning;
* dependency update review.

---

# 79. Security Monitoring

Security-specific metrics can include:

```text
authentication failures
OTP abuse
rate-limit violations
authorization failures
suspicious admin actions
webhook signature failures
malicious upload detections
unexpected token refresh patterns
```

Avoid collecting unnecessary personal information in security telemetry.

---

# 80. Brute Force Protection

Potential targets:

```text
OTP verification
admin authentication
refresh tokens
review creation
payment endpoints
```

Use:

```text
rate limits
attempt limits
temporary throttling
account/session controls
```

Avoid overly aggressive controls that lock legitimate users indefinitely.

---

# 81. Bot Protection

At higher traffic volumes, automated abuse may require:

```text
IP reputation
behavioral rate limits
device/session signals
CAPTCHA/challenge mechanisms where justified
```

Do not introduce CAPTCHA everywhere by default.

Use it where abuse evidence justifies additional friction.

---

# 82. Review Abuse

A malicious actor may create fake accounts to manipulate ratings.

The first defense should be structural:

```text
review requires eligible completed job
one review per eligible relationship
reviewer/reviewee relationship validated
```

Additional fraud signals can come later.

---

# 83. Fake Worker Accounts

Worker onboarding should include:

```text
phone verification
identity verification
profession/skill verification
admin review where required
```

The system should distinguish:

```text
registered
```

from:

```text
verified
```

A phone number alone should not imply professional verification.

---

# 84. Fake Service Requests

Customers could spam requests.

Controls:

```text
rate limits
request frequency controls
duplicate detection
account reputation signals later
abuse monitoring
```

Do not punish legitimate users solely based on a single unusual request.

---

# 85. Dispute Security

Disputes may contain sensitive evidence.

Protect:

```text
evidence
private notes
financial details
internal resolution notes
```

Differentiate:

```text
customer-visible information
worker-visible information
admin-only information
```

---

# 86. Security for Notifications

Notifications can leak information.

Avoid sensitive content in push previews where unnecessary.

Example:

Instead of exposing:

```text
Your ₹8,500 payment for work at [full address] was successful.
```

consider a minimized notification that directs the user into the authenticated application.

The exact notification content should depend on the channel and sensitivity.

---

# 87. Security for Email/SMS

External messaging systems may have different privacy characteristics.

Do not put:

```text
identity documents
payment credentials
full dispute evidence
```

into SMS/email.

Use secure authenticated deep links for sensitive details.

---

# 88. API Version Security

Security rules must remain consistent across API versions.

Do not allow:

```text
v1 requires authorization
v2 accidentally does not
```

API versioning should not create authorization gaps.

---

# 89. Security Testing

Security testing should occur at multiple levels.

### Unit

Test:

```text
authorization rules
state transitions
validation
financial invariants
```

### Integration

Test:

```text
authentication
database authorization
webhook verification
storage authorization
```

### API

Test:

```text
unauthorized requests
wrong-role requests
wrong-resource requests
```

### Security scanning

Use:

```text
dependency scanning
container scanning
static analysis
dynamic testing
```

---

# 90. Authorization Test Matrix

Example:

| Operation                      |    Customer |                Worker |                    Admin |
| ------------------------------ | ----------: | --------------------: | -----------------------: |
| Create service request         |         Yes |      Policy-dependent |           Admin workflow |
| Accept match                   |          No |             Own match |                       No |
| Confirm booking                | Own booking |   Authorized workflow |         Policy-dependent |
| Complete own job               |          No |                   Yes |         Support workflow |
| Approve verification           |          No |                    No |         Authorized admin |
| Issue refund                   |          No |                    No | Authorized finance/admin |
| View private verification docs |          No | Own where appropriate |      Authorized reviewer |

The exact permission matrix will be finalized before implementation.

---

# 91. Threat Modeling Method

For each major feature, ask:

```text
1. What assets are involved?
2. Who can access them?
3. What can the attacker control?
4. What trust boundary is crossed?
5. What happens if the attacker succeeds?
6. What prevents it?
7. What detects it?
8. What limits the damage?
```

This should become part of engineering design reviews.

---

# 92. Example Threat Model: Booking

Threats:

```text
Unauthorized booking access
Duplicate confirmation
Fake worker acceptance
Price manipulation
IDOR
Replay request
Race condition
```

Controls:

```text
authentication
resource authorization
server-side pricing
idempotency
database constraints
transactions
audit
```

---

# 93. Example Threat Model: Payment

Threats:

```text
amount manipulation
fake success response
webhook forgery
webhook replay
duplicate payment
duplicate refund
```

Controls:

```text
server-side amount calculation
provider verification
signature validation
event-id uniqueness
idempotency
financial invariants
reconciliation
audit
```

---

# 94. Example Threat Model: File Upload

Threats:

```text
malware
oversized file
fake MIME type
private file exposure
object-key manipulation
metadata leakage
```

Controls:

```text
allowlist
size limits
server-generated keys
private storage
authorization
scanning
metadata processing
```

---

# 95. Example Threat Model: Admin

Threats:

```text
credential theft
privilege escalation
unauthorized refund
unauthorized suspension
data exfiltration
```

Controls:

```text
strong authentication
least privilege
explicit permissions
audit logging
sensitive-action controls
access reviews
```

---

# 96. Security Incident Response

The system should be prepared for incidents.

Possible incident types:

```text
account takeover
payment fraud
data exposure
admin compromise
malicious file upload
provider credential leak
database compromise
```

A response process should include:

```text
detect
contain
investigate
eradicate
recover
review
```

---

# 97. Account Compromise

If an account is suspected compromised:

```text
revoke sessions
rotate relevant credentials
temporarily restrict risky actions
review audit history
notify user where appropriate
restore access securely
```

Do not simply change the UI state.

---

# 98. Security Logging

Security events should include:

```text
authentication failure
authorization denial
admin action
token/session anomaly
webhook signature failure
file scanning failure
rate-limit abuse
```

These integrate with [operations/01](../operations/01-observability-logging-metrics-and-tracing.md)'s observability architecture.

---

# 99. Security and Privacy Separation

Security asks:

> How do we prevent unauthorized access?

Privacy asks:

> What data should we collect, why, who should see it, and how long should we retain it?

The next document will cover privacy, PII, retention, and compliance in more detail.

---

# 100. Security Architecture

The intended architecture is:

```text
                        Internet
                           │
                         HTTPS
                           │
                           ↓
                 ┌──────────────────┐
                 │ Load Balancer /  │
                 │ Edge Protection   │
                 └────────┬─────────┘
                          │
                          ↓
                 ┌──────────────────┐
                 │   Spring Boot    │
                 │  API/Application │
                 └────────┬─────────┘
                          │
          ┌───────────────┼────────────────┐
          ↓               ↓                ↓
      PostgreSQL        Redis          Object Storage
          │
          │
          ↓
       Audit Data

Application
    │
    ├── Payment Provider
    ├── Notification Providers
    ├── Identity Provider
    └── Maps Provider
```

Every boundary has:

```text
authentication
authorization
validation
encryption
rate limiting
auditing
failure handling
```

where applicable.

---

# 101. MVP Security Scope

The first production release should include:

```text
OTP authentication
OTP rate limiting
secure session/token handling
RBAC
resource ownership checks
explicit state-transition authorization
API validation
idempotency
payment webhook verification
private object storage
signed URLs
file validation
basic malware scanning where required
HTTPS
secret management
database access controls
Redis network protection
audit logging
security event logging
rate limiting
dependency scanning
```

---

# 102. Future Security Enhancements

Later, depending on actual risk:

```text
advanced fraud detection
device intelligence
risk-based authentication
step-up authentication
fine-grained admin permissions
privileged-action approval
automated abuse detection
advanced bot protection
security information/event management
automated threat detection
hardware-backed key management
advanced data-loss prevention
```

These should be introduced based on actual risk and scale.

---

# 103. What We Should Avoid

Do not:

* trust client-provided roles;
* trust client-provided payment status;
* expose private object storage;
* use UUIDs as a replacement for authorization;
* log OTPs or credentials;
* store secrets in Git;
* run application DB as superuser;
* allow arbitrary admin CRUD;
* use Redis as the only security control;
* expose exact private locations unnecessarily;
* accept arbitrary uploaded files without validation;
* assume WebSocket subscriptions are inherently authorized;
* make every admin a super-admin;
* rely exclusively on frontend authorization;
* assume external webhooks are trustworthy;
* create security controls that cannot be audited.

---

# 104. Core Security Invariants

The platform must enforce:

1. Authentication is separate from authorization.
2. Every protected resource requires explicit authorization.
3. Resource ownership/relationship must be validated server-side.
4. Client-controlled roles and permissions are never trusted.
5. Client-provided financial values are never authoritative.
6. Critical state transitions are enforced in application/domain logic.
7. Database constraints protect important security-sensitive invariants.
8. Sensitive commands support idempotency where duplicate effects are possible.
9. OTPs are short-lived and rate-limited.
10. OTPs and credentials are never logged.
11. Secrets are never committed to source control.
12. Production secrets use controlled secret management.
13. Payment webhooks are authenticated and idempotently processed.
14. Private files remain private by default.
15. File uploads use server-controlled object keys and validation.
16. Exact location information is exposed only when necessary.
17. WebSocket connections and subscriptions are authorized.
18. Admin permissions follow least privilege.
19. Sensitive administrative actions are audited.
20. Audit history is append-oriented.
21. Database and Redis are not publicly exposed.
22. External dependencies are treated as untrusted/unreliable boundaries.
23. Security failures should fail safely rather than granting access.
24. Sensitive data is minimized in logs, events, notifications, and telemetry.
25. Security controls must remain effective across all API versions and entry points.
26. Security incidents must be detectable through observability.
27. Security should be layered so that one failed control does not automatically expose the system.
28. Historical business records must not be destroyed merely because an account is suspended or deactivated.
29. Security decisions must be explicit and testable.
30. No single mechanism—JWT, Redis, UUID, frontend checks, or API gateway—is treated as the complete security model.

---

# 105. Final Security Principle

The most important principle is:

> **Assume every boundary can be attacked and every client-controlled value can be manipulated.**

Therefore:

```text
Client
   ↓
Authenticate
   ↓
Authorize
   ↓
Validate
   ↓
Execute business rules
   ↓
Enforce DB invariants
   ↓
Audit sensitive actions
   ↓
Observe behavior
```

For external systems:

```text
External Provider
      ↓
Authenticate/verify
      ↓
Validate payload
      ↓
Idempotency
      ↓
Business processing
      ↓
Audit
```

For sensitive files:

```text
Upload
   ↓
Validate
   ↓
Quarantine/process
   ↓
Authorize
   ↓
Private storage
   ↓
Short-lived access
```

The goal is not merely to have authentication and HTTPS.

The goal is to ensure that:

> **Even when a user manipulates requests, retries operations, changes identifiers, submits malicious files, races concurrent requests, or an external dependency behaves unexpectedly, the platform still protects its users, money, data, and business invariants.**

# End of Document
