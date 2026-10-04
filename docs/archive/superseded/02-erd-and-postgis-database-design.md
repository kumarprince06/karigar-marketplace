# ERD & Database Design

**Project:** Karigar Marketplace
**Initial Market:** Howrah/Kolkata
**Database:** PostgreSQL + PostGIS
**Architecture:** Modular Monolith
**Status:** Draft for Database & Engineering Review

---

# 1. Purpose

This document converts the domain model from [archive/01](01-domain-model-and-state-machines.md) into a relational database design.

The database must support:

* Customers
* Workers
* Skills
* Worker verification
* Worker availability
* Geographic matching
* Service requests
* Worker matching
* Bookings
* Jobs
* Additional work
* Payments
* Reviews
* Disputes
* Notifications
* Audit history

The design must also support:

* transactional consistency
* concurrent operations
* geographic queries
* historical records
* idempotent payment operations
* future scaling
* clean module ownership

The primary database will be:

```text
PostgreSQL
      +
PostGIS
```

---

# 2. Database Design Principles

The database should follow these principles.

### 2.1 PostgreSQL is the source of truth

Permanent business state belongs in PostgreSQL.

Redis is not the source of truth for:

* bookings
* jobs
* payments
* reviews
* disputes
* worker accounts

---

### 2.2 Use relational integrity

Where a relationship is mandatory, use:

```text
FOREIGN KEY
NOT NULL
UNIQUE
CHECK
```

rather than relying only on application code.

---

### 2.3 Preserve business history

Do not delete important transactional records simply because a user is deactivated.

For example:

```text
Worker deactivated
        ↓
Historical jobs remain
Historical payments remain
Historical reviews remain
Historical disputes remain
```

---

### 2.4 Avoid giant tables

Don't create one table such as:

```text
transactions
```

containing:

```text
request
booking
job
payment
review
dispute
```

These are separate business concepts and should remain separate.

---

# 3. High-Level ERD

The initial relational model:

```text
┌──────────────┐
│    users     │
└──────┬───────┘
       │
 ┌─────┴──────────────┐
 │                    │
 ▼                    ▼
customers          workers
 │                    │
 │                    ├──── worker_skills ──── skills
 │                    │
 │                    ├──── verifications
 │                    │
 │                    ├──── availability
 │                    │
 │                    └──── service_areas
 │
 └──── customer_addresses
             │
             │
             ▼
      service_requests
             │
             ├──── worker_matches ──── workers
             │
             ▼
          bookings
             │
             ▼
            jobs
          /  |  \
         /   |   \
        ▼    ▼    ▼
 additional  payments  reviews
    work
             │
             ▼
          disputes
```

Supporting tables:

```text
notifications
audit_events
idempotency_keys
media
```

---

# 4. ID Strategy

All major business entities should use generated identifiers.

Recommended initial approach:

```text
UUID
```

Example:

```text
550e8400-e29b-41d4-a716-446655440000
```

Benefits:

* safe to expose through APIs
* difficult to enumerate
* suitable for distributed systems later
* no dependency on database sequence values

For high-scale systems, UUIDv7 can also be considered because it provides better time ordering than traditional random UUIDv4.

**Decision:** use UUID-based identifiers, with the exact UUID generation strategy finalized during implementation.

---

# 5. Common Columns

Most major tables should have:

```text
id
created_at
updated_at
```

Example:

```text
id UUID PRIMARY KEY
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

Not every table needs every common column.

For example, append-only events may only need:

```text
id
created_at
```

---

# 6. Time Handling

Use:

```text
TIMESTAMPTZ
```

for timestamps.

Store timestamps in UTC.

Example:

```text
2026-09-28T04:30:00Z
```

The application can display:

```text
India Standard Time
```

to users.

Avoid storing business timestamps as:

```text
VARCHAR
```

or local-time-only values.

---

# 7. users

Represents platform identity.

```text
users
--------------------------------
id                  UUID PK
phone               VARCHAR UNIQUE
phone_verified_at   TIMESTAMPTZ NULL
email               VARCHAR NULL
status              VARCHAR
last_login_at       TIMESTAMPTZ NULL
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

Potential status values:

```text
ACTIVE
SUSPENDED
DEACTIVATED
```

---

# 8. customers

