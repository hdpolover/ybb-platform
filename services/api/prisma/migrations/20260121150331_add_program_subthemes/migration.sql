-- AlterTable
ALTER TABLE "programs" ADD COLUMN     "theme" VARCHAR(255);

-- CreateTable
CREATE TABLE "program_objectives" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "program_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_subthemes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "program_subthemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_category_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "version" VARCHAR(20) NOT NULL DEFAULT '1.0',
    "description" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "published_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "program_objectives_program_id_idx" ON "program_objectives"("program_id");

-- CreateIndex
CREATE INDEX "program_objectives_order_idx" ON "program_objectives"("order");

-- CreateIndex
CREATE INDEX "program_subthemes_program_id_idx" ON "program_subthemes"("program_id");

-- CreateIndex
CREATE INDEX "legal_documents_program_category_id_idx" ON "legal_documents"("program_category_id");

-- CreateIndex
CREATE INDEX "legal_documents_slug_idx" ON "legal_documents"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_program_category_id_slug_version_key" ON "legal_documents"("program_category_id", "slug", "version");

-- AddForeignKey
ALTER TABLE "program_objectives" ADD CONSTRAINT "program_objectives_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_subthemes" ADD CONSTRAINT "program_subthemes_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
