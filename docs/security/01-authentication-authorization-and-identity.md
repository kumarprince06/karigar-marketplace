# Authentication, Authorization & Identity Security Design

**Project:** Karigar Marketplace
**Status:** Architecture / Engineering Design
**Architecture:** Modular Monolith
**Primary Stack:** Java + Spring Boot + Spring Security + PostgreSQL + Redis

---

## 1. Purpose

This document defines how the system will identify users, authenticate them, authorize their actions, manage sessions and tokens, protect sensitive operations, and enforce security boundaries.

The goal is not merely to make login work.

The goal is to establish a security architecture that can later support:

* millions of users
* multiple devices
* worker and customer accounts
* administrative users
* account suspension
* session revocation
* OTP authentication
* API authentication
* role-based authorization
* resource ownership
* auditability
* payment-related operations
* future mobile applications
* future web applications
* future service extraction

The design should remain simple enough for the initial modular monolith while avoiding security decisions that become expensive to change later.

---

# 2. Security Principles

The system follows these principles:

### Principle 1 — Authentication and authorization are different

Authentication answers:

> Who are you?

Authorization answers:

> Are you allowed to perform this action?

A valid login does not automatically mean the user can access every resource.

---

### Principle 2 — Never trust the client

The frontend may send:

```text
customerId
workerId
bookingId
role
status
```

The backend must never assume these values are trustworthy.

Authorization must be determined server-side.

---

### Principle 3 — Database ownership is not authorization

Having:

```text
booking.customer_id = currentUser.id
```

may be part of authorization, but authorization should be expressed explicitly in the application/domain layer.

---

### Principle 4 — Least privilege

Every user should receive only the permissions required for their role and operation.

---

### Principle 5 — Sensitive actions require stronger protection

Examples:

* changing phone number
* changing payout information
* administrative actions
* worker verification decisions
* refunds
* account recovery

should receive additional security controls.

---

### Principle 6 — Security events must be auditable

Important actions should produce an audit record.

Examples:

```text
LOGIN_SUCCESS
LOGIN_FAILED
OTP_REQUESTED
OTP_VERIFIED
LOGOUT
SESSION_REVOKED
ACCOUNT_SUSPENDED
WORKER_VERIFICATION_APPROVED
ADMIN_REFUND_CREATED
```

---

# 3. Identity Model

The system separates identity from business profiles.

Conceptually:

```text
User
 │
 ├── Customer Profile
 │
 ├── Worker Profile
 │
 └── Admin Access
```

The core identity is:

```text
User
```

A user may have one or more business capabilities.

For the MVP:

```text
User
 ├── CUSTOMER
 ├── WORKER
 └── ADMIN
```

However, roles should not be confused with profiles.

For example:

```text
User
id = 123
phone = +91XXXXXXXXXX

Customer
customer_id = 456
user_id = 123
```

A worker has:

```text
User
id = 789

Worker
worker_id = 321
user_id = 789
```

This keeps authentication independent from the business domain.

---

# 4. Authentication vs Account State

A user can successfully authenticate but still be unable to perform normal operations.

For example:

```text
Authentication:
SUCCESS

Account:
SUSPENDED
```

Therefore:

```text
Authentication status
        ≠
Account authorization status
```

Example:

```text
User logs in
      ↓
OTP verified
      ↓
Authentication successful
      ↓
User status checked
      ↓
SUSPENDED
      ↓
Restricted access
```

This distinction becomes important for:

* fraud
* disputes
* policy violations
* administrative suspension
* account recovery
* worker verification.

---

# 5. User Account States

Recommended states:

```text
ACTIVE
SUSPENDED
DEACTIVATED
```

### ACTIVE

Normal operation.

### SUSPENDED

Authentication may be allowed depending on the security policy, but business operations are restricted.

For example:

```text
login → allowed
view account → allowed
create booking → denied
accept job → denied
payment → restricted
```

The exact behavior can be refined later.

### DEACTIVATED

The account is no longer active.

Historical transactional records remain.

We do not delete:

```text
jobs
payments
reviews
disputes
audit events
```

just because an account is deactivated.

---

# 6. Authentication Method

> **Updated — see [ADR 0016](../adr/0016-email-password-login-phone-otp-later.md).** The MVP uses **email + password**, because no free SMS route is available. Email and mobile number are both unique per account. Phone number + OTP login (the flow below and sections 7–12) is added in a later phase, when an SMS provider is in place.

MVP flow:

```text
User
 │
 │ POST /auth/login  { email, password }
 ▼
Backend
 │
 ├── rate limit (per IP + per email)
 ├── load user by lower(email)
 ├── verify password hash (Argon2id/bcrypt)
 ├── check account status
 └── create authenticated session
```

