-- Lock down document templates by default: newly created rows that omit
-- audience_type now default to "submitted_and_paid" instead of the
-- permissive "all_registered". Existing rows are untouched — this only
-- changes the column default applied to future INSERTs.
ALTER TABLE "document_templates" ALTER COLUMN "audience_type" SET DEFAULT 'submitted_and_paid';
