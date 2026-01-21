/*
  Warnings:

  - You are about to drop the column `user_id` on the `participant_applications` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[participant_id,program_id]` on the table `participant_applications` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `participant_id` to the `participant_applications` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "participant_applications" DROP CONSTRAINT "participant_applications_user_id_fkey";

-- DropIndex
DROP INDEX "participant_applications_program_id_user_id_key";

-- DropIndex
DROP INDEX "participant_applications_user_id_idx";

-- AlterTable
ALTER TABLE "participant_applications" DROP COLUMN "user_id",
ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "participant_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "user_announcement_reads" ADD COLUMN     "dismissed_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "participant_applications_participant_id_idx" ON "participant_applications"("participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "participant_applications_participant_id_program_id_key" ON "participant_applications"("participant_id", "program_id");

-- AddForeignKey
ALTER TABLE "participant_applications" ADD CONSTRAINT "participant_applications_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