Passwords are stored only as Argon2id or bcrypt hashes (Spring Security `DelegatingPasswordEncoder`). Email verification and password reset use single-use, hashed, expiring tokens (`user_auth_tokens`), sent by email through Brevo. A mobile number already used by another account is rejected; users can change their number from the profile.

Later phase — phone number + OTP:

Flow:

```text
User
 │
 │ POST /auth/otp/request
 ▼
Backend
 │
 ├── validate phone
 ├── rate limit
 ├── generate OTP
 ├── store hashed OTP
 └── send OTP
       │
       ▼
   SMS Provider
```

Then:

```text
User
 │
 │ POST /auth/otp/verify
 ▼
Backend
 │
 ├── validate OTP
 ├── validate expiry
 ├── validate attempts
 ├── identify user
 └── create authenticated session
```

---

# 7. OTP Security

OTP is an authentication credential.

It must therefore be treated as sensitive.

Never store OTP as plaintext.

Bad:

```text
otp = "482931"
```

Instead:

```text
hash(otp + serverSecret)
```

or another appropriate one-way verification mechanism.

Redis is suitable for short-lived OTP state.

Example:

```text
otp:{phone}
```

Conceptually:

```text
{
    hash: "...",
    expiresAt: "...",
    attempts: 0
}
```

---

# 8. OTP Expiration

OTP should have a short lifetime.

Example policy:

```text
OTP lifetime: 5 minutes
```

This value is configurable.

Do not hard-code security policy throughout the application.

---

# 9. OTP Attempt Protection

The system should limit verification attempts.

Example:

```text
Maximum attempts:
5
```

After the limit:

```text
OTP invalidated
```

The user must request a new OTP.

This protects against brute-force attempts.

---

# 10. OTP Request Rate Limiting

The system should rate-limit OTP generation.

Potential limits:

```text
per phone number
per IP
per device
per time window
```

For example:

```text
Phone:
3 OTP requests / 10 minutes

IP:
reasonable configurable threshold
```

Exact production values should be determined after observing real traffic.

---

# 11. OTP Enumeration Protection

The API should avoid revealing whether a phone number already exists.

Bad:

```json
{
  "message": "This phone number is not registered."
}
```

This allows attackers to enumerate users.

Prefer a generic response:

```json
{
  "data": {
    "message": "If the number can receive an OTP, one has been sent."
  }
}
```

The exact registration/login UX can be finalized later.

---

# 12. OTP Abuse Prevention

The system should consider:

```text
SMS flooding
OTP brute force
phone enumeration
automated account creation
IP abuse
device abuse
```

Redis can initially provide:

* counters
* TTLs
* temporary locks
* rate-limit state.

Redis is not the permanent source of identity data.

---

# 13. Access Token Strategy

After successful OTP verification, the client needs an authenticated credential.

For the API architecture, use:

```text
Short-lived access token
+
Long-lived refresh token
```

Conceptually:

```text
Access Token
   ↓
short lifetime
   ↓
used for API requests

Refresh Token
   ↓
longer lifetime
   ↓
used to obtain new access token
```

---

# 14. Why Short-Lived Access Tokens?

Suppose an access token is stolen.

A short lifetime reduces the useful lifetime of the stolen credential.

For example:

```text
Access token:
15 minutes
```

The exact lifetime is configurable.

The principle is more important than the initial number.

---

# 15. Refresh Token Strategy

Refresh tokens require stronger protection than ordinary access tokens.

Recommended approach:

> Store refresh-token state server-side.

For example:

```text
sessions
```

or:

```text
refresh_tokens
```

Possible fields:

```text
id
user_id
token_hash
device_id
created_at
expires_at
revoked_at
last_used_at
ip_address
user_agent
```

Never store raw refresh tokens if avoidable.

Store a hash.

---

# 16. Refresh Token Rotation

A refresh token should ideally be rotated.

Flow:

```text
Refresh Token A
      ↓
Refresh endpoint
      ↓
Access Token B
Refresh Token B
      ↓
Refresh Token A invalidated
```

This helps detect token replay.

If an already-used refresh token is reused unexpectedly, the system can revoke the associated session or token family depending on the security policy.

---

# 17. Access Token Format

There are two common approaches.

### JWT

The token contains claims such as:

```text
sub
userId
roles
issuedAt
expiresAt
```

Advantages:

* stateless verification
* efficient
* suitable for distributed API instances.

Disadvantages:

* revocation is more complicated
* stale claims can remain until expiration
* token management requires careful key management.

---

### Opaque Token

The token contains no meaningful information.

The server resolves it against session state.

Advantages:

* straightforward revocation
* centralized control.

Disadvantages:

* requires server-side lookup
* adds state/cache/database dependency.

---

## MVP Decision

