-- Add audience fields to document_templates
ALTER TABLE "document_templates"
  ADD COLUMN "audience_type" VARCHAR(50) NOT NULL DEFAULT 'all_registered',
  ADD COLUMN "audience_config" JSON NOT NULL DEFAULT '{}';

-- Add signed-copy fields to participant_documents
ALTER TABLE "participant_documents"
  ADD COLUMN "signed_copy_url" VARCHAR(500),
  ADD COLUMN "submission_status" VARCHAR(50) NOT NULL DEFAULT 'not_required',
  ADD COLUMN "submission_note" TEXT;

-- Add new enum value
ALTER TYPE "DocumentTemplateType" ADD VALUE IF NOT EXISTS 'complementary_document';
