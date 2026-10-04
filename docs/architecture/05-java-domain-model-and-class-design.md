# Java Domain Model & Class Design

**Project:** Karigar Marketplace
**Status:** Draft for Engineering Review
**Architecture:** Modular Monolith
**Backend:** Java + Spring Boot
**Database:** PostgreSQL + PostGIS
**ORM:** JPA/Hibernate
**Migration:** Flyway
**Primary Goal:** Define the Java domain model before implementation

---

## Current Model (aligned with ERD and ADRs)

The ERD ([architecture/03](../architecture/03-erd-and-production-database-design.md)) is the source of truth; the class sketches below follow it.

* **User** — `email` (login, unique case-insensitive), `passwordHash`, `phone` (unique E.164), `preferredLocale`; email + password for MVP, phone OTP later ([ADR 0016](../adr/0016-email-password-login-phone-otp-later.md)).
* **Worker** — `WorkerStatus` ONBOARDING | ACTIVE | SUSPENDED | DEACTIVATED; `WorkerProfession` (many trades, one primary, experience per trade); `WorkerRate` per trade (`RateType` VISIT | HOURLY | HALF_DAY | DAILY | PER_UNIT | MINIMUM; history kept). Trades grouped by `trade_categories`; names from `*_translations`, resolved by the backend.
* **WorkerVerification** — PENDING, IN_REVIEW, VERIFIED, REJECTED, EXPIRED, REVOKED.
* **ServiceRequest** — `addressId` + `AddressSnapshot`, `serviceZoneId`, selected problems, `Urgency` NOW | TODAY | SCHEDULED; status DRAFT, SUBMITTED, MATCHING, AWAITING_SELECTION, BOOKED, COMPLETED, CANCELLED, EXPIRED, FAILED_TO_MATCH. Addresses are saved service locations (`addressFor`, on-site contact) and must be saved before booking; service zones gate where requests are allowed.
* **WorkerMatch** — NOTIFIED → VIEWED → ACCEPTED → SELECTED | NOT_SELECTED, plus DECLINED, EXPIRED, WITHDRAWN; customer picks from up to 3 ([ADR 0017](../adr/0017-customer-picks-the-worker.md)); selection creates the booking.
* **Booking** — SINGLE_VISIT | MULTI_DAY, agreed rate snapshot, `helperCount`, `PaymentSchedule` ON_COMPLETION | DAILY | WEEKLY | MILESTONE; one live booking per request.
* **Job** — SCHEDULED, IN_PROGRESS, ON_HOLD, WORK_COMPLETED, COMPLETED, CANCELLED. **JobVisit** (≥1 per job): SCHEDULED → EN_ROUTE → ARRIVED → IN_PROGRESS → DONE, plus WORKER_NO_SHOW, CUSTOMER_NO_SHOW, RESCHEDULED, CANCELLED; 4-digit start code; per-visit amounts; no overlapping visits per worker.
* **Quote** — INITIAL | REVISION | ADDITIONAL with `QuoteLineItem`s (LABOUR, MATERIAL, HELPER, VISIT_CHARGE, TRANSPORT, DISCOUNT, OTHER); DRAFT, SUBMITTED, ACCEPTED, REJECTED, EXPIRED, SUPERSEDED, WITHDRAWN; immutable after submit. Replaces `AdditionalWork`.
* **Money** — integer paise ([ADR 0006](../adr/0006-money-integer-minor-units.md)); negatives allowed (discounts, adjustments); overflow-safe arithmetic.
* **Payment** — `PaymentMethod` UPI | CARD | NETBANKING | WALLET | CASH, `purpose`, `collectedBy`; CREATED, PENDING, SUCCEEDED, FAILED, CANCELLED. **Refund** — REQUESTED, PROCESSING, SUCCEEDED, FAILED.

See also [architecture/04](04-domain-model-aggregates-and-state-machines.md) for the state machines.

---

# 1. Purpose

[architecture/04](04-domain-model-aggregates-and-state-machines.md) defined the conceptual domain:

```text
Entity
Value Object
Aggregate
State Machine
Domain Event
Business Invariant
```

This document translates that conceptual model into Java-level structures.

The goal is to answer:

> "If we start writing Spring Boot code tomorrow, what classes should exist, what should they contain, and where should they live?"

We are still designing.

We are **not** implementing the complete application yet.

---

# 2. Core Design Principle

The project should follow:

```text
HTTP Request
     ↓
Controller
     ↓
Application Use Case
     ↓
Domain Model
     ↓
Repository Port
     ↓
Persistence Adapter
     ↓
PostgreSQL
```

The domain should not know that Spring Boot, Hibernate, PostgreSQL or REST exists.

---

# 3. Domain Package Rule

The domain package should contain business concepts.

Example:

```text
worker/
└── domain/
    ├── model/
    ├── valueobject/
    ├── event/
    ├── exception/
    └── repository/
```

The domain should preferably NOT contain:

```java
@Entity
@RestController
@Service
@Repository
@Autowired
```

The purpose is to keep business logic independent from infrastructure.

---

# 4. Entity Design

Our major entities are:

```text
User
Customer
Worker
WorkerProfession
WorkerRate
Profession
Skill
WorkerVerification
ServiceRequest
WorkerMatch
Booking
Job
JobVisit
Quote
QuoteLineItem
Payment
Refund
Review
Dispute
```

Not all of these need to be rich domain objects.

Some are mainly reference or transactional entities.

---

# 5. Common Entity Identity

Each domain entity needs a stable identifier.

Conceptually:

```java
public record UserId(UUID value) {}
```

Similarly:

```java
public record WorkerId(UUID value) {}
public record CustomerId(UUID value) {}
public record ServiceRequestId(UUID value) {}
public record BookingId(UUID value) {}
public record JobId(UUID value) {}
```

However, we should avoid blindly creating dozens of wrappers if they don't provide meaningful value.

The final implementation can use:

```java
UUID
```

directly for simpler entities and introduce strongly typed IDs where domain safety justifies them.

This remains an implementation decision.

---

# 6. User

The User represents authentication identity.

Conceptual class:

```java
public final class User {

    private final UUID id;

    private Email email;              // login; unique, case-insensitive
    private String passwordHash;      // Argon2id/bcrypt
    private Instant emailVerifiedAt;
    private PhoneNumber phone;        // unique, E.164; OTP verification later
    private Locale preferredLocale;

    private UserStatus status;

    public boolean isActive() {
        return status == UserStatus.ACTIVE;
    }

    public boolean canAuthenticate() {
        return status == UserStatus.ACTIVE;
    }

    public void suspend() {
        if (status == UserStatus.DEACTIVATED) {
            throw new InvalidUserStateException();
        }

        status = UserStatus.SUSPENDED;
    }

    public void deactivate() {
        status = UserStatus.DEACTIVATED;
    }
}
```

The important point is that callers should not freely manipulate:

