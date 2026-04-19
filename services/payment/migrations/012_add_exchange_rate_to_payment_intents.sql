-- Add exchange rate snapshot to payment_intents
-- Captures the USD-to-IDR rate at the time the intent was created
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10, 2);
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS exchange_rate_currency VARCHAR(10) DEFAULT 'USD_IDR';

-- Also add to payment_transactions table for the actual completed payment record
-- Note: the legacy `payments` table was dropped in migration 005 and replaced by payment_transactions
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10, 2);
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS exchange_rate_currency VARCHAR(10) DEFAULT 'USD_IDR';
