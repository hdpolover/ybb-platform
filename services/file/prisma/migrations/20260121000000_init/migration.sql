-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "file_type" VARCHAR(50) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "bucket" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "brand_id" VARCHAR(50) NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "document_type" VARCHAR(50),
    "generated" BOOLEAN NOT NULL DEFAULT false,
    "template_id" VARCHAR(36),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "files_user_id_idx" ON "files"("user_id");

-- CreateIndex
CREATE INDEX "files_brand_id_idx" ON "files"("brand_id");
