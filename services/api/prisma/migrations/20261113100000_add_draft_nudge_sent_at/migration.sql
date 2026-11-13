-- Claim markers for the draft-registration nudge cron
-- (DraftRegistrationNudgeService): nudge 1 (createdAt+2d) and nudge 2
-- (createdAt+7d). Nullable, no default: instant metadata-only ADD COLUMN.
ALTER TABLE "participant_applications"
  ADD COLUMN IF NOT EXISTS "draft_nudge_1_sent_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "draft_nudge_2_sent_at" TIMESTAMPTZ(6);

-- The hourly candidate scan is "recent, non-legacy drafts still owed a nudge,
-- oldest first". The table is ~343k rows, almost all legacy imports; the
-- existing status / program indexes would walk every draft. This partial
-- index holds only non-legacy live drafts (tens of thousands at most), so the
-- scan is a range read on created_at. Plain CREATE INDEX (not
-- CONCURRENTLY: Prisma wraps the migration in a transaction); the build over
-- 343k rows takes well under a second and only briefly blocks writes.
CREATE INDEX IF NOT EXISTS "idx_apps_draft_nudge_candidates"
  ON "participant_applications" ("created_at")
  WHERE "status" = 'draft'
    AND "deleted_at" IS NULL
    AND "legacy_id" IS NULL
    AND "draft_nudge_2_sent_at" IS NULL;
