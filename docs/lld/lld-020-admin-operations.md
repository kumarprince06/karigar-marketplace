# LLD-020: Admin Staff, Permissions, Account Actions and Ops Queues

| Field | Value |
|---|---|
| Status | Draft |
| Owner | TBD |
| Reviewers | TBD |
| Module | `admin` (+ `shared.audit` writer) |
| Parent HLD | [modules/11](../modules/11-admin-and-marketplace-operations.md), [architecture/03 §52, §52.1, §52.4](../architecture/03-erd-and-production-database-design.md), [security/01 §29–30](../security/01-authentication-authorization-and-identity.md), [security/02 §21–23, §66](../security/02-threat-model-and-application-security.md), [product/04 §11](../product/04-mvp-scope-release-plan-and-future-phases.md) |
| Requirements | product/04 §11 (MVP admin capabilities), modules/11 §101, security/03 §60 (sensitive access auditing), NFR least privilege |
| Depends on | LLD-001 (`users`, login), LLD-002 (`revokeAll`, deny-list, `AdminLookup` port), LLD-004 (worker suspend / reinstate, `WorkerSuspended`), LLD-005 (`service_zones`), LLD-007 (`account_restrictions`) |
| Used by | Every LLD with `/api/v1/admin/**` endpoints (permission check + audit), LLD-009 (cancels bookings on `WorkerSuspended`), LLD-016 verification, LLD-018 disputes |
| Last updated | 2026-10-05 |

---

## 1. Context & scope

Karigar's ops staff (support, verification, finance, disputes, area managers) work in an internal web app on `/api/v1/admin/**`. This LLD defines **who the staff are, what each may do, and how that is checked on every request**; the account actions that do not belong to any one domain (suspend / reinstate, restrictions); a user lookup that hides PII until a reason is given; the ops queues; and the audit trail every admin action writes.

**In scope**

- Staff accounts, roles, permissions, zone-scoped grants; first super-admin bootstrap
- Admin authentication: same login as everyone (LLD-001/002) **plus TOTP MFA** for every admin call
- Server-side permission check per request; the one permission catalog for all LLDs (§4.1)
- Account actions: suspend / reinstate customer and worker, add / lift admin restrictions
- User lookup with masked PII and an audited "reveal"
- Ops queues as read views over tables other modules already have; ack and outbox retry
- `audit_events` table, shared writer, append-only rule, audit viewer

**Out of scope:** the domain admin actions themselves — catalog (LLD-003), service zones (LLD-005), ledger adjustments (LLD-010), refunds (LLD-011), review moderation (LLD-012), strikes (table in LLD-009; dispute strikes via LLD-018), verification decisions (LLD-016), dispute resolution (LLD-018), payout holds (LLD-019), notification retries (LLD-013). Dashboards and funnels (analytics, modules/12). Exports, bulk actions, support cases, notes (modules/11 §47–48, §96–97 — later).

**Decisions**

| # | Decision | Default (configurable) |
|---|---|---|
| D1 | Staff are normal `users` (LLD-001 email/password) with an `admin_users` row (ERD §52.1). No separate credential store, no SSO (security/01 §74). The JWT only says `ADMIN` (from `AdminLookup.activeRoles`, LLD-002); **permissions are never in the token** — they are loaded from the DB on every admin request. | — |
| D2 | **TOTP MFA (RFC 6238) is required for every admin call**, not only finance / super admin as the ERD minimum says: user lookup alone exposes PII. A verified code opens an *MFA window* for that login (`sid`). | window 12 h; `staff.manage` needs a code in the last 15 min |
| D3 | Roles and permissions are seeded reference data keyed by `code` (like `reason_codes`); changing a role's permissions is a migration, not an API. Staff ↔ role grants are data, via API, audited. | — |
| D4 | A grant may be limited to a `service_zone_id`. A zone-scoped grant counts only on endpoints that carry a zone (service-zone admin, queue filters); every other endpoint needs a global grant. | MVP: all grants global (one city) |
| D5 | **No admin acts on themselves** (own user, own staff row, own roles) and staff accounts are managed only through `/admin/staff` — the customer / worker suspend endpoints refuse a target who is active staff. | — |
| D6 | Worker suspend = worker profile `SUSPENDED` (LLD-004); the worker can still log in to see earnings / dues and check out a visit in progress. `blockLogin: true` (fraud, safety) also suspends the user account. Customer suspend always suspends the user account. Account suspension = `users.status = SUSPENDED` + `revokeAll(SUSPENDED)` + `sid` deny-list (LLD-002 D4). | — |
| D7 | Lookups return PII **masked** (phone `+91******1234`, email `s***@gmail.com`, address = locality + PIN). Full values only via `POST …/reveal` with a reason code; each reveal is an audit event. | 20 reveals / admin / hour |
| D8 | Ops queues are **queries over the owning module's tables**, exposed through one small port per module. No queue tables; one `ops_queue_acks` table for items that have no state of their own to change (e.g. a flagged check-in that was fine). | 200 items per queue read |
| D9 | `audit_events` is written in the **same transaction** as the change by every module (`AuditRecorder`); it is append-only (UPDATE blocked, DELETE only past retention). Metadata holds ids and masked values only, never raw PII, so erasure requests don't touch it. | retention 8 years (security/03) |
| D10 | Every admin command requires a `reasonCode` (ERD §52.4) and accepts a `note` (≤ 500 chars). State-changing admin actions are naturally idempotent (repeating a suspend returns the current state); no `Idempotency-Key` needed here. | — |

