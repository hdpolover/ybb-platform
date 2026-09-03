-- AlterTable
ALTER TABLE "application_form_fields" ADD COLUMN     "allowed_categories" "ApplicationCategory"[] DEFAULT ARRAY[]::"ApplicationCategory"[];

-- AlterTable
ALTER TABLE "program_essays" ADD COLUMN     "allowed_categories" "ApplicationCategory"[] DEFAULT ARRAY[]::"ApplicationCategory"[];
