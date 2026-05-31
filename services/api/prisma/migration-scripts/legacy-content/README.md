# Legacy content migration

One-off ETL that brings **past-program content** (brands, program editions, FAQs, speakers,
awards, news/announcements, schedules, gallery, testimonials) from the legacy CodeIgniter
MySQL database into this Postgres platform, then re-homes the referenced media into the file
service. Design rationale and full decisions: `docs/superpowers/plans/2026-05-31-legacy-content-migration.md`.

These scripts are plain Node (`.cjs`, raw SQL via `pg`) on purpose: they run **inside the API
container** without regenerating the live Prisma client. All writes are idempotent (upsert on a
`legacy_id` anchor), so every script is safe to re-run.

## Scripts

| Script | Purpose |
|---|---|
| `migrate-legacy-content.cjs` | Phase A. Brands, programs (create vs ignore per `PROGRAM_IGNORE`), all per-program + brand-level content, history-stub programs for orphan photo years. |
| `rehome-legacy-assets.cjs` | Phase B. Downloads `storage.ybbfoundation.com` assets, re-uploads to the file service, rewrites URLs. |
| `backfill-ignored-announcements.cjs` | Migrates news from the ignored editions (news is brand-level) onto each brand's current published program. |

## Environment

```
DATABASE_URL=postgresql://...@postgres-api:5432/ybb_platform_db   # target Postgres
LEGACY_DB_HOST= LEGACY_DB_PORT=3306 LEGACY_DB_USER= LEGACY_DB_PASSWORD= LEGACY_DB_NAME=   # legacy MySQL (read-only)
# Phase B only:
FILE_SERVICE_URL= FILE_SERVICE_INTERNAL_KEY=
SYSTEM_USER_ID=                 # user the migrated uploads are attributed to
ASSET_BUCKET_PREFIX=            # set to e.g. "dryrun-" to isolate dry-run uploads; empty for real runs
```

> Do NOT set `PG_REWRITE_LOCALHOST` when running in-container (`postgres-api:5432` is correct there).

## Running (in-container, per `reference_prod_access`)

```bash
docker cp migrate-legacy-content.cjs <api-container>:/tmp/
docker exec -e NODE_PATH=/app/node_modules -e DATABASE_URL=... -e LEGACY_DB_... \
  -w /tmp <api-container> node /tmp/migrate-legacy-content.cjs
```

## Safety

- Always `pg_dump -Fc` the target DB first.
- Dry-run on a restored scratch DB before prod; set `ASSET_BUCKET_PREFIX=dryrun-` for Phase B so uploads are isolated and purgeable.
- The new DB is authoritative: editions already present there are listed in `PROGRAM_IGNORE` and never duplicated.
