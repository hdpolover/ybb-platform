-- Audit 2026-09-02 backlog: Performance: database (M174, M18, M40, M19, M205)
--
-- M174: application_invoices_external_intent_id_idx and
-- application_invoices_external_transaction_id_idx are redundant write
-- amplification on the hottest payment table:
--   - idx_invoices_external_intent_status (external_intent_id, status),
--     added in 20260503165000_add_composite_indexes_batch_1, already covers
--     exact-match lookups on external_intent_id alone via leftmost-prefix.
--   - application_invoices_external_transaction_id_key (partial UNIQUE,
--     WHERE external_transaction_id IS NOT NULL), added in
--     20260623000000_add_invoice_reconciliation_fields, already covers
--     exact-match lookups on external_transaction_id alone (Postgres can use
--     a partial index with an IS NOT NULL predicate for any strict equality
--     clause on that column).
-- Verified against real call sites in payment-events.controller.ts
-- (where: { externalTransactionId: ... } / { externalIntentId: ... }).
DROP INDEX IF EXISTS "application_invoices_external_intent_id_idx";
DROP INDEX IF EXISTS "application_invoices_external_transaction_id_idx";

-- M18 / M40: participant_documents.loa_release_batch_id has no index.
-- GetLoaBatchesHandler (loa-batch.handlers.ts) counts downloaded LOA
-- documents per batch by this column; previously a full scan per batch.
CREATE INDEX IF NOT EXISTS "participant_documents_loa_release_batch_id_idx"
ON "participant_documents" ("loa_release_batch_id");

-- M19: participant_applications has no index supporting count() by
-- participation_category_id or pricing_tier_id (program-content.repository.ts
-- deleteParticipationCategory guard, and the equivalent tier-replace path).
CREATE INDEX IF NOT EXISTS "participant_applications_participation_category_id_idx"
ON "participant_applications" ("participation_category_id");

CREATE INDEX IF NOT EXISTS "participant_applications_pricing_tier_id_idx"
ON "participant_applications" ("pricing_tier_id");

-- M205: user activity/security log and notification listings filter and
-- sort by (user_id, created_at DESC) with no composite index (activity logs
-- and security logs only had separate single-column indexes).
CREATE INDEX IF NOT EXISTS "user_activity_logs_user_id_created_at_idx"
ON "user_activity_logs" ("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "user_security_logs_user_id_created_at_idx"
ON "user_security_logs" ("user_id", "created_at" DESC);

-- user_notifications deliberately gets NO (user_id, created_at DESC) index:
-- it already has an ascending user_notifications_user_id_created_at_idx, and
-- Postgres scans a b-tree backwards for ORDER BY DESC. Adding the twin would
-- be write amplification on a table whose six existing indexes all show
-- idx_scan = 0 in production.
