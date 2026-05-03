# YBB Platform Optimization Recommendations

This document summarizes improvement opportunities found from a static review of the YBB Platform services, especially:

- `services/api` - NestJS API gateway with Prisma, Redis cache, RabbitMQ consumers, auth, payment integration
- `services/file` - FastAPI file service with MinIO/S3-compatible storage and Postgres metadata
- `services/payment` - Go payment service with GORM, idempotency, encrypted gateway config
- `services/notification` - NestJS notification service consuming RabbitMQ events and sending email
- `../ybb-program-next` - Next.js participant frontend with App Router, BFF API routes, brand-aware settings, and portal flows

The system already has several strong foundations: Redis-backed cache and throttling in the API, Prisma query metrics, payment idempotency, encrypted payment gateway credentials, payment webhook validation, and a presigned upload flow for direct-to-storage file uploads.

## How to Use This Document

Use this document as the main implementation roadmap. It is intentionally broad, but the work should be executed in small phases:

1. Start with **Step-by-Step Implementation Roadmap** near the end of this document.
2. Use **Recommended First 10 Pull Requests** as the initial execution queue.
3. Before each PR, read the detailed section for that area.
4. Use **Testing and Safe Rollout Strategy** before merging or enabling behavior changes.
5. For optional service splits, read [`POTENTIAL_NEW_SERVICES.md`](./POTENTIAL_NEW_SERVICES.md). Do not create new services until the boundary has been proven inside existing services.

Recommended first focus: **frontend instant-load quick wins + production safety + brand-scoped cache correctness**. These deliver visible value while reducing risk for deeper backend changes.

## Implementation Progress (Live)

This section is updated during execution so progress can be tracked without checking chat history.

| Date | Item | Status | Notes |
| --- | --- | --- | --- |
| 2026-05-03 | PR #1 - Baseline + flags + smoke tests (`ybb-program-next`) | Merged | Added baseline checklist doc, feature-flag plumbing, and Playwright smoke coverage. PR: https://github.com/hdpolover/ybb-program-next/pull/14 |
| 2026-05-03 | PR #2 - Root layout speed quick win (`ybb-program-next`) | Merged | Removed `getHomePageData()` dependency from root layout so shared layout work is lighter. PR: https://github.com/hdpolover/ybb-program-next/pull/15 |
| 2026-05-03 | PR #3 - Script/image quick wins (`ybb-program-next`) | Merged | Added route-aware chat script gating and reduced home gallery initial render size. PR: https://github.com/hdpolover/ybb-program-next/pull/16 |
| 2026-05-03 | PR #4 - Production safety (`ybb-program-next`) | Merged | Removed BFF debug payloads and hardcoded staging API fallbacks for auth-critical routes; added production env fail-closed checks for API URLs. PR: https://github.com/hdpolover/ybb-program-next/pull/17 |
| 2026-05-03 | PR #5 - Revalidation security (`ybb-program-next`) | Merged | Hardened settings/home revalidation endpoint auth with production-required secrets and constant-time bearer comparison. PR: https://github.com/hdpolover/ybb-program-next/pull/18 |
| 2026-05-03 | PR #6 - BFF CSRF/origin guard (`ybb-program-next`) | Merged | Added shared same-origin guard for mutating BFF routes in log-only rollout mode behind `ENABLE_CSRF_GUARD`. PR: https://github.com/hdpolover/ybb-program-next/pull/19 |
| 2026-05-03 | PR #7 - Brand-scoped cache and revalidation (`ybb-program-next`) | Merged | Added brand-scoped cache tags/localStorage keys and brand-targeted revalidation (`?brandDomain=`) while keeping global revalidation fallback. PR: https://github.com/hdpolover/ybb-program-next/pull/20 |
| 2026-05-03 | PR #8 - Database index batch 1 (`ybb-platform/services/api`) | Merged | Added highest-impact composite indexes for applications, programs, users, and invoices via Prisma migration. PR: https://github.com/hdpolover/ybb-platform/pull/6 |
| 2026-05-03 | PR #9 - Stats query optimization (`ybb-platform/services/api`) | Merged | Replaced row-loading distinct-country counts with SQL `COUNT(DISTINCT ...)` in stats impact/geography flows and added focused unit coverage. PR: https://github.com/hdpolover/ybb-platform/pull/7 |
| 2026-05-04 | PR #10 - File service security hardening (`ybb-platform/services/file` + `services/api`) | Merged | Added internal service-key guard for private file endpoints, enforced user+brand ownership on file-ready flow, and wired API gateway to derive identity from JWT instead of client-supplied IDs. PR: https://github.com/hdpolover/ybb-platform/pull/9 |
| 2026-05-04 | PR #11 - BFF CSRF/origin guard enforcement (`ybb-program-next`) | Merged | Enforced same-origin guard in production for mutating BFF routes (kept log-only rollout behavior for non-production via flag), with referer fallback when origin is absent. PR: https://github.com/hdpolover/ybb-program-next/pull/21 |
| 2026-05-04 | PR #12 - Payment internal auth fail-closed (`ybb-platform/services/payment`) | Merged | Payment service now requires `INTERNAL_SERVICE_KEY` in non-local environments so private HTTP/gRPC routes cannot run with empty internal auth config. PR: https://github.com/hdpolover/ybb-platform/pull/10 |
| 2026-05-04 | PR #13 - Sensitive log redaction (`ybb-platform/services/api` + `services/notification`) | Merged | Removed raw JWT/payment response logs and replaced notification auth/payment event payload logging with redacted summaries that avoid token/full-payload leakage. PR: https://github.com/hdpolover/ybb-platform/pull/11 |
| 2026-05-04 | PR #14 - Phase 3 cache correctness batch (`ybb-program-next`) | Merged | Added brand-domain resolution memoization, in-flight stampede protection for settings/home cache keys, and short-TTL brand-scoped payment-methods caching. PR: https://github.com/hdpolover/ybb-program-next/pull/22 |
| 2026-05-04 | PR #15 - Application search trigram indexes (`ybb-platform/services/api`) | Merged | Added `pg_trgm` and partial GIN trigram indexes for `participants.full_name` and `users.email` to speed case-insensitive application search filters. PR: https://github.com/hdpolover/ybb-platform/pull/12 |
| 2026-05-04 | PR #16 - Prisma pool tuning + slow-query observability (`ybb-platform/services/api`) | Merged | Added env-driven Prisma/pg pool tuning, expanded pool pressure metrics (open/idle/waiting), and added slow-query counters/warnings for dashboard alerting. PR: https://github.com/hdpolover/ybb-platform/pull/13 |

## Priority Summary

| Priority | Area | Recommendation |
| --- | --- | --- |
| P0 | Security | Protect file service endpoints and stop trusting client-supplied `user_id` / `brand_id` as authority. |
| P0 | Security | Redact sensitive logs, especially password reset, email verification, webhook, and payment event payloads. |
| P0 | Security | Make internal payment service authentication fail closed in staging/production. |
| P1 | Database | Add composite indexes that match real filters and sort orders. |
| P1 | Performance | Optimize stats queries that currently load distinct rows only to count them. |
| P1 | Caching | Replace broad Redis pattern invalidation with versioned/tagged cache invalidation. |
| P1 | Reliability | Add notification idempotency and RabbitMQ retry/dead-letter handling. |
| P1 | Frontend Security | Add CSRF/origin protection to cookie-authenticated mutating BFF routes. |
| P1 | Frontend Caching | Make Next.js cache tags and client settings cache brand-scoped. |
| P2 | Scalability | Move large admin listings/exports/downloads toward streaming and cursor pagination. |
| P2 | Frontend Polish | Improve route-level skeletons, empty states, accessibility, SEO, and Web Vitals tracking. |

## API Service Improvements

### 1. Add Query-Aligned Composite Indexes

The Prisma schemas already define many single-column indexes, but common queries filter by several fields and then sort. Composite indexes should match those access patterns.

Recommended candidate indexes:

```sql
-- Applications list/search/count by program/status/category/date/order.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apps_program_status_submitted
  ON participant_applications (program_id, status, submission_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apps_program_category_submitted
  ON participant_applications (program_id, application_category, submission_date DESC)
  WHERE deleted_at IS NULL;

-- Program listings by brand and visibility/lifecycle.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_programs_brand_visibility_year
  ON programs (brand_id, is_published, is_visible_to_users, deleted_at, year DESC, created_at DESC);

-- Admin user lists.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_brand_deleted_created
  ON users (brand_id, deleted_at, created_at DESC);

-- Payment invoice lookups.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_external_intent_status
  ON application_invoices (external_intent_id, status);
```

Before adding indexes permanently, validate each with:

```sql
EXPLAIN (ANALYZE, BUFFERS)
-- target query here
```

Why: indexes have write/storage cost, so only keep indexes that serve real high-frequency or high-latency queries.

### 2. Optimize Stats Queries

`services/api/src/modules/stats/stats.service.ts` currently uses `findMany({ distinct })` and then counts rows in memory for distinct country counts.

Improve this by:

- Replacing row-loading distinct queries with `COUNT(DISTINCT origin_country)` via raw SQL or a dedicated repository helper.
- Running independent counts with `Promise.all`.
- Caching impact stats and geography stats separately.
- Considering an aggregate table such as `brand_participant_stats` if public stats become high traffic.

Why: counting distinct values in the database avoids transferring unnecessary rows into the API process.

### 3. Improve Application Search

`ApplicationRepository.findByProgram` and `findByBrand` search multiple fields using case-insensitive `contains` filters across text columns and relations.

Recommended improvements:

- Enable Postgres `pg_trgm`.
- Add trigram indexes for `participants.full_name` and `users.email`.
- Use full-text search for longer text fields such as motivation letter, achievements, and experiences.
- Consider a denormalized searchable column/table for admin application search.

