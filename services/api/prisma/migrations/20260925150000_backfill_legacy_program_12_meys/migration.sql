-- prisma/migrations/20260925150000_backfill_legacy_program_12_meys/migration.sql
--
-- Why: migrate-legacy-participants.cjs's own "no new-prod program found with
-- legacy_id in [...]" preflight check (see migration-scripts/legacy-participants/
-- migrate-legacy-participants.cjs, `missingPrograms` warning) turned up exactly
-- one gap across every id in MAPPED_LEGACY_PROGRAM_IDS: legacy program 12
-- ("Middle East Youth Summit 2026", event 2026-03-30..2026-04-02, ~23.7K legacy
-- `participants` rows, 28 legacy `program_announcements` rows) has no
-- corresponding new-prod `programs` row at all. Every other id in
-- (1,2,3,4,5,6,7,8,9,10,11,16,17,18,20) already resolves — verified directly:
--   SELECT unnest(ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,16,17,18,20]) AS legacy_id
--   EXCEPT SELECT legacy_id FROM programs WHERE legacy_id IS NOT NULL;
-- returned only `12`.
--
-- This is NOT the same event as new-prod's "Middle East Youth Summit 6th"
-- (legacy_id NULL, event 2026-12-07..2026-12-10 — a later, distinct 2026
-- edition). Mapping legacy 12 onto "6th" would corrupt both; this migration
-- creates legacy 12's own row instead. (Separately, and NOT fixed by this
-- migration: legacy 12's 28 `program_announcements` rows were already
-- imported by an earlier pass, but mis-attached to "6th" — see README
-- "Legacy program 12 (MEYS) — missing program row" for the verification
-- query and why re-pointing them is left as a follow-up, not bundled here.)
--
-- Fields cloned from the real legacy `programs` row (id=12, read-only
-- `SELECT`/`DESCRIBE` against the legacy DB, verified 2026-09-25): name, year,
-- theme, start_date, end_date, description (legacy `�` mojibake in three
-- SDG bullet separators normalized to the en-dash the same subthemes use on
-- the sibling 2025-edition row, e.g. "SDG 4 – Quality Education" —
-- content-only cleanup, no field dropped). `application_deadline` has no
-- legacy equivalent column; set to `start_date`, matching the same pattern
-- already on the sibling legacy_id=8 (2025 edition) row where
-- application_deadline = start_date.
--
-- Publish/registration flags mirror the 2025 edition (legacy_id=8) row
-- exactly — a genuinely past, closed edition, not the currently-open "6th" —
-- read directly off that row: is_published=true, is_visible_to_users=true,
-- is_active=false, allow_registration=false, status='completed',
-- registration_open_date/registration_close_date=NULL, currency='USD',
-- require_payment=false.
--
-- brand_id resolved via `brands.legacy_id = 3` (the existing
-- brandByLegacyCategoryId mapping migrate-legacy-participants.cjs already
-- uses), matching legacy `programs.program_category_id = 3` for row id=12 —
-- verified, not assumed.
--
-- Idempotent: guarded by `NOT EXISTS` on `legacy_id` and `ON CONFLICT
-- (legacy_id) DO NOTHING` (unique index already exists on
-- `programs.legacy_id`, see original schema), so a re-run of this migration
-- (or a re-run of `prisma migrate deploy` against a database that already has
-- this row) is a safe no-op. Never touches any other program row.

INSERT INTO "programs" (
    "id", "brand_id", "name", "slug", "description", "theme", "year",
    "start_date", "end_date", "application_deadline",
    "is_published", "is_visible_to_users", "is_active", "status",
    "currency", "require_payment", "allow_registration",
    "legacy_id", "created_at", "updated_at"
)
SELECT
    uuid_generate_v4(),
    b."id",
    'Middle East Youth Summit 2026',
    'middle-east-youth-summit-2026',
    $desc$<p class="ql-align-justify"><strong style="background-color: transparent; color: rgb(0, 0, 0);">MEYS MAIN THEME</strong></p><p class="ql-align-center"><strong>Global Muslim Youth Collaboration for Sustainable Development</strong></p><p><strong style="background-color: transparent; color: rgb(0, 0, 0);">SUBTHEMES</strong></p><p><br></p><ul><li class="ql-align-justify"><strong style="background-color: transparent;">SDG 4 – Quality Education</strong></li></ul><p class="ql-align-justify"><span style="color: rgb(0, 0, 0);">Empowering Muslim Youth Through Accessible, Inclusive, and Future-Ready Education</span>.</p><ul><li class="ql-align-justify"><strong style="background-color: transparent;">SDG 5 – Gender Equality</strong></li></ul><p class="ql-align-justify">Advancing Gender Equity and Empowerment within Muslim Communities<span style="background-color: transparent;">.</span></p><ul><li class="ql-align-justify"><strong style="background-color: transparent;">SDG 10 – Reduced Inequality</strong></li></ul><p class="ql-align-justify">Building Inclusive Muslim Societies by Reducing Social and Economic Gaps.</p><ul><li class="ql-align-justify"><strong style="background-color: transparent;">SDG 16 – Peace, Justice, and Strong Institutions</strong></li></ul><p class="ql-align-justify">Promoting Peacebuilding, Ethical Leadership, and Good Governance in the Muslim World.</p><ul><li class="ql-align-justify"><strong style="background-color: transparent;">SDG 17 – Partnerships for the Goals</strong></li></ul><p class="ql-align-justify">Strengthening Global Muslim Youth Networks for Collaborative Action.</p><p><br></p>$desc$,
    'Global Muslim Youth Collaboration for Sustainable Development',
    2026,
    '2026-03-30'::date,
    '2026-04-02'::date,
    '2026-03-30'::timestamptz,
    true,   -- is_published, mirrors legacy_id=8 (2025 edition)
    true,   -- is_visible_to_users, mirrors legacy_id=8
    false,  -- is_active ("accept applications"), mirrors legacy_id=8 (closed)
    'completed',
    'USD',
    false,  -- require_payment, mirrors legacy_id=8
    false,  -- allow_registration, mirrors legacy_id=8 (closed)
    12,
    now(),
    now()
FROM "brands" b
WHERE b."legacy_id" = 3
  AND NOT EXISTS (SELECT 1 FROM "programs" p WHERE p."legacy_id" = 12)
ON CONFLICT ("legacy_id") DO NOTHING;
