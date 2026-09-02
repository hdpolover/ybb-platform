-- Reminder audience scan (RegistrationFeeAudienceService.buildWhere) filters
-- participant_applications by program_id + registration_payment_status <> 'paid'
-- + deleted_at IS NULL. EXPLAIN on production shows a full seq scan of the
-- table (33k rows, 16.5M tuples read in 14h across 502 scans).
-- Partial so the index only carries the small unpaid tail, not every row.

CREATE INDEX IF NOT EXISTS "idx_apps_program_unpaid_active"
ON "participant_applications" ("program_id")
WHERE "registration_payment_status" <> 'paid'::"PaymentStatus" AND "deleted_at" IS NULL;
