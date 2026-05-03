# Potential New Services for YBB Platform

This document proposes optional new services that could reduce load on the API gateway, improve public-page speed, isolate CPU-heavy work, and make the platform easier to scale.

The recommendation is **not** to add many services immediately. More services create more operational overhead: deployment, observability, authentication, queues, schema contracts, failure modes, and local development complexity. The safer strategy is to build clear boundaries inside existing services first, then split into dedicated services only when load or complexity justifies it.

## How to Use This Document

Use this document only when deciding whether a workload should become a separate service. For the immediate implementation order, start with [`PLATFORM_OPTIMIZATION_RECOMMENDATIONS.md`](./PLATFORM_OPTIMIZATION_RECOMMENDATIONS.md), especially the **Step-by-Step Implementation Roadmap**.

Decision rule:

1. Build the boundary inside an existing service first.
2. Add metrics around load, latency, CPU, memory, queue depth, and failure rate.
3. Split into a new service only if the boundary needs independent scaling, deployment, ownership, or failure isolation.

## Implementation Status (May 2026)

Landing Content has already passed the boundary-first rollout and is now running as a standalone service at `services/landing-content`.

- Boundary phase completed in API: persisted `brand_landing_snapshots` + invalidation + backfill tooling.
- Dedicated service deployed: read-only public endpoints under `/v1/public/:brand/*`.
- Frontend (`ybb-program-next`) now uses landing-content-first reads with API fallback for:
  - `home`, `settings`, `programs`, `partners`, `announcements`, `faqs`.
- Production topology: internal-only service on `dokploy-network` (no public Traefik route required).

This means the “first split” recommendation in this document has been implemented.

## Summary Recommendation

| Order | Service | Primary Value | Add When |
| ---: | --- | --- | --- |
| 1 | Landing Content Service | Near-instant public pages and API read-load offload | Public landing traffic grows, content reads dominate API load, or multi-brand cache invalidation becomes complex |
| 2 | Image Processing Service | Faster image-heavy pages and isolated CPU work | Large images/galleries hurt LCP or upload/image optimization uses too much CPU |
| 3 | Reporting/Export Service | Offload long-running admin exports | Exports become slow, memory-heavy, or frequently used |
| 4 | Search Service | Fast, ranked, faceted search | Postgres full-text/trigram search is no longer enough |
| 5 | Realtime Gateway | Live status updates | Product needs real-time payment/report/application updates |

Opinionated recommendation: **start with the Landing Content Service boundary first**, because it directly supports the most important frontend goal: making `ybb-program-next` public pages feel almost instant while reducing API gateway read load.

## Recommended Stacks Overview

Prefer stacks already used in the workspace unless there is a strong reason to introduce something new. This keeps hiring, deployment, local development, observability, and shared tooling simpler.

| Service | Recommended Stack | Why |
| --- | --- | --- |
| Landing Content Service | **NestJS + TypeScript**, Postgres, Redis, RabbitMQ, OpenTelemetry | Fits existing API patterns and Prisma/Nest expertise; mostly HTTP + cache + event handling. |
| Image Processing Service | **Python + FastAPI worker** or Python worker process, Pillow/libvips, MinIO/S3, RabbitMQ | Python is already used in file service and has strong image tooling. |
| Reporting/Export Service | **NestJS worker** for API-shaped reports, or **Python worker** for heavier Excel/PDF workloads, Postgres, MinIO/S3, RabbitMQ | Choose based on report type; use existing Excel/PDF libraries where they fit. |
| Search Service | **Meilisearch** or **Typesense** first; OpenSearch only if advanced scale/analytics are needed | Easier operations than Elasticsearch/OpenSearch and good enough for most app search. |
| Realtime Gateway | **NestJS WebSocket/SSE gateway** with Redis Pub/Sub or RabbitMQ | Fits existing Node/Nest ecosystem and integrates well with current events. |

Default infrastructure:

- **Postgres** for durable metadata/state.
- **Redis** for hot cache, single-flight locks, lightweight coordination, and rate limiting.
- **RabbitMQ** for async jobs/events because it already exists in the platform.
- **MinIO/S3-compatible storage** for generated JSON snapshots, reports, and image variants.
- **OpenTelemetry + Prometheus + Loki** for tracing, metrics, and logs.