Customer-specific profile.

```text
customers
--------------------------------
id                  UUID PK
user_id             UUID FK UNIQUE
display_name        VARCHAR
profile_photo_id    UUID NULL
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

Relationship:

```text
users 1 ───────── 1 customers
```

A customer cannot exist without a user account.

---

# 9. workers

Professional worker profile.

```text
workers
--------------------------------
id                      UUID PK
user_id                 UUID FK UNIQUE
profession_id           UUID FK
display_name            VARCHAR
bio                     TEXT NULL
experience_years        SMALLINT
profile_photo_id        UUID NULL
status                  VARCHAR
accepting_jobs          BOOLEAN
base_location           GEOGRAPHY(Point, 4326)
created_at              TIMESTAMPTZ
updated_at              TIMESTAMPTZ
```

Possible worker status:

```text
PENDING_VERIFICATION
ACTIVE
SUSPENDED
DEACTIVATED
```

Important:

```text
worker.status
        ≠
worker.accepting_jobs
```

---

# 10. professions

Controlled catalog of professions.

```text
professions
--------------------------------
id              UUID PK
code            VARCHAR UNIQUE
name            VARCHAR UNIQUE
description     TEXT
active          BOOLEAN
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

Examples:

```text
ELECTRICIAN
PLUMBER
```

Later:

```text
CARPENTER
PAINTER
AC_TECHNICIAN
```

---

# 11. skills

Platform-defined worker skills.

```text
skills
--------------------------------
id              UUID PK
profession_id   UUID FK
code            VARCHAR UNIQUE
name            VARCHAR
description     TEXT
active          BOOLEAN
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

Relationship:

```text
profession
    │
    ├── skill
    ├── skill
    └── skill
```

Example:

```text
Electrician
 ├── FAN_INSTALLATION
 ├── WIRING_REPAIR
 ├── SWITCH_REPAIR
 └── MCB_REPLACEMENT
```

---

# 12. worker_skills

Many-to-many relationship between workers and skills.

```text
worker_skills
--------------------------------
worker_id       UUID FK
skill_id        UUID FK
verification_status VARCHAR
years_experience SMALLINT NULL
created_at      TIMESTAMPTZ

PRIMARY KEY(worker_id, skill_id)
```

Relationship:

```text
workers N ───── N skills
```

through:

```text
worker_skills
```

---

# 13. verifications

Represents verification activities.

```text
verifications
--------------------------------
id                  UUID PK
worker_id           UUID FK
type                VARCHAR
status              VARCHAR
provider            VARCHAR NULL
reference           VARCHAR NULL
verified_at         TIMESTAMPTZ NULL
expires_at          TIMESTAMPTZ NULL
rejected_reason     TEXT NULL
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

Types:

```text
IDENTITY
PHONE
SKILL
CERTIFICATION
BACKGROUND
```

Statuses:

```text
PENDING
VERIFIED
REJECTED
EXPIRED
REVOKED
```

---

# 14. customer_addresses

Saved customer locations.

```text
customer_addresses
--------------------------------
id                  UUID PK
customer_id         UUID FK
label               VARCHAR
address_line        TEXT
locality            VARCHAR
city                VARCHAR
state               VARCHAR
postal_code         VARCHAR
location            GEOGRAPHY(Point, 4326)
is_default          BOOLEAN
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

PostGIS location:

```text
GEOGRAPHY(Point, 4326)
```

is appropriate for distance calculations in meters.

---

# 15. worker_service_areas

Represents areas in which a worker accepts jobs.

There are multiple ways to model this.

Initial approach:

```text
worker_service_areas
--------------------------------
id                  UUID PK
worker_id           UUID FK
center              GEOGRAPHY(Point, 4326)
radius_meters       INTEGER
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

Example:

```text
Worker base:
Shibpur

Service radius:
8000 meters
```

Later we could support polygon-based service zones.

---

# 16. worker_availability

Worker schedule/configuration.

```text
worker_availability
--------------------------------
id                  UUID PK
worker_id           UUID FK
day_of_week         SMALLINT
start_time          TIME
end_time            TIME
active              BOOLEAN
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

Example:

```text
Monday
09:00
18:00
```

Real-time availability should not necessarily be derived only from this table.

A worker may be:

```text
Scheduled:
09:00 - 18:00

