# Form Field Catalog & Templates — Rollout Guide

**Target release:** form-field catalog V2 (replaces free-form `field_key` input).
**Spec:** `docs/superpowers/specs/2026-04-19-form-field-catalog-and-templates-design.md`.
**Plan:** `docs/superpowers/plans/2026-04-19-form-field-catalog-and-templates.md`.

This doc is for the person cutting the release. The code is on branch `dev` (commits `dd66f0c` through `603a353` plus a few spec/plan doc commits). Everything builds, 60+ new unit/integration tests pass, baseline of 32 pre-existing failing tests is unchanged.

## What's shipping

**Backend (NestJS + Prisma):**
- New tables `system_form_field_definitions`, `application_form_templates`, `application_form_template_fields`.
- New columns `source` + `system_field_key` on `application_form_fields`, plus a partial unique index `(program_id, name) WHERE deleted_at IS NULL`.
- Reserved-key validator that blocks custom fields from shadowing magic keys or active catalog keys.
- New endpoints (all under `/v1/`):
  - `GET /system-form-fields` (admin+) — list catalog
  - `POST /system-form-fields` / `PATCH /:id` / `DELETE /:id` (super-admin) — catalog CRUD
  - `GET /form-templates` / `GET /:id` (admin+)
  - `POST /form-templates` / `PATCH /:id` / `DELETE /:id` (super-admin) — template CRUD
  - `POST /programs/:programId/form-fields/apply-template` (admin+) — append/replace apply
- Existing `POST /programs/:id/form-fields` and `PUT /programs/form-fields/:id` now enforce the validator + system-field linkage.

**Admin dashboard (Next.js):**
- "Add Field" → new catalog picker (system fields grouped by category, search, magic-field visual treatment, Create-custom fallback).
- Custom-field editor hides the storage key behind an Advanced toggle; auto-slugs from the label.
- "Copy from template" button + dialog on the program form-fields page (append/replace with typed REPLACE confirmation).
- Super-admin pages at `/platform/system-form-fields` and `/platform/form-templates`.
- Create-program flow offers to apply the default template after a new program is created.

**Legacy migration:**
- `npm run migrate:form-field-catalog` (in `services/api`) reclassifies existing rows via a legacy-alias map, rewrites `personalData` JSON keys transactionally when needed, and deduplicates `(program_id, name)` collisions. Idempotent.

## Pre-flight checklist

Before shipping:

- [ ] **CI green.** `npm test` in `services/api` should exit with the same failure count as before this branch (32 pre-existing, unrelated to form fields). Compare numbers explicitly.
- [ ] **Admin dashboard builds.** `npm run build` in `services/admin-dashboard` exits 0.
- [ ] **Schema migration reviewed.** Open `services/api/prisma/migrations/20260419133848_add_form_field_catalog_and_templates/migration.sql` and confirm it matches the spec's data model (3 new tables, 2 new columns, 1 partial unique index, expected FKs and indexes).
- [ ] **Drift check.** `git status` on `dev` should show no unrelated working-tree changes; if it does, address them before cutting.

## Deploy sequence

### Step 1 — Apply the Prisma migration

The migration is additive (no destructive ALTERs on existing columns). Safe to run in production:

```bash
cd services/api
DATABASE_URL=$PROD_DATABASE_URL npm run migration:run
```

The actual command invokes `npx prisma migrate deploy`, which applies pending migrations in order. Verify in psql:

```sql
SELECT * FROM _prisma_migrations WHERE migration_name = '20260419133848_add_form_field_catalog_and_templates';
```

Expected: one row with `applied_steps_count = 1` and `rolled_back_at IS NULL`.

### Step 2 — Seed the catalog + default template

Seed is idempotent (upserts by `key`). Run:

```bash
DATABASE_URL=$PROD_DATABASE_URL npx ts-node -r tsconfig-paths/register -e "\
import('./prisma/seeds/seed-system-form-fields').then(async m => { await m.seedSystemFormFields(); \
  const t = await import('./prisma/seeds/seed-form-templates'); await t.seedFormTemplates(); process.exit(0); \
}).catch(e => { console.error(e); process.exit(1); })"
```

Expected output:
```
✓ Seeded 30 system form field definitions
✓ Seeded template "Standard Program Application" with 28 fields
```

Verify:

```sql
SELECT COUNT(*) FROM system_form_field_definitions;   -- 30
SELECT COUNT(*) FROM application_form_templates WHERE deleted_at IS NULL;  -- 1
SELECT COUNT(*) FROM application_form_template_fields;  -- 28
```

### Step 3 — Run the legacy classifier

Reclassifies existing `application_form_fields` rows (legacy-alias map + system-vs-custom tagging) and rewrites `personalData` JSON keys for affected applications.

```bash
DATABASE_URL=$PROD_DATABASE_URL npm run migrate:form-field-catalog
```

The script logs a report object. Capture it and archive with the release notes. Expected shape (values will vary):

