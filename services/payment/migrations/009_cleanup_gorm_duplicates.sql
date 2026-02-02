-- Migration: 009_cleanup_gorm_duplicates.sql
-- Description: Drops redundant column created by GORM mismatch in dev
-- Author: GitHub Copilot

ALTER TABLE payment_transactions DROP COLUMN IF EXISTS intent_id;
