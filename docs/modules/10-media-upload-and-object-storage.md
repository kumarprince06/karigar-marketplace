# Media, File Upload & Object Storage Architecture

## 1. Purpose

The platform will need to handle files in several workflows:

* customer service-request photos;
* service-request videos;
* worker profile photos;
* identity-verification documents;
* profession/certification evidence;
* dispute evidence;
* before/after work photos;
* receipts/invoices;
* review attachments;
* future worker portfolio documents.

These files have very different:

* privacy requirements;
* retention requirements;
* size limits;
* visibility;
* security requirements;
* processing requirements.

Therefore, file handling must be designed as a platform capability rather than allowing every module to directly upload arbitrary files.

---

# 2. Core Principle

The application database should **not store binary files**.

Use:

```text
PostgreSQL
    ↓
metadata + ownership + references

Object Storage
    ↓
actual binary content
```

For example:

```text
service_request_attachments
├── id
├── service_request_id
├── object_key
├── mime_type
├── size_bytes
├── checksum
├── uploaded_by
└── created_at
```

The actual image/video/document lives in object storage.

---

# 3. Recommended Storage Architecture

Initial architecture:

```text
                    ┌─────────────────┐
                    │   Spring Boot   │
                    └────────┬────────┘
                             │
                 upload authorization
                             │
                             ↓
                    ┌─────────────────┐
                    │ Object Storage  │
                    │ S3-compatible   │
                    └─────────────────┘
```

Examples of compatible storage providers can include AWS S3 or other S3-compatible object stores.

The application should communicate through a storage abstraction:

```text
StorageGateway
```

rather than directly coupling business modules to a provider SDK.

---

# 4. Why Not Store Files in PostgreSQL?

Storing large binaries directly inside PostgreSQL creates several problems:

* database size grows rapidly;
* backups become much larger;
* database I/O becomes expensive;
* serving media consumes database resources;
* lifecycle management becomes harder;
* CDN integration becomes less convenient.

PostgreSQL should store:

```text
metadata
references
relationships
security information
```

Object storage should store:

```text
binary content
```

---

# 5. File Ownership

Every uploaded file must belong to a business context.

Examples:

```text
ServiceRequestAttachment
DisputeEvidence
WorkerVerificationDocument
WorkerProfilePhoto
JobWorkPhoto
ReviewAttachment
```

Avoid a generic concept such as:

```text
files
```

with no ownership semantics.

The system must always know:

```text
Who uploaded it?
What business object does it belong to?
Why was it uploaded?
Who can access it?
How long should it be retained?
```

---

# 6. Media Domain vs Business Modules

The platform can have a shared media capability:

```text
media/
├── api/
├── application/
├── domain/
└── infrastructure/
```

But business modules remain owners of their attachment relationships.

For example:

```text
Service Request
      ↓
ServiceRequestAttachment
      ↓
Media Storage
```

The media module owns storage mechanics.

The service-request module owns:

> “This image belongs to this service request.”

---

# 7. Upload Flow

Recommended flow:

```text
Client
   ↓
Request upload authorization
   ↓
Backend validates permission
   ↓
Backend creates upload intent
   ↓
Client uploads directly to object storage
   ↓
Object storage confirms upload
   ↓
Backend finalizes attachment
   ↓
Attachment becomes available
```

This avoids sending large files through the application server unnecessarily.

---

# 8. Upload Intent

Example conceptual API:

```text
POST /api/v1/media/upload-intents
```

Request:

```json
{
  "purpose": "SERVICE_REQUEST_ATTACHMENT",
  "fileName": "leak.jpg",
  "contentType": "image/jpeg",
  "sizeBytes": 2400000
}
```

Response:

```json
{
  "data": {
    "uploadId": "01J...",
    "uploadUrl": "...",
    "expiresAt": "..."
  }
}
```

The exact provider-specific response should remain hidden behind the storage abstraction.

---

# 9. Why Direct Upload?

Without direct upload:

```text
Client
   ↓
Spring Boot
   ↓
Object Storage
```

Large files consume:

* application bandwidth;
* application memory;
* connection capacity;
* CPU/network resources.

With direct upload:

```text
Client
   ───────────────→ Object Storage
          ↑
          │
     authorization
          │
     Spring Boot
```

The application primarily handles authorization and metadata.

---

# 10. Upload Security

The server must validate:

* authenticated user;
* business ownership;
* allowed purpose;
* MIME type;
* file extension;
* maximum file size;
* upload expiration;
* object key;
* attachment count;
* content status.

