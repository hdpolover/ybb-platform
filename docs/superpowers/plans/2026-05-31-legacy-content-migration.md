# Legacy Content Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate past-program *content* (brands, past program editions, photos, speakers, testimonials, news/announcements, FAQs, schedules, awards) from the legacy CodeIgniter MySQL database into the new Postgres/Prisma platform so the new public site shows program history (MEYS, IYS, etc.), then re-home the referenced media into the new file service.

**Architecture:** A typed, idempotent, direct DB-to-DB ETL. A read-only `mysql2` connection streams legacy rows; pure mapper functions transform them; Prisma `upsert` writes them to Postgres keyed on a `legacy_id` anchor column so the script is safe to re-run as the old site keeps producing content. Asset re-homing is a **separate second pass** (Phase B): content first goes live referencing the existing `storage.ybbfoundation.com` URLs, then a re-homing pass downloads each asset and re-uploads it to the new file service, rewriting the stored URL. This separation lets history go live immediately and makes the slow/risky asset copy independently retryable.

**De-duplication (CRITICAL):** The live new DB already contains admin-curated brands, programs, and content that carry NO `legacy_id`, and **the new DB is authoritative** for anything that exists there. A `legacy_id`-only upsert would duplicate it. Three safeguards prevent this: (1) brands match an existing row by normalized name; an existing brand is only *anchored* (its `legacy_id` set) and has empty fields backfilled, never its curated values overwritten; (2) a reviewed `program-mapping.json` (proposal generated, human-confirmed) marks each legacy program `create` or `ignore`. A legacy program that already exists in the new DB is `ignore`d — not created, not merged, not anchored — and is left entirely to the admins; (3) because ignored programs never enter the in-memory program map, every content stage skips their FAQs/speakers/gallery/etc. automatically, and gallery photos attach only on an exact (brand, year) match so a photo for an ignored year is dropped rather than mis-filed. Brands with admin-entered testimonials are also skipped. Net effect: only the historical editions absent from the new DB get created and populated; everything already curated is untouched.

**Tech Stack:** TypeScript, `ts-node`, Prisma 7 (`@prisma/adapter-pg` + `pg`), `mysql2`, `axios`, `form-data`, Jest for unit tests.

---

## Implementation note (as-built, 2026-05-31)

The executable migration is driven by **raw parameterized SQL via `pg`**, not the Prisma-based stage code below, so it can run inside the prod API container without regenerating the live Prisma client. The runnable scripts are:
- `services/api/prisma/migration-scripts/legacy-content/migrate-legacy-content.cjs` (Phase A)
- `services/api/prisma/migration-scripts/legacy-content/rehome-legacy-assets.cjs` (Phase B)

