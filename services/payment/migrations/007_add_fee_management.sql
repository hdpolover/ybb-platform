-- Migration: 007_add_fee_management.sql
-- Description: Add columns for fee transparency and reconciliation

-- 1. Align PaymentMethodID column
DO $$
BEGIN
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='payment_transactions' AND column_name='payment_method_code') THEN
        ALTER TABLE payment_transactions RENAME COLUMN payment_method_code TO payment_method_id;
    END IF;
END $$;

-- 2. Add Fee columns to payment_transactions
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS amount_total DECIMAL(15,2) DEFAULT 0;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS amount_subtotal DECIMAL(15,2) DEFAULT 0;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS fee_provider DECIMAL(15,2) DEFAULT 0;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS net_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'IDR';

-- 3. Backfill data for existing transactions (Set Total = Intent.Amount, Fee = 0)
UPDATE payment_transactions pt
SET 
    amount_total = pi.amount,
    amount_subtotal = pi.amount,
    net_amount = pi.amount,
    currency = pi.currency
FROM payment_intents pi
WHERE pt.payment_intent_id = pi.id
  AND pt.amount_total = 0;
