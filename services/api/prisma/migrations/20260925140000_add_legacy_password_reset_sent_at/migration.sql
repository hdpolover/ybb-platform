-- Legacy participant migration: proactive password-reset notification tracking.
--
-- Migrated participants (users.legacy_id IS NOT NULL) get password_hash = NULL
-- and no UserIdentity row (see migration-scripts/legacy-participants/README.md
-- "Auth / password migration - decision"). The owner decided these accounts
-- should be proactively emailed a password-reset link, reusing the existing
-- forgot-password token/email mechanism (see ForgotPasswordHandler). This
-- column records when that one-time notification was sent per user so the
-- companion script (notify-legacy-password-reset.cjs) can skip already-notified
-- rows on rerun instead of re-emailing them.
--
-- Written idempotently (IF NOT EXISTS), matching the 20260531120000 and
-- 20260925130000 convention.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "legacy_password_reset_sent_at" TIMESTAMPTZ(6);