---

## 2. Classes / components

```text
com.karigar.admin
├── api/
│   ├── AdminMeController            -- GET /admin/me, MFA enroll / verify
│   ├── StaffController              -- /admin/staff/**                      (staff.manage)
│   ├── UserLookupController         -- /admin/users/**                      (user.view, user.pii.reveal)
│   ├── AccountActionController      -- /admin/customers|workers/{id}/suspend|reinstate, restrictions
│   ├── OpsQueueController           -- /admin/ops/**                        (ops.view, ops.act)
│   ├── AuditController              -- /admin/audit-events                  (audit.view)
│   └── AdminLookup                  -- public API: activeRoles(userId) for LLD-002's RoleResolver
├── application/
│   ├── StaffService                 -- invite, grant / revoke role, suspend / reactivate / left, MFA reset
│   ├── MfaService                   -- enroll, verify (TOTP ±1 step, replay guard), window in Redis
│   ├── AccountActionService         -- suspend / reinstate / restrict / lift; self + staff guards
│   ├── UserLookupService            -- search, detail (masked), reveal
│   ├── OpsQueueService              -- fans out to OpsQueueSource ports, filters acks, counts
│   ├── AdminBootstrap               -- on start-up: grant SUPER_ADMIN to karigar.admin.bootstrap-email if none active
│   └── port/
│       ├── UserAccountCommands      -- identity: suspend(userId) / reinstate(userId); includes revokeAll + deny-list
│       ├── UserProvisioning         -- identity: createInvitedUser(email, phone, name) → userId + set-password email
│       ├── WorkerAccountCommands    -- worker (LLD-004): suspend(workerId, reason) / reinstate(workerId)
│       ├── RestrictionCommands      -- trust (LLD-007 table): add(ADMIN|FRAUD) / lift(id, adminId)
│       ├── ProfileLookups           -- customer / worker summaries for the detail view
│       ├── OpsQueueSource           -- one implementation per owning module (§3.3)
│       └── OutboxAdmin              -- shared outbox: retryDead(eventId)
├── domain/
│   ├── AdminUser, AdminStatus (ACTIVE | SUSPENDED | LEFT), RoleGrant
│   ├── Permission                   -- string constants of §4.1 (one place, ArchUnit-checked)
│   └── Masking                      -- phone, email, address masking rules
└── infrastructure/
    ├── security/ AdminAuthorizationFilter   -- /api/v1/admin/**: load grants, check MFA window, set authorities
    └── persistence/ JPA entities, AdminGrantQuery (native SQL)

com.karigar.shared.audit
├── AuditRecorder                    -- record(action, entityType, entityId, metadata); actor + requestId from context
└── AuditEventJdbcWriter             -- INSERT only; no update / delete methods exist
```

**Per-request check.** `AdminAuthorizationFilter` runs after JWT validation (LLD-002) on `/api/v1/admin/**`:

```java
// 1 indexed query per admin request; no cache, so a revoke or staff suspension is effective on the next call
List<Grant> grants = grantQuery.liveGrants(jwt.userId());   // admin_users ACTIVE ⋈ admin_user_roles live ⋈ role_permissions
if (grants.isEmpty()) throw new PermissionDenied();          // ADMIN claim stale (up to 15 min) → still denied here
if (!mfa.windowOpen(jwt.sid(), grants.admin().mfaEnabled())) throw new MfaRequired(grants.admin().mfaEnabled());
var authorities = grants.stream()
        .map(g -> g.zoneId() == null ? "perm:" + g.permission() : "perm:" + g.permission() + "@" + g.zoneId())
        .toList();
SecurityContextHolder.getContext().setAuthentication(adminAuth(jwt, grants.adminId(), authorities));
```

Controllers use plain Spring method security: `@PreAuthorize("hasAuthority('perm:account.suspend')")`. Zone-aware endpoints (D4) use `@perm.has('service_zone.manage', #zoneId)`, which accepts `perm:X` or `perm:X@{zoneId}`.

---

## 3. Data model

### 3.1 Migration order