```java
user.status = ...
```

The entity controls its state.

---

# 7. User Status

```java
public enum UserStatus {

    ACTIVE,
    SUSPENDED,
    DEACTIVATED
}
```

Do not assume every status transition is valid.

For example:

```text
DEACTIVATED → ACTIVE
```

may require a dedicated reactivation workflow rather than simply assigning a status.

---

# 8. Customer

Customer is the customer profile associated with a User.

```java
public final class Customer {

    private final UUID id;
    private final UUID userId;

    private String displayName;
    private String profileImage;

    public void updateProfile(
        String displayName,
        String profileImage
    ) {
        // validate and update
    }
}
```

Customer should not contain:

```text
List<Booking>
List<Payment>
List<Review>
```

unless there is a specific domain reason.

Those relationships are better retrieved through application queries.

---

# 9. Worker

Worker is a richer domain object.

```java
public final class Worker {

    private final UUID id;
    private final UUID userId;

    private List<WorkerProfession> professions; // one primary; experience per trade
    private List<WorkerRate> rates;             // per trade; history kept

    private String displayName;

    private WorkerStatus status;
    private boolean acceptingJobs;

    public void activate() {
        if (status == WorkerStatus.DEACTIVATED) {
            throw new InvalidWorkerStateException();
        }

        status = WorkerStatus.ACTIVE;
    }

    public void suspend() {
        status = WorkerStatus.SUSPENDED;
        acceptingJobs = false;
    }

    public void enableJobAcceptance() {
        ensureCanAcceptJobs();
        acceptingJobs = true;
    }

    public void disableJobAcceptance() {
        acceptingJobs = false;
    }

    private void ensureCanAcceptJobs() {
        if (status != WorkerStatus.ACTIVE) {
            throw new WorkerNotEligibleException();
        }
    }
}
```

---

# 10. Worker Status

```java
public enum WorkerStatus {

    ONBOARDING,
    ACTIVE,
    SUSPENDED,
    DEACTIVATED
}
```

Important:

```text
WorkerStatus
     ≠
acceptingJobs
```

These represent different concepts.

---

# 11. Worker Skill

Worker skills should not be represented as arbitrary strings.

Avoid:

```java
worker.addSkill("fan");
worker.addSkill("Fan Installation");
worker.addSkill("fan installation");
```

This creates inconsistent data.

Instead:

```java
public record SkillId(UUID value) {}
```

and:

```java
public final class WorkerSkill {

    private final SkillId skillId;

    public WorkerSkill(SkillId skillId) {
        this.skillId = skillId;
    }
}
```

The catalog controls valid skills. A skill can only be added for a trade the worker has registered.

Trades and rates follow the same idea:

```java
public final class WorkerProfession {

    private final UUID professionId;
    private boolean primary;
    private int experienceYears;              // 0–60
    private WorkerProfessionStatus status;    // ACTIVE | PAUSED | REMOVED
}

public record WorkerRate(
    UUID professionId,
    RateType rateType,                        // VISIT | HOURLY | HALF_DAY | DAILY | PER_UNIT | MINIMUM
    RateUnit unit,                            // required only for PER_UNIT (SQ_FT, POINT, ...)
    Money amount,                             // > 0
    Instant effectiveFrom,
    Instant effectiveTo                       // null = current
) {}
```

`Worker.changeRate(...)` closes the current rate and adds a new one; rates are never edited in place, so bookings keep the rate that was agreed.

---

# 12. Profession

Profession is reference data.

```java
public final class Profession {

    private final UUID id;
    private final String code;            // e.g. ELECTRICIAN
    private final UUID categoryId;        // trade_categories
    private RateType defaultRateType;
    private boolean active;

    public boolean isActive() {
        return active;
    }
}
```

Example:

```text
ELECTRICIAN
PLUMBER
```

Display names live in `profession_translations` and are resolved by the backend from the user's locale; the domain works with `code`.

---

# 13. Skill

```java
public final class Skill {

    private final UUID id;
    private final UUID professionId;

    private final String code;    // name in skill_translations
    private boolean active;
}
```

This ensures a skill belongs to a profession.

Example:

```text
Profession: Electrician

Skills:
- Fan Installation
- Wiring
- Switch Repair
- MCB Replacement
```

---

# 14. PhoneNumber Value Object

Avoid passing raw strings everywhere.

Instead:

```java
public record PhoneNumber(String value) {

    public PhoneNumber {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Phone number is required");
        }
        if (!value.matches("^\\+[1-9][0-9]{7,14}$")) {
            throw new IllegalArgumentException("Phone number must be E.164");
        }
    }
}
```

Phone numbers are stored in E.164 (`+919876543210`). `Email` is a similar value object, normalised to lowercase.

---

# 15. Money Value Object

Never use:

```java
double price;
float amount;
```

for financial calculations.

Preferred conceptual model:

```java
public record Money(
    long amountMinor,
    Currency currency
) {

    public Money {
        Objects.requireNonNull(currency, "Currency is required");
        // negatives are allowed: DISCOUNT lines, ledger adjustments, cash-job net earnings
    }

    public static Money zero(Currency currency) {
        return new Money(0, currency);
    }

    public Money add(Money other) {
        ensureSameCurrency(other);

        return new Money(
            Math.addExact(amountMinor, other.amountMinor),   // throws on overflow
            currency
        );
    }

    public Money subtract(Money other) {
        ensureSameCurrency(other);

        return new Money(
            Math.subtractExact(amountMinor, other.amountMinor),
            currency
        );
    }

    public boolean isNegative() {
        return amountMinor < 0;
    }

    private void ensureSameCurrency(Money other) {
        if (!currency.equals(other.currency)) {
            throw new IllegalArgumentException(
                "Currencies must match"
            );
        }
    }
}
```

Example:

```text
₹500 = 50000 paise
```

Positivity is checked by the owner of the amount (a payment or rate must be > 0, a quote total ≥ 0), not by `Money`.

---

# 16. Currency

A simple implementation can use:

```java
public enum Currency {

    INR
}
```

However, the database should store the ISO-style currency code:

```text
INR
```

rather than relying solely on a Java enum forever.

This allows future multi-country expansion without requiring a database redesign.

---

# 17. GeoPoint

Geographic coordinates are important to matching.

Conceptual domain value:

```java
public record GeoPoint(
    double latitude,
    double longitude
) {

    public GeoPoint {
        if (latitude < -90 || latitude > 90) {
            throw new IllegalArgumentException(
                "Invalid latitude"
            );
        }

        if (longitude < -180 || longitude > 180) {
            throw new IllegalArgumentException(
                "Invalid longitude"
            );
        }
    }
}
```

Persistence will translate this into:

```text
geography(Point, 4326)
```

through the PostGIS adapter.

---

# 18. TimeRange

Availability may eventually use:

```java
public record TimeRange(
    LocalTime start,
    LocalTime end
) {

    public TimeRange {
        if (!start.isBefore(end)) {
            throw new IllegalArgumentException(
                "Start must be before end"
            );
        }
    }
}
```

This represents a value, not an independent entity.

---

# 19. Worker Availability

Conceptually:

```java
public final class WorkerAvailability {

    private final UUID workerId;

    private boolean acceptingJobs;

    public void enable() {
        acceptingJobs = true;
    }

    public void disable() {
        acceptingJobs = false;
    }
}
```

The exact relationship between Worker and Availability will be finalized during implementation.

The important business rule remains:

```text
worker exists
      ≠
worker currently accepts jobs
```

---

# 20. Worker Verification

Verification should have its own model.

```java
public final class WorkerVerification {

    private final UUID id;
    private final UUID workerId;

    private VerificationType type;
    private VerificationStatus status;

    private UUID professionId;   // only for trade-specific checks

    public void approve() {
        if (status != VerificationStatus.IN_REVIEW) {
            throw new InvalidVerificationStateException();
        }

        status = VerificationStatus.VERIFIED;
    }

    public void reject(String reasonCode) {
        if (status != VerificationStatus.IN_REVIEW) {
            throw new InvalidVerificationStateException();
        }

        status = VerificationStatus.REJECTED;
    }

    public void expire() {
        if (status != VerificationStatus.VERIFIED) {
            throw new InvalidVerificationStateException();
        }

        status = VerificationStatus.EXPIRED;
    }

    public void revoke() {
        if (status != VerificationStatus.VERIFIED) {
            throw new InvalidVerificationStateException();
        }

        status = VerificationStatus.REVOKED;
    }
}
```

---

# 21. Verification Type

```java
public enum VerificationType {

    EMAIL,
    PHONE,                // later phase
    AADHAAR_EKYC,
    PAN,
    POLICE_VERIFICATION,
    SKILL_CERTIFICATE,
    ELECTRICAL_LICENSE,
    SELFIE_MATCH,
    BANK_ACCOUNT
}
```

Which are mandatory per trade is data (`verification_requirements`), not code.

---

# 22. Verification Status

```java
public enum VerificationStatus {

    PENDING,
    IN_REVIEW,
    VERIFIED,
    REJECTED,
    EXPIRED,
    REVOKED
}
```

---

# 23. ServiceRequest

This is one of the core aggregates.

```java
public final class ServiceRequest {

    private final UUID id;
    private final UUID customerId;
    private final UUID professionId;

    private String description;              // optional when problems are selected
    private Set<UUID> problemIds;            // common_problems of this trade

    private final UUID addressId;            // saved address (required)
    private final UUID serviceZoneId;        // must be ACTIVE on submit
    private final AddressSnapshot address;   // location, addressText, landmark, pincode,
                                             // floor/lift, addressFor, contact name/phone

    private Instant preferredStartAt;
    private Instant preferredEndAt;
    private Urgency urgency;

    private UUID selectedWorkerId;
    private ServiceRequestStatus status;

    public void submit() {
        ensureStatus(ServiceRequestStatus.DRAFT);

        validateSubmission();

        status = ServiceRequestStatus.SUBMITTED;
    }

    public void startMatching() {
        ensureStatus(ServiceRequestStatus.SUBMITTED);

        status = ServiceRequestStatus.MATCHING;
    }

    public void markAwaitingSelection() {   // first worker accepted
        ensureStatus(ServiceRequestStatus.MATCHING);

        status = ServiceRequestStatus.AWAITING_SELECTION;
    }

    public void book(UUID workerId) {       // customer picked a worker
        ensureStatus(ServiceRequestStatus.AWAITING_SELECTION);

        selectedWorkerId = workerId;
        status = ServiceRequestStatus.BOOKED;
    }

    public void cancel(CancellationReason reason) {
        if (!canCancel()) {
            throw new InvalidServiceRequestStateException();
        }

        status = ServiceRequestStatus.CANCELLED;
    }

    private void ensureStatus(ServiceRequestStatus expected) {
        if (status != expected) {
            throw new InvalidServiceRequestStateException();
        }
    }
}
```

---

# 24. Service Request Status

```java
public enum ServiceRequestStatus {

    DRAFT,
    SUBMITTED,
    MATCHING,
    AWAITING_SELECTION,
    BOOKED,
    COMPLETED,
    CANCELLED,
    FAILED_TO_MATCH,
    EXPIRED
}
```

---

# 25. Service Request Submission Validation

Before submission:

```text
description, voice note or at least one problem exists
selected problems belong to the request's trade
profession exists and is active
address is saved and belongs to the customer
service zone is ACTIVE
preferred time is valid for the urgency
customer exists
```

The domain should reject invalid state.

The application layer handles:

```text
authentication
loading referenced data
authorization
```

The domain handles:

```text
business invariants
```

---

# 26. Urgency

```java
public enum Urgency {

    NOW,
    TODAY,
    SCHEDULED
}
```

Do not create five different urgency levels unless the product actually needs them.

---

# 27. Cancellation Reason

```java
public enum CancellationReason {

    CUSTOMER_CHANGED_MIND,
    FOUND_ANOTHER_WORKER,
    WORKER_UNAVAILABLE,
    TOO_EXPENSIVE,
    NO_LONGER_NEEDED,
    OTHER
}
```

The final values should be determined from actual product requirements.

---

# 28. WorkerMatch

```java
public final class WorkerMatch {

    private final UUID id;
    private final UUID serviceRequestId;
    private final UUID workerId;

    private final int distanceMeters;
    private final int roundNo;

    private Money offeredVisitCharge;   // worker's visit charge for this job
    private Integer etaMinutes;         // NOW requests

    private MatchStatus status;         // starts NOTIFIED

    public void markViewed() {
        ensureStatus(MatchStatus.NOTIFIED);
        status = MatchStatus.VIEWED;
    }

    public void accept(Money visitCharge, Integer etaMinutes) {
        ensureOpen();
        this.offeredVisitCharge = visitCharge;
        this.etaMinutes = etaMinutes;
        status = MatchStatus.ACCEPTED;
    }

    public void decline(MatchDeclineReason reason) {
        ensureOpen();
        status = MatchStatus.DECLINED;
    }

    public void expire() {
        ensureOpen();
        status = MatchStatus.EXPIRED;
    }

    public void withdraw() {            // worker pulls out before selection
        ensureStatus(MatchStatus.ACCEPTED);
        status = MatchStatus.WITHDRAWN;
    }

    public void select() {              // customer picked this worker
        ensureStatus(MatchStatus.ACCEPTED);
        status = MatchStatus.SELECTED;
    }

    public void markNotSelected() {     // customer picked someone else
        ensureStatus(MatchStatus.ACCEPTED);
        status = MatchStatus.NOT_SELECTED;
    }

    private void ensureOpen() {
        if (status != MatchStatus.NOTIFIED && status != MatchStatus.VIEWED) {
            throw new InvalidMatchStateException();
        }
    }
}
```