Avoid adding Kafka, Elasticsearch/OpenSearch, or Kubernetes-only patterns unless the current RabbitMQ/Postgres/Redis stack is demonstrably insufficient.

## Guiding Principle: Boundary First, Service Later

Start each idea as a module, worker, or queue-backed component in an existing service. Split into a separate service when there is a clear reason.

| Need | Start Simple | Split Later Into |
| --- | --- | --- |
| Public landing snapshots | API module + snapshot table/cache | Landing Content Service |
| Image variants | File service background worker | Image Processing Service |
| Reports/exports | API queued jobs | Reporting/Export Service |
| Search | Postgres full-text/trigram indexes | Search Service |
| Realtime updates | Polling or simple SSE in API | Realtime Gateway |

Why: this keeps the system manageable while preserving the option to scale independently later.

## 1. Landing Content Service

### Recommended Stack

Recommended: **NestJS + TypeScript**.

Use:

- **NestJS** for HTTP endpoints, modules, guards, validation, and health checks.
- **Prisma or node-postgres** for snapshot metadata. Prisma is convenient if schema ownership stays close to the API; `pg` is fine for a very small read-optimized service.
- **Redis** for hot snapshot cache and single-flight rebuild locks.
- **RabbitMQ** for `content.changed`, `brand.updated`, and `program.published` events.
- **MinIO/S3-compatible storage + CDN** if snapshots are later stored as static JSON files.
- **OpenTelemetry, Prometheus, Loki** for tracing/metrics/logs.

Why NestJS: the API and notification service already use NestJS, so this keeps conventions, validation, DI, logging, and testing familiar.

### Purpose

Serve public, brand-scoped landing content as precomputed snapshots instead of making the API gateway assemble relational data on every public request.

This service would own read-optimized public endpoints such as:

```text
GET /public/:brand/home
GET /public/:brand/settings
GET /public/:brand/programs
GET /public/:brand/programs/:slug
GET /public/:brand/gallery
GET /public/:brand/partners
GET /public/:brand/faqs
```

### Why This Should Be First

This is the most directly valuable new-service candidate because it helps with both:

- **Frontend speed:** `ybb-program-next` can load cached public content almost instantly.
- **API offload:** public anonymous traffic stops competing with auth, applications, payments, and admin workloads.

Public landing content is mostly read-heavy and not user-specific, which makes it ideal for aggressive caching and CDN delivery.

### Proposed Architecture

```text
Admin edits content in API
-> API writes normalized relational records
-> API emits content.changed event
-> Landing Content Service rebuilds affected snapshot
-> Snapshot stored in Redis/Postgres/object storage
-> CDN/Next frontend reads snapshot
-> Brand/page cache tag revalidated
```

### Snapshot Storage Options

Option A: Postgres table.

```sql
CREATE TABLE brand_landing_snapshots (
  brand_id UUID NOT NULL,
  page VARCHAR(64) NOT NULL,
  slug VARCHAR(255),
  payload_json JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, page, slug)
);
```

Option B: Object storage files behind CDN.

```text
public-content/{brandSlug}/home.json
public-content/{brandSlug}/settings.json
public-content/{brandSlug}/programs.json
public-content/{brandSlug}/programs/{programSlug}.json
public-content/{brandSlug}/gallery.json
```

Option C: Redis cache with Postgres fallback.

```text
landing_snapshot:{brandId}:home
landing_snapshot:{brandId}:settings
landing_snapshot:{brandId}:programs
landing_snapshot:{brandId}:program:{slug}
```

Best practical start: **Postgres snapshot table + Redis/Next/CDN cache in front**. Object storage/CDN JSON can come later if public traffic is very high.

### Responsibilities

- Build compact public page payloads.
- Serve brand/page snapshots quickly.
- Version snapshots.
- Support preview vs published snapshots if needed.
- Emit/trigger revalidation for frontend/CDN caches.
- Keep public schemas stable for `ybb-program-next`.

### Should Not Own

- Admin write operations.
- User-specific portal/dashboard data.
- Payments.
- Auth/session logic.
- Application submission mutations.

### Suggested Initial Payloads

```text
home
settings
programs
program_detail:{slug}
gallery:first-page
partners
faqs
```

### Integration With `ybb-program-next`

The frontend should prefer:

