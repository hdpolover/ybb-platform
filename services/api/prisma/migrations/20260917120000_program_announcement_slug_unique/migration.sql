-- Migration: program_announcement_slug_unique
-- Created: 2026-09-17
--
-- Why: public news links are /announcements/<uuid>. The client wants readable
-- ones (/announcements/kwon-hae-suk-explores-ai-for-inclusive-global-communities).
-- program_announcements.slug already exists (20260531120000_add_legacy_content_fields)
-- but was never read or written by the API: legacy-imported rows carry a
-- hyphenated, globally unique slug, every admin-created row has NULL. A slug can
-- only be a URL if every row has one and no two rows share one, so this
-- migration backfills the NULLs and makes the column NOT NULL + UNIQUE.
--
-- Rules:
--   * An existing non-empty slug is kept verbatim. Those are the legacy slugs,
--     and keeping them means nothing already stored changes.
--   * A NULL/blank slug is generated from the title with the SAME transform as
--     src/shared/utils/url-slug.ts toUrlSlug(): NFKD, strip combining marks,
--     lowercase, non [a-z0-9] runs -> '-', trim hyphens, cap at 200. A title
--     that yields nothing (e.g. all Hangul), or that yields a UUID-shaped
--     string (public lookup would read it as an id), falls back to
--     'announcement-' || first 8 chars of the id.
--   * Uniqueness is global and includes soft-deleted rows, because the unique
--     index does. Collisions are resolved with -2, -3 ... suffixes; a row whose
--     slug pre-dates this migration always wins over a generated one, then the
--     older row wins. The loop repeats because a suffixed slug can itself
--     collide with an existing "foo-2".
--   * If duplicates somehow remain, the DO block raises and the migration
--     fails BEFORE the NOT NULL / unique index, rather than half-applying.
--
-- Requires a UTF8 database (normalize() is UTF8-only); every environment is
-- postgres:15 with the default UTF8 encoding.

-- Session temp table, not ON COMMIT DROP: whether the script runs as one
-- transaction or statement by statement, it must survive until the DO block.
DROP TABLE IF EXISTS _announcement_slug_generated;
CREATE TEMP TABLE _announcement_slug_generated (id uuid PRIMARY KEY);

WITH targets AS (
  SELECT id,
         rtrim(
           left(
             trim(both '-' from regexp_replace(
               lower(regexp_replace(normalize(title, NFKD), '[\u0300-\u036f]', '', 'g')),
               '[^a-z0-9]+', '-', 'g'
             )),
             200
           ),
           '-'
         ) AS generated
  FROM "program_announcements"
  WHERE "slug" IS NULL OR btrim("slug") = ''
),
marked AS (
  INSERT INTO _announcement_slug_generated (id)
  SELECT id FROM targets
  RETURNING id
)
UPDATE "program_announcements" pa
SET "slug" = CASE
               WHEN t.generated = ''
                 OR t.generated ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
               THEN 'announcement-' || left(pa.id::text, 8)
               ELSE t.generated
             END
FROM targets t
WHERE pa.id = t.id;

DO $$
DECLARE
  pass integer := 0;
  remaining integer;
BEGIN
  LOOP
    SELECT count(*) INTO remaining
    FROM (
      SELECT "slug" FROM "program_announcements" GROUP BY "slug" HAVING count(*) > 1
    ) dupes;

    EXIT WHEN remaining = 0 OR pass >= 10;
    pass := pass + 1;

    WITH ranked AS (
      SELECT pa.id,
             pa."slug",
             row_number() OVER (
               PARTITION BY pa."slug"
               ORDER BY (g.id IS NOT NULL), pa."created_at", pa.id
             ) AS rn
      FROM "program_announcements" pa
      LEFT JOIN _announcement_slug_generated g ON g.id = pa.id
    )
    UPDATE "program_announcements" pa
    SET "slug" = rtrim(left(r."slug", 200 - length('-' || r.rn::text)), '-') || '-' || r.rn::text
    FROM ranked r
    WHERE pa.id = r.id AND r.rn > 1;
  END LOOP;

  IF remaining > 0 THEN
    RAISE EXCEPTION 'program_announcements.slug still has % duplicated value(s) after % dedupe passes', remaining, pass;
  END IF;
END $$;

DROP TABLE _announcement_slug_generated;

ALTER TABLE "program_announcements" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "program_announcements_slug_key" ON "program_announcements"("slug");