The Prisma/TS stages below remain the design reference; the `.cjs` files are the source of truth for what actually runs. Behaviours refined during the dry run: (1) dedup only treats `legacy_id IS NULL` programs as admin matches (so re-runs don't ignore our own created rows); (2) same-named program editions within a brand get human-friendly slugs ordered by start date (earliest = base slug, then `-2`, `-3`), instead of a legacy-id suffix; (3) announcement (news) slugs are REGENERATED from the title with deterministic global uniqueness — the legacy slugs are unusable (mangled with missing leading letters, plus duplicates and nulls) and there is no old-site SEO to preserve. Validated by a full dry run on a VPS scratch DB.

## Scope

**In scope (content only — confirmed with stakeholder):**

| Legacy table | New model | Key | Notes |
|---|---|---|---|
| `program_categories` (7) | `Brand` | `program_category_id` | The summit families (IYS, MEYS = Middle East Youth Summit, etc.) |
| `programs` (~18) | `Program` | `id` | Yearly editions; `program_category_id` → brand |
| `program_faqs` (~324) | `ProgramFaq` | `id` | enum remap |
| `program_speakers` (~24) | `ProgramSpeaker` | `id` | |
| `program_awards` (~31) | `ProgramAward` | `id` | already has `legacy_id` |
| `program_announcements` (~245) | `ProgramAnnouncement` | `id` | the "news" |
| `program_schedules` (~185) | `ProgramSchedule` | `id` | |
| `program_rundowns` (~127) | `ProgramSchedule` | `id + RUNDOWN_OFFSET` | offset avoids legacy_id collision |
| `program_photos` (~77) | `ProgramGallery` | `id` | keyed by `(category, year)`; ~66% are for years with no `programs` row, so a "history" Program stub is auto-created per orphan `(brand, year)` |
| `program_testimonies` (~47) | `ProgramTestimonial` | `id` | brand-level, `type=text` |
| `program_video_testimonies` (~2) | `ProgramTestimonial` | `id + VIDEO_OFFSET` | program-level, `type=video` |

**Out of scope:** `participants` (~238k), `participant_essays`, `payments`, `users`, `ambassadors`, scoring, abstracts/papers, OTP/password resets. No PII, no payment, no auth data.

**Constants for collision-free anchors (single `legacy_id` column shared across source tables that merge into one target):**
- `RUNDOWN_OFFSET = 2_000_000` (program_rundowns → ProgramSchedule)
- `VIDEO_TESTIMONY_OFFSET = 2_000_000` (program_video_testimonies → ProgramTestimonial)

---

## Live Target DB State (verified 2026-05-31 against prod via Dokploy SSH)

The migration must not duplicate this pre-existing, admin-curated data. None of it carries a `legacy_id`.

**Brands (5, no legacy_id):** China Youth Summit, Istanbul Youth Summit, Japan Youth Summit, Middle East Youth Summit, World Youth Fest. Four match legacy `program_categories` by name; "China Youth Summit" has no legacy counterpart (leave it alone). Legacy categories with no existing brand (Korea Youth Summit, Youth Academic Forum, Vietnam Youth Summit) will be created.

**Programs (3, no legacy_id):**

| Existing program | Year | Status | Existing content | Legacy overlap | Decision |
|---|---|---|---|---|---|
| China Youth Summit 2026 | 2026 | published | 27 faqs, 3 speakers, 32 gallery, 2 announcements | none (China absent from legacy) | leave untouched |
| Istanbul Youth Summit 2027 | 2027 | draft | empty | legacy `id=22` (IYS 2027) | **ignore** legacy `22` (new DB authoritative) |
| Middle East Youth Summit 6th | 2026 | published | 25 faqs, 15 gallery | legacy `id=21` "MEYS the 6th" + `id=12` "MEYS 2026" | **ignore** legacy `21` AND `12` (new DB authoritative) |

Stakeholder decision (2026-05-31): for any program already in the new DB, the new DB wins and the legacy copy is ignored outright. Confirmed `ignore`: legacy `21`, `12` (MEYS 2026/6th) and `22` (IYS 2027). All other legacy programs (the historical editions not present in the new DB) are `create`d.

**Content totals already present (all admin-entered, no legacy_id):** 52 faqs, 3 speakers, 47 gallery, 2 announcements, 23 testimonials, 35 schedules, 0 awards.

**Ambiguity note:** legacy has multiple same-year editions per brand (MEYS has `id=12` 2026 and `id=21` "the 6th"; Korea has `id=9` 2026 and `id=18` 2026 Batch 2). `(brand, year)` is therefore NOT a safe match key. Program matching uses the reviewed mapping file, not fuzzy year/name matching.

---

## File Structure

All new code lives under `services/api/prisma/migration-scripts/legacy-content/`:

- `legacy-db.ts` — read-only `mysql2` connection pool + typed query helpers. One responsibility: talk to legacy MySQL.
- `prisma-client.ts` — shared Prisma client wired to Postgres via `pg` adapter, with the `postgres-api:5432` → `localhost:5438` override used elsewhere in the repo.
- `types.ts` — TypeScript row interfaces for every legacy table being read (named fields, not positional).
- `mappers.ts` — pure transform functions (slugify, year derivation, enum remaps, social-link assembly, etc.). No I/O. Fully unit-tested.
- `mappers.spec.ts` — Jest unit tests for `mappers.ts`.
- `stages/brands.stage.ts` — migrate `program_categories` → `Brand`, returns `Map<legacyCategoryId, brandUuid>`.
- `stages/programs.stage.ts` — migrate `programs` → `Program`, returns `Map<legacyProgramId, {programUuid, brandUuid, year}>`.
- `stages/program-content.stage.ts` — per-program: faqs, speakers, awards, announcements, schedules, rundowns, video testimonials.
- `stages/brand-content.stage.ts` — brand-level: text testimonials, then `ensureHistoryPrograms()` (auto-create stub Program editions for photo years that have no `programs` row), then gallery (photo→program resolution).
- De-dup logic lives inline in the stages (not a separate file): brands match by normalized name in `brands.stage.ts` (anchor + backfill-empty only, never overwrite); `ignore`d programs never enter the program map, so `progId()` returns null for them and all their content is skipped; gallery attaches only on exact (brand, year); `brand-content.stage.ts` has `brandsWithAdminTestimonials()` to skip brands that already hold curated testimonials.
- `program-mapping.json` — **human-reviewed** mapping of legacy program id → `{ action: "create" | "ignore" }`. `ignore` means the new DB already owns that program; the legacy copy is skipped entirely. A proposal is generated by `generate-program-mapping.ts`; a human confirms it before the main run. Committed to the repo (it is a deliberate decision record, not a secret).
- `generate-program-mapping.ts` — one-off helper that prints a proposed `program-mapping.json` by comparing legacy programs against existing programs per brand. Exact slug match within brand → propose `ignore` (new DB owns it); otherwise → propose `create`.
- `migrate-legacy-content.ts` — orchestrator (`main()`); runs stages in dependency order.
- `asset-rehoming.ts` — Phase B: walks migrated rows, downloads legacy URLs, re-uploads to file service, rewrites URLs. Uses `asset-url-map.json` cache.
- `asset-url-map.json` — generated cache `{ "<legacyUrl>": "<newUrl>" }` for idempotent re-runs (gitignored).

`package.json` gets two npm scripts: `migrate:legacy-content` and `rehome:legacy-assets`.

Schema change: add `legacyId Int? @unique @map("legacy_id")` to `ProgramFaq`, `ProgramSpeaker`, `ProgramSchedule`, `ProgramGallery`, `ProgramTestimonial`, `ProgramAnnouncement` in `services/api/prisma/schema/content.prisma`. (`Brand`, `Program`, `ProgramAward`, `DocumentTemplate` already have it.)

---

## Prerequisites & Environment

The new stack must be running locally (Postgres on `localhost:5438`, and for Phase B the file service reachable at `FILE_SERVICE_URL`). Legacy MySQL is remote and read-only from our side.

Required env (in `services/api/.env`, do NOT commit):

```
DATABASE_URL=postgresql://<user>:<password>@localhost:5438/ybb_platform_db
LEGACY_DB_HOST=<legacy mysql host>
LEGACY_DB_PORT=3306
LEGACY_DB_USER=<legacy mysql user>
LEGACY_DB_PASSWORD=<legacy mysql password — keep in .env, never commit>
LEGACY_DB_NAME=<legacy mysql db>
# Phase B only:
FILE_SERVICE_URL=http://localhost:8000
FILE_SERVICE_INTERNAL_KEY=<value from file service .env: FILE_SERVICE_INTERNAL_KEY/INTERNAL_SERVICE_KEY>
SYSTEM_USER_ID=<uuid of the admin/system user to attribute migrated uploads to (decision 5)>
```

> Security note: legacy credentials are write-protected on our side (we only SELECT), but treat the password as a secret — keep it in `.env`, never in source or commits. Add `asset-url-map.json` to `.gitignore`.

---

## Execution Strategy: Dry Run First (VPS scratch DB)

Per stakeholder decision, validate the whole thing end to end against a throwaway copy before touching prod. The dry run writes only to a scratch database; it never writes to the live `ybb_platform_db`.

**Target:** a scratch DB `ybb_platform_dryrun` created inside the prod Postgres container (`ybb-platform-api-yeghdi-postgres-api-1`), restored from the prod dump. Prod user data stays on the server.

**Phase B isolation:** the only prod-touching side effect is asset uploads. The dry run sets `ASSET_BUCKET_PREFIX=dryrun-` so the ~150-200 uploaded files land in isolated `dryrun-*` storage paths via the real file service, kept separate from real buckets and purged at teardown. (The dry-run scratch DB references those `dryrun-` URLs; the real run later uploads into clean buckets.)

**Why in-container:** neither the scratch DB nor the file service is reachable from outside the VPS docker network, so the migration scripts run inside the API container (compile TS → JS locally, `scp`, `docker cp`, `docker exec`, per `reference_prod_access`). Set `DATABASE_URL=...@postgres-api:5432/ybb_platform_dryrun` and do NOT set `PG_REWRITE_LOCALHOST` (the in-container host is correct as-is).

**Dry-run sequence:**
1. Take the prod dump (Task PRE).
2. `docker exec ... psql -U ybb_api_user -d postgres -c "CREATE DATABASE ybb_platform_dryrun OWNER ybb_api_user;"`
3. Restore the dump into it: `docker exec ... pg_restore -U ybb_api_user -d ybb_platform_dryrun --no-owner /tmp/<dump>`.
4. Apply the Task 1 schema additions to `ybb_platform_dryrun` (run the generated migration's SQL via psql, since the prod container may lack the Prisma CLI).
5. Generate/confirm `program-mapping.json` against the scratch DB (Task 6.5), then run Tasks 7 and 8 in-container against `ybb_platform_dryrun` with `ASSET_BUCKET_PREFIX=dryrun-` and `SYSTEM_USER_ID` set.
6. Run all Task 9 verification queries against `ybb_platform_dryrun`. Spot-check via a temporary read-only view or by pointing a local API instance at it if desired.
7. **Teardown:** `DROP DATABASE ybb_platform_dryrun;` and purge the `dryrun-*` storage paths. Keep `asset-url-map.json` only if you want to inspect it; the real run uses clean buckets so it should start fresh.

Only after the dry run's verification passes do we schedule the real prod run (same steps, target `ybb_platform_db`, no bucket prefix, schema change via the normal `prisma migrate deploy` pipeline).

---

### Task PRE: Back up the live new-system DB (MANDATORY — run immediately before execution)

**Files:** none (operational step). Do this against whatever DB the migration will write to. For prod that is the Dokploy Postgres container `ybb-platform-api-yeghdi-postgres-api-1` (db `ybb_platform_db`, user `ybb_api_user`), reachable only from inside the docker network — so dump from inside the container.

> Take this backup **right before** running the migration (Tasks 7/8), not days earlier, so it reflects the exact pre-migration state. The migration is additive (creates new rows, anchors via `legacy_id`, backfills only empty fields), but a full restore point is the safety net.

- [ ] **Step 1: Produce a compressed custom-format dump inside the container**

```bash
ssh ybb 'set -e
  PASS=$(docker exec ybb-platform-api-yeghdi-api-1 printenv DATABASE_URL | sed -E "s|.*://[^:]+:([^@]+)@.*|\1|")
  TS=$(date +%Y%m%d_%H%M%S)
  FILE=ybb_platform_db_pre_legacy_migration_$TS.dump
  docker exec -e PGPASSWORD="$PASS" ybb-platform-api-yeghdi-postgres-api-1 \
    pg_dump -U ybb_api_user -d ybb_platform_db -Fc -f /tmp/$FILE
  docker cp ybb-platform-api-yeghdi-postgres-api-1:/tmp/$FILE /tmp/$FILE
  ls -lh /tmp/$FILE
  echo "BACKUP_FILE=$FILE"'
```
Expected: a non-trivially-sized `.dump` file (NOT a few bytes) and a printed `BACKUP_FILE=...` name. Record that name.

- [ ] **Step 2: Copy the dump off the VPS to local (and ideally a second location)**

```bash
mkdir -p ./backups
scp ybb:/tmp/ybb_platform_db_pre_legacy_migration_<TS>.dump ./backups/
ls -lh ./backups/
```
Expected: the dump exists locally. Keep it until the migration is verified and accepted.

- [ ] **Step 3: Verify the dump is restorable (list its contents, no errors)**

```bash
ssh ybb 'docker exec ybb-platform-api-yeghdi-postgres-api-1 \
  pg_restore --list /tmp/ybb_platform_db_pre_legacy_migration_<TS>.dump | head -30'
```
Expected: a table-of-contents listing (brands, programs, program_faqs, etc.). If this errors, STOP — do not run the migration.

- [ ] **Step 4: Note the rollback procedure (do NOT run unless rolling back)**

Two options if the migration must be undone:
- **Targeted undo (preferred, since the migration is additive):** delete only what the migration wrote, in FK-safe order:
  ```sql
  DELETE FROM program_faqs            WHERE legacy_id IS NOT NULL;
  DELETE FROM program_speakers        WHERE legacy_id IS NOT NULL;
  DELETE FROM program_gallery         WHERE legacy_id IS NOT NULL;
  DELETE FROM program_announcements   WHERE legacy_id IS NOT NULL;
  DELETE FROM program_testimonials    WHERE legacy_id IS NOT NULL;
  DELETE FROM program_schedules       WHERE legacy_id IS NOT NULL;
  DELETE FROM program_awards          WHERE legacy_id IS NOT NULL;
  DELETE FROM programs                WHERE legacy_id IS NOT NULL;
  -- Brands were only anchored/empty-backfilled; clear the anchor (and review backfilled fields against the dump if needed):
  UPDATE brands SET legacy_id = NULL  WHERE legacy_id IS NOT NULL;
  ```
  This leaves all pre-existing admin data intact. (Note: the empty-field backfill on matched brands is not auto-reverted by this; compare against the dump if exact brand-field rollback matters.)
- **Full restore (nuclear):** restore the dump into a FRESH database and repoint the app, rather than `pg_restore --clean` over the live DB. Coordinate downtime.

---

### Task 0: Prerequisites verification & shared infrastructure

**Files:**
- Create: `services/api/prisma/migration-scripts/legacy-content/legacy-db.ts`
- Create: `services/api/prisma/migration-scripts/legacy-content/prisma-client.ts`
- Create: `services/api/prisma/migration-scripts/legacy-content/types.ts`
- Modify: `services/api/.gitignore` (or repo root `.gitignore`)

- [ ] **Step 1: Confirm deps exist** (already in `package.json`: `mysql2`, `axios`, `form-data`, `@prisma/adapter-pg`, `pg`, `csv-parse`, `dotenv`, `ts-node`). No install needed.

Run: `cd services/api && node -e "require('mysql2'); require('axios'); require('form-data'); console.log('deps ok')"`
Expected: `deps ok`

- [ ] **Step 2: Add gitignore entry for the asset cache**

Append to `services/api/.gitignore`:

```
prisma/migration-scripts/legacy-content/asset-url-map.json
```

- [ ] **Step 3: Write the legacy DB helper**

Create `legacy-db.ts`:

```ts
import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

let pool: mysql.Pool | null = null;

export function getLegacyPool(): mysql.Pool {
  if (pool) return pool;
  pool = mysql.createPool({
    host: process.env.LEGACY_DB_HOST,
    port: Number(process.env.LEGACY_DB_PORT ?? 3306),
    user: process.env.LEGACY_DB_USER,
    password: process.env.LEGACY_DB_PASSWORD,
    database: process.env.LEGACY_DB_NAME,
    charset: 'utf8mb4',
    connectionLimit: 4,
    // Safety: we only ever read. Reject any non-SELECT by convention in callers.
  });
  return pool;
}

/** Run a SELECT and return typed rows. */
export async function legacyQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await getLegacyPool().query(sql, params);
  return rows as T[];
}

export async function closeLegacyPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
```

- [ ] **Step 4: Write the Prisma client helper** (mirrors the override pattern in `src/scripts/backfill-landing-snapshots.ts`)

Create `prisma-client.ts`:

```ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

let connectionString =
  process.env.DATABASE_URL ??
  'postgresql://ybb_user:ybb_password@localhost:5438/ybb_platform_db';
// Local runs tunnel prod's docker host to localhost:5438. Set PG_REWRITE_LOCALHOST=1 then.
// IN-CONTAINER runs (e.g. the VPS dry run) must NOT rewrite — `postgres-api:5432` is correct there,
// so leave PG_REWRITE_LOCALHOST unset.
if (process.env.PG_REWRITE_LOCALHOST === '1') {
  connectionString = connectionString.replace('postgres-api:5432', 'localhost:5438');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
```

- [ ] **Step 5: Write the legacy row types**

Create `types.ts` (named fields confirmed via `SHOW COLUMNS` on the live DB):

```ts
export interface LegacyCategoryRow {
  id: number; name: string; description: string | null; about: string;
  core_values: string; objectives: string; benefits: string;
  program_type_id: number | null; web_url: string | null; logo_url: string | null;
  main_banner_url: string | null; main_video_url: string | null; tagline: string | null;
  contact: string | null; location: string | null; email: string | null;
  instagram: string | null; tiktok: string | null; youtube: string | null;
  telegram: string | null; verification_required: number; is_active: number; is_deleted: number;
}

export interface LegacyProgramRow {
  id: number; program_category_id: number; name: string; banner_url: string | null;
  description: string | null; essay_guideline_url: string | null;
  registration_video_url: string | null; theme: string | null;
  start_date: Date | null; end_date: Date | null; usd_in_idr: number | null;
  is_active: number; is_deleted: number;
}

export interface LegacyFaqRow {
  id: number; program_id: number; question: string; answer: string;
  faq_category: 'event_details' | 'registration' | 'payments';
  order_number: number | null; is_active: number; is_deleted: number;
}

export interface LegacySpeakerRow {
  id: number; program_id: number; photo_url: string | null; linkedin_url: string | null;
  instagram_url: string | null; email: string | null; organization: string | null;
  expertise_areas: string | null; is_keynote: number; session_title: string | null;
  session_description: string | null; session_time: Date | null; order_number: number;
  name: string; title: string | null; bio: string | null; is_active: number; is_deleted: number;
}

export interface LegacyAwardRow {
  id: number; program_id: number; title: string; description: string | null;
  award_type: 'winner' | 'runner_up' | 'mention' | 'other' | null;
  order_number: number | null; is_active: number | null; is_deleted: number | null;
}

export interface LegacyAnnouncementRow {
  id: number; program_id: number; title: string | null; content: string | null;
  img_url: string | null; visible_to: number; slug: string;
  meta_title: string; meta_description: string; tags: string;
  is_active: number; is_deleted: number; created_at: Date | null;
}

export interface LegacyScheduleRow {
  id: number; program_id: number; name: string; description: string;
  start_date: Date; end_date: Date; order_number: number; is_active: number; is_deleted: number;
}

export interface LegacyRundownRow {
  id: number; program_id: number; start_date: Date | null; end_date: Date | null;
  title: string | null; description: string | null; order_number: number;
  is_active: number; is_deleted: number;
}

export interface LegacyPhotoRow {
  id: number; program_category_id: number; title: string; year: number | null;
  description: string | null; img_url: string | null; is_active: number; is_deleted: number;
}

export interface LegacyTestimonyRow {
  id: number; program_category_id: number | null; person_name: string | null;
  testimony: string | null; occupation: string | null; institution: string | null;
  img_url: string | null; is_active: number; is_deleted: number;
}

export interface LegacyVideoTestimonyRow {
  id: number; program_id: number; youtube_url: string; youtube_video_id: string | null;
  description: string | null; display_order: number; is_active: number; is_deleted: number;
}
```

- [ ] **Step 6: Smoke-test connectivity**

Create a throwaway check (delete after): `node -r ts-node/register -e "import('./prisma/migration-scripts/legacy-content/legacy-db').then(async m => { console.log(await m.legacyQuery('SELECT COUNT(*) c FROM programs')); await m.closeLegacyPool(); })"`
Expected: `[ { c: 18 } ]` (or current count)

- [ ] **Step 7: Commit**

```bash
git add services/api/prisma/migration-scripts/legacy-content/legacy-db.ts \
        services/api/prisma/migration-scripts/legacy-content/prisma-client.ts \
        services/api/prisma/migration-scripts/legacy-content/types.ts \
        services/api/.gitignore
git commit -m "chore: legacy-content migration scaffolding (db helpers + row types)"
```

---

### Task 1: Add `legacy_id` anchors + new content columns

**Files:**
- Modify: `services/api/prisma/schema/content.prisma` (models `ProgramFaq`, `ProgramSchedule`, `ProgramSpeaker`, `ProgramGallery`, `ProgramTestimonial`, `ProgramAnnouncement`)
- Create: a Prisma migration under `services/api/prisma/migrations/`

- [ ] **Step 1: Add the `legacy_id` anchor to each model**

In `content.prisma`, add this line to each of the six models (place it just before the `// Relations` comment, matching the style already used on `ProgramAward`):

```prisma
  legacyId  Int?      @unique @map("legacy_id")
```

Models to edit: `ProgramFaq`, `ProgramSchedule`, `ProgramSpeaker`, `ProgramGallery`, `ProgramTestimonial`, `ProgramAnnouncement`.

- [ ] **Step 2: Add the new columns that preserve legacy fields (decisions 3)**

To avoid dropping legacy data, extend two models. Add to `ProgramSpeaker`:

```prisma
  instagramUrl       String?   @map("instagram_url") @db.VarChar(500)
  sessionTitle       String?   @map("session_title") @db.VarChar(500)
  sessionDescription String?   @map("session_description") @db.Text
  sessionTime        DateTime? @map("session_time") @db.Timestamptz(6)
  isKeynote          Boolean   @default(false) @map("is_keynote")
  expertiseAreas     String?   @map("expertise_areas") @db.Text
```

Add to `ProgramAnnouncement`:

```prisma
  slug            String? @db.VarChar(255)
  metaTitle       String? @map("meta_title") @db.VarChar(255)
  metaDescription String? @map("meta_description") @db.VarChar(255)
```

> `slug` is intentionally NOT `@unique`: legacy announcement slugs are not globally unique (values like `new`, `fsf` exist). If the new site needs unique news URLs, scope them with `@@unique([programId, slug])` in a later change and de-dupe first.

- [ ] **Step 3: Generate the migration**

Run: `cd services/api && npx prisma migrate dev --name add_legacy_id_and_content_fields`
Expected: migration created and applied; `prisma generate` runs; no data-loss warnings (all new columns are nullable or have defaults).

- [ ] **Step 4: Verify the client typings**

Run: `npx prisma generate && node -e "const {PrismaClient}=require('@prisma/client'); console.log('ok')"`
Expected: `ok` (regenerated client includes the new fields).

- [ ] **Step 5: Commit**

```bash
git add services/api/prisma/schema/content.prisma services/api/prisma/migrations/
git commit -m "feat: add legacy_id anchors + speaker session and announcement SEO fields"
```

---

### Task 2: Pure mapper functions (TDD)

**Files:**
- Create: `services/api/prisma/migration-scripts/legacy-content/mappers.ts`
- Test: `services/api/prisma/migration-scripts/legacy-content/mappers.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `mappers.spec.ts`:

```ts
import {
  slugify, deriveYear, mapFaqCategory, mapAwardTier, splitTags,
  socialLinks, boolFrom, youtubeThumb, scheduleDay, hhmm, videoTestimonialName,
} from './mappers';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Istanbul Youth Summit 2025')).toBe('istanbul-youth-summit-2025');
  });
  it('strips punctuation and collapses dashes', () => {
    expect(slugify('MEYS: the 6th!!')).toBe('meys-the-6th');
  });
});

