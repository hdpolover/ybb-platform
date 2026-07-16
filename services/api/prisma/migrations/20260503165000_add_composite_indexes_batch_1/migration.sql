-- PR #8: Database index batch 1 (highest-impact composite indexes)
-- Notes:
-- - Keep index creation idempotent for safe repeated deployments.
-- - Use partial indexes for participant_applications to prioritize active rows.

CREATE INDEX IF NOT EXISTS "idx_apps_program_status_submitted_active"
ON "participant_applications" ("program_id", "status", "submission_date" DESC)
WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_apps_program_category_submitted_active"
ON "participant_applications" ("program_id", "application_category", "submission_date" DESC)
WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_programs_brand_visibility_lifecycle"
ON "programs" (
  "brand_id",
  "is_published",
  "is_visible_to_users",
  "deleted_at",
  "year" DESC,
  "created_at" DESC
);

CREATE INDEX IF NOT EXISTS "idx_users_brand_deleted_created"
ON "users" ("brand_id", "deleted_at", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_invoices_external_intent_status"
ON "application_invoices" ("external_intent_id", "status");