The customer picks from up to 3 accepted workers ([ADR 0017](../adr/0017-customer-picks-the-worker.md)).

---

# 29. Match Status

```java
public enum MatchStatus {

    NOTIFIED,
    VIEWED,
    ACCEPTED,
    SELECTED,
    NOT_SELECTED,
    DECLINED,
    EXPIRED,
    WITHDRAWN
}
```

---

# 30. Match Decline Reason

```java
public enum MatchDeclineReason {

    TOO_FAR,
    BUSY,
    WRONG_SKILL,
    SCHEDULE_CONFLICT,
    NOT_INTERESTED,
    OTHER
}
```

Again, this is operational information and should not automatically become a reputation penalty.

---

# 31. Booking

```java
public final class Booking {

    private final UUID id;
    private final UUID serviceRequestId;
    private final UUID customerId;
    private final UUID workerId;
    private final UUID professionId;

    private final BookingType type;              // SINGLE_VISIT | MULTI_DAY
    private Instant scheduledStartAt;
    private Instant scheduledEndAt;
    private Integer plannedDays;                 // MULTI_DAY only

    private final AgreedRate agreedRate;         // snapshot: rateType (or QUOTE), unit, Money
    private final int helperCount;               // 0–20
    private final Money helperDayRate;
    private final PaymentSchedule paymentSchedule; // ON_COMPLETION | DAILY | WEEKLY | MILESTONE

    private BookingStatus status;

    // created only when the customer selects an ACCEPTED match
    public static Booking fromSelection(
        WorkerMatch match,
        AgreedRate agreedRate,
        ...
    ) {
        // status = CONFIRMED
    }

    public void cancel(CancellationReason reason) {

        if (!canCancel()) {
            throw new InvalidBookingStateException();
        }

        status = BookingStatus.CANCELLED;
    }

    public void reschedule(Instant newTime) {

        if (status != BookingStatus.CONFIRMED) {
            throw new InvalidBookingStateException();
        }

        if (newTime == null) {
            throw new IllegalArgumentException(
                "New time is required"
            );
        }

        scheduledStartAt = newTime;
    }
}
```

---

# 32. Booking Status

```java
public enum BookingStatus {

    CONFIRMED,
    CANCELLED,
    COMPLETED
}
```

There is no `PENDING` booking: the worker accepted before the customer selected. Only one live booking per request (partial unique index).

---

# 33. Job

The Job represents execution.

```java
public final class Job {

    private final UUID id;
    private final UUID bookingId;

    private JobStatus status;            // starts SCHEDULED

    private Instant startedAt;           // first visit check-in
    private Instant completedAt;         // customer confirmed

    public void onVisitStarted() {
        if (status == JobStatus.SCHEDULED) {
            status = JobStatus.IN_PROGRESS;
            startedAt = Instant.now();
        }
    }

    public void hold() {
        ensureStatus(JobStatus.IN_PROGRESS);
        status = JobStatus.ON_HOLD;
    }

    public void resume() {
        ensureStatus(JobStatus.ON_HOLD);
        status = JobStatus.IN_PROGRESS;
    }

    public void markWorkCompleted() {    // worker
        ensureStatus(JobStatus.IN_PROGRESS);
        status = JobStatus.WORK_COMPLETED;
    }

    public void confirmCompletion() {    // customer
        ensureStatus(JobStatus.WORK_COMPLETED);
        status = JobStatus.COMPLETED;
        completedAt = Instant.now();
    }
}
```

Arrival and start happen per visit. Every job has at least one `JobVisit` (one per day or trip):

```java
public final class JobVisit {

    private final UUID id;
    private final UUID jobId;
    private final UUID workerId;          // for the no-overlap constraint
    private final int visitNo;

    private TimeRange scheduled;          // Instant start/end
    private DayType dayType;              // VISIT | HALF_DAY | FULL_DAY
    private VisitStatus status;           // starts SCHEDULED
    private String startCodeHash;         // 4-digit code given by the site contact

    private int helpersPresent;
    private Money labourAmount;           // fixed when the customer confirms the day
    private Money helperAmount;

    public void markEnRoute() {
        ensureStatus(VisitStatus.SCHEDULED);
        status = VisitStatus.EN_ROUTE;
    }

    public void markArrived(GeoPoint location) {
        ensureStatus(VisitStatus.EN_ROUTE);
        status = VisitStatus.ARRIVED;
    }

    public void checkIn(String startCode) {
        ensureStatus(VisitStatus.ARRIVED);
        if (!startCodeMatches(startCode)) {
            throw new InvalidStartCodeException();
        }
        status = VisitStatus.IN_PROGRESS;
    }

    public void checkOut(String workSummary) {
        ensureStatus(VisitStatus.IN_PROGRESS);
        status = VisitStatus.DONE;
    }
}
```

No-show, reschedule and cancel methods follow the same pattern. Overlapping visits for one worker are rejected by a database exclusion constraint, not only in Java.

In the final implementation, `Instant.now()` should be replaced by an injected clock where deterministic tests require it.

---

# 34. Job Status

```java
public enum JobStatus {

    SCHEDULED,
    IN_PROGRESS,
    ON_HOLD,
    WORK_COMPLETED,
    COMPLETED,
    CANCELLED
}

public enum VisitStatus {

    SCHEDULED,
    EN_ROUTE,
    ARRIVED,
    IN_PROGRESS,
    DONE,
    WORKER_NO_SHOW,
    CUSTOMER_NO_SHOW,
    RESCHEDULED,
    CANCELLED
}
```

---

# 35. Quote (replaces AdditionalWork)

Every price the customer must approve is a quote: `INITIAL` (after inspection), `REVISION` (replaces an earlier quote) or `ADDITIONAL` (extra work on a running job).

```java
public final class Quote {

    private final UUID id;
    private final UUID serviceRequestId;
    private final UUID jobId;                 // set only for ADDITIONAL
    private final UUID workerId;
    private final QuoteKind kind;             // INITIAL | REVISION | ADDITIONAL
    private final UUID revisionOfQuoteId;     // set only for REVISION

    private List<QuoteLineItem> lines;
    private QuoteStatus status;               // starts DRAFT

    public void addLine(QuoteLineItem line) {
        ensureStatus(QuoteStatus.DRAFT);      // immutable after submit
        lines.add(line);
    }

    public Money total() {                    // sum of lines; DISCOUNT lines are negative
        return lines.stream()
            .map(QuoteLineItem::amount)
            .reduce(Money.zero(Currency.INR), Money::add);
    }

    public void submit() {
        ensureStatus(QuoteStatus.DRAFT);
        if (total().isNegative()) {
            throw new InvalidQuoteException();
        }
        status = QuoteStatus.SUBMITTED;
    }

    public void accept() { ensureStatus(QuoteStatus.SUBMITTED); status = QuoteStatus.ACCEPTED; }
    public void reject() { ensureStatus(QuoteStatus.SUBMITTED); status = QuoteStatus.REJECTED; }
    public void supersede() { ensureStatus(QuoteStatus.SUBMITTED); status = QuoteStatus.SUPERSEDED; }
}

public record QuoteLineItem(
    int lineNo,
    LineType type,          // LABOUR | MATERIAL | HELPER | VISIT_CHARGE | TRANSPORT | DISCOUNT | OTHER
    String description,
    BigDecimal quantity,    // > 0
    String unit,
    Money unitPrice,
    Money amount,           // quantity × unitPrice, rounded half-up to whole paise
    SuppliedBy suppliedBy   // MATERIAL lines: WORKER | CUSTOMER
) {}
```

