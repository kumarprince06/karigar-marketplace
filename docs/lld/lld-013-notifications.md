# LLD-013: Notifications — Push, Email, In-app Inbox via Outbox

| Field | Value |
|---|---|
| Status | Draft |
| Owner | TBD |
| Reviewers | TBD |
| Module | `notification` |
| Parent HLD | [modules/05](../modules/05-notification-and-communication.md), [architecture/03 §51, §52.2, §52.3, §52.5](../architecture/03-erd-and-production-database-design.md), [ADR 0005](../adr/0005-async-events-and-transactional-outbox.md), [ADR 0014](../adr/0014-websocket-realtime-without-replay.md), [ADR 0016](../adr/0016-email-password-login-phone-otp-later.md) |
| Requirements | product/03 §53–55 (no FR id yet), modules/05 §50 invariants NI-001 – NI-012, [security/03 §29, §102](../security/03-data-privacy-pii-retention-and-compliance.md) |
| Depends on | Outbox + `processed_events` (LLD-022); `user_devices` (LLD-002); `users.preferred_locale`, `users.email` (LLD-001); catalog names per locale (LLD-003); events listed in §4 from LLD-001, 002, 004–012, 016–019 |
| Used by | Every module that writes a notifiable outbox event; LLD-021 (`NotificationCreated`) |
| Last updated | 2026-10-05 |

---

## 1. Context & scope

Business modules never call a provider. They write an outbox event in their own transaction; the `notification` module consumes it, decides **who** gets **what** on **which channel**, stores it, and delivers it in the background. A provider outage never fails a booking or a payment (NI-004).

**In scope**

- One outbox consumer that turns events into notification rows, via a policy table in code
- Channels: **in-app inbox**, **push** (FCM, Android + iOS), **email** (Brevo)
- Templates in en / bn / hi; lock-screen-safe push text
- Delivery job: retries with backoff, expiry, invalid-token handling
- Push-token registration, inbox API (list, unread count, mark read), reminder preference
- Ops view of failed deliveries, manual retry; 90-day retention

**Out of scope:** SMS and WhatsApp (after TRAI DLT registration, [ADR 0016](../adr/0016-email-password-login-phone-otp-later.md)); OTP; marketing campaigns; chat between customer and worker; live WebSocket updates ([ADR 0014](../adr/0014-websocket-realtime-without-replay.md) — they may share the event, not this pipeline); email bounce webhooks and delivery receipts; admin operational alerts (monitoring, not notifications).

**Decisions**

| # | Decision | Default (configurable) |
|---|---|---|
| D1 | **Two steps.** (1) The outbox consumer `notification` (deduped in `processed_events`) creates all rows for an event in one DB transaction — no provider calls. (2) `NotificationDeliveryJob` sends `PENDING` rows. A failing provider therefore never blocks or replays the outbox. | — |
| D2 | **Policy is code, not data**: `NotificationPolicy` maps event type → rules (recipient, notification type); `NotificationType` carries category, priority, channels. Changes go through PR review and tests. No DB rules engine. | — |
| D3 | **One table** `notifications` holds inbox rows (`IN_APP`) and delivery rows (`PUSH`, `EMAIL`), as in ERD §51. Dedup key = **(event id, recipient, channel, type)**, a unique index (type lets one event plan several reminders, D14). | — |
| D4 | **Templates are resource bundles** in the codebase: `notifications_{en,bn,hi}.properties` (title / body per type and channel) plus one HTML email layout. Missing key in bn/hi → en for that key. Reason: ~40 short texts that change with features, reviewed in the same PR, translators edit a plain file, no admin UI, no cache, no migration. A table becomes worth it only when non-developers must edit text without a release. | en fallback |
| D5 | **Lock-screen-safe push**: title/body may contain the other party's first name, trade, locality name, date/time window, ETA. Never: house no. / street, phone, start code, links, amounts, reasons for suspension or disputes. Those appear only in the inbox (behind login) or in email. | — |
| D6 | **Priority**: `HIGH` for new job offers ([LLD-007](lld-007-matching-candidate-search.md) D9), "you got the job", worker on the way / arrived, booking cancelled. Everything else `NORMAL`. HIGH = FCM Android `priority: high` + APNs priority 10; job offers use the Android channel `job_offers` (loud sound), emergency offers `job_offers_emergency`. | — |
| D7 | **Retries**: transient failures retry after 30 s, 2 min, 10 min, 30 min, 2 h (±20 % jitter); after **5** attempts → `FAILED`. Permanent errors (invalid email, unregistered token) → `FAILED` / device disabled at once. A row past `expires_at` (e.g. an offer that closed) → `EXPIRED`, never sent. | 5 attempts |
| D8 | **Push goes to all live devices** of the user (max 5 most recently seen). `UNREGISTERED` / invalid-token → that device's token is cleared and the device disabled through the identity module's `DevicePushTokens` API. | 5 devices |
| D9 | **Categories**: `SECURITY` and `TRANSACTIONAL` are always on. `REMINDER` push can be switched off per user. The inbox row is always written. `MARKETING` does not exist in MVP; when added it is gated by `user_consents` (`MARKETING_PUSH` / `MARKETING_EMAIL`, ERD §52.3), not by preferences. | — |
| D10 | **Quiet hours 21:00–07:00 IST** apply to `REMINDER` pushes only: they are scheduled for 07:00 and expire if stale. Offers already follow LLD-007's night rule; transactional and security messages go at once. | 21:00–07:00 |
| D11 | **Actor rule**: the user who caused the event gets no push or email for it, at most an inbox row (the app already shows the result). | — |
| D12 | **Email only where it earns its place**: security mails, account suspension, "now in your area" for logged-out waitlist entries. No receipts by email in MVP (Brevo free tier ~300/day, ADR 0016). | — |
| D13 | Notification rows are kept **90 days** ([security/03 §102](../security/03-data-privacy-pii-retention-and-compliance.md)), then deleted. | 90 d |
| D14 | **Delayed, guarded rules** (review reminders, dispute response reminder): the rule sets `next_attempt_at` in the future (`delay(…)` after the event, or `before(payloadTime, …)`), is **push only** (no inbox row until it is relevant) and has a `skipIf` guard checked at claim time through a port (`ReviewLookup.hasReviewed`, `DisputeLookup.responded`); guard true → `SUPPRESSED` (`NO_LONGER_RELEVANT`). | — |
| D15 | For every `IN_APP` row it creates, the consumer writes outbox **`NotificationCreated { notificationId, userId }`** in the same transaction; LLD-021 turns it into a `NOTIFICATION_CREATED` hint so an open app refreshes the inbox badge. | ~1 extra outbox row per inbox row |

