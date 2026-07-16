-- Rename Tables
ALTER TABLE IF EXISTS "program_categories" RENAME TO "brands";
ALTER TABLE IF EXISTS "program_category_settings" RENAME TO "brand_settings";
ALTER TABLE IF EXISTS "admin_program_categories" RENAME TO "admin_brands";
ALTER TABLE IF EXISTS "program_social_feeds" RENAME TO "brand_social_feeds";

-- Rename Columns
ALTER TABLE "admin_brands" RENAME COLUMN "program_category_id" TO "brand_id";
ALTER TABLE "ai_chatbot_configs" RENAME COLUMN "program_category_id" TO "brand_id";
ALTER TABLE "email_templates" RENAME COLUMN "program_category_id" TO "brand_id";
ALTER TABLE "legal_documents" RENAME COLUMN "program_category_id" TO "brand_id";
ALTER TABLE "partnership_enquiries" RENAME COLUMN "program_category_id" TO "brand_id";
ALTER TABLE "partnership_opportunities" RENAME COLUMN "program_category_id" TO "brand_id";
ALTER TABLE "program_team" RENAME COLUMN "program_category_id" TO "brand_id";
ALTER TABLE "program_testimonials" RENAME COLUMN "program_category_id" TO "brand_id";
ALTER TABLE "programs" RENAME COLUMN "program_category_id" TO "brand_id";
ALTER TABLE "sponsors" RENAME COLUMN "program_category_id" TO "brand_id";
ALTER TABLE "sponsorship_tiers" RENAME COLUMN "program_category_id" TO "brand_id";
ALTER TABLE "system_announcements" RENAME COLUMN "program_category_id" TO "brand_id";
ALTER TABLE "brand_settings" RENAME COLUMN "program_category_id" TO "brand_id";
ALTER TABLE "brand_social_feeds" RENAME COLUMN "program_category_id" TO "brand_id";
ALTER TABLE "users" RENAME COLUMN "program_category_id" TO "brand_id";

-- Rename Indexes
ALTER INDEX IF EXISTS "program_categories_pkey" RENAME TO "brands_pkey";
ALTER INDEX IF EXISTS "program_categories_slug_key" RENAME TO "brands_slug_key";
ALTER INDEX IF EXISTS "program_categories_name_key" RENAME TO "brands_name_key";
ALTER INDEX IF EXISTS "program_categories_legacy_id_key" RENAME TO "brands_legacy_id_key";
ALTER INDEX IF EXISTS "program_categories_slug_idx" RENAME TO "brands_slug_idx";
ALTER INDEX IF EXISTS "program_categories_is_active_idx" RENAME TO "brands_is_active_idx";

ALTER INDEX IF EXISTS "program_category_settings_pkey" RENAME TO "brand_settings_pkey";
ALTER INDEX IF EXISTS "program_category_settings_program_category_id_key" RENAME TO "brand_settings_brand_id_key";

ALTER INDEX IF EXISTS "admin_program_categories_pkey" RENAME TO "admin_brands_pkey";
ALTER INDEX IF EXISTS "admin_program_categories_legacy_id_key" RENAME TO "admin_brands_legacy_id_key";
ALTER INDEX IF EXISTS "admin_program_categories_admin_id_program_category_id_key" RENAME TO "admin_brands_admin_id_brand_id_key";
ALTER INDEX IF EXISTS "admin_program_categories_admin_id_idx" RENAME TO "admin_brands_admin_id_idx";
ALTER INDEX IF EXISTS "admin_program_categories_program_category_id_idx" RENAME TO "admin_brands_brand_id_idx";

ALTER INDEX IF EXISTS "program_social_feeds_pkey" RENAME TO "brand_social_feeds_pkey";
ALTER INDEX IF EXISTS "program_social_feeds_program_category_id_idx" RENAME TO "brand_social_feeds_brand_id_idx";
ALTER INDEX IF EXISTS "program_social_feeds_platform_idx" RENAME TO "brand_social_feeds_platform_idx";
ALTER INDEX IF EXISTS "program_social_feeds_posted_at_idx" RENAME TO "brand_social_feeds_posted_at_idx";

-- Rename FK Constraints
ALTER TABLE "programs" RENAME CONSTRAINT "programs_program_category_id_fkey" TO "programs_brand_id_fkey";
ALTER TABLE "admin_brands" RENAME CONSTRAINT "admin_program_categories_program_category_id_fkey" TO "admin_brands_brand_id_fkey";
ALTER TABLE "admin_brands" RENAME CONSTRAINT "admin_program_categories_admin_id_fkey" TO "admin_brands_admin_id_fkey";
ALTER TABLE "brand_settings" RENAME CONSTRAINT "program_category_settings_program_category_id_fkey" TO "brand_settings_brand_id_fkey";
ALTER TABLE "brand_social_feeds" RENAME CONSTRAINT "program_social_feeds_program_category_id_fkey" TO "brand_social_feeds_brand_id_fkey";

ALTER TABLE "ai_chatbot_configs" RENAME CONSTRAINT "ai_chatbot_configs_program_category_id_fkey" TO "ai_chatbot_configs_brand_id_fkey";
ALTER TABLE "email_templates" RENAME CONSTRAINT "email_templates_program_category_id_fkey" TO "email_templates_brand_id_fkey";
ALTER TABLE "legal_documents" RENAME CONSTRAINT "legal_documents_program_category_id_fkey" TO "legal_documents_brand_id_fkey";
ALTER TABLE "partnership_enquiries" RENAME CONSTRAINT "partnership_enquiries_program_category_id_fkey" TO "partnership_enquiries_brand_id_fkey";
ALTER TABLE "partnership_opportunities" RENAME CONSTRAINT "partnership_opportunities_program_category_id_fkey" TO "partnership_opportunities_brand_id_fkey";
ALTER TABLE "program_team" RENAME CONSTRAINT "program_team_program_category_id_fkey" TO "program_team_brand_id_fkey";
ALTER TABLE "program_testimonials" RENAME CONSTRAINT "program_testimonials_program_category_id_fkey" TO "program_testimonials_brand_id_fkey";
ALTER TABLE "sponsors" RENAME CONSTRAINT "sponsors_program_category_id_fkey" TO "sponsors_brand_id_fkey";
ALTER TABLE "sponsorship_tiers" RENAME CONSTRAINT "sponsorship_tiers_program_category_id_fkey" TO "sponsorship_tiers_brand_id_fkey";
ALTER TABLE "system_announcements" RENAME CONSTRAINT "system_announcements_program_category_id_fkey" TO "system_announcements_brand_id_fkey";
ALTER TABLE "users" RENAME CONSTRAINT "users_program_category_id_fkey" TO "users_brand_id_fkey";
