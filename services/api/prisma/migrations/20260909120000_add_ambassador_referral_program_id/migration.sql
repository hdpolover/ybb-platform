-- Migration: add_ambassador_referral_program_id
-- Created: 2026-09-09
--
-- Model change: an ambassador holds ONE referral code per brand (already
-- enforced — Ambassador.userId is unique and users are per-brand), but
-- attribution today is derived indirectly through ambassador_referrals ->
-- ambassadors.program_id, so a code can only ever credit the ambassador's
-- own "home" programme. That means the same MEYS ambassador's code cannot
-- advance both a MEYS 6th and a MEYS 7th applicant, even though it is the
-- same brand-wide code. This migration makes attribution direct: each
-- referral row now records the programme the participant actually applied
-- to. ambassadors.program_id is untouched and keeps its role as the
-- ambassador's home/origin programme for display and backwards
-- compatibility only — it is no longer read for attribution.
--
-- Backfill safety (verified against prod 2026-09-09): 912 referral rows,
-- zero of which have an ambassador with a null program_id, so
-- program_id = ambassador.program_id is an unambiguous backfill for every
-- existing row and the column can go NOT NULL in the same migration.
--
-- Uniqueness change: the old (ambassador_id, participant_id) unique index
-- assumed one referral per participant ever. Under the new model the same
-- ambassador's single code can legitimately produce two referral rows for
-- the same participant — one per programme applied to — so that index is
-- replaced with (participant_id, program_id), which is what "one referral
-- per participant per programme" actually means. Verified against prod:
-- zero participants currently have more than one referral row, so the new
-- index builds cleanly.
--
-- Idempotent shape throughout (IF NOT EXISTS / guarded constraint add) so a
-- retried boot cannot fail if this migration partially applied before.

ALTER TABLE "ambassador_referrals"
  ADD COLUMN IF NOT EXISTS "program_id" UUID;

UPDATE "ambassador_referrals" ar
SET "program_id" = a."program_id"
FROM "ambassadors" a
WHERE a."id" = ar."ambassador_id"
  AND ar."program_id" IS NULL;

ALTER TABLE "ambassador_referrals"
  ALTER COLUMN "program_id" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ambassador_referrals_program_id_fkey'
      AND table_name = 'ambassador_referrals'
  ) THEN
    ALTER TABLE "ambassador_referrals"
      ADD CONSTRAINT "ambassador_referrals_program_id_fkey"
      FOREIGN KEY ("program_id")
      REFERENCES "programs"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ambassador_referrals_program_id_idx"
  ON "ambassador_referrals" ("program_id");

-- Replace the old per-participant-ever uniqueness with per-participant-per-
-- programme uniqueness (see rationale above).
DROP INDEX IF EXISTS "ambassador_referrals_ambassador_id_participant_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "ambassador_referrals_participant_id_program_id_key"
  ON "ambassador_referrals" ("participant_id", "program_id");
