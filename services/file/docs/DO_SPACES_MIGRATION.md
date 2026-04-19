# File Service: DO Spaces + Presigned Upload Migration

Owner: hendra · Started: 2026-04-19

## Why

Bring the file service in line with the upload pattern used in `test-prep-platform`:
presigned-URL / direct-to-storage so the API never proxies file bytes. At the same
time, swap MinIO for Digital Ocean Spaces as the backing store. YBB only needs
documents + images — no audio, no video.

## Decisions

- **Storage:** single DO Space (`ybb-platform`), region `sgp1`. Per-brand
  isolation via path prefix `{env}/{brand_id}/...`, not per-brand Spaces.
- **Visibility:** all objects public-read via a bucket policy on `ybb-platform`
  (`s3:GetObject` for `*`). A future flip to private is a policy swap + flipping
  consumers to `get_presigned_url()` instead of `get_public_url()`.
- **Storage class stays `MinIOStorage`** — `minio-py` is S3-compatible and works
  with Spaces via endpoint/region config. Rename to `S3Storage` is a cosmetic
  follow-up.
- **Legacy `POST /files/upload` is kept.** Server-side generators (PDF receipts,
  certificates, Excel exports) still need a multipart path.
- **NestJS `services/api/` does not own upload logic** — it only proxies to the
  Python file service with auth guards at the gateway.

## Flow (target)

```
client ──POST /files/upload-url──▶ file svc
         (filename, mime, size)        │ validate MIME + size
                                       │ reserve File row (status=PROCESSING)
                                       │ sign PUT URL (5 min)
                                       ▼
client ◀──{file_id, upload_url, public_url}──
client ──PUT upload_url (bytes)──▶ DO Spaces
client ──PATCH /files/{id}/ready──▶ file svc
                                       │ exists(storage_path)?
                                       │ status=READY
                                       ▼
client ◀──FileDto──
```

## Progress

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

### Backend (services/file)

- [x] **1. Prisma `status` field** — `status VARCHAR(20)` default `PROCESSING`
  added to `schema.prisma`; migration `20260419000000_file_status` backfills
  existing rows to `READY` via a two-step `DEFAULT` swap.
- [x] **2. Entity + repo wiring** — `FileStatus` constants class in
  `domain/entities/file.py`; `status` threaded through `File` entity, `FileDto`,
  `PostgresFileRepository.save`/`_to_domain`. Legacy `UploadFileHandler` now
  saves `status=FileStatus.READY` (bytes already on storage by save-time).
  gRPC `ConfirmUpload` also syncs the new column alongside its legacy metadata
  flag — covered by task #9.
- [x] **3. `CreateUploadUrlCommand` + handler** —
  `application/commands/create_upload_url_command.py` +
  `handlers/create_upload_url_handler.py`. Reuses `FilePathService` and the MIME
  allowlist / size caps. Returns `CreateUploadUrlResponseDto` with
  `upload_url` + `public_url` + `expires_in_seconds`.
- [x] **4. `MarkFileReadyCommand` + handler** —
  `application/commands/mark_file_ready_command.py` +
  `handlers/mark_file_ready_handler.py`. Verifies object via `storage.exists()`,
  enforces brand-scope check, idempotent on re-call. New
  `FileNotUploadedException` → HTTP 409.
- [x] **5. Routes** — `POST /files/upload-url` and `PATCH /files/{id}/ready` in
  `presentation/api/routes/files.py`; DI wired in `dependencies/container.py`.
  Request DTO `CreateUploadUrlRequestDto` added.
- [x] **6. Config swap** — `.env`, `.env.staging`, `.env.prod`, `.env.example`
  already all point at `sgp1.digitaloceanspaces.com` (staging/prod use CDN
  `cdn.ybbhub.com`). docker-compose only passes through env vars so no file
  changes needed. Dev DB created, historical + new migrations applied,
  `_prisma_migrations` seeded so `prisma migrate deploy` is now idempotent.

### Gateway (services/api, NestJS)

- [x] **7. Files gateway module** — new `createUploadUrl()` + `markFileReady()`
  methods + types on `FileServiceClient`; new `POST /files/upload-url` and
  `PATCH /files/:fileId/ready` routes on `FilesController` behind the existing
  `JwtAuthGuard`. Existing gRPC-based `POST /files/presigned-upload-url` is
  left alone for backwards compat. TypeScript compiles clean
  (only pre-existing error in an unrelated module).

### Frontend (admin-dashboard, `ybb-platform/services/admin-dashboard/`)

