/*
  Warnings:

  - You are about to drop the column `admin_notes` on the `participant_applications` table. All the data in the column will be lost.
  - You are about to drop the column `interview_date` on the `participant_applications` table. All the data in the column will be lost.
  - You are about to drop the column `interview_link` on the `participant_applications` table. All the data in the column will be lost.
  - You are about to drop the column `interview_notes` on the `participant_applications` table. All the data in the column will be lost.
  - You are about to drop the column `interview_score` on the `participant_applications` table. All the data in the column will be lost.
  - You are about to drop the column `payment_status` on the `participant_applications` table. All the data in the column will be lost.
  - You are about to drop the column `review_score` on the `participant_applications` table. All the data in the column will be lost.
  - You are about to drop the column `reviewed_at` on the `participant_applications` table. All the data in the column will be lost.
  - You are about to drop the column `reviewed_by` on the `participant_applications` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('document_review', 'interview', 'essay_scoring', 'final_assessment');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('pending', 'in_progress', 'completed', 'skipped');

-- DropForeignKey
ALTER TABLE "participant_applications" DROP CONSTRAINT "participant_applications_reviewed_by_fkey";

-- DropIndex
DROP INDEX "participant_applications_payment_status_idx";

-- DropIndex
DROP INDEX "participant_applications_referral_code_idx";

-- AlterTable
ALTER TABLE "application_edit_history" ADD COLUMN     "snapshot" JSON;

-- AlterTable
ALTER TABLE "participant_applications" DROP COLUMN "admin_notes",
DROP COLUMN "interview_date",
DROP COLUMN "interview_link",
DROP COLUMN "interview_notes",
DROP COLUMN "interview_score",
DROP COLUMN "payment_status",
DROP COLUMN "review_score",
DROP COLUMN "reviewed_at",
DROP COLUMN "reviewed_by",
ADD COLUMN     "program_payment_status" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
ADD COLUMN     "registration_payment_status" "PaymentStatus" NOT NULL DEFAULT 'unpaid';

-- CreateTable
CREATE TABLE "application_invoices" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "application_id" UUID NOT NULL,
    "pricing_tier_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IDR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
    "paid_at" TIMESTAMPTZ(6),
    "external_transaction_id" VARCHAR(100),
    "payment_method" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "application_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_assessments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "application_id" UUID NOT NULL,
    "type" "AssessmentType" NOT NULL DEFAULT 'document_review',
    "status" "AssessmentStatus" NOT NULL DEFAULT 'pending',
    "score" DECIMAL(5,2),
    "notes" TEXT,
    "feedback" TEXT,
    "assessor_id" UUID,
    "assessed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "application_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "application_invoices_application_id_idx" ON "application_invoices"("application_id");

-- CreateIndex
CREATE INDEX "application_invoices_status_idx" ON "application_invoices"("status");

-- CreateIndex
CREATE INDEX "application_assessments_application_id_idx" ON "application_assessments"("application_id");

-- CreateIndex
CREATE INDEX "application_assessments_type_idx" ON "application_assessments"("type");

-- CreateIndex
CREATE INDEX "participant_applications_registration_payment_status_idx" ON "participant_applications"("registration_payment_status");

-- AddForeignKey
ALTER TABLE "application_invoices" ADD CONSTRAINT "application_invoices_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "participant_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_invoices" ADD CONSTRAINT "application_invoices_pricing_tier_id_fkey" FOREIGN KEY ("pricing_tier_id") REFERENCES "program_pricing_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_assessments" ADD CONSTRAINT "application_assessments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "participant_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_assessments" ADD CONSTRAINT "application_assessments_assessor_id_fkey" FOREIGN KEY ("assessor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
