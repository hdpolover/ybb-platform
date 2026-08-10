-- services/api/prisma/migrations/20260810120000_scoring_versioning_and_review_status/migration.sql

-- ============================================================================
-- Step 1: Add new columns nullable / with defaults (safe on a live table).
-- ============================================================================
ALTER TABLE "scoring_schemas" ADD COLUMN "version" INTEGER;
ALTER TABLE "scoring_schemas" ADD COLUMN "created_by_id" UUID;
ALTER TABLE "scoring_schemas" ADD COLUMN "pass_threshold" DECIMAL(5,2);

ALTER TABLE "application_reviews" ADD COLUMN "override_by_id" UUID;
ALTER TABLE "application_reviews" ADD COLUMN "override_reason" TEXT;

-- ============================================================================
-- Step 2: Backfill version for every existing ScoringSchema row, ranked by
-- creation order within each (program_id, stage) group rather than a blanket
-- version = 1. This matters because, before this migration, nothing in the
-- database enforced uniqueness on (program_id, stage) at all -- there was no
-- index or constraint of any kind on that pair, partial or otherwise. So a
-- program can legally have more than one scoring_schemas row (e.g. a
-- soft-deleted schema and an active schema) sharing the same
-- (program_id, stage). The new @@unique([programId, stage, version])
-- constraint added in step 8 has no deleted_at filter, so a blanket
-- version = 1 would put both rows on the same (program_id, stage, 1) tuple
-- and the constraint creation would fail (confirmed against real duplicate
-- data during development of this migration).
--
-- Ranking by created_at gives the oldest schema version 1 and each later
-- one an incrementing version, which is also the semantically correct
-- reading of "version": a soft-deleted schema becomes "version 1,
-- superseded by version 2" rather than colliding with it. No row is
-- deleted here, unlike the application_reviews dedup in step 7. That
-- difference is deliberate: application_reviews has a genuine
-- one-per-(application, stage) business rule, so duplicates there are
-- errors to be resolved by keeping the most recent. scoring_schemas is an
-- append-only version chain, so every row is legitimate and must be kept,
-- just assigned a version number that does not collide.
--
-- Forward-looking consequence for callers (e.g. the Task 3 repository):
-- because soft-deleted schemas permanently occupy a version number under
-- this constraint, computing "next version" for a new schema must use
-- MAX(version) + 1 across ALL rows for the (programId, stage) pair,
-- including soft-deleted ones. Deriving it from only the active row, or
-- from a count of active rows, will eventually collide with a retired
-- version number and throw a unique violation.
-- ============================================================================
UPDATE "scoring_schemas" ss
SET "version" = ranked."rn"
FROM (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "program_id", "stage"
    ORDER BY "created_at" ASC, "id" ASC
  ) AS "rn"
  FROM "scoring_schemas"
) ranked
WHERE ss."id" = ranked."id";

ALTER TABLE "scoring_schemas" ALTER COLUMN "version" SET NOT NULL;
ALTER TABLE "scoring_schemas" ALTER COLUMN "version" SET DEFAULT 1;

-- ============================================================================
-- Step 3: Backfill passThreshold = 75 to match the legacy hardcoded cutoff.
-- ============================================================================
UPDATE "scoring_schemas" SET "pass_threshold" = 75 WHERE "pass_threshold" IS NULL;
ALTER TABLE "scoring_schemas" ALTER COLUMN "pass_threshold" SET NOT NULL;
ALTER TABLE "scoring_schemas" ALTER COLUMN "pass_threshold" SET DEFAULT 75;