---

## 2. Classes / components

```text
com.karigar.notification
├── api/
│   ├── NotificationInboxController     -- GET /api/v1/notifications, /unread-count, POST /{id}/read, /read-all
│   ├── PushTokenController             -- PUT|DELETE /api/v1/me/devices/current/push-token
│   ├── NotificationPreferenceController-- GET|PUT /api/v1/me/notification-preferences
│   └── AdminNotificationController     -- GET /api/v1/admin/notifications, POST /{id}/retry (notification.view / .retry)
├── application/
│   ├── NotificationEventConsumer       -- outbox handler for every event type in NotificationPolicy; processed_events
│   ├── NotificationPlanner             -- rules → recipients → suppress/defer → render → INSERT rows (ON CONFLICT DO NOTHING)
│   ├── NotificationDeliveryJob         -- every 2 s: claim ≤ 50 due PENDING rows (lease 60 s, SKIP LOCKED), send, record
│   ├── InboxService, PreferenceService
│   ├── NotificationRetentionJob        -- nightly, ShedLock: delete rows older than 90 d in batches of 5,000
│   └── port/
│       ├── RecipientDirectory          -- identity/customer/worker: customerId|workerId → userId, locale, email, status
│       ├── DevicePushTokens            -- identity (LLD-002): liveTokens(userId), set, clear, disable(deviceId)
│       ├── DisplayLookup               -- worker first name, trade name in locale (LLD-003), request locality
│       ├── ReviewLookup                -- LLD-012: hasReviewed(jobId, role) for reminder guards (D14)
│       ├── DisputeLookup               -- LLD-018: responded(disputeId) for the response reminder (D14)
│       └── WaitlistContacts            -- customer (LLD-005): email of a logged-out waitlist entry
├── domain/
│   ├── NotificationType                -- enum: category, priority, channels, secret, quietHours
│   ├── NotificationPolicy              -- event type → List<Rule(recipient selector, type)>
│   ├── Category, Channel, DeliveryStatus, Backoff, QuietHours
│   └── SendResult                      -- ACCEPTED | TRANSIENT | PERMANENT | INVALID_TOKEN (+ code)
└── infrastructure/
    ├── FcmPushSender                   -- Firebase Admin SDK, HTTP v1
    ├── BrevoEmailSender                -- Spring RestClient → POST https://api.brevo.com/v3/smtp/email
    ├── TemplateRenderer                -- MessageSource + email/layout.html (values HTML-escaped)
    └── persistence/                    -- NotificationJpaEntity, NotificationPreferenceJpaEntity
```

`ChannelSender` has exactly two implementations (push, email); `IN_APP` needs no sender.

```java
// NotificationPolicy — excerpt. Recipient selectors read ids from the event payload.
static final Map<String, List<Rule>> RULES = Map.ofEntries(
    entry("WorkerOffered",   List.of(rule(WORKER,   NEW_JOB_OFFER))),
    entry("OfferAccepted",   List.of(rule(CUSTOMER, WORKER_INTERESTED))),
    entry("BookingCancelled",List.of(rule(OTHER_PARTY, BOOKING_CANCELLED))),   // both parties when by ADMIN/SYSTEM
    entry("VisitEnRoute",    List.of(rule(CUSTOMER, WORKER_ON_THE_WAY))));

// NotificationType — excerpt
NEW_JOB_OFFER     (TRANSACTIONAL, HIGH,   Set.of(PUSH)),            // the offers list is the history (LLD-008)
WORKER_INTERESTED (TRANSACTIONAL, NORMAL, Set.of(PUSH, IN_APP)),
SELECTION_REMINDER(REMINDER,      NORMAL, Set.of(PUSH, IN_APP)),
EMAIL_VERIFY      (SECURITY,      NORMAL, Set.of(EMAIL), /*secret*/ true);
```

