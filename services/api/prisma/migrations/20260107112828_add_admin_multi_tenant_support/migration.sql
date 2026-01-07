-- CreateTable
CREATE TABLE "admin_program_categories" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "admin_id" UUID NOT NULL,
    "program_category_id" UUID NOT NULL,
    "role_in_brand" VARCHAR(50),
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,
    "legacy_id" INTEGER,

    CONSTRAINT "admin_program_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_program_categories_legacy_id_key" ON "admin_program_categories"("legacy_id");

-- CreateIndex
CREATE INDEX "admin_program_categories_admin_id_idx" ON "admin_program_categories"("admin_id");

-- CreateIndex
CREATE INDEX "admin_program_categories_program_category_id_idx" ON "admin_program_categories"("program_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_program_categories_admin_id_program_category_id_key" ON "admin_program_categories"("admin_id", "program_category_id");

-- AddForeignKey
ALTER TABLE "admin_program_categories" ADD CONSTRAINT "admin_program_categories_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_program_categories" ADD CONSTRAINT "admin_program_categories_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_awards" ADD CONSTRAINT "program_awards_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
