-- Add capiTestEventCode column to brand_settings (Meta CAPI test_event_code; not a secret)
ALTER TABLE "brand_settings"
  ADD COLUMN IF NOT EXISTS "capi_test_event_code" VARCHAR(50);