---

## 3. Data model

Replaces the sketch in [ERD §51](../architecture/03-erd-and-production-database-design.md) (adds dedup, retry, expiry, read and waitlist columns; drops `DELIVERED` and `SMS` until receipts / SMS exist). `user_devices` stays owned by identity (LLD-002).

```sql
-- V11_1__notifications.sql
CREATE TABLE notifications (
    id                   UUID PRIMARY KEY,                       -- UUIDv7 (ADR 0018); also the inbox cursor
    event_id             UUID NOT NULL,                          -- outbox_events.id; no FK (outbox purged after 7 d, LLD-022)
    event_type           VARCHAR(80) NOT NULL,
    user_id              UUID REFERENCES users (id),
    waitlist_entry_id    UUID REFERENCES service_area_waitlist (id),   -- logged-out "notify me" email only
    type                 VARCHAR(60) NOT NULL,                   -- NotificationType, e.g. WORKER_ON_THE_WAY
    category             VARCHAR(20) NOT NULL CHECK (category IN ('SECURITY','TRANSACTIONAL','REMINDER')),
    channel              VARCHAR(10) NOT NULL CHECK (channel IN ('IN_APP','PUSH','EMAIL')),
    priority             VARCHAR(10) NOT NULL CHECK (priority IN ('HIGH','NORMAL')),
    locale               VARCHAR(10) NOT NULL,
    title                VARCHAR(200),
    body                 VARCHAR(1000),
    data                 JSONB NOT NULL DEFAULT '{}',            -- { link, entityType, entityId, inboxId, secretUrl? }
    status               VARCHAR(20) NOT NULL CHECK (status IN ('PENDING','SENT','FAILED','SUPPRESSED','EXPIRED')),
    attempts             SMALLINT NOT NULL DEFAULT 0,
    next_attempt_at      TIMESTAMPTZ,
    locked_until         TIMESTAMPTZ,
    expires_at           TIMESTAMPTZ,
    provider_message_id  VARCHAR(100),                           -- Brevo messageId / FCM message name (first device)
    failure_code         VARCHAR(40),                            -- NO_DEVICE, PREFERENCE_OFF, INVALID_EMAIL, FCM_UNAVAILABLE …
    read_at              TIMESTAMPTZ,
    sent_at              TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL,
    CHECK ((user_id IS NULL) <> (waitlist_entry_id IS NULL)),
    CHECK (waitlist_entry_id IS NULL OR channel = 'EMAIL'),
    CHECK (channel = 'IN_APP' OR read_at IS NULL),
    CHECK (channel <> 'IN_APP' OR status = 'SENT'),             -- inbox rows are stored, not delivered
    CHECK (status <> 'PENDING' OR next_attempt_at IS NOT NULL)
);
CREATE UNIQUE INDEX ux_notifications_dedup
    ON notifications (event_id, COALESCE(user_id, waitlist_entry_id), channel, type);   -- type: one event → several reminders
CREATE INDEX ix_notifications_inbox  ON notifications (user_id, id DESC) WHERE channel = 'IN_APP';
CREATE INDEX ix_notifications_unread ON notifications (user_id) WHERE channel = 'IN_APP' AND read_at IS NULL;
CREATE INDEX ix_notifications_due    ON notifications (next_attempt_at) WHERE status = 'PENDING';
CREATE INDEX ix_notifications_failed ON notifications (created_at) WHERE status = 'FAILED';
CREATE INDEX ix_notifications_created_brin ON notifications USING brin (created_at);   -- retention delete

CREATE TABLE notification_preferences (
    user_id       UUID NOT NULL REFERENCES users (id),
    category      VARCHAR(20) NOT NULL CHECK (category IN ('REMINDER')),   -- only optional categories
    push_enabled  BOOLEAN NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, category)
);   -- no row = enabled
```

**Volume (pilot, Howrah):** ~500 requests/day × ~10 offer pushes + ~15 other rows per request ≈ 12 k rows/day, ~1.1 M rows at the 90-day limit. No partitioning; revisit at 20 M rows (ERD §76 lists `notifications` as a later candidate).

---

## 4. Event → notification mappings

Recipient = the role resolved from the payload ids (`customerId`, `workerId`, `userId`, `waitlistEntryId`). Channels: **A** = in-app inbox, **P** = push, **E** = email. Push text shown is the en lock-screen version; the inbox body may add amounts and details.

