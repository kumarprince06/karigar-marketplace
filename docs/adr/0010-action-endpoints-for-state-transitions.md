# 0010. Action endpoints for state transitions

- Status: Accepted
- Date: 2026-10-03 (recorded from existing design docs)
- Deciders: TBD
- Source: [api/01 §37](../api/01-rest-api-contract-endpoints-and-error-model.md)

## Context
`PATCH /jobs/{id} {"status": "..."}` lets the client request arbitrary state transitions.

## Decision
State changes use explicit action endpoints, e.g. `POST /jobs/{id}/complete`, `POST /bookings/{id}/cancel`. The backend owns and validates every transition.

## Consequences
More endpoints, but each maps to one use case and one authorization rule.

## Alternatives considered
Generic `PATCH` of a status field — rejected.