Never trust:

```text
filename
content-type
file extension
```

provided by the client alone.

---

# 11. File Type Validation

Example:

```text
Client claims:
image/jpeg
```

The actual file may not be JPEG.

The system should eventually inspect file signatures/content where appropriate.

For security-sensitive workflows, such as identity documents, stronger validation should be applied.

---

# 12. File Size Limits

Different purposes should have different limits.

Example policy:

```text
Profile photo
→ small

Service-request image
→ moderate

Service-request video
→ larger

Identity document
→ moderate

Dispute evidence video
→ potentially larger
```

Exact limits are product/infrastructure decisions.

The important design principle is:

> **Limits are purpose-specific, not one global maximum.**

---

# 13. Attachment Count

Prevent unlimited uploads.

Example:

```text
Service request
    max N images
    max M videos
```

Again, exact values should remain configurable.

This protects:

* storage costs;
* processing capacity;
* abuse surface.

---

# 14. Object Key Design

Object keys should be generated by the server.

Avoid:

```text
/uploads/my-photo.jpg
```

Prefer structured opaque keys:

```text
service-requests/{requestId}/attachments/{attachmentId}
```

or:

```text
workers/{workerId}/profile/{attachmentId}
```

Examples:

```text
service-requests/01JABC/attachments/01JXYZ
workers/01JABC/profile/01JXYZ
disputes/01JABC/evidence/01JXYZ
```

The client should not control arbitrary object paths.

---

# 15. Object Key vs Public URL

Do not store permanent public URLs as the primary business reference.

Store:

```text
objectKey
```

Then generate access URLs when needed.

Why?

Because:

* URLs can expire;
* storage providers can change;
* CDN configuration can change;
* access policy can change.

Business data should depend on a stable storage reference.

---

# 16. Private vs Public Media

Most marketplace media should be private by default.

### Public/low-risk

Potentially:

```text
worker profile photo
selected portfolio image
```

### Private

```text
identity documents
verification evidence
dispute evidence
customer photos
receipts
private job documents
```

Default rule:

> **Private unless explicitly classified as public.**

---

# 17. Signed URLs

For private files, the backend can issue short-lived signed URLs.

Conceptually:

```text
Client
   ↓
GET attachment
   ↓
Backend authorization
   ↓
Generate temporary signed URL
   ↓
Client downloads object
```

The object storage itself can enforce private access.

---

# 18. Authorization

Possessing an attachment ID should never be enough to access a file.

For example:

```text
GET /attachments/{id}
```

must verify:

```text
Is this user allowed to see this attachment?
```

Possible rules:

### Customer

Can access their own service-request attachments.

### Worker

Can access attachments exposed to them through the relevant job/request workflow.

### Admin

Can access according to administrative permissions.

### Unrelated user

```text
403 FORBIDDEN
```

or an appropriate not-found response depending on the privacy strategy.

---

# 19. Verification Documents

Identity and profession verification documents require stronger protection.

Examples:

```text
government ID
certificate
license
professional document
```

These should have:

* private storage;
* strict authorization;
* short-lived access;
* audit logging;
* retention policy;
* encryption at rest;
* restricted administrative access.

They should never be included in a public worker profile.

---

# 20. Dispute Evidence

Dispute evidence can be sensitive.

Example:

```text
Customer uploads damaged wiring photo.
Worker uploads completion photo.
```

The system should track:

```text
who uploaded it
when
which dispute
which party
```

and preserve evidence history.

Do not silently replace evidence.

---

# 21. Before/After Work Photos

A useful future feature:

```text
Before
   ↓
Work
   ↓
After
```

For example:

```text
Job
├── before photos
├── work-progress photos
└── after photos
```

This can improve:

* dispute resolution;
* customer confidence;
* worker portfolio;
* work history.

But it should not be included in MVP unless the product actually needs it.

---

# 22. Image Processing

Images may eventually require:

* resizing;
* thumbnail generation;
* compression;
* orientation correction;
* metadata removal;
* format normalization.

Flow:

```text
Original Upload
      ↓
Validation
      ↓
Processing
      ↓
Variants
      ├── thumbnail
      ├── medium
      └── original
```

Do not process large images synchronously inside the request thread.

Use background processing.

---

# 23. Video Processing

Videos can be expensive.

Future pipeline:

```text
Upload
   ↓
Validation
   ↓
Object Storage
   ↓
Async Processing
   ↓
Transcoding
   ↓
Streaming variants
```

