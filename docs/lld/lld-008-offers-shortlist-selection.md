# LLD-008: Worker Job Inbox (Accept / Decline / Withdraw), Customer Shortlist and Worker Selection

| Field | Value |
|---|---|
| Status | Draft |
| Owner | TBD |
| Reviewers | TBD |
| Module | `matching` (offers, shortlist) + `booking` (selection creates the booking) |
| Parent HLD | [ADR 0017](../adr/0017-customer-picks-the-worker.md), [modules/01 §30–38](../modules/01-matching-engine-and-geospatial-discovery.md), [modules/02](../modules/02-service-request-booking-and-job-execution.md), [architecture/03 §32–35, §40.1](../architecture/03-erd-and-production-database-design.md) |
| Requirements | FR-WRK-007, FR-WRK-008, FR-MAT-002 (customer picks), FR-JOB-003 (visits) |
| Depends on | LLD-004 (rates, public profile), LLD-006 (request lifecycle, advance), LLD-007 (offers, runs), LLD-012 (`CustomerRatingLookup`), LLD-014 (`MediaUrls`), LLD-015 (`WorkerAvailabilityLookup`) |
| Used by | LLD-009 (booking, job and visits continue from here), LLD-013 (notifications) |
| Last updated | 2026-10-03 |

---

## 1. Context & scope

Offers created by matching (LLD-007) land in the **worker's job inbox** (push + list, not real-time dispatch). Interested workers **accept**, choosing one of their own rates and when they can come. The customer sees up to 3 interested workers on a **shortlist** and **picks one**. That single action confirms the worker and creates the booking, the job and the first visit.

**In scope**

- Worker inbox: list, open (→ VIEWED), accept, decline, withdraw before selection
- Customer shortlist and reminders to choose
- Selection transaction: confirm worker, close other offers, create booking + job + first visit, stop matching
- What each side can see before and after selection

**Out of scope:** booking / job / visit behaviour after creation (start code, check-in/out, cancellations, extra days → LLD-009), payment of the bill (LLD-010/011), notification delivery (LLD-013).

**Decisions**

| # | Decision | Default (configurable) |
|---|---|---|
| D1 | On accept, the worker **chooses one of their current rates** for the trade (e.g. VISIT ₹200, or DAILY ₹850) — no new price can be typed in. Prices that need inspection are handled later by a quote. | — |
| D2 | On accept, the worker gives **`availableFrom`** — when they can arrive, inside the customer's window (NOW: within the 3-hour window). | — |
| D3 | A worker may have at most **3 accepted, not-yet-selected** offers at once (stops "accept everything"). | 3 |
| D4 | An accepted offer stays valid until the customer selects, the request ends, or the worker **withdraws**. No time slot is held before selection; availability is re-checked at selection. | — |
| D5 | Selection always creates a **SINGLE_VISIT** booking with the chosen rate as the agreed rate. Multi-day work becomes MULTI_DAY through a quote or by adding days (LLD-009). | — |
| D6 | **Contact details are exchanged only after selection**: the worker gets the full address and on-site contact; the customer gets the worker's phone. Masked calling is a later phase. | — |
| D7 | Customers are reminded to choose: push when each worker accepts, and a reminder 15 min after the first accept (NOW / EMERGENCY) or 1 h (TODAY / SCHEDULED). | 15 min / 1 h |

---

## 2. Classes / components

