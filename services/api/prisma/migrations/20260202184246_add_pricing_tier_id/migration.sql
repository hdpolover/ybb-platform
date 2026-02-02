-- AlterTable
ALTER TABLE "participant_applications" ADD COLUMN     "pricing_tier_id" UUID;

-- AddForeignKey
ALTER TABLE "participant_applications" ADD CONSTRAINT "participant_applications_pricing_tier_id_fkey" FOREIGN KEY ("pricing_tier_id") REFERENCES "program_pricing_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "ai_chatbot_configs_program_category_id_idx" RENAME TO "ai_chatbot_configs_brand_id_idx";

-- RenameIndex
ALTER INDEX "email_templates_program_category_id_idx" RENAME TO "email_templates_brand_id_idx";

-- RenameIndex
ALTER INDEX "legal_documents_program_category_id_idx" RENAME TO "legal_documents_brand_id_idx";

-- RenameIndex
ALTER INDEX "legal_documents_program_category_id_slug_version_key" RENAME TO "legal_documents_brand_id_slug_version_key";

-- RenameIndex
ALTER INDEX "partnership_enquiries_program_category_id_idx" RENAME TO "partnership_enquiries_brand_id_idx";

-- RenameIndex
ALTER INDEX "partnership_opportunities_program_category_id_idx" RENAME TO "partnership_opportunities_brand_id_idx";

-- RenameIndex
ALTER INDEX "program_team_program_category_id_idx" RENAME TO "program_team_brand_id_idx";

-- RenameIndex
ALTER INDEX "program_testimonials_program_category_id_idx" RENAME TO "program_testimonials_brand_id_idx";

-- RenameIndex
ALTER INDEX "programs_program_category_id_idx" RENAME TO "programs_brand_id_idx";

-- RenameIndex
ALTER INDEX "programs_program_category_id_slug_key" RENAME TO "programs_brand_id_slug_key";

-- RenameIndex
ALTER INDEX "sponsors_program_category_id_idx" RENAME TO "sponsors_brand_id_idx";

-- RenameIndex
ALTER INDEX "sponsorship_tiers_program_category_id_idx" RENAME TO "sponsorship_tiers_brand_id_idx";

-- RenameIndex
ALTER INDEX "system_announcements_target_audience_program_category_id_idx" RENAME TO "system_announcements_target_audience_brand_id_idx";

-- RenameIndex
ALTER INDEX "users_email_program_category_id_key" RENAME TO "users_email_brand_id_key";

-- RenameIndex
ALTER INDEX "users_program_category_id_idx" RENAME TO "users_brand_id_idx";