`account_restrictions.created_by_admin_id REFERENCES admin_users (id)` is created in **LLD-007 `V6_2__matching.sql`** — the earliest migration that references `admin_users` (grep of all LLDs; ERD §48.2 strikes will reference it later). So the staff tables go in **`V1_3__admin_users.sql`** (after `V1_1` users, `V1_2` sessions; before `V2_1`). `service_zones` only exists from `V4_1`, so the zone FK on grants and the admin-owned extras go in **`V15_1__admin_ops.sql`**.

```sql
-- V1_3__admin_users.sql
CREATE TABLE admin_users (
    id                UUID PRIMARY KEY,                       -- UUIDv7 (ADR 0018)
    user_id           UUID NOT NULL UNIQUE REFERENCES users (id),
    employee_code     VARCHAR(30) UNIQUE,
    status            VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE','SUSPENDED','LEFT')),
    mfa_enabled       BOOLEAN NOT NULL DEFAULT false,         -- true once a TOTP code has been verified
    mfa_secret_enc    BYTEA,                                  -- AES-256-GCM, key from Secrets Manager
    mfa_last_step     BIGINT,                                 -- last accepted TOTP time-step (replay guard)
    created_at        TIMESTAMPTZ NOT NULL,
    updated_at        TIMESTAMPTZ NOT NULL,
    version           BIGINT NOT NULL DEFAULT 0,
    CHECK (NOT mfa_enabled OR mfa_secret_enc IS NOT NULL)
);

CREATE TABLE roles (
    code         VARCHAR(30) PRIMARY KEY,
    description  VARCHAR(200) NOT NULL
);
CREATE TABLE permissions (
    code         VARCHAR(40) PRIMARY KEY,
    description  VARCHAR(200) NOT NULL
);
CREATE TABLE role_permissions (
    role_code        VARCHAR(30) NOT NULL REFERENCES roles (code),
    permission_code  VARCHAR(40) NOT NULL REFERENCES permissions (code),
    PRIMARY KEY (role_code, permission_code)
);

CREATE TABLE admin_user_roles (
    id                   UUID PRIMARY KEY,
    admin_user_id        UUID NOT NULL REFERENCES admin_users (id),
    role_code            VARCHAR(30) NOT NULL REFERENCES roles (code),
    service_zone_id      UUID,                                -- NULL = all zones; FK added in V15_1
    granted_by_admin_id  UUID REFERENCES admin_users (id),    -- NULL = bootstrap
    granted_at           TIMESTAMPTZ NOT NULL,
    revoked_by_admin_id  UUID REFERENCES admin_users (id),
    revoked_at           TIMESTAMPTZ
);
CREATE UNIQUE INDEX ux_admin_user_roles_live ON admin_user_roles
    (admin_user_id, role_code, COALESCE(service_zone_id, '00000000-0000-0000-0000-000000000000'))
    WHERE revoked_at IS NULL;
CREATE INDEX ix_admin_user_roles_admin ON admin_user_roles (admin_user_id) WHERE revoked_at IS NULL;

CREATE TABLE audit_events (                                   -- ERD §52, written by every module
    id             UUID PRIMARY KEY,
    actor_user_id  UUID,                                      -- NULL = SYSTEM
    action         VARCHAR(60) NOT NULL,
    entity_type    VARCHAR(40) NOT NULL,
    entity_id      UUID,
    metadata       JSONB,      -- {adminUserId, reasonCode, note, requestId, from, to, …}; no raw PII (D9)
    created_at     TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_audit_entity ON audit_events (entity_type, entity_id, created_at DESC);
CREATE INDEX ix_audit_actor  ON audit_events (actor_user_id, created_at DESC) WHERE actor_user_id IS NOT NULL;
CREATE INDEX ix_audit_time   ON audit_events USING BRIN (created_at);

CREATE FUNCTION audit_events_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' AND OLD.created_at < now() - INTERVAL '8 years' THEN RETURN OLD; END IF;  -- retention job only
    RAISE EXCEPTION 'audit_events are append-only';
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_audit_events_ro BEFORE UPDATE OR DELETE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION audit_events_guard();
```

Seed in the same migration (`ON CONFLICT DO NOTHING`): the six ERD roles, the permissions of §4.1, and the matrix in §3.2. The admin reason codes (suspend, restrict, lift, reveal) are seeded like every module's: in this module's repeatable `R__admin_reason_codes.sql` (LLD-022), not here: categories `WORKER_SUSPENSION`, `CUSTOMER_SUSPENSION`, `ACCOUNT_RESTRICTION`, `PII_REVEAL` (e.g. `SAFETY_CONCERN`, `FRAUD_SUSPECTED`, `SUPPORT_CALL`, `DISPUTE_INVESTIGATION`, `LEGAL_REQUEST`).

