-- Migration: add_readiness_tables
-- Created: 2026-09-08
-- Additive and idempotent only. Migrations auto-run on API boot in
-- production, so this must be safe to replay: every statement is guarded by
-- IF NOT EXISTS, every column is either nullable or has a value supplied by
-- the application, and nothing here rewrites or locks an existing table.
--
-- Publish-readiness persistence for the readiness rule engine:
--   readiness_overrides       - admin-issued suppression of one rule for one
--                               brand/program, until revoked or expired.
--   readiness_snapshots       - the last-evaluated result per subject, one
--                               row per (subject_type, subject_id), replaced
--                               on every re-evaluation rather than
--                               accumulated, so list views can sort/filter
--                               without re-running rules.
--   readiness_alert_baselines - the nightly alert cron's own record of which
--                               blockers it already knew about per subject.
--                               Kept separate from readiness_snapshots,
--                               which the read path (GET a readiness panel)
--                               overwrites on every request.
--
CREATE TABLE IF NOT EXISTS "readiness_overrides" (
  "id"          UUID NOT NULL DEFAULT uuid_generate_v4(),
  "subject_type" VARCHAR(20) NOT NULL,
  "subject_id"   UUID NOT NULL,
  "rule_id"      VARCHAR(100) NOT NULL,
  "admin_id"     UUID NOT NULL,
  "reason"       TEXT NOT NULL,
  "expires_at"   TIMESTAMPTZ(6),
  "revoked_at"   TIMESTAMPTZ(6),
  "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at"   TIMESTAMPTZ(6),

  CONSTRAINT "readiness_overrides_pkey" PRIMARY KEY ("id")
);

-- Lookup path: findActiveOverrides(subjectType, subjectId).
CREATE INDEX IF NOT EXISTS "readiness_overrides_subject_type_subject_id_idx"
  ON "readiness_overrides" ("subject_type", "subject_id");

-- Admin lookup by rule across subjects.
CREATE INDEX IF NOT EXISTS "readiness_overrides_rule_id_idx"
  ON "readiness_overrides" ("rule_id");

CREATE TABLE IF NOT EXISTS "readiness_snapshots" (
  "subject_type"  VARCHAR(20) NOT NULL,
  "subject_id"    UUID NOT NULL,
  "brand_id"      UUID NOT NULL,
  "subject_name"  VARCHAR(255) NOT NULL DEFAULT '',
  "brand_name"    VARCHAR(255),
  "result"        JSONB NOT NULL,
  "blocker_count" INTEGER NOT NULL,
  "warning_count" INTEGER NOT NULL,
  "unknown_count" INTEGER NOT NULL DEFAULT 0,
  "evaluated_at"  TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "readiness_snapshots_pkey" PRIMARY KEY ("subject_type", "subject_id")
);

-- Replayable column adds, in case CREATE TABLE above already ran against an
-- older column set in some environment before this migration was amended.
ALTER TABLE "readiness_snapshots" ADD COLUMN IF NOT EXISTS "subject_name" VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE "readiness_snapshots" ADD COLUMN IF NOT EXISTS "brand_name" VARCHAR(255);
ALTER TABLE "readiness_snapshots" ADD COLUMN IF NOT EXISTS "unknown_count" INTEGER NOT NULL DEFAULT 0;

-- Brand-scoped list view: all program snapshots under one brand.
CREATE INDEX IF NOT EXISTS "readiness_snapshots_brand_id_idx"
  ON "readiness_snapshots" ("brand_id");

CREATE TABLE IF NOT EXISTS "readiness_alert_baselines" (
  "subject_type"     VARCHAR(20) NOT NULL,
  "subject_id"       UUID NOT NULL,
  "blocker_rule_ids" JSONB NOT NULL,
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "readiness_alert_baselines_pkey" PRIMARY KEY ("subject_type", "subject_id")
);
