-- Add `cancelled` value to PaymentStatus enum so application invoices
-- can be auto-cancelled when a participant switches application category.
-- This is an additive enum change (no data backfill or column changes).

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'cancelled';
