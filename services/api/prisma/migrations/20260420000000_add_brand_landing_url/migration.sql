-- Add brands.landing_url for the Next.js landing deployment URL, kept separate
-- from website_url which many brands point at a marketing site instead.
ALTER TABLE "brands" ADD COLUMN "landing_url" VARCHAR(255);