Accepting an `INITIAL`/`REVISION` quote sets the booking's agreed rate (`QUOTE`); accepting an `ADDITIONAL` quote adds to the job's payable amount. The backend calculates every amount; client totals are ignored.

---

# 36. Quote Status

```java
public enum QuoteStatus {

    DRAFT,
    SUBMITTED,
    ACCEPTED,
    REJECTED,
    EXPIRED,
    SUPERSEDED,
    WITHDRAWN
}
```

---

# 37. Payment

```java
public final class Payment {

    private final UUID id;
    private final UUID jobId;

    private final PaymentPurpose purpose;     // VISIT_CHARGE | MATERIAL_ADVANCE | DAILY_WAGE | MILESTONE | FINAL | ADDITIONAL
    private final PaymentMethod method;       // UPI | CARD | NETBANKING | WALLET | CASH
    private final CollectedBy collectedBy;    // PLATFORM (online) | WORKER (cash)

    private final Money amount;               // > 0, computed by the backend

    private PaymentProvider provider;         // null for cash
    private String providerPaymentId;

    private PaymentStatus status;             // starts CREATED

    public void markPending() {
        if (status != PaymentStatus.CREATED) {
            throw new InvalidPaymentStateException();
        }

        status = PaymentStatus.PENDING;
    }

    public void markSucceeded() {
        if (status != PaymentStatus.PENDING) {
            throw new InvalidPaymentStateException();
        }

        status = PaymentStatus.SUCCEEDED;
    }

    public void markFailed() {
        if (status != PaymentStatus.PENDING) {
            throw new InvalidPaymentStateException();
        }

        status = PaymentStatus.FAILED;
    }
}
```

---

# 38. Payment Status

```java
public enum PaymentStatus {

    CREATED,
    PENDING,
    SUCCEEDED,
    FAILED,
    CANCELLED
}
```

Refunds do not change the payment status; refunded amounts come from the payment's `Refund` rows (REQUESTED → PROCESSING → SUCCEEDED | FAILED).

---

# 39. Payment Provider

Do not make the domain dependent on Razorpay, Cashfree, etc.

Instead:

```java
public enum PaymentProvider {

    RAZORPAY,
    CASHFREE
}
```

Provider choice is still open ([ADR 0007](../adr/0007-payment-provider-abstraction.md)).

The actual integration belongs to infrastructure.

---

# 40. Refund

```java
public final class Refund {

    private final UUID id;
    private final UUID paymentId;

    private final Money amount;

    private RefundStatus status;

    public void markProcessing() {
        ...
    }

    public void markSucceeded() {
        ...
    }

    public void markFailed() {
        ...
    }
}
```

Refund must never mutate the original payment amount.

---

# 41. Review

```java
public final class Review {

    private final UUID id;
    private final UUID jobId;
    private final UUID reviewerId;
    private final UUID revieweeId;

    private final int rating;
    private final String comment;

    private final Instant createdAt;

    public Review(
        UUID id,
        UUID jobId,
        UUID reviewerId,
        UUID revieweeId,
        int rating,
        String comment
    ) {

        if (rating < 1 || rating > 5) {
            throw new IllegalArgumentException(
                "Rating must be between 1 and 5"
            );
        }

        this.id = id;
        this.jobId = jobId;
        this.reviewerId = reviewerId;
        this.revieweeId = revieweeId;
        this.rating = rating;
        this.comment = comment;
        this.createdAt = Instant.now();
    }
}
```

Review should be designed toward immutability.

---

# 42. Dispute

```java
public final class Dispute {

    private final UUID id;
    private final UUID jobId;
    private final UUID openedBy;

    private DisputeStatus status;

    public void startReview() {

        if (status != DisputeStatus.OPEN) {
            throw new InvalidDisputeStateException();
        }

        status = DisputeStatus.UNDER_REVIEW;
    }

    public void resolve(DisputeResolution resolution) {

        if (status != DisputeStatus.UNDER_REVIEW) {
            throw new InvalidDisputeStateException();
        }

        status = DisputeStatus.RESOLVED;
    }
}
```

---

# 43. Dispute Status

```java
public enum DisputeStatus {

    OPEN,
    UNDER_REVIEW,
    RESOLVED,
    CLOSED
}
```

---

# 44. Dispute Resolution

```java
public enum DisputeResolution {

    CUSTOMER_FAVOUR,
    WORKER_FAVOUR,
    PARTIAL,
    NO_ACTION
}
```

These values are operational outcomes, not reputation scores.

---

# 45. Domain Exceptions

Do not throw generic:

```java
RuntimeException
```

for every business violation.

Create meaningful domain exceptions.

Example:

```text
domain/
└── exception/
    ├── InvalidBookingStateException
    ├── InvalidJobStateException
    ├── InvalidVisitStateException
    ├── InvalidStartCodeException
    ├── InvalidQuoteException
    ├── InvalidPaymentStateException
    ├── InvalidWorkerStateException
    ├── WorkerNotEligibleException
    ├── InvalidMatchStateException
    └── InvalidServiceRequestStateException
```

---

# 46. Domain Exception Hierarchy

Possible structure:

```java
public abstract class DomainException
        extends RuntimeException {

    protected DomainException(String message) {
        super(message);
    }
}
```

Then:

```java
public final class InvalidBookingStateException
        extends DomainException {

    public InvalidBookingStateException() {
        super("Booking cannot perform this operation in its current state.");
    }
}
```

The API layer later translates these into appropriate HTTP responses.

---

# 47. Domain Events

A domain event represents something meaningful that happened.

Example:

```java
public record JobCompletedEvent(
    UUID jobId,
    UUID bookingId,
    Instant occurredAt
) {}
```

Another:

```java
public record BookingConfirmedEvent(
    UUID bookingId,
    UUID serviceRequestId,
    UUID workerId,
    Instant occurredAt
) {}
```

---

# 48. Domain Event Principles

An event should describe:

```text
WHAT HAPPENED
```

not:

```text
WHAT SHOULD HAPPEN NEXT
```