```text
com.karigar.matching
├── api/
│   ├── WorkerOfferController        -- /api/v1/workers/me/offers/**
│   ├── ShortlistController          -- /api/v1/service-requests/{id}/shortlist, /select-worker
│   └── dto/ OfferSummary, OfferDetail, AcceptOfferRequest, DeclineOfferRequest, ShortlistView
├── application/
│   ├── OfferResponseService         -- view, accept, decline, withdraw
│   ├── ShortlistQueryService        -- accepted offers + public worker profiles (LLD-004)
│   ├── SelectWorkerService          -- the selection transaction (§5.2)
│   ├── SelectionReminderJob         -- every 1 min, ShedLock
│   └── port/
│       ├── ServiceRequestLifecycle  -- LLD-006: toAwaitingSelection, backToMatching, book
│       ├── WorkerRates              -- LLD-004: current rates for (worker, trade)
│       ├── WorkerEligibility        -- LLD-004/007: ACTIVE, job_eligible, not restricted
│       ├── PublicWorkerQuery        -- LLD-004 public profile projection
│       ├── WorkerAvailabilityLookup -- LLD-015: canTakeBooking(worker, visitStart, visitEnd) (time off + capacity)
│       ├── CustomerRatingLookup     -- LLD-012: forCustomer(customerId) → rating, null below 3 reviews
│       ├── BookingCreation          -- booking module: createFromSelection(...) (LLD-009 owns the internals)
│       ├── MediaUrls                -- LLD-014 MediaUrls.links(ids, variant, viewer): short-lived signed URLs for request photos / voice note
│       └── OutboxWriter, Clock
└── domain/
    ├── WorkerMatch                  -- accept(), decline(), withdraw(), select(), notSelected()
    └── event/ OfferAccepted, OfferDeclined, OfferWithdrawn, WorkerSelected, WorkerNotSelected {workerId, matchId, reason},
               SelectionReminderDue {requestId, customerId}, BookingConfirmed {bookingId, customerId, workerId}
               -- outbox, ids + aggregateVersion only (LLD-022 D8)

com.karigar.booking
└── application/ BookingCreationService implements BookingCreation
       createFromSelection(request, match, chosenRate, availableFrom) → booking CONFIRMED + job SCHEDULED + visit #1
```

`WorkerMatch` transitions:

```java
public void accept(ChosenRate rate, Instant availableFrom, TimeWindow requestWindow, Instant now) {
    requireStatus(NOTIFIED, VIEWED);
    if (!expiresAt.isAfter(now)) throw new OfferExpired();
    if (!requestWindow.contains(availableFrom) || availableFrom.isBefore(now)) throw new AvailableTimeOutsideWindow();
    this.offeredRate = rate;               // must be one of the worker's current rates (checked by service)
    this.availableFrom = availableFrom;
    this.status = ACCEPTED;
    this.respondedAt = now;
    events.add(new OfferAccepted(id, requestId, workerId));
}

public void withdraw(Instant now) {         // only before the customer selects
    requireStatus(ACCEPTED);
    status = WITHDRAWN;
    events.add(new OfferWithdrawn(id, requestId, workerId));
}
```

---

## 3. Data model

`worker_matches` is defined in LLD-007. This LLD replaces `offered_visit_charge_minor` with the chosen rate (now also in the ERD):

```sql
-- V6_3__offer_rate.sql
ALTER TABLE worker_matches
    DROP COLUMN offered_visit_charge_minor,
    ADD COLUMN offered_rate_type    VARCHAR(20)
        CHECK (offered_rate_type IN ('VISIT','HOURLY','HALF_DAY','DAILY','PER_UNIT','MINIMUM')),
    ADD COLUMN offered_unit         VARCHAR(20),
    ADD COLUMN offered_amount_minor BIGINT CHECK (offered_amount_minor > 0),
    ADD COLUMN reminder_sent_at     TIMESTAMPTZ,
    ADD CONSTRAINT ck_matches_accepted_has_terms
        CHECK (status NOT IN ('ACCEPTED','SELECTED','NOT_SELECTED')
               OR (offered_rate_type IS NOT NULL AND offered_amount_minor IS NOT NULL AND available_from IS NOT NULL));

CREATE INDEX ix_matches_worker_accepted ON worker_matches (worker_id) WHERE status = 'ACCEPTED';
```

Decline reasons use `reason_codes` category `OFFER_DECLINE`: `TOO_FAR`, `BUSY_AT_THAT_TIME`, `NOT_MY_WORK`, `PRICE_TOO_LOW`, `UNSAFE_AREA`, `OTHER`.

Selection writes (through the booking module, LLD-009 owns the tables):

