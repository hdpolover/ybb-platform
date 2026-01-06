-- CreateEnum
CREATE TYPE "FaqCategory" AS ENUM ('general', 'registration', 'payment', 'event_details', 'accommodation', 'visa', 'other');

-- AlterTable
ALTER TABLE "program_faqs" ADD COLUMN     "category" "FaqCategory" NOT NULL DEFAULT 'general';

-- CreateIndex
CREATE INDEX "program_faqs_category_idx" ON "program_faqs"("category");