Good:

```text
JobCompleted
```

Bad:

```text
SendWorkerPaymentAndNotifyCustomer
```

The latter mixes business event and implementation behavior.

---

# 49. Event Consumers

After:

```text
JobCompleted
```

different modules may react.

For example:

```text
JobCompleted
   ├──► Payment
   ├──► Notification
   ├──► Review
   └──► Worker earnings
```

This keeps the Job domain independent.

---

# 50. Repository Interfaces

Domain repository interfaces belong near the domain.

Example:

```java
public interface WorkerRepository {

    Optional<Worker> findById(UUID id);

    Worker save(Worker worker);
}
```

The implementation belongs in infrastructure.

```text
domain
   ↓
WorkerRepository
   ↑
WorkerPersistenceAdapter
```

---

# 51. Why Repository Interfaces Are Ports

The domain/application code should not care whether data comes from:

```text
PostgreSQL
MongoDB
Redis
External API
Test fake
```

The interface defines what the application needs.

The infrastructure supplies the implementation.

---

# 52. Query vs Command

Not every operation requires loading a rich domain aggregate.

### Command

Changes state.

Example:

```text
SelectWorker
CompleteJob
CancelServiceRequest
```

### Query

Reads data.

Example:

```text
GetWorkerProfile
SearchAvailableWorkers
GetCustomerBookings
```

Queries can use optimized read models/DTO projections where appropriate.

---

# 53. Command Object

Example:

```java
public record CreateServiceRequestCommand(
    UUID customerId,
    UUID professionId,
    UUID addressId,            // saved address; snapshot copied by the domain
    Set<UUID> problemIds,
    String description,
    Instant preferredStartAt,
    Instant preferredEndAt,
    Urgency urgency
) {}
```

The command is application-layer input.

It is not the domain entity.

---

# 54. Application Service

Example:

```java
public final class CreateServiceRequestService {

    private final CustomerRepository customerRepository;
    private final ProfessionRepository professionRepository;
    private final ServiceRequestRepository requestRepository;

    public ServiceRequestId execute(
        CreateServiceRequestCommand command
    ) {

        // Load required data

        // Validate authorization/context

        // Create domain object

        // Persist

        // Publish event

        // Return ID
    }
}
```

The application service coordinates.

It should not become a giant business-logic container.

---

# 55. Application vs Domain Responsibility

### Application Layer

Responsible for:

```text
authentication context
authorization
transaction boundary
loading aggregates
calling domain operations
saving aggregates
publishing events
```

### Domain

Responsible for:

```text
business invariants
state transitions
business behavior
value validation
domain rules
```

---

# 56. Example — Confirm Booking

The booking is confirmed by the customer selecting a worker ([ADR 0017](../adr/0017-customer-picks-the-worker.md)).

Application service:

```text
SelectWorkerService
       │
       ├── lock ServiceRequest, load WorkerMatch
       ├── authorize caller (request's customer)
       ├── match.select(); other accepted matches → markNotSelected()
       ├── request.book(workerId)
       ├── Booking.fromSelection(...), Job + planned JobVisits
       ├── save (one transaction)
       └── publish WorkerSelected, BookingConfirmed
```

Domain:

```text
match.select()
```

controls whether:

```text
ACCEPTED → SELECTED
```

is legal; the one-live-booking index backs it up.

---

# 57. Do Not Put Everything in Services

Avoid:

```java
public class BookingService {

    public void cancel(...) {

        if (booking.getStatus() == ...) {
            ...
        }

        if (...) {
            ...
        }

        if (...) {
            ...
        }

        booking.setStatus(...);
    }
}
```

When every business rule lives here, the entity becomes a data container.

Prefer:

```java
booking.cancel(reason);
```

with business invariants protected by the domain model.

---

# 58. But Do Not Create a God Entity

The opposite mistake is also bad.

Avoid making `Worker` responsible for:

```text
matching
booking
payments
reviews
notifications
disputes
```

Worker should manage worker behavior.

Each domain object should have a focused responsibility.

---

# 59. JPA Mapping Strategy

Persistence entities may look like:

```java
@Entity
@Table(name = "workers")
public class WorkerJpaEntity {

    @Id
    private UUID id;

    @Column(name = "user_id")
    private UUID userId;

    @Enumerated(EnumType.STRING)
    private WorkerStatus status;

    ...
}
```

This class belongs in:

```text
worker.infrastructure.persistence
```

not:

```text
worker.domain.model
```

---

# 60. Domain ↔ Persistence Mapping

Conceptually:

```text
Worker
  │
  │ mapper
  ▼
WorkerJpaEntity
  │
  ▼
Hibernate
  │
  ▼
PostgreSQL
```

And the reverse:

```text
PostgreSQL
   ↓
Hibernate
   ↓
WorkerJpaEntity
   ↓
Mapper
   ↓
Worker
```

---

# 61. Mapper

Example:

```java
public final class WorkerEntityMapper {

    public Worker toDomain(WorkerJpaEntity entity) {
        // convert persistence → domain
    }

    public WorkerJpaEntity toEntity(Worker worker) {
        // convert domain → persistence
    }
}
```

The mapper should not contain business rules.

---

# 62. API DTO ≠ Domain Model

Do not return:

```java
Worker
```

directly from REST controllers.

Instead:

```java
WorkerResponse
```

Example:

```java
public record WorkerResponse(
    UUID id,
    String name,
    List<WorkerTradeResponse> trades,   // resolved trade name, primary, experienceYears, current rates
    boolean verified,
    boolean acceptingJobs
) {}
```

This prevents internal domain details from leaking through the API.

---

# 63. Request DTO

Example:

```java
public record CreateServiceRequestRequest(
    UUID professionId,
    UUID addressId,
    List<UUID> problemIds,
    String description,
    Instant preferredStartAt,
    Instant preferredEndAt,
    String urgency           // NOW | TODAY | SCHEDULED
) {}
```

The controller converts it into:

```text
CreateServiceRequestCommand
```

---

# 64. Complete Request Flow

For:

```http
POST /api/v1/service-requests
```

the flow becomes:

```text
HTTP
 ↓
ServiceRequestController
 ↓
CreateServiceRequestRequest
 ↓
CreateServiceRequestCommand
 ↓
CreateServiceRequestService
 ↓
ServiceRequest domain
 ↓
ServiceRequestRepository
 ↓
Persistence Adapter
 ↓
WorkerJpaEntity / ServiceRequestJpaEntity
 ↓
PostgreSQL
```

Then:

```text
ServiceRequestSubmitted
```

may trigger asynchronous processing.

---

# 65. Matching Domain Design

Matching is more complicated because it is not simply an entity CRUD operation.

The matching application service may:

```text
1. Load service request
2. Find geographically eligible workers
3. Filter by profession
4. Filter by skills
5. Filter by availability
6. Filter by verification
7. Rank candidates
8. Create WorkerMatch records (NOTIFIED)
9. Notify workers
10. Show accepted workers to the customer (max 3); widen radius in a new round if needed
11. Customer selects one → booking
```

The ranking algorithm should initially remain simple and explainable.

---

# 66. Matching Policy

Instead of putting the algorithm directly into a controller:

```java
if (distance < ...)
```

create a domain/application policy:

```java
public interface MatchingPolicy {

    List<WorkerCandidate> rank(
        ServiceRequest request,
        List<WorkerCandidate> candidates
    );
}
```

Possible factors:

```text
distance
skill compatibility
availability
verification
reliability
customer preferences
```

The exact weighting remains an open product decision.

---

# 67. Matching Must Not Become AI Too Early

The initial implementation should not depend on:

```text
machine learning
LLMs
embeddings
complex recommendation systems
```

Start with deterministic rules.

For example:

```text
eligible
    ↓
distance
    ↓
skill compatibility
    ↓
availability
    ↓
verification
```

Later, real marketplace data can justify more sophisticated ranking.

---

# 68. Booking Concurrency

One of the most important implementation areas is:

```text
several workers accept
    ↓
customer selects one (double tap, two devices)
    ↓
only one booking can become live
```

The domain method alone is not enough.

We need:

```text
Domain rule
+
Database constraint
+
Transaction
+
Concurrency control
```

For example:

```text
UNIQUE live booking per service request
UNIQUE SELECTED match per service request
no overlapping live visits per worker
```

at the database level.

---

# 69. State Transition Enforcement

There should be multiple layers of protection.

```text
API validation
      ↓
Authorization
      ↓
Application validation
      ↓
Domain invariant
      ↓
Database constraint
```

Important business rules should not depend on only one layer.

---

# 70. Example: Job Completion

Request:

```http
POST /api/v1/jobs/{id}/complete
```

Flow:

```text
Controller
   ↓
CompleteJobCommand
   ↓
CompleteJobService
   ↓
Load Job
   ↓
Authorize Worker
   ↓
job.markWorkCompleted()
   ↓
Save
   ↓
JobCompletedEvent
```

The controller does not decide whether the job can be completed.

The domain does.

---

# 71. Example: Payment Webhook

Provider sends:

```text
payment succeeded
```

Flow:

```text
Provider
   ↓
WebhookController
   ↓
WebhookApplicationService
   ↓
Verify signature
   ↓
Check idempotency
   ↓
Load Payment
   ↓
payment.markSucceeded()
   ↓
Save
   ↓
PaymentSucceededEvent
```

The provider's raw status should not be blindly copied into the database.

---

# 72. Domain Events and Transactions

Initially:

```text
DB Transaction
    ↓
Save aggregate
    ↓
Publish Spring application event
```

As reliability requirements increase:

```text
DB Transaction
    ├── Save aggregate
    └── Save outbox event

Later:
Outbox Processor
    ↓
Publish event
```

This was defined architecturally in [architecture/01](01-system-architecture-modular-monolith.md).

---

# 73. Domain Model and Redis

Redis should not become the source of truth for domain state.

For example:

```text
Worker accepting jobs
```

may be cached in Redis.

But authoritative worker state remains PostgreSQL.

Similarly:

```text
OTP
rate limit
temporary lock
cache
```

are appropriate Redis use cases.

---

# 74. Domain Model and PostGIS

The domain uses:

```java
GeoPoint
```

rather than:

```text
PostGIS geography
```

The infrastructure knows how to translate:

```text
GeoPoint
      ↓
PostGIS geography(Point,4326)
```

This keeps database technology out of the core domain.

---

# 75. Domain Model and External Providers

The domain should not contain:

```java
RazorpayClient
CashfreeClient
BrevoClient
S3Client
GoogleMapsClient
```

Instead:

```text
Application
    ↓
Port
    ↓
Infrastructure Adapter
    ↓
External Provider
```

Example:

```java
public interface PaymentGateway {

    PaymentResult createPayment(
        PaymentRequest request
    );
}
```

Infrastructure:

```text
RazorpayPaymentGateway
CashfreePaymentGateway
```

---

# 76. Domain Package Dependency Rule

The desired dependency direction is:

```text
API
 ↓
Application
 ↓
Domain

Infrastructure
 ↓
Application / Domain interfaces
```

The domain should not depend on:

```text
API
JPA
Hibernate
Spring MVC
Redis
payment provider SDKs
PostgreSQL
```

---

# 77. Module Dependency Example

Worker should not directly depend on:

```text
Booking infrastructure
Payment infrastructure
Notification infrastructure
```

Instead:

```text
Worker
   ↓
Worker domain

Booking
   ↓
Booking domain

Payment
   ↓
Payment domain
```

Cross-module workflows are coordinated by application services/events.

---

# 78. Example Package Structure

For Worker:

```text
worker/
├── api/
│   ├── WorkerController.java
│   ├── WorkerResponse.java
│   └── WorkerMapper.java
│
├── application/
│   ├── command/
│   │   ├── CreateWorkerCommand.java
│   │   ├── UpdateWorkerProfileCommand.java
│   │   └── UpdateAvailabilityCommand.java
│   │
│   ├── query/
│   │   ├── GetWorkerProfileQuery.java
│   │   └── SearchWorkersQuery.java
│   │
│   ├── service/
│   │   ├── CreateWorkerService.java
│   │   ├── UpdateWorkerProfileService.java
│   │   └── UpdateAvailabilityService.java
│   │
│   └── port/
│       ├── in/
│       └── out/
│
├── domain/
│   ├── model/
│   │   ├── Worker.java
│   │   ├── WorkerProfession.java
│   │   ├── WorkerRate.java
│   │   └── WorkerSkill.java
│   │
│   ├── valueobject/
│   │   └── WorkerExperience.java
│   │
│   ├── event/
│   │   ├── WorkerActivated.java
│   │   └── WorkerSuspended.java
│   │
│   ├── exception/
│   │   └── InvalidWorkerStateException.java
│   │
│   └── repository/
│       └── WorkerRepository.java
│
└── infrastructure/
    ├── persistence/
    │   ├── WorkerJpaEntity.java
    │   ├── SpringDataWorkerRepository.java
    │   ├── WorkerPersistenceAdapter.java
    │   └── WorkerEntityMapper.java
    │
    └── configuration/
        └── WorkerConfiguration.java
```

---

# 79. Testing the Domain

Domain objects should be testable without:

```text
Spring Boot
PostgreSQL
Redis
Docker
HTTP
```

Example:

```java
@Test
void suspendedWorkerCannotAcceptJobs() {

    Worker worker = worker();

    worker.suspend();

    assertThrows(
        WorkerNotEligibleException.class,
        worker::enableJobAcceptance
    );
}
```

This should execute extremely quickly.

---

# 80. State Machine Tests