| # | Event (source) | Recipient | Type | Cat. | Pri. | Ch. | Push / email text (en) |
|---|---|---|---|---|---|---|---|
| 1 | `EmailVerificationRequested` (LLD-001) | user | EMAIL_VERIFY | SEC | N | E | email with verify link (secret) |
| 2 | `PasswordResetRequested` (LLD-001) | user | PASSWORD_RESET | SEC | N | E | email with reset link (secret) |
| 3 | `PasswordChanged` (LLD-001) | user | PASSWORD_CHANGED | SEC | N | E A | "Your Karigar password was changed" |
| 4 | `NewDeviceLogin` (LLD-002) | user | NEW_DEVICE_LOGIN | SEC | N | E A | "New login on Redmi Note 12" (no IP) |
| 5 | `WorkerActivated` (LLD-004) | worker | WORKER_ACTIVATED | TRX | N | P A | "You can now receive jobs" |
| 6 | `WorkerSuspended` (LLD-004) | worker | WORKER_SUSPENDED | SEC | H | P A E | "Your account is paused. Open the app for details." |
| 7 | `WaitlistAreaLaunched` (LLD-005) | user / logged-out entry | AREA_LAUNCHED | TRX | N | P A / E | "Karigar is now in Shibpur" |
| 8 | `ServiceRequestExpired` (LLD-006) | customer | REQUEST_EXPIRED | TRX | N | P A | "No worker could take your plumbing request. Your advance will be refunded." |
| 9 | `WorkerOffered` (LLD-007) | worker | NEW_JOB_OFFER | TRX | H | P | "New plumbing job in Shibpur, today 4–7 pm" (expires with the offer) |
| 10 | `MatchingFailed` (LLD-007) | customer | MATCHING_FAILED | TRX | N | P A | "We couldn't find a plumber this time. Your advance will be refunded." |
| 11 | `MissedOffersReminder` (LLD-007 D2) | worker | MISSED_OFFERS | REM | N | P A | "You missed 5 job offers. Turn off 'available' when busy." |
| 12 | `WorkerAutoOffline` (LLD-007 D2) | worker | AUTO_OFFLINE | TRX | N | P A | "You're set to not accepting jobs. Turn it on when ready." |
| 13 | `OfferAccepted` (LLD-008) | customer | WORKER_INTERESTED | TRX | N | P A | "Sujit (plumber) can come at 4:30 pm" |
| 14 | `OfferWithdrawn` (LLD-008) | customer | WORKER_WITHDREW | TRX | N | P A | "Sujit can no longer take your job" |
| 15 | `SelectionReminderDue` (LLD-008 D7) | customer | SELECTION_REMINDER | REM | N | P A | "2 workers are waiting — choose one" (expires 2 h) |
| 16 | `WorkerSelected` (LLD-008) | selected worker | JOB_CONFIRMED | TRX | H | P A | "You got the job: plumbing in Shibpur, today 4:30 pm" |
| 17 | `WorkerNotSelected` (LLD-008, LLD-007 on request end) | worker, only if offer was `ACCEPTED` | NOT_SELECTED | TRX | N | P A | "The customer chose another worker" / "The request was closed" |
| 18 | `BookingConfirmed` (LLD-008) | customer (actor) | BOOKING_CONFIRMED | TRX | N | A | — (inbox only, D11) |
| 19 | `VisitEnRoute` (LLD-009) | customer | WORKER_ON_THE_WAY | TRX | H | P A | "Sujit is on the way, about 25 min" |
| 20 | `VisitArrived` (LLD-009) | customer | WORKER_ARRIVED | TRX | H | P A | "Sujit has arrived. Share the start code from the app." |
| 21 | `VisitCheckedOut` (LLD-009) | customer | CONFIRM_VISIT | TRX | N | P A | "Please confirm today's work by Sujit" (amount in inbox) |
| 22 | `VisitConfirmed` (LLD-009) | worker | VISIT_CONFIRMED | TRX | N | P A | "Today's work was confirmed" |
| 23 | `VisitChangeProposed` (LLD-009) | other party | CHANGE_PROPOSED | TRX | N | P A | "Sujit wants to add 2 more days" / "…to reschedule" |
| 24 | `VisitChangeResolved` (LLD-009) | proposer | CHANGE_RESOLVED | TRX | N | P A | "Your request to add days was accepted / declined / expired" |
| 25 | `BookingCancelled` (LLD-009) | other party; both if `ADMIN`/`SYSTEM` | BOOKING_CANCELLED | TRX | H | P A | worker cancelled → customer: "Sujit cancelled — we're finding someone else. Your advance is safe." |
| 26 | `VisitNoShow` kind `WORKER` (LLD-009) | customer; worker | WORKER_NO_SHOW | TRX | N | P A | customer: "We're finding another worker"; worker: "Missed visit recorded" |
| 27 | `VisitNoShow` kind `CUSTOMER` (LLD-009) | customer; worker (actor → A only) | CUSTOMER_NO_SHOW | TRX | N | P A | "Your visit was marked as missed" (charge in inbox) |
| 28 | `JobWorkCompleted` (LLD-009) | customer | CONFIRM_COMPLETION | TRX | N | P A | "Sujit marked the job done. Please confirm within 24 h." |
| 29 | `JobCompleted` (LLD-009) | worker; customer (P only if `AUTO`) | JOB_COMPLETED | TRX | N | P A | "Job completed. Rate Sujit." |
| 30 | `JobFailed` (LLD-009) | customer; worker (actor → A only) | JOB_FAILED | TRX | N | P A | "Your job couldn't be finished. Book again from the app." |
| 31 | `CashPaymentMarked` (LLD-010) | customer | CONFIRM_CASH | TRX | N | P A | "Sujit says you paid in cash. Please confirm." (amount in inbox) |
| 32 | `CashPaymentConfirmed` (LLD-010) | worker | CASH_CONFIRMED | TRX | N | P A | "Cash payment confirmed" |
| 33 | `CashPaymentDisputed` (LLD-010) | worker | CASH_DISPUTED | TRX | N | P A | "The customer disputed a cash payment. Our team will contact you." |
| 34 | `DuesRestrictionChanged` (LLD-010 D7) | worker | DUES_RESTRICTION | TRX | N | P A | "New offers paused until fees are paid" / "You can receive offers again" |
| 35 | `AdvancePaymentSucceeded` (LLD-011) | customer | ADVANCE_PAID | TRX | N | P A | "Payment received. We're finding workers." |
| 36 | `AdvancePaymentFailed` (LLD-011) | customer | ADVANCE_FAILED | TRX | N | P A | "Payment not completed. Your request was not sent." |
| 37 | `PaymentSucceeded` (LLD-011) | customer (actor → A); worker | PAYMENT_RECEIVED | TRX | N | P A | worker: "The customer paid online" (amount in inbox) |
| 38 | `RefundSucceeded` (LLD-011) | customer | REFUND_DONE | TRX | N | P A | "Your refund is on its way (3–7 working days)" |
| 39 | `JobCompleted` (LLD-009) +1 h, +2 d, +6 d (D14) | customer; worker | REVIEW_REMINDER_1H / _2D / _6D | REM | N | P | "How did the plumbing job go? Rate Sujit" — skipped if that party has reviewed (`ReviewLookup`); expires at the review window end (LLD-012 D4) |
| 40 | `ReviewSubmitted` (LLD-012) | the other party, if they have not reviewed | REVIEW_NUDGE | REM | N | P A | worker: "Rate your customer to see their review"; customer: "Sujit has rated the job — add your review" |
| 41 | `ReviewPublished` (LLD-012), reviewer `CUSTOMER` | worker | REVIEW_PUBLISHED | TRX | N | P A | "You have a new review" (stars and text in the app) |
| 42 | `ReviewModerated` (LLD-012) to `HIDDEN` / `REMOVED` | author | REVIEW_MODERATED | TRX | N | P A | "An update on your review" (reason in inbox only, D5) |
| 43 | `ReviewReplied` (LLD-012) | customer (reviewer) | REVIEW_REPLIED | TRX | N | P A | "Sujit replied to your review" |
| 44 | `DisputeOpened` (LLD-018) | other party (respondent) | DISPUTE_OPENED | TRX | H | P A | "Rina raised an issue about the plumbing job. Please reply within 48 h." (no category / amount, D5) |
| 45 | `DisputeOpened` (LLD-018), 12 h before `response_due_at` (D14) | respondent | DISPUTE_RESPONSE_DUE | TRX | N | P | "12 hours left to reply about the plumbing job" — skipped if already responded (`DisputeLookup`) |
| 46 | `DisputeResolved` (LLD-018), any close | both parties (actor rule on `WITHDRAWN`) | DISPUTE_CLOSED | TRX | N | P A | "The issue about the plumbing job is closed. Open the app for the decision." |
| 47 | `VerificationStatusChanged` to `VERIFIED` / `REJECTED` / `REVOKED` (LLD-016) | worker | VERIFICATION_DECIDED | TRX | N | P A | "Police verification approved" / "Your ID proof needs a new photo" (reason in inbox) |
| 48 | `VerificationStatusChanged` to `EXPIRED` (LLD-016, 00:05 job) | worker | VERIFICATION_EXPIRED | REM | N | P A | "Your police verification has expired. Upload a new certificate." (quiet hours → 07:00) |
| 49 | `VerificationExpiring` (LLD-016 D8, 30 / 7 / 1 days) | worker | VERIFICATION_EXPIRING | REM | N | P A | "Your police verification expires in 7 days" |
| 50 | `QuoteSubmitted` (LLD-017) | customer | QUOTE_PROPOSED | TRX | H | P A | "Sujit sent a price for extra work. Please check it." (amount in inbox; expires with the quote) |
| 51 | `QuoteAccepted` / `QuoteRejected` (LLD-017) | worker | QUOTE_ANSWERED | TRX | N | P A | "Rina approved the extra work" / "…did not approve" / "The extra-work price expired" |
| 52 | `MaterialBillAdded` with status `PENDING_ACK` (LLD-017) | customer | MATERIAL_BILL_ACK | TRX | N | P A | "Sujit added a shop bill above the quote. Please check it within 24 h." (expires at `ack_due_at`) |
| 53 | `PayoutPaid` (LLD-019) | worker | PAYOUT_PAID | TRX | N | P A | "Your earnings were sent to your bank" (amount, bank last 4 in inbox) |
| 54 | `PayoutFailed` (LLD-019) | worker | PAYOUT_FAILED | TRX | N | P A | "A payout to your bank failed. Check your bank details." |
| 55 | `PayoutAccountVerified` (LLD-019) | worker | PAYOUT_ACCOUNT_VERIFIED | TRX | N | P A | "Bank account verified. Payouts start after 24 hours." |
| 56 | `PayoutAccountChanged` (LLD-019 D5) | worker | PAYOUT_ACCOUNT_CHANGED | SEC | N | P A E | "Your payout bank account was changed. Not you? Contact support." |
| 57 | `PayoutAccountDisabled` (LLD-019) | worker | PAYOUT_ACCOUNT_DISABLED | SEC | N | P A E | "Your payout bank account was disabled. Add another one in the app." |