Current state:
NOT_ACCEPTING_JOBS
```

---

# 17. service_requests

Represents customer demand.

```text
service_requests
--------------------------------
id                  UUID PK
customer_id         UUID FK
profession_id       UUID FK
description         TEXT
location            GEOGRAPHY(Point, 4326)
address_snapshot    JSONB
preferred_start     TIMESTAMPTZ
preferred_end       TIMESTAMPTZ
urgency             VARCHAR
status              VARCHAR
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
submitted_at        TIMESTAMPTZ NULL
cancelled_at        TIMESTAMPTZ NULL
completed_at        TIMESTAMPTZ NULL
```

---

# 18. Why Store address_snapshot?

Suppose the customer later changes their saved address.

The historical job must still know:

> Where was this service requested?

Therefore, transactional records should preserve a snapshot.

Example:

```json
{
  "address_line": "Example Road",
  "locality": "Shibpur",
  "city": "Howrah",
  "postal_code": "711102"
}
```

This is different from using the customer's current saved address.

---

# 19. Service Request Location

The request should store its own location:

```text
location GEOGRAPHY(Point, 4326)
```

because matching should be performed against:

```text
Service Request Location
```

rather than:

```text
Customer's current location
```

The worker is going to the requested service location.

---

# 20. service_request_media

Customer-uploaded photos/videos.

```text
service_request_media
--------------------------------
id                  UUID PK
service_request_id  UUID FK
media_type          VARCHAR
storage_key         TEXT
mime_type           VARCHAR
file_size           BIGINT
created_at          TIMESTAMPTZ
```

Actual files should not be stored inside PostgreSQL.

Use object storage such as:

```text
S3-compatible storage
```

PostgreSQL stores metadata/reference.

---

# 21. worker_matches

Represents a worker's relationship with a service request during matching.

```text
worker_matches
--------------------------------
id                  UUID PK
service_request_id  UUID FK
worker_id           UUID FK
distance_meters     INTEGER
match_score         NUMERIC NULL
match_reason        JSONB NULL
status              VARCHAR
offered_at          TIMESTAMPTZ
viewed_at           TIMESTAMPTZ NULL
responded_at        TIMESTAMPTZ NULL
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

Possible statuses:

```text
OFFERED
VIEWED
ACCEPTED
REJECTED
EXPIRED
WITHDRAWN
```

---

# 22. Prevent Duplicate Matches

A worker should not accidentally receive multiple active match records for the same request.

Potential constraint:

```text
UNIQUE(service_request_id, worker_id)
```

If we later need multiple matching attempts for the same worker, we can introduce an attempt/version model instead.

For MVP:

```text
UNIQUE(service_request_id, worker_id)
```

is sufficient.

---

# 23. bookings

Represents customer-worker commitment.

```text
bookings
--------------------------------
id                  UUID PK
service_request_id  UUID FK
customer_id         UUID FK
worker_id           UUID FK
scheduled_start     TIMESTAMPTZ
scheduled_end       TIMESTAMPTZ NULL
status              VARCHAR
confirmed_at        TIMESTAMPTZ NULL
cancelled_at        TIMESTAMPTZ NULL
cancellation_reason TEXT NULL
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

---

# 24. Booking Consistency

For MVP:

```text
One service request
        ↓
One active/confirmed booking
```

We should enforce this at the database/application transaction level.

A simple unique constraint may not be sufficient if cancelled bookings remain historically.

Possible approach:

```text
Partial unique index
```

conceptually:

```sql
UNIQUE(service_request_id)
WHERE status IN ('PENDING', 'CONFIRMED')
```

The exact PostgreSQL implementation will be finalized during migration design.

---

# 25. jobs

Represents actual service execution.

```text
jobs
--------------------------------
id                  UUID PK
booking_id          UUID FK UNIQUE
status              VARCHAR
en_route_at         TIMESTAMPTZ NULL
arrived_at          TIMESTAMPTZ NULL
started_at          TIMESTAMPTZ NULL
completed_at        TIMESTAMPTZ NULL
worker_no_show_at   TIMESTAMPTZ NULL
customer_no_show_at TIMESTAMPTZ NULL
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

Relationship:

```text
booking 1 ───── 1 job
```

