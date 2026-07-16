/*
  Warnings:

  - You are about to drop the column `target` on the `program_pricing_tiers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "participant_applications" ADD COLUMN     "application_category" "ApplicationCategory";

-- AlterTable
ALTER TABLE "program_pricing_tiers" DROP COLUMN "target",
ADD COLUMN     "allowed_categories" "ApplicationCategory"[] DEFAULT ARRAY['self_funded']::"ApplicationCategory"[];
