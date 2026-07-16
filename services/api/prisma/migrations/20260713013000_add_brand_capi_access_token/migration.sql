-- Add capiAccessToken column to brand_settings (Meta Conversions API secret token)
ALTER TABLE "brand_settings"
  ADD COLUMN IF NOT EXISTS "capi_access_token" TEXT;