---

# 26. additional_work

Additional work requested during execution.

```text
additional_work
--------------------------------
id                  UUID PK
job_id              UUID FK
worker_id           UUID FK
description         TEXT
amount              NUMERIC(12,2)
status              VARCHAR
proposed_at         TIMESTAMPTZ
responded_at        TIMESTAMPTZ NULL
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

Statuses:

```text
PROPOSED
APPROVED
REJECTED
EXPIRED
```

---

# 27. Money Representation

Avoid:

```text
FLOAT
DOUBLE
```

for monetary amounts.

Use:

```text
NUMERIC(12,2)
```

Example:

```text
500.00
```

Currency should be explicit.

Potentially:

```text
amount NUMERIC(12,2)
currency CHAR(3)
```

Example:

```text
500.00
INR
```

---

# 28. payments

Represents financial transactions.

```text
payments
--------------------------------
id                  UUID PK
job_id              UUID FK
customer_id         UUID FK
worker_id           UUID FK
amount              NUMERIC(12,2)
currency            CHAR(3)
status              VARCHAR
provider            VARCHAR
provider_payment_id VARCHAR NULL
idempotency_key     VARCHAR
paid_at             TIMESTAMPTZ NULL
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

---

# 29. Payment Provider Data

Do not expose provider-specific database structures throughout the application.

For example:

```text
StripePaymentIntent
PaystackTransaction
```

should remain provider-specific infrastructure concepts.

Our domain sees:

```text
Payment
```

with:

```text
INITIATED
PENDING
SUCCESS
FAILED
REFUNDED
PARTIALLY_REFUNDED
```

---

# 30. payment_transactions

For complex payment systems, a single `payments` row may eventually be insufficient.

A more scalable model can include:

```text
payments
payment_transactions
refunds
```

For MVP, we can keep the first implementation simpler while ensuring the schema can evolve.

Recommended direction:

```text
payments
   │
   ├── provider transaction
   ├── refund
   └── adjustment
```

We should finalize this before implementing real payment flows.

---

# 31. reviews

Customer feedback about a completed job.

```text
reviews
--------------------------------
id                  UUID PK
job_id              UUID FK
customer_id         UUID FK
worker_id           UUID FK
rating              SMALLINT
comment             TEXT NULL
status              VARCHAR
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

Constraint:

```text
rating BETWEEN 1 AND 5
```

For MVP:

```text
UNIQUE(job_id, customer_id)
```

This prevents duplicate reviews for the same transaction.

---

# 32. disputes

```text
disputes
--------------------------------
id                  UUID PK
job_id              UUID FK
opened_by_user_id   UUID FK
reason              VARCHAR
description         TEXT
status              VARCHAR
resolution          VARCHAR NULL
resolution_notes    TEXT NULL
resolved_by         UUID NULL
opened_at           TIMESTAMPTZ
resolved_at         TIMESTAMPTZ NULL
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

---

# 33. dispute_evidence

Evidence should be separate from the dispute.

```text
dispute_evidence
--------------------------------
id                  UUID PK
dispute_id          UUID FK
submitted_by        UUID FK
type                VARCHAR
storage_key         TEXT NULL
description         TEXT NULL
created_at          TIMESTAMPTZ
```

This allows multiple pieces of evidence.

---

# 34. notifications

```text
notifications
--------------------------------
id                  UUID PK
user_id             UUID FK
type                VARCHAR
title               VARCHAR
body                TEXT
data                JSONB
channel             VARCHAR
status              VARCHAR
sent_at             TIMESTAMPTZ NULL
read_at             TIMESTAMPTZ NULL
created_at          TIMESTAMPTZ
```

Channels may include:

```text
IN_APP
PUSH
SMS
EMAIL
WHATSAPP
```

---

# 35. audit_events

Audit information should be append-oriented.

```text
audit_events
--------------------------------
id                  UUID PK
actor_user_id       UUID NULL
action              VARCHAR
entity_type         VARCHAR
entity_id           UUID
metadata            JSONB
ip_address          INET NULL
user_agent          TEXT NULL
created_at          TIMESTAMPTZ
```

Examples:

```text
WORKER_VERIFICATION_APPROVED
WORKER_SUSPENDED
PAYMENT_REFUNDED
DISPUTE_RESOLVED
BOOKING_CANCELLED_BY_ADMIN
```

