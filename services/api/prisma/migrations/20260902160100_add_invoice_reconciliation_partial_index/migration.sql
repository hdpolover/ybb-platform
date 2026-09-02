-- PaymentReconciliationService scans application_invoices by
-- status IN (...) AND (external_intent_id IS NOT NULL OR external_transaction_id
-- IS NOT NULL), then windows/orders on last_reconciled_at. Both the hourly cron
-- (reconcileProcessingInvoices) and the terminal-drift safety net
-- (reconcileTerminalInvoiceDrift) use that shape; 444 full invoice scans in 14h.
-- Partial: invoices with no external reference are never reconcilable.

CREATE INDEX IF NOT EXISTS "idx_invoices_status_reconciled_external"
ON "application_invoices" ("status", "last_reconciled_at")
WHERE "external_intent_id" IS NOT NULL OR "external_transaction_id" IS NOT NULL;
