# Copy Submission Form Fields From Another Program

**Date:** 2026-06-15
**Status:** Approved design, pending implementation plan
**Area:** Admin Dashboard (Master Data > Submission Form > Form Fields) + API (`programs` module)

## Problem

When an admin sets up a new program, they currently rebuild the application form
fields from scratch or apply a curated super-admin "template". They want to bootstrap a
new program's form by copying the fields from an existing program (e.g. copy China Youth
Summit 2026's fields from MEYS 2026). This must work across brands and across programs,
and admins should be able to copy all fields or cherry-pick a subset.

This is additive: the existing "Copy from template" feature stays. We add a parallel
"Copy from program" capability.

## Goals

- Let an admin copy application form fields from any program they can access into the
  current program.
- Cross-brand and cross-program.
- Copy all fields or a selected subset.
- Offer append (add only new) and replace (wipe then insert) modes, with safety guards
  when the target program already has participant submissions.
- Carry media/help-asset references as-is, warning the admin on cross-brand copies.

## Non-goals (YAGNI)

- Copying participation categories, sub-themes, essays, or preview settings. Form fields
  only (the button lives on the Form Fields tab). These can follow later as separate work.
- Deep-copying media binaries into the target brand's storage. We copy the URL string;
  re-upload is a manual follow-up if the admin wants brand-owned assets.
- A new template-management surface. Templates are unchanged.

## Background: how the system works today

- **Form fields** are rows in `ApplicationFormField` (`application_form_fields`), scoped
  per program by `programId` FK. Key columns: `name` (the storage key), `label`, `type`,
  `section`, `isRequired`, `order`, `placeholder`, `helpText`, `options` (JSON),
  `validationRules` (JSON), `source` (`system`|`custom`), `systemFieldKey`, `mediaUrl`,
  `mediaAlt`, `helpAssets` (JSON), `isActive`, `deletedAt` (soft delete).
- **Unique constraint:** partial unique index on `(programId, name) WHERE deletedAt IS NULL`.
  Field keys are unique per program among non-deleted rows.
- **Participant answers** are stored in `ParticipantApplication.personalData` (JSON),
  keyed by the field `name`. Answers are NOT foreign-keyed to the form-field definition
  row. Changing or removing a field definition never deletes the stored answer.
- **Existing "Copy from template"** flow:
  - Frontend `CopyFromTemplateDialog.tsx` -> `applyTemplateToProgram(programId, templateId, mode)`
    in `catalog-api.ts` -> `POST /programs/:programId/form-fields/apply-template`.
  - Backend `ApplyFormTemplateHandler` runs in a transaction: optional soft-delete of
    existing fields (replace), then per-template-field `prisma.applicationFormField.create`,
    with append-dedup by `name`. It does NOT copy media/help assets (templates do not
    store them).
- **Program list for a picker:** `useAuth().accessiblePrograms` (`AdminProgram[]`) already
  holds `{ programId, programName, brandId, brandName, ... }` for every program the admin
  can access. No new API call is needed for the picker.

Key file references:
- `services/admin-dashboard/app/programs/[programId]/master-data/submission-form/page.tsx`
- `services/admin-dashboard/app/components/submissionsMasterData/form-fields/FormFieldsTable.tsx`
- `services/admin-dashboard/app/components/submissionsMasterData/form-fields/CopyFromTemplateDialog.tsx`
- `services/admin-dashboard/.../catalog-api.ts` (`applyTemplateToProgram`, `fetchFormTemplates`)
- `services/api/src/modules/programs/presentation/program-form-fields.controller.ts`
- `services/api/src/modules/programs/application/commands/handlers/apply-form-template.handler.ts`
- API Prisma model `ApplicationFormField`

## Decisions

| Decision | Choice |
|---|---|
| Relationship to existing button | Add a second button "Copy from program" alongside "Copy from template". Templates unchanged. |
| Selection granularity | Copy all, or cherry-pick via checkboxes + "Select all". |
| Modes | Append (default) and Replace. |
| Replace safety | Require explicit type-to-confirm; surface participant submission count when the target program has submissions. |
| Media / help assets | Copy URL/refs as-is; show a cross-brand caveat when source brand differs from target brand. |
| Source programs | Any program in `accessiblePrograms`, current program excluded, grouped by brand. |
| Scope | Form fields only. |
| Permissions | Reuse the existing form-field admin guard used by apply-template. |

## Design

### Frontend

New component `CopyFromProgramDialog.tsx`, parallel to `CopyFromTemplateDialog.tsx`:

1. **Source program picker** — searchable list from `useAuth().accessiblePrograms`,
   labeled `"{programName}  ·  {brandName}"`, current `programId` excluded. Sort by brand
   then program year desc.
2. **Field list** — on source selection, `GET /programs/{sourceProgramId}/form-fields`
   (the existing public list endpoint), render rows with a checkbox each plus a header
   "Select all". Each row shows label, key (`name`), section, type, required/optional, and
   a small badge if it has media/help assets.
