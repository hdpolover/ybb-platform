CREATE TABLE IF NOT EXISTS "payment_outbox_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "event_type" VARCHAR(120) NOT NULL,
    "aggregate_type" VARCHAR(64) NOT NULL,
    "aggregate_id" VARCHAR(128) NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupe_key" VARCHAR(191) NOT NULL,
    "correlation_id" VARCHAR(191),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "payment_outbox_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_outbox_events_status_check" CHECK ("status" IN ('pending', 'processing', 'failed', 'published', 'dead'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_outbox_events_dedupe_key_key"
    ON "payment_outbox_events"("dedupe_key");

CREATE INDEX IF NOT EXISTS "idx_payment_outbox_status_next_attempt_at"
    ON "payment_outbox_events"("status", "next_attempt_at");

CREATE INDEX IF NOT EXISTS "idx_payment_outbox_aggregate"
    ON "payment_outbox_events"("aggregate_type", "aggregate_id");