MVP should avoid building a sophisticated video pipeline unless video becomes an actual requirement.

---

# 24. Malware Scanning

Uploaded files can be an attack vector.

Potentially malicious uploads include:

* executable content disguised as documents;
* malicious PDFs;
* crafted images;
* compressed archives.

For appropriate upload categories, introduce:

```text
Upload
   ↓
Quarantine
   ↓
Malware Scan
   ↓
SAFE
   ↓
Available
```

For MVP, the exact scanning provider/tool remains an infrastructure decision.

---

# 25. Quarantine State

Security-sensitive uploads may have:

```text
PENDING_SCAN
SCAN_IN_PROGRESS
SAFE
REJECTED
```

The business object should not expose the file before it reaches an allowed state.

Example:

```text
Identity document
      ↓
PENDING_SCAN
      ↓
SAFE
      ↓
Available to verification workflow
```

---

# 26. Attachment Lifecycle

A generic lifecycle can be:

```text
CREATED
   ↓
UPLOADING
   ↓
UPLOADED
   ↓
PROCESSING
   ↓
AVAILABLE
```

Failure:

```text
UPLOAD_FAILED
PROCESSING_FAILED
REJECTED
```

Deletion should generally be:

```text
MARKED_FOR_DELETION
      ↓
DELETED
```

rather than immediately deleting the database record when audit/history matters.

---

# 27. Orphaned Objects

A common failure:

```text
Object uploaded
   ↓
Application crashes
   ↓
Attachment record never created
```

Result:

```text
orphaned object
```

Opposite case:

```text
Database record created
   ↓
Object upload fails
```

Result:

```text
broken attachment
```

Therefore the system needs reconciliation.

A background job can periodically detect:

```text
database metadata without object
```

and:

```text
object without valid metadata
```

where provider capabilities allow safe enumeration.

---

# 28. Transaction Boundary

Object storage and PostgreSQL do not share the same transaction.

Therefore do not assume:

```text
DB transaction
+
S3 upload
```

is atomic.

Use an explicit workflow:

```text
Create upload intent
       ↓
Upload object
       ↓
Finalize attachment
       ↓
Mark AVAILABLE
```

If finalization fails, retry safely.

---

# 29. Idempotency

Upload finalization must be idempotent.

Example:

```text
Client
   ↓
POST finalize
   ↓
timeout
   ↓
retry
```

The retry must not create:

```text
two attachments
```

for the same upload.

Use:

* upload ID;
* attachment ID;
* idempotency key;
* database uniqueness constraints.

---

# 30. Checksums

Where appropriate, store a checksum:

```text
checksum
algorithm
```

This can help with:

* integrity verification;
* duplicate detection;
* upload validation;
* troubleshooting.

It should not be treated as a security identity by itself.

---

# 31. Duplicate Files

Users may upload the same image repeatedly.

Possible future optimization:

```text
content checksum
     ↓
duplicate detection
```

But do not prematurely deduplicate all files.

Two business records may legitimately reference the same binary.

---

# 32. Metadata

Store useful metadata:

```text
attachment_id
owner_type
owner_id
purpose
object_key
mime_type
size_bytes
checksum
status
uploaded_by
created_at
```

Potential future metadata:

```text
width
height
duration
processing_status
scan_status
```

Avoid storing arbitrary unvalidated client metadata.

---

# 33. EXIF and Location Metadata

Images can contain metadata such as:

* GPS coordinates;
* device information;
* timestamps.

This can unintentionally expose sensitive information.

For public-facing images, the platform may eventually need to remove or sanitize sensitive metadata.

For private evidence, original metadata may sometimes have evidentiary value.

Therefore:

> **Do not apply one metadata policy to every file category.**

The retention/privacy policy should depend on purpose.

---

# 34. Media Access Logging

Sensitive files should have access logging.

Example:

```text
Admin X
accessed
Worker identity document
at 15:04
```

This should generate an audit event.

Especially important for:

* identity documents;
* verification evidence;
* dispute evidence.

---

# 35. Retention

Different files require different retention periods.

Example:

```text
Profile photo
→ while profile exists

Service-request attachment
→ according to business retention policy

Verification document
→ according to legal/compliance policy

Dispute evidence
→ according to dispute/audit requirements
```

Exact periods are an open compliance/product decision.

Do not hardcode arbitrary retention periods into the architecture.

---

# 36. Deletion