```text
Landing Content Service snapshot
-> Next Data Cache by brand/page tag
-> streamed below-fold sections
-> CDN-cached images
```

This avoids making the frontend block on slow API assembly or large relational queries.

### Rollout Plan

1. Add snapshot generation inside API first.
2. Store snapshots in a table.
3. Update frontend to read snapshots for one low-risk page, such as partners or FAQs.
4. Add admin publish-triggered snapshot rebuild.
5. Add brand/page revalidation.
6. Move home/programs/gallery to snapshots.
7. Split into separate service only after the boundary is stable.

### Success Metrics

- Public homepage TTFB drops.
- API gateway read QPS drops for landing endpoints.
- Landing endpoint p95 latency decreases.
- Fewer Prisma queries per public page load.
- Cache hit ratio increases.
- Brand update invalidates only affected brand/page.

## 2. Image Processing Service

### Recommended Stack

Recommended start: **Python worker inside the existing file service**.

Recommended split later: **Python + FastAPI control API + background worker**.

Use:

- **Python** because the file service already uses FastAPI and Python image/document tooling.
- **Pillow** for basic image validation/resizing.
- **libvips via pyvips** for faster/lower-memory image processing when volume grows.
- **MinIO/S3 SDK** for reading originals and writing variants.
- **RabbitMQ** for `file.uploaded`, `image.process.requested`, and `image.processed` events.
- **Postgres** for file metadata and processing status.
- **Redis** only if needed for short-lived locks/deduplication.

Prefer **libvips/pyvips** over Pillow for high-volume production resizing because it is usually much faster and more memory-efficient. Pillow is acceptable for a first implementation and validation logic.

### Purpose

Generate optimized image variants asynchronously so the frontend never has to load or optimize massive originals for cards, galleries, hero images, or OG images.

### Proposed Flow

```text
File uploaded
-> file.uploaded event
-> Image Processing Service downloads original
-> Generates variants
-> Uploads variants to storage/CDN bucket
-> Updates file metadata with variant URLs
-> Emits image.processed event
```

### Suggested Variants

```text
thumbnail-320w.webp
thumbnail-640w.webp
card-768w.webp
hero-1200w.webp
hero-1920w.avif
og-1200x630.webp
blur-placeholder.json or blurDataURL
```

### Why It Helps

- Faster public pages.
- Better LCP for hero images.
- Lower bandwidth.
- Less on-demand work for Next/Image.
- File service stays responsive.
- CPU-heavy image processing is isolated.

### Start Simple

Begin as a background worker inside the file service:

```text
file service upload
-> enqueue image processing job
-> worker generates variants
```

Split into a dedicated service when:

- image processing slows uploads
- CPU usage affects file-service API latency
- gallery/public media grows significantly
- variant generation needs independent scaling

### Key Requirements

- Validate image magic bytes.
- Protect against decompression bombs.
- Strip sensitive EXIF metadata.
- Preserve original image separately.
- Make processing idempotent.
- Retry transient storage failures.
- Mark failed processing status clearly.

### Success Metrics

- Reduced image transfer size.
- Improved homepage/program LCP.
- Fewer Next/Image optimization misses.
- Lower file service p95 latency during uploads.
- High CDN cache hit ratio for variants.

## 3. Reporting/Export Service

### Recommended Stack

Recommended start: **NestJS worker inside the API service** for simple reports.

Recommended split options:

- **NestJS + TypeScript** if reports mostly reuse API DTOs/query logic and Excel generation remains simple.
- **Python + FastAPI/worker** if reports become document-heavy, data-science-like, or need stronger Excel/PDF tooling.

Use:

- **RabbitMQ** for report jobs.
- **Postgres** for `report_jobs` state and report audit history.
- **MinIO/S3-compatible storage** for generated report files.
- **Notification service** for "report ready" emails or in-app notifications.
- **Redis** only for temporary progress/status cache if needed.

For Excel-heavy work in Node, use the existing Excel tooling if stable. For very large exports, prefer streaming writers and batch DB reads regardless of language.

### Purpose

Offload expensive admin exports and reports from the API gateway.

Current reporting/export work can become memory-heavy because large result sets are loaded and transformed for Excel/PDF output. A dedicated service can process reports asynchronously.

### Proposed Flow

```text
Admin requests export
-> API creates report job
-> Reporting Service processes job in background
-> Output saved to file storage
-> Notification sent when ready
-> Admin downloads generated file
```