| Table | Row |
|---|---|
| `bookings` | `CONFIRMED`, `SINGLE_VISIT`, agreed rate = chosen rate, `emergency_surcharge_minor` and `advance_paid_minor` from the request, `payment_schedule = ON_COMPLETION` |
| `jobs` | `SCHEDULED` |
| `job_visits` | visit 1, `SCHEDULED`, `scheduled_start_at = available_from`, end = start + estimate (sum of problem estimates, min 1 h, default 2 h); protected by the overlap exclusion constraint |

---

## 4. API contract

### 4.1 Worker inbox (worker token)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/workers/me/offers?status=OPEN` | live offers (NOTIFIED / VIEWED), newest first; `status=ACCEPTED` for ones awaiting the customer |
| GET | `/api/v1/workers/me/offers/{matchId}` | detail; first call sets `VIEWED` |
| POST | `/api/v1/workers/me/offers/{matchId}/accept` | accept with rate + time |
| POST | `/api/v1/workers/me/offers/{matchId}/decline` | `{ "reasonCode": "TOO_FAR" }` |
| POST | `/api/v1/workers/me/offers/{matchId}/withdraw` | pull out before selection |

Offer detail (what a worker sees **before** selection):

```json
{
  "data": {
    "matchId": "…", "status": "VIEWED", "expiresAt": "2026-10-03T09:30:00Z",
    "trade": "প্লাম্বার", "urgency": "TODAY",
    "problems": ["কল দিয়ে জল পড়ছে"], "description": "Kitchen tap leaking since morning",
    "photos": ["https://media…signed"], "voiceNote": null,
    "locality": "Shibpur", "distanceKm": 3.5,
    "propertyType": "FLAT", "floorNumber": 2, "hasLift": false,
    "customerWindow": { "start": "2026-10-03T10:30:00Z", "end": "2026-10-03T13:30:00Z" },
    "priceGuide": { "minMinor": 15000, "maxMinor": 35000 },
    "emergencySurchargeMinor": 0,
    "myRates": [ { "rateType": "VISIT", "amountMinor": 20000 }, { "rateType": "MINIMUM", "amountMinor": 30000 } ],
    "customer": { "firstName": "Anjali", "jobsBooked": 4, "rating": null }
  }
}
```

`customer.rating` comes from `CustomerRatingLookup.forCustomer` ([LLD-012](lld-012-reviews-ratings.md)); it is `null` until the customer has 3 counted reviews. Photo / voice-note URLs are built with `MediaUrls` ([LLD-014](lld-014-media-upload.md)).

Not shown before selection: house number, building, street, landmark, exact location, customer's full name, phone, contact person.

Accept:

```json
{ "rate": { "rateType": "VISIT", "amountMinor": 20000 }, "availableFrom": "2026-10-03T11:00:00Z", "note": "Will bring washer and tape" }
```

### 4.2 Customer shortlist (customer token)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/service-requests/{id}/shortlist` | accepted workers (max 3) |
| POST | `/api/v1/service-requests/{id}/select-worker` | `{ "matchId": "…" }` + `Idempotency-Key` → `201` booking |

Shortlist item (public profile from LLD-004 + offer terms):

```json
{
  "matchId": "…", "workerId": "…", "displayName": "Sujit Das", "photoUrl": "…",
  "primaryTrade": "Electrician", "experienceYears": 8,
  "rating": { "average": 4.7, "count": 38 }, "jobsCompleted": 132,
  "badges": ["ID_VERIFIED", "POLICE_VERIFIED"], "spokenLanguages": ["bn", "hi"],
  "distanceKm": 2.0, "isFavourite": true,
  "offer": { "rateType": "VISIT", "amountMinor": 20000, "availableFrom": "2026-10-03T11:00:00Z", "note": "…" }
}
```

Default order: ranking score (LLD-007); the app can sort by earliest time, price or rating.

Select response:

```json
{
  "data": {
    "bookingId": "…", "jobId": "…", "status": "CONFIRMED",
    "worker": { "displayName": "Sujit Das", "phone": "+919830011122", "photoUrl": "…" },
    "firstVisit": { "start": "2026-10-03T11:00:00Z", "end": "2026-10-03T13:00:00Z" },
    "agreedRate": { "rateType": "VISIT", "amountMinor": 20000 },
    "advancePaidMinor": 9900
  }
}
```