---

# 36. idempotency_keys

Important for payment and other retry-sensitive operations.

```text
idempotency_keys
--------------------------------
id                  UUID PK
user_id             UUID FK
key                 VARCHAR
request_hash        VARCHAR
response_status     INTEGER
response_body       JSONB
expires_at          TIMESTAMPTZ
created_at          TIMESTAMPTZ
```

Unique constraint:

```text
UNIQUE(user_id, key)
```

This prevents accidental duplicate operations.

---

# 37. PostGIS Strategy

The main geographic columns should use:

```text
GEOGRAPHY(Point, 4326)
```

rather than storing:

```text
latitude DOUBLE
longitude DOUBLE
```

only.

For example:

```text
service_requests.location
workers.base_location
customer_addresses.location
worker_service_areas.center
```

This lets PostgreSQL/PostGIS efficiently perform:

```text
distance
within radius
nearest worker
geographic filtering
```

---

# 38. Geographic Indexes

Use GiST indexes.

Example conceptually:

```sql
CREATE INDEX idx_workers_base_location
ON workers
USING GIST (base_location);
```

Similarly:

```text
service_requests.location
customer_addresses.location
worker_service_areas.center
```

should receive appropriate spatial indexes.

---

# 39. Example Matching Query

A basic worker search might conceptually be:

```sql
SELECT
    id,
    ST_Distance(
        base_location,
        :request_location
    ) AS distance
FROM workers
WHERE
    status = 'ACTIVE'
    AND accepting_jobs = true
    AND ST_DWithin(
        base_location,
        :request_location,
        :radius_meters
    )
ORDER BY distance
LIMIT :limit;
```

The real production query will additionally filter by:

```text
profession
skills
verification
availability
service area
worker status
```

---

# 40. Important Indexes

Initial indexes should include:

### users

```text
UNIQUE(phone)
```

### workers

```text
UNIQUE(user_id)
INDEX(status)
INDEX(profession_id)
INDEX(accepting_jobs)
GIST(base_location)
```

### worker_skills

```text
PRIMARY KEY(worker_id, skill_id)
INDEX(skill_id)
```

### service_requests

```text
INDEX(customer_id)
INDEX(status)
INDEX(profession_id)
INDEX(preferred_start)
GIST(location)
```

### worker_matches

```text
UNIQUE(service_request_id, worker_id)
INDEX(worker_id, status)
INDEX(service_request_id, status)
```

### bookings

```text
INDEX(customer_id, status)
INDEX(worker_id, status)
INDEX(scheduled_start)
```

### jobs

```text
UNIQUE(booking_id)
INDEX(status)
```

### payments

```text
INDEX(customer_id)
INDEX(worker_id)
INDEX(job_id)
INDEX(status)
UNIQUE(provider, provider_payment_id)
```

### reviews

```text
INDEX(worker_id)
INDEX(customer_id)
UNIQUE(job_id, customer_id)
```

### disputes

```text
INDEX(job_id)
INDEX(status)
INDEX(opened_by_user_id)
```

---

# 41. Foreign Key Strategy

Use foreign keys for business relationships.

Example:

```text
workers.user_id
        ↓
users.id
```

and:

```text
service_requests.customer_id
        ↓
customers.id
```

This prevents orphan records.

---

# 42. Delete Strategy

Avoid cascading deletes on major transactional relationships.

For example, deleting:

```text
worker
```

should not automatically delete:

```text
jobs
payments
reviews
disputes
```

Instead:

```text
worker.status = DEACTIVATED
```

Historical records remain.

For dependent non-transactional records such as temporary media or configuration records, cascading deletion can be considered where appropriate.

---

# 43. Soft Delete

Do not automatically put:

```text
deleted_at
```

on every table.

Soft deletion is useful when business requirements actually require it.

For major user/worker records, explicit lifecycle states are generally clearer:

```text
ACTIVE
SUSPENDED
DEACTIVATED
```

For transactional records:

```text
DO NOT DELETE
```

should usually be the default.

---

# 44. JSONB Usage

JSONB is useful, but should not replace relational modeling.

Good uses:

```text
address_snapshot
match_reason
notification_data
audit_metadata
provider_metadata
```