**Deliberately not notified:** `ServiceRequestSubmitted`, `ServiceRequestCancelled` by the customer, `AdvanceRefundRequested`, `OfferDeclined`, `VisitConfirmed` for the customer, refund `FAILED` (ops queue, LLD-011), `VerificationStatusChanged` to `PENDING` / `IN_REVIEW` / `SUPERSEDED` (worker's own action), `MaterialBillAdded` with status `COVERED`, worker schedule changes (LLD-015 defines no notifiable events).

---

## 5. API contract

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/v1/notifications?limit=20&cursor=` | user | inbox, newest first; `limit` ≤ 50; cursor = last `id` (UUIDv7, time-ordered) |
| GET | `/api/v1/notifications/unread-count` | user | `{ "count": 7 }`, capped at 99 |
| POST | `/api/v1/notifications/{id}/read` | user | `204`; idempotent |
| POST | `/api/v1/notifications/read-all` | user | `{ "upToId": "…" }` optional → marks unread rows with `id ≤ upToId` (default: all) → `204` |
| PUT | `/api/v1/me/devices/current/push-token` | user | `X-Device-Id` header; `{ "pushToken": "…" }` → `204` |
| DELETE | `/api/v1/me/devices/current/push-token` | user | OS permission revoked → `204` |
| GET / PUT | `/api/v1/me/notification-preferences` | user | reminder push on/off |
| GET | `/api/v1/admin/notifications?userId=&status=FAILED&cursor=` | admin `notification.view` | delivery rows; title/body/secretUrl never returned |
| POST | `/api/v1/admin/notifications/{id}/retry` | admin `notification.retry` | `FAILED` → `PENDING`, attempts 0; audit event |

```json
// GET /api/v1/notifications?limit=2
{
  "data": [
    { "id": "01927a…", "type": "WORKER_ON_THE_WAY", "title": "Sujit is on the way",
      "body": "About 25 min. Plumbing, Shibpur.", "link": "karigar://bookings/01927a…",
      "createdAt": "2026-10-05T10:31:00Z", "read": false },
    { "id": "019279…", "type": "CONFIRM_CASH", "title": "Confirm your cash payment",
      "body": "Sujit says you paid ₹1,951 in cash for the plumbing job.", "link": "karigar://jobs/01927…/payments",
      "createdAt": "2026-10-04T15:02:00Z", "read": true }
  ],
  "meta": { "nextCursor": "019279…" }
}
```

```json
// GET /api/v1/me/notification-preferences
{ "data": { "categories": [ { "category": "REMINDER", "push": true, "editable": true },
                            { "category": "TRANSACTIONAL", "push": true, "editable": false },
                            { "category": "SECURITY", "push": true, "editable": false } ] } }
```

Inbox `title`/`body` are rendered in the user's locale **at creation**; changing language later does not re-translate old rows.

FCM message (job offer): `notification { title, body }`, `data { type, link, inboxId? }`, Android `priority: high`, `channel_id: job_offers`, `ttl` = offer `expires_at − now`, `visibility: PRIVATE`. `link` comes from a fixed route list in code (`bookings/{id}`, `jobs/{id}`, `offers/{id}`, `requests/{id}`, `notifications`), never from payload text.

**Error codes**

| HTTP | `error.code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | token empty / > 500 chars, limit > 50, bad cursor |
| 404 | `NOTIFICATION_NOT_FOUND` | not the caller's row (also for other users' ids) |
| 404 | `DEVICE_NOT_FOUND` | `X-Device-Id` is not a live device of the caller |
| 422 | `CATEGORY_NOT_OPTIONAL` | trying to switch off `SECURITY` / `TRANSACTIONAL` |
| 409 | `NOTIFICATION_NOT_RETRYABLE` | admin retry on a row that is not `FAILED` |

