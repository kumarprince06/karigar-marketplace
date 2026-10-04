# 0015. Integration tests on real PostgreSQL/PostGIS

- Status: Accepted
- Date: 2026-10-03 (recorded from existing design docs)
- Deciders: TBD
- Source: [testing/01 §20–21](../testing/01-testing-strategy-and-quality-engineering.md)

## Context
In-memory databases like H2 hide PostgreSQL-specific behaviour: PostGIS, constraints, locking, transactions, indexes.

## Decision
Persistence and geo logic are integration-tested against real PostgreSQL + PostGIS using Testcontainers. Geographic calculations critical to matching are never mocked.

## Consequences
Slower tests than H2; requires Docker in CI.

## Alternatives considered
H2 everywhere — rejected.
