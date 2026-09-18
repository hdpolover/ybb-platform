-- Migration: add_document_review_fields
-- Created: 2026-09-18
--
-- Phase 1 of the agreement letter review workflow. participant_documents.
-- submission_status is a VARCHAR(50), not a DB enum (confirmed against
-- prisma/schema/applications.prisma), so no enum ALTER is needed to add the
-- approved/rejected/revision_requested values -- the application layer is
-- the only place that enforces the allowed set. Existing rows are untouched
-- and keep their current 'not_required' / 'uploaded' values.
--
-- signed_copy_uploaded_at is intentionally left NULL for the 285 existing
-- 'uploaded' rows: the real upload timestamp is not recoverable, and
-- inventing one (e.g. generated_at) would misrepresent it as known.
--
-- Idempotent (IF NOT EXISTS / guarded constraint add) so a retried boot
-- cannot fail if this migration partially applied before.

ALTER TABLE "participant_documents"
  ADD COLUMN IF NOT EXISTS "signed_copy_uploaded_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "reviewed_by" UUID,
  ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMPTZ(6);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'participant_documents_reviewed_by_fkey'
      AND table_name = 'participant_documents'
  ) THEN
    ALTER TABLE "participant_documents"
      ADD CONSTRAINT "participant_documents_reviewed_by_fkey"
      FOREIGN KEY ("reviewed_by")
      REFERENCES "admins"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
