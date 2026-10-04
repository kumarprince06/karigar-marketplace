# 0017. Customer picks the worker from those who accept

- Status: Accepted
- Date: 2026-10-03
- Deciders: TBD
- Resolves: the open selection question in [0011](0011-explainable-rule-based-matching.md); the conflict between [product/01](../product/01-project-scope-and-vision.md) (customer chooses) and [product/04](../product/04-mvp-scope-release-plan-and-future-phases.md) (platform dispatches)

## Context
Customers let workers into their homes. In local markets trust comes from seeing who is coming and choosing them. The docs disagreed on whether the platform assigns a worker or the customer chooses.

## Decision
- The platform notifies nearby, verified, available workers with the right trade (rule-based matching, [0011](0011-explainable-rule-based-matching.md)).
- Workers who are interested **accept** and can state their visit charge and how soon they can arrive.
- The customer sees up to **3** accepted workers (photo, rating, jobs done, distance, badges, visit charge, arrival time) and **picks one**. That creates the booking.
- The others are told the job went to someone else.
- If nobody accepts in time, matching widens the radius and notifies more workers. If still nobody, the customer is told and can retry or change the time.
- Shortlist size, response window and radius steps are configuration, not code.
- The customer can also book a worker from their "My workers" list directly; that worker gets the request first.

## Consequences
- Booking is created only by the customer's selection, so two workers can never both be confirmed (enforced by the one-live-booking index).
- `worker_matches` statuses: `NOTIFIED → VIEWED → ACCEPTED → SELECTED | NOT_SELECTED`, plus `DECLINED`, `EXPIRED`, `WITHDRAWN`.
- Slightly slower than auto-assign for urgent jobs; mitigated by showing the shortlist as soon as the first worker accepts.

## Alternatives considered
- Auto-assign the first worker who accepts — faster, but no customer choice. Rejected.
- Auto-assign for "Now" and customer pick for later — rejected to keep one simple, trusted flow.