```js
{
  migratedToSystem: <n>,      // rows whose name already matches a catalog/magic key
  aliasedAndRenamed: <n>,     // rows with a legacy name renamed to canonical
  keptAsCustom: <n>,          // rows that stay source='custom'
  flaggedInvalid: <n>,        // custom rows whose name fails the format regex (now tagged)
  deduped: <n>,               // duplicate (program_id, name) rows soft-deleted
  personalDataRowsUpdated: <n>  // applications whose personalData JSON was rewritten
}
```

Spot-check afterwards:

```sql
-- Legacy names should be gone from active rows:
SELECT name, COUNT(*) FROM application_form_fields
WHERE deleted_at IS NULL
  AND name IN ('birthdate', 'resume_url', 'picture_url', 'contact_relation',
               'ref_code_ambassador', 'source_account_name', 'knowledge_source')
GROUP BY name;
-- Expected: zero rows.

-- Canonical names should exist (counts vary):
SELECT name, COUNT(*) FROM application_form_fields
WHERE deleted_at IS NULL
  AND name IN ('date_of_birth', 'cv_upload', 'profile_picture',
               'emergency_contact_relation', 'ambassador_referral_code',
               'referral_source_detail', 'referral_source')
GROUP BY name;
```

If the script errors mid-run, it's transactional per-program-per-alias. Rerun it — it's idempotent.

### Step 4 — Deploy the API

Standard deployment of the `services/api` image. The new endpoints will be registered at `/v1/system-form-fields`, `/v1/form-templates`, and `/v1/programs/:programId/form-fields/apply-template`.

**Smoke test after deploy (with a super-admin token):**

```bash
TOKEN=<super-admin-jwt>
BASE=https://api.<env>.ybb.id

curl -s "$BASE/v1/system-form-fields" -H "Authorization: Bearer $TOKEN" | jq 'length'
# Expected: 30

curl -s "$BASE/v1/form-templates" -H "Authorization: Bearer $TOKEN" | jq '.[0].fieldCount'
# Expected: 28
```

### Step 5 — Deploy the admin dashboard

Standard deployment of the `services/admin-dashboard` image. The new entry points are available at:

- Program detail → Form Fields → "Add Field" button opens the catalog picker.
- Program detail → Form Fields → "Copy from template" button opens the template picker.
- `/platform/system-form-fields` — super-admin catalog management.
- `/platform/form-templates` — super-admin template management.

**Smoke test:**

1. Log in as super-admin.
2. Open any program's form fields page.
3. Click "Add Field" → verify catalog appears grouped by category, search works, magic-field entries have the blue tint + ⚙️.
4. Pick "T-Shirt Size" → verify the system-field config sheet opens with the stored-as caption + read-only preview of options. Save. Field appears in the table.
5. Click "Add Field" → "Create custom field" → type label "Volunteer Experience" → verify caption shows `volunteer_experience` + "advanced" link. Save. Field appears.
6. Click "Add Field" → "Create custom field" → type label "T-Shirt Size" → try to save. Verify it's rejected with a reserved-key message.
7. Click "Copy from template" → pick "Standard Program Application" → preview shows 28 fields → mode = append → Apply. Verify a sonner toast summarizes added/skipped.
8. Create a new program via `/platform/programs` → verify the default-template prompt appears after creation.

## Rollback

If something goes wrong after the migration applies:

**The migration itself:** the Prisma migration is one-way-forward. To roll back, you'd write a down-migration manually that drops the new tables and columns. Don't auto-generate a revert — the legacy-classifier migration has already rewritten `application_form_fields.name` values and `personalData` JSON keys, so a naive revert would leave data stranded.

**The admin dashboard:** revert to the previous image. The backend still accepts `POST /programs/:id/form-fields` without `source` and falls back to the `custom` default. No data corruption.

**The API:** revert to the previous image. The new tables become unused but cause no harm. Existing endpoints still work (they just don't enforce the new validator).

**The legacy classifier:** if it misclassified, the `validation_rules._legacy_name` marker on renamed rows preserves the original name. You can write a one-off reverse script using those markers.

## Known follow-ups (not in this release)

- **Applicant portal renderers for `country` and `phone` types.** The catalog tags these types; rendering a searchable dropdown (`country-state-city`) and E.164 phone input (`libphonenumber-js`) lives in `ybb-program-next`. Design is documented in spec §6.3.
- **Portal submission snapshot regression test.** Plan Task 6.1. Guards against the legacy classifier or API changes altering what applicants see. Write before the next schema touch.
- **Template field editing via UI.** Current super-admin template page edits metadata only; field-list changes go through the seed script. Low priority — templates rarely change structurally.
- **Cross-program per-field analytics.** The catalog makes this tractable (keys are consistent across programs). Deferred per spec §3.

## Commit range

This release spans commits `dd66f0c` (first schema commit) through `603a353` (country field type) on the `dev` branch. Also includes docs/plan updates (`176262e`, `5af809b`, `aed59ce`).

Capture the range at release time:

```bash
git log --oneline dd66f0c^..HEAD -- services/api/prisma services/api/src/modules/programs \
                                     services/admin-dashboard/app/components/submissionsMasterData \
                                     services/admin-dashboard/app/platform/system-form-fields \
                                     services/admin-dashboard/app/platform/form-templates \
                                     services/admin-dashboard/app/platform/programs/page.tsx \
                                     docs/superpowers
```
