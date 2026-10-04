# CI/CD, Docker, Environments & Infrastructure

**Project:** Karigar Marketplace
**Document Type:** Operations / Delivery & Infrastructure Design
**Status:** Draft for Engineering Review
**Scope:** Environments, local development, container image, CI/CD pipelines, database migrations, pilot infrastructure on AWS, configuration and secrets, deployment and rollback, release and versioning, production launch gate
**Audience:** Engineers (small team or solo developer)

---

## Current Model (aligned with ADRs)

> This document turns the runtime architecture ([architecture/01](../architecture/01-system-architecture-modular-monolith.md) §48–54, §61–62) into a concrete delivery setup. It follows [ADR 0001](../adr/0001-modular-monolith.md) (one deployable), [ADR 0003](../adr/0003-postgresql-postgis.md) (PostgreSQL + PostGIS), [ADR 0004](../adr/0004-redis-non-authoritative.md) (Redis is non-authoritative), [ADR 0005](../adr/0005-async-events-and-transactional-outbox.md) (outbox, no broker), [ADR 0013](../adr/0013-object-storage-direct-upload.md) (S3 direct upload) and [ADR 0015](../adr/0015-integration-tests-on-real-postgres.md) (tests on real PostGIS).

* **One artifact:** a single Spring Boot jar in a single OCI image, built once per commit and promoted unchanged from staging to production. Tagged with the git SHA; releases also get a semver tag.
* **Stack versions:** Java 21 (LTS), Spring Boot 3.x (latest patch), Maven (`pom.xml`, per [architecture/02](../architecture/02-project-directory-and-package-structure.md) §4), PostgreSQL 17 + PostGIS 3.5, Redis-compatible 7.x, Flyway.
* **Environments:** `local` → `ci` (ephemeral) → `staging` → `production`. Production data never leaves production.
* **CI/CD:** GitHub Actions. PRs run build, tests (Testcontainers on PostGIS), module checks, OpenAPI lint and breaking-change diff, coverage gate, Trivy and gitleaks. `main` builds and pushes the image, migrates and deploys staging automatically, runs smoke tests, then waits for manual approval to production.
* **Pilot infrastructure:** AWS `ap-south-1` (Mumbai). ECS Fargate (1–2 tasks) behind an ALB with ACM TLS, RDS PostgreSQL with PostGIS (single-AZ at pilot, Multi-AZ before scale), ElastiCache (single node, no persistence needed), S3 + CloudFront, Route 53, SSM Parameter Store / Secrets Manager, CloudWatch. All managed by Terraform. Estimated production cost: **~US$100–160/month**; staging **~US$40–70/month** (estimates, see §6.6).
* **Migrations:** Flyway runs as a separate one-off task **before** the new app version rolls out. Expand-and-contract only; applied migrations are never edited; rollback is a forward fix.
* **Deployment:** ECS rolling update (min 100% / max 200%) gated on Actuator readiness; graceful shutdown; scheduled jobs guarded by ShedLock, outbox claimed with `FOR UPDATE SKIP LOCKED`; rollback = redeploy the previous image tag.
* **Not used:** Kubernetes, Helm, service mesh, Kafka, multi-region (architecture/01 §62). Each has a named trigger in §6.7.

---

# 1. Environments

| Environment | Purpose | Data | Deployed by | URL pattern |
|---|---|---|---|---|
| `local` | Developer machine; fastest feedback | Synthetic Howrah seed (dev-only Flyway location) | Developer | `http://localhost:8080/api/v1` |
| `ci` | Ephemeral per job; Testcontainers | Created per test, thrown away | GitHub Actions | none |
| `staging` | Production-like rehearsal: migrations, smoke tests, mobile QA builds, payment sandbox | Synthetic Howrah seed; provider **test/sandbox** keys | CI, automatically on merge to `main` | `https://api.staging.<domain>`, `https://media.staging.<domain>` |
| `production` | Real customers and workers in Howrah/Kolkata | Real data, **only here** | CI, after manual approval in the `production` GitHub environment | `https://api.<domain>`, `https://media.<domain>`, `https://admin.<domain>` |

Rules:

* **No production data outside production.** No dumps to laptops or staging. Debugging uses logs, metrics and read-only queries through an audited admin path. If a restore test needs production data, it happens in an isolated restore inside the production account and is destroyed afterwards ([operations/03](03-backup-disaster-recovery-and-business-continuity.md)).
* **Staging seed** is synthetic but realistic: Howrah wards and localities (Shibpur, Bally, Liluah, Santragachi, Salkia, Kadamtala), real service categories, ~200 fake workers with valid PostGIS points spread over the district, a few customers, and bookings in every state. Phone numbers use a reserved fake range; emails go to `@example.test` or a Mailpit/Brevo sandbox.
* **Separate AWS accounts** for staging and production (AWS Organizations, free). A staging mistake cannot touch production resources. Alternative: one account with strict tagging and IAM — rejected, because blast radius is the whole point.
* **Separate provider projects** per environment: Firebase (FCM) project, Razorpay/Cashfree test vs live keys, Brevo sub-account or separate API key, separate S3 buckets.
* A `dev` shared environment is **not** created. `local` + `staging` cover it for a team this size. Add one when more than ~3 engineers need a shared integration target.

---

# 2. Local Development

## 2.1 One-command start

```bash
docker compose up -d          # infrastructure
./mvnw spring-boot:run        # app with SPRING_PROFILES_ACTIVE=local (default in .env)
```

or run `KarigarApplication` from the IDE with the `local` profile. `docker compose --profile app up` also builds and runs the app container, which is useful to reproduce image-specific issues.

## 2.2 `docker-compose.yml`

Pin images by version (and by digest in CI). The PostgreSQL major version must match RDS.

