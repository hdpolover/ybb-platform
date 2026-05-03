-- Phase 4: Improve application search performance for ILIKE/contains filters.
-- The repository filters search participants.full_name and users.email with
-- case-insensitive contains; pg_trgm-backed GIN indexes accelerate those paths.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "idx_participants_full_name_trgm_active"
ON "participants" USING gin ("full_name" gin_trgm_ops)
WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_users_email_trgm_active"
ON "users" USING gin ("email" gin_trgm_ops)
WHERE "deleted_at" IS NULL;
