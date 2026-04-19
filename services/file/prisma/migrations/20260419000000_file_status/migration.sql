-- AddColumn: upload lifecycle status.
-- Existing rows were uploaded through the multipart API path, so they are already on storage: backfill to READY.
-- New inserts default to PROCESSING so the presigned-URL flow must explicitly mark files ready.
ALTER TABLE "files" ADD COLUMN "status" VARCHAR(20) NOT NULL DEFAULT 'READY';
ALTER TABLE "files" ALTER COLUMN "status" SET DEFAULT 'PROCESSING';

-- CreateIndex: filter by status for media library / admin views
CREATE INDEX "files_status_idx" ON "files"("status");
