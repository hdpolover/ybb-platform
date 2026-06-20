ALTER TABLE "program_resources" ADD COLUMN "source_type" VARCHAR(20) NOT NULL DEFAULT 'upload';
ALTER TABLE "program_resources" ADD COLUMN "link_url" VARCHAR(500);
ALTER TABLE "program_resources" ALTER COLUMN "file_url" DROP NOT NULL;
