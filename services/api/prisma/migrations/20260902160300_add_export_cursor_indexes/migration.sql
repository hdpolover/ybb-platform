-- ReportingService keyset-pages every export on (created_at DESC, id DESC)
-- via buildCreatedAtCursorWhere. users, participants and application_invoices
-- had no created_at index at all, so each page fell back to a seq scan + sort.
-- data_change_logs already has data_change_logs_created_at_idx and is skipped.
-- Plain composites, so they are also declared as @@index in schema.prisma.

CREATE INDEX IF NOT EXISTS "users_created_at_id_idx"
ON "users" ("created_at", "id");

CREATE INDEX IF NOT EXISTS "participants_created_at_id_idx"
ON "participants" ("created_at", "id");

CREATE INDEX IF NOT EXISTS "application_invoices_created_at_id_idx"
ON "application_invoices" ("created_at", "id");