describe('deriveYear', () => {
  it('prefers a 4-digit year in the name', () => {
    expect(deriveYear('IYS 2024', new Date('2024-08-01'))).toBe(2024);
  });
  it('falls back to start_date year', () => {
    expect(deriveYear('Korea Youth Summit', new Date('2026-02-10'))).toBe(2026);
  });
  it('takes the LAST year token when several appear', () => {
    expect(deriveYear('Batch 2025 Cohort 2026', null)).toBe(2026);
  });
});

describe('mapFaqCategory', () => {
  it('maps legacy enum to new enum', () => {
    expect(mapFaqCategory('payments')).toBe('payment');
    expect(mapFaqCategory('event_details')).toBe('event_details');
    expect(mapFaqCategory('registration')).toBe('registration');
  });
});

describe('mapAwardTier', () => {
  it('maps award_type to tier', () => {
    expect(mapAwardTier('winner')).toBe('gold');
    expect(mapAwardTier('runner_up')).toBe('silver');
    expect(mapAwardTier('mention')).toBe('honorable_mention');
    expect(mapAwardTier('other')).toBeNull();
    expect(mapAwardTier(null)).toBeNull();
  });
});

describe('splitTags', () => {
  it('splits comma list and trims', () => {
    expect(splitTags('news, 2024 ,award')).toEqual(['news', '2024', 'award']);
  });
  it('returns [] for empty', () => {
    expect(splitTags('')).toEqual([]);
    expect(splitTags(null)).toEqual([]);
  });
});

describe('socialLinks', () => {
  it('drops empty values', () => {
    expect(socialLinks({ instagram: 'ig', tiktok: '', youtube: null, telegram: 'tg' }))
      .toEqual({ instagram: 'ig', telegram: 'tg' });
  });
});

describe('boolFrom', () => {
  it('treats 1 as true, 0 as false', () => {
    expect(boolFrom(1)).toBe(true);
    expect(boolFrom(0)).toBe(false);
    expect(boolFrom(null)).toBe(false);
  });
});

describe('youtubeThumb', () => {
  it('builds a thumbnail url from a video id', () => {
    expect(youtubeThumb('abc123')).toBe('https://img.youtube.com/vi/abc123/hqdefault.jpg');
  });
  it('returns null when no id', () => {
    expect(youtubeThumb(null)).toBeNull();
  });
});

describe('scheduleDay / hhmm', () => {
  it('formats a date as an ISO day label and HH:mm time', () => {
    const d = new Date('2025-08-01T09:30:00Z');
    expect(scheduleDay(d)).toBe('2025-08-01');
    expect(hhmm(d)).toBe('09:30');
  });
});

