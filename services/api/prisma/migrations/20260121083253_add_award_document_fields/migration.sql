-- AlterTable
ALTER TABLE "participant_awards" ADD COLUMN     "certificate_url" VARCHAR(500),
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "participant_documents" ADD COLUMN     "document_number" VARCHAR(50);
