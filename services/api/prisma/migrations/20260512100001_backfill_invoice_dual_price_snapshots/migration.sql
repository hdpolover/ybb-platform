-- Backfill amount_usd / amount_idr on existing invoices from their tier's
-- current dual-price columns, falling back to the legacy price/currency pair
-- for tiers that haven't yet been migrated to dual pricing.
--
-- Caveats:
--   - Tier prices may have drifted since the invoice was issued; we accept
--     that imprecision because we have no historic snapshot to rely on.
--   - We do NOT touch `amount`/`currency` on settled invoices. Switching the
--     canonical settlement currency retroactively would mutate accounting
--     history. New manual confirms will write IDR going forward via the
--     application code; existing rows stay as-is.
--   - Idempotent: only fills NULL columns, can be re-run safely.

UPDATE "application_invoices" AS inv
SET "amount_usd" = COALESCE(
        tier."usd_price",
        CASE WHEN UPPER(tier."currency") = 'USD' THEN tier."price" ELSE NULL END
    )
FROM "program_pricing_tiers" AS tier
WHERE inv."pricing_tier_id" = tier."id"
  AND inv."amount_usd" IS NULL;

UPDATE "application_invoices" AS inv
SET "amount_idr" = COALESCE(
        tier."idr_price",
        CASE WHEN UPPER(tier."currency") = 'IDR' THEN tier."price" ELSE NULL END
    )
FROM "program_pricing_tiers" AS tier
WHERE inv."pricing_tier_id" = tier."id"
  AND inv."amount_idr" IS NULL;