describe('videoTestimonialName', () => {
  it('uses the first line of the description', () => {
    expect(videoTestimonialName('Amazing experience\nmore text')).toBe('Amazing experience');
  });
  it('truncates long descriptions', () => {
    expect(videoTestimonialName('x'.repeat(100))).toBe('x'.repeat(77) + '...');
  });
  it('falls back when empty', () => {
    expect(videoTestimonialName(null)).toBe('Alumni Testimonial');
    expect(videoTestimonialName('   ')).toBe('Alumni Testimonial');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd services/api && npx jest prisma/migration-scripts/legacy-content/mappers.spec.ts`
Expected: FAIL — `Cannot find module './mappers'`.

- [ ] **Step 3: Implement `mappers.ts`**

```ts
/** Pure transforms for legacy → new content migration. No I/O. */

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Prefer a 4-digit year in the name (last one wins), else start_date year, else current-ish fallback. */
export function deriveYear(name: string, startDate: Date | null): number {
  const matches = name.match(/\b(19|20)\d{2}\b/g);
  if (matches && matches.length > 0) return Number(matches[matches.length - 1]);
  if (startDate) return startDate.getUTCFullYear();
  return 0; // caller decides; 0 signals "unknown" and should be logged
}

export type NewFaqCategory =
  | 'general' | 'registration' | 'payment' | 'event_details'
  | 'accommodation' | 'visa' | 'other';

export function mapFaqCategory(legacy: string): NewFaqCategory {
  switch (legacy) {
    case 'payments': return 'payment';
    case 'registration': return 'registration';
    case 'event_details': return 'event_details';
    default: return 'general';
  }
}

export function mapAwardTier(awardType: string | null): string | null {
  switch (awardType) {
    case 'winner': return 'gold';
    case 'runner_up': return 'silver';
    case 'mention': return 'honorable_mention';
    default: return null;
  }
}

export function splitTags(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
}

export function socialLinks(
  links: Record<string, string | null | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(links)) {
    if (v && v.trim().length > 0) out[k] = v.trim();
  }
  return out;
}

export function boolFrom(n: number | null): boolean {
  return n === 1;
}

export function youtubeThumb(videoId: string | null): string | null {
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
}

export function scheduleDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function hhmm(d: Date): string {
  return d.toISOString().slice(11, 16);
}

/** Display name for a video testimonial that has no person name (decision 4). */
export function videoTestimonialName(description: string | null): string {
  const text = (description ?? '').trim();
  if (!text) return 'Alumni Testimonial';
  const firstLine = text.split(/\r?\n/)[0].trim();
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd services/api && npx jest prisma/migration-scripts/legacy-content/mappers.spec.ts`
Expected: PASS (all suites green).

- [ ] **Step 5: Commit**

```bash
git add services/api/prisma/migration-scripts/legacy-content/mappers.ts \
        services/api/prisma/migration-scripts/legacy-content/mappers.spec.ts
git commit -m "feat: pure mappers for legacy content migration with unit tests"
```

---

### Task 3: Brand stage (`program_categories` → `Brand`)

**Files:**
- Create: `services/api/prisma/migration-scripts/legacy-content/stages/brands.stage.ts`

- [ ] **Step 1: Implement the brand stage**

Brands may already exist by name from earlier seeding, so we match on `legacyId` OR `name`, then set the anchor. `Brand.name` and `Brand.slug` are unique.

```ts
import { prisma } from '../prisma-client';
import { legacyQuery } from '../legacy-db';
import { LegacyCategoryRow } from '../types';
import { slugify, socialLinks, boolFrom } from '../mappers';

/** legacyCategoryId -> brand UUID */
export async function migrateBrands(): Promise<Map<number, string>> {
  const rows = await legacyQuery<LegacyCategoryRow>(
    `SELECT id, name, description, about, core_values, objectives, benefits,
            web_url, logo_url, main_banner_url, main_video_url, tagline,
            contact, location, email, instagram, tiktok, youtube, telegram,
            is_active, is_deleted
       FROM program_categories
      WHERE is_deleted = 0`,
  );

  const map = new Map<number, string>();

  for (const r of rows) {
    const slug = slugify(r.name);
    const metadata = {
      coreValues: r.core_values || null,
      objectives: r.objectives || null,
      benefits: r.benefits || null,
      tagline: r.tagline || null,
    };
    const social = socialLinks({
      instagram: r.instagram, tiktok: r.tiktok, youtube: r.youtube, telegram: r.telegram,
    });

    // Full payload, used only when CREATING a brand that does not exist yet.
    const createData = {
      name: r.name,
      slug,
      description: r.description ?? null,
      about: r.about || null,
      websiteUrl: r.web_url ?? null,
      logoUrl: r.logo_url ?? null,          // Phase B rewrites this
      bannerUrl: r.main_banner_url ?? null, // Phase B rewrites this
      contactEmail: r.email ?? null,
      contactPhone: r.contact ?? null,
      contactAddress: r.location ?? null,
      socialMediaLinks: social,
      isActive: boolFrom(r.is_active),
      metadata,
      legacyId: r.id,
    };

    // Match by legacyId first, then by case-insensitive name (pre-existing admin brand).
    // This anchors the 4 existing brands that match legacy categories; "China Youth
    // Summit" has no legacy match and is created fresh only if a legacy category matches it
    // (it does not, so it stays untouched).
    const existing = await prisma.brand.findFirst({
      where: {
        OR: [
          { legacyId: r.id },
          { name: { equals: r.name, mode: 'insensitive' } },
        ],
      },
    });

    let brand;
    if (existing) {
      // The new DB is authoritative for an existing brand. Only anchor it (set legacy_id)
      // and backfill fields that are currently empty. NEVER overwrite curated values
      // (name, slug, about, logo, banner, social, etc.).
      const patch: Record<string, unknown> = { legacyId: r.id };
      if (!existing.about && createData.about) patch.about = createData.about;
      if (!existing.description && createData.description) patch.description = createData.description;
      if (!existing.websiteUrl && createData.websiteUrl) patch.websiteUrl = createData.websiteUrl;
      if (!existing.logoUrl && createData.logoUrl) patch.logoUrl = createData.logoUrl;
      if (!existing.bannerUrl && createData.bannerUrl) patch.bannerUrl = createData.bannerUrl;
      if (!existing.contactEmail && createData.contactEmail) patch.contactEmail = createData.contactEmail;
      brand = await prisma.brand.update({ where: { id: existing.id }, data: patch });
      console.log(`  brand ${r.id} -> ANCHORED existing ${brand.id} (${brand.name})`);
    } else {
      brand = await prisma.brand.create({ data: createData });
      console.log(`  brand ${r.id} -> CREATED ${brand.id} (${r.name})`);
    }

    map.set(r.id, brand.id);
  }

  return map;
}
```

- [ ] **Step 2: Commit** (stage is exercised end-to-end in Task 7's dry run)

```bash
git add services/api/prisma/migration-scripts/legacy-content/stages/brands.stage.ts
git commit -m "feat: brand migration stage (program_categories -> brands)"
```

---

### Task 4: Program stage (`programs` → `Program`)

**Files:**
- Create: `services/api/prisma/migration-scripts/legacy-content/stages/programs.stage.ts`

- [ ] **Step 1: Implement the program stage**

Upsert by `legacyId`. This self-heals the earlier broken migration (which dumped all programs under one brand with a hardcoded year): the `update` branch re-points `brandId` and fixes `year`.

```ts
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../prisma-client';
import { legacyQuery } from '../legacy-db';
import { LegacyProgramRow } from '../types';
import { slugify, deriveYear, boolFrom } from '../mappers';

export interface ProgramRef {
  programId: string;
  brandId: string;
  year: number;
}

interface MappingEntry { action: 'create' | 'ignore'; _note?: string; }
type ProgramMapping = Record<string, MappingEntry>; // keyed by legacy program id (string)

function loadMapping(): ProgramMapping {
  const p = path.resolve(__dirname, '../program-mapping.json');
  if (!fs.existsSync(p)) {
    throw new Error('program-mapping.json missing. Run generate-program-mapping.ts and review it first.');
  }
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as ProgramMapping;
}

/**
 * legacyProgramId -> ProgramRef.
 *
 * Policy (confirmed with stakeholder): the new DB is AUTHORITATIVE for any program
 * that already exists there. Such legacy programs are marked `ignore` in the mapping
 * and are skipped entirely — not created, not merged, not anchored. Only legacy
 * programs with NO new-DB counterpart (the historical editions) are `create`d, and
 * only those enter the returned map, so downstream content stages naturally skip
 * everything tied to an ignored program.
 */
export async function migratePrograms(
  brandMap: Map<number, string>,
): Promise<Map<number, ProgramRef>> {
  const mapping = loadMapping();
  const rows = await legacyQuery<LegacyProgramRow>(
    `SELECT id, program_category_id, name, banner_url, description,
            essay_guideline_url, registration_video_url, theme,
            start_date, end_date, usd_in_idr, is_active, is_deleted
       FROM programs
      WHERE is_deleted = 0`,
  );

  const map = new Map<number, ProgramRef>();
  const now = new Date();

  for (const r of rows) {
    const decision = mapping[String(r.id)] ?? { action: 'create' as const };
    if (decision.action === 'ignore') {
      console.log(`  program ${r.id} -> IGNORED (${r.name}) — new DB is authoritative`);
      continue;
    }

    const brandId = brandMap.get(r.program_category_id);
    if (!brandId) {
      console.warn(`  SKIP program ${r.id} (${r.name}): no brand for category ${r.program_category_id}`);
      continue;
    }

    const year = deriveYear(r.name, r.start_date);
    if (year === 0) console.warn(`  program ${r.id} (${r.name}): year unresolved, set to 0`);

    const start = r.start_date ?? now;
    const end = r.end_date ?? start;
    const isPast = end < now;

    const data = {
      brandId,
      name: r.name,
      slug: await uniqueSlug(brandId, slugify(r.name), r.id),
      year,
      startDate: start,
      endDate: end,
      applicationDeadline: start,
      description: r.description ?? null,
      theme: r.theme ?? null,
      bannerUrl: r.banner_url ?? null,            // Phase B rewrites this
      videoUrl: r.registration_video_url ?? null,
      essayGuidelineUrl: r.essay_guideline_url ?? null,
      usdInIdr: r.usd_in_idr ?? null,
      isPublished: true,
      isVisibleToUsers: true,
      allowRegistration: false,
      isActive: boolFrom(r.is_active),
      status: isPast ? 'completed' : 'published',
    };

    // We own created programs, so a full upsert keyed on legacy_id is safe and idempotent.
    const program = await prisma.program.upsert({
      where: { legacyId: r.id },
      create: { ...data, legacyId: r.id },
      update: data,
    });

    map.set(r.id, { programId: program.id, brandId, year });
    console.log(`  program ${r.id} -> CREATED ${program.id} (${r.name}, year ${year})`);
  }

  return map;
}

/** Ensure slug is unique within the brand (Program has @@unique([brandId, slug])). */
export async function uniqueSlug(brandId: string, base: string, legacyId: number): Promise<string> {
  const clash = await prisma.program.findFirst({
    where: { brandId, slug: base, legacyId: { not: legacyId } },
  });
  return clash ? `${base}-${legacyId}` : base;
}
```

- [ ] **Step 2: Commit**

```bash
git add services/api/prisma/migration-scripts/legacy-content/stages/programs.stage.ts
git commit -m "feat: program migration stage (programs -> programs, self-healing brand/year)"
```

---

### Task 5: Per-program content stage

**Files:**
- Create: `services/api/prisma/migration-scripts/legacy-content/stages/program-content.stage.ts`

This stage migrates FAQs, speakers, awards, announcements, schedules, rundowns, and video testimonials — all keyed by legacy `program_id`. Each sub-function upserts by `legacyId`.

- [ ] **Step 1: Implement the per-program content stage**

```ts
import { prisma } from '../prisma-client';
import { legacyQuery } from '../legacy-db';
import {
  LegacyFaqRow, LegacySpeakerRow, LegacyAwardRow, LegacyAnnouncementRow,
  LegacyScheduleRow, LegacyRundownRow, LegacyVideoTestimonyRow,
} from '../types';
import {
  mapFaqCategory, mapAwardTier, splitTags, boolFrom, youtubeThumb, videoTestimonialName,
  scheduleDay, hhmm,
} from '../mappers';
import { ProgramRef } from './programs.stage';

const RUNDOWN_OFFSET = 2_000_000;
const VIDEO_TESTIMONY_OFFSET = 2_000_000;

// Returns the target program UUID, or null to SKIP. A legacy program that was
// `ignore`d (new DB authoritative) or unresolved is absent from the map, so all of
// its content rows are skipped automatically — legacy content never lands on a
// program the admin already owns.
function progId(map: Map<number, ProgramRef>, legacyProgramId: number): string | null {
  return map.get(legacyProgramId)?.programId ?? null;
}

export async function migrateProgramContent(programMap: Map<number, ProgramRef>): Promise<void> {
  await migrateFaqs(programMap);
  await migrateSpeakers(programMap);
  await migrateAwards(programMap);
  await migrateAnnouncements(programMap);
  await migrateSchedules(programMap);
  await migrateRundowns(programMap);
  await migrateVideoTestimonies(programMap);
}

async function migrateFaqs(programMap: Map<number, ProgramRef>): Promise<void> {
  console.log('  FAQs...');
  const rows = await legacyQuery<LegacyFaqRow>(
    `SELECT id, program_id, question, answer, faq_category, order_number, is_active, is_deleted
       FROM program_faqs WHERE is_deleted = 0`,
  );
  for (const r of rows) {
    const programId = progId(programMap, r.program_id);
    if (!programId) continue;
    const data = {
      programId, question: r.question, answer: r.answer,
      category: mapFaqCategory(r.faq_category), order: r.order_number ?? 0,
      isActive: boolFrom(r.is_active),
    };
    await prisma.programFaq.upsert({
      where: { legacyId: r.id }, create: { ...data, legacyId: r.id }, update: data,
    });
  }
}

async function migrateSpeakers(programMap: Map<number, ProgramRef>): Promise<void> {
  console.log('  Speakers...');
  const rows = await legacyQuery<LegacySpeakerRow>(
    `SELECT id, program_id, photo_url, linkedin_url, instagram_url, email,
            organization, expertise_areas, is_keynote, session_title,
            session_description, session_time, order_number, name, title, bio,
            is_active, is_deleted
       FROM program_speakers WHERE is_deleted = 0`,
  );
  for (const r of rows) {
    const programId = progId(programMap, r.program_id);
    if (!programId) continue;
    const data = {
      programId, name: r.name, title: r.title ?? null, organization: r.organization ?? null,
      bio: r.bio ?? null, photoUrl: r.photo_url ?? null, email: r.email ?? null,
      linkedinUrl: r.linkedin_url ?? null, instagramUrl: r.instagram_url ?? null,
      sessionTitle: r.session_title ?? null, sessionDescription: r.session_description ?? null,
      sessionTime: r.session_time ?? null, isKeynote: boolFrom(r.is_keynote),
      expertiseAreas: r.expertise_areas ?? null, order: r.order_number ?? 0,
      isActive: boolFrom(r.is_active),
    };
    await prisma.programSpeaker.upsert({
      where: { legacyId: r.id }, create: { ...data, legacyId: r.id }, update: data,
    });
  }
}

async function migrateAwards(programMap: Map<number, ProgramRef>): Promise<void> {
  console.log('  Awards...');
  const rows = await legacyQuery<LegacyAwardRow>(
    `SELECT id, program_id, title, description, award_type, order_number, is_active, is_deleted
       FROM program_awards WHERE COALESCE(is_deleted,0) = 0`,
  );
  for (const r of rows) {
    const programId = progId(programMap, r.program_id);
    if (!programId) continue;
    const data = {
      programId, name: r.title, description: r.description ?? null,
      tier: mapAwardTier(r.award_type), order: r.order_number ?? 0,
      isActive: r.is_active == null ? true : boolFrom(r.is_active),
    };
    await prisma.programAward.upsert({
      where: { legacyId: r.id }, create: { ...data, legacyId: r.id }, update: data,
    });
  }
}

async function migrateAnnouncements(programMap: Map<number, ProgramRef>): Promise<void> {
  console.log('  Announcements (news)...');
  const rows = await legacyQuery<LegacyAnnouncementRow>(
    `SELECT id, program_id, title, content, img_url, visible_to, slug,
            meta_title, meta_description, tags, is_active, is_deleted, created_at
       FROM program_announcements WHERE is_deleted = 0`,
  );
  for (const r of rows) {
    const programId = progId(programMap, r.program_id);
    if (!programId) continue;
    const data = {
      programId, title: r.title ?? '(untitled)', content: r.content ?? '',
      imageUrl: r.img_url ?? null, category: 'News', tags: splitTags(r.tags),
      slug: r.slug || null, metaTitle: r.meta_title || null,
      metaDescription: r.meta_description || null,
      targetAudience: 'all', publishDate: r.created_at ?? new Date(),
      isActive: boolFrom(r.is_active),
    };
    await prisma.programAnnouncement.upsert({
      where: { legacyId: r.id }, create: { ...data, legacyId: r.id }, update: data,
    });
  }
}

async function migrateSchedules(programMap: Map<number, ProgramRef>): Promise<void> {
  console.log('  Schedules...');
  const rows = await legacyQuery<LegacyScheduleRow>(
    `SELECT id, program_id, name, description, start_date, end_date, order_number,
            is_active, is_deleted
       FROM program_schedules WHERE is_deleted = 0`,
  );
  for (const r of rows) {
    const programId = progId(programMap, r.program_id);
    if (!programId) continue;
    const data = {
      programId, day: scheduleDay(r.start_date),
      startTime: hhmm(r.start_date), endTime: r.end_date ? hhmm(r.end_date) : null,
      activity: r.name, description: r.description ?? null, order: r.order_number ?? 0,
      isActive: boolFrom(r.is_active),
    };
    await prisma.programSchedule.upsert({
      where: { legacyId: r.id }, create: { ...data, legacyId: r.id }, update: data,
    });
  }
}

async function migrateRundowns(programMap: Map<number, ProgramRef>): Promise<void> {
  console.log('  Rundowns...');
  const rows = await legacyQuery<LegacyRundownRow>(
    `SELECT id, program_id, start_date, end_date, title, description, order_number,
            is_active, is_deleted
       FROM program_rundowns WHERE is_deleted = 0`,
  );
  for (const r of rows) {
    const programId = progId(programMap, r.program_id);
    if (!programId) continue;
    const anchor = r.id + RUNDOWN_OFFSET; // avoid legacy_id collision with program_schedules
    const start = r.start_date;
    const data = {
      programId, day: start ? scheduleDay(start) : 'TBD',
      startTime: start ? hhmm(start) : null, endTime: r.end_date ? hhmm(r.end_date) : null,
      activity: r.title ?? '(untitled)', description: r.description ?? null,
      order: r.order_number ?? 0, isActive: boolFrom(r.is_active),
    };
    await prisma.programSchedule.upsert({
      where: { legacyId: anchor }, create: { ...data, legacyId: anchor }, update: data,
    });
  }
}

async function migrateVideoTestimonies(programMap: Map<number, ProgramRef>): Promise<void> {
  console.log('  Video testimonies...');
  const rows = await legacyQuery<LegacyVideoTestimonyRow>(
    `SELECT id, program_id, youtube_url, youtube_video_id, description, display_order,
            is_active, is_deleted
       FROM program_video_testimonies WHERE is_deleted = 0`,
  );
  for (const r of rows) {
    const programId = progId(programMap, r.program_id);
    if (!programId) continue;
    const anchor = r.id + VIDEO_TESTIMONY_OFFSET;
    const data = {
      programId, brandId: null, name: videoTestimonialName(r.description),
      testimonial: r.description ?? 'Video testimonial',
      type: 'video', category: 'alumni', videoUrl: r.youtube_url,
      thumbnailUrl: youtubeThumb(r.youtube_video_id), order: r.display_order,
      isActive: boolFrom(r.is_active),
    };
    await prisma.programTestimonial.upsert({
      where: { legacyId: anchor }, create: { ...data, legacyId: anchor }, update: data,
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add services/api/prisma/migration-scripts/legacy-content/stages/program-content.stage.ts
git commit -m "feat: per-program content migration (faqs, speakers, awards, news, schedules, video testimonials)"
```

---

### Task 6: Brand-level content stage (text testimonials + gallery)

**Files:**
- Create: `services/api/prisma/migration-scripts/legacy-content/stages/brand-content.stage.ts`

`program_testimonies` are keyed by `program_category_id` (brand-level). `program_photos` are keyed by `(program_category_id, year)` and must be resolved to a specific program via a `(brandId, year) → programId` lookup built from the program map.

- [ ] **Step 1: Implement the brand-content stage**

```ts
import { prisma } from '../prisma-client';
import { legacyQuery } from '../legacy-db';
import { LegacyTestimonyRow, LegacyPhotoRow } from '../types';
import { boolFrom, slugify } from '../mappers';
import { ProgramRef, uniqueSlug } from './programs.stage';

// Synthetic legacy_id base for auto-created "history" program editions (see ensureHistoryPrograms).
// Far above real legacy program ids (1-22) and the 2_000_000 content offsets, so no collision.
const PHOTO_HISTORY_BASE = 9_000_000;

export async function migrateBrandContent(
  brandMap: Map<number, string>,
  programMap: Map<number, ProgramRef>,
): Promise<void> {
  await migrateTextTestimonies(brandMap);
  await ensureHistoryPrograms(brandMap, programMap); // mutates programMap, adding stubs
  await migrateGallery(brandMap, programMap);
}

/**
 * Legacy `program_photos` are keyed by (program_category_id, year), and many photo
 * years predate the legacy `programs` table (e.g. MEYS 2023, WYF 2023, YAF 2024) — ~66%
 * of photos. Since ProgramGallery.programId is required, we create a lightweight
 * "history" Program for each (brand, year) that has photos but no program, so those
 * historical galleries have somewhere to live. Idempotent via a synthetic legacy_id.
 * Respects admin ownership: if a real program already occupies that (brand, year), the
 * photos are left for the admin (handled in migrateGallery, which only matches stubs/created).
 */
async function ensureHistoryPrograms(
  brandMap: Map<number, string>,
  programMap: Map<number, ProgramRef>,
): Promise<void> {
  console.log('  History program stubs (for orphan-year photos)...');
  const groups = await legacyQuery<{ program_category_id: number; year: number | null }>(
    `SELECT DISTINCT program_category_id, year FROM program_photos WHERE is_deleted = 0`,
  );
  const createdByBrandYear = new Set([...programMap.values()].map((r) => `${r.brandId}:${r.year}`));

  for (const g of groups) {
    const brandId = brandMap.get(g.program_category_id);
    if (!brandId) continue;
    const year = g.year ?? 0;
    if (createdByBrandYear.has(`${brandId}:${year}`)) continue; // a migrated program already covers it

    const synthetic = PHOTO_HISTORY_BASE + g.program_category_id * 10_000 + year;

    // If a NON-stub program already exists for this brand+year (e.g. an admin-curated
    // edition), respect it: do not stub, do not later attach legacy photos to it.
    const existing = await prisma.program.findFirst({ where: { brandId, year } });
    if (existing && existing.legacyId !== synthetic) {
      console.warn(`    photos for brand+year ${year}: existing program present — left to admin, photos skipped`);
      continue;
    }

    const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { name: true } });
    const label = year ? `${brand?.name ?? 'Program'} ${year}` : `${brand?.name ?? 'Program'} (Archive)`;
    const slug = await uniqueSlug(brandId, slugify(label), synthetic);
    const jan1 = new Date(Date.UTC(year || 1970, 0, 1));

    const stub = await prisma.program.upsert({
      where: { legacyId: synthetic },
      create: {
        brandId, name: label, slug, year,
        startDate: jan1, endDate: jan1, applicationDeadline: jan1,
        status: 'completed', isPublished: true, isVisibleToUsers: true,
        allowRegistration: false, isActive: false, legacyId: synthetic,
      },
      update: {},
    });
    programMap.set(synthetic, { programId: stub.id, brandId, year });
    console.log(`    history stub: ${label} -> ${stub.id}`);
  }
}

/** Brands that already hold admin-entered (legacy_id IS NULL) testimonials — skip these to avoid dupes. */
async function brandsWithAdminTestimonials(): Promise<Set<string>> {
  const rows = await prisma.programTestimonial.findMany({
    where: { legacyId: null, brandId: { not: null } },
    select: { brandId: true }, distinct: ['brandId'],
  });
  return new Set(rows.map((r) => r.brandId).filter((b): b is string => !!b));
}

async function migrateTextTestimonies(brandMap: Map<number, string>): Promise<void> {
  console.log('  Text testimonies...');
  const skipBrands = await brandsWithAdminTestimonials();
  const rows = await legacyQuery<LegacyTestimonyRow>(
    `SELECT id, program_category_id, person_name, testimony, occupation, institution,
            img_url, is_active, is_deleted
       FROM program_testimonies WHERE is_deleted = 0`,
  );
  for (const r of rows) {
    const brandId = r.program_category_id ? brandMap.get(r.program_category_id) ?? null : null;
    // Skip brands that already have admin-curated testimonials (unless this exact row
    // was migrated before — legacy_id upsert keeps re-runs stable).
    if (brandId && skipBrands.has(brandId)) {
      const already = await prisma.programTestimonial.findUnique({ where: { legacyId: r.id } });
      if (!already) { console.warn(`    SKIP testimony ${r.id}: brand already has admin testimonials`); continue; }
    }
    const data = {
      programId: null, brandId,
      name: r.person_name ?? 'Anonymous',
      role: r.occupation ?? null, company: r.institution ?? null,
      testimonial: r.testimony ?? '', type: 'text', category: 'alumni',
      avatarUrl: r.img_url ?? null, isActive: boolFrom(r.is_active),
    };
    await prisma.programTestimonial.upsert({
      where: { legacyId: r.id }, create: { ...data, legacyId: r.id }, update: data,
    });
  }
}

async function migrateGallery(
  brandMap: Map<number, string>,
  programMap: Map<number, ProgramRef>,
): Promise<void> {
  console.log('  Gallery (photos)...');

  // Build (brandId, year) -> programId. On ambiguity (e.g. batches), the lowest
  // legacy program id wins — deterministic and re-run stable.
  // programMap only contains `create`d programs (ignored ones were never added),
  // so photos can only ever resolve to a program we own.
  const byBrandYear = new Map<string, { programId: string; legacyOrder: number }>();
  for (const [legacyProgramId, ref] of programMap.entries()) {
    const key = `${ref.brandId}:${ref.year}`;
    const current = byBrandYear.get(key);
    if (!current || legacyProgramId < current.legacyOrder) {
      byBrandYear.set(key, { programId: ref.programId, legacyOrder: legacyProgramId });
    }
  }

  const rows = await legacyQuery<LegacyPhotoRow>(
    `SELECT id, program_category_id, title, year, description, img_url, is_active, is_deleted
       FROM program_photos WHERE is_deleted = 0`,
  );

  for (const r of rows) {
    const brandId = brandMap.get(r.program_category_id);
    if (!brandId) {
      console.warn(`    SKIP photo ${r.id}: no brand for category ${r.program_category_id}`);
      continue;
    }
    if (!r.img_url) continue;

    const key = `${brandId}:${r.year ?? 0}`;
    const target = byBrandYear.get(key);
    // Exact (brand, year) match only. If there is no migrated program for that exact
    // year (e.g. the year's edition was `ignore`d because the new DB owns it), SKIP
    // the photo rather than mis-attaching it to a different year's program.
    if (!target) {
      console.warn(`    SKIP photo ${r.id}: no migrated program for brand+year ${r.year}`);
      continue;
    }

    const data = {
      programId: target.programId, imageUrl: r.img_url,  // Phase B rewrites imageUrl
      title: r.title || null, description: r.description ?? null,
      year: r.year ?? null, type: 'image', order: r.id, isActive: boolFrom(r.is_active),
    };
    await prisma.programGallery.upsert({
      where: { legacyId: r.id }, create: { ...data, legacyId: r.id }, update: data,
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add services/api/prisma/migration-scripts/legacy-content/stages/brand-content.stage.ts
git commit -m "feat: brand-level content migration (text testimonials + gallery with year resolution)"
```

---

### Task 6.5: Generate & review the program mapping (de-dup decision record)

**Files:**
- Create: `services/api/prisma/migration-scripts/legacy-content/generate-program-mapping.ts`
- Create (by hand, after review): `services/api/prisma/migration-scripts/legacy-content/program-mapping.json`

> Run this against the SAME database the migration will target. For prod (Dokploy), run inside the API container per `reference_prod_access` (compile to JS, `scp`, `docker cp`, `docker exec`). For a local target, just `ts-node`.

- [ ] **Step 1: Implement the proposal generator**

```ts
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from './prisma-client';
import { legacyQuery } from './legacy-db';
import { LegacyProgramRow, LegacyCategoryRow } from './types';
import { slugify } from './mappers';

async function main(): Promise<void> {
  const brands = await prisma.brand.findMany({ select: { id: true, name: true } });
  const programs = await prisma.program.findMany({
    select: { id: true, name: true, slug: true, year: true, brandId: true },
  });
  const cats = await legacyQuery<LegacyCategoryRow>(
    'SELECT id, name FROM program_categories WHERE is_deleted = 0',
  );
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const legacyPrograms = await legacyQuery<LegacyProgramRow>(
    'SELECT id, program_category_id, name FROM programs WHERE is_deleted = 0',
  );

  const out: Record<string, { action: string; _note: string }> = {};
  for (const lp of legacyPrograms) {
    const brandName = catName.get(lp.program_category_id) ?? '';
    const brand = brands.find((b) => b.name.toLowerCase() === brandName.toLowerCase());
    const slug = slugify(lp.name);
    const exact = brand ? programs.find((p) => p.brandId === brand.id && p.slug === slug) : undefined;
    const sameBrand = brand ? programs.filter((p) => p.brandId === brand.id) : [];
    // Exact slug match -> the new DB already owns this program -> ignore the legacy copy.
    out[String(lp.id)] = exact
      ? { action: 'ignore', _note: `new DB owns this: ${exact.name} (${exact.slug})` }
      : {
          action: 'create',
          _note: `no exact match (brand="${brandName}"). Existing in brand: ${
            sameBrand.map((p) => `${p.slug}[${p.year}]`).join(', ') || 'none'
          }`,
        };
  }

  const p = path.resolve(__dirname, 'program-mapping.proposed.json');
  fs.writeFileSync(p, JSON.stringify(out, null, 2));
  console.log(`Wrote ${p}. REVIEW it, set near-matches to "ignore", then save as program-mapping.json.`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Generate the proposal**

Run (local target): `cd services/api && ts-node -r tsconfig-paths/register prisma/migration-scripts/legacy-content/generate-program-mapping.ts`
Expected: `program-mapping.proposed.json` written with one entry per legacy program.

- [ ] **Step 3: Review and hand-edit into `program-mapping.json`**

The generator auto-proposes `ignore` for exact slug matches (e.g. legacy `22` "Istanbul Youth Summit 2027" matches the existing `istanbul-youth-summit-2027`). It will NOT catch near-matches, which a human must set to `ignore`. Per the verified live state and stakeholder decision, the non-default entries are:

```json
{
  "12": { "action": "ignore", "_note": "MEYS 2026 — new DB owns Middle East Youth Summit 6th" },
  "21": { "action": "ignore", "_note": "MEYS the 6th — new DB owns Middle East Youth Summit 6th" },
  "22": { "action": "ignore", "_note": "IYS 2027 — new DB owns Istanbul Youth Summit 2027" }
}
```

Every legacy program id not listed defaults to `{ "action": "create" }`. Save the final file as `program-mapping.json`. Before running, eyeball the list of `create` ids and confirm none of them is actually already in the new DB under a differently-spelled slug.

- [ ] **Step 4: Commit the decision record**

```bash
git add services/api/prisma/migration-scripts/legacy-content/generate-program-mapping.ts \
        services/api/prisma/migration-scripts/legacy-content/program-mapping.json
git commit -m "feat: program-mapping generator + reviewed create/ignore decision record"
```

---

### Task 7: Orchestrator + npm script + dry run

**Files:**
- Create: `services/api/prisma/migration-scripts/legacy-content/migrate-legacy-content.ts`
- Modify: `services/api/package.json` (scripts)

- [ ] **Step 1: Implement the orchestrator**

```ts
import { prisma } from './prisma-client';
import { closeLegacyPool } from './legacy-db';
import { migrateBrands } from './stages/brands.stage';
import { migratePrograms } from './stages/programs.stage';
import { migrateProgramContent } from './stages/program-content.stage';
import { migrateBrandContent } from './stages/brand-content.stage';

async function main(): Promise<void> {
  console.log('=== Legacy content migration (Phase A: data) ===');
  console.log('Migrating brands...');
  const brandMap = await migrateBrands();
  console.log(`  ${brandMap.size} brands.`);

  console.log('Migrating programs...');
  const programMap = await migratePrograms(brandMap);
  console.log(`  ${programMap.size} programs.`);

  console.log('Migrating per-program content...');
  await migrateProgramContent(programMap);

  console.log('Migrating brand-level content...');
  await migrateBrandContent(brandMap, programMap);

  console.log('=== Phase A complete ===');
}

main()
  .catch((e) => { console.error('Migration failed:', e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await closeLegacyPool(); });
```

- [ ] **Step 2: Add npm scripts**

In `services/api/package.json` `scripts`, add:

```json
"migrate:legacy-content": "ts-node -r tsconfig-paths/register prisma/migration-scripts/legacy-content/migrate-legacy-content.ts",
"rehome:legacy-assets": "ts-node -r tsconfig-paths/register prisma/migration-scripts/legacy-content/asset-rehoming.ts"
```

- [ ] **Step 3: Run Phase A against the local DB**

Run: `cd services/api && npm run migrate:legacy-content`
Expected: logs ~7 brands, ~18 programs, then FAQ/speaker/award/news/schedule/testimonial/gallery counts with no thrown errors. Warnings for unresolved photo years are acceptable.

- [ ] **Step 4: Verify counts in Postgres**

Run:
```bash
cd services/api && npx prisma studio
# OR a psql one-liner:
psql "postgresql://ybb_user:ybb_password@localhost:5438/ybb_platform_db" -c \
"SELECT 'brands' t, count(*) FROM brands WHERE legacy_id IS NOT NULL
 UNION ALL SELECT 'programs', count(*) FROM programs WHERE legacy_id IS NOT NULL
 UNION ALL SELECT 'faqs', count(*) FROM program_faqs WHERE legacy_id IS NOT NULL
 UNION ALL SELECT 'speakers', count(*) FROM program_speakers WHERE legacy_id IS NOT NULL
 UNION ALL SELECT 'awards', count(*) FROM program_awards WHERE legacy_id IS NOT NULL
 UNION ALL SELECT 'announcements', count(*) FROM program_announcements WHERE legacy_id IS NOT NULL
 UNION ALL SELECT 'schedules', count(*) FROM program_schedules WHERE legacy_id IS NOT NULL
 UNION ALL SELECT 'gallery', count(*) FROM program_gallery WHERE legacy_id IS NOT NULL
 UNION ALL SELECT 'testimonials', count(*) FROM program_testimonials WHERE legacy_id IS NOT NULL;"
```
Expected: counts roughly matching legacy row counts (brands ~7, programs ~18, faqs ≤324, etc.).

- [ ] **Step 5: Verify idempotency — run again, counts unchanged**

Run: `cd services/api && npm run migrate:legacy-content`
Then re-run the count query from Step 4.
Expected: identical counts (upserts updated in place, created nothing new).

- [ ] **Step 6: Commit**

```bash
git add services/api/prisma/migration-scripts/legacy-content/migrate-legacy-content.ts services/api/package.json
git commit -m "feat: legacy content migration orchestrator + npm scripts"
```

---

### Task 8: Asset re-homing pass (Phase B)

**Files:**
- Create: `services/api/prisma/migration-scripts/legacy-content/asset-rehoming.ts`

Downloads each legacy `storage.ybbfoundation.com` asset and re-uploads it to the new file service, then rewrites the stored URL. A JSON cache (`asset-url-map.json`) makes re-runs skip already-copied assets. Idempotency guard: any URL that does not start with the legacy host is treated as already re-homed and skipped.

- [ ] **Step 1: Implement the re-homing pass**

```ts
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { prisma } from './prisma-client';

const LEGACY_HOST = 'storage.ybbfoundation.com';
const FILE_SERVICE_URL = process.env.FILE_SERVICE_URL ?? 'http://localhost:8000';
const INTERNAL_KEY =
  process.env.FILE_SERVICE_INTERNAL_KEY ?? process.env.INTERNAL_SERVICE_KEY ?? '';
// Dry runs set ASSET_BUCKET_PREFIX (e.g. "dryrun-") so uploads land in an isolated storage
// path that can be purged afterward, instead of mixing into real prod buckets. Empty for the real run.
const BUCKET_PREFIX = process.env.ASSET_BUCKET_PREFIX ?? '';
const CACHE_PATH = path.resolve(__dirname, 'asset-url-map.json');

type Cache = Record<string, string>;

function loadCache(): Cache {
  if (!fs.existsSync(CACHE_PATH)) return {};
  return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')) as Cache;
}
function saveCache(c: Cache): void {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(c, null, 2));
}

function isLegacy(url: string | null | undefined): url is string {
  return !!url && url.includes(LEGACY_HOST);
}

let systemUserId: string | null = null;
async function getSystemUserId(): Promise<string> {
  if (systemUserId) return systemUserId;
  // Prefer an explicit system user (decision 5); fall back to the first user.
  const explicit = process.env.SYSTEM_USER_ID?.trim();
  if (explicit) {
    const u = await prisma.user.findUnique({ where: { id: explicit }, select: { id: true } });
    if (!u) throw new Error(`SYSTEM_USER_ID=${explicit} not found in the new DB.`);
    systemUserId = u.id;
    return systemUserId;
  }
  const u = await prisma.user.findFirst({ select: { id: true } });
  if (!u) throw new Error('No user found to attribute uploads to; set SYSTEM_USER_ID or seed an admin user.');
  systemUserId = u.id;
  return systemUserId;
}

/** Download a legacy asset and re-upload to the file service. Returns the new URL (or original on failure). */
async function rehome(url: string, brandId: string, cache: Cache, bucket = 'gallery'): Promise<string> {
  if (cache[url]) return cache[url];
  try {
    const resp = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 30000 });
    const buf = Buffer.from(resp.data);
    const filename = url.split('/').pop() || 'asset';
    const contentType = (resp.headers['content-type'] as string) || 'application/octet-stream';

    const form = new FormData();
    form.append('file', buf, { filename, contentType });
    form.append('user_id', await getSystemUserId());
    form.append('brand_id', brandId);
    form.append('bucket', `${BUCKET_PREFIX}${bucket}`);

    const up = await axios.post(`${FILE_SERVICE_URL}/api/v1/files/upload`, form, {
      headers: { ...form.getHeaders(), 'x-internal-service-key': INTERNAL_KEY },
      maxContentLength: Infinity, maxBodyLength: Infinity, timeout: 60000,
    });
    const newUrl: string = up.data?.file?.url ?? up.data?.file?.download_url;
    if (!newUrl) throw new Error(`upload returned no url for ${url}`);
    cache[url] = newUrl;
    saveCache(cache);
    return newUrl;
  } catch (e) {
    console.warn(`    FAILED to rehome ${url}: ${(e as Error).message}. Leaving original URL.`);
    return url;
  }
}

async function main(): Promise<void> {
  if (!INTERNAL_KEY) throw new Error('FILE_SERVICE_INTERNAL_KEY not set.');
  console.log('=== Legacy asset re-homing (Phase B) ===');
  const cache = loadCache();

  // Brands: logoUrl, bannerUrl
  for (const b of await prisma.brand.findMany({ where: { legacyId: { not: null } } })) {
    const patch: Record<string, string> = {};
    if (isLegacy(b.logoUrl)) patch.logoUrl = await rehome(b.logoUrl, b.id, cache, 'brand');
    if (isLegacy(b.bannerUrl)) patch.bannerUrl = await rehome(b.bannerUrl, b.id, cache, 'brand');
    if (Object.keys(patch).length) await prisma.brand.update({ where: { id: b.id }, data: patch });
  }

  // Programs: bannerUrl
  for (const p of await prisma.program.findMany({ where: { legacyId: { not: null } } })) {
    if (isLegacy(p.bannerUrl)) {
      const u = await rehome(p.bannerUrl, p.brandId, cache, 'program');
      await prisma.program.update({ where: { id: p.id }, data: { bannerUrl: u } });
    }
  }

  // Gallery: imageUrl
  for (const g of await prisma.programGallery.findMany({
    where: { legacyId: { not: null } }, include: { program: { select: { brandId: true } } },
  })) {
    if (isLegacy(g.imageUrl)) {
      const u = await rehome(g.imageUrl, g.program.brandId, cache, 'gallery');
      await prisma.programGallery.update({ where: { id: g.id }, data: { imageUrl: u } });
    }
  }

  // Speakers: photoUrl
  for (const s of await prisma.programSpeaker.findMany({
    where: { legacyId: { not: null } }, include: { program: { select: { brandId: true } } },
  })) {
    if (isLegacy(s.photoUrl)) {
      const u = await rehome(s.photoUrl, s.program.brandId, cache, 'speaker');
      await prisma.programSpeaker.update({ where: { id: s.id }, data: { photoUrl: u } });
    }
  }

  // Announcements: imageUrl
  for (const a of await prisma.programAnnouncement.findMany({
    where: { legacyId: { not: null } }, include: { program: { select: { brandId: true } } },
  })) {
    if (isLegacy(a.imageUrl)) {
      const u = await rehome(a.imageUrl, a.program.brandId, cache, 'announcement');
      await prisma.programAnnouncement.update({ where: { id: a.id }, data: { imageUrl: u } });
    }
  }

  // Testimonials: avatarUrl (text). Video thumbnails point at YouTube and are left as-is.
  for (const t of await prisma.programTestimonial.findMany({ where: { legacyId: { not: null } } })) {
    if (isLegacy(t.avatarUrl) && t.brandId) {
      const u = await rehome(t.avatarUrl, t.brandId, cache, 'testimonial');
      await prisma.programTestimonial.update({ where: { id: t.id }, data: { avatarUrl: u } });
    }
  }

  console.log('=== Phase B complete ===');
}

main()
  .catch((e) => { console.error('Re-homing failed:', e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
```

- [ ] **Step 2: Run Phase B (requires file service running locally + env set)**

Run: `cd services/api && npm run rehome:legacy-assets`
Expected: assets download and re-upload; `asset-url-map.json` populates; URLs in DB switch off `storage.ybbfoundation.com`. Failures log a warning and leave the original URL (safe).

- [ ] **Step 3: Verify no legacy URLs remain (allow YouTube thumbnails)**

Run:
```bash
psql "postgresql://ybb_user:ybb_password@localhost:5438/ybb_platform_db" -c \
"SELECT 'brand_logo' src, count(*) FROM brands WHERE logo_url LIKE '%storage.ybbfoundation.com%'
 UNION ALL SELECT 'brand_banner', count(*) FROM brands WHERE banner_url LIKE '%storage.ybbfoundation.com%'
 UNION ALL SELECT 'program_banner', count(*) FROM programs WHERE banner_url LIKE '%storage.ybbfoundation.com%'
 UNION ALL SELECT 'gallery', count(*) FROM program_gallery WHERE image_url LIKE '%storage.ybbfoundation.com%'
 UNION ALL SELECT 'speaker', count(*) FROM program_speakers WHERE photo_url LIKE '%storage.ybbfoundation.com%'
 UNION ALL SELECT 'announcement', count(*) FROM program_announcements WHERE image_url LIKE '%storage.ybbfoundation.com%';"
```
Expected: all zero (or a small count of assets that 404'd on the legacy host, logged in Step 2).

- [ ] **Step 4: Idempotency — re-run, confirm cache hits and no duplicate uploads**

Run: `cd services/api && npm run rehome:legacy-assets`
Expected: every asset resolves from `asset-url-map.json` (no new uploads); DB unchanged.

- [ ] **Step 5: Commit**

```bash
git add services/api/prisma/migration-scripts/legacy-content/asset-rehoming.ts
git commit -m "feat: phase B asset re-homing pass with idempotent URL cache"
```

---

### Task 9: End-to-end verification & spot check

**Files:** none (verification only)

- [ ] **Step 1: Spot-check a known brand+program in the new DB**

Run:
```bash
psql "postgresql://ybb_user:ybb_password@localhost:5438/ybb_platform_db" -c \
"SELECT b.name brand, p.name program, p.year, p.status,
        (SELECT count(*) FROM program_faqs f WHERE f.program_id=p.id) faqs,
        (SELECT count(*) FROM program_speakers s WHERE s.program_id=p.id) speakers,
        (SELECT count(*) FROM program_gallery g WHERE g.program_id=p.id) photos
 FROM programs p JOIN brands b ON b.id=p.brand_id
 WHERE p.legacy_id IS NOT NULL ORDER BY b.name, p.year;"
```
Expected: rows for Istanbul Youth Summit, Middle East Youth Summit (MEYS), etc., with non-zero content where the legacy program had it.

- [ ] **Step 2: Cross-check against legacy totals**

Compare the Postgres counts (Task 7 Step 4) against legacy counts:
Run: `node -r ts-node/register -e "import('./prisma/migration-scripts/legacy-content/legacy-db').then(async m=>{for(const t of ['program_faqs','program_speakers','program_awards','program_announcements','program_schedules','program_rundowns','program_photos','program_testimonies','program_video_testimonies']){const [r]=await m.legacyQuery('SELECT COUNT(*) c FROM '+t+' WHERE is_deleted=0');console.log(t, r.c)} await m.closeLegacyPool()})"`
Expected: new-DB counts ≥ matchable legacy counts minus rows whose `program_id`/`program_category_id` could not be resolved (those are logged as SKIP during migration). Investigate any unexpectedly large gap.

- [ ] **Step 2b: Duplicate-detection guardrails (must pass)**

Run:
```bash
psql "$TARGET_DB_URL" -c "
-- (a) No two programs share the same (brand, slug).
SELECT brand_id, slug, count(*) FROM programs GROUP BY brand_id, slug HAVING count(*) > 1;
-- (b) The admin-curated programs were IGNORED, so they must stay unanchored (legacy_id IS NULL)
--     and carry NO legacy content.
SELECT p.name, p.legacy_id,
       (SELECT count(*) FROM program_faqs f WHERE f.program_id=p.id AND f.legacy_id IS NOT NULL) legacy_faqs,
       (SELECT count(*) FROM program_gallery g WHERE g.program_id=p.id AND g.legacy_id IS NOT NULL) legacy_gallery
FROM programs p WHERE p.slug IN ('middle-east-youth-summit-6th','china-youth-summit-2026','istanbul-youth-summit-2027');"
```
Expected: query (a) returns ZERO rows (no duplicate programs). Query (b) shows `legacy_id` IS NULL and `legacy_faqs = 0`, `legacy_gallery = 0` for all three (they were ignored and never touched).

- [ ] **Step 2c: Confirm curated content counts are unchanged**

Before running the migration, record the content counts for `china-youth-summit-2026` and `middle-east-youth-summit-6th` (live-state baseline: China 27 faqs / 32 gallery / 2 announcements; MEYS 6th 25 faqs / 15 gallery). After migration, re-run the per-program count query from Task 9 Step 1 and confirm those numbers are IDENTICAL.
Expected: no change to curated programs.

- [ ] **Step 2d: Confirm program count grew only by created + history-stub programs**

Expected: total programs = 3 (pre-existing) + (legacy programs marked `create`) + (history stubs for orphan photo years). Ignored legacy ids (12, 21, 22, plus any auto-detected exact matches) contribute nothing. Identify stubs with `SELECT name, year FROM programs WHERE legacy_id >= 9000000 ORDER BY name;` and sanity-check the list (e.g. "Middle East Youth Summit 2023", "World Youth Fest 2023", "... (Archive)").

- [ ] **Step 3: Visual check in the running app (optional but recommended)**

Use the `run` skill or the admin dashboard to open a migrated past program and confirm photos, speakers, and news render with working image URLs.

- [ ] **Step 4: Final commit (if any verification fixes were needed)**

```bash
git add -A && git commit -m "test: verify legacy content migration end-to-end"
```

---

## Decisions (RESOLVED 2026-05-31) + remaining notes

0. **Program mapping (de-dup) — RESOLVED.** The new DB is authoritative; any legacy program already present there is `ignore`d. Confirmed `ignore`: legacy `12`, `21` (MEYS 2026/6th) and `22` (IYS 2027). Korea `9` vs `18` ("Batch 2") confirmed as genuinely different editions → both `create`. Still review the auto-generated proposal once before running to catch any differently-spelled near-match.

0b. **Ignored programs left entirely alone — RESOLVED (yes).** An ignored legacy program is not created, merged, or anchored; its new-DB twin keeps `legacy_id = NULL`; none of its content migrates. Backfilling an empty existing program later remains a deliberate future change, not the default.

0c. **Auto-created "history" program stubs — RESOLVED (yes, create them, published & visible).** ~66% of legacy photos (52 of 79: MEYS 2023/2024, WYF 2023, Japan 2024, YAF 2024, plus 4 undated IYS photos) belong to years with no `programs` row. The migration auto-creates a minimal **published, visible** `Program` per orphan `(brand, year)` (e.g. "Middle East Youth Summit 2023"; undated → "<Brand> (Archive)", year 0) so the galleries display as past editions.

1. **Asset re-homing (Phase B) is MANDATORY — RESOLVED.** Legacy storage (`storage.ybbfoundation.com`) will be DELETED once everything is migrated here, so Phase B is required, not optional: every legacy URL must be copied into the new file service before legacy storage is torn down. Do NOT delete legacy storage until Task 8 Step 3 (zero remaining legacy URLs) passes. Phase A may go live first, but Phase B must complete before legacy teardown.
2. **`program_schedules` + `program_rundowns` — RESOLVED (merge both).** Both feed `ProgramSchedule` (rundowns offset by 2,000,000). Confirmed: keep both. If a program shows duplicated agenda rows, the admin can hide extras.
3. **Preserve extra legacy fields — RESOLVED (add columns).** Task 1 now adds `ProgramSpeaker.{instagramUrl, sessionTitle, sessionDescription, sessionTime, isKeynote, expertiseAreas}` and `ProgramAnnouncement.{slug, metaTitle, metaDescription}`, and the stages populate them. `program_categories.{core_values, objectives, benefits, tagline}` remain parked in `Brand.metadata` JSON (no dedicated fields requested).
4. **Video testimonial naming — RESOLVED (adjust).** Name is derived from the description (first line, truncated at 80 chars), falling back to "Alumni Testimonial". See `videoTestimonialName`.
5. **System user for uploads — RESOLVED (explicit id).** Phase B uses `SYSTEM_USER_ID` from env when set (the stakeholder will provide it), else falls back to the first `User`. Add the id to `.env` before running Phase B.
6. **`program_subthemes` (~82) NOT migrated (note).** New model `ProgramSubtheme` exists and legacy has the data, but subthemes are out of the confirmed scope. Adding it later is a single stage keyed by legacy `program_id` with the same skip-for-ignored pattern.
7. **Decimal input (note).** `Program.usdInIdr` is `Decimal?`; the ETL passes the MySQL `double` through. Prisma accepts a JS number for Decimal; if precision warnings appear, wrap with `new Prisma.Decimal(...)`.

---

## Self-Review Notes

- **Spec coverage:** every in-scope legacy table has a stage and a verification query. Assets handled in Phase B.
- **Idempotency:** every write is an upsert keyed on `legacy_id` (with offsets where two source tables share one target). Re-run verified in Task 7 Step 5 and Task 8 Step 4.
- **De-duplication:** brands match existing rows by normalized name and are only anchored + empty-backfilled (never overwritten); programs use the human-reviewed `program-mapping.json` (create vs ignore) — ignored programs are skipped entirely and never enter the program map, so their content is dropped automatically; gallery attaches only on exact (brand, year); brands with curated testimonials are skipped. Guardrail queries in Task 9 Steps 2b/2c/2d assert zero duplicate programs, unchanged curated content, and that ignored programs stayed unanchored.
- **Orphan-year photos:** ~66% of legacy photos belong to years with no `programs` row; `ensureHistoryPrograms()` creates a stub Program per orphan `(brand, year)` (synthetic `legacy_id >= 9_000_000`) so no historical gallery is silently dropped, while respecting existing admin programs for the same year.
- **Type consistency:** `ProgramRef { programId, brandId, year }` is defined in `programs.stage.ts`; `uniqueSlug` is exported from there and reused by `ensureHistoryPrograms`; `progId()` returns null for any legacy id absent from the map (ignored/unresolved); mapper signatures match their tests.
- **Anchor-space disjointness:** real program legacy ids (1-22); rundown schedules `+2_000_000`; video testimonials `+2_000_000` (different table); history-stub programs `>= 9_000_000`. No collisions within any single target table.
- **No placeholders:** all SQL, mapping logic, and commands are concrete.

---

## Production Execution Log (2026-05-31)

Dry-run validated on a VPS scratch DB (`ybb_platform_dryrun`), then executed against production `ybb_platform_db`.

**Backup:** `/tmp/ybb_platform_db_PRERUN_20260531_054939.dump` on the VPS (pre-run, `pg_dump -Fc`).

**Phase A (content) — `migrate-legacy-content.cjs`:** 15 historical programs created, 7 history stubs, 3 editions ignored (legacy 12/21/22), all per-program + brand-level content migrated. Verified: no duplicate `(brand, slug)`, curated programs (China 2026, MEYS 6th, IYS 2027) untouched (`legacy_id NULL`, zero legacy content), all 79 photos placed.

**Phase B (assets) — `rehome-legacy-assets.cjs`:** 452 assets downloaded from `storage.ybbfoundation.com` and re-uploaded to the file service (clean buckets, attributed to `SYSTEM_USER_ID = bf5375d5-...` "YBB Super Admin"). 0 failures, 0 legacy URLs remain. Legacy storage can be retired.

**Announcements / news completeness — `backfill-ignored-announcements.cjs`:** The "ignore" rule had skipped news on the current editions (legacy 12/21/22). Per stakeholder direction ("news is brand-level, migrate all"), ALL 387 legacy announcements are now present (no title dedup); announcements from ignored editions are attached to their brand's newest published+visible program. MEYS example: 52 on "6th" + 10 on "2025" = 62.

**Landing query change — `src/modules/landing/strategies/announcements.strategy.ts`:** news now shows for every *published + visible* program in a brand (gate changed from `isActive` to `isVisibleToUsers`), so completed/inactive past programs' news always shows; result cap raised 10 → 50. Landing snapshot rows (`page='announcements'`) and Redis `landing:*` keys were cleared.

**Schema reconciliation:** the new columns (content `legacy_id` anchors, speaker session/instagram fields, announcement `slug`/`meta`) were applied to prod via raw DDL during the run; the tracked Prisma migration `20260531120000_add_legacy_content_fields` is idempotent (`IF NOT EXISTS`) so `prisma migrate deploy` records it as a no-op on prod and creates the columns on fresh/staging DBs.

### Remaining deploy steps (not done by the migration)

1. **Redeploy the API** so the regenerated Prisma client exposes the new fields (announcement `slug`/`meta`, speaker session/instagram) and the `announcements.strategy.ts` change takes effect. The deploy runs `prisma migrate deploy` (records the migration).
2. **Revalidate the frontend** brand landing sites (e.g. `middleeastyouthsummit.com`, Next.js ISR) so the new content renders.
3. **Cleanup (optional):** drop the scratch DB `ybb_platform_dryrun`; purge the earlier dry-run uploads under `dryrun-*` storage paths + their file-service DB records.

### Runnable scripts (raw SQL, run in-container; see `migration-scripts/legacy-content/README.md`)

- `migrate-legacy-content.cjs` — Phase A content migration (idempotent).
- `rehome-legacy-assets.cjs` — Phase B asset re-homing (idempotent; `ASSET_BUCKET_PREFIX` isolates dry-run uploads).
- `backfill-ignored-announcements.cjs` — migrate news from ignored editions (idempotent).
- `migrate-legacy-content.md` design reference: this plan.