```sql
-- V15_1__admin_ops.sql
ALTER TABLE admin_user_roles ADD CONSTRAINT fk_admin_user_roles_zone
    FOREIGN KEY (service_zone_id) REFERENCES service_zones (id);

ALTER TABLE account_restrictions ADD COLUMN lifted_by_admin_id UUID REFERENCES admin_users (id);

CREATE TABLE ops_queue_acks (                                 -- "looked at, nothing to do" (D8)
    queue              VARCHAR(30) NOT NULL CHECK (queue IN
                       ('FLAGGED_CHECK_IN','PARKED_PROVIDER_EVENT','STUCK_REFUND','OUTBOX_DEAD')),
    item_id            UUID NOT NULL,
    outcome            VARCHAR(20) NOT NULL CHECK (outcome IN ('NO_ACTION','HANDLED_ELSEWHERE')),
    note               VARCHAR(500),
    acked_by_admin_id  UUID NOT NULL REFERENCES admin_users (id),
    acked_at           TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (queue, item_id)
);
```

### 3.2 Roles → permissions (seed)

Roles are the ERD §52.1 set. `SUPER_ADMIN` has every permission and is the only role with `staff.manage`.

| Permission | OPS_MANAGER | SUPPORT_AGENT | VERIFICATION_AGENT | FINANCE | DISPUTE_AGENT |
|---|---|---|---|---|---|
| `user.view` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `user.pii.reveal` | ✓ | ✓ | | | ✓ |
| `account.suspend`, `account.restrict` | ✓ | | | | |
| `ops.view` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `ops.act` | ✓ | | | | |
| `audit.view` | ✓ | | | ✓ | |
| `booking.view` | ✓ | ✓ | | | ✓ |
| `booking.manage` | ✓ | ✓ | | | |
| `catalog.manage`, `service_zone.manage` | ✓ | | | | |
| `finance.view` | ✓ | | | ✓ | |
| `finance.adjust`, `finance.refund`, `finance.payout` | | | | ✓ | |
| `verification.review` | | | ✓ | | |
| `review.moderate` | ✓ | ✓ | | | ✓ |
| `worker.enforce` | ✓ | | | | ✓ |
| `dispute.manage` | ✓ | ✓ | | | ✓ |
| `dispute.resolve` | | | | | ✓ |
| `notification.view` | ✓ | ✓ | | | |
| `notification.retry` | ✓ | | | | |

### 3.3 Ops queues (no new tables)

Each owning module implements `OpsQueueSource { queue(); count(); oldest(); items(cursor, limit) }` over its own tables; admin never queries another module's tables.

| Queue | Owner | Item = | Leaves the queue when | View permission |
|---|---|---|---|---|
| `FLAGGED_CHECK_IN` | job (LLD-009) | `job_visits` with `check_in_flagged`, last 30 days | acked | `ops.view` |
| `CASH_DISPUTED` | payment (LLD-010) | `payments` `method = 'CASH' AND status = 'DISPUTED'` | dispute resolved (LLD-018) | `ops.view` |
| `STUCK_REFUND` | payment (LLD-011) | `refunds` `FAILED`, or `REQUESTED/PROCESSING` > 24 h (`ix_refunds_open`) | `SUCCEEDED`, or acked after a retry | `finance.view` |
| `PARKED_PROVIDER_EVENT` | payment (LLD-011) | `provider_events` `processed_at IS NULL AND attempts ≥ 5` | processed, or acked | `finance.view` |
| `VERIFICATION_PENDING` | verification (LLD-016) | submitted, undecided verifications | decided | `verification.review` |
| `OPEN_DISPUTE` | dispute (LLD-018) | `disputes` `AWAITING_RESPONSE / IN_REVIEW` | resolved / rejected / withdrawn | `dispute.manage` |
| `OUTBOX_DEAD` | shared outbox | `outbox_events` `status = 'DEAD'` | retried and published, or acked | `ops.view`; retry `ops.act` |

Acting on an item happens on the owner's endpoint (§4.1); the queue item carries `actionPath` (e.g. `/api/v1/admin/payments/{id}`).

---

## 4. API contract

### 4.1 Permission catalog (all LLDs)

One list; `Permission` constants must match it (ArchUnit test scans every `@PreAuthorize`).

