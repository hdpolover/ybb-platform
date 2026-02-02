-- Migration: 010_rename_program_category_to_brand.sql
-- Description: Rename program_category_id to brand_id in payment_gateway_configs to match Platform Domain Language
-- Author: GitHub Copilot

-- 1. Rename column in payment_gateway_configs
DO $$
BEGIN
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='payment_gateway_configs' AND column_name='program_category_id') THEN
        ALTER TABLE payment_gateway_configs RENAME COLUMN program_category_id TO brand_id;
    END IF;
END $$;

-- 2. Rename index if exists
DO $$
BEGIN
    IF EXISTS(SELECT 1 FROM pg_indexes WHERE indexname = 'idx_pgc_program_category') THEN
        ALTER INDEX idx_pgc_program_category RENAME TO idx_pgc_brand;
    END IF;
END $$;