---

## 6. Sequence diagrams

### 6.1 Event → rows → push

```mermaid
sequenceDiagram
    participant M as Business module
    participant DB as PostgreSQL
    participant C as NotificationEventConsumer
    participant J as NotificationDeliveryJob
    participant F as FCM
    M->>DB: business change + INSERT outbox_events (VisitEnRoute) — one transaction
    DB-->>C: outbox poller delivers event
    Note over C,DB: one transaction
    C->>DB: INSERT processed_events ('notification', eventId) — conflict → stop
    C->>C: NotificationPolicy → CUSTOMER / WORKER_ON_THE_WAY; resolve user, locale, names
    C->>DB: INSERT notifications IN_APP (SENT) + PUSH (PENDING, next_attempt_at = now) ON CONFLICT DO NOTHING
    J->>DB: claim due PENDING rows (FOR UPDATE SKIP LOCKED), attempts+1, locked_until = now+60 s; commit
    J->>DB: live push tokens of user (max 5)
    J->>F: send per device (HIGH)
    alt any device accepted
        J->>DB: SENT, sent_at
    else token UNREGISTERED
        J->>DB: DevicePushTokens.disable(device); if no device left → FAILED (NO_DEVICE)
    else 5xx / timeout / 429
        J->>DB: PENDING, next_attempt_at = backoff(attempts) — or FAILED after 5
    end
```

