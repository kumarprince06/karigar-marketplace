# 0001. Modular monolith instead of microservices

- Status: Accepted
- Date: 2026-10-03 (recorded from existing design docs)
- Deciders: TBD
- Source: [architecture/01 §3, §61–62](../architecture/01-system-architecture-modular-monolith.md)

## Context
The platform serves local blue-collar workers across many trades; the MVP launches with two categories (electrician, plumber) in one locality. Separate services would bring networking, distributed transactions, service discovery and distributed debugging before the product has proven the need.

## Decision
Build one Spring Boot application, one deployment, split into logically isolated business modules with clear public interfaces and controlled dependencies.

## Consequences
- Simple deploy, debug and local transactions.
- Module boundaries must be enforced by code structure and review (see [0002](0002-package-by-business-module.md)), otherwise it degrades into a big ball of mud.
- Modules are shaped so they can be extracted later if a real bottleneck appears.

## Alternatives considered
- Microservices per domain (worker, booking, payment, matching, notification) — rejected for MVP.
- Also deliberately not started with: Kubernetes, Kafka, Elasticsearch, MongoDB, GraphQL, service mesh, CQRS/event sourcing everywhere.