| Permission | Owner LLD | Endpoints |
|---|---|---|
| `staff.manage` | LLD-020 | `/api/v1/admin/staff/**` |
| `user.view` | LLD-020, LLD-015 | `GET /api/v1/admin/users`, `GET /api/v1/admin/users/{userId}`, `GET /api/v1/admin/workers/{id}/schedule` |
| `user.pii.reveal` | LLD-020 | `POST /api/v1/admin/users/{userId}/reveal` |
| `account.suspend` | LLD-020 | `POST /api/v1/admin/customers/{id}/suspend` · `/reinstate`, `POST /api/v1/admin/workers/{id}/suspend` · `/reinstate` |
| `account.restrict` | LLD-020 | `POST /api/v1/admin/users/{userId}/restrictions`, `POST /api/v1/admin/restrictions/{id}/lift` |
| `ops.view` / `ops.act` | LLD-020 | `GET /api/v1/admin/ops/queues[/{queue}]` / `POST …/items/{itemId}/ack`, `POST /api/v1/admin/ops/outbox/{eventId}/retry` |
| `audit.view` | LLD-020 | `GET /api/v1/admin/audit-events` |
| `catalog.manage` | LLD-003 | `/api/v1/admin/catalog/**` |
| `service_zone.manage` | LLD-005 | `/api/v1/admin/service-zones/**` |
| `finance.view` | LLD-010, LLD-011, LLD-019 | `GET /api/v1/admin/ledger/accounts/{type}`, `GET /api/v1/admin/payments`, `GET /api/v1/admin/payouts` |
| `finance.adjust` | LLD-010 | `POST /api/v1/admin/ledger/adjustments` |
| `finance.refund` | LLD-011 | `POST /api/v1/admin/payments/{id}/refunds` |
| `finance.payout` | LLD-019 | `POST` / `DELETE /api/v1/admin/workers/{id}/payout-hold`, `POST /api/v1/admin/payout-accounts/{id}/approve` · `/reject` |
| `booking.view` | LLD-009, LLD-017 | `GET /api/v1/admin/bookings[/{id}]`, `GET /api/v1/admin/jobs[/{id}]` (LLD-009 §5.3), incl. the job's quotes and material bills |
| `booking.manage` | LLD-009 | `POST /api/v1/admin/bookings/{id}/cancel` (LLD-009 §5.3) |
| `review.moderate` | LLD-012 | `/api/v1/admin/reviews/**` (modules/07 §9.2) |
| `worker.enforce` | strikes (table in LLD-009 `V7_1`; endpoints not yet specified) | `POST /api/v1/admin/workers/{id}/strikes`, `/admin/strikes/{id}/revoke` · `/reject-appeal` |
| `verification.review` | LLD-016 | `/api/v1/admin/verifications/**` (incl. document view, itself audited) |
| `dispute.manage` | LLD-018 | `GET /api/v1/admin/disputes[/{id}]`, `POST /api/v1/admin/disputes` (open on behalf), `/claim`, `/notes`, `/messages` |
| `dispute.resolve` | LLD-018 | `POST /api/v1/admin/disputes/{id}/resolve` · `/reject` · `/actions/{actionId}/retry` · `/cancel` (refund above ₹5,000 also needs `finance.refund`) |
| `notification.view` | LLD-013 | `GET /api/v1/admin/notifications` |
| `notification.retry` | LLD-013 | `POST /api/v1/admin/notifications/{id}/retry` |