-- created_by_id stays nullable: pre-existing rows have no known author.
ALTER TABLE "scoring_schemas"
  ADD CONSTRAINT "scoring_schemas_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "application_reviews"
  ADD CONSTRAINT "application_reviews_override_by_id_fkey"
  FOREIGN KEY ("override_by_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Step 4: Create the ReviewStatus enum and cast application_reviews.status,
-- with an explicit USING clause defaulting any unrecognized value to 'draft'.
-- The column was VARCHAR(50) holding only 'draft'/'submitted' in practice,
-- but the USING clause guards against any stray/legacy value blowing up the
-- cast instead of failing the whole migration.
-- ============================================================================
CREATE TYPE "ReviewStatus" AS ENUM ('draft', 'submitted');

ALTER TABLE "application_reviews" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "application_reviews"
  ALTER COLUMN "status" TYPE "ReviewStatus"
  USING (
    CASE
      WHEN "status" IN ('draft', 'submitted') THEN "status"::"ReviewStatus"
      ELSE 'draft'::"ReviewStatus"
    END
  );
ALTER TABLE "application_reviews" ALTER COLUMN "status" SET DEFAULT 'draft';

-- ============================================================================
-- Step 5: Add finalist and not_selected to ScoreStatus. Additive only --
-- 'scored' stays in the enum unused rather than being removed.
-- ============================================================================
ALTER TYPE "ScoreStatus" ADD VALUE IF NOT EXISTS 'finalist';
ALTER TYPE "ScoreStatus" ADD VALUE IF NOT EXISTS 'not_selected';

-- ============================================================================
-- Step 6: Backfill ApplicationReview.stage from its pinned schema. Add the
-- column nullable first so the backfill has somewhere to write, then
-- tighten to NOT NULL once every row is populated.
-- ============================================================================
ALTER TABLE "application_reviews" ADD COLUMN "stage" "ScoringStage";

UPDATE "application_reviews" ar
SET "stage" = ss."stage"
FROM "scoring_schemas" ss
WHERE ar."schema_id" = ss."id";

ALTER TABLE "application_reviews" ALTER COLUMN "stage" SET NOT NULL;

-- ============================================================================
-- Step 7: Deduplicate any existing ApplicationReview rows sharing
-- (application_id, stage), keeping the most recently updated. The table has
-- no updated_at column, so "most recently updated" is approximated as
-- COALESCE(completed_at, started_at) DESC, with id DESC as a final tiebreak
-- for exact ties. Expected to delete zero rows in practice (design doc:
-- nothing writes these rows today) but the migration must not assume that.
-- ============================================================================
DELETE FROM "application_reviews" ar
USING (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "application_id", "stage"
      ORDER BY COALESCE("completed_at", "started_at") DESC, "id" DESC
    ) AS rn
  FROM "application_reviews"
) ranked
WHERE ar."id" = ranked."id" AND ranked."rn" > 1;

-- ============================================================================
-- Step 8: Apply constraints, now that the data satisfies them.
-- ============================================================================

-- Defensive cleanup only: no index with this name has ever existed in this
-- schema (verified against pg_indexes and against the rest of the repo), so
-- this is a no-op today. Kept in case a differently-named partial index was
-- ever added out-of-band in some environment; DROP INDEX IF EXISTS is safe
-- either way.
DROP INDEX IF EXISTS "scoring_schemas_program_id_stage_active_uidx";

ALTER TABLE "scoring_schemas"
  ADD CONSTRAINT "scoring_schemas_program_id_stage_version_key"
  UNIQUE ("program_id", "stage", "version");

ALTER TABLE "application_reviews"
  ADD CONSTRAINT "application_reviews_application_id_stage_key"
  UNIQUE ("application_id", "stage");

-- ============================================================================
-- Step 9: Enforce "at most one active, non-deleted schema per
-- (program_id, stage)". Nothing enforced this before this migration (see
-- step 2's comment), and it is no longer tolerable now: the versioned
-- upsert (Task 3) and the review GET handler (Task 7) both need to resolve
-- "the active schema" for a (program, stage) pair, and two active rows make
-- that resolution undefined and order-dependent.
--
-- Guard first: deactivate all but the most recently created row among any
-- (program_id, stage) group that currently has more than one row with
-- is_active AND deleted_at IS NULL. Do not assume the data is already
-- clean -- that exact assumption is what failed for the version backfill
-- in step 2, on real duplicate data found in this same table.
-- ============================================================================
UPDATE "scoring_schemas" ss
SET "is_active" = false
FROM (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "program_id", "stage"
      ORDER BY "created_at" DESC, "id" DESC
    ) AS "rn"
  FROM "scoring_schemas"
  WHERE "is_active" AND "deleted_at" IS NULL
) ranked
WHERE ss."id" = ranked."id"
  AND ranked."rn" > 1;

-- Consequence for callers (Task 3 in particular): because this index has no
-- version filter, minting a new version for a (program_id, stage) pair MUST,
-- in the same transaction, set the currently active row's is_active = false
-- BEFORE inserting the new active row. Inserting the new active row first
-- (or in a separate transaction) will violate this index.
CREATE UNIQUE INDEX "scoring_schemas_one_active_per_program_stage_uidx"
  ON "scoring_schemas" ("program_id", "stage")
  WHERE "is_active" AND "deleted_at" IS NULL;