Use:

```text
Short-lived signed access token
+
Server-side refresh-session state
```

This provides a reasonable balance between scalability and revocation control.

Do not put sensitive business information into JWT claims.

---

# 18. JWT Claims

Keep claims minimal.

Example:

```json
{
  "sub": "user-id",
  "roles": ["CUSTOMER"],
  "iat": 1770000000,
  "exp": 1770000900
}
```

Do not put:

```text
phone number
address
worker rating
worker location
payment information
personal data
```

into the access token unless there is a strong architectural reason.

---

# 19. Signing Keys

JWT signing keys are security-critical secrets.

They must not be stored inside source code.

Bad:

```java
private static final String SECRET = "my-secret";
```

Use:

```text
environment variables
secret manager
deployment secret configuration
```

For production, key rotation must also be considered.

---

# 20. Spring Security Architecture

The authentication path should look conceptually like:

```text
HTTP Request
     ↓
Security Filter Chain
     ↓
Authentication Filter
     ↓
Token Validation
     ↓
Authentication Object
     ↓
Authorization
     ↓
Controller
     ↓
Application Layer
     ↓
Domain
```

Spring Security handles the security infrastructure.

The business modules should not implement their own token validation.

---

# 21. Security Filter Chain

Conceptually:

```text
SecurityFilterChain
```

will define:

* authentication
* authorization
* exception handling
* CORS
* CSRF strategy
* session policy
* security headers.

For an API using bearer tokens, the server should generally operate as stateless for access-token authentication.

---

# 22. Authentication Principal

After authentication succeeds, the application needs a representation of the current user.

Example:

```java
public record AuthenticatedUser(
    UUID userId,
    Set<Role> roles
) {}
```

Controllers/application services can obtain the authenticated identity from Spring Security.

The domain model should not depend directly on Spring Security classes.

---

# 23. Keep Spring Security Out of the Domain

Avoid:

```java
class Worker {

    Authentication authentication;

}
```

The domain should not know about:

```text
Spring Security
HTTP
JWT
Servlet
Controller
Redis
PostgreSQL
```

Instead:

```text
API
 ↓
Application
 ↓
Domain
```

Security infrastructure sits around the application.

---

# 24. Roles

Initial roles:

```text
CUSTOMER
WORKER
ADMIN
```

Potential future roles:

```text
SUPPORT_AGENT
VERIFICATION_AGENT
FINANCE_ADMIN
OPERATIONS_ADMIN
SUPER_ADMIN
```

Do not add these until required.

---

# 25. Roles Are Not Enough

A role answers:

> What general category of user is this?

It does not answer:

> Can this specific user modify this specific resource?

For example:

```text
CUSTOMER
```

does not mean:

```text
Customer can access every service request.
```

A customer should only access their own resources.

---

# 26. Resource-Based Authorization

Example:

```text
GET /service-requests/{requestId}
```

The backend must verify:

```text
request.customerId == authenticatedUser.customerId
```

or another valid relationship.

Similarly:

```text
GET /bookings/{bookingId}
```

may be accessible to:

```text
customer owning booking
OR
worker assigned to booking
OR
authorized admin
```

---

# 27. Customer Authorization

Customer operations may include:

```text
Create own service request
View own requests
Cancel eligible own request
View own bookings
Approve additional work for own job
Pay own job
Review eligible completed job
Create dispute for eligible job
```

They should not be able to:

```text
modify another customer's request
modify worker verification
approve their own admin action
change payment provider state
```

---

# 28. Worker Authorization

Workers may:

```text
manage own profile
manage own skills
manage own availability
view eligible jobs
accept own matches
reject own matches
update assigned job state
propose additional work
view own earnings
```

They must not:

```text
modify another worker
accept another worker's match
change customer payment records
approve their own verification
modify another worker's rating
```

---

# 29. Admin Authorization

Admin operations are highly privileged.

Examples:

```text
suspend worker
approve verification
reject verification
resolve dispute
inspect audit events
process administrative refund
```

Admin endpoints must have explicit authorization.

Do not rely only on:

```java
if (user.getRole() == ADMIN)
```

for every sensitive operation.

The application should also enforce:

* target resource validity
* allowed state transitions
* actor authorization
* audit requirements.

---

# 30. Administrative Privilege Separation

As the system grows, all admins should not necessarily have identical permissions.

Potential permission model:

```text
WORKER_VERIFY
WORKER_SUSPEND
DISPUTE_RESOLVE
PAYMENT_REFUND
AUDIT_READ
USER_SUPPORT
```

Then:

```text
ROLE
 ↓
PERMISSIONS
```

For MVP, simple roles are sufficient.

The permission model can be introduced when operational requirements justify it.

---

# 31. Ownership Checks

