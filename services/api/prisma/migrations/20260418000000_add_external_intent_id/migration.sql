-- AlterTable
ALTER TABLE "application_invoices" ADD COLUMN "external_intent_id" VARCHAR(100);

-- CreateIndex
CREATE INDEX "application_invoices_external_intent_id_idx" ON "application_invoices"("external_intent_id");