```yaml
name: karigar
services:
  postgres:
    image: postgis/postgis:17-3.5          # match RDS major (17) and PostGIS (3.5)
    environment:
      POSTGRES_DB: karigar
      POSTGRES_USER: karigar
      POSTGRES_PASSWORD: karigar            # local only
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U karigar"]
      interval: 5s
      retries: 10

  redis:
    image: redis:7.4-alpine
    command: ["redis-server", "--save", "", "--appendonly", "no"]   # non-authoritative (ADR 0004)
    ports: ["6379:6379"]

  minio:
    image: minio/minio:RELEASE.2025-04-22T22-12-26Z
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: minio12345
    ports: ["9000:9000", "9001:9001"]
    volumes: ["miniodata:/data"]

  minio-init:                               # creates buckets + CORS once
    image: minio/mc:RELEASE.2025-04-16T18-13-26Z
    depends_on: [minio]
    entrypoint: >
      sh -c "mc alias set local http://minio:9000 minio minio12345 &&
             mc mb -p local/karigar-media-private local/karigar-media-public &&
             mc anonymous set download local/karigar-media-public"

  mailpit:
    image: axllent/mailpit:v1.24
    ports: ["1025:1025", "8025:8025"]       # SMTP, web UI at http://localhost:8025

  app:
    profiles: ["app"]
    build: .
    env_file: .env
    environment:
      SPRING_PROFILES_ACTIVE: local
      DB_URL: jdbc:postgresql://postgres:5432/karigar
      REDIS_HOST: redis
      S3_ENDPOINT: http://minio:9000
    ports: ["8080:8080"]
    depends_on:
      postgres: { condition: service_healthy }

volumes: { pgdata: {}, miniodata: {} }
```

Image tags above are examples current at writing; Renovate/Dependabot keeps them updated (§4.4).

## 2.3 Local adapters

| Port | `local` adapter | `staging` | `production` |
|---|---|---|---|
| Email (Brevo) | SMTP → Mailpit | Brevo, test sender, recipients allow-listed | Brevo |
| Payments ([ADR 0007](../adr/0007-payment-provider-abstraction.md)) | `FakePaymentGateway` (instant success/failure by amount suffix, emits signed fake webhooks) | Razorpay/Cashfree **test mode** | Live keys |
| Push (FCM) | `LoggingPushSender` | Firebase staging project | Firebase prod project |
| Object storage | MinIO | S3 staging buckets | S3 prod buckets |
| Maps/geocoding | Static fixture for Howrah | Provider with restricted key | Provider |

To test real provider webhooks locally, run a tunnel (`cloudflared tunnel --url http://localhost:8080`) and point the provider's **test** webhook to it. Never point live keys at a laptop.

## 2.4 Spring profiles

| Profile | Used in | Notes |
|---|---|---|
| `local` | Laptop | Fake adapters, seed data, verbose SQL logging off by default |
| `test` | Unit/integration tests | Testcontainers via `@ServiceConnection` |
| `staging` | Staging | Same as prod except seed location and sandbox keys |
| `prod` | Production | No seed, strict CORS, Swagger UI disabled |
| `migrate` | One-off migration task (§5.2) | Non-web, Flyway on, schedulers off, exits when done |

architecture/02 lists `application-dev.yml`; it is renamed `application-staging.yml` because there is no separate dev environment. Profiles hold **non-secret defaults only**; every secret and every per-environment endpoint comes from environment variables (§7).

## 2.5 Seed data

* Seed lives in `src/main/resources/db/seed/local/` and `db/seed/staging/` as Flyway **repeatable** migrations (`R__010_howrah_localities.sql`, `R__020_workers.sql`, …). They re-run when their checksum changes, so they must be idempotent (`INSERT … ON CONFLICT DO UPDATE`).
* Selected per profile: `spring.flyway.locations=classpath:db/migration,classpath:db/seed/local`. Production sets only `classpath:db/migration`. A startup check in `prod` fails fast if any location other than `db/migration` is configured.
* Reference data production needs (service categories, tax rates, cancellation reasons) is **not** seed. It goes in versioned `V__` migrations so it exists everywhere.
* `docker compose down -v` gives a clean database; the next app start migrates and seeds it.

---

# 3. Container Image

## 3.1 Dockerfile

Multi-stage, layered Spring Boot jar, JRE-only Alpine base, non-root user.

```dockerfile
# syntax=docker/dockerfile:1.7
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /src
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -q dependency:go-offline
COPY src src
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -q package -DskipTests \
 && java -Djarmode=tools -jar target/karigar-*.jar extract --layers --launcher --destination /extracted

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S app && adduser -S -G app -u 10001 app
WORKDIR /app
COPY --from=build /extracted/dependencies/ ./
COPY --from=build /extracted/spring-boot-loader/ ./
COPY --from=build /extracted/snapshot-dependencies/ ./
COPY --from=build /extracted/application/ ./
USER 10001
EXPOSE 8080 8081
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError -Duser.timezone=UTC"
HEALTHCHECK --interval=15s --timeout=3s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:8081/actuator/health/liveness || exit 1
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
```

Notes:

* **Tests do not run in the Docker build.** CI runs them once before building the image (§4); running them again inside the build wastes time and needs Docker-in-Docker for Testcontainers.
* **Layers:** dependencies change rarely, so a code-only change pushes a few MB.
* **Actuator on port 8081** (`management.server.port`). The ALB only forwards to 8080; health and metrics are not on the public listener.
* **`-Duser.timezone=UTC`:** the JVM and the database store UTC; conversion to `Asia/Kolkata` happens at the edges.
* `HEALTHCHECK` is for `docker compose`; ECS uses the task definition health check and the ALB target group check (§8).
* Base image: `eclipse-temurin:21-jre-alpine` (~90 MB compressed with the app). Alternative: distroless Java 21 (smaller attack surface but no shell, so no `wget` health check) — revisit if scanners keep flagging Alpine packages. Java 25 (next LTS) is a base-image + `maven.compiler.release` change once all dependencies support it.
* `.dockerignore` excludes `target/`, `.git/`, `docs/`, `infra/`, `*.env`.
* Build `linux/arm64` (Fargate Graviton is ~20% cheaper) and `linux/amd64` for laptops when needed.

