-- Migration: Replace AuditLog with DataChangeLog
-- This migration:
-- 1. Adds new enum values to ChangeType and ChangedByType
-- 2. Creates the new data_change_logs table (consolidates audit_logs)
-- 3. Migrates existing audit_logs data into data_change_logs
-- 4. Drops the old audit_logs table

-- Step 1: Add new enum values
ALTER TYPE "ChangeType" ADD VALUE IF NOT EXISTS 'bulk_update';
ALTER TYPE "ChangedByType" ADD VALUE IF NOT EXISTS 'webhook';

-- Step 2: Create new table
CREATE TABLE "data_change_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(255),
    "action" "ChangeType" NOT NULL,
    "changed_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "before_state" JSONB,
    "after_state" JSONB,
    "actor_type" "ChangedByType" NOT NULL DEFAULT 'system',
    "actor_id" UUID,
    "source" VARCHAR(50),
    "endpoint" VARCHAR(255),
    "http_method" VARCHAR(10),
    "event" VARCHAR(255),
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "risk_level" "RiskLevel" NOT NULL DEFAULT 'low',
    "reason" TEXT,
    "correlation_id" UUID,
    "status" VARCHAR(50),
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_change_logs_pkey" PRIMARY KEY ("id")
);

-- Step 3: Create indexes
CREATE INDEX "data_change_logs_entity_type_entity_id_idx" ON "data_change_logs"("entity_type", "entity_id");
CREATE INDEX "data_change_logs_actor_id_idx" ON "data_change_logs"("actor_id");
CREATE INDEX "data_change_logs_action_idx" ON "data_change_logs"("action");
CREATE INDEX "data_change_logs_risk_level_idx" ON "data_change_logs"("risk_level");
CREATE INDEX "data_change_logs_created_at_idx" ON "data_change_logs"("created_at");
CREATE INDEX "data_change_logs_correlation_id_idx" ON "data_change_logs"("correlation_id");
CREATE INDEX "data_change_logs_event_idx" ON "data_change_logs"("event");

-- Step 4: Migrate existing audit_logs data into data_change_logs
INSERT INTO "data_change_logs" (
    "id",
    "entity_type",
    "entity_id",
    "action",
    "after_state",
    "actor_type",
    "actor_id",
    "source",
    "event",
    "ip_address",
    "user_agent",
    "status",
    "error_message",
    "created_at"
)
SELECT
    "id",
    COALESCE("entity_type", 'Unknown'),
    "entity_id",
    'create'::"ChangeType",
    "payload",
    'system'::"ChangedByType",
    "actor_id",
    'rabbitmq',
    "event",
    "ip_address",
    "user_agent",
    "status",
    "error_message",
    "created_at"
FROM "audit_logs";

-- Step 5: Drop old audit_logs table
DROP TABLE "audit_logs";
