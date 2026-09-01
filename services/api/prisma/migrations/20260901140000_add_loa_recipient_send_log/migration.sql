-- Migration: add_loa_recipient_send_log
-- Created: 2026-09-01
-- Additive and idempotent only. Migrations auto-run on API boot in
-- production, so this must be safe to replay: every statement is guarded by
-- IF NOT EXISTS or a catalog check, every column is either nullable or has a
-- default, and nothing here rewrites or locks an existing table.
--
-- Per-recipient audit trail for the LOA-ready ("your Invitation Letter is
-- ready") email fanned out when an admin releases a batch. Before this, a
-- per-recipient send failure was caught and logged inside the notification
-- service's loop and never surfaced anywhere queryable, so "did this
-- participant get their letter?" was only answerable from container logs
-- (~2 day retention, while batches are released weeks apart).
--
-- NO BACKFILL: the per-recipient outcome for batches already released was
-- never recorded anywhere durable, and the container logs that held it have
-- since rotated. There is no historical data to backfill and this migration
-- deliberately invents none — existing batches simply have no rows and the
-- read endpoint reports them as unrecorded rather than as "0 sent".

CREATE TABLE IF NOT EXISTS "loa_batch_recipient_sends" (
  "id"                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "batch_id"            UUID NOT NULL,
  "program_id"          UUID NOT NULL,
  "participant_id"      UUID NOT NULL,
  "user_id"             UUID NOT NULL,
  -- Snapshot of the address actually used, not a join to users.email: the
  -- audit question is "where did it go", not "where would it go today".
  "email"               VARCHAR(255) NOT NULL,
  "status"              VARCHAR(20) NOT NULL DEFAULT 'pending',
  "provider_message_id" VARCHAR(255),
  "error_message"       TEXT,
  "attempt_count"       INTEGER NOT NULL DEFAULT 0,
  "sent_at"             TIMESTAMPTZ(6),
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

-- One row per (batch, participant). This is what makes a re-release update
-- the existing row in place (bumping attempt_count) instead of appending a
-- duplicate — see LoaBatchRecipientSendRepository.markPending/markResult.
CREATE UNIQUE INDEX IF NOT EXISTS "loa_batch_recipient_sends_batch_participant_key"
  ON "loa_batch_recipient_sends" ("batch_id", "participant_id");

-- Read path: summary counts and the failed-recipient list for one batch.
CREATE INDEX IF NOT EXISTS "loa_batch_recipient_sends_batch_id_status_idx"
  ON "loa_batch_recipient_sends" ("batch_id", "status");

CREATE INDEX IF NOT EXISTS "loa_batch_recipient_sends_program_id_idx"
  ON "loa_batch_recipient_sends" ("program_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'loa_batch_recipient_sends_batch_id_fkey'
      AND table_name = 'loa_batch_recipient_sends'
  ) THEN
    ALTER TABLE "loa_batch_recipient_sends"
      ADD CONSTRAINT "loa_batch_recipient_sends_batch_id_fkey"
      FOREIGN KEY ("batch_id")
      REFERENCES "loa_release_batches"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- `status` is a plain varchar rather than a Postgres enum so this migration
-- stays additive (no CREATE TYPE, no future ALTER TYPE ... ADD VALUE which
-- cannot run inside a transaction). The CHECK gives the same guarantee and
-- is trivially droppable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'loa_batch_recipient_sends_status_check'
      AND table_name = 'loa_batch_recipient_sends'
  ) THEN
    ALTER TABLE "loa_batch_recipient_sends"
      ADD CONSTRAINT "loa_batch_recipient_sends_status_check"
      CHECK ("status" IN ('pending', 'sent', 'failed'));
  END IF;
END $$;