### 4.2 Endpoints owned here

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/api/v1/admin/me` | any staff (MFA not needed) | profile, grants, effective permissions, `mfaEnabled`, `mfaWindowOpenUntil` |
| POST | `/api/v1/admin/me/mfa/enroll` | any staff, not yet enrolled | → `otpauthUri` (secret shown once) |
| POST | `/api/v1/admin/me/mfa/verify` | any staff | `{ "code": "123456" }` → enables MFA on first success; opens the window |
| GET | `/api/v1/admin/staff?status=` | `staff.manage` | staff list with live grants |
| POST | `/api/v1/admin/staff` | `staff.manage` | `{ email, phone, name, employeeCode, grants: [{ role, serviceZoneId }] }` → existing user linked or invited |
| POST | `/api/v1/admin/staff/{id}/grants` · `/grants/{grantId}/revoke` | `staff.manage` | grant / revoke one role |
| POST | `/api/v1/admin/staff/{id}/suspend` · `/reactivate` · `/left` · `/mfa/reset` | `staff.manage` | suspend / leave also `revokeAll(ADMIN)` |
| GET | `/api/v1/admin/users?q=&type=` | `user.view` | `q` = exact phone / email / id, or name prefix (≥ 3 chars); max 20 rows |
| GET | `/api/v1/admin/users/{userId}` | `user.view` | masked detail: status, profiles, restrictions, counts, last 20 audit events |
| POST | `/api/v1/admin/users/{userId}/reveal` | `user.pii.reveal` | `{ fields: [PHONE, EMAIL, ADDRESSES], reasonCode, note }` → full values, `Cache-Control: no-store` |
| POST | `/api/v1/admin/customers/{customerId}/suspend` · `/reinstate` | `account.suspend` | `{ reasonCode, note }` |
| POST | `/api/v1/admin/workers/{workerId}/suspend` · `/reinstate` | `account.suspend` | `{ reasonCode, note, blockLogin }` |
| POST | `/api/v1/admin/users/{userId}/restrictions` | `account.restrict` | `{ type, source: ADMIN \| FRAUD, endsAt?, reasonCode, note }` |
| POST | `/api/v1/admin/restrictions/{id}/lift` | `account.restrict` | `{ reasonCode, note }`; only `ADMIN` / `FRAUD` sources |
| GET | `/api/v1/admin/ops/queues?zoneId=` | `ops.view` | per queue the caller may see: `count`, `oldestAt` |
| GET | `/api/v1/admin/ops/queues/{queue}?cursor=` | per §3.3 | items, oldest first |
| POST | `/api/v1/admin/ops/queues/{queue}/items/{itemId}/ack` | `ops.act` (+ view perm) | `{ outcome, note }` |
| POST | `/api/v1/admin/ops/outbox/{eventId}/retry` | `ops.act` | `DEAD → PENDING`, attempts reset |
| GET | `/api/v1/admin/audit-events?entityType=&entityId=&actorUserId=&action=&from=&to=&cursor=` | `audit.view` | either an entity / actor filter, or a range ≤ 31 days; 50 per page |

Worker suspend:

```json
// POST /api/v1/admin/workers/0192f…/suspend
{ "reasonCode": "SAFETY_CONCERN", "note": "Customer complaint, call ref 4411", "blockLogin": false }
// 200
{
  "data": {
    "workerId": "0192f…", "accountStatus": "SUSPENDED", "loginBlocked": false,
    "confirmedBookingsToCancel": 2,          // cancelled asynchronously by LLD-009 (WorkerSuspended)
    "auditEventId": "0192f…"
  }
}
```

User detail (support agent, masked):

```json
{
  "data": {
    "userId": "0192e…", "name": "Rina Das", "status": "ACTIVE",
    "phone": "+91******4321", "email": "r***@gmail.com",
    "customer": { "customerId": "…", "requests": 4, "bookings": 3, "addresses": [{ "label": "Home", "locality": "Shibpur", "pincode": "711102" }] },
    "worker": null,
    "restrictions": [],
    "piiMasked": true
  }
}
```

**Error codes**

| HTTP | `error.code` | When |
|---|---|---|
| 403 | `PERMISSION_DENIED` | not active staff, or missing permission (`details.permission`) |
| 403 | `MFA_REQUIRED` | window closed or not enrolled (`details.enrolled`); `staff.manage` with a code older than 15 min |
| 422 | `MFA_CODE_INVALID` | wrong / reused TOTP code |
| 429 | `MFA_LOCKED` | 5 wrong codes in 15 min for this staff member |
| 404 | `USER_NOT_FOUND` / `STAFF_NOT_FOUND` / `RESTRICTION_NOT_FOUND` / `QUEUE_ITEM_NOT_FOUND` | — |
| 409 | `SELF_ACTION_FORBIDDEN` | target is the caller (D5) |
| 409 | `TARGET_IS_STAFF` | suspend / restrict an active staff member here (use `/admin/staff`) |
| 409 | `ACCOUNT_STATE_INVALID` | e.g. reinstate a `DEACTIVATED` user, suspend an `ONBOARDING` worker without `blockLogin` |
| 409 | `RESTRICTION_NOT_LIFTABLE` | source `STRIKES` (revoke the strike, LLD-012) or `DUES` (balance-driven, LLD-010) |
| 409 | `LAST_SUPER_ADMIN` | revoke / suspend the last active `SUPER_ADMIN` |
| 409 | `OUTBOX_EVENT_NOT_DEAD` | retry on an event that is not `DEAD` |
| 409 | `CONCURRENT_UPDATE` | stale `version` on `admin_users` |
| 422 | `REASON_CODE_INVALID` / `NOTE_REQUIRED` | unknown code for the category, or `requires_note` |
| 429 | `REVEAL_LIMIT_REACHED` | D7 limit |

---

## 5. Sequence diagrams

### 5.1 Admin request with MFA and permission check

```mermaid
sequenceDiagram
    participant UI as Admin web app
    participant F as AdminAuthorizationFilter
    participant R as Redis
    participant DB as PostgreSQL
    participant C as Controller (@PreAuthorize)
    UI->>F: GET /admin/users/{id} (Bearer JWT, roles incl. ADMIN)
    F->>F: JWT valid, sid not on deny-list (LLD-002)
    F->>DB: live grants for user_id (admin_users ACTIVE)
    F->>R: GET admin:mfa:{sid}
    alt no window
        F-->>UI: 403 MFA_REQUIRED
        UI->>F: POST /admin/me/mfa/verify {code}
        F->>DB: TOTP check, step > mfa_last_step → update
        F->>R: SET admin:mfa:{sid} = now, TTL 12 h
    end
    F->>C: authorities perm:user.view …
    C->>DB: masked detail; audit USER_VIEWED
