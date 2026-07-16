-- Migration: 019_dedupe_open_intents_and_unique_index.sql
-- Description: Collapse duplicate open (REQUIRES_PAYMENT_METHOD, not deleted)
--              payment intents sharing the same (reference_type, reference_id)
--              down to the newest one, soft-deleting the rest. Verified against
--              production: among duplicate open intents sharing a reference,
--              none differ in amount/currency, so this is pure de-duplication,
--              not data loss. Then enforce single-open-intent-per-reference at
--              the DB layer via a partial unique index, mirroring the
--              one-active-per-provider guard in 015_gateway_config_one_active.sql.
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
