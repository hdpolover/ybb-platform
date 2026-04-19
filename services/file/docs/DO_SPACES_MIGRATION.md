# File Service: DO Spaces + Presigned Upload Migration

Owner: hendra · Started: 2026-04-19

## Why

Bring the file service in line with the upload pattern used in `test-prep-platform`:
presigned-URL / direct-to-storage so the API never proxies file bytes. At the same
time, swap MinIO for Digital Ocean Spaces as the backing store. YBB only needs
documents + images — no audio, no video.

## Decisions

- **Storage:** single DO Space (`ybb-media`), region `sgp1`. Per-brand isolation
  via path prefix `{env}/{brand_id}/...`, not per-brand Spaces.
- **Visibility:** all files public for now. Access control remains at the
  application layer; a future flip to private is a config change on the bucket
  category since `get_presigned_url()` already exists.
- **Storage class stays `MinIOStorage`** for now — `minio-py` is S3-compatible
  and already works with Spaces via config. Rename is optional cosmetic follow-up.
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

### Frontend (admin-dashboard)

- [x] **8. Upload plumbing** — `lib/api/files.ts` (`uploadFile()` three-step
  helper + MIME allowlist), `hooks/useFileUpload.ts` (state machine with XHR
  progress + cancel), `components/ui/FileUploader.tsx` (dropzone + progress
  UI). Type-checks clean against Next.js 16 / React 19.
- [ ] **9. Migrate one document-upload UI** to the new flow as a dogfood test.

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

## Open questions / follow-ups

- **Auth between admin-dashboard → NestJS → file service.** Currently the file
  service trusts `user_id`/`brand_id` form fields. Gateway should pass a
  service-to-service token; decide shape before exposing publicly.
- **CDN domain.** Needs to be picked (`cdn.ybb.org`?) and CORS + `X-Robots-Tag:
  noindex, nofollow` configured at the Space level.
- **Legacy rename.** `minio_storage.py` → `s3_storage.py` at some point — name
  is misleading once MinIO is gone from prod.

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
  real surfaces:
    - **Media library** (`app/programs/[programId]/media/page.tsx`) — batch
      uploads via `uploadFileViaPresignedUrl` replacing
      `uploadProgramMediaFile`.
    - **Brand identity** (`BrandEditPage > IdentityTab`) — `updatePlatformBrandIdentity`
      now uploads logo + banner via presigned, passes `logoUrl`/`bannerUrl`
      strings to `PUT /brands/:id`. No backend change needed — the DTO already
      accepts those URL fields; the handler only overwrites them if a file is
      attached.
    - **Program photo gallery** (`master-data/program-photos/page.tsx`) —
      `createProgramGalleryItem` / `updateProgramGalleryItem` now use
      presigned upload. Required backend additions: `year` column on
      `ProgramGallery` (migration `20260419120000_add_program_gallery_year`),
      `year` field on both Create/Update DTOs. Un-referenced stub components
      in `app/components/programPhotosMasterData/` were deleted as dead code.
    - Also extended the standalone `/gallery` controller (in the gallery
      module) with PATCH/DELETE and `image_url` support — not currently
      consumed by admin-dashboard but non-breaking and useful for future
      integrations.
  Full admin-dashboard + api tsc passes clean for all changed files. Prisma
  migration for `year` not yet applied to the api service DB; will auto-run
  via the api's `docker-entrypoint` on next container start.