A common security vulnerability is an insecure direct object reference.

Example:

```text
GET /api/v1/service-requests/123
```

An attacker changes:

```text
123 → 124
```

and sees another user's request.

The backend must perform:

```text
load resource
       ↓
check relationship with authenticated user
       ↓
allow / deny
```

Never assume the URL itself proves ownership.

---

# 32. Authorization Location

Authorization can exist at multiple levels.

### Controller/security layer

Good for broad rules:

```text
ADMIN only
authenticated users only
```

### Application layer

Good for business authorization:

```text
customer owns request
worker is assigned to job
user is participant in dispute
```

### Domain layer

Good for state/business invariants:

```text
only assigned worker can start job
cancelled job cannot be completed
additional work requires approval
```

This separation is important.

---

# 33. Account Suspension

When an account becomes:

```text
SUSPENDED
```

existing tokens must not necessarily remain fully usable.

There are two layers:

```text
Token validity
+
Account validity
```

Even if the JWT signature is valid:

```text
User status = SUSPENDED
```

can cause access to be denied.

For high-security operations, current account state should be checked rather than trusting a stale token claim.

---

# 34. Session Revocation

Example:

```text
User
 ├── Chrome
 ├── Android
 └── iPhone
```

The user should eventually be able to see and revoke sessions.

Example:

```text
GET /api/v1/me/sessions

DELETE /api/v1/me/sessions/{sessionId}
```

This is especially useful if a device is lost.

---

# 35. Logout

Logout should revoke the refresh session.

Flow:

```text
Logout
  ↓
Refresh session revoked
  ↓
Refresh token cannot create new access tokens
```

A short-lived access token may technically remain valid until expiration unless additional token revocation mechanisms are implemented.

For normal API architecture, short access-token lifetime makes this acceptable.

For highly sensitive actions, additional checks can be applied.

---

# 36. Logout From All Devices

Useful future capability:

```text
POST /api/v1/me/sessions/revoke-all
```

Flow:

```text
User
 ↓
Revoke all refresh sessions
 ↓
All devices must authenticate again
```

Useful after:

* suspected compromise
* phone change
* account recovery
* security incident.

---

# 37. Device Identification

A session can store:

```text
deviceId
platform
userAgent
createdAt
lastUsedAt
```

Example:

```text
Android — Chrome
Last active: 10 minutes ago
```

Avoid treating a device identifier as a cryptographic security guarantee.

It is primarily session-management metadata.

---

# 38. Sensitive Operations

Some operations should require recent authentication.

Examples:

```text
change phone number
change payout account
delete/deactivate account
administrative refund
change sensitive worker verification data
```

Possible flow:

```text
Authenticated session
       ↓
Recent authentication required
       ↓
OTP verification
       ↓
Sensitive operation
```

This is often called:

> Step-up authentication.

---

# 39. Phone Number Change

Phone number is part of identity.

Changing it must not be treated like changing a normal profile field.

Recommended:

```text
Current authenticated session
        ↓
Enter new phone
        ↓
OTP sent to new phone
        ↓
Verify OTP
        ↓
Check uniqueness
        ↓
Update phone
        ↓
Revoke sensitive sessions if required
```

The exact recovery behavior is an open security decision.

---

# 40. Account Recovery

Because authentication is phone-based, losing access to the phone number creates a difficult recovery problem.

Possible future approaches:

```text
verified identity recovery
support-assisted recovery
additional trusted information
manual verification
```

Do not build an insecure:

```text
"I forgot my number → enter name → login"
```

flow.

---

# 41. API Authentication Header

Clients send:

```http
Authorization: Bearer <access-token>
```

Example:

```http
GET /api/v1/me
Authorization: Bearer eyJ...
```

The server validates:

```text
signature
issuer
audience
expiration
token type
required claims
```

---

# 42. CORS

If a web frontend is introduced:

```text
CORS
```

must be explicitly configured.

Do not use:

```text
Access-Control-Allow-Origin: *
```

for authenticated production APIs unless there is a deliberate architectural reason.

Allowed origins should be configured per environment.

Example:

```text
local:
http://localhost:3000

production:
https://app.example.com
```

The actual domains are deployment decisions.

---

# 43. CSRF

The strategy depends on how authentication credentials are transported.

For:

```text
Authorization: Bearer ...
```

with stateless API authentication, traditional cookie-based CSRF protection is generally not the primary mechanism.

If authentication later moves to cookies, CSRF protection must be reconsidered.

The security architecture should therefore not blindly disable CSRF everywhere.

---

# 44. Rate Limiting

Rate limiting should exist at multiple levels.

Examples:

```text
OTP request
OTP verification
login/authentication
password/recovery operations
service request creation
match acceptance
review creation
payment creation
admin APIs
```

