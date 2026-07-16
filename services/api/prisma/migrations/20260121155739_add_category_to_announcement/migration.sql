-- AlterTable
ALTER TABLE "program_announcements" ADD COLUMN     "category" VARCHAR(50),
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "program_announcements_category_idx" ON "program_announcements"("category");
