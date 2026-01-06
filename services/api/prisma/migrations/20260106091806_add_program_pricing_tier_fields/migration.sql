-- AlterTable
ALTER TABLE "program_pricing_tiers" ADD COLUMN     "category" "ApplicationCategory",
ADD COLUMN     "icon" VARCHAR(100),
ADD COLUMN     "requirements" JSON DEFAULT '[]';
