-- Migration: add_user_locked_until
-- Created: 2026-09-02
-- Additive and idempotent only. Migrations auto-run on API boot in
-- production, so this must be safe to replay: the column is nullable and
-- the statement is guarded by IF NOT EXISTS.
--
-- failed_login_attempts was already incremented on every bad password but
-- nothing ever read it back, so it never actually locked an account.
-- locked_until closes that loop: once the failure count reaches the
-- configured threshold the login handlers stamp this column, and future
-- attempts are rejected until it elapses.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMPTZ(6);
