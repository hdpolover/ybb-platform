-- Add viewedAt column to participant_documents
ALTER TABLE "participant_documents" ADD COLUMN IF NOT EXISTS "viewed_at" TIMESTAMPTZ(6);
