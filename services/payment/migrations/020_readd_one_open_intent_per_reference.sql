-- Migration: 020_readd_one_open_intent_per_reference.sql
-- Description: Re-create the single-open-intent-per-reference guard from
--              019_dedupe_open_intents_and_unique_index.sql. 019 was rolled
--              back manually in production after the index turned a
--              find-or-create bug (fixed alongside this migration, see
--              CreateIntentHandler) into a 500 for paying customers. 019 is
--              already recorded in schema_migrations and cannot be reapplied,
--              so this is a fresh migration mirroring its shape.
--              Duplicates have re-accumulated since the rollback, so the
--              dedupe UPDATE must run again before the index can be created.
--              Soft delete only: rows are kept (deleted_at set), never removed.

WITH ranked_open_intents AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY reference_type, reference_id
            ORDER BY created_at DESC, id DESC
        ) AS rn
    FROM payment_intents
    WHERE status = 'REQUIRES_PAYMENT_METHOD'
      AND deleted_at IS NULL
)
UPDATE payment_intents
SET deleted_at = NOW(),
    updated_at = NOW()
WHERE id IN (
    SELECT id FROM ranked_open_intents WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_one_open_per_reference
    ON payment_intents (reference_type, reference_id)
    WHERE status = 'REQUIRES_PAYMENT_METHOD' AND deleted_at IS NULL;
