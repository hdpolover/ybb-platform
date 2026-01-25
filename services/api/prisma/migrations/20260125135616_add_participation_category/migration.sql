-- CreateEnum
CREATE TYPE "ProgramParticipationCategory" AS ENUM ('future_innovators', 'high_school_students');

-- AlterTable
ALTER TABLE "participant_applications" ADD COLUMN     "participation_category" "ProgramParticipationCategory";