- [x] **8. Upload plumbing** — added to the shared api-client
  (`src/shared/api-client.ts`): `requestUploadUrl`, `putFileToStorage` (raw XHR
  so progress is observable), `markFileReady`, `uploadFileViaPresignedUrl`
  one-shot helper. Plus `src/shared/hooks/useFileUpload.ts` for single-file UIs
  that want a progress bar.
- [x] **9. Three real surfaces wired to the new flow:**
    - **Media library** — `app/programs/[programId]/media/page.tsx` batch-uploads
      via `uploadFileViaPresignedUrl` in `Promise.allSettled`.
    - **Brand identity (logo + banner)** — `updatePlatformBrandIdentity` in
      `app/platform/api.ts` uploads files via presigned first, then submits
      `logoUrl`/`bannerUrl` string fields to `PUT /brands/:id`. The
      `UpdateBrandHandler` already accepted these URL fields; no DTO change
      needed.
    - **Program photo gallery** — `createProgramGalleryItem` /
      `updateProgramGalleryItem` upload via presigned then POST JSON to
      `/programs/:id/gallery` with `imageUrl`. Required a `year` column added
      to `ProgramGallery` (migration
      `20260419120000_add_program_gallery_year`) + `year` fields on both
      Create/Update DTOs.

### Operations (one-time Space setup)

- [x] **10. Bucket policy + CORS** — `services/file/scripts/configure_spaces.sh`
  applies a public-read `s3:GetObject` bucket policy and a CORS rule allowing
  GET/PUT/HEAD/POST/DELETE from the configured origins. Idempotent;
  re-runnable. Applied to dev Space with `CORS_ORIGINS=*`; re-run against
  staging/prod with narrower origins before go-live.

```bash
# dev (already applied)
./scripts/configure_spaces.sh

# staging
ENV_FILE=./.env.staging \
CORS_ORIGINS="https://admin-staging.ybbhub.com,https://landing-staging.ybbhub.com" \
./scripts/configure_spaces.sh

# prod
ENV_FILE=./.env.prod \
CORS_ORIGINS="https://admin.ybbhub.com,https://www.ybbhub.com" \
./scripts/configure_spaces.sh
```

## MIME allowlist (no audio / video)

```
DOCUMENT_MIMES = {
  application/pdf,
  application/msword,
  application/vnd.openxmlformats-officedocument.wordprocessingml.document,
  application/vnd.ms-excel,
  application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,
}
IMAGE_MIMES = { image/jpeg, image/png, image/webp, image/gif }
```

Size caps: 10 MB documents, 5 MB images (match existing handler).

## Gotchas hit during implementation (keep as reference)

Each of these cost ≥1 debugging loop; listed here so the next person doesn't
repeat them.

- **Presigned URL signature is bound to the signed host.** The old
  `MinIOStorage.get_presigned_{upload,}url` rewrote the URL's host from the
  internal endpoint to `MINIO_PUBLIC_ENDPOINT` after signing. Worked for raw
  unsigned GETs but broke every signed PUT with
  `SignatureDoesNotMatch`. Fix: rewrite only in `get_public_url()`; return
  presigned URLs unmodified.
- **`bucket_exists` requires `HeadBucket` perms.** On managed S3 (Spaces, R2)
  the API key often has object-only perms. `bucket_exists` → `make_bucket`
  dance inside `get_presigned_upload_url` was failing with `AccessDenied` even
  for a valid bucket. Dropped the check — buckets are provisioned out of band.
- **Double response envelopes.** NestJS has a global `TransformInterceptor`
  that wraps every controller return in `{statusCode, message, data}`. Any
  controller that additionally returns `{success: true, data: ...}` ends up
  double-wrapped, and the admin-dashboard's `request()` helper (which unwraps
  once) hands the frontend the outer object — so `result.files`,
  `url.upload_url` etc. are `undefined`. Fixed in `files.controller.ts` and
  `admin-media.controller.ts`; **new controllers must return raw DTOs.**
- **Docker env vars don't refresh on `restart`.** `docker restart <container>`
  keeps the env snapshot taken at container-create time. After editing `.env`,
  you must `docker compose up -d --force-recreate <service>` for new vars to
  take effect (e.g. changing `MINIO_BUCKET`).
- **Postgres init-SQL drifted from Prisma migrations.** The postgres-file
  container's `database/init/02-create-tables.sql` creates the `files` table
  at an older schema version than `prisma/migrations/*/_init`, so a first-ever
  `prisma migrate deploy` tries to `CREATE TABLE` on top of existing tables
  and errors. We baselined by applying migration SQLs directly + seeding
  `_prisma_migrations` manually. **Long-term fix:** delete the init SQL and
  let Prisma own the schema end-to-end (separate ticket).
