-- AlterColumn: file_size from INTEGER to BIGINT (supports files > 2GB)
ALTER TABLE "files" ALTER COLUMN "file_size" SET DATA TYPE BIGINT;

-- AddColumn: media library fields
ALTER TABLE "files" ADD COLUMN "program_id" VARCHAR(50);
ALTER TABLE "files" ADD COLUMN "asset_type" VARCHAR(50);
ALTER TABLE "files" ADD COLUMN "alt_text" VARCHAR(500);
ALTER TABLE "files" ADD COLUMN "title" VARCHAR(255);
ALTER TABLE "files" ADD COLUMN "width" INTEGER;
ALTER TABLE "files" ADD COLUMN "height" INTEGER;

-- AddConstraint: unique storage_path prevents S3 key collisions
ALTER TABLE "files" ADD CONSTRAINT "files_storage_path_key" UNIQUE ("storage_path");

-- CreateIndex: missing indexes for media library queries
CREATE INDEX "files_program_id_idx" ON "files"("program_id");
CREATE INDEX "files_brand_id_program_id_idx" ON "files"("brand_id", "program_id");
CREATE INDEX "files_is_deleted_idx" ON "files"("is_deleted");
