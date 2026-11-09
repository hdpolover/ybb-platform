-- Migration: add_funding_decision
-- Created: 2026-11-09
-- Additive and idempotent only (migrations auto-run on release; must be replay-safe).
--
-- Fully-funded selection outcome, recorded by admins and shown on the participant
-- portal. All columns nullable, no backfill: there is no reliable list of past
-- results, and null means "no result recorded".

DO $$ BEGIN
  CREATE TYPE "FundingDecision" AS ENUM ('awarded', 'not_awarded');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "participant_applications"
  ADD COLUMN IF NOT EXISTS "funding_decision" "FundingDecision",
  ADD COLUMN IF NOT EXISTS "funding_decided_at" TIMESTAMPTZ(6);

ALTER TABLE "programs"
  ADD COLUMN IF NOT EXISTS "funding_results_announced_at" TIMESTAMPTZ(6);
