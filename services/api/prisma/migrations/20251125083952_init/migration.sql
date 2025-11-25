/*
  Warnings:

  - You are about to drop the column `motivation_letter` on the `participant_applications` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "idx_referrals_conversion";

-- DropIndex
DROP INDEX "idx_sessions_cleanup";

-- AlterTable
ALTER TABLE "admin_programs" ALTER COLUMN "permissions" SET DATA TYPE JSONB;

-- AlterTable
ALTER TABLE "admin_roles" ALTER COLUMN "permissions" SET DATA TYPE JSONB;

-- AlterTable
ALTER TABLE "admins" ALTER COLUMN "custom_permissions" SET DATA TYPE JSONB;

-- AlterTable
ALTER TABLE "participant_applications" DROP COLUMN "motivation_letter",
ADD COLUMN     "motivationLetter" TEXT;

-- RenameIndex
ALTER INDEX "system_announcements_start_date_end_date_is_published_deleted_a" RENAME TO "system_announcements_start_date_end_date_is_published_delet_idx";

-- RenameIndex
ALTER INDEX "user_privacy_consents_user_id_consent_type_is_granted_revoked_a" RENAME TO "user_privacy_consents_user_id_consent_type_is_granted_revok_idx";
