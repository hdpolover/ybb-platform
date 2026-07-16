-- Migration: 008_refine_payment_intent_schema.sql
-- Description: Aligns the Payment Intents schema with the Custom Payment Flow plan
-- Author: GitHub Copilot

-- ============================================================================
-- 1. PAYMENT INTENTS REFINE
-- ============================================================================
ALTER TABLE payment_intents 
ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50) DEFAULT 'application',
ADD COLUMN IF NOT EXISTS reference_id VARCHAR(100), -- UUID or external ID
ADD COLUMN IF NOT EXISTS participant_id UUID;

CREATE INDEX IF NOT EXISTS idx_intent_ref ON payment_intents(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_intent_participant ON payment_intents(participant_id);

-- ============================================================================
-- 2. PAYMENT TRANSACTIONS REFINE
-- ============================================================================

-- Rename potentially done by 007. Check if old column exists before renaming.
DO $$
BEGIN
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='payment_transactions' AND column_name='payment_method_code') THEN
        ALTER TABLE payment_transactions RENAME COLUMN payment_method_code TO payment_method_id;
    END IF;
END $$;

-- Add new columns that might not be in 007
ALTER TABLE payment_transactions
ADD COLUMN IF NOT EXISTS amount_total DECIMAL(15, 2),    
ADD COLUMN IF NOT EXISTS amount_subtotal DECIMAL(15, 2), 
ADD COLUMN IF NOT EXISTS fee_provider DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_amount DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS currency VARCHAR(3),
ADD COLUMN IF NOT EXISTS error_code VARCHAR(50); 

-- ============================================================================
-- 3. PAYMENT EVENTS REFINE
-- ============================================================================
ALTER TABLE payment_events
ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);

-- ============================================================================
-- 4. UPDATE EXISTING MANUAL PAYMENT METHODS 
-- ============================================================================
UPDATE payment_methods 
SET is_active = true 
WHERE code IN ('manual_bca', 'manual_paypal');