### 6.2 Verification email (secret link)

```mermaid
sequenceDiagram
    participant I as Identity (LLD-001)
    participant C as NotificationEventConsumer
    participant J as NotificationDeliveryJob
    participant B as Brevo
    participant DB as PostgreSQL
    I->>DB: user + token hash + outbox EmailVerificationRequested { userId, link }
    DB-->>C: event
    C->>DB: EMAIL row PENDING, data.secretUrl = link (identity may now clear its outbox payload)
    J->>B: POST /v3/smtp/email (layout + text in locale + link)
    B-->>J: 201 { messageId }
    J->>DB: SENT, provider_message_id; data − 'secretUrl', body = NULL
```

---

## 7. State transitions

| From | Event | Guard | To |
|---|---|---|---|
| — | planned, channel `IN_APP` | user active | SENT (stored) |
| — | planned, `PUSH` / `EMAIL` | user active, category on, has device / email | PENDING (`next_attempt_at` = now, or 07:00 in quiet hours for `REMINDER`) |
| — | planned | user deactivated / anonymised, `REMINDER` push off, no live device, no email | SUPPRESSED (`failure_code`) |
| PENDING | provider accepted (≥ 1 device for push) | — | SENT |
| PENDING | transient failure | attempts < 5 | PENDING (backoff, D7) |
| PENDING | permanent failure, or 5th transient failure | — | FAILED |
| PENDING | claimed after `expires_at` | — | EXPIRED |
| PENDING | claimed, `skipIf` guard true (D14) | — | SUPPRESSED (`NO_LONGER_RELEVANT`) |
| FAILED | admin retry | not expired | PENDING (attempts = 0) |
| SENT (`IN_APP`) | user reads / read-all | `read_at IS NULL` | SENT, `read_at` set |

Secret fields (`data.secretUrl`, and `body` of secret types) are removed on entering SENT, FAILED or EXPIRED.

**Provider result mapping:** FCM `UNREGISTERED`, `INVALID_ARGUMENT` on the token, `SENDER_ID_MISMATCH` → INVALID_TOKEN; `UNAVAILABLE`, `INTERNAL`, `QUOTA_EXCEEDED`, timeout → TRANSIENT; `THIRD_PARTY_AUTH_ERROR` → TRANSIENT + alert. Brevo `201` → ACCEPTED; `400` invalid address → PERMANENT (`INVALID_EMAIL`); `401` / `403` → TRANSIENT + alert (key or account problem); `429`, `5xx`, timeout → TRANSIENT.

---

## 8. Error handling, idempotency & concurrency

- **Duplicate events:** `processed_events ('notification', event_id)` stops a redelivered event; `ux_notifications_dedup` is the backstop (`ON CONFLICT DO NOTHING`). The key includes `type` so one event may plan several reminders (D14); the policy never plans the same type twice for one recipient (unit-tested).
- **Consumer failure** (DB error, port lookup error) rolls back that event's rows; the outbox retries the whole event. A recipient that no longer exists or is anonymised is not an error → SUPPRESSED.
- **Two delivery workers:** rows are claimed with `FOR UPDATE SKIP LOCKED` and a 60 s lease (`locked_until`) committed before the provider call, so no DB transaction is held during HTTP. A worker that crashes mid-send leaves the lease to expire; the row is retried, which can at worst repeat one push (accepted: at-least-once delivery).
- **Push to several devices:** SENT if any device accepted. If all failed transiently the whole row retries (nothing was delivered, so no duplicates). Mixed result → SENT; the devices that failed miss it, the inbox still has it.
- **Stale messages:** `expires_at` is set for offer pushes (offer expiry), `SELECTION_REMINDER` (+2 h), `CONFIRM_VISIT` / `CONFIRM_COMPLETION` / `CONFIRM_CASH` (their 24 h windows). Checked at claim time.
- **Provider timeouts:** FCM 5 s, Brevo 10 s. The job processes rows from one batch in parallel (8 threads), HIGH rows first (`ORDER BY priority = 'HIGH' DESC, next_attempt_at`).
- **Mark read:** `UPDATE … SET read_at = now() WHERE id = :id AND user_id = :me AND channel = 'IN_APP' AND read_at IS NULL`; 0 rows and the row exists → still `204`.
- **Push token race:** `PUT push-token` clears the same token from any other `user_devices` row (unique column) and sets it on the caller's device in one transaction (inside identity's `DevicePushTokens.set`).

---

## 9. Security & privacy

