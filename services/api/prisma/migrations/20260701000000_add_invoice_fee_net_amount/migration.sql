-- Add provider fee + net settlement amount columns, mirrored from the Go
-- payment service's payment_transactions (fee_provider / net_amount) via the
-- payment.succeeded event payload. Nullable: unknown until that event
-- carries the fields, or until backfilled from payment_transactions.
ALTER TABLE application_invoices ADD COLUMN fee_provider DECIMAL(15,2) NULL;
ALTER TABLE application_invoices ADD COLUMN net_amount DECIMAL(15,2) NULL;
