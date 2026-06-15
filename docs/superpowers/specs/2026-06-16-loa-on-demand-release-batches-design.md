# LOA On-Demand Download with Admin-Managed Release Batches — Design

**Date:** 2026-06-16
**Status:** Approved (design), pending implementation plan
**Repos affected:** `ybb-platform` (API, FastAPI file service render path is reused as-is, admin-dashboard), `ybb-program-next` (participant portal)

> Milestone note: the current milestone is "Bug Fix & Security Hardening — no new features". This is a deliberate, user-directed exception (LOA release batches are net-new feature work).

## 1. Summary

Replace the admin-generates-and-stores-and-emails LOA model with **participant self-serve, on-demand, no-storage** generation, gated by an **admin-managed release system**:

- Participants generate/download their own Letter of Acceptance from the dashboard Documents tab.
- The PDF is rendered on demand (WeasyPrint, in the file service) and **streamed** to the browser — **never stored on the server** (reclaims storage).
- Lightweight per-participant **records** are kept (document number, download tracking) — only the files are not stored.
- LOAs are released by admins in **named batches** defined by a **submission date range** + a **release (greenlight) toggle**, so release can be staged in waves and appear review-gated.

## 2. Goals / Non-Goals

**Goals**
- On-demand, in-memory PDF generation + streaming; zero PDF persistence.
- Admin control over *who* can download and *when*, via submission-date-range batches with an explicit release toggle.
- Keep audit-useful records: stable document number per participant, download tracking.
- Remove the now-obsolete admin generate/send/email machinery.

**Non-Goals**
- Email notifications when an LOA becomes available (out of scope; participants discover it in-dashboard).
- Changing how other document types (certificates, agreement letters) work.
- Changing the LOA template authoring experience.

## 3. Eligibility Gate

A participant may generate/download their LOA when **all** are true:
1. Their application `status` ∈ (`submitted`, `accepted`). Submission already enforced the mandatory registration-fee payment, so payment is implied — no separate payment check needed.
2. Their `submission_date` falls within `[submissionFrom, submissionTo]` of some batch whose state is **released**.

If no released batch covers their submission date → not yet available (locked state in the UI).

## 4. Data Model

### 4.1 New: `loa_release_batches`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `program_id` | uuid FK → programs | |
| `name` | text | admin-facing label (e.g. "Wave 1") |
| `submission_from` | timestamptz | inclusive lower bound on `submission_date` |
| `submission_to` | timestamptz | inclusive upper bound |
| `released_at` | timestamptz null | null = draft; set = released (greenlit). The single source of truth for "released" |
| `created_by` | uuid | admin user |
| `created_at` / `updated_at` | timestamptz | |
| `deleted_at` | timestamptz null | soft delete |

**Invariant:** within a program, released/active batch ranges **must not overlap** (validated on create/update). A submission maps to at most one batch.

### 4.2 `ParticipantDocument` (LOA rows) changes
- **Stop** storing/using `fileUrl` for `type = 'letter_of_acceptance'` (no PDF persisted).
- `document_number`: assigned **once** on first download, then reused (stable, identical document on re-download).
- Add download tracking as **explicit new columns**: `download_count int default 0`, `first_downloaded_at timestamptz null`, `last_downloaded_at timestamptz null`. Do **not** overload the existing `viewed_at`/`emailed_at` columns — leave them in place but unused for LOA (a later migration may drop them once nothing references them). Explicit columns keep the semantics unambiguous.
- Optional `loa_release_batch_id` FK for which batch made them eligible (useful for the admin Downloads view).

## 5. API

### 5.1 Participant — on-demand download
`GET /v1/portal/loa/download` (participant JWT; brand-scoped)
- Resolve participant → their `ParticipantApplication` for the brand/program.
- Enforce the §3 eligibility gate; `403` if not eligible (generic message, no oracle).
- Assign or read the stable `document_number` (lazy create the lightweight `ParticipantDocument` row on first download — no `fileUrl`).
- Build placeholder data (same map as the old generate handler).
- Call `FileServiceClient.generateLoa(...)` → `Buffer` (WeasyPrint, in-memory).
- Stream as `StreamableFile` with `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="LOA-<number>.pdf"`.
- Bump `download_count` + `last_downloaded_at` (set `first_downloaded_at` on first).
- **Rate limit:** light per-participant throttle (e.g. a few/min) to prevent render-spam.

BFF: `GET /api/portal/loa/download` in `ybb-program-next` — forwards `accessToken` Bearer + `x-brand-domain`, pipes the binary response through.

