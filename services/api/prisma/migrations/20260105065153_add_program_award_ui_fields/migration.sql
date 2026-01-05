-- AlterTable
ALTER TABLE "program_awards" ADD COLUMN     "color" VARCHAR(7),
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "winner_count" INTEGER;
