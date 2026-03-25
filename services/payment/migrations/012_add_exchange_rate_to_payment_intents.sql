-- Add exchange rate snapshot to payment_intents
-- Captures the USD-to-IDR rate at the time the intent was created
ALTER TABLE payment_intents ADD COLUMN exchange_rate DECIMAL(10, 2);
ALTER TABLE payment_intents ADD COLUMN exchange_rate_currency VARCHAR(10) DEFAULT 'USD_IDR';

-- Also add to payments table for the actual completed payment record
ALTER TABLE payments ADD COLUMN exchange_rate DECIMAL(10, 2);
ALTER TABLE payments ADD COLUMN exchange_rate_currency VARCHAR(10) DEFAULT 'USD_IDR';
