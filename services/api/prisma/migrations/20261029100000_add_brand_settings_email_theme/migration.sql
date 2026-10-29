-- Migration: add_brand_settings_email_theme
-- Created: 2026-10-29
-- Additive and idempotent only (migrations auto-run on release; must be replay-safe).
--
-- Per-brand promotional-email look (Listmonk campaign template source). Nullable
-- JSON, no backfill: null means "derive everything from the brand's own fields".

ALTER TABLE "brand_settings"
  ADD COLUMN IF NOT EXISTS "email_theme" JSON;
