-- AlterTable
ALTER TABLE "application_form_fields" ADD COLUMN     "source" VARCHAR(16) NOT NULL DEFAULT 'custom',
ADD COLUMN     "system_field_key" VARCHAR(64);

-- CreateTable
CREATE TABLE "system_form_field_definitions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "key" VARCHAR(64) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "category" VARCHAR(32) NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "default_options" JSON DEFAULT '[]',
    "validation_rules" JSON DEFAULT '{}',
    "help_text" TEXT,
    "placeholder" VARCHAR(255),
    "is_magic" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "system_form_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_form_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(64),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "application_form_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_form_template_fields" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "template_id" UUID NOT NULL,
    "source" VARCHAR(16) NOT NULL,
    "system_field_key" VARCHAR(64),
    "name" VARCHAR(100),
    "label" VARCHAR(255),
    "type" VARCHAR(50),
    "placeholder" VARCHAR(255),
    "help_text" TEXT,
    "options" JSON DEFAULT '[]',
    "validation_rules" JSON DEFAULT '{}',
    "section" VARCHAR(50) NOT NULL DEFAULT 'personal_details',
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "label_override" VARCHAR(255),
    "help_text_override" TEXT,

    CONSTRAINT "application_form_template_fields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_form_field_definitions_key_key" ON "system_form_field_definitions"("key");

-- CreateIndex
CREATE INDEX "system_form_field_definitions_category_idx" ON "system_form_field_definitions"("category");

-- CreateIndex
CREATE INDEX "system_form_field_definitions_is_active_idx" ON "system_form_field_definitions"("is_active");

-- CreateIndex
CREATE INDEX "application_form_templates_category_idx" ON "application_form_templates"("category");

-- CreateIndex
CREATE INDEX "application_form_template_fields_template_id_idx" ON "application_form_template_fields"("template_id");

-- CreateIndex
CREATE INDEX "application_form_fields_source_idx" ON "application_form_fields"("source");

-- CreateIndex
CREATE UNIQUE INDEX "application_form_fields_program_name_uq" ON "application_form_fields" ("program_id", "name") WHERE "deleted_at" IS NULL;

-- AddForeignKey
ALTER TABLE "application_form_template_fields" ADD CONSTRAINT "application_form_template_fields_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "application_form_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

