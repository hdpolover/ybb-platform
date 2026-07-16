-- Case-insensitive email uniqueness per brand, enforced among ACTIVE (non-deleted) accounts only.
--
-- Prevents future duplicate registrations that differ only by letter case
-- (e.g. "User@x.com" vs "user@x.com" for the same brand). The application-level
-- register check is already case-insensitive; this is the schema-level backstop.
--
-- The index is PARTIAL (WHERE deleted_at IS NULL) on purpose: historical
-- case-only duplicates that were soft-deleted must not collide with the
-- surviving active row. Verified before creation that zero active case-only
-- duplicates remain, so this builds cleanly.
--
-- The existing case-sensitive @@unique([email, brandId]) is intentionally kept;
-- this adds a stricter case-insensitive guard for active rows.
CREATE UNIQUE INDEX IF NOT EXISTS "users_lower_email_brand_active_key"
  ON "users" (LOWER(email), brand_id)
  WHERE deleted_at IS NULL;
