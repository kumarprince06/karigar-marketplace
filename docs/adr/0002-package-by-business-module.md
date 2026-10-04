# 0002. Package by business module with layered internals

- Status: Accepted
- Date: 2026-10-03 (recorded from existing design docs)
- Deciders: TBD
- Source: [architecture/02 §2–3, §26–27](../architecture/02-project-directory-and-package-structure.md)

## Context
Package-by-layer (`controller/`, `service/`, `repository/`) scatters each business capability across the codebase and creates accidental coupling.

## Decision
Top-level packages are business modules: `identity, customer, worker, catalog, servicerequest, matching, booking, job, payment, review, dispute, notification, admin`. Each has `api/`, `application/`, `domain/`, `infrastructure/`. Domain objects are separate from JPA entities.

## Consequences
- A capability is understood by reading one package.
- Some mapping code between domain and JPA entities.
- Do not blindly create Entity/DTO/Mapper/Port/Factory/Facade for every object; add layers only where they earn their keep.

## Alternatives considered
- Package by technical layer — rejected.
- Using JPA entities as domain objects — rejected; persistence concerns leak into business logic.
