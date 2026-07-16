-- Move essay guideline fields from per-essay rows to program-level columns.
ALTER TABLE "programs"
ADD COLUMN "essay_guideline_text" TEXT,
ADD COLUMN "essay_guideline_url" VARCHAR(500);

-- Backfill program-level guideline using the first active essay that has values.
WITH ranked_guidelines AS (
  SELECT
    pe."program_id",
    pe."guideline_text",
    pe."guideline_url",
    ROW_NUMBER() OVER (
      PARTITION BY pe."program_id"
      ORDER BY pe."order" ASC, pe."created_at" ASC
    ) AS rn
  FROM "program_essays" pe
  WHERE pe."deleted_at" IS NULL
    AND (pe."guideline_text" IS NOT NULL OR pe."guideline_url" IS NOT NULL)
)
UPDATE "programs" p
SET
  "essay_guideline_text" = rg."guideline_text",
  "essay_guideline_url" = rg."guideline_url"
FROM ranked_guidelines rg
WHERE rg.rn = 1
  AND p."id" = rg."program_id";

ALTER TABLE "program_essays"
DROP COLUMN "guideline_text",
DROP COLUMN "guideline_url";
