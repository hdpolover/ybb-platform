-- Migration: participant_document_loa_columns
-- Created: 2026-06-16
-- Adds LOA download tracking columns and loa_release_batch FK to participant_documents.
-- NOTE: download_count already exists from the init migration — not added here.

ALTER TABLE "participant_documents"
  ADD COLUMN IF NOT EXISTS "first_downloaded_at" TIMESTAMPTZ(6);

ALTER TABLE "participant_documents"
  ADD COLUMN IF NOT EXISTS "last_downloaded_at" TIMESTAMPTZ(6);

ALTER TABLE "participant_documents"
  ADD COLUMN IF NOT EXISTS "loa_release_batch_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'participant_documents_loa_release_batch_id_fkey'
      AND table_name = 'participant_documents'
  ) THEN
    ALTER TABLE "participant_documents"
      ADD CONSTRAINT "participant_documents_loa_release_batch_id_fkey"
      FOREIGN KEY ("loa_release_batch_id")
      REFERENCES "loa_release_batches"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
