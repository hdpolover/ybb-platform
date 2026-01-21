/*
  Warnings:

  - You are about to drop the column `quota` on the `program_pricing_tiers` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `program_requirements` table. All the data in the column will be lost.
  - Added the required column `name` to the `program_requirements` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "program_pricing_tiers" DROP COLUMN "quota",
ADD COLUMN     "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "capacity" INTEGER DEFAULT 0,
ADD COLUMN     "fee_type" "PricingFeeType" NOT NULL DEFAULT 'registration_fee',
ADD COLUMN     "icon" VARCHAR(255),
ADD COLUMN     "target" "PricingTarget" NOT NULL DEFAULT 'self_funded';

-- AlterTable
ALTER TABLE "program_requirements" DROP COLUMN "title",
ADD COLUMN     "name" VARCHAR(255) NOT NULL;
