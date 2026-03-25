/*
  Warnings:

  - You are about to alter the column `logo_color_url` on the `brands` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(500)`.
  - You are about to alter the column `logo_icon_url` on the `brands` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(500)`.
  - You are about to alter the column `logo_white_url` on the `brands` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(500)`.
  - You are about to alter the column `logo_color_url` on the `programs` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(500)`.
  - You are about to alter the column `logo_icon_url` on the `programs` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(500)`.
  - You are about to alter the column `logo_white_url` on the `programs` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(500)`.

*/
-- DropIndex
DROP INDEX "idx_invoice_application_status";

-- DropIndex
DROP INDEX "idx_invoice_pricing_tier";

-- DropIndex
DROP INDEX "idx_app_participant_status";

-- DropIndex
DROP INDEX "idx_app_participant_updated";

-- DropIndex
DROP INDEX "idx_app_updated_at";

-- DropIndex
DROP INDEX "idx_doc_application_type";

-- DropIndex
DROP INDEX "idx_program_announcement_program_active";

-- DropIndex
DROP INDEX "idx_program_essay_program_active";

-- DropIndex
DROP INDEX "idx_pricing_tier_program_active";

-- DropIndex
DROP INDEX "idx_program_requirement_program_active";

-- DropIndex
DROP INDEX "idx_program_resource_program_active";

-- DropIndex
DROP INDEX "idx_system_announcement_published";

-- AlterTable
ALTER TABLE "brands" ALTER COLUMN "logo_color_url" SET DATA TYPE VARCHAR(500),
ALTER COLUMN "logo_icon_url" SET DATA TYPE VARCHAR(500),
ALTER COLUMN "logo_white_url" SET DATA TYPE VARCHAR(500);

-- AlterTable
ALTER TABLE "participant_applications" ADD COLUMN     "achievements" TEXT,
ADD COLUMN     "document_files" JSON DEFAULT '{}',
ADD COLUMN     "experiences" TEXT,
ADD COLUMN     "last_edited_at" TIMESTAMPTZ(6),
ADD COLUMN     "motivation_letter" TEXT,
ADD COLUMN     "participant_snapshot" JSON,
ADD COLUMN     "payment_amount" DECIMAL(10,2),
ADD COLUMN     "payment_id" VARCHAR(100),
ADD COLUMN     "payment_status" VARCHAR(50),
ADD COLUMN     "requirement_files" JSON DEFAULT '[]',
ADD COLUMN     "reviewed_at" TIMESTAMPTZ(6),
ADD COLUMN     "reviewed_by" UUID,
ADD COLUMN     "reviewer_notes" TEXT,
ADD COLUMN     "score_breakdown" JSON,
ADD COLUMN     "score_status" "ScoreStatus",
ADD COLUMN     "score_total" DECIMAL(5,2),
ADD COLUMN     "status_history" JSON DEFAULT '[]',
ADD COLUMN     "twibbon_link" VARCHAR(500),
ADD COLUMN     "withdrawn_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "programs" ALTER COLUMN "logo_color_url" SET DATA TYPE VARCHAR(500),
ALTER COLUMN "logo_icon_url" SET DATA TYPE VARCHAR(500),
ALTER COLUMN "logo_white_url" SET DATA TYPE VARCHAR(500);
