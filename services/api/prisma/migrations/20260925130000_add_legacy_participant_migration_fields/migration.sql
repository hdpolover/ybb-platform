-- Legacy participant/application/payment migration support.
--
-- users, participants, brands, programs, ambassadors, ambassador_referrals and
-- participant_documents already carry a legacy_id column from earlier migrations
-- (20260531120000_add_legacy_content_fields and the original schema). This
-- migration adds legacy_id anchors to the tables that legacy-participants
-- migration needs and did not yet have: participant_applications (legacy
-- `participants` row, one per program registration), application_invoices
-- (legacy `payments` row), program_essays and program_pricing_tiers (needed to
-- key essayAnswers JSON and invoice pricing_tier_id resolution by legacy id
-- instead of fragile name/order matching).
--
-- Written idempotently (IF NOT EXISTS), matching the 20260531120000 convention,
-- since this may be re-run against an environment where a prior partial run
-- already applied some of these columns via raw DDL.

ALTER TABLE "participant_applications" ADD COLUMN IF NOT EXISTS "legacy_id" INTEGER;
ALTER TABLE "application_invoices"     ADD COLUMN IF NOT EXISTS "legacy_id" INTEGER;
ALTER TABLE "program_essays"           ADD COLUMN IF NOT EXISTS "legacy_id" INTEGER;
ALTER TABLE "program_pricing_tiers"    ADD COLUMN IF NOT EXISTS "legacy_id" INTEGER;

-- application_invoices needs a compound unique: a single legacy `payments` row
-- id is only unique together with which invoice "slot" it settles, but in
-- practice one legacy payment settles exactly one program_payments line, so a
-- plain unique on legacy_id is sufficient and mirrors the other tables' style.
CREATE UNIQUE INDEX IF NOT EXISTS "participant_applications_legacy_id_key" ON "participant_applications"("legacy_id");
CREATE UNIQUE INDEX IF NOT EXISTS "application_invoices_legacy_id_key"     ON "application_invoices"("legacy_id");
CREATE UNIQUE INDEX IF NOT EXISTS "program_essays_legacy_id_key"           ON "program_essays"("legacy_id");
CREATE UNIQUE INDEX IF NOT EXISTS "program_pricing_tiers_legacy_id_key"    ON "program_pricing_tiers"("legacy_id");
