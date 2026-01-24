-- Migration: 006_fix_gorm_mismatch.sql
-- Description: Align schema with GORM structural requirements

-- 1. Rename is_enabled to is_active (handle collision)
DO $$
BEGIN
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='payment_methods' AND column_name='is_enabled') THEN
        IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='payment_methods' AND column_name='is_active') THEN
            -- Both exist. Drop old one.
            ALTER TABLE payment_methods DROP COLUMN is_enabled;
        ELSE
            -- Target doesn't exist. Rename.
            ALTER TABLE payment_methods RENAME COLUMN is_enabled TO is_active;
        END IF;
    END IF;
END $$;

-- 2. Add display_name
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);
UPDATE payment_methods SET display_name = name WHERE display_name IS NULL;
ALTER TABLE payment_methods ALTER COLUMN display_name SET NOT NULL;

-- 3. icon (rename logo_url)
DO $$
BEGIN
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='payment_methods' AND column_name='logo_url') THEN
        IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='payment_methods' AND column_name='icon') THEN
             ALTER TABLE payment_methods DROP COLUMN logo_url;
        ELSE
             ALTER TABLE payment_methods RENAME COLUMN logo_url TO icon;
        END IF;
    END IF;
END $$;

-- 4. type (varchar + lowercase)
-- Convert enum to text first to handle casting
ALTER TABLE payment_methods ALTER COLUMN type TYPE VARCHAR(20) USING type::TEXT;
UPDATE payment_methods SET type = LOWER(type);

-- 5. Flatten manual fields
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS account_number VARCHAR(100);
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS account_name VARCHAR(255);
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS requires_proof BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS admin_instructions TEXT;

-- 6. Migrate data from manual_payment_details
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'manual_payment_details') THEN
        UPDATE payment_methods pm
        SET 
            bank_name = mpd.provider_name,
            account_number = mpd.account_number,
            account_name = mpd.account_holder,
            instructions = mpd.instruction_text,
            requires_proof = TRUE
        FROM manual_payment_details mpd
        WHERE pm.id = mpd.payment_method_id;
    END IF;
END $$;

-- 7. Drop normalized table
DROP TABLE IF EXISTS manual_payment_details;

-- 8. Add constraint on Name to match GORM unique
ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS uni_payment_methods_name;
ALTER TABLE payment_methods ADD CONSTRAINT uni_payment_methods_name UNIQUE (name);

-- 9. Add other missing columns
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS config JSONB;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS gateway_name VARCHAR(50);
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS gateway_type VARCHAR(50);