Bad use:

```text
worker.profile = {
   name: ...,
   skills: [...],
   availability: [...],
   location: ...
}
```

If data is queried, constrained, related, or business-critical, it generally belongs in structured columns/tables.

---

# 45. Database Module Ownership

Each application module should primarily own its tables.

Conceptually:

```text
identity
 └── users

customer
 ├── customers
 └── customer_addresses

worker
 ├── workers
 ├── worker_skills
 ├── worker_service_areas
 ├── worker_availability
 └── verifications

catalog
 ├── professions
 └── skills

service_request
 └── service_requests
 └── service_request_media

matching
 └── worker_matches

booking
 └── bookings

job
 ├── jobs
 └── additional_work

payment
 └── payments

review
 └── reviews

dispute
 ├── disputes
 └── dispute_evidence

notification
 └── notifications

admin/shared
 ├── audit_events
 └── idempotency_keys
```

This ownership becomes important when we later structure the Java packages.

---

# 46. Cross-Module Foreign Keys

Because this is a modular monolith, modules still share one PostgreSQL database initially.

Therefore relationships such as:

```text
booking.worker_id
```

can reference:

```text
workers.id
```

However, application code should still respect module boundaries.

For example:

```text
booking
```

should not directly manipulate:

```text
worker internal state
```

without going through an appropriate application/domain contract.

This gives us the benefits of a modular architecture while retaining the simplicity of one database.

---

# 47. Transaction Boundaries

Some operations require a single database transaction.

Example:

```text
Confirm Booking
```

may require:

```text
1. Check request
2. Check worker
3. Ensure no competing confirmed booking
4. Create booking
5. Update request state
6. Record relevant event
```

These operations should be protected by one appropriate transaction boundary.

---

# 48. Concurrency Example

Imagine:

```text
Request #123
```

is offered to:

```text
Worker A
Worker B
Worker C
```

Worker A and Worker B accept almost simultaneously.

Without concurrency protection:

```text
Worker A → confirmed
Worker B → confirmed
```

which violates:

```text
One request → one confirmed worker
```

The database must help enforce this invariant.

Possible mechanisms:

```text
row locking
optimistic locking
unique constraints
transaction isolation
```

The exact strategy will be finalized during implementation.

---

# 49. Optimistic Locking

Entities that may be concurrently updated can include a version field:

```text
version BIGINT
```

For example:

```text
bookings.version
```

or:

```text
service_requests.version
```

The application can detect:

```text
record changed since it was read
```

and prevent lost updates.

---

# 50. Migration Strategy

Use a database migration framework such as:

```text
Flyway
```

or:

```text
Liquibase
```

For this project, Flyway is a straightforward initial choice.

Conceptually:

```text
db/migration/

V1__create_users.sql
V2__create_customers.sql
V3__create_workers.sql
V4__create_catalog.sql
V5__create_service_requests.sql
V6__create_matching.sql
V7__create_bookings.sql
V8__create_jobs.sql
V9__create_payments.sql
...
```

Migrations should be versioned and committed to Git.

Never rely on manually modifying production databases.

---

# 51. Database Environment Strategy

Development:

```text
PostgreSQL
PostGIS
```

Testing:

```text
Testcontainers PostgreSQL + PostGIS
```

Production:

```text
Managed PostgreSQL
PostGIS enabled
```

Local development can run through Docker Compose.

---

# 52. Database Schemas

There are two possible approaches.

### Option A

Everything in:

```text
public
```

### Option B

Separate PostgreSQL schemas:

```text
identity.users
worker.workers
booking.bookings
payment.payments
```

For the initial modular monolith, I recommend starting with the standard `public` schema while enforcing **logical module ownership in application code**.

Separate PostgreSQL schemas can be introduced if they provide a concrete benefit.

We should not add database complexity purely for appearance.

---

# 53. Initial ERD — Simplified

