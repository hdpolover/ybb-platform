/*
  Warnings:

  - The values [pending,captured,settled,cancelled,expired] on the enum `PaymentStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `payments` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('unpaid', 'paid', 'processing', 'failed', 'refunded');
ALTER TABLE "public"."payments" DROP COLUMN "status";
ALTER TABLE "public"."participant_applications" ALTER COLUMN "payment_status" DROP DEFAULT;
ALTER TABLE "participant_applications" ALTER COLUMN "payment_status" TYPE "PaymentStatus_new" USING ("payment_status"::text::"PaymentStatus_new");
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "public"."PaymentStatus_old";
ALTER TABLE "participant_applications" ALTER COLUMN "payment_status" SET DEFAULT 'unpaid';
COMMIT;

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_application_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_program_pricing_tier_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_user_id_fkey";

-- AlterTable
-- ALTER TABLE "users" ADD COLUMN     "is_onboarding_completed" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "payments";
