-- Add client_secret column used by PaymentIntent entity and API/grpc responses.
-- This keeps DB schema aligned with code paths that persist/create payment intents.
ALTER TABLE payment_intents
ADD COLUMN IF NOT EXISTS client_secret VARCHAR(255);