3. **Mode control** — Append | Replace (same UI as template dialog).
4. **Safety banner** — when the target program has submissions (> 0), render a warning
   that includes the count; for Replace, require a type-to-confirm input (mirrors existing
   replace confirmation).
5. **Cross-brand media caveat** — if any selected field has `mediaUrl`/`helpAssets` and the
   source program's `brandId !== target brandId`, show a one-line note.
6. On confirm, call new `copyFromProgram(programId, { sourceProgramId, fieldIds, mode, confirm })`
   in `catalog-api.ts`; on success show a toast with added/skipped counts and refresh the
   fields table.

Wire into `FormFieldsTable.tsx`: add a `copyFromProgramOpen` state and the new button next
to "Copy from template".

### API

New endpoint on `ProgramFormFieldsController`:

```
POST /programs/:programId/form-fields/copy-from-program
Body: {
  sourceProgramId: string;        // required, must differ from :programId
  fieldIds?: string[];            // omitted => all active source fields
  mode: "append" | "replace";     // required
  confirm?: boolean;              // required true for replace when target has fields/submissions
}
Returns: { mode, sourceProgramId, added: string[], skipped: string[] }
```

Guarded by the same admin permission as `apply-template`. A DTO validates the body
(`sourceProgramId` non-empty UUID, `mode` enum, `fieldIds` optional string array).

### Backend handler

New `CopyFieldsFromProgramHandler` (mirrors `ApplyFormTemplateHandler`), in a single
Prisma transaction:

1. Validate `sourceProgramId !== programId`; 400 otherwise.
2. Load source fields: `applicationFormField.findMany({ where: { programId: sourceProgramId, deletedAt: null }, orderBy: { order: 'asc' } })`. If `fieldIds` provided, filter to those (preserving source order). 404/empty -> 400 "no fields to copy".
3. **Replace mode:** require `confirm === true`; `updateMany` set `deletedAt = now(), isActive = false` on target's non-deleted fields.
4. **Append mode:** load target's existing non-deleted field `name`s into a `Set`.
5. Compute base order: replace -> start at 0; append -> `max(existing order) + 1`.
6. For each source field (in order), index `i`:
   - `name` collides with target set (append only) -> push to `skipped`, continue.
   - `prisma.applicationFormField.create` on target `programId`, copying: `name`, `label`,
     `type`, `section`, `isRequired`, `placeholder`, `helpText`, `options`,
     `validationRules`, `source`, `systemFieldKey`, `mediaUrl`, `mediaAlt`, `helpAssets`;
     `order = baseOrder + i`; `isActive = true`, `deletedAt = null`.
   - push `name` to `added`.
7. Return `{ mode, sourceProgramId, added, skipped }`.

Notes:
- Direct Prisma create (bypassing `CreateApplicationFormFieldCommand`), matching the
  template handler. The `(programId, name)` partial unique index is the backstop against
  duplicates; append dedup avoids hitting it.
- System fields keep `source = 'system'` and `systemFieldKey`; we copy the source row's
  already-resolved `type`/`options`/`label` directly rather than re-resolving from the
  catalog (simpler and faithful to what the source program shows). If the source row
  references a now-inactive catalog key, the copy carries the same reference (same risk
  profile as today's template apply).

### Data safety

- No hard deletes anywhere. Replace soft-deletes definitions only.
- Participant answers (JSON keyed by `name`) are never modified by this feature.
- Append cannot alter an existing field's type, because it skips colliding keys.
- The only residual risk is the documented "Replace into a program with existing
  submissions" case (orphaned answers for removed fields; potential type/option mismatch
  for re-created same-key fields). This is gated behind the submission-count warning and
  type-to-confirm.

### Submission count for the warning

Backend exposes the target program's submission count for the dialog. Prefer reusing an
existing count if one is readily available in the programs/applications module; otherwise
add a lightweight read (e.g. include `submissionCount` in the form-fields list response for
the target program, or a small `GET /programs/:id/submission-count`). Implementation plan
to pick the least invasive option after confirming what already exists.

## Testing

**Backend (Jest):**
- Append: copies only non-colliding keys; returns correct added/skipped.
- Replace: soft-deletes existing, inserts source set; requires `confirm`.
- Selective `fieldIds`: copies only chosen fields in source order.
- Order renumbering: append places copies after `max(existing order)`.
- Cross-program copy: target gets new rows scoped to target `programId`.
- System field: `source`/`systemFieldKey` preserved.
- Media: `mediaUrl`/`mediaAlt`/`helpAssets` carried over.
- Guards: `sourceProgramId === programId` rejected; replace without `confirm` rejected.

**Frontend:**
- Dialog lists accessible programs excluding the current one, grouped by brand.
- Select-all and individual selection.
- Mode switch; replace shows confirm input and submission-count warning.
- Cross-brand media caveat appears when applicable.
- Success path refreshes the fields table and toasts added/skipped.

## Rollout

- Additive, no migration (no schema change unless we add a count endpoint/field, which is
  read-only). Existing template feature untouched.
- Manual verification: copy a full form across brands into a fresh program; cherry-pick a
  subset; attempt replace into a program with submissions and confirm the guard.