## 3.2 Tagging

| Tag | When | Mutable? |
|---|---|---|
| `sha-<12-char git SHA>` | Every `main` build | No — this is what is deployed |
| `v1.4.0` | Release tag on a commit already built | No |
| `staging`, `prod` | **Not used** | Mutable tags hide what is running |

ECR repositories are set to **immutable tags**. Task definitions reference the image by SHA tag (and digest in the deploy log). Images are kept for 90 days, release tags forever (ECR lifecycle policy).

## 3.3 SBOM and provenance

* `trivy image --format cyclonedx` produces an SBOM for every pushed image, stored as a build artifact and attached to the GitHub release.
* `docker/build-push-action` with `provenance: true` and `sbom: true` adds BuildKit attestations to the image in ECR.
* Image signing (cosign) is deferred until there is more than one person with deploy rights.

---

# 4. Continuous Integration (GitHub Actions)

## 4.1 Pull request pipeline

Required to merge to `main` (branch protection, no direct pushes):

| Step | Tool | Fails the PR when |
|---|---|---|
| Build + unit tests | `./mvnw verify` (Surefire) | Any test fails |
| Integration tests | Failsafe + Testcontainers `postgis/postgis:17-3.5`, Redis, MinIO | Any IT fails ([ADR 0015](../adr/0015-integration-tests-on-real-postgres.md), [testing/01](../testing/01-testing-strategy-and-quality-engineering.md) §19–21) |
| Migrations | Flyway `migrate` + `validate` on an empty PostGIS container, then ITs run on it | Migration fails or checksum mismatch |
| Module boundaries | Spring Modulith `ApplicationModules.of(KarigarApplication.class).verify()` + ArchUnit rules ([architecture/02](../architecture/02-project-directory-and-package-structure.md) §48–50) | Illegal cross-module dependency or cycle |
| OpenAPI drift | Generate spec (springdoc) during ITs, compare with committed `openapi/openapi.yaml` | Generated ≠ committed (implementation and contract diverged, [api/02](../api/02-openapi-and-documentation-governance.md) §11) |
| OpenAPI lint | Spectral with project ruleset (`.spectral.yaml`) | Error-level rule fails |
| Breaking changes | `oasdiff breaking` base (`main`) vs PR spec | Breaking change under `/api/v1` without the `api-breaking-approved` label |
| Coverage | JaCoCo `check` | Line coverage < 80% overall, < 90% on `payment`, `booking`, `job` domain packages (testing/01 §78) |
| Dependency scan | `trivy fs` (Maven lockfile) | HIGH/CRITICAL CVE with a fix available |
| Secret scan | gitleaks + GitHub push protection | Any finding |
| Dockerfile lint | hadolint | Error |
| Commit format | commitlint on PR title (squash merge) | Not a Conventional Commit (§9) |

Alternatives in one line each: OWASP dependency-check (slower, needs an NVD API key; Trivy covers fs and image with one tool); SonarCloud (useful later; JaCoCo gate is enough now); Jenkins/GitLab CI (more to run; GitHub Actions is free at this size).

Target PR time: **< 10 minutes.** Maven cache (`actions/setup-java` `cache: maven`) and Testcontainers reuse within one job keep it there. Slow suites (load tests, E2E, mutation tests) run nightly, not on PRs.

## 4.2 Main pipeline

```text
merge to main
   → build + all PR checks again (on the merged commit)
   → build image (arm64), push to ECR as sha-<sha>, Trivy image scan (fail on fixable CRITICAL)
   → staging: run migration task → wait for success
   → staging: ECS rolling deploy → wait for service stable
   → staging: smoke tests (health, auth login, create + cancel request, presigned upload, sandbox payment webhook)
   → production: manual approval (GitHub environment "production", required reviewer)
   → production: run migration task → ECS rolling deploy → smoke tests (read-only + synthetic test account)
   → on failure after deploy: automatic redeploy of previous task definition, alert
```

## 4.3 Example workflow

Authentication to AWS uses GitHub OIDC (`aws-actions/configure-aws-credentials` with a role per environment). There are no long-lived AWS keys in GitHub.

```yaml
# .github/workflows/ci.yml
name: ci
on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read
  id-token: write          # OIDC to AWS

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  verify:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: '21', cache: maven }
      - name: Build, unit + integration tests, Modulith/ArchUnit, JaCoCo gate
        run: ./mvnw -B verify
      - name: OpenAPI drift
        run: git diff --exit-code openapi/openapi.yaml
      - name: OpenAPI lint
        run: npx -y @stoplight/spectral-cli@6 lint openapi/openapi.yaml --fail-severity=error
      - name: OpenAPI breaking changes
        if: github.event_name == 'pull_request' && !contains(github.event.pull_request.labels.*.name, 'api-breaking-approved')
        run: |
          git show origin/${{ github.base_ref }}:openapi/openapi.yaml > /tmp/base.yaml
          docker run --rm -v /tmp:/base -v $PWD/openapi:/pr tufin/oasdiff breaking /base/base.yaml /pr/openapi.yaml --fail-on ERR
      - name: Dependency scan
        uses: aquasecurity/trivy-action@0.28.0
        with: { scan-type: fs, severity: 'HIGH,CRITICAL', ignore-unfixed: true, exit-code: '1' }
      - name: Secret scan
        uses: gitleaks/gitleaks-action@v2
        env: { GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}' }

  image:
    if: github.ref == 'refs/heads/main'
    needs: verify
    runs-on: ubuntu-24.04
    outputs:
      tag: sha-${{ steps.vars.outputs.sha }}
    steps:
      - uses: actions/checkout@v4
      - id: vars
        run: echo "sha=$(git rev-parse --short=12 HEAD)" >> "$GITHUB_OUTPUT"
      - uses: aws-actions/configure-aws-credentials@v4
        with: { role-to-assume: '${{ vars.AWS_BUILD_ROLE }}', aws-region: ap-south-1 }
      - id: ecr
        uses: aws-actions/amazon-ecr-login@v2
      - uses: docker/setup-qemu-action@v3
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v6
        with:
          platforms: linux/arm64
          push: true
          provenance: true
          sbom: true
          tags: ${{ steps.ecr.outputs.registry }}/karigar-api:sha-${{ steps.vars.outputs.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - name: Image scan + SBOM
        run: |
          IMG=${{ steps.ecr.outputs.registry }}/karigar-api:sha-${{ steps.vars.outputs.sha }}
          docker run --rm aquasec/trivy image --severity CRITICAL --ignore-unfixed --exit-code 1 "$IMG"
          docker run --rm aquasec/trivy image --format cyclonedx "$IMG" > sbom.cdx.json
      - uses: actions/upload-artifact@v4
        with: { name: sbom, path: sbom.cdx.json }

  deploy-staging:
    needs: image
    uses: ./.github/workflows/deploy.yml
    with: { environment: staging, tag: '${{ needs.image.outputs.tag }}' }
    secrets: inherit

  deploy-production:
    needs: [image, deploy-staging]
    uses: ./.github/workflows/deploy.yml
    with: { environment: production, tag: '${{ needs.image.outputs.tag }}' }
    secrets: inherit
```

