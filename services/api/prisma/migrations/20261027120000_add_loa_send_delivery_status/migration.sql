-- Migration: add_loa_send_delivery_status
-- Created: 2026-10-27
-- Additive and idempotent only (migrations auto-run on release; must be replay-safe).
--
-- Resend delivery webhook state for loa_batch_recipient_sends. `status` only
-- records that Resend accepted the message; these columns record whether it
-- was actually delivered / bounced / flagged as spam (ops ticket #127).
-- All nullable, no backfill: history before the webhook was wired has no data.

ALTER TABLE "loa_batch_recipient_sends"
  ADD COLUMN IF NOT EXISTS "delivery_status"     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "delivered_at"        TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "bounced_at"          TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "bounce_type"         TEXT,
  ADD COLUMN IF NOT EXISTS "complained_at"       TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "delivery_updated_at" TIMESTAMPTZ(6);

-- Webhook lookup key: every event is matched on Resend's email id.
CREATE INDEX IF NOT EXISTS "loa_batch_recipient_sends_provider_message_id_idx"
  ON "loa_batch_recipient_sends" ("provider_message_id");
