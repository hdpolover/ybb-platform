-- Hot-path read indexes for applications list and dashboard queries.
-- Safe for repeated deploy attempts.

CREATE INDEX IF NOT EXISTS "idx_apps_program_updated_active"
ON "participant_applications" ("program_id", "updated_at" DESC)
WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_apps_program_status_updated_active"
ON "participant_applications" ("program_id", "status", "updated_at" DESC)
WHERE "deleted_at" IS NULL;