### 5.2 Admin — batch management
CRUD under the program/documents area, ADMIN/SUPER_ADMIN guarded:
- `GET  /v1/programs/:programId/loa-batches` — list batches + per-batch eligible & downloaded counts.
- `POST /v1/programs/:programId/loa-batches` — create (name, from, to); validates non-overlap.
- `PUT  /v1/programs/:programId/loa-batches/:id` — edit dates/name; re-validates non-overlap.
- `POST /v1/programs/:programId/loa-batches/:id/release` and `/unrelease` — set/clear `released_at`.
- `DELETE /v1/programs/:programId/loa-batches/:id` — soft delete.
- `GET /v1/programs/:programId/loa-downloads` — read-only download-tracking rows (replaces the old loa-status query).

## 6. Admin UI — LOA page (3 tabs)
- **Template** — existing `LoaTemplateEditor`, unchanged.
- **Batches** — list of batch cards/rows: name, submission range, eligible count, downloaded count, Release/Unrelease toggle; create/edit dialog with date-range pickers + overlap validation feedback.
- **Downloads** — read-only table (repurposed `LoaStatusTable`): participant, email, eligible-batch, document #, first downloaded, download count. Filter + search retained.

**Removed:** Generate & Send button + `GenerateLoaDialog`, the funnel `StatCard`s, bulk-send, per-row send/resend, `LoaRecipientDrawer`.

## 7. Participant UI — Documents tab
- Eligible → "Download Letter of Acceptance" button → calls the BFF download route (streams PDF).
- Not yet released → **locked state**: "Your Letter of Acceptance will be available once released." (Transparent; not hidden.)
- `GetPortalDocumentsHandler` updated: surface the LOA entry based on eligibility (released batch + status), not on `fileUrl` presence; expose the download action instead of a stored URL.

## 8. Generation / Streaming
No change to the renderer: `FileServiceClient.generateLoa()` → FastAPI `POST /api/v1/documents/generate/loa` → `PDFGeneratorService.generate_loa_sync()` (WeasyPrint, returns bytes). The only change is the **caller**: the new portal endpoint streams the returned buffer to the participant and does **not** upload to MinIO.

## 9. Removed / Obsolete (backend)
- `loa_ready` RabbitMQ event emit; `loa-ready.hbs`; `sendLoaReadyEmail()`; its `EventPattern` handler; the template spec.
- Admin LOA generate/bulk endpoint path (`participantId`/`participantIds`/`audience`/`bulk` generate) for LOA.
- `MarkDocumentViewedHandler` + `/viewed` endpoint — superseded by the download endpoint's tracking (repurpose or remove).
- `fileUrl` upload step in the old `GenerateLOAHandler` (the LOA branch).
- `api-client` `sendLoa`/`generateLoa` (admin) calls.

**Kept (shared infra):** `FileServiceClient.generateLoa`, FastAPI render path, `DocumentTemplate` + `LoaTemplateEditor`, `ParticipantDocument` model, `storageService` (used by other types), `GetPortalDocumentsHandler` (modified).

## 10. Existing Data Cleanup (post-cutover)
After the new flow is verified live:
- Null out `fileUrl` on existing `letter_of_acceptance` `ParticipantDocument` rows.
- Delete the already-generated LOA PDFs from MinIO/Spaces to reclaim space.
- Keep the rows (document numbers / history). Done as a separate, explicit step after cutover — not part of the cutover commit.

## 11. Edge Cases & Rules
- **Overlap:** reject create/update that overlaps an existing non-deleted batch in the same program.
- **Date inclusivity:** `submission_date` ∈ `[from, to]` inclusive; store/compare in UTC.
- **Status change after release:** if a released participant is later rejected/withdrawn, they fail the status check and lose access (gate is evaluated live each download).
- **Unrelease:** clearing `released_at` immediately revokes download access (gate evaluated live).
- **Re-download:** same `document_number`, identical PDF; `download_count` increments.
- **No batch / not released:** locked state; `403` from the endpoint if called directly.

## 12. Testing
- Unit: eligibility gate (status × released-batch × date-range), overlap validation, document-number assignment (assign-once/reuse), download-count increment.
- Integration: download endpoint streams a PDF for an eligible participant; `403` for ineligible; batch release/unrelease flips access; non-overlap enforced.
- Admin: batches CRUD + release toggle; downloads table reflects tracking.
- Portal: locked vs available states; download triggers tracking.

## 13. Rollout
1. Ship data model + new endpoints + participant flow + admin Batches/Downloads (feature-complete cutover).
2. Verify on `dev` (auto-deploys; migrations run on API boot via entrypoint — ensure they can't fail mid-boot).
3. Post-verify: run the existing-files cleanup (§10).
