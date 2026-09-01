-- Migration: add_social_feed_program_id
-- Created: 2026-09-01
-- Additive only. Adds an optional per-program association to
-- brand_social_feeds so the home landing page can show an edition-specific
-- Instagram feed instead of broadcasting the same brand-wide feed to every
-- program edition. NULL program_id keeps existing rows working unchanged as
-- brand-wide fallback posts — see home.strategy.ts for the read-side logic.

ALTER TABLE "brand_social_feeds"
  ADD COLUMN IF NOT EXISTS "program_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'brand_social_feeds_program_id_fkey'
      AND table_name = 'brand_social_feeds'
  ) THEN
    ALTER TABLE "brand_social_feeds"
      ADD CONSTRAINT "brand_social_feeds_program_id_fkey"
      FOREIGN KEY ("program_id")
      REFERENCES "programs"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "brand_social_feeds_brand_id_program_id_is_active_idx"
  ON "brand_social_feeds" ("brand_id", "program_id", "is_active");
