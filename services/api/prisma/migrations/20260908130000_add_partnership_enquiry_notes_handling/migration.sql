-- Internal admin notes + who/when handled a partnership enquiry. All three
-- are nullable with no backfill: 38 existing prod rows are all status
-- 'pending' and untouched by an admin yet, so there is nothing to backfill.
-- No CHECK constraint on status — it stays a free-text VarChar(20) like the
-- rest of the model.
ALTER TABLE "partnership_enquiries"
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "handled_by" UUID,
  ADD COLUMN IF NOT EXISTS "handled_at" TIMESTAMPTZ(6);