### 4.3 Error codes

| HTTP | `error.code` | When |
|---|---|---|
| 404 | `OFFER_NOT_FOUND` | not the worker's offer |
| 409 | `OFFER_EXPIRED` | accept / decline after `expires_at` |
| 409 | `OFFER_NOT_ACTIONABLE` | wrong status (already accepted, closed, selected…) |
| 409 | `TOO_MANY_PENDING_ACCEPTS` | worker already has 3 accepted, unselected offers |
| 422 | `RATE_NOT_OFFERED` | chosen rate isn't one of the worker's current rates for this trade |
| 422 | `AVAILABLE_TIME_OUTSIDE_WINDOW` | `availableFrom` before now or outside the customer's window |
| 422 | `WORKER_BUSY_AT_TIME` | overlaps an existing visit |
| 403 | `WORKER_NOT_ELIGIBLE` | worker no longer ACTIVE / job_eligible / restricted |
| 404 | `SERVICE_REQUEST_NOT_FOUND` | not the customer's request |
| 409 | `REQUEST_NOT_AWAITING_SELECTION` | request cancelled, expired, already booked |
| 409 | `MATCH_NO_LONGER_AVAILABLE` | chosen worker withdrew, became ineligible or busy, is on time off or at capacity (`details.reason` `WORKER_ON_TIME_OFF` / `WORKER_AT_CAPACITY`, LLD-015) — app refreshes the shortlist |

---

## 5. Sequence diagrams

### 5.1 Worker accepts

```mermaid
sequenceDiagram
    participant WA as Worker app
    participant O as OfferResponseService
    participant DB as PostgreSQL
    participant L as ServiceRequestLifecycle
    WA->>O: POST /offers/{id}/accept (rate, availableFrom)
    Note over O,DB: one transaction
    O->>DB: SELECT match FOR UPDATE (worker owns it, NOTIFIED/VIEWED, not expired)
    O->>DB: rate ∈ worker's current rates? accepted-unselected < 3? no overlapping visit?
    O->>DB: UPDATE match → ACCEPTED (rate, available_from)
    O->>L: request MATCHING → AWAITING_SELECTION (guarded; no-op if already)
    O->>DB: INSERT outbox (OfferAccepted)
    O-->>WA: 200
    Note over DB: push to customer: "Sujit Das is interested — can come at 4:30 pm"
```

### 5.2 Customer selects a worker

```mermaid
sequenceDiagram
    participant CA as Customer app
    participant S as SelectWorkerService
    participant DB as PostgreSQL
    participant B as BookingCreation (LLD-009)
    CA->>S: POST /select-worker (matchId, Idempotency-Key)
    Note over S,DB: one transaction
    S->>DB: SELECT service_request FOR UPDATE (owner, AWAITING_SELECTION, not expired)
    S->>DB: SELECT match FOR UPDATE (ACCEPTED, belongs to request)
    S->>DB: worker still ACTIVE, job_eligible, not restricted?
    S->>DB: WorkerAvailabilityLookup.canTakeBooking(worker, visitStart, visitEnd) — locks worker_availability FOR UPDATE;<br/>no time off in the window, open jobs < max_open_jobs (else 409 MATCH_NO_LONGER_AVAILABLE)
    S->>DB: UPDATE match → SELECTED
    S->>DB: UPDATE other ACCEPTED/NOTIFIED/VIEWED → NOT_SELECTED / EXPIRED (close_reason OTHER_SELECTED)
    S->>B: createFromSelection(request, match)
    B->>DB: INSERT bookings (CONFIRMED), jobs (SCHEDULED), job_visits #1 (overlap constraint)
    S->>DB: request → BOOKED, selected_worker_id; matching_runs → STOPPED
    S->>DB: INSERT outbox (WorkerSelected, WorkerNotSelected ×n (offers that were ACCEPTED only), BookingConfirmed {bookingId, customerId, workerId})
    S->>DB: INSERT idempotency_records
    S-->>CA: 201 booking + worker phone
    Note over DB: push to selected worker with full address + contact; "not selected" to workers who had accepted
```

