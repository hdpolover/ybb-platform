-- Phase 1 of dual-pricing migration (additive only).
-- Adds nullable usd_price/idr_price to program_pricing_tiers and
-- payment_info_html to programs. Existing price/currency columns are kept
-- in place; they are dropped in a later phase once all code paths migrate.
-- All three new columns must remain NULLABLE in this step. Backfill happens
-- in Phase 2; NOT NULL is enforced in Phase 5.

-- AlterTable
ALTER TABLE "program_pricing_tiers"
    ADD COLUMN "usd_price" DECIMAL(10,2),
    ADD COLUMN "idr_price" DECIMAL(15,0);

-- AlterTable
ALTER TABLE "programs"
    ADD COLUMN "payment_info_html" TEXT;