### Good Candidates

- Audit log export.
- User export.
- Participant export.
- Payment export.
- Application export.
- Scheduled analytics reports.
- Large Excel/PDF generation.

### Why It Helps

- API no longer holds long HTTP requests.
- Heavy memory work is isolated.
- Reports can be retried.
- Reports can run with lower priority.
- Admin gets a better UX with progress/status.

### Start Simple

Start with API-created report jobs and a worker process:

```sql
report_jobs (
  id UUID PRIMARY KEY,
  type VARCHAR(100),
  status VARCHAR(30),
  requested_by UUID,
  filters JSONB,
  output_file_id UUID,
  error_message TEXT,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
)
```

Split later when report workloads become frequent or heavy.

### Success Metrics

- API export endpoints no longer time out.
- API memory usage decreases during exports.
- Reports are retryable.
- Admin can see report progress/history.

## 4. Search Service

### Recommended Stack

Recommended progression:

1. **Postgres full-text search + `pg_trgm`** inside the existing API database.
2. **Meilisearch** or **Typesense** when a dedicated search engine is needed.
3. **OpenSearch** only for advanced scale, analytics, or log/search convergence.

Recommended first dedicated search stack: **Meilisearch**.

Why Meilisearch:

- Simple operations.
- Great typo tolerance and ranking defaults.
- Fast public/admin search setup.
- Easier than OpenSearch for a small team.

When to choose Typesense:

- You prefer stricter typed schemas.
- Faceted/filter-heavy search is central.
- You want strong typo-tolerant search with predictable memory usage.

Use:

- **RabbitMQ** for indexing events.
- **Postgres** as source of truth.
- **Search engine** as rebuildable projection, not primary data store.
- **API gateway or Landing Content Service** as the public search facade, not direct browser access to internal search credentials.

### Purpose

Provide fast, ranked, faceted search across public and admin data when Postgres search becomes insufficient.

Potential technologies:

- Meilisearch
- Typesense
- OpenSearch
- Elasticsearch

### Index Candidates

Public:

- programs
- partners
- FAQs
- content pages
- announcements

Admin:

- participants
- applications
- payments
- users
- support tickets

### When to Add

Do not add this first. Start with Postgres:

- `pg_trgm`
- full-text search
- expression indexes
- denormalized search columns

Add a search service only when:

- admin search remains slow
- filters/facets become complex
- public search needs autocomplete
- ranking/relevance becomes important
- search traffic or data size grows beyond comfortable Postgres usage

### Proposed Flow

```text
API data changes
-> search.index event
-> Search Service updates index
-> Frontend/API queries search service
```

### Success Metrics

- Search p95 latency decreases.
- Relevant results improve.
- API/Postgres load from search decreases.
- Admin search UX supports useful filters/facets.

## 5. Realtime Gateway

### Recommended Stack

Recommended: **NestJS + TypeScript** with WebSocket or Server-Sent Events.

Use:

- **NestJS WebSocket gateway** if bidirectional communication is needed.
- **Server-Sent Events (SSE)** if updates are server-to-client only.
- **Redis Pub/Sub** for fan-out across gateway instances.
- **RabbitMQ** for durable domain events from services.
- **Postgres** only for durable notification history if needed.

Prefer **SSE first** for payment/report/application status updates because it is simpler than WebSockets and works well for one-way updates. Use WebSockets only if clients need to send real-time messages back to the server.

### Purpose

Provide WebSocket or Server-Sent Events updates for user/admin experiences that benefit from live status changes.

Possible use cases:

- payment status updates
- report ready notifications
- application status changes
- document generation status
- admin notifications
- queue/job progress

### When to Add

Do not add this unless the product needs live UX. Polling is simpler and may be enough for now.

Add when:

- payment/report status needs to update instantly
- polling traffic becomes wasteful
- admin needs live operational notifications
- participants need real-time application/payment feedback

### Proposed Flow

```text
Domain event emitted
-> Realtime Gateway receives event
-> Gateway pushes update to subscribed clients
```

### Success Metrics

- Less polling traffic.
- Faster status visibility.
- Better user experience for payment/report/application flows.

## Cross-Cutting Requirements for Any New Service

Every new service should include these from day one:

### Security

