# Scoring Rubric Management (Phase 1) — Design

**Date:** 2026-06-20
**Status:** Approved (design)
**Author:** brainstorming session

## Context

The admin dashboard now has scoring pages (fully-funded list, interview list, participant detail) wired to real application data, but **no scores exist** because there is no way for admins to give scores. The decision was to build **full rubric-based scoring**, broken into three phases:

- **Phase 1 (this spec): Rubric management** — define per-program scoring rubrics (categories, criteria, weights). Foundation; nothing can be scored without it.
- **Phase 2: Application scoring + decision** — reviewers score applicants against the application rubric; multi-reviewer averaging; lead advances to interview / rejects.
- **Phase 3: Interview scoring + final decision** — reuse the scoring engine with the interview rubric; final accept/reject.

The scoring data model already exists in `services/api/prisma/schema/scoring.prisma` (`ScoringSchema`, `ScoringCategory`, `ScoringCriterion`, `ApplicationReview`, `ApplicationScoreItem`) but has **no API endpoints and no UI**, and all tables are empty.

### Key product decisions (from brainstorming)
1. Rubrics are defined via a **full builder UI, per program**.
2. Multiple reviewers per applicant; final score is the **average** of submitted reviews (Phase 2).
3. Total is a **two-level weighted** score: category weights × criterion weights, normalized to 0–100 (Phase 2).
4. The advance/reject decision is **manual, by a lead** (Phase 2/3).
5. **Two rubric stages per program**: application and interview.
6. Permissions: **super admins build rubrics**; program admins score + decide (Phase 2/3).

## Goals (Phase 1)
- Super admins can create and edit a program's **application** rubric and **interview** rubric: categories (name, weight, order, description) each containing criteria (name, weight, max score, order, description).
- Rubrics persist and can be reloaded/edited.
- Program admins (and Phase 2 scoring) can read a program's rubrics.

## Non-goals (Phase 1)
- No scoring/reviews (Phase 2), no averaging, no decisions, no score computation beyond defining the inputs.
- No rubric versioning or cross-program cloning (possible later).
- No new "reviewer" role (operating roles handled in Phase 2 with existing roles).

## Data model changes

Add a stage discriminator to `ScoringSchema` so a program can hold one application rubric and one interview rubric.

- New Prisma enum `ScoringStage { application, interview }`.
- `ScoringSchema.stage ScoringStage @default(application) @map("stage")`.
- Enforce **one active (non-deleted) schema per `(programId, stage)`**. Implemented via a partial unique index where `deleted_at IS NULL`, or application-level guard if a partial index is impractical with Prisma. Prefer a partial unique index in the migration SQL.

No other model changes. `ScoringCategory.weight` and `ScoringCriterion.weight` remain `Decimal(5,2)` fractions (0–1); `ScoringCriterion.maxScore` default 100. Empty tables, so no data migration.

## Backend API

All endpoints under the existing programs module. Auth: class/route guards `JwtAuthGuard + RolesGuard`.

### Read (SUPER_ADMIN or ADMIN)
`GET /programs/:programId/scoring-rubrics`
- Returns both stages: `{ application: RubricDto | null, interview: RubricDto | null }`.
- `RubricDto = { id, programId, stage, name, description, isActive, categories: [{ id, name, description, weight, order, criteria: [{ id, name, description, weight, maxScore, order }] }] }`.
- Categories and criteria ordered by `order`.
- Optional `?stage=application|interview` to fetch one.

### Upsert whole rubric (SUPER_ADMIN only)
`PUT /programs/:programId/scoring-rubrics/:stage`
- Body: `{ name?, description?, categories: [{ id?, name, description?, weight, order, criteria: [{ id?, name, description?, weight, maxScore, order }] }] }`.
- Semantics: transactionally reconcile the persisted rubric for `(programId, stage)` to match the payload:
  - Create the schema if none exists for `(programId, stage)`.
  - Categories/criteria with an `id` are updated; without an `id` are created; persisted ones absent from the payload are deleted.
  - Returns the resulting `RubricDto`.
- Validation: `name` non-empty; each weight `>= 0`; `maxScore > 0`; orders are integers. Weights are NOT required to sum to 100% (see Weights).

### Implementation notes
- Follow the existing CQRS pattern in the programs module (commands/queries + handlers + repository), matching how program content (timeline, faqs, etc.) is structured.
- The upsert runs in a Prisma transaction (`$transaction`) for atomic reconcile.
- Reuse `useResolvedProgramId` conventions on the client; the API expects the program UUID.

## Frontend: rubric builder UI (super-admin only)

- Location: a **"Rubric"** page within the program's Scoring section (e.g. `app/programs/[programId]/scoring/rubric/page.tsx`), visible/navigable to super admins only (gate with existing access config; program admins do not see the editor).
- Layout: **Application / Interview** tabs (the two stages). Each tab renders the rubric editor:
  - Ordered list of **categories**: name, weight (%), description, reorder, delete, "Add category".
  - Within each category, ordered list of **criteria**: name, weight (%), max score, description, reorder, delete, "Add criterion".
  - A live **weight-sum indicator** at each level (category total; per-category criteria total), showing a non-blocking warning when not 100%.
  - A single **"Save rubric"** action → `PUT /programs/:programId/scoring-rubrics/:stage`. Loading + error + success states.
- Weights edited as percentages (e.g. 60), converted to 0–1 fractions for the API; displayed back as percentages on load.
- Read path: load via `GET /programs/:programId/scoring-rubrics`; empty state with "Add category" when no rubric exists yet.

## Weight semantics
- Stored as 0–1 fractions (model unchanged); edited/displayed as percentages.
- Category weights should sum to 100%; criteria weights within a category should sum to 100%.
- The builder **warns but does not block** on mismatch. Phase 2 score computation will **normalize** weights so totals are always a clean 0–100 regardless of whether they sum exactly.

## Edit safety
- Phase 1 has no reviews/score items, so category/criterion deletion is unrestricted.
- **Flagged for Phase 2:** once `ApplicationScoreItem`s reference a criterion, deleting/replacing that criterion must be guarded (block deletion of scored criteria, or introduce rubric versioning). Out of scope here, called out so Phase 2 handles it.

## Testing
- Backend unit tests: the upsert reconcile logic (create/update/delete of categories+criteria to match payload), the GET shape/ordering, validation rejects (negative weight, zero max score, empty name), and the SUPER_ADMIN guard on the upsert.
- Type-check both `services/api` and `services/admin-dashboard` (`tsc --noEmit`).
- Frontend: live walkthrough — build an application rubric and an interview rubric for a test program, reload, confirm persistence and ordering; confirm program-admin role cannot access the editor.

## Out of scope / future phases
- Phase 2: `ApplicationReview` + `ApplicationScoreItem` create/update/list, two-level weighted total, multi-reviewer averaging into the application's denormalized `scoreTotal`/`scoreStatus`, scoring UI on the participant detail, lead advance-to-interview/reject decision.
- Phase 3: interview-stage scoring (reuse engine with the interview rubric), final accept/reject.
