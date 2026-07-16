-- Phase 2 of dual-pricing migration: backfill usd_price and idr_price.
-- Runs once. Computes each program's effective USD→IDR rate from
-- programs.usd_in_idr, falling back to brand_settings.usd_in_idr,
-- then to a hardcoded 16000 (matches brand-default).
-- Existing rows are populated regardless of original currency, then
-- a sanity check aborts if any row remains unpopulated.

WITH effective_rate AS (
  SELECT
    p.id AS program_id,
    COALESCE(p.usd_in_idr, bs.usd_in_idr, 16000)::numeric AS rate
  FROM programs p
  LEFT JOIN brand_settings bs ON bs.brand_id = p.brand_id
)
UPDATE program_pricing_tiers t
SET
  usd_price = CASE
    WHEN t.currency = 'USD' THEN t.price
    WHEN t.currency = 'IDR' THEN ROUND(t.price / er.rate, 2)
    ELSE t.price
  END,
  idr_price = CASE
    WHEN t.currency = 'USD' THEN ROUND(t.price * er.rate / 1000) * 1000
    WHEN t.currency = 'IDR' THEN t.price
    ELSE ROUND(t.price * er.rate / 1000) * 1000
  END
FROM effective_rate er
WHERE t.program_id = er.program_id
  AND (t.usd_price IS NULL OR t.idr_price IS NULL);

-- Sanity check: abort if any row still missing prices
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM program_pricing_tiers
  WHERE usd_price IS NULL OR idr_price IS NULL;

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: % tiers still missing prices', missing_count;
  END IF;
END $$;