Example:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_participants_full_name_trgm
  ON participants USING gin (full_name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_trgm
  ON users USING gin (email gin_trgm_ops);
```

Why: `contains`/`ILIKE '%term%'` style searches are expensive on large tables without trigram or full-text indexes.

### 4. Prefer Cursor Pagination for Large Lists

Several list/export paths use `skip`/`offset` pagination. Offset is acceptable for small pages, but deep pages become expensive.

Recommended:

- Keep offset pagination for small bounded admin views.
- Use cursor pagination for high-volume data such as applications, users, audit logs, and payment history.
- Cursor by stable ordering keys, for example `(created_at, id)`.

Why: cursor pagination avoids scanning and discarding earlier rows for deep pages.

### 5. Stream Exports in Batches

`services/api/src/modules/reporting/reporting.service.ts` loads up to 2,000 or 5,000 rows before generating Excel exports.

Recommended:

- Stream rows in batches.
- Add filters for date range, brand, program, status.
- Avoid exporting broad datasets without filters in production.

Why: export endpoints can become memory-heavy and can compete with normal API traffic.

### 6. Tune Prisma/Postgres Pool Settings

`PrismaService` creates a `pg.Pool` with only the connection string.

Recommended:

- Add env-configured pool values:
  - `DATABASE_POOL_MAX`
  - `DATABASE_POOL_IDLE_TIMEOUT_MS`
  - `DATABASE_POOL_CONNECTION_TIMEOUT_MS`
- Track pool wait time, not only open connections.
- Add slow-query logging above a threshold such as 300-500ms.

Why: under load, pool saturation often causes latency before the database itself is fully saturated.

## Cache Strategy Improvements

### 1. Replace Broad Pattern Invalidation

`CacheService.invalidateByPattern()` uses Redis `SCAN`, which is much safer than `KEYS`, but still becomes costly with many keys.

Recommended replacement: versioned cache keys.

Example:

```text
landing:v:{brandId} = 42
landing:home:{brandId}:v42
landing:programs:{brandId}:v42
landing:program:{brandId}:{slug}:v42
```

When landing content changes, increment `landing:v:{brandId}`. Old keys expire naturally.

Why: versioning avoids scanning Redis and works well across multiple API instances.

### 2. Cache Brand Domain Resolution

Brand/domain resolution appears in landing, auth, and stats flows. Some logic falls back to `contains` matching.

Recommended:

- Normalize domains consistently:
  - lowercase
  - strip protocol
  - strip path
  - strip trailing slash
  - optionally strip `www.`
- Add a canonical domain column or lookup table.
- Cache `brand:domain:{normalizedHost} -> brandId`.
- Prefer exact indexed lookup over `contains`.

Why: this improves speed and reduces risk of ambiguous domain matches.

### 3. Cache Stable Payment Methods

`PortalController.getPaymentMethods()` calls the payment service for available methods.

Recommended:

- Cache available payment methods for 1-5 minutes.
- Invalidate when admin changes payment methods or gateway config.

Why: payment methods are read often and change rarely.

### 4. Add Cache Stampede Protection

For public landing, settings, and stats endpoints:

- Use single-flight locking for recomputation.
- Serve stale data briefly while recomputing.
- Add jitter to TTL values.

Why: if a popular cache key expires, many concurrent requests can hit the database at once.

### 5. Suggested TTLs

| Data | Suggested TTL |
| --- | ---: |
| Metadata enums, countries, currencies | 24h |
| Brand settings and landing content | 5-15m plus explicit invalidation |
| Program detail/list | 5-15m |
| User portal dashboard | 30-120s |
| Payment detail/status | 15-60s or event-driven invalidation |
| Admin analytics/stats | 1-5m |

## File Service Improvements

### 1. Protect File Endpoints

`services/file/app/presentation/api/routes/files.py` accepts `user_id`, `brand_id`, and other ownership context directly from request body/query.

Recommended:

- Keep the file service private behind the API gateway, or
- Add internal service key middleware, or
- Verify JWT and derive user/brand from the token.

Also update `PATCH /files/{file_id}/ready` to verify ownership by brand and user, not brand only.

Why: if the file service is reachable directly, client-supplied identity parameters create an object access risk.

### 2. Fix CORS Configuration

`services/file/app/main.py` currently allows all origins with credentials:

```py
allow_origins=["*"]
allow_credentials=True
```

Recommended:

- Load allowed origins from environment.
- Use explicit origins in staging/production.
- Avoid wildcard origins when credentials are enabled.

Why: wildcard CORS with credentials is unsafe and often behaves inconsistently across browsers.

### 3. Validate Actual File Content

Multipart and presigned-upload paths rely heavily on declared MIME type.

Recommended:

- Validate magic bytes for PDFs, Office docs, and images.
- For images, use Pillow verification before processing.
- Configure `Image.MAX_IMAGE_PIXELS`.
- Reject decompression bombs and malformed images.
- Verify object metadata after presigned upload before marking `READY`.

Why: attackers can upload dangerous content with a fake content type.

### 4. Improve Presigned Upload Flow

The current flow reserves a row, signs PUT, then marks `READY` after storage existence check.

Recommended:

- Verify size and content type from object metadata before marking `READY`.
- Store and verify checksums where possible.
- Prefer presigned POST policies with content-length range if the storage provider supports it.
- Add a cleanup job for stale `PROCESSING` rows and orphaned objects.

Why: object existence alone does not prove the uploaded content matches the reserved metadata.

### 5. Avoid Loading Full Files into Memory on Download

`GET /files/{id}/download` downloads the object into memory before returning a `StreamingResponse`.

Recommended:

- Prefer short-lived presigned GET URLs for private downloads.
- If proxying through FastAPI is required, stream chunks from storage instead of loading full bytes.

Why: large downloads can increase memory pressure and reduce service concurrency.

### 6. Avoid Per-Upload Bucket Checks

`MinIOStorage.upload()` checks bucket existence and creates the bucket on upload.

Recommended:

- Provision buckets during deployment.
- Remove per-upload bucket checks in production.

Why: bucket checks add latency and can fail on managed S3 providers where the app key lacks bucket-management permissions.

### 7. Add File Metadata Index

For media library listings, add:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_brand_program_ready_uploaded
  ON files (brand_id, program_id, status, is_deleted, uploaded_at DESC);
```

Why: this matches the file service list query: brand, program, status `READY`, not deleted, ordered by upload time.

## Payment Service Improvements

### 1. Make Internal Auth Fail Closed

`services/payment/internal/presentation/http/middleware/internal_auth.go` bypasses internal auth when the expected key is empty.

Recommended:

- Allow empty key only in local development.
- Fail startup in staging/production if `PAYMENT_SERVICE_INTERNAL_KEY` is missing.
- Use constant-time comparison for keys.

Why: accidental empty internal keys should not expose payment admin/internal endpoints.

### 2. Strengthen Payment State Consistency

`ConfirmIntentHandler` creates a transaction, calls the gateway, then updates transaction and intent through separate repository calls.

Recommended:

- Wrap local DB state changes in a transaction where possible.
- Use a clear payment state machine.
- Add an outbox table for payment events.
- Publish events from the outbox worker after DB commit.

Why: payment systems need strong consistency between intent status, transaction status, and emitted events.

### 3. Improve JSONB Filtering

`GormPaymentIntentRepository.FindAll()` filters by program ID using JSONB expressions:

```go
metadata ->> 'program' = ? OR metadata ->> 'program_id' = ?
```

Recommended:

- Prefer real `program_id` and `brand_id` columns on `payment_intents`.
- If JSONB remains, add expression indexes:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_intents_metadata_program
  ON payment_intents ((metadata ->> 'program'));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_intents_metadata_program_id
  ON payment_intents ((metadata ->> 'program_id'));
```

Why: JSONB expression filters are slow without matching indexes.

### 4. Add Retention for Idempotency Keys

`payment_idempotency_keys` prevents duplicate confirm operations.

Recommended:

- Add scheduled cleanup for old completed/failed idempotency keys.
- Keep enough retention for retries and dispute/debug windows.

Why: idempotency tables can grow indefinitely under high traffic.

### 5. Keep Gateway Secrets Encrypted

The payment service already encrypts gateway credentials at rest. Continue enforcing:

- Fail loudly if encryption key is missing.
- Never log decrypted gateway credentials.
- Add key-rotation procedure documentation.

Why: payment gateway keys are high-impact secrets.

## Notification Service Improvements

### 1. Redact Sensitive Logs

`services/notification/src/modules/events/events.controller.ts` logs full payloads for several event types.

Recommended:

- Do not log full payloads for:
  - `user.forgot-password`
  - `user.verify-email`
  - payment events
  - webhook-derived events
- Log only event type, event ID, recipient hash or masked email, and request/correlation ID.

Why: reset tokens, verification tokens, emails, names, amounts, and payment metadata can leak into logs.

### 2. Add Notification Idempotency

RabbitMQ events can be redelivered.

Recommended:

- Include event IDs in messages.
- Store processed event IDs in Postgres or Redis.
- Skip duplicate sends.

Why: retries should not send duplicate payment, welcome, reset, or verification emails.

### 3. Add Retry and Dead-Letter Queues

Recommended RabbitMQ behavior:

- Ack only after successful processing.
- Retry transient failures with backoff.
- Send permanently failing messages to a DLQ.
- Alert on DLQ growth.

Why: email providers fail intermittently; retrying immediately or dropping messages hurts reliability.

### 4. Add Provider Timeouts

Configure explicit timeouts for Resend/SMTP operations.

Why: a stuck provider call should not block consumers indefinitely.

## Cross-Service Security Improvements

### 1. Add Security Headers to API

Add `helmet` to `services/api/src/main.ts`.

Recommended:

- Enable common security headers.
- Review CSP separately if the API serves Swagger/docs.

Why: low-cost hardening against common browser-facing risks.

### 2. Gate Swagger in Production

Swagger is currently set up in API and notification service.

Recommended:

- Disable Swagger in production, or
- Protect docs behind admin auth/IP allowlist.

Why: public API documentation can help attackers enumerate endpoints and payload shapes.

### 3. Hash Refresh Tokens at Rest

The API stores refresh tokens in `user_sessions.refresh_token`.

Recommended:

- Store a hash of the refresh token instead of plaintext.
- Compare by hashing the presented token.
- Rotate refresh tokens on use.

Why: if the database leaks, plaintext refresh tokens are immediately usable.

### 4. Add Account Lockout or Backoff

Login tracks failed attempts, but the login path should enforce a policy.

Recommended:

- Temporary lockout after repeated failures.
- Exponential backoff.
- Separate strict throttling by email+brand and IP.

Why: throttling alone does not fully protect individual accounts from credential stuffing.

### 5. Normalize and Validate Brand Context

Brand context should be resolved centrally.

Recommended:

- Use one shared brand-domain resolver.
- Normalize hostnames.
- Avoid broad `contains` matching where possible.
- Cache exact normalized mappings.

Why: brand scoping is security-sensitive in a multi-brand system.

## Messaging and Reliability Improvements

### 1. Adopt an Outbox Pattern

For payment and important API events:

- Write event rows in the same DB transaction as the state change.
- Publish asynchronously from an outbox worker.
- Mark published after broker confirmation.

Why: prevents state changes from being committed without the corresponding event being delivered.

### 2. Add Correlation IDs Everywhere

Recommended:

- Generate or propagate `request_id` / `correlation_id`.
- Include it in HTTP headers, RabbitMQ messages, logs, and traces.

Why: cross-service debugging is much easier when a user action can be followed through API, payment, file, and notification services.

### 3. Add Dependency-Aware Health Checks

Recommended health checks:

| Service | Dependencies |
| --- | --- |
| API | Postgres, Redis, RabbitMQ, payment service, file service |
| File | Postgres, MinIO/S3 |
| Payment | Postgres, RabbitMQ, active gateway config |
| Notification | RabbitMQ, email provider |

Why: container health should reflect whether the service can actually process requests.

## Operational Improvements

### 1. Add Slow Query Dashboards

Use existing Prisma metrics and Postgres metrics to track:

- Query count by model/operation.
- p95/p99 query duration.
- Pool saturation.
- Slowest endpoints.
- Cache hit/miss ratio.

Why: optimization should be guided by real production bottlenecks.

### 2. Add Data Retention and Partitioning

High-growth tables likely include:

- `data_change_logs`
- `user_activity_logs`
- `user_security_logs`
- `payment_events`
- notification event logs if added

Recommended:

- Retain hot data in primary tables.
- Archive older data.
- Consider monthly partitioning for audit/event tables.

Why: audit/event tables can quietly become the largest tables in the system.

### 3. Load Test Critical Flows

Suggested flows:

- Public landing page load by brand.
- Login + dashboard load.
- Application submission.
- Payment confirmation and webhook.
- File upload and ready confirmation.
- Admin application listing/search/export.

Why: load testing validates whether query/caching changes improve the real user paths.

## Participant Frontend (`ybb-program-next`) Improvements

The participant frontend already has several good foundations:

- Next.js App Router with BFF-style `app/api/*` routes.
- Central backend API helpers in `lib/api/*`.
- Brand/domain resolution through `proxy.ts` and `lib/server/envContext.ts`.
- Server-side `unstable_cache` usage for settings/home data.
- HTTP-only cookie storage for access/refresh tokens.
- Route-level `loading.tsx`, `error.tsx`, and `not-found.tsx` coverage in some areas.
- Playwright is already installed for E2E coverage.

The main polish opportunities are around cookie-auth route hardening, multi-brand cache scoping, reducing duplicated BFF route code, frontend performance, accessibility, SEO, and observability.

### 1. Add CSRF or Strict Origin Protection for Mutating BFF Routes

The frontend stores auth tokens in HTTP-only cookies and exposes many mutating routes under `app/api/*`, such as:

- `/api/auth/local-login`
- `/api/auth/register`
- `/api/auth/logout`
- `/api/auth/reset-password`
- `/api/participants/onboarding`
- `/api/portal/payments/:id/confirm`
- `/api/portal/payments/tiers/:tierId/ensure-invoice`
- `/api/portal/submissions/sections/:section`
- `/api/participants/me/photo`

Recommended:

- Add a shared guard for all non-GET BFF routes.
- Validate `Origin` and `Host` for same-site requests.
- Consider a double-submit CSRF token for forms that mutate authenticated state.
- Return a consistent `403` response when origin/CSRF validation fails.

Why: `SameSite=Lax` helps, but cookie-authenticated mutation endpoints should still explicitly defend against cross-site form submissions and browser edge cases.

### 2. Centralize BFF Route Proxy Logic

Many `app/api/*` routes repeat the same logic:

- read `accessToken` from cookies
- resolve `x-brand-domain`
- build backend URL
- forward `Authorization: Bearer ...`
- set `cache: 'no-store'`
- parse backend envelope
- normalize errors
- return `NextResponse.json(...)`

Recommended:

- Create a shared server helper, for example `lib/server/backendProxy.ts`.
- Include:
  - `getRequiredAccessToken()`
  - `getBrandDomainFromRequest()`
  - `backendFetch()`
  - `jsonEnvelopeResponse()`
  - `noStoreHeaders`
  - `withCsrfProtection()`
- Prefer typed response helpers instead of repeated `(json as any)` conversions.

Why: centralizing this reduces bugs, makes security policy consistent, and improves maintainability as portal routes grow.

### 3. Remove Production Debug Payloads

Some API routes return debug fields such as cookie names, brand domain, and backend status in error responses.

Recommended:

- Only include debug fields when `NODE_ENV !== 'production'`.
- Avoid returning cookie names or backend internals in production.
- Log useful details server-side with request/correlation IDs instead.

Why: debug payloads are helpful locally but can leak internal implementation details in production.

### 4. Fail Closed on Required Production Environment Variables

Several frontend files default to staging URLs:

- `NEXT_PUBLIC_API_URL || 'https://staging-api.ybbhub.com'`
- `API_INTERNAL_URL || NEXT_PUBLIC_API_URL || 'https://staging-api.ybbhub.com'`

Recommended:

- In production builds, require:
  - `APP_BUILD_ID`
  - `NEXT_PUBLIC_API_URL`
  - `API_INTERNAL_URL`
  - `NEXT_PUBLIC_BRAND_DOMAIN` or a clear multi-brand runtime config
  - revalidation secrets for protected revalidate endpoints
- Avoid defaulting a production build to staging services.

Why: a production frontend accidentally pointing at staging can cause data leakage, broken payments, or inconsistent brand content.

### 5. Harden Revalidation Endpoints

`app/api/settings/revalidate/route.ts` and similar revalidation endpoints should be protected in production.

Recommended:

- Reject requests if the secret is missing in production.
- Use constant-time comparison for bearer tokens.
- Optionally include brand-specific revalidation parameters instead of global tags only.
- Log revalidation events with actor/source metadata.

Why: public or weakly protected revalidation endpoints can be abused to flush cache repeatedly.

### 6. Make Next.js Cache Tags Brand-Scoped

The current constants include global tags:

```ts
export const SETTINGS_CACHE_TAG = 'settings';
export const HOME_CACHE_TAG = 'home';
```

Recommended:

- Use brand-specific tags:

```ts
settings:${brandDomain}
home:${brandDomain}
landing:${brandDomain}
```

- Revalidate only the affected brand after admin changes.
- Keep a global revalidate option only for emergency cache flushes.

Why: in a multi-brand app, one brand update should not evict every other brand's settings/home cache.

### 7. Scope Client Settings Cache by Brand

The client settings cache currently uses a single key:

```ts
export const SETTINGS_LS_KEY = 'ybb:settings';
```

Recommended:

- Use a brand-scoped key:

```text
ybb:settings:{brandDomain}
```

- Store the normalized brand domain in the cached payload.
- Clear old entries when switching domains/brands.

Why: this avoids stale cross-brand UI if users move between brands, preview domains, or localhost configs.

### 8. Improve Maintenance Mode Runtime Behavior

`proxy.ts` checks maintenance mode with a short in-memory cache.

Recommended:

- Bound the in-memory cache by host count.
- Use stale-while-revalidate behavior to avoid blocking every edge request during API slowness.
- Make fail-open/fail-closed behavior explicit by environment.
- Exempt routes that do not need maintenance checks.
- Consider moving maintenance flags to an edge-friendly configuration source if traffic grows.

Why: middleware/proxy runs on many requests, so it should remain cheap and predictable.

### 9. Add Global Security Headers

`next.config.js` already disables `poweredByHeader` and sets some asset cache headers. Add broader security headers.

Recommended headers:

```text
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: ...
X-Frame-Options or CSP frame-ancestors
```

Notes:

- Build the CSP carefully because the app uses Google Analytics, Firebase popup login, images, and a third-party chat widget.
- Keep the login route's `Cross-Origin-Opener-Policy: same-origin-allow-popups` exception for Firebase popup compatibility.

Why: security headers reduce browser-facing attack surface and make third-party integrations explicit.

### 10. Revisit Remote Image and SVG Policy

`next.config.js` enables:

```js
dangerouslyAllowSVG: true
```

and allows multiple remote image hosts.

Recommended:

- Avoid remote SVGs unless absolutely required.
- Prefer exact trusted remote hosts over broad patterns.
- Proxy/sanitize SVGs when user-controlled.
- Keep `contentDispositionType: 'attachment'` and a strict image CSP if SVG remains enabled.
- Audit all `unoptimized` images and only keep it where Next image optimization genuinely cannot be used.

Why: SVGs can carry script-like behavior and broad image allowlists make content-origin trust harder to reason about.

### 11. Gate Third-Party Scripts by Brand, Consent, and Route

`app/layout.tsx` loads a third-party chat script globally while `ClientChatWidgetGate` currently returns `null`.

Recommended:

- Move chat bot ID and enable/disable flag into brand settings or environment.
- Only load the script on routes where chat should appear.
- Respect cookie/analytics consent before loading third-party scripts.
- Avoid hardcoding third-party IDs in source.

Why: global third-party scripts affect performance, privacy, CSP complexity, and reliability.

### 12. Clean Production Console Logging

Several server/client files log expected fallback behavior or full errors.

Recommended:

- Remove cosmetic logs such as theme source messages.
- Gate debug logs behind `NODE_ENV !== 'production'`.
- Keep actionable errors with request IDs.
- Avoid logging tokens, payloads, or sensitive user data.

Why: production logs should be high-signal and safe to retain.

### 13. Improve Metadata, SEO, and Brand Presentation

`generateMetadata()` currently builds basic metadata from home data.

Recommended:

- Add brand/program-specific canonical URLs.
- Add Open Graph/Twitter images.
- Add per-page metadata for:
  - program detail
  - gallery
  - partners
  - search
  - contact
- Generate brand-aware `sitemap.xml` and `robots.txt`.
- Disable indexing for staging/preview environments.
- Add structured data for organization, events/programs, breadcrumbs, and FAQ where applicable.

Why: the participant app is public-facing and multi-brand, so SEO and social sharing quality matter.

### 14. Improve Route-Specific Loading, Empty, and Error States

The app already has global and some route-specific loading/error files.

Recommended:

- Add dashboard-specific skeletons for:
  - dashboard summary
  - submissions
  - payments
  - payment detail
  - documents
  - certificates
- Use a shared `EmptyState` pattern consistently.
- Make payment and submission errors actionable with retry buttons and support links.
- Avoid layout shift during loading states.

Why: high-quality loading and error states make the portal feel faster and more reliable.

### 15. Improve Forms and Validation UX

Key flows include login, register, reset password, onboarding, submissions, and payment confirmation.

Recommended:

- Add field-level validation messages.
- Add password strength feedback on registration/reset.
- Disable duplicate submissions robustly.
- Preserve user input on transient errors.
- Add `aria-live` regions for form errors.
- Standardize success/error toast behavior.

Why: participant conversion depends heavily on smooth auth, onboarding, application, and payment forms.

### 16. Add Accessibility Pass

Recommended checks:

- Focus management in modals.
- Keyboard behavior for nav/dropdowns.
- `aria-live` for async form errors.
- Visible focus states.
- Skip-to-content link.
- Reduced-motion handling for carousels/animations.
- Correct `alt` text for brand/program images.
- Button semantics for interactive elements.

Why: accessibility improvements also improve usability and reduce support friction.

### 17. Optimize Bundle and Runtime Performance

Recommended:

- Add bundle analysis for large chunks.
- Dynamically import heavy visual components such as maps, charts, and third-party widgets.
- Audit Firebase bundle impact on auth pages.
- Use `priority` only on true LCP images.
- Ensure remote images have correct `sizes`.
- Avoid loading global widgets on dashboard/auth routes if not needed.
- Deduplicate settings/home fetches where page data already contains equivalent brand data.

Why: public landing pages and auth pages should remain fast on mobile networks.

### 18. Near-Instant Public Page Loading Strategy

The most important frontend performance goal is to make `ybb-program-next` feel almost instant even with many images and brand-specific content.

The target architecture:

```text
Admin edits content
-> API stores normalized content
-> API publishes compact landing snapshot
-> File service generates responsive image variants
-> CDN caches public images
-> Next frontend caches brand/page snapshots by tag
-> User request gets cached shell + hero immediately
-> Below-fold sections stream or lazy-load
-> Admin publish revalidates only affected brand/page
```

#### Serve the First View from Cache

Public pages should be cache-first:

- `/`
- `/programs`
- `/programs/[slug]`
- `/programs/gallery`
- `/partners`
- `/contact`
- other public landing pages

Recommended:

- Avoid `no-store` for public content unless the data is user-specific.
- Use brand-scoped `unstable_cache` entries.
- Use CDN/Next cache for the HTML/RSC payload where possible.
- Trigger revalidation from admin publish/update actions.
- Keep dashboard, payment, submission, and document routes `no-store`.

Why: the first request after publish may compute, but most visitors should receive cached public content immediately.

#### Split Above-the-Fold and Below-the-Fold Rendering

The first viewport should not wait for every landing section.

Above the fold should include only:

- navigation shell
- hero title/subtitle
- primary CTA
- one optimized hero image
- minimal brand theme/logo settings

Below-fold sections should use streaming/lazy loading:

```tsx
export default async function HomePage() {
  const hero = await getHeroDataCached();

  return (
    <>
      <Hero data={hero} />

      <Suspense fallback={<ProgramsSkeleton />}>
        <FeaturedPrograms />
      </Suspense>

      <Suspense fallback={<GallerySkeleton />}>
        <GallerySection />
      </Suspense>

      <Suspense fallback={<PartnersSkeleton />}>
        <PartnersSection />
      </Suspense>
    </>
  );
}
```

Why: users perceive the page as fast when the hero renders immediately and the rest streams in.

#### Treat Images as a Dedicated Performance Pipeline

Image handling is likely the biggest bottleneck for an image-heavy public site.

Recommended image rules:

- Use only one `priority` image per page, usually the LCP hero image.
- Lazy-load every below-fold image.
- Add accurate `sizes` to all `next/image` usages.
- Use AVIF/WebP where possible.
- Use CDN URLs, not raw object-storage URLs.
- Use thumbnails for cards/gallery, not original images.
- Add blur placeholders or dominant-color placeholders.
- Render only the first 6-8 gallery thumbnails initially.
- Load more gallery images on scroll or explicit "Load more".
- Use original images only for lightbox/download views.

Recommended file-service/CDN variants:

```text
original
thumbnail-320w.webp
thumbnail-640w.webp
card-768w.webp
hero-1200w.webp
hero-1920w.avif
```

Store variant URLs in file metadata so the frontend can request the correct asset directly.

Why: asking browsers or Next/Image to process massive originals on demand creates slow first loads and expensive image optimization work.

#### Precompute Landing Page Snapshots

For maximum speed, public landing pages should read compact, prebuilt payloads.

Recommended backend model:

```sql
CREATE TABLE brand_landing_snapshots (
  brand_id UUID NOT NULL,
  page VARCHAR(64) NOT NULL,
  payload_json JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, page)
);
```

Examples:

```text
landing_snapshot:{brandId}:home
landing_snapshot:{brandId}:programs
landing_snapshot:{brandId}:settings
landing_snapshot:{brandId}:gallery:first-page
```

Admin publish flow:

1. Admin edits content.
2. API validates and stores normalized data.
3. API rebuilds affected snapshot.
4. API triggers frontend revalidation for the affected brand/page tag.
5. Next.js serves the new cached payload.

Why: public reads become simple, stable, and CDN/cache friendly instead of assembling many relations per request.

#### Reduce Root Layout Work

`app/layout.tsx` currently fetches settings and home data. The root layout should fetch only the minimum global shell data.

Recommended:

- Keep settings fetch if needed for theme/logo/analytics.
- Avoid fetching full home data in root layout only to derive `programSlug`.
- Add active program slug to settings or a tiny cached context endpoint.
- Move page-specific data fetching into pages/sections.

Why: every route pays for root layout work, so root layout should stay small and stable.

#### Gate Third-Party Scripts

Third-party scripts should not affect first paint or responsiveness.

Recommended:

- Load chat only after interaction, delay, or route eligibility.
- Gate chat by brand settings and consent.
- Keep analytics after interactive.
- Avoid hardcoded third-party IDs in source.
- Exclude auth/dashboard/payment routes if chat is not needed there.

Why: third-party scripts often hurt INP, CPU time, privacy posture, and CSP complexity.

#### Optimize Fonts

The app uses `next/font/google`, which is good. Further polish:

- Reduce font weights if possible.
- Consider `400`, `500`, `600`, `700` instead of `300`, `400`, `500`, `600`, `700`, `800`.
- Ensure text remains visible with font swap behavior.

Why: font payloads are part of the critical rendering path.

#### Consider a Carefully Scoped Service Worker

A service worker can help with repeat visits, but it must be conservative because stale deploys can be painful.

Good cache candidates:

- public logos
- thumbnails
- public gallery images
- fonts
- static JS/CSS
- landing snapshots

Avoid caching:

- auth routes
- dashboard data
- payment data
- submissions
- user documents

Keep compatibility with `AppVersionWatcher`, which already clears runtime caches on new build versions.

Why: repeat visitors can get instant static assets, while private/user-specific data stays fresh and safe.

#### Suggested Performance Budgets

Use explicit budgets so "almost instant" is measurable.

| Metric | Target |
| --- | ---: |
| Cached public page TTFB | `< 200ms` |
| Homepage LCP on mobile 4G | `< 1.8s` |
| CLS | `< 0.05` |
| INP | `< 200ms` |
| Initial shared JS bundle | `< 180KB gzip` |
| Hero image transfer | `< 180KB` |
| Below-fold images loaded before scroll | `0-2 max` |

#### Suggested Implementation Phases

Phase 1 quick wins:

- Remove full home-data dependency from root layout.
- Brand-scope settings/home cache tags.
- Brand-scope localStorage settings cache.
- Remove production console logs.
- Gate chat widget loading.
- Audit `priority` images.
- Add accurate `sizes` to major images.
- Render fewer initial gallery images.

Phase 2 image pipeline:

- Generate image variants in the file service.
- Store variant URLs in file metadata.
- Use thumbnails for cards/gallery.
- Put public images behind CDN.
- Add blur/dominant-color placeholders.

Phase 3 landing snapshots:

- Add backend-published landing snapshots per brand/page.
- Frontend reads snapshots with long TTL.
- Admin publish triggers brand/page revalidation.
- Public pages stream below-fold sections.

Phase 4 observability and budgets:

- Add Web Vitals reporting.
- Add bundle analyzer.
- Add Lighthouse CI or Playwright performance smoke tests.
- Track LCP element and image weight per brand.

Why: this sequence delivers visible speed improvements early while building toward a scalable public-site architecture.

### 19. Add Payment UX Reliability

For portal payment flows:

- Generate and forward a client/BFF idempotency key for payment confirm operations.
- Disable duplicate payment submissions.
- Show clear "waiting for confirmation" state.
- Poll or refresh payment detail with backoff after gateway/manual submission.
- Improve receipt/download error messages.

Why: payment flows are high-stakes; duplicate clicks and unclear states create support issues.

### 20. Add Frontend Observability

Recommended:

- Report Web Vitals.
- Track route-level errors.
- Track BFF route failures by status/path.
- Include correlation IDs from frontend to BFF to backend.
- Add lightweight analytics for conversion funnels:
  - landing -> register
  - register -> verify
  - verify -> onboarding
  - onboarding -> submission
  - payment start -> payment success

Why: frontend polish should be driven by real user friction, not only static review.

### 21. Expand Playwright Coverage

Playwright is installed. Add smoke and journey tests for:

- public homepage by brand
- login/register/reset password
- email verification landing behavior
- onboarding
- dashboard load
- submissions flow
- payments list/detail/confirm
- document/receipt download
- maintenance mode redirect
- brand-domain resolution

Why: these flows cross frontend, BFF routes, auth cookies, backend APIs, cache behavior, and payment/file services.

## Testing and Safe Rollout Strategy

The recommendations in this document touch security, caching, database indexes, payment state, file uploads, and frontend UX. These changes should be delivered incrementally with layered tests and rollback plans, not as one large release.

### 1. Baseline Before Changing Behavior

Before implementation, capture the current system behavior so optimizations do not accidentally redefine expected behavior.

Recommended baseline checks:

- Run existing unit, integration, E2E, lint, type-check, and build commands for each touched repo/service.
- Capture representative API responses for critical flows:
  - landing settings/home
  - auth login/register/me/logout
  - onboarding
  - application submission
  - portal dashboard/submissions/payments/documents
  - file upload/ready/download
  - payment confirm/webhook/receipt
- Capture current performance metrics:
  - p95/p99 API latency
  - top slow Prisma queries
  - Redis cache hit ratio
  - Postgres CPU/IO/load
  - frontend LCP/CLS/INP
  - payment confirmation success/failure rate
- Save representative `EXPLAIN (ANALYZE, BUFFERS)` output for queries targeted by new indexes.

Why: without a baseline, it is hard to prove that an optimization improved the system or identify regressions quickly.

### 2. Use Feature Flags for Behavior Changes

Use flags for changes that alter runtime behavior, especially:

- new cache key/versioning behavior
- CSRF/origin enforcement
- stricter file-service auth
- payment outbox/event behavior
- new payment polling behavior
- third-party script gating
- maintenance mode fail-open/fail-closed behavior
- production env fail-closed checks

Recommended flag pattern:

```text
ENABLE_BRAND_SCOPED_CACHE=true
ENABLE_CSRF_GUARD=false
ENABLE_FILE_SERVICE_AUTH_REQUIRED=false
ENABLE_PAYMENT_OUTBOX=false
ENABLE_STRICT_REVALIDATE_AUTH=true
```

Why: flags let you deploy code safely, turn behavior on gradually, and rollback without reverting code.

### 3. Database Migration Testing

For database/index changes:

- Use `CREATE INDEX CONCURRENTLY` for production Postgres indexes.
- Add migrations one index group at a time.
- Validate on a staging database with production-like volume.
- Run `EXPLAIN (ANALYZE, BUFFERS)` before and after each index.
- Confirm write-heavy endpoints do not regress from excessive indexes.
- Check migration lock behavior and duration.
- Test rollback path, usually `DROP INDEX CONCURRENTLY IF EXISTS ...`.

Recommended acceptance criteria:

- Target queries switch from sequential scan or expensive sort to index/index-only scans where appropriate.
- p95 list/search endpoints improve or stay neutral.
- No measurable write latency spike on hot write paths.
- Database migrations complete without blocking user traffic.

Why: indexes are usually safe but can hurt writes and storage if added indiscriminately.

### 4. Cache Change Testing

Cache changes are risky because they can create stale data, cross-brand leaks, or cache misses under load.

Test cases for backend cache changes:

- Cache hit returns the same shape as uncached response.
- Cache miss recomputes correctly.
- Invalidation only clears intended brand/program/user data.
- Payment status changes invalidate portal payment/dashboard caches.
- Brand updates invalidate landing/settings caches.
- Pattern/version invalidation works across multiple API instances.

Test cases for frontend cache changes:

- Brand A settings do not appear on Brand B.
- Localhost uses the configured default brand correctly.
- `/api/settings/revalidate` refreshes only the intended brand when brand-scoped tags are introduced.
- Existing localStorage cache migrates or expires cleanly.
- Stale settings do not survive after admin update and revalidation.

Recommended rollout:

1. Add new brand-scoped keys while still writing old keys.
2. Read new keys first, fall back to old keys.
3. After confidence, stop writing old keys.
4. Let old keys expire naturally.

Why: cache migrations need compatibility windows to avoid sudden widespread misses or stale UI.

### 5. Security Regression Tests

Add tests for each hardening change.

API/security tests:

- File service rejects unauthenticated direct calls in protected environments.
- File ready/download rejects wrong user or wrong brand.
- Revalidation endpoints reject missing/invalid secrets in production mode.
- Internal payment endpoints reject missing/invalid internal service key.
- Webhooks reject invalid signatures.
- Login throttling/lockout behaves as expected.
- Refresh tokens are not stored or logged in plaintext after token-hash migration.

Frontend/BFF tests:

- Mutating `app/api/*` routes reject cross-origin requests.
- Valid same-origin requests still work.
- Auth cookies remain `httpOnly`, `secure` in production, `sameSite=lax`, path `/`.
- Production debug payloads are not returned.
- Logout clears both access and refresh cookies.

Recommended tooling:

- Unit tests for guards/helpers.
- Integration tests for route handlers.
- Playwright tests for browser-facing auth flows.

Why: security hardening often fails through edge-case bypasses, not only the primary path.

### 6. Payment Safety Tests

Payment changes need stricter testing than normal CRUD because duplicate or lost events create real operational issues.

Test scenarios:

- Confirm payment with idempotency key returns same response on retry.
- Confirm payment with same key but different payload is rejected.
- Gateway timeout marks transaction consistently.
- Gateway success updates transaction and intent consistently.
- Manual payment enters review state once.
- Webhook success is idempotent.
- Duplicate webhook does not double-send notification or double-update invoice.
- Failed event publish does not lose payment state when outbox is enabled.
- Outbox worker retries and eventually marks event published.

Recommended staging tests:

- Use gateway sandbox credentials.
- Run duplicate-click and refresh-during-payment scenarios.
- Simulate RabbitMQ outage during payment success.
- Simulate notification service outage and verify DLQ/outbox behavior.

Why: payment regressions are high-impact and often come from retries, duplicate delivery, or partial failure.

### 7. File Upload Safety Tests

File-service changes should cover both multipart and presigned upload paths.

Test scenarios:

- Allowed MIME + valid magic bytes succeeds.
- Fake MIME with invalid content is rejected.
- Oversized files are rejected.
- Presigned upload cannot mark `READY` if object is missing.
- Presigned upload cannot mark `READY` for wrong brand/user.
- Actual object size mismatch is handled as intended.
- Stale `PROCESSING` rows are cleaned up.
- Download uses presigned URL or streaming without loading large files fully into memory.
- Public media remains renderable through CDN/proxy paths.

Recommended additional tests:

- Image decompression bomb fixture.
- Corrupt image fixture.
- PDF header validation fixture.
- Office document validation fixture.

Why: upload systems are a common security and resource-exhaustion attack surface.

### 8. Frontend UX and Accessibility Tests

Add Playwright and accessibility checks for user journeys, not only individual components.

Recommended journeys:

- Public homepage loads with correct brand theme.
- Brand settings/cache do not leak across hostnames.
- Login works and redirects to onboarding or dashboard correctly.
- Register duplicate email shows friendly message.
- Reset password handles missing/invalid token.
- Onboarding preserves data on validation errors.
- Dashboard loads with no layout shift-heavy blank state.
- Payments list/detail/confirm handles duplicate clicks.
- Receipt download works for paid invoice.
- Maintenance mode redirects public routes but exempts intended routes.

Accessibility checks:

- Keyboard-only navigation through navbar, forms, modals, and dashboard.
- Focus returns after closing modal.
- Form errors are announced.
- Color contrast remains valid for dynamic brand colors.
- Reduced-motion users do not get forced animations.

Why: polishing work should improve user experience without breaking conversion-critical flows.

### 9. Contract Tests Between Frontend BFF and Backend API

The frontend BFF expects backend envelopes like:

```json
{ "statusCode": 200, "message": "Success", "data": {} }
```

Recommended:

- Add typed fixtures for each critical backend response.
- Test BFF route transformations against fixtures.
- Keep fixtures close to real API shapes.
- Add negative fixtures for 401, 403, 404, 409, 429, and 500.
- Validate that BFF routes preserve important backend error messages without exposing internals.

Why: many frontend bugs come from backend response shape drift.

### 10. Performance and Load Testing

Use targeted load tests after query/cache changes.

Recommended scenarios:

- Public landing/home/settings by brand.
- Admin application list/search with realistic filters.
- Portal dashboard load after login.
- Payment list/detail refresh.
- File upload URL creation and ready confirmation.
- Notification event burst.
- Payment webhook burst.

Metrics to compare before/after:

- API p50/p95/p99 latency.
- Database query duration and rows scanned.
- Redis hit/miss ratio and command latency.
- Node.js event loop delay.
- Go payment handler latency.
- FastAPI file-service memory during downloads/uploads.
- Frontend LCP/CLS/INP.

Why: query and cache changes should be judged by real latency and resource usage, not only code shape.

### 11. Staging Rollout Checklist

Before production:

- Apply DB migrations on staging.
- Warm important caches.
- Run service-specific tests.
- Run Playwright smoke tests.
- Run payment sandbox tests.
- Test multi-brand hostnames.
- Test revalidation endpoints with valid/invalid secrets.
- Verify logs do not contain tokens or sensitive payloads.
- Verify monitoring dashboards show expected metrics.
- Verify rollback commands are documented.

Why: staging should exercise the cross-service behavior that unit tests cannot cover.

### 12. Production Rollout Checklist

Recommended rollout:

1. Deploy code with new behavior disabled behind flags.
2. Apply safe database indexes concurrently.
3. Enable low-risk cache/read optimizations for one brand or small traffic slice.
4. Enable security hardening in report-only/log-only mode where possible.
5. Enable enforcement after logs show no legitimate traffic would be blocked.
6. Roll out payment/file changes during lower traffic windows.
7. Monitor dashboards and logs closely for at least one full usage cycle.

Watch for:

- increased 401/403/409/429 rates
- cache miss spikes
- database CPU/IO spikes
- payment confirm failures
- duplicate notifications
- frontend route errors
- Web Vitals regressions

Why: incremental rollout reduces blast radius and makes regressions easier to attribute.

### 13. Rollback Strategy

Each change should have a documented rollback path.

Examples:

- Feature flag off for behavior changes.
- Revert BFF CSRF enforcement to log-only mode.
- Restore old cache read path during cache migration.
- `DROP INDEX CONCURRENTLY IF EXISTS ...` for problematic indexes.
- Disable payment outbox worker and fall back to existing publish path only if safe.
- Disable third-party script gating if it blocks required support flow.

Do not rollback database schema destructively unless there is a tested downgrade plan.

Why: rollback should be fast, predictable, and avoid data loss.

### 14. Recommended Test Command Matrix

Use only existing project tools unless new test tooling is intentionally introduced.

| Area | Commands |
| --- | --- |
| API Gateway | `cd ybb-platform/services/api && npm run lint && npm run build && npm test && npm run test:integration && npm run test:e2e` |
| File Service | `cd ybb-platform/services/file && pytest tests/ && black app/ --check && flake8 app/ && mypy app/` |
| Payment Service | `cd ybb-platform/services/payment && go test ./... && go build -o ybb-payment cmd/server/main.go` |
| Notification Service | `cd ybb-platform/services/notification && npm run lint && npm run build && npm test` |
| Participant Frontend | `cd ybb-program-next && npm run lint && npm run type-check && npm run build && npm run test:e2e` |
| Admin Dashboard | `cd ybb-platform/services/admin-dashboard && npm run lint && npm run build` |

Run narrower single-test commands while developing, then the full relevant matrix before merging.

Why: each service has different failure modes, and cross-service changes need both local and journey-level validation.

## Step-by-Step Implementation Roadmap

This roadmap orders the work by dependency, risk, and user impact. Start with measurement and safety rails, then low-risk quick wins, then deeper architecture changes. Each step should be small enough to review, test, deploy, and rollback independently.

### Phase 0: Baseline and Safety Rails

Do this first before changing behavior.

| Step | Work | Why first | Done when |
| --- | --- | --- | --- |
| 0.1 | Capture current API/frontend performance baseline: p95/p99 latency, Web Vitals, top slow Prisma queries, cache hit ratio, payment success rate. | Needed to prove improvements and catch regressions. | Baseline metrics are saved and comparable. |
| 0.2 | Run existing test/build matrix for touched services. | Separates existing failures from new regressions. | Current baseline is known for API, file, payment, notification, frontend. |
| 0.3 | Add feature flags for behavior-changing work. | Enables gradual rollout and rollback. | Flags exist for cache migration, CSRF guard, file auth, payment outbox, strict revalidation, third-party script gating. |
| 0.4 | Add missing smoke tests for critical happy paths. | Gives confidence before refactors. | Basic auth, landing, dashboard, payment, file upload, and settings routes are covered. |

Recommended first PRs:

1. Add performance baseline notes/dashboard links.
2. Add feature flag config plumbing.
3. Add or stabilize smoke tests without changing production behavior.

### Phase 1: Low-Risk Frontend Speed Wins

Start here for visible improvement with low backend risk.

| Step | Work | Why | Done when |
| --- | --- | --- | --- |
| 1.1 | Remove full `getHomePageData()` dependency from `app/layout.tsx`; keep root layout data minimal. | Every route pays for layout work. | Root layout only fetches global shell settings/context. |
| 1.2 | Gate chat/third-party scripts by route, brand setting/env, and preferably consent. | Third-party scripts hurt INP and CPU. | Chat no longer loads globally by default. |
| 1.3 | Remove production cosmetic `console.log`s. | Reduces noisy logs and accidental leakage. | Production logs contain only actionable errors/warnings. |
| 1.4 | Audit image `priority`, `sizes`, and initial gallery render count. | Images are the biggest public-page bottleneck. | One priority image per page; below-fold images lazy; gallery initial render is capped. |
| 1.5 | Reduce font weights if visually acceptable. | Shrinks critical font payload. | Unused font weights removed and visual check passes. |

Recommended order:

1. Root layout data reduction.
2. Script gating.
3. Image priority/sizes cleanup.
4. Gallery initial-load cap.
5. Font-weight reduction.

### Phase 2: Production Safety and Security Hardening

These reduce risk before deeper cache/payment/file changes.

| Step | Work | Why | Done when |
| --- | --- | --- | --- |
| 2.1 | Remove/gate production debug payloads from frontend BFF routes. | Avoids exposing internals. | Debug fields only appear outside production. |
| 2.2 | Fail closed on required production env vars; avoid staging fallbacks in production. | Prevents accidental production-to-staging wiring. | Production build/start fails clearly when required env is missing. |
| 2.3 | Harden revalidation endpoints. | Prevents public cache flush abuse. | Missing/invalid secret is rejected in production. |
| 2.4 | Add CSRF/origin guard to mutating BFF routes in log-only mode, then enforce. | Cookie-auth mutations need cross-site request protection. | Legitimate requests pass; cross-origin mutations fail. |
| 2.5 | Fix file service CORS and protect direct file endpoints. | File access is security-sensitive. | File service rejects unauthorized direct access in protected environments. |
| 2.6 | Fail closed on payment internal service key outside local development. | Prevents accidental exposure of internal payment APIs. | Missing key fails staging/production startup or requests. |
| 2.7 | Redact sensitive notification/API logs. | Prevents token/payment data leakage. | Password reset, verification, webhook, and payment payloads are not logged raw. |

Recommended order:

1. Production debug cleanup.
2. Production env validation.
3. Revalidation endpoint hardening.
4. Log-only CSRF/origin guard.
5. File service CORS/auth.
6. Payment internal key fail-closed.
7. Sensitive log redaction.
8. Enforce CSRF/origin guard.

### Phase 3: Frontend Cache Correctness for Multi-Brand

Do this before aggressive public-page caching and landing snapshots.

| Step | Work | Why | Done when |
| --- | --- | --- | --- |
| 3.1 | Brand-scope Next.js cache tags for settings/home. | One brand update should not flush all brands. | Tags include normalized brand domain or brand ID. |
| 3.2 | Brand-scope localStorage settings cache. | Prevents cross-brand stale UI. | Settings key includes brand domain and old key expires/migrates safely. |
| 3.3 | Normalize and cache brand-domain resolution. | Reduces repeated lookup and ambiguity. | Host normalization is shared and exact matches are preferred. |
| 3.4 | Cache stable payment methods. | Reduces repeated payment-service calls. | Payment methods cache invalidates on admin changes. |
| 3.5 | Add cache stampede protection for hot public keys. | Prevents backend spikes on expiry. | Concurrent misses do not fan out to many identical backend calls. |

Recommended rollout:

1. Write new brand-scoped keys while reading old fallback.
2. Revalidate both old and new keys.
3. Monitor.
4. Remove old fallback after TTL window.

### Phase 4: Database and API Query Performance

Do this once baseline and rollback are ready.

| Step | Work | Why | Done when |
| --- | --- | --- | --- |
| 4.1 | Add composite indexes for applications, programs, users, invoices, and files. | Low-risk performance win when validated. | `EXPLAIN` shows improved plans and no write regression. |
| 4.2 | Optimize stats distinct-count queries. | Removes unnecessary row loading. | Stats output matches baseline and query cost drops. |
| 4.3 | Improve application search with trigram/full-text indexes. | Admin search can become expensive. | Search latency improves on realistic data. |
| 4.4 | Tune Prisma/Postgres pool settings. | Prevents pool saturation latency. | Pool metrics show healthy usage under load. |
| 4.5 | Add slow-query logging and dashboards. | Keeps optimization measurable. | Slow queries are visible by model/operation/endpoint. |

Recommended order:

1. Add one index group at a time with `CREATE INDEX CONCURRENTLY`.
2. Validate each index with `EXPLAIN`.
3. Optimize stats queries.
4. Add search indexes.
5. Tune pool and dashboards.

### Phase 5: Near-Instant Public Page Architecture

This is the main track for making `ybb-program-next` feel instant.

| Step | Work | Why | Done when |
| --- | --- | --- | --- |
| 5.1 | Split public pages into above-the-fold hero and streamed below-fold sections. | First viewport renders faster. | Hero renders without waiting for gallery/partners/secondary sections. |
| 5.2 | Add image variant generation in file service. | Avoids serving massive originals. | Uploads produce thumbnail/card/hero variants. |
| 5.3 | Store image variant metadata and use variants in frontend. | Lets frontend request correct size directly. | Cards/gallery use thumbnails; hero uses hero variant. |
| 5.4 | Ensure all public images are CDN-backed with long cache TTL. | Image latency dominates perceived speed. | Public media loads from CDN and cache headers are correct. |
| 5.5 | Add landing snapshots per brand/page. | Makes public reads compact and cache-friendly. | Home/settings/programs/gallery first page can read snapshots. |
| 5.6 | Admin publish triggers brand/page revalidation. | Keeps cached public content fresh. | Updating one brand/page invalidates only that brand/page. |
| 5.7 | Add performance budgets and Web Vitals reporting. | Prevents performance regressions. | LCP/CLS/INP and bundle/image budgets are tracked. |

Recommended order:

1. Page streaming/above-fold split.
2. Image variant pipeline.
3. Frontend uses variants.
4. CDN/cache headers.
5. Landing snapshots.
6. Admin-triggered revalidation.
7. Performance budgets and reporting.

### Phase 6: Payment and Messaging Reliability

Do this after security and baseline tests are solid, because payment changes are high-impact.

| Step | Work | Why | Done when |
| --- | --- | --- | --- |
| 6.1 | Add payment idempotency coverage and BFF/client idempotency key forwarding. | Prevents duplicate payment attempts. | Duplicate confirm returns stable response. |
| 6.2 | Add notification event idempotency. | Prevents duplicate emails on redelivery. | Duplicate event IDs are ignored. |
| 6.3 | Add RabbitMQ retry and DLQ behavior. | Handles transient failures safely. | Failed messages retry with backoff then DLQ. |
| 6.4 | Add payment outbox pattern. | Prevents payment state/event mismatch. | State changes and outbox rows commit atomically. |
| 6.5 | Add payment polling/backoff UX. | Makes payment status clearer to users. | Gateway/manual submission shows reliable pending/success states. |

Recommended order:

1. Payment idempotency tests and frontend key forwarding.
2. Notification idempotency.
3. RabbitMQ retry/DLQ.
4. Payment outbox behind flag.
5. Payment UX polling/backoff.

### Phase 7: Scalability and Operational Cleanup

These are important but should follow the higher-impact security/performance tracks.

| Step | Work | Why | Done when |
| --- | --- | --- | --- |
| 7.1 | Move large lists to cursor pagination. | Avoids deep offset scans. | High-volume lists support cursor pagination. |
| 7.2 | Stream exports in batches. | Avoids memory-heavy exports. | Large exports do not load all rows into memory. |
| 7.3 | Stream/proxy downloads safely or prefer presigned URLs. | Avoids file-service memory spikes. | Large downloads do not buffer full file in memory. |
| 7.4 | Add data retention/partitioning for audit/event tables. | Prevents unbounded table growth. | Retention policy and archive path are defined. |
| 7.5 | Add dependency-aware health checks. | Improves deploy/runtime safety. | Health reflects DB/Redis/RabbitMQ/storage/provider dependencies. |

### Phase 8: UX, SEO, Accessibility, and Polish

These can run in parallel with backend work once core safety is covered.

| Step | Work | Why | Done when |
| --- | --- | --- | --- |
| 8.1 | Add route-specific skeletons, empty states, and error states. | Improves perceived quality. | Dashboard/payment/submission/document routes have consistent states. |
| 8.2 | Improve form validation UX. | Reduces auth/onboarding/submission friction. | Field-level errors and duplicate-submit protection exist. |
| 8.3 | Accessibility pass. | Improves usability and compliance. | Keyboard, focus, aria-live, contrast, reduced-motion checks pass. |
| 8.4 | Brand-aware SEO metadata, sitemap, robots, OG images. | Improves public discovery/sharing. | Public pages have canonical metadata and structured data where useful. |
| 8.5 | Expand Playwright journey coverage. | Prevents UX regressions. | Public/auth/onboarding/dashboard/payment/file journeys are covered. |

## Recommended First 10 Pull Requests

If starting from scratch, this is the most practical sequence:

1. **Baseline and flags:** add feature flags, document baseline metrics, stabilize smoke tests.
2. **Root layout speed:** remove full home-data fetch from `ybb-program-next/app/layout.tsx`.
3. **Script/image quick wins:** gate chat script, audit priority images/sizes, cap initial gallery images.
4. **Production safety:** remove prod debug payloads and fail closed on required production env vars.
5. **Revalidation security:** harden settings/home revalidation endpoints.
6. **BFF security helper:** add shared BFF helper plus log-only CSRF/origin guard.
7. **Brand-scoped frontend cache:** scope Next cache tags and localStorage settings by brand.
8. **Database index batch 1:** add/validate the highest-impact composite indexes.
9. **Stats query optimization:** replace row-loading distinct counts and add tests.
10. **File service security:** fix CORS, protect direct endpoints, and add ownership tests.

After these, move into the image variant pipeline and landing snapshots, because they depend on cache correctness, CDN behavior, and safer file-service foundations.