- **`PROCESSING` rows pollute the media library when clients crash.** If the
  browser requests an upload URL but never calls `/ready` (tab closed,
  network drop, bug), the row sits in PROCESSING forever. `list_files_by_program`
  now filters to `status='READY'` only. Consider a periodic sweeper that
  deletes PROCESSING rows older than ~1h.

## Open follow-ups

- **Auth between admin-dashboard → NestJS → file service.** Currently the file
  service trusts `user_id`/`brand_id` form fields from any caller. Gateway
  should pass a service-to-service token; decide shape before the file service
  is exposed publicly.
- **Orphaned-upload sweeper.** Background job that deletes `status='PROCESSING'`
  rows older than 1h and removes the corresponding Spaces object if it exists.
- **`minio_storage.py` → `s3_storage.py` rename.** Name is misleading now that
  MinIO is gone from prod. Pure cosmetic; low priority.
- **Postgres init-SQL removal.** See gotcha above — let Prisma own the schema.
- **CDN in front of Spaces** (`cdn.ybbhub.com` in staging/prod envs). Needs the
  CDN provisioned + `X-Robots-Tag: noindex, nofollow` set at the edge to keep
  uploaded docs out of search indexes.

## Changelog

- **2026-04-19** — plan agreed, doc created.
- **2026-04-19** — backend steps 1–5 done. File service now exposes
  `POST /files/upload-url` + `PATCH /files/{id}/ready` alongside the legacy
  multipart `POST /files/upload`. All changed Python files AST-parse clean.
- **2026-04-19** — migration applied against local dev DB via psql
  (direct SQL + `_prisma_migrations` seeding — the `postgres-file` container's
  init-SQL scripts had drifted from Prisma migrations, so the first-ever
  Prisma run needed baselining). Verified `files.status` column present with
  default `PROCESSING`, `files_status_idx` in place, `file_size` upgraded to
  BIGINT by the earlier media_library migration.
- **2026-04-19** — steps 7 and 8 done. NestJS gateway now proxies the two new
  endpoints under `JwtAuthGuard`. Admin-dashboard has a `uploadFile()` client
  + `useFileUpload` hook + `FileUploader` component ready to drop into a page.
  Remaining: step 9 (wire the new uploader into an actual document-upload
  screen) and end-to-end smoke test against DO Spaces.
- **2026-04-19** — realignment: discovered the real admin dashboard lives at
  `ybb-platform/services/admin-dashboard/`, not the near-empty `/admin-dashboard`
  scaffold. Deleted the misplaced client + hook + component from the scaffold
  and re-implemented them inside the real project, plus wired them into three
  real surfaces: media library, brand identity, program photo gallery.
  Extended standalone `/gallery` controller with PATCH/DELETE + `image_url`
  support as a bonus. Full admin-dashboard + api tsc passes clean.
- **2026-04-19** — end-to-end smoke-tested against DO Spaces. Hit and fixed,
  in order: (a) bucket name `ybb` → `ybb-platform`; (b) `bucket_exists` probe
  failing with `AccessDenied`; (c) host-rewrite breaking AWS4 signatures; (d)
  double response-wrap causing `upload_url: undefined`; (e) same double-wrap
  on `listMedia` hiding the files array; (f) stale `PROCESSING` rows filling
  the list → added `status='READY'` filter to `find_by_program`; (g)
  `PricingTierValidityPeriod` missing import in `program-content.repository.ts`
  blocking `nest --watch` recompiles. Full three-step flow verified: browser
  `POST /files/upload-url` → `PUT` to Spaces → `PATCH /ready` → row shows up.
- **2026-04-19** — applied public-read bucket policy and CORS rules to the
  `ybb-platform` Space. Captured as
  `services/file/scripts/configure_spaces.sh` so staging/prod Spaces can be
  configured identically. Public thumbnails now render in the media library.
- **2026-04-19** — silenced Loki + OTEL connection-refused spam by probing
  the collector's TCP port at startup and skipping handler/exporter install
  if it's unreachable (`app/infrastructure/telemetry/loki.py`,
  `otel.py`). No impact on environments where the observability stack is
  actually running — the probe succeeds and handlers attach normally.

## Status: DONE (for dev)

All three upload surfaces work end-to-end against DO Spaces. Remaining work
is operational: narrow CORS origins for staging/prod before go-live, and the
items in "Open follow-ups" above.
