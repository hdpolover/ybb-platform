-- AlterTable
ALTER TABLE "program_testimonials" ADD COLUMN     "program_category_id" UUID,
ALTER COLUMN "program_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "program_testimonials_program_category_id_idx" ON "program_testimonials"("program_category_id");

-- AddForeignKey
ALTER TABLE "program_testimonials" ADD CONSTRAINT "program_testimonials_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
