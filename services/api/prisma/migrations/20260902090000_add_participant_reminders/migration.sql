-- Migration: add_participant_reminders
-- Created: 2026-09-02
-- Additive and idempotent only. Migrations auto-run on API boot in
-- production, so this must be safe to replay: every statement is guarded by
-- IF NOT EXISTS or a catalog check, every column is either nullable or has a
-- default, and nothing here rewrites or locks an existing table.
--
-- Admin-drafted, admin-scheduled reminder emails to a computed audience of
-- participants in one program, plus the per-recipient send log for them.
-- The first (and for now only) audience is `registration_fee_unpaid`.
--
-- NO BACKFILL: this replaces a manual CSV export + external mail blast that
-- left no trace in this database at all. There is nothing to backfill and
-- this migration deliberately invents nothing.

CREATE TABLE IF NOT EXISTS "participant_reminders" (
  "id"             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "program_id"     UUID NOT NULL,
  -- Which audience query this reminder targets.
  "audience"       VARCHAR(50) NOT NULL DEFAULT 'registration_fee_unpaid',
  "subject"        VARCHAR(255) NOT NULL,
  -- Plain text with {{participant_name}} / {{program_name}} tokens, escaped
  -- and wrapped in the shared email layout by services/notification.
  "body"           TEXT NOT NULL,
  -- Absolute instant. The admin UI always sends an explicit +07:00 (WIB)
  -- offset and the API rejects offset-less values, so this is never a wall
  -- clock reinterpreted against the container's TZ.
  "scheduled_at"   TIMESTAMPTZ(6),
  "status"         VARCHAR(20) NOT NULL DEFAULT 'draft',
  "dispatched_at"  TIMESTAMPTZ(6),
  "sent_at"        TIMESTAMPTZ(6),
  "cancelled_at"   TIMESTAMPTZ(6),
  -- Audience size snapshotted at dispatch. Nullable (never dispatched), and
  -- 0 is a real recorded outcome, not a missing one.
  "audience_count" INTEGER,
  "created_by"     UUID NOT NULL,
  "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

-- Admin list view: one program's reminders, newest first, filtered by status.
CREATE INDEX IF NOT EXISTS "participant_reminders_program_id_status_idx"
  ON "participant_reminders" ("program_id", "status");

-- Dispatcher hot path: every minute it asks for status='scheduled' AND
-- scheduled_at <= now(). Without this it seq-scans the whole table each run.
CREATE INDEX IF NOT EXISTS "participant_reminders_status_scheduled_at_idx"
  ON "participant_reminders" ("status", "scheduled_at");

-- Plain varchar + CHECK rather than a Postgres enum so adding the next
-- reminder type or status stays a purely additive migration: CREATE TYPE is
-- not idempotent and ALTER TYPE ... ADD VALUE cannot run inside a
-- transaction. A CHECK gives the same guarantee and is trivially droppable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'participant_reminders_status_check'
      AND table_name = 'participant_reminders'
  ) THEN
    ALTER TABLE "participant_reminders"
      ADD CONSTRAINT "participant_reminders_status_check"
      CHECK ("status" IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'participant_reminders_audience_check'
      AND table_name = 'participant_reminders'
  ) THEN
    ALTER TABLE "participant_reminders"
      ADD CONSTRAINT "participant_reminders_audience_check"
      CHECK ("audience" IN ('registration_fee_unpaid'));
  END IF;
END $$;

-- A scheduled reminder without a send time is unsendable, and the dispatcher
-- would silently never pick it up. Enforced here rather than only in the DTO
-- so no future code path can create one.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'participant_reminders_scheduled_at_required_check'
      AND table_name = 'participant_reminders'
  ) THEN
    ALTER TABLE "participant_reminders"
      ADD CONSTRAINT "participant_reminders_scheduled_at_required_check"
      CHECK ("status" <> 'scheduled' OR "scheduled_at" IS NOT NULL);
  END IF;
END $$;

-- ─── Per-recipient send log ──────────────────────────────────────────────────
-- Written as `pending` rows BEFORE the dispatch event is published, then
-- flipped to sent/failed by ReminderSendResultsController when
-- services/notification reports outcomes back. Mirrors
-- loa_batch_recipient_sends exactly.

CREATE TABLE IF NOT EXISTS "participant_reminder_sends" (
  "id"                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "reminder_id"         UUID NOT NULL,
  "program_id"          UUID NOT NULL,
  "participant_id"      UUID NOT NULL,
  "user_id"             UUID NOT NULL,
  -- Snapshot of the address actually used, not a join to users.email.
  "email"               VARCHAR(255) NOT NULL,
  "status"              VARCHAR(20) NOT NULL DEFAULT 'pending',
  "provider_message_id" VARCHAR(255),
  "error_message"       TEXT,
  "attempt_count"       INTEGER NOT NULL DEFAULT 0,
  "sent_at"             TIMESTAMPTZ(6),
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

-- One row per (reminder, participant). This is the last line of defence
-- against double-mailing: even if the dispatcher were re-entered, the insert
-- of an existing pair cannot append a second row.
CREATE UNIQUE INDEX IF NOT EXISTS "participant_reminder_sends_reminder_participant_key"
  ON "participant_reminder_sends" ("reminder_id", "participant_id");

-- Read path: summary counts and the failed-recipient list for one reminder.
CREATE INDEX IF NOT EXISTS "participant_reminder_sends_reminder_id_status_idx"
  ON "participant_reminder_sends" ("reminder_id", "status");

CREATE INDEX IF NOT EXISTS "participant_reminder_sends_program_id_idx"
  ON "participant_reminder_sends" ("program_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'participant_reminder_sends_reminder_id_fkey'
      AND table_name = 'participant_reminder_sends'
  ) THEN
    ALTER TABLE "participant_reminder_sends"
      ADD CONSTRAINT "participant_reminder_sends_reminder_id_fkey"
      FOREIGN KEY ("reminder_id")
      REFERENCES "participant_reminders"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'participant_reminder_sends_status_check'
      AND table_name = 'participant_reminder_sends'
  ) THEN
    ALTER TABLE "participant_reminder_sends"
      ADD CONSTRAINT "participant_reminder_sends_status_check"
      CHECK ("status" IN ('pending', 'sent', 'failed'));
  END IF;
END $$;
