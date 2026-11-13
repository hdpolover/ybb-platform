-- Migration: 024_one_needs_review_per_intent.sql
-- Description: At most one NEEDS_REVIEW transaction per payment intent.
--              SubmitManualPayment created a fresh NEEDS_REVIEW row on every
--              call, so a bot (6 proofs in 120 ms on 2026-11-10) or a
--              double-click left N rows while the API invoice linked only one;
--              the rest were invisible to admins. The service now returns the
--              existing row; this index makes that hold under concurrency.
--              Dedupe first (keep the newest per intent, VOID the rest) so the
--              index can be built on environments that still carry duplicates.
--              Production already has none, so there it is a no-op.

WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY payment_intent_id
            ORDER BY created_at DESC, id DESC
        ) AS rn
    FROM payment_transactions
    WHERE status = 'NEEDS_REVIEW'
)
UPDATE payment_transactions
SET status = 'VOID',
    admin_notes = 'auto-voided by migration 024: duplicate NEEDS_REVIEW for intent',
    updated_at = NOW()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_one_needs_review_per_intent
    ON payment_transactions (payment_intent_id)
    WHERE status = 'NEEDS_REVIEW';
