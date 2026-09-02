-- Admin application list (ApplicationRepository.buildOrderBy) sorts by
-- created_at under a program_id + deleted_at IS NULL filter. The existing
-- partial indexes cover (program_id, updated_at) and (program_id, status,
-- submission_date); the created_at sort had no matching index.

CREATE INDEX IF NOT EXISTS "idx_apps_program_created_active"
ON "participant_applications" ("program_id", "created_at" DESC)
WHERE "deleted_at" IS NULL;