Working hours are **not** re-checked at selection: the worker chose `availableFrom` when accepting (D2, [LLD-015 §5.3](lld-015-worker-availability-schedule.md)).

If the visit insert violates the overlap exclusion constraint (the worker got booked elsewhere since accepting), the whole transaction rolls back, the match is set `WITHDRAWN` (`close_reason = WORKER_BUSY`) in a new transaction, and the customer gets `409 MATCH_NO_LONGER_AVAILABLE`.

### 5.3 Worker withdraws

```mermaid
sequenceDiagram
    participant WA as Worker app
    participant O as OfferResponseService
    participant DB as PostgreSQL
    participant L as ServiceRequestLifecycle
    WA->>O: POST /offers/{id}/withdraw
    O->>DB: match ACCEPTED → WITHDRAWN (FOR UPDATE)
    alt no ACCEPTED offers left on the request
        O->>L: AWAITING_SELECTION → MATCHING
        O->>DB: matching_runs WAITING_SELECTION → RUNNING (next round now, LLD-007)
    end
    O->>DB: outbox OfferWithdrawn (customer told; shortlist refreshes)
```

---

## 6. State transitions

| From | Event | By | Guard | To |
|---|---|---|---|---|
| NOTIFIED | open detail | worker | — | VIEWED |
| NOTIFIED / VIEWED | accept | worker | not expired, rate valid, time in window, no overlap, < 3 pending | ACCEPTED |
| NOTIFIED / VIEWED | decline | worker | not expired | DECLINED (never re-offered for this request) |
| ACCEPTED | withdraw | worker | request not booked | WITHDRAWN |
| ACCEPTED | customer selects this offer | customer | request AWAITING_SELECTION, worker eligible, no overlap | SELECTED |
| ACCEPTED | customer selects another offer | system | — | NOT_SELECTED |
| NOTIFIED / VIEWED | customer selects another worker | system | — | EXPIRED (`close_reason = OTHER_SELECTED`) |
| any live | request cancelled / expired | system (LLD-007) | — | EXPIRED / NOT_SELECTED |

Request side (LLD-006): first ACCEPTED → `AWAITING_SELECTION`; last ACCEPTED withdrawn → `MATCHING`; selection → `BOOKED`.

A worker who withdraws often is tracked (`withdraw_rate` in reputation, modules/07); withdrawing **after** selection is a booking cancellation by the worker (LLD-009, may give a strike).

---

## 7. Error handling, idempotency & concurrency

- **Select vs withdraw / cancel / expiry:** the request row and the match row are both locked (`FOR UPDATE`, always in the order request → match to avoid deadlocks); every status change is guarded; exactly one outcome wins.
- **Double tap on two different workers:** the request row lock serialises them; the second sees `BOOKED` → `409 REQUEST_NOT_AWAITING_SELECTION`. Backstops: `ux_matches_selected` and the one-booking-per-request index.
- **Idempotency:** `select-worker` requires `Idempotency-Key`; a retry returns the same `201`. Accept / decline / withdraw are naturally idempotent for the same target state (repeat → `200` with current state).
- **Worker booked elsewhere since accepting:** caught by the overlap exclusion constraint at selection (§5.2).
- **Capacity race:** `canTakeBooking` locks the worker's `worker_availability` row `FOR UPDATE`, so two selections of the same worker serialise and the second sees the new open job (LLD-015 D8).
- **Reminders:** `SelectionReminderJob` sets `reminder_sent_at` and writes outbox `SelectionReminderDue {requestId, customerId}` in the same transaction (LLD-013 sends it).
- **Not-selected notice:** `WorkerNotSelected` goes only to workers whose offer was `ACCEPTED`; offers still `NOTIFIED` / `VIEWED` just expire silently.
- **Worker becomes ineligible after accepting** (restricted, verification expired, suspended): selection checks eligibility → `MATCH_NO_LONGER_AVAILABLE`; a listener also withdraws that worker's accepted offers when they become ineligible.
- **Pending-accept limit:** counted with the worker's accepted offers locked (`SELECT … FOR UPDATE` on the worker's ACCEPTED rows).

