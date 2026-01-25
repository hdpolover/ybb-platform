/*
  Warnings:

  - You are about to drop the column `participation_category` on the `participant_applications` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "participant_applications" DROP COLUMN "participation_category",
ADD COLUMN     "participation_category_id" UUID;

-- DropEnum
DROP TYPE "ProgramParticipationCategory";

-- CreateTable
CREATE TABLE "program_participation_categories" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "benefits" TEXT,
    "eligibility" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "program_participation_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "program_participation_categories_program_id_idx" ON "program_participation_categories"("program_id");

-- AddForeignKey
ALTER TABLE "participant_applications" ADD CONSTRAINT "participant_applications_participation_category_id_fkey" FOREIGN KEY ("participation_category_id") REFERENCES "program_participation_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_participation_categories" ADD CONSTRAINT "program_participation_categories_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