```

### 5.2 Suspend a worker with `blockLogin`

```mermaid
sequenceDiagram
    participant A as AccountActionService
    participant W as WorkerAccountCommands (LLD-004)
    participant I as UserAccountCommands (identity, LLD-002)
    participant DB as PostgreSQL
    participant R as Redis deny-list
    participant B as BookingCancellationService (LLD-009)
    A->>A: target ≠ caller, not active staff, reason code valid
    A->>W: suspend(workerId, reason)  [same transaction]
    W->>DB: account_status = SUSPENDED; outbox WorkerSuspended
    A->>I: suspend(userId)
    I->>DB: users.status = SUSPENDED; refresh_sessions revoked (SUSPENDED)
    A->>DB: audit_events WORKER_SUSPENDED {reasonCode, blockLogin}
    Note over A,DB: commit
    I->>R: after commit: deny-list each live sid
    DB-->>B: WorkerSuspended (outbox) → cancel CONFIRMED bookings, re-match
```

Matching excludes the worker at once (`account_status = 'ACTIVE'` in the LLD-007 candidate query); LLD-008 withdraws their accepted offers.

---

## 6. State transitions

**Staff (`admin_users.status`)**

| From | Event | Guard | To | Side effects |
|---|---|---|---|---|
| — | staff created / bootstrap | email unique among staff | ACTIVE | `STAFF_CREATED`; invite email if new user |
| ACTIVE | suspend | not self, not last `SUPER_ADMIN` | SUSPENDED | `revokeAll(ADMIN)`; next admin call → 403 |
| SUSPENDED | reactivate | not self | ACTIVE | MFA window must be reopened |
| ACTIVE / SUSPENDED | left | not last `SUPER_ADMIN` | LEFT (terminal) | grants revoked, `revokeAll(ADMIN)`, MFA secret wiped |

**Account actions**

| Target | From | Action | To | Calls |
|---|---|---|---|---|
| Customer | user `ACTIVE` | suspend | user `SUSPENDED` | identity suspend (revokeAll + deny-list). Open requests expire on their own (LLD-006); confirmed bookings stay (§11) |
| Customer | user `SUSPENDED` | reinstate | user `ACTIVE` | identity reinstate |
| Worker | `ACTIVE` | suspend | `SUSPENDED` (+ user `SUSPENDED` if `blockLogin`) | LLD-004 → `WorkerSuspended` → LLD-009 |
| Worker | `SUSPENDED` (admin or strike threshold) | reinstate | `ACTIVE` (+ user `ACTIVE` if it was blocked) | LLD-004 reinstate; readiness not re-checked (LLD-004 §6) |
| Restriction | live | lift | `lifted_at`, `lifted_by_admin_id` set | only `ADMIN` / `FRAUD` sources |

---

## 7. Error handling, idempotency & concurrency

- **One transaction per account action:** worker / identity / restriction changes, outbox row and audit row commit together (same database, modular monolith). The Redis deny-list write runs after commit; if Redis is down the refresh is still refused (DB), and access tokens die within 15 min (LLD-002 D4).
- **Repeat suspend / reinstate** returns `200` with the current state and writes no second audit row. Parallel suspends: the guarded update `… WHERE status = 'ACTIVE'` on the target lets one win; the other sees the new state.
- **Grants:** `ux_admin_user_roles_live` stops duplicate live grants; revoke is `UPDATE … WHERE id = :id AND revoked_at IS NULL`. `LAST_SUPER_ADMIN` is checked with `SELECT … FOR UPDATE` on the live `SUPER_ADMIN` grants.
- **TOTP replay:** a code is accepted only if its time-step > `mfa_last_step`, updated with the row locked; two concurrent uses of one code → one wins.
- **Outbox retry** is safe because every consumer is idempotent (`processed_events`, ADR 0005).
- **Acks:** primary key `(queue, item_id)`; a second ack → `200` with the first.
- **Staff-claim lag:** a removed staff member's JWT may still say `ADMIN` for up to 15 min; it grants nothing, the filter checks the DB.

---

## 8. Security & privacy

- Admin endpoints are commands (`suspend`, `lift`, `reveal`), never generic `PATCH` (security/02 §21). Hiding UI buttons is not authorization; every endpoint has `@PreAuthorize`, and an ArchUnit test fails any `/admin/**` handler without one.
- MFA (D2): secret encrypted at rest, shown once at enrolment, reset only by another `SUPER_ADMIN`. 5 wrong codes → 15 min lock. The first `SUPER_ADMIN` comes from `karigar.admin.bootstrap-email` (an existing user), granted only when no active `SUPER_ADMIN` exists; audited as `SYSTEM`.
- Staff provisioning reuses identity: a new staff user gets a set-password email (LLD-001 `PASSWORD_RESET` token); staff never get a password chosen by someone else.
- PII (D7): search by phone / email is exact match only (no "phone starts with"); the search value is stored masked in the audit row. `reveal` returns only the asked fields, `Cache-Control: no-store`, audit `USER_PII_REVEALED {fields, reasonCode}`. Verification documents and dispute evidence are not here — their access is audited by LLD-016 / LLD-018.
- Payment data: admins see amounts, statuses and provider references only (modules/11 §82); masked VPA stays masked.
- Audit (security/02 §23): actor, action, target, time, reason, `requestId` on every admin command and on `USER_VIEWED` / `USER_PII_REVEALED`. Ordinary staff can read but never edit audit rows (DB trigger). The audit viewer shows metadata as stored — it holds no raw PII.
- Admin API rate limit: 300 requests / min per staff member; CORS restricted to the admin app origin.

---

## 9. Observability

| Type | Name | Notes |
|---|---|---|
| Counter | `admin_action_total{action}` | suspend, reinstate, restrict, lift, grant, revoke, ack, outbox_retry |
| Counter | `admin_permission_denied_total{permission}` | |
| Counter | `admin_mfa_verify_total{result}` | ok, invalid, replay, locked |
| Counter | `admin_pii_reveal_total{field}` | |
| Gauge | `ops_queue_size{queue}`, `ops_queue_oldest_age_seconds{queue}` | computed every 5 min (ShedLock) from `OpsQueueSource.count/oldest` |
| Log | `ADMIN_ACTION` | adminUserId, action, entity, reasonCode, requestId (no PII) |

Alerts: `OUTBOX_DEAD` or `PARKED_PROVIDER_EVENT` > 0 for 15 min; `STUCK_REFUND` > 0; `VERIFICATION_PENDING` oldest > 48 h; `OPEN_DISPUTE` oldest > 72 h; any staff member > 30 reveals in a day or > 20 permission denials in 10 min (insider / compromised account, security/02 §66); a grant of `SUPER_ADMIN` (always notify all super admins).

---

## 10. Test plan

| Level | Cases |
|---|---|
| Unit | `Masking`: Indian mobile, short email local part, address → locality + PIN; TOTP verify ±1 step, replay rejected; zone authority match (`perm:X` vs `perm:X@zone`) |
| Web slice | every `/admin/**` handler has `@PreAuthorize` (ArchUnit); no permission → 403 `PERMISSION_DENIED`; customer token on admin path → 403 |
| Integration (Testcontainers PostgreSQL + Redis) | grant → allowed on next call; revoke → denied on next call (no cache); staff suspended → denied + sessions revoked; MFA window expiry → `MFA_REQUIRED`; Redis flushed → `MFA_REQUIRED` (fails closed) |
| Account actions | worker suspend → `WorkerSuspended` in outbox, audit row, candidate query excludes; `blockLogin` → login 403 `ACCOUNT_SUSPENDED`, old access token 401 `SESSION_REVOKED`; reinstate restores both; customer suspend → refresh refused; self / staff target → 409; lift `DUES` → 409 |
| Lookup | masked by default; reveal writes audit with fields + reason; 21st reveal in an hour → 429; name search < 3 chars → 422 |
| Queues | each source returns its rows; acked item hidden; agent without `finance.view` doesn't see finance queues in the summary; outbox retry `DEAD → PENDING` once, second call → 409 |
| DB | UPDATE / recent DELETE on `audit_events` fails; seed matrix matches §3.2; `V1_3` runs before `V6_2` on an empty DB (full Flyway run) |
| Concurrency | two suspends at once → one audit row; two uses of one TOTP code → one success; revoke last two `SUPER_ADMIN` grants in parallel → one fails `LAST_SUPER_ADMIN` |

---

## 11. Open questions

| Question | Default until decided | Owner | Due |
|---|---|---|---|
| Dual control (second approver) for large refunds / adjustments (ERD §52.1, modules/11 §50) | None; amounts audited and alerted | Finance + Product | Before launch |
| Customer suspended with confirmed bookings: cancel them automatically? | No; detail view shows them, agent cancels via `POST /api/v1/admin/bookings/{id}/cancel` (`booking.manage`, LLD-009 §5.3) | Ops | With LLD-009 rev |
| Admin endpoints for manual strikes / strike revocation (`worker.enforce`) | Via LLD-018 `WORKER_STRIKE` / `REVOKE_STRIKE` actions only | Ops + Trust & safety | Before pilot |
| Shorter refresh lifetime for staff logins (LLD-002 is 30 / 90 days) | Same as everyone; the 12 h MFA window bounds admin access | Security | Before launch |
| IP allow-list / VPN for the admin app | None; MFA only | Security | Before launch |
| Should `SUPPORT_AGENT` reveal phone numbers, or call through a masked bridge | Reveal with reason | Ops | Pilot review |
| Zone-scoped grants once a second city opens (D4) | All grants global | Ops | Second city |

---

## Change log

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-05 | TBD | First draft |
| 0.2 | 2026-10-05 | TBD | Cross-LLD consistency |
