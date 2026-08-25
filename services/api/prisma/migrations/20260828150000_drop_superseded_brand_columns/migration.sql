-- services/api/prisma/migrations/20260828150000_drop_superseded_brand_columns/migration.sql

-- Only runs after Tasks 10-18 are deployed/verified AND Task 20's admin UI
-- cutover has shipped -- see this migration's plan-doc entry
-- (docs/superpowers/plans/2026-08-24-program-content-copy-phase-3.md, Task 21)
-- for the full precondition list. One-way: there is no automated rollback
-- script for this specific DROP beyond Postgres point-in-time recovery.
ALTER TABLE "brands"
  DROP COLUMN IF EXISTS "contact_email",
  DROP COLUMN IF EXISTS "contact_phone",
  DROP COLUMN IF EXISTS "contact_whatsapp",
  DROP COLUMN IF EXISTS "contact_address",
  DROP COLUMN IF EXISTS "meta_title",
  DROP COLUMN IF EXISTS "meta_description",
  DROP COLUMN IF EXISTS "meta_keywords";
