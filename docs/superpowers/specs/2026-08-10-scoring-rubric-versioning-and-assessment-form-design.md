# Scoring Rubric Versioning and Assessment Form

Date: 2026-08-10
Status: approved, ready for planning

## Problem

Admins need to adjust application score weights per program, and reviewers need a form to actually score applications against those weights. Today only half of that exists.

What exists:

- `ScoringSchema` / `ScoringCategory` / `ScoringCriterion` in `services/api/prisma/schema/scoring.prisma`, with weights stored as Decimal fractions (0 to 1).
- A per-program, per-stage rubric builder at `services/admin-dashboard/app/programs/[programId]/scoring/rubric/page.tsx` (`RubricBuilderClient.tsx`), saving via `PUT /programs/:programId/scoring-rubrics/:stage`, SuperAdmin only.
- Seed defaults in `services/api/prisma/seeds/seed-scoring.ts` matching the legacy assessment forms.

What is missing or wrong:

1. No score entry UI or API at all. `ApplicationReview` and `ApplicationScoreItem` have no controller anywhere in `services/api/src`. They are touched only by the seed script.
2. The rubric upsert mutates in place and deletes any category or criterion absent from the payload. Once score items exist, `ApplicationScoreItem.criterionId` FKs into a row that can vanish, so a routine weight edit either hard-fails on the FK or destroys historical scores.
3. No weight change history. An admin cannot see who changed a weight or when, and a past score cannot be explained.
4. No server-side validation that weights sum to 100. `upsert-scoring-rubric.handler.ts` checks only non-empty name, `weight >= 0`, `maxScore > 0`.
5. The builder shows "Scores will be normalized on computation" when weights do not sum to 100. No normalization exists anywhere in the API. The message is false.
6. Most programs have no rubric rows, so the Rubric page renders empty and reads as broken.
7. `ApplicationReview.status` is a bare `VarChar(50)` holding `draft` or `submitted`, inconsistent with the enum-heavy schema.

## Legacy reference

The old CodeIgniter app (`~/Projects/YBB/ybb system old`, `admin_ybb_web`) had the inverse problem: a working assessment form, no weight editor.

- Tables `score_weights` (`program_id`, `description`, `reference`, `weight`, `weight2`) and `scores` (`participant_id`, `score_weight_id`, `score_input`, `score_calculated`).
- `reference` was the section discriminator: `score_ach` rendered as Form A, `score_essay` as Form B.
- Weights were rendered as hidden inputs and only changeable via direct DB access. The `fully_funded/edit` route pointed at a `Scorings::edit` method that does not exist.
- Total in `Scorings::saveScore()`: `score_calculated = score_input * weight * weight2`, summed into `participants.score_total`, with a hardcoded cutoff of 75 deciding `rejected` vs `go_to_interview`.

The legacy two-factor `weight * weight2` maps directly onto the new schema's criterion-weight times category-weight nesting. The new work preserves that formula and makes the cutoff configurable.

## Decisions

| Question | Decision |
|---|---|
| Who edits weights | SuperAdmin only, unchanged |
| Who scores applications | Admin and SuperAdmin |
| Reviews per application | Exactly one per stage |
| Stages | `application` and `interview`, both scored |
| Weight change safety | Immutable schema versioning |
| Snapshot mechanism | `ApplicationReview.schemaId` pins the version used |
| Pass/fail cutoff | Per-program, per-stage `passThreshold` on `ScoringSchema` |
| Interview access | Soft gate, SuperAdmin can override |
| Finalist selection | Interview threshold alone |
| Recompute on weight change | Never automatic |
| Form placement | Shared component, two mounts per stage |

## Architecture

### Immutable rubric versioning

Saving the rubric no longer mutates the active schema. It deep-copies the whole tree into a new `ScoringSchema` row with `version = previous + 1` and `isActive = true`, and flips the previous row to `isActive = false`. Categories and criteria are never updated or deleted, only created as part of a new version.

Consequences:

- `ApplicationScoreItem.criterionId` can never dangle, because criteria are never deleted.
- The weight snapshot is structural rather than a JSON blob. `ApplicationReview.schemaId` already FKs to `ScoringSchema`, so a review permanently resolves the exact category names, criterion names, and weights it was scored under.
- History is a query, not a second table: `WHERE program_id = ? AND stage = ? ORDER BY version DESC`.
- Criterion ids differ across versions, so cross-version comparison is by `order` and `name`. This is acceptable; version diffing is a display concern, not a correctness one.

A new version is minted only when the submitted payload differs semantically from the active version (names, descriptions, weights, maxScore, order, and the set of rows). A no-op save returns the existing active version unchanged and does not increment.

Reads default to the active version. `GET /programs/:programId/scoring-rubrics` gains an optional `version` query param for history inspection.

### Schema changes

`ScoringSchema`:

- `version Int @default(1)`
- `createdById String? @db.Uuid`, FK to `Admin`, nullable because pre-existing rows have no known author
- `passThreshold Decimal @db.Decimal(5,2) @default(75)`
- `@@unique([programId, stage, version])`

`ApplicationReview`:

- `status` becomes enum `ReviewStatus { draft, submitted }`, replacing `VarChar(50)`
- `stage ScoringStage`, denormalized from the pinned schema so the unique constraint can be expressed and so per-stage queries avoid a join
- `overrideById String? @db.Uuid`, FK to `Admin`, set when a SuperAdmin bypasses the stage gate
- `overrideReason String? @db.Text`, free text, required by the API whenever `overrideById` is set
- `@@unique([applicationId, stage])`

`ScoreStatus` enum gains `finalist` and `not_selected`. Adding values is additive: `scoreStatus` is consumed as a list filter and an export column in `list-applications.handler.ts`, `export-applications.handler.ts`, and `applications.controller.ts`, all of which pass the value through without exhaustive matching. Every switch or map over `ScoreStatus` in the admin dashboard must still be audited for a missing-case fallthrough during implementation.

Migration steps, in order:

1. Add nullable columns with defaults.
2. Backfill `version = 1` for every existing `ScoringSchema`.
3. Backfill `passThreshold = 75` to match legacy behavior.
4. Create the `ReviewStatus` enum and cast `status` with an explicit `USING` clause, defaulting any unrecognized value to `draft`.
5. Add `finalist` and `not_selected` to `ScoreStatus`.
6. Backfill `ApplicationReview.stage` from each row's pinned schema.
7. Deduplicate any existing `ApplicationReview` rows sharing an `(applicationId, stage)` pair (keep the most recently updated) before adding the unique constraint. Expected to be a no-op since nothing writes these rows today, but the migration must not assume that.
8. Apply constraints.

Per the recurring VarChar overflow defect class in this codebase, every new string or decimal column is checked against its constraint before write. `totalScore` and `passThreshold` are `Decimal(5,2)`, so the maximum representable value is 999.99. Scores are bounded by `maxScore` per criterion and the weighted total cannot exceed 100 when weights are valid, but the write path rejects out-of-range values with a 400 rather than clamping them silently or letting Postgres raise 22001/22003 as an opaque 500.

The existing `ScoreStatus` value `scored` becomes unused. It is left in the enum rather than removed, since removing a Postgres enum value is disruptive and nothing depends on it being absent.

### Scoring API

New endpoints on the applications module, guarded by `JwtAuthGuard` + `RolesGuard`, roles `ADMIN` and `SUPER_ADMIN`.

Both endpoints take a required `stage` query param, `application` or `interview`.

`GET /applications/:applicationId/review?stage=`

Returns the existing review for that stage with its score items, or, when none exists, an empty review shaped against the currently active `ScoringSchema` for that program and stage. Response includes the resolved rubric (categories, criteria, weights, maxScore) so the client never needs a second call, plus the stage gate state described below. When no active rubric exists for that program and stage, returns a 409 with a message pointing the admin at the Rubric page rather than rendering an empty form. This is the expected state for the interview stage until a SuperAdmin authors an interview rubric.

`PUT /applications/:applicationId/review?stage=`

Body carries `status` (`draft` or `submitted`), optional `notes`, and `items: [{ criterionId, score, notes? }]`.

Behavior:

