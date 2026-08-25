-- services/api/prisma/migrations/20260824090000_add_content_template/migration.sql

-- Why: one generic template store replaces the form-field-specific
-- application_form_templates / application_form_template_fields pair, so
-- every content-copy surface (not just form fields) can save/apply a
-- template through the same ProgramCopier.exportTemplate/applyTemplate path.
-- The old tables are migrated into this one and dropped in a later migration
-- (20260824091000_backfill_content_template_from_form_templates,
-- 20260824092000_drop_application_form_template) once app code has fully
-- moved over — this migration only adds the new table.
CREATE TABLE "content_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "entity_type" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "payload_version" INTEGER NOT NULL DEFAULT 1,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "content_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "content_templates_entity_type_deleted_at_idx" ON "content_templates"("entity_type", "deleted_at");
