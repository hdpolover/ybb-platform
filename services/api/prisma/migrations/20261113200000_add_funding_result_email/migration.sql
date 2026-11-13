-- FF result emails (FundingResultEmailService). Opt-in per program: some
-- programs already emailed results by hand, so default false = send nothing.
ALTER TABLE "programs"
  ADD COLUMN IF NOT EXISTS "funding_result_emails_enabled" BOOLEAN NOT NULL DEFAULT false;

-- Claim marker, nullable no default: metadata-only ADD COLUMN.
ALTER TABLE "participant_applications"
  ADD COLUMN IF NOT EXISTS "funding_result_email_sent_at" TIMESTAMPTZ(6);

-- The hourly candidate scan is "decided, not yet emailed, oldest decision
-- first". participant_applications is ~343k rows and has no index on
-- funding_decision, so without this the scan reads the whole table every hour.
-- The partial index holds only decided-and-unsent rows (a few thousand at most;
-- rows leave it as they are claimed), ordered by decision time. Plain CREATE
-- INDEX (Prisma wraps migrations in a transaction); sub-second on this table.
CREATE INDEX IF NOT EXISTS "idx_apps_funding_result_email_candidates"
  ON "participant_applications" ("funding_decided_at")
  WHERE "funding_decision" IS NOT NULL
    AND "funding_result_email_sent_at" IS NULL
    AND "deleted_at" IS NULL;