Redis is appropriate for distributed rate-limit counters in the initial architecture.

---

# 45. Example Rate-Limit Keys

Conceptually:

```text
rate:otp:phone:{phoneHash}
rate:otp:ip:{ip}
rate:auth:user:{userId}
rate:payment:user:{userId}
```

Never put raw sensitive identifiers into logs or unrestricted Redis keys if avoidable.

Hashing/tokenization can reduce unnecessary exposure.

---

# 46. Brute-Force Protection

Security-sensitive endpoints should consider:

```text
IP
user
phone
device
time window
attempt count
```

A single dimension is insufficient.

For example, blocking only IPs can fail when attackers rotate IP addresses.

Blocking only phone numbers can be abused to deny service to legitimate users.

The strategy should balance abuse prevention and legitimate access.

---

# 47. PII Protection

Sensitive information includes:

```text
phone
address
identity documents
payment information
precise location
```

Access should be restricted.

For example, a worker should not automatically see a customer's complete saved address book.

Only the information necessary for the job should be exposed.

---

# 48. Location Privacy

The marketplace uses geospatial matching.

However:

```text
matching location
```

does not mean:

```text
exact customer home location visible to every worker.
```

Before booking:

```text
approximate area/distance
```

may be sufficient.

After booking:

```text
required service location
```

may become available to the assigned worker.

The exact exposure policy should be finalized as part of the privacy design.

---

# 49. File and Identity Document Security

Worker verification may eventually involve:

```text
identity documents
certificates
photos
proof documents
```

These should not be stored as public URLs.

Use:

```text
private object storage
+
short-lived signed URLs
+
authorization checks
```

Example:

```text
Admin requests document
       ↓
Authorization check
       ↓
Generate temporary URL
       ↓
Admin downloads
```

---

# 50. Secrets Management

Never commit:

```text
JWT private key
database password
payment secret
SMS provider secret
storage secret
```

into Git.

Use environment-specific secret management.

Development:

```text
.env
```

or local secret configuration.

Production:

```text
cloud secret manager
```

or equivalent infrastructure.

---

# 51. Security Logging

Security logs should capture events such as:

```text
OTP requested
OTP verification success
OTP verification failure
login success
login failure
refresh success
refresh failure
logout
session revoked
account suspended
permission denied
admin action
```

Logs should contain:

```text
timestamp
requestId
actorId where appropriate
action
resource
result
```

Avoid logging:

```text
OTP
access token
refresh token
identity document contents
full payment credentials
```

---

# 52. Audit vs Application Logs

These are different.

### Application log

Used for debugging and operations.

Example:

```text
Booking confirmation failed
```

### Audit event

Used to answer:

> Who performed this important business/security action?

Example:

```text
Admin 123
suspended Worker 456
at 2026-09-30T10:30:00Z
```

Audit events should be durable and queryable.

---

# 53. Threat Model

The initial threat model should consider:

### Account takeover

Attacker gains access to a phone/OTP.

Controls:

```text
OTP limits
short OTP lifetime
attempt limits
session management
step-up authentication
```

---

### API authorization bypass

Attacker accesses another user's resource.

Controls:

```text
ownership checks
resource authorization
integration tests
```

---

### Token theft

Attacker obtains an access token.

Controls:

```text
short token lifetime
HTTPS
secure client storage
refresh token rotation
session revocation
```

---

### OTP brute force

Attacker guesses OTPs.

Controls:

```text
short expiry
attempt limit
rate limiting
OTP invalidation
```

---

### SMS flooding

Attacker repeatedly requests OTPs.

Controls:

```text
phone rate limit
IP rate limit
device controls
abuse monitoring
```

---

### Privilege escalation

Worker attempts:

```text
/admin/...
```

Controls:

```text
role authorization
permission checks
resource checks
audit
```

---

### IDOR

Attacker changes:

```text
/job/100
```

to:

```text
/job/101
```

Controls:

```text
resource ownership checks
```

---

### Replay attacks

Attacker reuses a request.

Controls:

```text
Idempotency-Key
short-lived tokens
refresh token rotation
state validation
```

---

# 54. Authentication Flow

```text
                ┌───────────────┐
                │    Client     │
                └───────┬───────┘
                        │
                 Request OTP
                        │
                        ▼
                ┌───────────────┐
                │ Auth Module   │
                └───────┬───────┘
                        │
                 Generate OTP
                        │
                        ▼
                    Redis
                        │
                        ▼
                 SMS Provider
                        │
                        │
                     OTP
                        │
                        ▼
                ┌───────────────┐
                │    Client     │
                └───────┬───────┘
                        │
                   Verify OTP
                        │
                        ▼
                ┌───────────────┐
                │ Auth Module   │
                └───────┬───────┘
                        │
                 Find/Create User
                        │
                        ▼
                  PostgreSQL
                        │
                        ▼
                Create Session
                        │
                        ▼
              Access + Refresh Token
```