Every important aggregate should have state transition tests.

Example:

```text
Booking

CONFIRMED → COMPLETED     valid
CONFIRMED → CANCELLED     valid
CANCELLED → COMPLETED     invalid
COMPLETED → CANCELLED     invalid
```

Similarly:

```text
Job
JobVisit
Quote
Payment
ServiceRequest
WorkerMatch
Dispute
```

should have transition tests.

---

# 81. Property and Invariant Testing

Later, we can introduce stronger tests such as:

```text
A completed job can never return to IN_PROGRESS.
A refunded amount can never exceed captured amount.
A cancelled booking can never become confirmed.
```

These are excellent candidates for property-based testing as the system matures.

---

# 82. Architectural Tests

Use ArchUnit to enforce rules such as:

```text
domain must not depend on Spring
domain must not depend on JPA
API must not access infrastructure directly
modules must not create circular dependencies
```

Example conceptual rule:

```java
noClasses()
    .that()
    .resideInAPackage("..domain..")
    .should()
    .dependOnClassesThat()
    .resideInAnyPackage(
        "org.springframework..",
        "jakarta.persistence.."
    );
```

The exact ArchUnit rules will be defined during implementation.

---

# 83. Anti-Patterns We Will Avoid

## Anti-pattern 1 — Anemic Domain Model

```java
booking.setStatus(CONFIRMED);
```

everywhere.

---

## Anti-pattern 2 — Giant Service

```text
BookingService
    ├── booking
    ├── payment
    ├── notification
    ├── review
    ├── dispute
    ├── matching
    └── worker
```

---

## Anti-pattern 3 — Database-Driven Domain

Designing business logic purely because:

```text
"this table has this column"
```

---

## Anti-pattern 4 — Generic CRUD

```text
POST /workers
PUT /workers/{id}
DELETE /workers/{id}
```

without understanding the actual business operation.

---

## Anti-pattern 5 — Framework-Coupled Domain

```java
@Entity
@Service
@Component
@Autowired
```

inside core domain objects.

---

# 84. Practical Balance

We are intentionally using domain modeling, but we are not building an academic DDD framework.

The objective is:

```text
Good boundaries
+
Clear business behavior
+
Testability
+
Maintainability
+
Simple implementation
```

Not:

```text
100 interfaces
+
50 factories
+
20 abstractions
+
event sourcing
+
CQRS everywhere
```

---

# 85. Initial Java Model Map

The current blueprint is:

```text
IDENTITY
├── User
├── Customer
└── Worker

CATALOG
├── TradeCategory
├── Profession
├── Skill
└── CommonProblem

WORKER
├── WorkerProfession
├── WorkerRate
├── WorkerSkill
├── WorkerVerification
├── WorkerAvailability
└── ServiceArea

SERVICE
├── ServiceRequest
├── WorkerMatch
├── Booking
├── Job
├── JobVisit
└── Quote / QuoteLineItem

FINANCIAL
├── Payment
└── Refund

TRUST
├── Review
└── Dispute

SUPPORTING
├── Address
├── ServiceZone
├── Attachment
├── Notification
└── AuditEvent
```

---

# 86. What We Have Now

The design documents now form this chain:

```text
product/01 Project Scope & Vision
          ↓
product/02 User Roles & Journeys
          ↓
product/03 Functional Requirements & Business Rules
          ↓
architecture/01 System Architecture
          ↓
architecture/02 Project Directory & Package Structure
          ↓
architecture/03 ERD & Database Design
          ↓
api/01 REST API Contract
          ↓
architecture/04 Domain Model & State Machines
          ↓
architecture/05 Java Domain Model & Class Design (this document)
```

See the [documentation index](../README.md) for the full list.

---

# 87. Important Open Decisions

The following should **not** be silently finalized yet:

### Worker matching

Resolved by [ADR 0017](../adr/0017-customer-picks-the-worker.md): several workers may accept; the customer picks from up to 3. Still open (configuration, not code):

```text
How many workers receive an offer per round?
How long does an offer remain valid?
Radius steps?
```

### Pricing

Decided in the ERD: worker rates per trade, agreed rate snapshot on the booking, quotes with line items. Still open:

```text
Platform price guides vs worker asking rates?
```

### Payment

Decided in the ERD: cash allowed, several payments per job (visit charge, daily/weekly, final). Still open:

```text
Payment provider (ADR 0007)?
Authorization + capture?
```

### Verification

Decided in the ERD: checks per trade are data (`verification_requirements`). Still open:

```text
Final mandatory list per trade?
KYC vendor?
```

### Reputation

```text
Simple rating?
Reliability score?
Repeat-customer signal?
Multiple reputation dimensions?
```

These decisions should be resolved before implementation of the affected workflows.

---

# 88. Engineering Invariants

The following principles are now considered architectural invariants:

```text
1. Domain objects own important state transitions.

2. Controllers do not contain business rules.

3. Application services orchestrate use cases.

4. Domain objects do not depend on Spring/JPA.

5. Persistence entities are infrastructure concerns.

6. API DTOs are not domain entities.

7. Money never uses floating-point arithmetic.

8. Historical transactional data is preserved.

9. Important state transitions are tested.

10. Database constraints reinforce critical business invariants.

11. External providers are isolated behind interfaces.

12. Redis is not the source of truth for permanent business state.

13. Cross-module side effects use events/application orchestration.

14. We do not introduce unnecessary abstractions before complexity requires them.
```

---

# 89. Final Architecture at Code Level

The implementation should conceptually look like:

```text
                    REST API
                       │
                       ▼
                ┌──────────────┐
                │ Controllers  │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │ Application  │
                │   Use Cases  │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │   Domain     │
                │              │
                │ Entities     │
                │ ValueObjects │
                │ Policies     │
                │ State        │
                │ Events       │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │    Ports     │
                └──────┬───────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
     PostgreSQL      Redis      Providers
      + PostGIS                 Payments/SMS/etc.
```

---

# 90. Conclusion

We now have the conceptual and Java-level blueprint for the core domain.

The next major step is to define **how the application layer actually executes these operations**.

That means designing:

```text
Use Cases
Commands
Queries
Application Services
Ports
Transactions
Authorization
Domain Event Publishing
Cross-module orchestration
```

For example:

```text
CreateServiceRequest
SubmitServiceRequest
StartMatching
AcceptMatch
SelectWorker
CancelBooking
MarkVisitEnRoute
MarkVisitArrived
CheckInVisit
CompleteJob
SubmitQuote
AcceptQuote
CreatePayment
ProcessPaymentWebhook
CreateReview
OpenDispute
ResolveDispute
```

The next document should therefore be:

# [architecture/06](06-application-layer-and-use-case-design.md) — Application Layer & Use-Case Design

This will bridge the gap between the **domain model** and the **REST APIs**, and will define exactly how a production Spring Boot request travels through the system.
