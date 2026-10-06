# 0018. UUIDv7 identifiers, generated in the application

- Status: Accepted
- Date: 2026-10-05
- Deciders: TBD

## Context
Every table already uses `UUID` primary keys, and APIs return them as ids ([architecture/03 §5](../architecture/03-erd-and-production-database-design.md), [api/01](../api/01-rest-api-contract-endpoints-and-error-model.md)). Which UUID version was left open. Random v4 ids scatter inserts across the B-tree index, which hurts large append-heavy tables (`ledger_entries`, `audit_events`, `outbox_events`, `job_visits`). Domain code also needs an id before the row is saved, because the same id goes into outbox events and ledger idempotency keys in the same transaction.

## Decision
- All ids are **UUIDv7** (time-ordered, RFC 9562), created in the application by one shared `Ids.newId()` before persisting. The database never generates ids.
- The same UUID is both the primary key and the public API id. No second "public id" column, no prefixed ids like `bk_…`.
- Columns stay `UUID`; existing DDL in the LLDs does not change.
- Ids carry no meaning for clients. The embedded timestamp is not used for business logic (use `created_at`), and clients must not parse it.

## Consequences
- Inserts are append-mostly, so index pages stay hot and page splits are rare.
- The creation time (to the millisecond) can be read from an id. Acceptable: ids are not secrets, and every resource is still authorization-checked ([security/02](../security/02-threat-model-and-application-security.md)).
- Java 21 has no built-in v7 generator: use Hibernate's v7 `@UuidGenerator` strategy if the Hibernate version in use has it, else a small `Ids` utility (48-bit Unix ms + random bits) with a unit test for version/variant bits and ordering.
- PostgreSQL 18's `uuidv7()` is not needed (we run 17, and ids are app-generated).

## Alternatives considered
- **UUIDv4:** simplest, but random index inserts on the biggest tables.
- **ULID / prefixed string ids:** nicer to read, but a second format next to `UUID` columns and no native PostgreSQL type.
- **BIGINT sequences:** enumerable, leak volumes, and need a DB round-trip before the id is known.