---

## 8. Security & privacy

- Workers act only on their own offers (`worker_id` from the token); customers only on their own requests.
- **Before selection** workers see locality, distance (0.5 km steps), property type, floor / lift, problems, photos and the customer's first name + number of past bookings — enough to decide, not enough to find or contact the customer.
- **After selection** the booking endpoints (LLD-009) reveal the full address, location and on-site contact to the selected worker only, and the worker's phone to the customer. Not-selected workers lose access to the photos (signed URLs expire in 15 min and are not re-issued).
- Shortlist shows only the public profile fields (LLD-004); distance is rounded; worker base location is never exposed.
- All offer actions are recorded in `worker_matches` timestamps; selection writes an `audit_events` row.

---

## 9. Observability

| Type | Name | Notes |
|---|---|---|
| Counter | `offer_response_total{urgency, action}` | accept, decline (by reason), expire, withdraw |
| Histogram | `offer_time_to_accept_seconds{urgency}` | |
| Histogram | `selection_time_seconds{urgency}` | first accept → customer selects |
| Counter | `selection_conflict_total{reason}` | withdrawn, busy, ineligible, already booked |
| Gauge | `requests_awaiting_selection{zone}` | customers who haven't chosen yet |
| Counter | `decline_reason_total{reason}` | e.g. many `PRICE_TOO_LOW` → price guide too low |

Alert: `selection_conflict_total{reason="busy"}` > 10 % of selections (workers accepting too much); requests awaiting selection > 2 h median (customers not choosing — UX problem).

---

## 10. Test plan

| Level | Cases |
|---|---|
| Unit | accept with rate not in worker's list → 422; `availableFrom` outside window / in the past → 422; withdraw only from ACCEPTED |
| Integration (Testcontainers) | first accept moves request to AWAITING_SELECTION; select creates booking + job + visit 1 with snapshot and advance; others → NOT_SELECTED / EXPIRED; matching run STOPPED; outbox events written |
| Privacy | offer detail has no house number / phone / full name; select response has worker phone; not-selected worker gets 404 on booking endpoints |
| Availability (LLD-015) | worker on time off in the visit window → 409 `WORKER_ON_TIME_OFF`; worker at `max_open_jobs` → 409 `WORKER_AT_CAPACITY`; two parallel selections of the same worker with one slot left → one booking |
| Concurrency | select vs worker withdraw at the same moment → one consistent result; two selects (different workers) in parallel → one booking; worker double-booked between accept and select → 409 and match WITHDRAWN |
| Limits | 4th accept while 3 pending → 409; after one is selected or not selected, a new accept works |
| Lifecycle | last accepted offer withdrawn → request back to MATCHING and next round runs; request expires with accepted offers → all closed, advance refund event (LLD-006) |
| Idempotency | same `Idempotency-Key` on select → same booking id |

---

## 11. Open questions

| Question | Default until decided | Owner | Due |
|---|---|---|---|
| Masked calling between customer and worker (privacy, keep on platform) | Real numbers shared after selection in MVP | TBD | Phase 2 |
| Let the customer message a worker on the shortlist before choosing | No (keeps it simple; photos + note on the offer) | TBD | After pilot |
| Auto-select if the customer doesn't choose (e.g. favourite or top-ranked) | No — ADR 0017 (customer picks); reminders only | Product | — |

---

## Change log

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-03 | TBD | First draft |
| 0.2 | 2026-10-05 | TBD | Integrated with LLD-012–022: selection re-check `canTakeBooking` (015), `SelectionReminderDue` outbox, `WorkerNotSelected` only to ACCEPTED offers, id-only `BookingConfirmed` payload, customer rating via `CustomerRatingLookup` (012), `MediaUrls` → LLD-014 |
