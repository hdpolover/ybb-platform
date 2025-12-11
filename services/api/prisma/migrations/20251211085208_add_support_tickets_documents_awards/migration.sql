/*
  Warnings:

  - You are about to drop the column `funding_type` on the `participant_applications` table. All the data in the column will be lost.
  - You are about to drop the column `reimbursed_at` on the `participant_applications` table. All the data in the column will be lost.
  - You are about to drop the column `reimbursement_amount` on the `participant_applications` table. All the data in the column will be lost.
  - You are about to drop the column `reimbursement_method` on the `participant_applications` table. All the data in the column will be lost.
  - You are about to drop the column `reimbursement_notes` on the `participant_applications` table. All the data in the column will be lost.
  - You are about to drop the column `reimbursement_status` on the `participant_applications` table. All the data in the column will be lost.
  - You are about to drop the column `total_amount` on the `participant_applications` table. All the data in the column will be lost.
  - You are about to drop the column `total_paid` on the `participant_applications` table. All the data in the column will be lost.
  - You are about to drop the `program_payment_periods` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `program_payment_transactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `program_payments` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('open', 'in_progress', 'waiting_response', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "DocumentTemplateType" AS ENUM ('letter_of_acceptance', 'letter_of_invitation', 'certificate_participation', 'certificate_achievement', 'certificate_speaker', 'letter_recommendation', 'agreement_letter', 'custom');

-- DropForeignKey
ALTER TABLE "program_payment_periods" DROP CONSTRAINT "program_payment_periods_program_payment_id_fkey";

-- DropForeignKey
ALTER TABLE "program_payment_transactions" DROP CONSTRAINT "program_payment_transactions_application_id_fkey";

-- DropForeignKey
ALTER TABLE "program_payment_transactions" DROP CONSTRAINT "program_payment_transactions_program_payment_id_fkey";

-- DropForeignKey
ALTER TABLE "program_payments" DROP CONSTRAINT "program_payments_program_id_fkey";

-- AlterTable
ALTER TABLE "application_form_fields" ALTER COLUMN "options" SET DATA TYPE JSON,
ALTER COLUMN "validation_rules" SET DATA TYPE JSON;

-- AlterTable
ALTER TABLE "certificate_templates" ALTER COLUMN "fields" SET DATA TYPE JSON;

-- AlterTable
ALTER TABLE "email_templates" ALTER COLUMN "variables" SET DATA TYPE JSON;

-- AlterTable
ALTER TABLE "participant_applications" DROP COLUMN "funding_type",
DROP COLUMN "reimbursed_at",
DROP COLUMN "reimbursement_amount",
DROP COLUMN "reimbursement_method",
DROP COLUMN "reimbursement_notes",
DROP COLUMN "reimbursement_status",
DROP COLUMN "total_amount",
DROP COLUMN "total_paid",
ADD COLUMN     "payment_amount" DECIMAL(10,2),
ADD COLUMN     "pricing_tier_id" UUID,
ALTER COLUMN "payment_status" DROP DEFAULT;

-- AlterTable
ALTER TABLE "program_categories" ALTER COLUMN "social_media_links" SET DATA TYPE JSON;

-- AlterTable
ALTER TABLE "program_requirements" ALTER COLUMN "options" SET DATA TYPE JSON,
ALTER COLUMN "validation_rules" SET DATA TYPE JSON;

-- DropTable
DROP TABLE "program_payment_periods";

-- DropTable
DROP TABLE "program_payment_transactions";

-- DropTable
DROP TABLE "program_payments";

-- CreateTable
CREATE TABLE "program_pricing_tiers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "capacity" INTEGER,
    "sold_count" INTEGER NOT NULL DEFAULT 0,
    "valid_from" TIMESTAMPTZ(6) NOT NULL,
    "valid_until" TIMESTAMPTZ(6) NOT NULL,
    "benefits" JSON DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "program_pricing_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "participant_id" UUID NOT NULL,
    "assigned_to" UUID,
    "program_id" UUID,
    "ticket_number" VARCHAR(20) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "sub_category" VARCHAR(100),
    "subject" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'open',
    "priority" "TicketPriority" NOT NULL DEFAULT 'normal',
    "resolution" TEXT,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" UUID,
    "closed_at" TIMESTAMPTZ(6),
    "closed_by" UUID,
    "closed_reason" TEXT,
    "satisfaction_rating" SMALLINT,
    "feedback" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "legacy_id" INTEGER,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_messages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ticket_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "is_from_admin" BOOLEAN NOT NULL DEFAULT false,
    "sender_id" UUID NOT NULL,
    "sender_name" VARCHAR(255) NOT NULL,
    "attachments" JSON NOT NULL DEFAULT '[]',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(6),
    "is_internal_note" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "legacy_id" INTEGER,

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "DocumentTemplateType" NOT NULL DEFAULT 'custom',
    "description" TEXT,
    "template_url" VARCHAR(500),
    "html_content" TEXT,
    "placeholders" JSON NOT NULL DEFAULT '[]',
    "layout_config" JSON NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "legacy_id" INTEGER,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participant_documents" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "application_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "document_number" VARCHAR(50),
    "document_url" VARCHAR(500) NOT NULL,
    "generated_data" JSON NOT NULL DEFAULT '{}',
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by" UUID,
    "revoke_reason" TEXT,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "last_download_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "legacy_id" INTEGER,

    CONSTRAINT "participant_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_awards" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(100),
    "tier" VARCHAR(50),
    "badge_url" VARCHAR(500),
    "icon_url" VARCHAR(500),
    "certificate_template_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "legacy_id" INTEGER,

    CONSTRAINT "program_awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participant_awards" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "application_id" UUID NOT NULL,
    "award_id" UUID NOT NULL,
    "awarded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "awarded_by" UUID,
    "notes" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "certificate_url" VARCHAR(500),
    "certificate_generated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "legacy_id" INTEGER,

    CONSTRAINT "participant_awards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "program_pricing_tiers_program_id_idx" ON "program_pricing_tiers"("program_id");

-- CreateIndex
CREATE INDEX "program_pricing_tiers_is_active_idx" ON "program_pricing_tiers"("is_active");

-- CreateIndex
CREATE INDEX "program_pricing_tiers_valid_from_valid_until_idx" ON "program_pricing_tiers"("valid_from", "valid_until");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticket_number_key" ON "support_tickets"("ticket_number");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_legacy_id_key" ON "support_tickets"("legacy_id");

-- CreateIndex
CREATE INDEX "support_tickets_participant_id_idx" ON "support_tickets"("participant_id");

-- CreateIndex
CREATE INDEX "support_tickets_assigned_to_idx" ON "support_tickets"("assigned_to");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_tickets_priority_idx" ON "support_tickets"("priority");

-- CreateIndex
CREATE INDEX "support_tickets_ticket_number_idx" ON "support_tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "support_tickets_created_at_idx" ON "support_tickets"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "support_ticket_messages_legacy_id_key" ON "support_ticket_messages"("legacy_id");

-- CreateIndex
CREATE INDEX "support_ticket_messages_ticket_id_idx" ON "support_ticket_messages"("ticket_id");

-- CreateIndex
CREATE INDEX "support_ticket_messages_sender_id_idx" ON "support_ticket_messages"("sender_id");

-- CreateIndex
CREATE INDEX "support_ticket_messages_created_at_idx" ON "support_ticket_messages"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "document_templates_legacy_id_key" ON "document_templates"("legacy_id");

-- CreateIndex
CREATE INDEX "document_templates_program_id_idx" ON "document_templates"("program_id");

-- CreateIndex
CREATE INDEX "document_templates_type_idx" ON "document_templates"("type");

-- CreateIndex
CREATE INDEX "document_templates_is_active_idx" ON "document_templates"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "participant_documents_document_number_key" ON "participant_documents"("document_number");

-- CreateIndex
CREATE UNIQUE INDEX "participant_documents_legacy_id_key" ON "participant_documents"("legacy_id");

-- CreateIndex
CREATE INDEX "participant_documents_application_id_idx" ON "participant_documents"("application_id");

-- CreateIndex
CREATE INDEX "participant_documents_template_id_idx" ON "participant_documents"("template_id");

-- CreateIndex
CREATE INDEX "participant_documents_document_number_idx" ON "participant_documents"("document_number");

-- CreateIndex
CREATE INDEX "participant_documents_generated_at_idx" ON "participant_documents"("generated_at");

-- CreateIndex
CREATE UNIQUE INDEX "program_awards_legacy_id_key" ON "program_awards"("legacy_id");

-- CreateIndex
CREATE INDEX "program_awards_program_id_idx" ON "program_awards"("program_id");

-- CreateIndex
CREATE INDEX "program_awards_category_idx" ON "program_awards"("category");

-- CreateIndex
CREATE INDEX "program_awards_is_active_idx" ON "program_awards"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "participant_awards_legacy_id_key" ON "participant_awards"("legacy_id");

-- CreateIndex
CREATE INDEX "participant_awards_application_id_idx" ON "participant_awards"("application_id");

-- CreateIndex
CREATE INDEX "participant_awards_award_id_idx" ON "participant_awards"("award_id");

-- CreateIndex
CREATE INDEX "participant_awards_awarded_at_idx" ON "participant_awards"("awarded_at");

-- CreateIndex
CREATE UNIQUE INDEX "participant_awards_application_id_award_id_key" ON "participant_awards"("application_id", "award_id");

-- AddForeignKey
ALTER TABLE "program_pricing_tiers" ADD CONSTRAINT "program_pricing_tiers_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_applications" ADD CONSTRAINT "participant_applications_pricing_tier_id_fkey" FOREIGN KEY ("pricing_tier_id") REFERENCES "program_pricing_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_documents" ADD CONSTRAINT "participant_documents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "document_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_awards" ADD CONSTRAINT "participant_awards_award_id_fkey" FOREIGN KEY ("award_id") REFERENCES "program_awards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
