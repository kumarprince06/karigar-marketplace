# 0013. S3-compatible object storage with direct upload

- Status: Accepted
- Date: 2026-10-03 (recorded from existing design docs)
- Deciders: TBD
- Source: [modules/10 §3–4, §9](../modules/10-media-upload-and-object-storage.md)

## Context
Photos, verification documents and dispute evidence are binary files. Storing them in PostgreSQL bloats backups and I/O; proxying uploads through the app wastes bandwidth and memory.

## Decision
- Binaries go to S3-compatible object storage behind a `StorageGateway` abstraction; PostgreSQL stores only metadata, ownership and security information.
- Clients upload directly using presigned URLs authorized by the backend.

## Consequences
- File size and type must be enforced server-side (presigned POST policy or HEAD check at finalize); client-declared size is not trusted.
- Dispute evidence should carry a content hash.

## Alternatives considered
Files in PostgreSQL; uploads proxied through Spring Boot — rejected.