- Validates every `criterionId` belongs to the review's pinned schema, and every `score` is between 0 and that criterion's `maxScore`.
- Computes `totalScore = sum(score * criterionWeight * categoryWeight)` over all items. The formula is identical for both stages.
- On `submitted`, sets `completedAt`, applies that stage schema's `passThreshold`, and mirrors `totalScore` and the derived `scoreStatus` onto `ParticipantApplication.scoreTotal` / `scoreStatus`.
  - Application stage: at or above threshold becomes `go_to_interview`, below becomes `rejected`.
  - Interview stage: at or above threshold becomes `finalist`, below becomes `not_selected`.
- On `draft`, persists items and `totalScore` but leaves `ParticipantApplication` untouched.
- Runs in a single transaction.
- Is idempotent: re-submitting the same payload produces the same result.

`ParticipantApplication.scoreTotal` and `scoreStatus` hold the furthest stage reached, so an interview submission overwrites the application-stage values. Per-stage detail is never lost: each stage's `ApplicationReview` keeps its own `totalScore`, items, and pinned rubric version, and the UI reads stage detail from there rather than from the mirrored fields. The mirrored fields exist only to keep existing list, filter, sort, and export paths working without a join.

### Stage gating

Interview scoring is soft-gated. `GET` returns a `gate` object describing whether the application-stage review is submitted and whether it cleared its threshold.

- Gate open: the application-stage review is `submitted` and its total is at or above the application schema's `passThreshold`. The interview form renders normally.
- Gate closed: the form renders behind a warning explaining why, with the application total and threshold shown. An `ADMIN` sees the warning and cannot proceed.
- A `SUPER_ADMIN` sees an explicit override action that opens the form anyway. Using it records `overrideById` and `overrideReason` on the interview `ApplicationReview` so exceptions are auditable rather than invisible.

The gate is advisory on the server too: `PUT` for the interview stage rejects a closed gate with a 409 unless the caller is a `SUPER_ADMIN` and the review carries an override. The check is server-side, not merely a hidden button.

### Schema pinning

A review is created against whatever schema is active at creation time and stays on it. If the rubric is later versioned, the review keeps scoring against its original version. The UI surfaces a notice that a newer rubric version exists. Moving a review to the current version is an explicit admin action that discards existing items, never a silent migration.

### Existing dead review path

`ReviewApplicationDto` currently carries optional `scoreTotal`, `scoreBreakdown`, and `scoreStatus` fields on the `PATCH` review endpoint. No UI populates them; `submissions/page.tsx` sends only `status`, `reviewerNote`, and `approvalMode`. Those three scoring fields are removed from the DTO and command as part of this work, so `ParticipantApplication.scoreTotal` and `scoreStatus` have exactly one writer: the scoring API. Leaving a second, unvalidated write path into the same columns would let a caller set a total that contradicts the stored score items.

### Assessment form UI

One component, `AssessmentForm`, parameterized by `stage`, mounted in two places:

1. The Scores tab of `FullyFundedDetailsTabsCard`, replacing the current read-only Score Total and Status display. This keeps the reviewer next to the essays and profile. The tab shows both stages, application first, interview below it behind the gate.
2. A dedicated route `app/programs/[programId]/scoring/review/[applicationId]/page.tsx` for focused review sessions, with the stage selected by a `?stage=` search param so the URL is shareable.

Both mounts render the same component against the same hooks. The component owns no routing and no stage-selection logic beyond the prop.

Layout follows the screenshots: one table section per category, headed by the category name and its weight, with columns Component, Weight (%), Score. Rows are numbered per section as `A.1`, `A.2`, `B.1` and so on, derived from category order and criterion order rather than stored. Weight is read-only text. Score is a bounded numeric input.

Behavior:

- Weighted total recomputes live as the reviewer types, using the same formula as the server, so the displayed total always matches what will be persisted.
- A per-category subtotal is shown alongside the running grand total.
- Draft state saves explicitly. There is no autosave to localStorage. This is deliberate: a prior incident in this codebase had a stale client draft clobber server data wholesale, and scoring data is not worth repeating that.
- Submit is disabled until every criterion has a score.
- Once submitted, the form renders read-only with an explicit Reopen action that returns it to draft.
- Program id resolution goes through `useResolvedProgramId`, since the admin route param is a slug and program-scoped endpoints 500 on a slug.

