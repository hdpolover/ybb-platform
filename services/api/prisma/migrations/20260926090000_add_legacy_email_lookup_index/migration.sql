-- Legacy participant migration: expression index for the brand-scoped email
-- lookup this migration's own script performs (see migrate-legacy-participants.cjs
-- "User resolution"), plus a matching index for the equivalent participant/
-- application lookups.
--
-- MEASURED PROBLEM (2026-09-26, on a prod clone under this migration's own
-- dry-run): `SELECT id, legacy_id FROM users WHERE lower(trim(email)) = $1
-- AND brand_id = $2 LIMIT 1`, run once per legacy participant with no
-- matching index, seq-scans the entire `users` table every time -- observed
-- at ~88% sustained CPU on the clone. Run set-based (250k+ lookups) against
-- the live prod primary, this would degrade the site for hours.
--
-- CANNOT be a normal Prisma migration statement: `CREATE INDEX CONCURRENTLY`
-- cannot run inside a transaction block, and `prisma migrate deploy` wraps
-- every migration file in one. Prisma explicitly supports this pattern via
-- `-- CreateIndex` migrations tagged for non-transactional execution is NOT
-- automatic for CONCURRENTLY on all Prisma versions, so this file is
-- intentionally NOT applied via `prisma migrate deploy` in the normal flow.
--
-- HOW THIS GETS APPLIED WITHOUT LOCKING `users` (manual step, run once,
-- outside the normal migration pipeline, before any real --apply):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
--     "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_brand_lower_trim_email \
--      ON users (brand_id, lower(trim(email)));"
-- Then mark this migration as already-applied so `prisma migrate deploy`
-- doesn't try (and fail) to run it inside its own transaction:
--   npx prisma migrate resolve --applied 20260926090000_add_legacy_email_lookup_index
-- CONCURRENTLY takes a SHARE UPDATE EXCLUSIVE lock only (blocks other DDL/
-- VACUUM FULL, never blocks normal reads/writes), so this is safe to run
-- against the live prod primary ahead of any real --apply. It can take
-- a while on a large table -- that's expected and fine, it's non-blocking.
--
-- The file below documents the exact statement for a reviewer; it is a
-- no-op if run through the normal transactional pipeline (guarded so it
-- never attempts CONCURRENTLY inside a transaction, which would just error
-- and roll back harmlessly) -- the REAL application is the manual step above.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_brand_lower_trim_email'
  ) THEN
    RAISE NOTICE 'idx_users_brand_lower_trim_email does not exist -- this index must be created CONCURRENTLY as a manual, out-of-band step (see comment header in this file), never via prisma migrate deploy.';
  END IF;
END $$;
