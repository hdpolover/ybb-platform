-- Idempotency log for submission-deadline reminder emails (H-7 / H-3 / H-1
-- before programs.application_deadline). Unique constraint enforces
-- at-most-once send per (application, offset) regardless of cron restarts,
-- redeploys, or retries.
CREATE TABLE submission_reminder_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id  UUID NOT NULL,
  reminder_offset INTEGER NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX submission_reminder_logs_app_offset_key
  ON submission_reminder_logs (application_id, reminder_offset);
