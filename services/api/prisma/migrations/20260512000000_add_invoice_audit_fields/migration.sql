-- Add verifier audit fields to application_invoices so each verify/reject/manual
-- status change carries a record of who/when/why on the invoice row itself,
-- not just on the linked PaymentTransaction in the payment service.
ALTER TABLE "application_invoices"
    ADD COLUMN "verified_by" UUID,
    ADD COLUMN "verified_at" TIMESTAMPTZ(6),
    ADD COLUMN "rejection_reason" TEXT;
