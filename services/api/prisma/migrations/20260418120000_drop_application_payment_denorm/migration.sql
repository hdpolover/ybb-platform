-- Migration: drop_application_payment_denorm
-- Removes denormalized payment summary columns from participant_applications.
-- Source of truth is ApplicationInvoice; no command handler ever populated these columns.

ALTER TABLE "participant_applications" DROP COLUMN "payment_amount";
ALTER TABLE "participant_applications" DROP COLUMN "payment_id";
ALTER TABLE "participant_applications" DROP COLUMN "payment_status";
