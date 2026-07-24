# LoA Preview as Real Participant

Date: 2026-07-24
Status: approved, not yet implemented

## Context

On 2026-07-24 the China Youth Summit 2026 Invitation Letter shipped to participants with every
`{{token}}` unsubstituted, while the admin preview rendered perfectly. Three independent root
causes were found and fixed (see commits `8aad6a9`, `8cd333e`, `253da12`). The reason none of
them were caught for weeks is structural, and is not addressed by those fixes:

**The admin preview is incapable of failing the way the participant download fails.**

Specifically, `PreviewLoaTemplateHandler`:

1. Receives `placeholders` from the browser (a hardcoded client constant), so it never reads
   `document_templates.placeholders`. The corrupted column was therefore invisible to it.
2. Substitutes a fake `SAMPLE_PARTICIPANT` with every field populated, so a token backed by an
   empty database column renders fine in preview and blank in production.
3. Renders live editor state, not the persisted row, so unsaved edits look shipped.

Both paths already share one renderer (file service `POST /api/v1/documents/generate/loa`) and
one param builder (`buildGenerateLoaParams`). The renderer was never the problem. Only the
inputs diverge.

## Goals

- An admin can see exactly what a named participant will receive, before releasing a batch.
- Divergence between the persisted template and the editor draft is visible, not silent.
- The preview and download paths cannot drift apart again without a test failing.

## Non-goals

- Changing the release, eligibility, or batch model.
- Changing the file service or the PDF renderer.
- Emailing or attaching letters. Still descoped.

## Core principle

Do not add a third render path. The outage was caused by two paths diverging; a third would
make it worse. Extract the shared piece and have every caller use it.

## Architecture

Extract source-map construction out of `LoaDownloadService` into a shared service
(`LoaRenderDataService`) exposing roughly:

```
buildSourceMapForApplication(applicationId, opts: { documentNumber: string })
  -> Record<string, string>
```

Callers after the change:

| Caller | Template content | Participant data | Side effects |
|---|---|---|---|
| `LoaDownloadService` | persisted row | real | assigns doc number, bumps counters |
| Preview `source: 'saved'` | persisted row | real | none |
| Preview `source: 'draft'` | request body | real | none |
| Preview fallback | request body | `SAMPLE_PARTICIPANT` | none |

The existing preview endpoint `POST /programs/:id/document-templates/preview` gains two optional
body params:

- `applicationId?: string` — whose data to render. Omitted means auto-pick.
- `source?: 'draft' | 'saved'` — defaults to `'draft'` to preserve current behaviour for any
  existing caller.

The client issues two requests in parallel, one per `source`, and displays them side by side.
Returning two PDFs from one request was considered and rejected: it needs multipart or base64
JSON, and it breaks the existing "endpoint returns a PDF blob" contract for no real gain.

## Participant pool

The pool is **any application for this program with status `submitted` or `accepted`**,
explicitly NOT gated on LoA eligibility.

This is deliberate. Eligibility additionally requires a released batch whose window covers the
submission date. Admins author the template *before* releasing, so gating the preview pool on
eligibility would serve fake data at exactly the moment the template is being designed, which
is when honesty matters most.

Fallback to `SAMPLE_PARTICIPANT` happens only when the program has zero submitted or accepted
applications (a genuinely new program). When the fallback is used the UI must say so.

Auto-pick selects the first application in the pool. The picker reuses the existing admin
applications search endpoint. No new search endpoint.

## Side effects must be suppressed

The download path calls `LoaDocumentNumberService.assignOrGet`, which mints and persists a real
document number, and it updates download counters. Preview must do neither, or admins will burn
document numbers and corrupt the download statistics on every click.

Preview resolves the document number as: use the already-assigned number if the application has
one, otherwise render the literal `PREVIEW/000` without allocating.

This is the one field where preview is intentionally not byte-identical to the real download,
and the parity test below must exclude it explicitly rather than by accident.

## UI

In `LoaTemplateEditor.tsx`, the existing Preview button now renders real data. Two panes,
labelled DRAFT and SAVED.

- A header line shows `Previewing as: <name>` with a `[change]` control opening the search picker.
- When the program has no submitted applications, the header instead reads that it is showing
  sample data, so a green preview is never mistaken for a verified one.
- A drift warning appears when the live editor state differs from the loaded template. This is
  computed client-side by diffing editor state against the loaded row, so it costs no server work.

The side-by-side render is what catches the severe case: corrupted persisted placeholders render
raw `{{tokens}}` in the SAVED pane while DRAFT looks perfect. That is precisely the failure that
went unnoticed for weeks.

## Error handling

- `applicationId` not found, soft-deleted, or belonging to another program: 404. Never silently
  fall back to auto-pick, since a silent fallback would let an admin believe they verified a
  specific participant's letter when they did not.
- No active template and `source: 'saved'`: 409 with a message saying the template is unpublished,
  rather than rendering an empty document.
- File service failure: surface the error. Do not fall back to a partially rendered document.

## Testing

The important one:

- **Parity test.** For a fixed application, assert `buildGenerateLoaParams` output from the
  preview-saved path is deep-equal to the download path's, excluding only `document_number`.
  This single test is the durable guard against this entire class of bug recurring.

Plus:

- `LoaRenderDataService` unit tests, including the dead-column fallback to `personal_data`.
- Pool selection: auto-pick returns a submitted application; pool ignores batch release state;
  fallback to sample only when the pool is empty.
- Side-effect suppression: preview does not call `assignOrGet` and does not bump counters.
- Error cases above.

## Risks

- Refactoring `LoaDownloadService` touches a live path that 207 participants currently depend on.
  The parity test plus the existing `loa-download.service.spec.ts` suite must stay green
  throughout, and the extraction should land as its own commit before preview changes.
- Preview renders real participant PII into the admin UI. Admins already have access to this data
  through the applications list, so this introduces no new exposure.
