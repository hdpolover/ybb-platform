-- services/api/prisma/migrations/20260823150000_add_participation_category_deleted_at/migration.sql

-- Why: ProgramParticipationCategory was the only content model without a
-- deleted_at column, so both the participation-categories copier (this
-- plan) and the existing single-row delete handler had to hard DELETE
-- instead of soft-deleting like every sibling table (program_faqs,
-- program_timeline, program_schedules, application_form_fields). A hard
-- delete against a category still referenced by
-- participant_applications.participation_category_id (FK with no onDelete
-- clause) fails at the database with a raw constraint violation instead of
-- a clear application error. Adding deleted_at lets both paths soft-delete
-- uniformly; the application-level guard added alongside this migration
-- turns that raw Postgres error into a clear 409 before it can happen.
ALTER TABLE "program_participation_categories"
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
