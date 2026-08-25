-- Additive only. Nothing reads these columns yet — see Global Constraints
-- in docs/superpowers/plans/2026-08-24-program-content-copy-phase-3.md for
-- why this must deploy alone before any backfill or read-switch task runs.
ALTER TABLE "programs"
  ADD COLUMN IF NOT EXISTS "contact_email" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "contact_phone" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "contact_whatsapp" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "contact_address" TEXT,
  ADD COLUMN IF NOT EXISTS "meta_keywords" TEXT,
  ADD COLUMN IF NOT EXISTS "landing_content" JSON NOT NULL DEFAULT '{}';
