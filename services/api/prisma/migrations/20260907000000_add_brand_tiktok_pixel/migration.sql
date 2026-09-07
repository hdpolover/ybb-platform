-- TikTok Pixel + Events API credentials on brand_settings, mirroring the Meta
-- (pixel_id / capi_access_token / capi_test_event_code) trio.
ALTER TABLE "brand_settings"
  ADD COLUMN IF NOT EXISTS "tiktok_pixel_id" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "tiktok_access_token" TEXT,
  ADD COLUMN IF NOT EXISTS "tiktok_test_event_code" VARCHAR(50);
