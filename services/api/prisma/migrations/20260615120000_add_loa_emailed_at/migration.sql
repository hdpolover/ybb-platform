-- Add emailedAt column to participant_documents
ALTER TABLE "participant_documents"
  ADD COLUMN IF NOT EXISTS "emailed_at" TIMESTAMPTZ(6);
