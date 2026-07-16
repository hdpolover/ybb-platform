-- Migration: 016_add_soft_delete_to_payment_methods.sql
-- Description: Restore deleted_at column on payment_methods.
--              Migration 005 (reset_payment_v2) dropped and recreated this
--              table without deleted_at, but the GORM entity embeds
--              gorm.DeletedAt which automatically appends
--              "WHERE deleted_at IS NULL" to every query.  Without this
--              column all FindByID / FindAll calls fail with a SQL error.

ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_payment_methods_deleted_at ON payment_methods(deleted_at);