Deletion can be:

### User-requested

Example:

```text
Delete profile photo
```

### Business-driven

Example:

```text
expired temporary upload
```

### Compliance-driven

Example:

```text
retention period expired
```

### Legal hold

A future system may prevent deletion while a dispute/legal investigation remains active.

Conceptually:

```text
retentionExpired = true
legalHold = true

→ retain
```

---

# 37. Soft Delete vs Physical Delete

Database:

```text
deleted_at
```

may be appropriate for attachment metadata.

Object storage:

```text
physical deletion
```

can happen later through a controlled cleanup process.

This allows:

* audit;
* recovery windows;
* asynchronous cleanup.

---

# 38. Storage Abstraction

Application layer should depend on:

```java
interface StorageGateway {
    UploadIntent createUploadIntent(...);

    StoredObjectMetadata getMetadata(...);

    SignedDownloadUrl createDownloadUrl(...);

    void delete(...);
}
```

Provider-specific code belongs in:

```text
infrastructure/storage/
```

Example:

```text
S3StorageGateway
```

The domain should not import AWS SDK classes.

---

# 39. Storage Provider Failure

If object storage is temporarily unavailable:

```text
POST upload-intent
```

may fail.

The core marketplace should remain operational for workflows that do not require files.

For example:

```text
Payment
Booking
Job lifecycle
```

should not become globally unavailable because media storage is temporarily degraded.

---

# 40. Upload Processing Failure

Suppose:

```text
Customer uploads image
       ↓
Upload succeeds
       ↓
Thumbnail processing fails
```

The original file should not necessarily become unavailable.

Possible state:

```text
Original = AVAILABLE
Thumbnail = PROCESSING_FAILED
```

This is better than treating every derivative failure as complete upload failure.

---

# 41. CDN

A CDN can eventually improve media delivery.

Architecture:

```text
Client
   ↓
CDN
   ↓
Object Storage
```

Useful for:

* profile images;
* public worker portfolio images;
* frequently viewed media.

Do not add a CDN purely because it is common architecture.

Introduce it when traffic/latency justifies it.

---

# 42. Image Variants

A profile image might have:

```text
original
small
medium
large
```

The application should reference a stable attachment identity rather than embedding provider-specific URLs everywhere.

Example:

```text
workerProfilePhotoId
```

The presentation layer can request the desired variant.

---

# 43. Media API

Potential MVP APIs:

```text
POST   /api/v1/media/upload-intents
POST   /api/v1/media/uploads/{id}/complete
GET    /api/v1/media/{id}
DELETE /api/v1/media/{id}
```

Business-specific APIs should still exist where appropriate:

```text
POST /api/v1/service-requests/{id}/attachments
POST /api/v1/disputes/{id}/evidence
```

These APIs perform business authorization before interacting with the media system.

---

# 44. Service Request Attachment Flow

```text
Customer
   ↓
Create service request
   ↓
Request attachment authorization
   ↓
Upload photo
   ↓
Finalize
   ↓
Attachment linked to request
   ↓
Worker receives permitted image
```

If upload fails:

```text
Service request remains valid.
```

The entire service request should not necessarily be rolled back.

---

# 45. Verification Document Flow

```text
Worker
   ↓
Submit verification
   ↓
Upload document
   ↓
Security validation
   ↓
Object storage
   ↓
Verification review
   ↓
Admin accesses authorized document
   ↓
Verification decision
```

This flow needs significantly stricter access controls than ordinary job photos.

---

# 46. Dispute Evidence Flow

```text
User
   ↓
Open dispute
   ↓
Submit evidence
   ↓
Evidence stored
   ↓
Evidence associated with dispute
   ↓
Other party sees permitted evidence
   ↓
Admin investigates
```

Evidence should remain associated with the dispute even if the dispute is later closed.

---

# 47. Worker Portfolio

Future:

```text
Worker
   ↓
Portfolio
   ├── project photos
   ├── certificates
   └── work examples
```

Only approved/public-safe content should be exposed.

This should not be confused with private verification evidence.

---

# 48. Storage Cost Management

Large media can become a significant cost driver.

Metrics should track:

```text
storage bytes
uploads/day
average file size
video storage
download bandwidth
CDN cache hit rate
orphaned objects
processing cost
```

Potential future policies:

* compression;
* lifecycle transitions;
* archival storage;
* automatic cleanup;
* upload limits.

---

# 49. Abuse Protection

Media endpoints must protect against:

```text
unlimited uploads
huge files
malicious files
storage exhaustion
repeated failed uploads
automated upload attacks
```

Controls:

* authentication;
* authorization;
* rate limits;
* file limits;
* purpose-specific limits;
* quota;
* malware scanning;
* upload expiration;
* monitoring.

---

# 50. Observability

Track:

```text
upload_success_total
upload_failure_total
upload_bytes_total
processing_success_total
processing_failure_total
download_total
storage_errors
scan_failures
orphaned_objects
```

Latency:

```text
upload authorization latency
finalization latency
processing latency
signed URL generation latency
```

These will become useful operational signals.

---

# 51. Module Structure

```text
media/
├── api/
│   ├── MediaController
│   └── UploadController
│
├── application/
│   ├── command/
│   │   ├── CreateUploadIntent
│   │   ├── FinalizeUpload
│   │   └── DeleteMedia
│   │
│   ├── query/
│   │   └── GetMediaAccess
│   │
│   ├── service/
│   │   └── MediaService
│   │
│   └── port/
│       ├── in/
│       └── out/
│
├── domain/
│   ├── model/
│   │   ├── MediaObject
│   │   └── Upload
│   ├── valueobject/
│   ├── event/
│   └── exception/
│
└── infrastructure/
    ├── persistence/
    ├── storage/
    │   └── S3StorageGateway
    ├── scanning/
    └── processing/
```

Business modules should not depend on `S3StorageGateway`.

---

# 52. Database Ownership

Possible generic table:

```text
media_objects
```

containing:

```text
id
purpose
object_key
mime_type
size_bytes
checksum
status
visibility
uploaded_by
created_at
deleted_at
```

Then business-specific relationships:

```text
service_request_attachments
dispute_evidence
worker_verification_documents
job_media
review_attachments
```

This avoids putting every business relationship into one massive generic table.

---

# 53. Why Generic Polymorphic Ownership Should Be Used Carefully

A tempting design is:

```text
media_objects
owner_type
owner_id
```

This is flexible but weakens database-level referential integrity.

For important business relationships, explicit association tables are preferable:

```text
service_request_attachments
```

instead of relying entirely on:

```text
owner_type = SERVICE_REQUEST
owner_id = ...
```

This keeps relationships more explicit and enforceable.

---

# 54. MVP Scope

### Include

* object storage;
* storage abstraction;
* upload intents;
* direct uploads;
* attachment metadata;
* authorization;
* private objects by default;
* signed download URLs;
* file-size/type validation;
* upload expiration;
* idempotent finalization;
* service-request attachments;
* verification documents;
* dispute evidence;
* basic cleanup;
* audit for sensitive access.

### Defer

* advanced video transcoding;
* sophisticated image CDN;
* AI image classification;
* automatic OCR;
* complex media deduplication;
* multi-region object replication;
* advanced portfolio system;
* large-scale archival strategy.

---

# 55. Core Invariants

The system must enforce:

1. Binary files are stored outside PostgreSQL.
2. PostgreSQL stores authoritative metadata and relationships.
3. Every file has a defined business purpose.
4. Object keys are generated server-side.
5. Client input cannot determine arbitrary storage paths.
6. Private files are private by default.
7. Access requires authorization.
8. Sensitive files have stricter access controls.
9. Upload finalization is idempotent.
10. Object storage and database operations are not assumed to be one atomic transaction.
11. Failed uploads cannot leave the business object in an invalid state.
12. Orphaned objects must be detectable and cleanable.
13. File size and type limits are purpose-specific.
14. Uploaded files must be validated before use.
15. Sensitive evidence access should be auditable.
16. Retention policy must depend on file purpose.
17. Search/profile APIs must never expose private storage URLs.
18. Storage-provider details must remain behind an abstraction.
19. Media failures should not unnecessarily take down unrelated marketplace capabilities.
20. The original business relationship remains authoritative; media is supporting evidence/content.

---

# 56. Final Architecture Principle

Media is not simply:

> “Upload a file and save its URL.”

It is a lifecycle:

```text
Authorize
   ↓
Upload
   ↓
Validate
   ↓
Scan
   ↓
Process
   ↓
Associate
   ↓
Authorize access
   ↓
Deliver
   ↓
Retain
   ↓
Delete/Archive
```

The platform should therefore treat files as **managed business assets with explicit ownership, security, lifecycle, and retention**, rather than as arbitrary blobs attached to database records.

# End of Document
