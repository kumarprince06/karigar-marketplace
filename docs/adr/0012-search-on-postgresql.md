# 0012. Search on PostgreSQL/PostGIS, no dedicated search engine

- Status: Accepted
- Date: 2026-10-03 (recorded from existing design docs)
- Deciders: TBD
- Source: [modules/09 §52–53](../modules/09-search-discovery-and-worker-profile.md)

## Context
MVP search volume and catalogue size are small.

## Decision
Search and discovery run on PostgreSQL + PostGIS with Redis for selected caching, inside the Spring Boot application.

## Consequences
Evolution path: search projections → OpenSearch/Elasticsearch only when PostgreSQL measurably falls short.

## Alternatives considered
Elasticsearch/OpenSearch, separate search service, vector DB, recommendation engine — deferred.
