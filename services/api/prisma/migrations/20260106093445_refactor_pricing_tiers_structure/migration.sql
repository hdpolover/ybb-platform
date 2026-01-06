/*
  Warnings:

  - You are about to drop the column `category` on the `program_pricing_tiers` table. All the data in the column will be lost.
  - You are about to drop the column `valid_from` on the `program_pricing_tiers` table. All the data in the column will be lost.
  - You are about to drop the column `valid_until` on the `program_pricing_tiers` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PricingFeeType" AS ENUM ('registration_fee', 'program_fee_1', 'program_fee_2', 'full_fee', 'custom_fee');

-- CreateEnum
CREATE TYPE "PricingTarget" AS ENUM ('self_funded', 'fully_funded', 'all');

-- DropIndex
DROP INDEX "program_pricing_tiers_valid_from_valid_until_idx";

-- AlterTable
ALTER TABLE "program_pricing_tiers" DROP COLUMN "category",
DROP COLUMN "valid_from",
DROP COLUMN "valid_until",
ADD COLUMN     "fee_type" "PricingFeeType" NOT NULL DEFAULT 'registration_fee',
ADD COLUMN     "target" "PricingTarget" NOT NULL DEFAULT 'all';

-- CreateTable
CREATE TABLE "pricing_tier_validity_periods" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "pricing_tier_id" UUID NOT NULL,
    "start_date" TIMESTAMPTZ(6) NOT NULL,
    "end_date" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pricing_tier_validity_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pricing_tier_validity_periods_pricing_tier_id_idx" ON "pricing_tier_validity_periods"("pricing_tier_id");

-- CreateIndex
CREATE INDEX "pricing_tier_validity_periods_start_date_end_date_idx" ON "pricing_tier_validity_periods"("start_date", "end_date");

-- AddForeignKey
ALTER TABLE "pricing_tier_validity_periods" ADD CONSTRAINT "pricing_tier_validity_periods_pricing_tier_id_fkey" FOREIGN KEY ("pricing_tier_id") REFERENCES "program_pricing_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
