-- Migration: 017_add_soft_delete_to_payment_intents.sql
-- Description: Restore deleted_at column on payment_intents.
--              The PaymentIntent entity embeds gorm.DeletedAt, so GORM
--              appends "WHERE deleted_at IS NULL" in queries.
--              Without this column, create/find flows fail with SQLSTATE 42703.

ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_payment_intents_deleted_at ON payment_intents(deleted_at);