```yaml
# .github/workflows/deploy.yml  (reusable)
name: deploy
on:
  workflow_call:
    inputs:
      environment: { type: string, required: true }
      tag: { type: string, required: true }

permissions: { contents: read, id-token: write }

jobs:
  deploy:
    runs-on: ubuntu-24.04
    environment: ${{ inputs.environment }}     # "production" has a required reviewer
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with: { role-to-assume: '${{ vars.AWS_DEPLOY_ROLE }}', aws-region: ap-south-1 }
      - name: Run Flyway migration task and wait
        run: ./ops/scripts/migrate.sh "${{ vars.ECS_CLUSTER }}" "${{ inputs.tag }}"
      - name: Rolling deploy
        run: ./ops/scripts/deploy.sh "${{ vars.ECS_CLUSTER }}" karigar-api "${{ inputs.tag }}"
      - name: Smoke tests
        run: ./ops/scripts/smoke.sh "${{ vars.API_BASE_URL }}"
      - name: Roll back on failure
        if: failure()
        run: ./ops/scripts/rollback.sh "${{ vars.ECS_CLUSTER }}" karigar-api
```

The three scripts are thin wrappers around `aws ecs run-task` / `aws ecs wait tasks-stopped` (checking exit code), `aws ecs register-task-definition` + `update-service` + `aws ecs wait services-stable`, and `curl` checks. Keeping them as scripts means a human can run the same steps by hand during an incident.

## 4.4 Other automation

* **Dependabot/Renovate:** weekly grouped PRs for Maven, GitHub Actions and Docker base images; security PRs immediately.
* **Nightly:** full E2E suite against staging, k6 load test on staging (testing/01 §49), `trivy image` re-scan of the image currently in production (new CVEs appear after deploy).
* **Branch protection:** required checks from §4.1, 1 approving review when there is a second engineer (solo: self-review via PR is still mandatory so checks run), linear history, squash merge.

---

# 5. Database Migrations

## 5.1 Rules

