# 0011. Explainable rule-based matching with small-batch offers

- Status: Accepted
- Date: 2026-10-03 (recorded from existing design docs)
- Deciders: TBD
- Source: [modules/01 §15, §29, §40, §83–85](../modules/01-matching-engine-and-geospatial-discovery.md), [architecture/01 §30](../architecture/01-system-architecture-modular-monolith.md)

## Context
Early marketplace data is too thin for ML, and both sides need to understand why a worker was or was not offered a job.

## Decision
- Eligibility filters first (skill, verification, availability, distance via PostGIS), then explainable ranking.
- Offers go out in small configurable batches (round 1 top N → round 2 next N…) with progressive radius expansion.
- Marketplace policy (N, radii, expiry) is configuration, not hard-coded in the domain.

## Consequences
- Ranking can evolve (travel time, reliability, completion rate) without changing the domain model.

## Open
Docs disagree on radius rounds (2/5/10/20 km vs 2/5/10 km), offer expiry (5 vs 2 min) and scoring weights. Selection is decided in [0017](0017-customer-picks-the-worker.md): the customer picks from up to 3 workers who accept.

## Alternatives considered
ML/AI ranking; dedicated matching microservice; real-time traffic routing — deferred.