```text
                                  ┌─────────────┐
                                  │    users    │
                                  └──────┬──────┘
                                         │
                         ┌───────────────┴───────────────┐
                         │                               │
                         ▼                               ▼
                  ┌─────────────┐                 ┌─────────────┐
                  │  customers  │                 │   workers   │
                  └──────┬──────┘                 └──────┬──────┘
                         │                               │
                         │                         ┌─────┼─────────┐
                         │                         │     │         │
                         ▼                         ▼     ▼         ▼
                customer_addresses          worker_skills    availability
                                                   │
                                                   ▼
                                                 skills
                                                   │
                                                   ▼
                                              professions


customers
    │
    ▼
service_requests
    │
    ├─────────────── worker_matches ─────────────── workers
    │
    ▼
bookings
    │
    ▼
jobs
 ┌──┼───────────────┐
 │  │               │
 ▼  ▼               ▼
additional_work   payments   reviews
                     │
                     ▼
                  disputes
```

---

# 54. Full Initial Table Inventory

The initial database is expected to contain approximately:

```text
Identity
├── users

Customer
├── customers
└── customer_addresses

Worker
├── workers
├── worker_skills
├── worker_service_areas
├── worker_availability
└── verifications

Catalog
├── professions
└── skills

Service Request
├── service_requests
└── service_request_media

Matching
└── worker_matches

Booking
└── bookings

Job
├── jobs
└── additional_work

Payment
└── payments

Review
└── reviews

Dispute
├── disputes
└── dispute_evidence

Notification
└── notifications

Platform
├── audit_events
└── idempotency_keys
```

This is a reasonable starting point.

It is **not** a sign that the system is over-engineered.

Each table represents a distinct business concept or supporting concern.

---

# 55. Data That Should Be Immutable or History-Preserving

Certain data should be treated carefully.

### Immutable / append-oriented

```text
payments
audit_events
review submissions
dispute evidence
important verification decisions
```

### Mutable configuration/profile data

```text
worker profile
customer profile
availability
service areas
saved addresses
```

### State-changing transactional data

```text
service requests
matches
bookings
jobs
payments
disputes
```

The application should preserve important transition timestamps.

For example:

```text
confirmed_at
arrived_at
started_at
completed_at
cancelled_at
```

These are more valuable than simply overwriting:

```text
updated_at
```

---

# 56. Why Transition Timestamps Matter

Suppose a customer says:

> "The worker arrived 45 minutes late."

We should be able to determine:

```text
Scheduled:
18:00

En route:
18:02

Arrived:
18:47
```

This is why business timestamps should be preserved.

The same principle applies to:

```text
payment
matching
cancellation
dispute
verification
```

---

# 57. Reputation Data

We should **not** create only:

```text
workers.rating = 4.8
```

as the source of truth.

Instead:

```text
reviews
   │
   ├── rating
   ├── job
   ├── customer
   └── worker
```

can later be aggregated into:

```text
worker reputation summary
```

For example:

```text
completed_jobs
average_rating
rating_count
repeat_customer_count
cancellation_rate
```

A cached summary can be introduced later for performance.

The underlying records remain authoritative.

---

# 58. Database as Source of Truth vs Cache

### PostgreSQL

Authoritative for:

```text
Users
Workers
Requests
Bookings
Jobs
Payments
Reviews
Disputes
```

### Redis

Useful for:

```text
OTP
rate limits
temporary locks
short-lived cache
temporary availability signals
matching coordination
```

Never make:

```text
Redis worker booking state
```

the permanent source of truth.

---

# 59. Expected Initial Scale Strategy

The database design should initially target a single PostgreSQL primary.

Architecture:

```text
                    Application
                         │
                         ▼
                  PostgreSQL
                    + PostGIS
                         │
                    ┌────┴────┐
                    │         │
                  Redis    Object Storage
```

When traffic grows:

```text
                 Application
                 /    |    \
                /     |     \
          Instance  Instance  Instance
                \     |     /
                 PostgreSQL
                     │
             ┌───────┴────────┐
             │                │
          Primary          Read Replica
```

We don't need sharding initially.

---

# 60. Tables We May Add Later

As the business evolves, we may introduce:

```text
worker_documents
worker_certifications
worker_payout_accounts
worker_earnings
worker_wallets
payment_refunds
payment_adjustments
service_request_events
booking_events
job_events
worker_locations
customer_favorites
repeat_bookings
promotions
coupons
pricing_rules
service_zones
```

These should not be added until the corresponding business requirements are confirmed.

---

# 61. Important Database Decisions Still Open

The following should **not** be silently finalized yet.

### ID format

