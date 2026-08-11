-- services/api/prisma/migrations/20260811000000_widen_scoring_weight_precision/migration.sql

-- ============================================================================
-- Why: scoring_categories.weight and scoring_criteria.weight are fractions in
-- [0, 1] (e.g. 0.3333 for "33.33%"), but the columns were declared
-- DECIMAL(5,2), which only keeps two digits after the decimal point. The
-- rubric builder UI offers a percent input with step=0.01, so an admin
-- splitting a category three ways (33.33 / 33.33 / 33.34) enters values that
-- validate client-side and server-side (both check the *fractions* sum to
-- 1.0 within tolerance), but truncate to 0.33 / 0.33 / 0.33 on write to
-- Postgres. The stored total then reads back as 99%, permanently failing
-- the weight-sum check and blocking Save, and any review scored against
-- that version tops out at 99 against a threshold that assumes 100.
--
-- Fix: widen both columns to DECIMAL(9,6), which keeps six digits after the
-- decimal point -- comfortably more precision than a percent input with two
-- decimal places can ever produce (0.0001 granularity vs. the 0.000001 this
-- affords), while (9,6) is nowhere near Postgres's numeric limits so there
-- is no realistic overflow risk for a value that must sit in [0, 1].
--
-- Safety: production has exactly one scoring_schemas row today (per the
-- Aug 10 versioning migration comments), so the two ALTER COLUMN TYPE
-- statements below rewrite at most a handful of scoring_categories /
-- scoring_criteria rows. Written as a plain ALTER COLUMN TYPE regardless,
-- so it stays correct and safe even after that row count grows: widening a
-- DECIMAL's precision/scale here is a lossless, non-truncating conversion
-- (every existing 5,2 value fits exactly in 9,6), so no USING clause,
-- backfill, or data loss risk is introduced by doing this generally rather
-- than special-casing "only one row".
-- ============================================================================

ALTER TABLE "scoring_categories" ALTER COLUMN "weight" TYPE DECIMAL(9, 6);
ALTER TABLE "scoring_criteria" ALTER COLUMN "weight" TYPE DECIMAL(9, 6);
