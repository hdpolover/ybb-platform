-- Add last_reconciled_at column for throttled reconciliation
ALTER TABLE application_invoices ADD COLUMN last_reconciled_at TIMESTAMPTZ NULL;

-- Index for throttling queries
CREATE INDEX application_invoices_last_reconciled_at_idx
  ON application_invoices (last_reconciled_at);

-- Index on external_transaction_id for idempotency lookups
CREATE INDEX application_invoices_external_transaction_id_idx
  ON application_invoices (external_transaction_id);

-- Partial unique index on external_transaction_id (non-null only) to prevent duplicate invoices
CREATE UNIQUE INDEX application_invoices_external_transaction_id_key
  ON application_invoices (external_transaction_id)
  WHERE external_transaction_id IS NOT NULL;