* **Flyway**, files in `src/main/resources/db/migration/` named `V<yyyymmddhhmm>__<description>.sql` (timestamp versions avoid merge collisions between branches). Repeatable `R__` only for views/functions and dev/staging seed.
* **Never edit an applied migration.** `flyway validate` in CI and at deploy fails on checksum mismatch. Fix with a new migration.
* **SQL, not Java migrations**, unless a backfill needs application logic.
* **Extensions in the first migration** (`V…__extensions.sql`): `CREATE EXTENSION IF NOT EXISTS postgis;` and `CREATE EXTENSION IF NOT EXISTS btree_gist;` ([architecture/03](../architecture/03-erd-and-production-database-design.md) — PostGIS columns and the exclusion constraints on worker schedules). On RDS these need the `rds_superuser` role, so they run as the migration user, which is granted it. Extension **version upgrades** (`ALTER EXTENSION postgis UPDATE`) are manual, planned changes, not part of an app release.
* **Two database roles:** `karigar_migrator` (owns the schema, DDL) used only by the migration task; `karigar_app` (DML on application tables only, no DDL) used by the running app. The app cannot drop a table even if compromised.
* Every migration must finish in seconds on production-size data. Long operations go in their own migration with explicit settings:
  * `CREATE INDEX CONCURRENTLY` (in a migration file containing only that statement, with Flyway's `executeInTransaction=false` script config);
  * `SET lock_timeout = '5s'` at the top of DDL migrations so a blocked `ALTER TABLE` fails fast instead of queuing all traffic behind it;
  * large backfills in batches (a Java migration or a one-off admin job), never one huge `UPDATE`.

## 5.2 Run as a separate step

The migration runs **before** the new version rolls out, as a one-off ECS task using the **same image** with the `migrate` profile:

```yaml
# application-migrate.yml
spring:
  main.web-application-type: none
  flyway:
    enabled: true
    locations: classpath:db/migration
karigar.scheduling.enabled: false      # no schedulers, no outbox poller
```

A small `ApplicationRunner` active only in `migrate` calls `SpringApplication.exit(...)` after startup, so the task exits 0 on success and non-zero on failure. The running app has `spring.flyway.enabled=false` in `staging`/`prod`, so N instances starting at once never race on migrations.

Alternative: the `flyway/flyway` CLI image with the SQL copied in — rejected because it is a second artifact whose Flyway version can drift from the app's.

## 5.3 Zero-downtime: expand and contract

During a rolling deploy the **old and new app versions run against the same schema at the same time**. Each migration must therefore be compatible with the currently deployed version.

| Change | Release N (expand) | Release N+1 | Release N+2 (contract) |
|---|---|---|---|
| Add column | Add nullable / with default | Code writes and reads it | Add `NOT NULL` (via `CHECK … NOT VALID` then `VALIDATE`) |
| Rename column | Add new column; code writes both, reads old | Backfill; code reads new | Drop old column |
| Drop column | Code stops using it | Drop column | — |
| New enum/state value | Add to `CHECK` constraint | Code starts emitting it | — |
| Change type | New column + dual write | Backfill + switch reads | Drop old |

Clients that cache state (mobile apps) also need the API-level version of this (§9.3).

## 5.4 Rollback strategy

* **Forward fix only.** No `undo` migrations (Flyway Teams only, and rarely safe with data). Because every migration is expand-only, the previous app version still works against the new schema, so an **app** rollback (§8.5) never needs a **schema** rollback.
* A destructive contract migration (drop column/table) is deployed **only after** the previous release has run in production for at least one full day.
* Before any migration that rewrites or deletes data, take a manual RDS snapshot (the migrate script does this automatically when the migration file name contains `__data_`). Point-in-time recovery is the last resort ([operations/03](03-backup-disaster-recovery-and-business-continuity.md)).

---

# 6. Infrastructure for the Pilot

## 6.1 Region and data residency

**AWS `ap-south-1` (Mumbai)** for everything that stores data: database, cache, object storage, logs, backups.

* RBI's payment data storage directive binds the payment system operator (Razorpay/Cashfree); we do not store card data at all. Keeping all our own data in India means the question never comes up in a provider or partner review.
* DPDP Act 2023 allows most cross-border transfers, but a single India region is simpler to explain to users and auditors.
* Third parties that process data outside India (Brevo — EU; Firebase/FCM — global) are listed in the privacy review and get only what they need (email address, push token, message text).
* Backups are copied to `ap-south-2` (Hyderabad) for DR, which stays in India ([operations/03](03-backup-disaster-recovery-and-business-continuity.md)).

Alternative clouds in one line: GCP `asia-south1` / Azure Central India are equivalent; AWS chosen for the widest managed PostGIS + Fargate + documentation coverage.

## 6.2 Topology

```text
                  Route 53 (api., media., admin.)
                         │
          ┌──────────────┴───────────────┐
          ▼                              ▼
   ALB (HTTPS, ACM cert)           CloudFront (media.)
   :443 → target group :8080             │ OAC
   WebSocket upgrade allowed             ▼
          │                        S3 media-public
          ▼                        (S3 media-private: presigned GET/PUT only)
   ECS Fargate service karigar-api
   1–2 tasks, arm64, 1 vCPU / 2 GB
   2 AZs, SG: ingress only from ALB SG
          │
   ┌──────┴────────────┐
   ▼                   ▼
 RDS PostgreSQL 17   ElastiCache (Redis OSS / Valkey)
 + PostGIS 3.5       cache.t4g.micro, single node
 db.t4g.small        private subnets
 private subnets
```

## 6.3 Decisions

| Component | Pilot choice | Why | Growth path |
|---|---|---|---|
| Container runtime | **ECS Fargate**, 1 task normal, 2 during deploys (2 permanent once paying users rely on it) | Rolling deploys, ALB health checks, restarts and OS patching handled by AWS; nothing to SSH into. A solo developer cannot also be a sysadmin. | Raise desired count / target-tracking autoscaling on CPU and p95 latency; split a `worker` service (same image, `worker` profile) when background load competes with API latency |
| Database | **RDS PostgreSQL 17 + PostGIS**, `db.t4g.small`, 20 GB gp3, single-AZ, automated backups 7 days, PITR (5-min RPO), deletion protection, Performance Insights (free tier) | Managed backups and PITR meet the RPO 15 min / RTO 1 h targets in [operations/03](03-backup-disaster-recovery-and-business-continuity.md) for a small DB | **Multi-AZ** before onboarding beyond the pilot or when payment volume makes a 30–60 min restore unacceptable; then a read replica for reporting (architecture/01 §55) |
| Cache | **ElastiCache, `cache.t4g.micro`, single node, no replica, no persistence**; Valkey engine (wire-compatible, cheaper) | Redis is non-authoritative ([ADR 0004](../adr/0004-redis-non-authoritative.md), [architecture/08](../architecture/08-caching-redis-and-distributed-state.md)); losing it degrades, never corrupts. Self-hosting Redis on Fargate needs a stable endpoint and patching for ~US$10 saved. | Replica + auto-failover when rate limiting and WebSocket fan-out (Redis pub/sub, architecture/07) become user-visible on a failover |
| Object storage | **S3** (`media-private`, `media-public`), versioning on private, lifecycle for orphaned uploads; **CloudFront** with Origin Access Control in front of `media-public` only | Direct upload via presigned URLs ([ADR 0013](../adr/0013-object-storage-direct-upload.md)); verification documents never public | Image processing via S3 event → in-app job, Lambda only if needed |
| Edge | **ALB** with ACM certificate, HTTP→HTTPS redirect, idle timeout 3600 s for WebSockets, AWS WAF managed rules **off** at pilot (adds ~US$10+/month) | One entry point; TLS managed and renewed by ACM | Turn on WAF with rate rules when abuse appears |
| DNS | **Route 53** hosted zone | Alias records to ALB/CloudFront; health checks later | — |
| Secrets | **SSM Parameter Store SecureString** for app secrets (free); **Secrets Manager** only for the RDS master and app DB passwords (managed rotation) | §7 | — |
| Logs/metrics | **CloudWatch Logs** (awslogs driver, 30-day retention, JSON logs), CloudWatch alarms to email/Slack via SNS; Micrometer metrics per [operations/01](01-observability-logging-metrics-and-tracing.md) | Zero extra infrastructure | OTel Collector sidecar → Grafana Cloud or AMP when CloudWatch dashboards become limiting |
| Registry | **ECR**, immutable tags, scan on push | Same region, IAM auth | — |

## 6.4 Networking (cost-aware)

* VPC with 2 public + 2 private subnets across two AZs.
* **No NAT gateway at pilot.** A NAT gateway costs ~US$35–45/month before traffic. Fargate tasks run in **public subnets with a public IP**, but their security group accepts traffic **only** from the ALB security group. RDS and ElastiCache sit in private subnets and accept traffic only from the task security group.
* Outbound calls (Brevo, Razorpay/Cashfree, FCM, maps) go out directly; provider webhooks come in through the ALB.
* Growth path: move tasks to private subnets + NAT gateway (or VPC endpoints for ECR/S3/SSM/Logs) when a provider requires a fixed egress IP for allow-listing or when security review asks for it.

## 6.5 Infrastructure as code (Terraform)

```text
infra/terraform/
├── modules/
│   ├── network/        # VPC, subnets, security groups
│   ├── database/       # RDS, parameter group, subnet group, roles bootstrap
│   ├── cache/          # ElastiCache
│   ├── storage/        # S3 buckets, CloudFront, OAC
│   ├── app/            # ECR, ECS cluster/service/task defs (app + migrate), ALB, ACM, Route 53 records, alarms
│   └── github-oidc/    # IAM roles assumed by GitHub Actions
└── envs/
    ├── staging/        # main.tf calling modules with small sizes
    └── production/
```

* Remote state in S3 with native lockfile (`use_lockfile = true`, Terraform ≥ 1.10; no DynamoDB table). One state per environment, in that environment's account.
* `terraform plan` runs on PRs touching `infra/` and posts the plan as a comment; `apply` is manual (`workflow_dispatch` with environment approval). Infra changes are rare; automation beyond this is not worth it yet.
* Terraform owns infrastructure; **CI owns the running image tag.** The ECS service has `lifecycle { ignore_changes = [task_definition] }` so `terraform apply` never reverts a deploy.
* `infra/` is added at repo root next to `docker/` (an addition to the [architecture/02](../architecture/02-project-directory-and-package-structure.md) §4 layout).

Alternatives in one line each: AWS CDK (fine, but Terraform skills transfer across clouds); ClickOps (not reproducible, rejected); Pulumi (smaller ecosystem for this team).

## 6.6 Estimated monthly cost (USD, on-demand, ap-south-1)

**Estimates only**, based on public pricing at writing; check the AWS pricing calculator before committing. Excludes data transfer spikes, taxes (18% GST on AWS India invoices) and third-party services.

| Item | Production (pilot) | Staging |
|---|---|---|
| ECS Fargate arm64, 1 vCPU / 2 GB, 1–2 tasks | 25–55 | 10–15 (0.5 vCPU / 1 GB, scaled to 0 at night) |
| ALB (base + low LCU) | 18–25 | 18–25 |
| RDS `db.t4g.small` single-AZ + 20 GB gp3 + backups | 25–35 | 12–18 (`db.t4g.micro`, stopped when idle) |
| ElastiCache `cache.t4g.micro` | 9–13 | 9–13 |
| S3 + CloudFront | 1–5 | < 1 |
| Public IPv4 addresses | 7–11 | 7–11 |
| CloudWatch logs, metrics, alarms | 5–15 | 2–5 |
| Route 53, ECR, SSM, Secrets Manager, KMS | 3–6 | 1–3 |
| **Total** | **~100–160** | **~40–70** |

Multi-AZ RDS adds ~US$25–35; a second permanent task adds ~US$25. Use AWS credits (Activate) and a 1-year Compute Savings Plan once the shape is stable (~20–30% off Fargate).

Cheaper alternative in one line: a single Lightsail/EC2 instance in Mumbai running `docker compose` (app + Redis) with a managed Lightsail PostgreSQL and Caddy for TLS — ~US$25–40/month total, but you own OS patching, deploy downtime, and PostGIS availability must be checked; acceptable for a demo, not for taking payments.

## 6.7 Deliberately not used (and the trigger to revisit)

| Not used | Revisit when |
|---|---|
| Kubernetes / EKS (control plane alone ~US$73/month) | More than ~5 services or a team that already runs Kubernetes |
| Kafka / MSK | Outbox throughput or consumer fan-out exceeds what PostgreSQL polling handles ([ADR 0005](../adr/0005-async-events-and-transactional-outbox.md)) |
| Multi-region active-active | Launch outside India or a contractual uptime requirement |
| Service mesh, API gateway product | Never for a single deployable |

---

# 7. Configuration & Secrets

## 7.1 Principles

* **12-factor:** one image, configuration only from environment variables. Spring relaxed binding maps `KARIGAR_PAYMENTS_PROVIDER` to `karigar.payments.provider`.
* All application settings are in `@ConfigurationProperties` classes with `@Validated` constraints. The app **fails at startup** on a missing or invalid value instead of failing on the first request.
* Profile YAML holds only non-secret defaults that are the same across machines of that environment type.
* **Secrets never in git**, never in YAML, never in image layers, never in logs (Actuator `env` and `configprops` endpoints are not exposed; values are masked). gitleaks in CI and pre-commit hooks catch mistakes; a leaked secret is rotated immediately, not just deleted from history ([security/01](../security/01-authentication-authorization-and-identity.md)).
* `.env.example` is committed with placeholder values; `.env` is git-ignored.

## 7.2 How secrets reach the app

ECS task definition `secrets` entries reference SSM Parameter Store / Secrets Manager ARNs. ECS injects them as environment variables at task start. The task execution role can read only `/karigar/<env>/*`. Nothing secret appears in the task definition JSON or in Terraform state (Terraform creates the parameter with a placeholder; the real value is set once with `aws ssm put-parameter` and ignored by Terraform).

## 7.3 Per-environment values

| Variable | local | staging | production | Secret? |
|---|---|---|---|---|
| `SPRING_PROFILES_ACTIVE` | `local` | `staging` | `prod` | No |
| `DB_URL` | `jdbc:postgresql://localhost:5432/karigar` | RDS staging endpoint | RDS prod endpoint | No |
| `DB_USERNAME` / `DB_PASSWORD` | `karigar` / `karigar` | `karigar_app` / Secrets Manager | `karigar_app` / Secrets Manager (rotated) | Password: yes |
| `DB_MIGRATOR_PASSWORD` | same as above | Secrets Manager | Secrets Manager | Yes (migrate task only) |
| `REDIS_HOST` / `REDIS_TLS` | `localhost` / `false` | ElastiCache / `true` | ElastiCache / `true` | No |
| `S3_ENDPOINT` | `http://localhost:9000` | unset (AWS default) | unset | No |
| `S3_BUCKET_PRIVATE` / `S3_BUCKET_PUBLIC` | `karigar-media-*` | `karigar-staging-media-*` | `karigar-prod-media-*` | No |
| `MEDIA_CDN_BASE_URL` | `http://localhost:9000/karigar-media-public` | `https://media.staging.<domain>` | `https://media.<domain>` | No |
| `JWT_SIGNING_KEY` | dev key in `.env` | SSM | SSM (rotated, §7.4) | Yes |
| `BREVO_API_KEY` | unset (Mailpit SMTP) | SSM (test key) | SSM | Yes |
| `KARIGAR_PAYMENTS_PROVIDER` | `fake` | `razorpay` (test) | `razorpay` or `cashfree` (live) | No |
| `PAYMENT_KEY_ID` / `PAYMENT_KEY_SECRET` / `PAYMENT_WEBHOOK_SECRET` | unset | SSM (test) | SSM (live) | Yes |
| `FCM_CREDENTIALS_JSON` | unset (logging sender) | SSM (staging Firebase) | SSM (prod Firebase) | Yes |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:*` | staging admin URL | `https://admin.<domain>` | No |
| `KARIGAR_SCHEDULING_ENABLED` | `true` | `true` | `true` (`false` in migrate task) | No |

S3 and SSM access uses the **ECS task role** (IAM), not access keys. Locally, MinIO credentials come from `.env`.

## 7.4 Rotation

| Secret | Rotation | How |
|---|---|---|
| RDS passwords | 90 days | Secrets Manager managed rotation; app uses a pool that reconnects; a rolling restart picks up the new value |
| JWT signing key | 180 days, or immediately on suspicion | Key ID (`kid`) in the token header; app accepts current + previous key, signs with current; remove previous after max refresh-session lifetime |
| Payment provider keys, webhook secrets | Yearly, or on staff change/suspicion | Provider dashboard supports two active keys; update SSM, rolling restart, revoke old |
| Brevo, FCM | Yearly | Same pattern |

Every rotation is a short runbook entry in [operations/04](04-failure-modes-resilience-and-recovery.md).

---

# 8. Deployment Strategy

## 8.1 Rolling deploy behind the ALB

**ECS rolling update** with `minimumHealthyPercent=100`, `maximumPercent=200` and the **deployment circuit breaker with rollback** enabled. A new task must pass the ALB health check before an old one is drained.

Alternative: blue-green via CodeDeploy — gives instant traffic switch-back, but adds CodeDeploy configuration and a second target group for little gain while expand-and-contract migrations make old and new versions compatible anyway. Revisit if a release ever has to be all-or-nothing.

## 8.2 Health checks

| Check | Endpoint | Used by | Includes |
|---|---|---|---|
| Liveness | `:8081/actuator/health/liveness` | ECS container health check | JVM up and not deadlocked. **No** DB/Redis — a database outage must not trigger a restart loop |
| Readiness | `:8081/actuator/health/readiness` | ALB target group (via a dedicated health-check port mapping) | DB connection; Redis is **not** included (ADR 0004: app degrades without Redis) |

ALB health check: interval 10 s, healthy threshold 2, unhealthy 3. ECS health check grace period 90 s (JVM start + Flyway validate + pool warm-up).

## 8.3 Graceful shutdown

```yaml
server.shutdown: graceful
spring.lifecycle.timeout-per-shutdown-phase: 25s
```

* ALB deregistration delay: 30 s; ECS `stopTimeout`: 60 s (above the Spring timeout).
* On `SIGTERM`: readiness goes `REFUSING_TRAFFIC`, in-flight HTTP requests finish, the outbox poller stops claiming new rows and finishes its current batch, WebSocket sessions are closed with a "reconnect" close code — clients reconnect to another task and re-fetch state, since there is no replay ([ADR 0014](../adr/0014-websocket-realtime-without-replay.md)).
* Anything not finished is safe to retry because outbox consumers and webhook handlers are idempotent ([operations/04](04-failure-modes-resilience-and-recovery.md) §56).

## 8.4 Background work with more than one task

During a rolling deploy there are always two tasks, so "only one instance" is never true.

| Work | Mechanism |
|---|---|
| Outbox publishing, notification retries | `SELECT … FOR UPDATE SKIP LOCKED LIMIT n` — every task polls; rows are claimed once ([architecture/09](../architecture/09-async-processing-domain-events-and-outbox.md)) |
| Periodic jobs (offer expiry sweeps, settlement, reconciliation, cleanup of orphaned uploads) | `@Scheduled` + **ShedLock** with the JDBC lock provider (table in PostgreSQL, not Redis, so locks survive a Redis outage) |
| Payment webhooks | Any task; dedupe by `UNIQUE (provider, event_id)` |

Alternative: a separate single-task `worker` service — added later (§6.3) for load isolation, not for correctness.

## 8.5 Feature flags

* A `feature_flags` table (`key`, `enabled`, `rollout_percent`, `allowed_user_ids`, `updated_by`, `updated_at`) read through a 30 s in-memory cache; changes via the admin panel and written to the audit log ([modules/11](../modules/11-admin-and-marketplace-operations.md)).
* Used for: dark-launching code merged to `main` before it is ready (trunk-based, §9), kill switches for risky paths (online payments, new matching rules), per-locality rollout across Howrah.
* Every flag has an owner and a removal date; flags older than 90 days show up in a weekly report.
* Alternative: Unleash/LaunchDarkly — rejected for now; a table and an admin toggle cover a handful of flags.

## 8.6 Rollback procedure

1. **Detect:** smoke test failure, ECS circuit breaker, or alarm (5xx rate, p95 latency, error logs) within 15 minutes after deploy ([operations/01](01-observability-logging-metrics-and-tracing.md)).
2. **Decide fast:** if the cause is the new code and not a flag-guarded feature, roll back; do not debug in production first.
3. **Roll back the app:** `ops/scripts/rollback.sh` re-points the service to the previous task definition (previous `sha-` tag) and waits for stability. Or run the `deploy` workflow with the previous tag. Takes ~5 minutes.
4. **Kill switch first if possible:** if the problem is in a flagged feature, turn the flag off; no deploy needed.
5. **Schema stays:** expand-only migrations mean the previous version runs against the new schema (§5.4). If a migration itself is wrong, write a forward-fix migration.
6. **Record:** incident note with timeline and the follow-up test that would have caught it.

---

# 9. Release & Versioning

## 9.1 Branching and commits

* **Trunk-based:** short-lived branches (≤ 2 days) off `main`, squash-merged via PR. No `develop` or release branches. Unfinished work merges behind a feature flag.
* **Conventional Commits** on PR titles (`feat(booking): …`, `fix(payment): …`, `feat!:` or `BREAKING CHANGE:` for breaking changes), enforced in CI.
* Every merge to `main` deploys to staging. Production deploys are the approved subset of those.

## 9.2 Versions and changelog

* **Semver for the backend:** `vMAJOR.MINOR.PATCH` git tag on the commit that was deployed to production. MAJOR only for a new API version (`/api/v2`), MINOR for features, PATCH for fixes.
* `release-please` (GitHub Action) maintains a release PR with the next version and `CHANGELOG.md` generated from Conventional Commits; merging it creates the tag and GitHub release (with the SBOM attached). Alternative: hand-written changelog — fine but gets skipped.
* `GET /actuator/info` (internal port) and a `X-App-Version` response header expose version + git SHA, so bug reports and logs identify the exact build.

## 9.3 Mobile app and API compatibility

* The API is versioned in the path (`/api/v1`, [api/01](../api/01-rest-api-contract-endpoints-and-error-model.md) §4–5). Within v1, changes are additive only; `oasdiff` blocks accidental breaking changes (§4.1).
* Mobile apps stay installed for months. Clients must ignore unknown fields and unknown enum values (api/01 §5); the backend must accept requests from the **oldest supported app version**.
* Apps send `X-App-Version` and `X-Platform`. A `min_supported_app_version` per platform (in the `feature_flags`/config table) lets the backend return `426 Upgrade Required` with a store link for versions that are truly incompatible. Used rarely, only for security or money-correctness fixes.
* Removing a field or endpoint: mark `deprecated` in OpenAPI, log its usage by app version, remove only when usage by supported versions is zero — or ship it in `/api/v2` ([api/02](../api/02-openapi-and-documentation-governance.md) §40).
* Mobile app releases have their own semver and store release cycle; backend releases never depend on a simultaneous app release.

---

# 10. Production Readiness Checklist (Launch Gate)

This is the infrastructure and delivery part of the [product/04 §77 MVP Launch Gate](../product/04-mvp-scope-release-plan-and-future-phases.md). All items must be checked before real customers or workers are onboarded.

**Delivery**

```text
[ ] Branch protection on main; all §4.1 checks required
[ ] Staging deploys automatically from main; production requires approval
[ ] Image built once, promoted by SHA; ECR tags immutable
[ ] Migration task runs before rollout; app has Flyway disabled; validate passes
[ ] Rollback rehearsed on staging (deploy N, roll back to N-1) and timed
[ ] ECS deployment circuit breaker with rollback enabled
[ ] Smoke tests cover login, request creation, presigned upload, sandbox payment webhook
```

**Infrastructure and security**

```text
[ ] All infrastructure in Terraform; no console-only resources in production
[ ] Separate AWS accounts for staging and production; MFA on root, root unused
[ ] GitHub → AWS via OIDC; no long-lived AWS keys anywhere
[ ] RDS: deletion protection, encryption at rest, automated backups + PITR, not publicly accessible
[ ] Security groups: tasks only from ALB; RDS and Redis only from tasks
[ ] TLS everywhere (ACM on ALB, CloudFront; Redis in-transit encryption; RDS sslmode=require)
[ ] App DB user has DML only; migrator credentials used only by the migrate task
[ ] Secrets only in SSM/Secrets Manager; gitleaks clean on full history; live payment keys only in prod
[ ] Private media bucket blocks public access; public bucket only via CloudFront OAC
[ ] Trivy: no fixable CRITICAL in the production image
```

**Operations** (links to the owning documents)

```text
[ ] Logs, metrics, dashboards and alerts live — operations/01
[ ] Alarm routing tested end to end (alert actually reaches a phone)
[ ] Backup restore tested into an isolated instance; RPO/RTO measured — operations/03
[ ] Cross-region backup copy to ap-south-2 verified — operations/03
[ ] Failure drills run on staging: Redis down, DB failover/restart, provider timeout,
    task killed mid-request — operations/04
[ ] Runbooks: deploy, rollback, migration failure, secret rotation, provider outage — operations/04
[ ] Cost budget alarm set (AWS Budgets) at 120% of the §6.6 estimate
```

---

## Open Decisions

1. Payment provider (Razorpay vs Cashfree) — affects only SSM values and webhook URLs here ([ADR 0007](../adr/0007-payment-provider-abstraction.md)).
2. Outbox scope at MVP ([ADR 0005](../adr/0005-async-events-and-transactional-outbox.md)) — does not change this document; the poller runs either way for critical flows.
3. When to switch RDS to Multi-AZ — proposed trigger: before onboarding beyond the Howrah pilot cohort or before online payment volume exceeds an agreed daily amount.
4. Observability backend beyond CloudWatch ([operations/01](01-observability-logging-metrics-and-tracing.md) §15).
