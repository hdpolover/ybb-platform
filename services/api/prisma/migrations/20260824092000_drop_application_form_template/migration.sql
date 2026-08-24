-- prisma/migrations/20260824092000_drop_application_form_template/migration.sql

-- Why: application_form_template_fields / application_form_templates are
-- fully superseded by content_templates as of the previous migration in this
-- same deploy. Child table dropped first (FK to the parent).
DROP TABLE IF EXISTS "application_form_template_fields";
DROP TABLE IF EXISTS "application_form_templates";