- Push and email text follow D5; a unit test fails if a push template uses a denied placeholder (`{address}`, `{phone}`, `{amount}`, `{startCode}`, `{link}`, `{reason}`). Android `visibility: PRIVATE` hides content on secure lock screens.
- Outbox payloads carry ids and event facts (times, ETA, amounts) only; names and locality are looked up at planning time, so no contact data sits in the outbox ([security/03 §102](../security/03-data-privacy-pii-retention-and-compliance.md)). The only secret is the verify / reset link, held in `data.secretUrl` until the row is final, never logged, never returned by the admin API.
- Inbox endpoints filter by the caller's `user_id`; other users' ids return 404. Deep links contain UUIDs only; every target screen re-checks authorization (ADR 0018).
- Only the outbox consumer creates notifications; there is no public "send notification" endpoint (modules/05 §35).
- FCM service-account key and Brevo API key live in the secret manager, are read by the infrastructure adapters only (NI-010), and are rotated yearly. Sending domain has SPF, DKIM, DMARC (ADR 0016).
- Logs: notification id, type, channel, status, failure code; emails masked (`r***@example.com`); push tokens never logged (last 6 chars of their SHA-256 at most); title/body never logged.
- Google (FCM) and Brevo are listed in `data_processors` (ERD §52.7). Account erasure deletes the user's `notifications` and `notification_preferences` rows; other rows age out at 90 days.

---

## 10. Observability

| Type | Name | Notes |
|---|---|---|
| Counter | `notification_created_total{type, channel}` | |
| Counter | `notification_suppressed_total{reason}` | NO_DEVICE, PREFERENCE_OFF, USER_INACTIVE, NO_EMAIL |
| Counter | `notification_sent_total{channel, priority}` | |
| Counter | `notification_failed_total{channel, code}` | |
| Counter | `notification_expired_total{type}` | many offer expiries = delivery too slow |
| Histogram | `notification_send_latency_seconds{channel, priority}` | `created_at → sent_at` |
| Gauge | `notification_pending_oldest_seconds{priority}` | backlog |
| Counter | `push_token_disabled_total{reason}` | |
| Gauge | `email_sent_today` | vs Brevo daily quota |
| Counter | `notification_template_fallback_total{locale, type}` | missing bn / hi text |

**Alerts:** oldest HIGH pending > 60 s for 5 min; push failure rate > 10 % for 15 min; email failure > 5 % for 15 min (same as LLD-001's verification alert); any Brevo 401/403 or FCM auth error; `email_sent_today` > 80 % of quota; FAILED rows > 100 in an hour.

Target: event committed → HIGH push accepted by FCM, p95 < 10 s (outbox poll + 2 s job tick).

---

## 11. Test plan

| Level | Cases |
|---|---|
| Unit (policy) | every event in §4 maps to the listed recipients/types; each type at most once per recipient per event; delayed rules guarded and push-only (D14); each `IN_APP` row also writes `NotificationCreated` (D15); actor rule (customer-selected booking → inbox only); `BookingCancelled` by ADMIN → both parties |
| Unit (templates) | every type × channel has en title/body; bn/hi gaps listed (fail CI before launch); denied placeholders absent from push templates; ₹ formatted `₹1,00,000`; times in IST |
| Unit (delivery) | backoff sequence and jitter bounds; result mapping for each FCM / Brevo code; quiet hours: REMINDER at 22:30 → 07:00, TRANSACTIONAL at 22:30 → now |
| Integration (Testcontainers + fake FCM / WireMock Brevo) | event → IN_APP + PUSH rows; same event twice → no new rows; FCM 503 ×2 then 200 → SENT, attempts 3; `UNREGISTERED` → device disabled, row FAILED `NO_DEVICE`; offer push claimed after expiry → EXPIRED; REMINDER off → SUPPRESSED, inbox row still written; verify email → secretUrl and body wiped after SENT; Brevo 400 → FAILED `INVALID_EMAIL` |
| API | inbox pagination stable across new inserts; unread count; read other user's id → 404; read-all with `upToId` leaves newer rows unread; preference PUT for TRANSACTIONAL → 422; push-token PUT moves token from another user's device |
| Concurrency | 3 job instances, 1,000 pending rows → each sent once; lease expiry after simulated crash → resent once |
| Retention | rows older than 90 d deleted in batches; younger kept |
| Architecture (ArchUnit) | no module except `notification` imports `notification.infrastructure`; business modules do not depend on `notification` at all |

---

## 12. Open questions

| Question | Default until decided | Owner | Due |
|---|---|---|---|
| Handle Brevo bounce / complaint webhooks and stop mailing hard-bounced addresses | No; synchronous 400 only | Eng | Before public launch |
| Email receipts for online payments | No (quota) | Product | After pilot |
| Bengali / Hindi copy review and digits (Latin vs Bengali numerals) | Latin digits, copy by a native speaker before launch | Product | Before pilot |
| iOS app at launch (APNs key via FCM) | Supported in code; Android first | Product | Before pilot |
| SMS / WhatsApp for job offers and arrival (needs TRAI DLT templates) | Not in MVP | Product + Eng | Phase 2 |
| Batch several `WORKER_INTERESTED` pushes into one | One push per accept (max ~3 per request) | Product | Pilot review |

---

## Change log

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-05 | TBD | First draft |
| 0.2 | 2026-10-05 | TBD | Cross-LLD consistency |
