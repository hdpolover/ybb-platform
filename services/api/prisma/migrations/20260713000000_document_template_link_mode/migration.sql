ALTER TABLE "document_templates" ADD COLUMN "source_type" VARCHAR(20) NOT NULL DEFAULT 'upload';
ALTER TABLE "document_templates" ADD COLUMN "link_url" VARCHAR(500);
