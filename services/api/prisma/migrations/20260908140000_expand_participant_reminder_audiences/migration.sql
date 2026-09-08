-- Migration: expand_participant_reminder_audiences
-- Created: 2026-09-08
-- Additive and idempotent only. Migrations auto-run on API boot in
-- production, so this must be safe to replay.
--
-- Adds two audiences to participant_reminders.audience alongside the
-- original registration_fee_unpaid:
--   - application_draft_unsubmitted: paid the registration fee, never
--     submitted the application.
--   - program_fee_unpaid: submitted the application, programme fee unpaid.
-- See REMINDER_AUDIENCES / ApplicationDraftUnsubmittedAudienceService /
-- ProgramFeeUnpaidAudienceService.
--
-- A CHECK constraint can't be widened with ADD VALUE the way an enum can, so
-- this drops and re-adds it. Re-running this migration always ends with the
-- same three-value constraint in place, so the drop-then-add is safe to
-- replay on every boot.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'participant_reminders_audience_check'
      AND table_name = 'participant_reminders'
  ) THEN
    ALTER TABLE "participant_reminders" DROP CONSTRAINT "participant_reminders_audience_check";
  END IF;

  ALTER TABLE "participant_reminders"
    ADD CONSTRAINT "participant_reminders_audience_check"
    CHECK ("audience" IN ('registration_fee_unpaid', 'application_draft_unsubmitted', 'program_fee_unpaid'));
END $$;