### Rubric builder changes

- Server-side validation in `upsert-scoring-rubric.handler.ts`: category weights must sum to 1.0 and criteria weights within each category must sum to 1.0, both within a tolerance of 0.0001 for float representation. Violations return 400 with field-level errors, not a 500.
- Remove the "Scores will be normalized on computation" text. Replace the client warning with a blocking state that disables Save while sums are invalid, matching the server rule.
- Add a version history panel listing each version with its number, author, timestamp, and whether it is active, plus a read-only view of any past version.
- Surface a warning before saving when submitted reviews exist against the active version, explaining that existing reviews stay pinned to their version.

### Seed and backfill

Rewrite `seed-scoring.ts` as an idempotent backfill. For every program with no active `application` stage rubric, create version 1 with the values from the legacy forms:

Achievement and Experience, category weight 40 percent:

| Component | Weight |
|---|---|
| Project Experiences | 30% |
| Achievement | 40% |
| Leadership | 30% |

Essay Assessment, category weight 60 percent:

| Component | Weight |
|---|---|
| Topic Relevance to SDGs Themes | 30% |
| Argumentation, Innovation, and Creativity | 50% |
| Validity of Sources and References | 10% |
| Writing Format | 10% |

All criteria use `maxScore = 100`. `passThreshold = 75`, matching the legacy hardcoded cutoff. The script skips any program that already has an active rubric, prints a per-program summary of created versus skipped, and is safe to re-run against production.

No interview-stage rubric is seeded. The screenshots only document the application stage, and inventing interview criteria would put fabricated selection weights into production. Until a SuperAdmin authors one on the Rubric page, the interview form returns the 409 that points them there.

## Testing

Unit:

- Weighted total calculation, including zero weights, a single category, and rounding at two decimal places.
- Threshold logic at the boundary for both stages: exactly at `passThreshold` resolves to `go_to_interview` at the application stage and `finalist` at the interview stage.
- Gate evaluation: open only when the application review is submitted and at or above threshold; closed when it is draft, missing, or below threshold.
- Version diffing: identical payload produces no new version, any single field change produces one.
- Weight sum validation accepts 1.0 within tolerance and rejects 0.99 and 1.01.

Integration:

- `PUT` review with a `criterionId` from a different schema returns 400.
- `PUT` review with a score above `maxScore` returns 400.
- Submitting mirrors onto `ParticipantApplication`; saving a draft does not.
- Editing the rubric after a review is submitted leaves that review's resolved weights and total unchanged.
- Rubric upsert with unbalanced weights returns 400 and creates no version.
- Backfill script run twice creates rubrics once.
- Interview `PUT` on a closed gate returns 409 for an `ADMIN`.
- Interview `PUT` on a closed gate succeeds for a `SUPER_ADMIN` with an override reason, and is rejected without one.
- Both stage reviews coexist on one application; the unique constraint rejects a duplicate within a stage.
- Interview submission overwrites `ParticipantApplication.scoreStatus` with `finalist` while the application-stage `ApplicationReview` retains its own total and status.

E2E:

- Reviewer opens an application, scores every component, sees the live total, submits, and the participant list reflects the new total and status.
- SuperAdmin edits a weight, sees a new version in history, and confirms the previously submitted review still shows its original total.
- Full funnel: application scored above threshold, status becomes `go_to_interview`, interview form unlocks, interview scored above threshold, status becomes `finalist`, and the participant list can be filtered to finalists.

## Out of scope

- Multi-reviewer aggregation. The data model permits it later; this work stores exactly one review per application per stage.
- Automatic recomputation of existing scores when weights change. Reviews stay pinned to their version by design.
- Combined application-plus-interview weighted selection. Finalist is decided on the interview total alone; no cross-stage blending config is built.
- A seeded interview rubric. Interview criteria must be authored by a SuperAdmin.
- Participant-facing score visibility, and any notification on status change.
- Bulk scoring or bulk status transitions.
