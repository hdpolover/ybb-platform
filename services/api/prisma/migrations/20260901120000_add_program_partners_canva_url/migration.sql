-- Additive only. Adds a per-program Canva embed URL for the Partners page.
-- The page aggregates partners/sponsors across ALL currently-active
-- programs of a brand, but the embed used to live only on
-- Brand.metadata.partners_canva_url — a single slot, so two concurrently
-- running program editions of the same brand had nowhere to both put a
-- Canva embed. Moving it to a per-program column lets the API render one
-- embed per active program (see partners-sponsors.strategy.ts).
ALTER TABLE "programs"
  ADD COLUMN IF NOT EXISTS "partners_canva_url" VARCHAR(500);

-- Backfill rule: copy each brand's existing metadata->>'partners_canva_url'
-- onto exactly ONE program per brand — the brand's primary currently-active,
-- non-draft edition.
--
-- Why exactly one, not every active program: the brand-level value represented
-- a SINGLE embed on the partners page. Seeding it onto every active edition
-- would render that same Canva once per edition, each under a different
-- program heading -- e.g. Middle East Youth Summit has both its 6th and 7th
-- editions active at once, so a copy-to-all backfill would duplicate one
-- embed as "6th" and "7th". Seeding one edition preserves today's rendering
-- exactly; admins then set the second edition's own URL via
-- PUT /programs/:id/partners-canva-url, which is the whole point of the change.
--
-- Which one: the edition whose registration closes soonest (NULLs last, then
-- newest year), matching how the rest of the landing layer picks the edition
-- currently taking registrations -- see shared/utils/active-program-resolver.ts.
--
-- Note: `metadata` is declared `@db.Json` (not jsonb) in schema.prisma, so the
-- jsonb `?` existence operator is unavailable -- presence is checked via
-- ->>'key' IS NOT NULL instead.
--
-- Brand.metadata.partners_canva_url is intentionally NOT cleared here: the API
-- strategy still reads it as a fallback whenever no active program has a value
-- (mid-rollout safety net), and it is the rollback path if the per-program
-- column is abandoned.
WITH primary_program AS (
  SELECT DISTINCT ON (p."brand_id")
         p."id",
         btrim(b."metadata"->>'partners_canva_url') AS canva_url
  FROM "programs" p
  JOIN "brands" b ON b."id" = p."brand_id"
  WHERE btrim(coalesce(b."metadata"->>'partners_canva_url', '')) <> ''
    AND p."is_active" = true
    AND p."status" <> 'draft'
    AND p."deleted_at" IS NULL
  ORDER BY p."brand_id",
           p."registration_close_date" ASC NULLS LAST,
           p."year" DESC NULLS LAST,
           p."id"
)
UPDATE "programs" p
SET "partners_canva_url" = pp.canva_url
FROM primary_program pp
WHERE p."id" = pp."id"
  AND p."partners_canva_url" IS NULL;