- Internal service authentication.
- Least-privilege DB/storage credentials.
- No raw secrets or tokens in logs.
- Explicit CORS policy if public-facing.
- Input validation at service boundary.

### Observability

- Health endpoint.
- Readiness endpoint with dependency checks.
- Structured logs with correlation IDs.
- Metrics for request count, latency, errors, queue depth.
- Tracing across API, queue, and service worker.

### Reliability

- Idempotent event handling.
- Retry policy with backoff.
- Dead-letter queue for failed jobs/events.
- Clear failure status in DB.
- Safe rollback path.

### Contracts

- Versioned API payloads.
- Contract tests with API/frontend.
- Backward-compatible response changes.
- Typed DTOs or shared schema definitions.

### Operations

- Dockerfile and compose config.
- Environment variable documentation.
- Deployment health checks.
- Resource limits.
- Runbook for common failures.

## Suggested Service Template

When adding a new service, use this baseline structure so it fits the existing platform.

### NestJS Service Template

Use for:

- Landing Content Service
- Reporting/Export Service if implemented in Node
- Realtime Gateway

Recommended structure:

```text
services/{service-name}/
  src/
    main.ts
    app.module.ts
    modules/
      health/
      metrics/
      {domain-module}/
    shared/
      config/
      logging/
      tracing/
      rabbitmq/
      redis/
      database/
  test/
  Dockerfile
  docker-compose.yml
  package.json
```

Recommended libraries:

- `@nestjs/common`, `@nestjs/core`, `@nestjs/config`
- `@nestjs/microservices` for RabbitMQ
- `@nestjs/terminus` or equivalent health checks
- `ioredis` or existing Redis client pattern
- `pg` or Prisma depending on schema complexity
- `prom-client` for Prometheus metrics
- OpenTelemetry packages matching existing services

### Python Worker/FastAPI Template

Use for:

- Image Processing Service
- Reporting/Export Service if implemented in Python

Recommended structure:

```text
services/{service-name}/
  app/
    main.py
    worker.py
    config.py
    domain/
    application/
    infrastructure/
      storage/
      messaging/
      persistence/
      telemetry/
    presentation/
      api/
  tests/
  Dockerfile
  docker-compose.yml
  requirements.txt
```

Recommended libraries:

- `fastapi` for control/health API
- `uvicorn` for HTTP serving
- `pydantic` for config and DTOs
- `aio-pika` or existing RabbitMQ client pattern
- `minio` or S3-compatible SDK
- `pillow` initially, `pyvips` when optimizing performance
- `prometheus-fastapi-instrumentator`
- OpenTelemetry packages matching file service

### Service Runtime Requirements

Every new service should expose:

```text
GET /health
GET /ready
GET /metrics
```

Every queue consumer should track:

- messages received
- messages succeeded
- messages failed
- retry count
- DLQ count
- processing duration
- oldest queued job age

Every service should support:

- graceful shutdown
- bounded concurrency
- request/job correlation IDs
- structured JSON logs in production
- safe startup validation for required env vars

## Recommended Implementation Sequence

### Step 1: Build Landing Snapshot Boundary Inside API

Before creating a new service:

1. Add `brand_landing_snapshots` table.
2. Add snapshot builder for home/settings/programs.
3. Add API read endpoint for snapshots.
4. Add admin publish-triggered rebuild.
5. Add brand/page revalidation.
6. Update `ybb-program-next` to read snapshot for one page.

### Step 2: Add Image Variants as File-Service Worker

1. Add image variant metadata model.
2. Generate variants for new uploads.
3. Backfill variants for important existing public images.
4. Update frontend image selection.
5. Put variants behind CDN.

### Step 3: Split Only If Needed

Split into a dedicated Landing Content Service or Image Processing Service when:

- API/file service resource usage justifies independent scaling.
- deployment cadence differs from the parent service.
- code ownership or failure isolation becomes valuable.
- metrics show the module is a bottleneck.

## Final Recommendation

The most valuable new-service path is:

1. **Landing Content Service boundary** for public snapshots and near-instant pages.
2. **Image Processing worker/service** for responsive image variants.
3. **Reporting/Export worker/service** if admin exports grow.

Avoid adding Search or Realtime services until product needs clearly justify them. Start simple, build clean boundaries, measure the load, and split services only when the operational cost is worth it.
