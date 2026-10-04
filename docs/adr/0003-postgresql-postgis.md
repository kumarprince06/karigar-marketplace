# 0003. PostgreSQL + PostGIS as the system of record

- Status: Accepted
- Date: 2026-10-03 (recorded from existing design docs)
- Deciders: TBD
- Source: [architecture/03 §20–21, §90–91](../architecture/03-erd-and-production-database-design.md), [modules/01 §9, §83](../modules/01-matching-engine-and-geospatial-discovery.md)

## Context
The domain needs relational transactions, strong constraints, financial consistency, joins across request→match→booking→job→payment→review, and geospatial queries ("workers within X km") together.

## Decision
- PostgreSQL is the single authoritative store. PostGIS handles location.
- Locations use `geography(Point, 4326)` so distances are in metres; spatial columns get GIST indexes.
- Schema changes via Flyway.

## Consequences
- One database for transactions and geo — no sync between stores.
- Geo correctness must be tested against real PostGIS (see [0015](0015-integration-tests-on-real-postgres.md)).

## Alternatives considered
MongoDB, Cassandra, Elasticsearch, Neo4j — rejected; none gives transactions, constraints and geo together.