UUIDv4 vs UUIDv7.

### Worker location

How frequently should current worker location be stored?

### Service area

Radius-based vs polygon-based.

### Availability

Schedule-only vs real-time availability state + schedule.

### Pricing

Where should quote/price data live?

### Payment

Whether one job can have multiple payment attempts/transactions.

### Earnings

Whether worker earnings should be modeled separately from payment.

### Event history

Whether important state transitions need dedicated event tables.

### Database schemas

Single `public` schema vs module-specific PostgreSQL schemas.

### Partitioning

Whether high-volume tables such as:

```text
audit_events
notifications
```

eventually require partitioning.

These decisions should be based on actual requirements and observed scale.

---

# 62. Final Database Architecture

The initial production-oriented database architecture is:

```text
                    ┌──────────────────────┐
                    │      Spring Boot     │
                    │    Modular Monolith  │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ PostgreSQL + PostGIS │
                    └──────────┬───────────┘
                               │
       ┌───────────────────────┼────────────────────────┐
       │                       │                        │
       ▼                       ▼                        ▼
 Identity / Users        Marketplace             Transactions
       │                       │                        │
       │               ┌───────┼────────┐       ┌──────┼──────┐
       │               │       │        │       │      │      │
       ▼               ▼       ▼        ▼       ▼      ▼      ▼
 Customers          Requests Matches Bookings  Jobs Payments Reviews
 Workers
       │
       ├── Skills
       ├── Verification
       ├── Availability
       └── Service Areas

                    Supporting Systems
                           │
                 ┌─────────┼─────────┐
                 ▼         ▼         ▼
               Redis     Object    Notifications
                         Storage
```

---

# 63. Final Database Principles

The database should follow these rules:

1. **PostgreSQL + PostGIS is the primary source of truth.**
2. **Use UUID-based IDs.**
3. **Use `TIMESTAMPTZ` for timestamps.**
4. **Use `NUMERIC` for money.**
5. **Use PostGIS `GEOGRAPHY` for geographic coordinates.**
6. **Use spatial indexes for location queries.**
7. **Keep request, match, booking, job, and payment separate.**
8. **Preserve historical transactional data.**
9. **Don't soft-delete everything automatically.**
10. **Use relational constraints wherever possible.**
11. **Use JSONB only for genuinely flexible data.**
12. **Use database constraints together with application-level validation.**
13. **Protect concurrency-sensitive operations transactionally.**
14. **Use migrations for every schema change.**
15. **Don't introduce sharding or partitioning before there is a demonstrated need.**
16. **Keep module ownership clear even though the application uses one database.**
17. **Design the schema so individual modules could eventually be extracted without forcing microservices today.**

---

# 64. Database-to-Domain Mapping

The current mapping is:

```text
DOMAIN                         DATABASE

User                     →     users
Customer                 →     customers
Worker                   →     workers
Profession               →     professions
Skill                    →     skills
Worker Skill             →     worker_skills
Verification             →     verifications
Address                  →     customer_addresses
Service Area             →     worker_service_areas
Availability             →     worker_availability

Service Request          →     service_requests
Request Media            →     service_request_media
Worker Match             →     worker_matches

Booking                  →     bookings
Job                      →     jobs
Additional Work          →     additional_work

Payment                  →     payments
Review                   →     reviews
Dispute                  →     disputes
Dispute Evidence         →     dispute_evidence

Notification             →     notifications
Audit Event              →     audit_events
Idempotency Key          →     idempotency_keys
```

This mapping gives us a strong foundation for the next architectural decisions.

---

# 65. Current Project Foundation

At this point we have established:

```text
                    PRODUCT
                       │
                       ▼
               Business Requirements
                       │
                       ▼
                  DOMAIN MODEL
                       │
                       ▼
                  STATE MACHINES
                       │
                       ▼
                 DATABASE / ERD
                       │
                       ▼
              ┌────────┴────────┐
              │                 │
              ▼                 ▼
          ARCHITECTURE      PROJECT STRUCTURE
              │                 │
              └────────┬────────┘
                       ▼
                  API CONTRACTS
```

The next step is therefore not to start coding.

We should first formalize how these database/domain boundaries map into the **Java/Spring Boot production project structure**.

That will become the foundation for implementation.
