-- AlterTable
ALTER TABLE "program_pricing_tiers" ADD COLUMN     "requirements" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "program_requirements" ADD COLUMN     "file_allowed_types" VARCHAR(255),
ADD COLUMN     "file_max_size" INTEGER,
ADD COLUMN     "options" JSON DEFAULT '[]';
