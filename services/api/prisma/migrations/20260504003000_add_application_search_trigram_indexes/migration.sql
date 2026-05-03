-- Phase 4: Improve application search performance for ILIKE/contains filters.
-- The repository filters search participants.full_name and users.email with
-- case-insensitive contains; pg_trgm-backed GIN indexes accelerate those paths.
--
-- NOTE: The Prisma migration role must have CREATE EXTENSION privileges (or pg_trgm
-- must be pre-installed by a superuser / via DB bootstrap / infra provisioning)
-- before this migration is applied.  On managed services (e.g. AWS RDS, Supabase)
-- the extension is usually already available; run
--   CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- as a superuser if the migration role lacks that privilege.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Full (non-partial) indexes are used here because the application search queries
-- filter via nested Prisma `where` clauses (OR conditions) that do not carry a
-- `deleted_at IS NULL` predicate on the relation side.  Postgres only considers a
-- partial index when the query's WHERE clause implies the index predicate, so
-- partial indexes on deleted_at IS NULL would be silently ignored by the planner.
CREATE INDEX IF NOT EXISTS "idx_participants_full_name_trgm"
ON "participants" USING gin ("full_name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_users_email_trgm"
ON "users" USING gin ("email" gin_trgm_ops);
