-- Add program-level exchange rate (USD to IDR)
ALTER TABLE "programs" ADD COLUMN "usd_in_idr" DECIMAL(10, 2);

-- Create exchange rate history table for audit trail
CREATE TABLE "program_exchange_rate_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "old_rate" DECIMAL(10, 2) NOT NULL,
    "new_rate" DECIMAL(10, 2) NOT NULL,
    "changed_by" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_exchange_rate_history_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "program_exchange_rate_history_program_id_idx" ON "program_exchange_rate_history"("program_id");
CREATE INDEX "program_exchange_rate_history_created_at_idx" ON "program_exchange_rate_history"("created_at");

-- Foreign keys
ALTER TABLE "program_exchange_rate_history" ADD CONSTRAINT "program_exchange_rate_history_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "program_exchange_rate_history" ADD CONSTRAINT "program_exchange_rate_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrate existing brand-level exchange rates to all programs under each brand
UPDATE "programs" p
SET "usd_in_idr" = bs."usd_in_idr"
FROM "brand_settings" bs
WHERE p."brand_id" = bs."brand_id"
  AND bs."usd_in_idr" IS NOT NULL;