---

# 55. API Request Flow

```text
Client
  │
  │ Authorization: Bearer ...
  ▼
Spring Security
  │
  ├── Validate token
  ├── Validate expiry
  ├── Build principal
  │
  ▼
Controller
  │
  ▼
Application Service
  │
  ├── authorization
  ├── business use case
  │
  ▼
Domain
  │
  ├── invariants
  ├── state transition
  │
  ▼
Repository
  │
  ▼
PostgreSQL
```

---

# 56. Suggested Package Structure

Inside the `identity` module:

```text
identity/
├── api/
│   ├── AuthController.java
│   ├── SessionController.java
│   ├── AuthResponse.java
│   └── dto/
│
├── application/
│   ├── command/
│   │   ├── RequestOtpCommand.java
│   │   ├── VerifyOtpCommand.java
│   │   ├── RefreshTokenCommand.java
│   │   └── LogoutCommand.java
│   │
│   ├── service/
│   │   ├── AuthenticationService.java
│   │   ├── OtpService.java
│   │   └── SessionService.java
│   │
│   └── port/
│       ├── in/
│       └── out/
│
├── domain/
│   ├── model/
│   │   ├── User.java
│   │   └── Session.java
│   │
│   ├── valueobject/
│   │   ├── PhoneNumber.java
│   │   └── UserId.java
│   │
│   ├── event/
│   └── exception/
│
└── infrastructure/
    ├── persistence/
    ├── security/
    │   ├── SecurityConfiguration.java
    │   ├── JwtTokenService.java
    │   ├── JwtAuthenticationFilter.java
    │   └── AuthenticatedUser.java
    │
    ├── otp/
    └── sms/
```

---

# 57. Security Configuration Responsibility

`SecurityConfiguration` should define infrastructure policy.

Conceptually:

```java
@Configuration
@EnableWebSecurity
public class SecurityConfiguration {

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http
    ) throws Exception {

        return http
            // authentication configuration
            // authorization configuration
            // security headers
            // CORS
            .build();
    }
}
```

The exact configuration will be implemented later according to the Spring Boot/Spring Security version selected for the project.

---

# 58. Avoid Business Logic in Security Configuration

Do not put:

```text
"worker can only accept job if..."
```

inside `SecurityConfiguration`.

That is domain/application logic.

Security configuration should handle broad security concerns.

The application/domain layer handles business rules.

---

# 59. Authorization Example

Suppose:

```text
POST /api/v1/jobs/123/start
```

The request passes:

```text
Authentication
```

Then application logic checks:

```text
Is the authenticated user the assigned worker?
```

Then domain logic checks:

```text
Is the job currently ARRIVED?
```

Only then:

```text
job.start()
```

So:

```text
Security
   ↓
Who is calling?

Application authorization
   ↓
Is this actor allowed?

Domain invariant
   ↓
Is this state transition valid?
```

This is the correct separation.

---

# 60. Error Responses

Do not expose internal security details.

For unauthorized:

```http
401 Unauthorized
```

For authenticated but forbidden:

```http
403 Forbidden
```

For resource access that should not reveal existence, the API may deliberately return:

```http
404 Not Found
```

depending on the resource and privacy/security requirements.

---

# 61. Avoid Authorization Information Leakage

Bad:

```json
{
  "error": {
    "message": "User 123 owns this booking but you are not authorized."
  }
}
```

This leaks information.

Prefer:

```json
{
  "error": {
    "code": "RESOURCE_NOT_AVAILABLE",
    "message": "The requested resource is not available."
  }
}
```

The exact error model follows [api/01](../api/01-rest-api-contract-endpoints-and-error-model.md).

---

# 62. Authentication Event Model

Important identity events can include:

```text
OtpRequested
OtpVerified
AuthenticationSucceeded
AuthenticationFailed
SessionCreated
SessionRefreshed
SessionRevoked
UserSuspended
UserDeactivated
PhoneNumberChanged
```

These events can feed:

```text
audit
security monitoring
notifications
analytics
```

without tightly coupling authentication to those systems.

---

# 63. Session Data Model

A conceptual session table:

```text
sessions
--------------------------------
id
user_id
token_hash
device_id
platform
user_agent
ip_address
created_at
last_used_at
expires_at
revoked_at
```

Potential future fields:

```text
token_family_id
revoke_reason
last_refresh_at
```

Do not store the raw refresh token.

---

# 64. Database Constraints

Useful constraints include:

```text
users.phone UNIQUE
sessions.token_hash UNIQUE
```

and appropriate indexes:

```text
sessions.user_id
sessions.expires_at
sessions.revoked_at
```

Expired sessions can later be cleaned up asynchronously.

---

# 65. Redis Responsibilities

Redis can handle:

```text
OTP state
OTP attempts
rate limits
temporary authentication state
short-lived locks
```

PostgreSQL handles:

```text
users
sessions
roles
account state
audit history
```

This keeps permanent identity state durable.

---

# 66. What Happens When Redis Is Down?

Important distinction:

If Redis is unavailable:

```text
OTP request
rate limiting
```

may be unavailable.

But existing persistent user identity should remain in PostgreSQL.

Do not design the entire authentication system so that the user database disappears when Redis fails.

---

# 67. Multi-Instance Deployment

Later:

```text
               Load Balancer
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
       App #1    App #2    App #3
          │         │         │
          └────┬────┴────┬────┘
               │         │
          PostgreSQL    Redis
```

Because access-token verification is not tied to a particular application instance, any instance can authenticate the request.

Refresh/session state is shared.

This is one reason not to use in-memory session storage inside an application instance.

---

# 68. Security Testing

Security must be tested at multiple levels.

### Unit tests

Test:

```text
OTP expiration
OTP attempt limit
session expiration
state authorization
```

### Integration tests

Test:

```text
customer accessing another customer's request
worker accessing another worker's job
non-admin accessing admin API
suspended worker accepting job
```

### API security tests

Test:

```text
missing token
invalid token
expired token
wrong role
wrong resource owner
replayed request
```

### Concurrency tests

Especially important for:

```text
job acceptance
booking confirmation
payment operations
```

---

# 69. Security Test Example

A critical test:

```text
Given:
Customer A owns Service Request A

When:
Customer B requests Service Request A

Then:
HTTP 403/404 according to endpoint policy

And:
No request data is returned
```

Another:

```text
Given:
Worker A is assigned to Job A

When:
Worker B attempts to start Job A

Then:
Request is rejected
Job remains unchanged
Audit/security event is recorded where appropriate
```

---

# 70. Security Headers

Production API responses should use appropriate security headers.

Depending on deployment:

```text
Strict-Transport-Security
X-Content-Type-Options
Content-Security-Policy
Referrer-Policy
```

The exact header set depends on whether the service is API-only, web-serving, or behind a gateway.

---

# 71. HTTPS

Production authentication must use HTTPS.

Never transmit OTPs or bearer tokens over plaintext HTTP in production.

Local development may use HTTP depending on environment, but production must enforce secure transport.

---

# 72. Sensitive Data in URLs

Avoid putting sensitive information into URLs.

Bad:

```text
/api/users?otp=482931
```

Bad:

```text
/api/payment?token=...
```

Sensitive credentials belong in request bodies or headers as appropriate.

URLs can appear in:

```text
browser history
proxy logs
server logs
analytics
```

---

# 73. API Gateway Future Compatibility

The modular monolith may later become:

```text
API Gateway
      ↓
Identity Service
Worker Service
Booking Service
Payment Service
...
```

The identity architecture should therefore avoid assumptions that:

```text
all requests originate from one JVM
```

However, we should **not** introduce a gateway or identity microservice during the MVP unless there is a concrete requirement.

---

# 74. What We Are Not Building Yet

Do not implement unnecessarily:

```text
OAuth provider ecosystem
social login
passkeys
biometric authentication
SSO
full IAM platform
multi-region identity replication
dedicated identity microservice
service mesh authentication
complex RBAC administration UI
```

These may become useful later.

The MVP needs a secure identity foundation, not an enterprise IAM platform.

---

# 75. Laravel → Spring Security Mental Mapping

Since the project is also intended to move your backend skills from Laravel to Spring Boot, the conceptual mapping is useful.

| Laravel          | Spring Boot                               |
| ---------------- | ----------------------------------------- |
| Middleware       | Filter / Security Filter Chain            |
| Sanctum/Passport | Spring Security + token strategy          |
| `auth()`         | SecurityContext / authenticated principal |
| Gates/Policies   | Authorization rules / method security     |
| Form Request     | DTO validation / Bean Validation          |
| Middleware auth  | Spring Security                           |
| Service class    | Application service                       |
| Model events     | Domain/application events                 |
| Queue            | Spring events initially / messaging later |
| Cache/Redis      | Spring Data Redis                         |
| Eloquent model   | JPA persistence model                     |
| Policy           | Authorization/business policy             |

The important lesson is:

> Do not try to reproduce Laravel architecture inside Spring Boot.

Use Spring's architecture properly.

---

# 76. Final Authentication Architecture

The complete MVP security flow becomes:

```text
                    CLIENT
                      │
                      ▼
              ┌───────────────┐
              │ Spring Security│
              └───────┬───────┘
                      │
                Access Token
                      │
                      ▼
              Authenticated User
                      │
                      ▼
              Application Layer
                      │
          ┌───────────┴───────────┐
          │                       │
    Authorization             Use Case
          │                       │
          └───────────┬───────────┘
                      ▼
                   Domain
                      │
                 State Rules
                      │
                      ▼
                 PostgreSQL
```

Supporting infrastructure:

```text
                 ┌──────────┐
                 │  Redis   │
                 └────┬─────┘
                      │
          ┌───────────┼────────────┐
          │           │            │
         OTP       Rate Limit   Temporary State


                 ┌──────────────┐
                 │ SMS Provider │
                 └──────────────┘
```

---

# 77. Final Security Decisions

For the current architecture:

### Authentication

```text
MVP: Email + password (ADR 0016)
Later: Phone + OTP, once an SMS provider is in place
```

### Access

```text
Short-lived bearer access token
```

### Session renewal

```text
Server-side refresh session
```

### Refresh security

```text
Refresh token rotation
```

### Identity source of truth

```text
PostgreSQL
```

### Temporary authentication state

```text
Redis
```

### Authorization

```text
Role-based + resource-based + domain rules
```

### Customer authorization

```text
Own resources only
```

### Worker authorization

```text
Own profile + assigned/eligible resources
```

### Admin authorization

```text
Explicit privileged operations
```

### Sensitive operations

```text
Step-up authentication where required
```

### Audit

```text
Security + administrative events
```

### Secrets

```text
Environment/secret manager
```

### Production transport

```text
HTTPS
```

---

# 78. Security Design Rules

The project should follow these rules throughout implementation:

1. Never trust IDs supplied by clients.
2. Never rely on frontend authorization.
3. Authentication does not imply authorization.
4. Roles do not replace ownership checks.
5. Domain rules do not belong in controllers.
6. Business rules do not belong in JWT filters.
7. Never store plaintext OTPs.
8. Never store raw refresh tokens if avoidable.
9. Never log credentials.
10. Keep access tokens short-lived.
11. Make refresh sessions revocable.
12. Rate-limit authentication endpoints.
13. Protect against OTP enumeration.
14. Protect sensitive operations with step-up authentication where required.
15. Preserve audit history.
16. Do not expose unnecessary location or personal information.
17. Never put secrets in Git.
18. Test authorization failures, not only successful requests.
19. Treat account suspension separately from authentication.
20. Keep security infrastructure independent from the domain model.

---

# 79. Open Decisions

These should remain explicit decisions rather than assumptions:

* Exact OTP lifetime
* Exact OTP request/verification limits
* SMS provider
* JWT vs another signed-token implementation
* Exact access-token lifetime
* Refresh-token lifetime
* Refresh-token reuse detection policy
* Session retention period
* Phone-number recovery process
* Device/session UI
* Exact admin permission model
* Exact location privacy rules
* Whether certain sensitive operations require step-up authentication
* Production secret-management provider
* Whether additional authentication methods will eventually be supported.

These should be decided when the corresponding implementation or deployment requirement appears.

---

# 80. What This Gives Us

At this point the architecture has separated:

```text
Identity
    ↓
Authentication
    ↓
Authorization
    ↓
Business authorization
    ↓
Domain invariants
```

That separation is extremely important.

For example:

```text
"Can this person access the API?"
```

is an authentication/security question.

```text
"Can this customer access this booking?"
```

is an authorization question.

```text
"Can this worker start this job?"
```

is authorization + business state validation.

```text
"Can this job move from ARRIVED to WORK_STARTED?"
```

is a domain invariant.

Those should not become one giant `if` statement inside a controller.

---

# 81. Next Document

The next document should move from **identity/security** into one of the most important technical parts of this product:

## [modules/01](../modules/01-matching-engine-and-geospatial-discovery.md) — Matching Engine & Geospatial Discovery Design

It will define:

```text
Service Request
       ↓
Candidate Discovery
       ↓
PostGIS
       ↓
Skill Filtering
       ↓
Availability Filtering
       ↓
Distance Calculation
       ↓
Candidate Ranking
       ↓
Worker Offers
       ↓
Accept/Reject
       ↓
Booking
```

It will also cover:

* PostGIS `geography`
* `ST_DWithin`
* spatial indexes
* worker location representation
* service areas
* search radius
* candidate eligibility
* distance vs travel time
* matching score
* availability
* concurrent worker acceptance
* duplicate matching
* match expiration
* retry rounds
* Redis's role
* eventual matching architecture
* why we should **not** start with AI/ML matching
* future scaling to millions of workers/requests
* realistic electrician/plumber scenarios
* Java/Spring implementation boundaries.
