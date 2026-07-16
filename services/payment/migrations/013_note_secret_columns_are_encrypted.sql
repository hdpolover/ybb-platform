-- Migration: 013_note_secret_columns_are_encrypted.sql
-- Description: Mark gateway credential columns as app-encrypted.
-- The actual encryption is performed by cmd/migrate-secrets and by the
-- gateway_config repository on write. This migration only documents intent.

COMMENT ON COLUMN payment_gateway_configs.server_key IS
  'AES-256-GCM ciphertext (enc:v1:...), key from PAYMENT_SECRETS_KEY env var';
COMMENT ON COLUMN payment_gateway_configs.client_key IS
  'AES-256-GCM ciphertext (enc:v1:...), key from PAYMENT_SECRETS_KEY env var';
COMMENT ON COLUMN payment_gateway_configs.webhook_secret IS
  'AES-256-GCM ciphertext (enc:v1:...), key from PAYMENT_SECRETS_KEY env var';
