-- 'full' (super admin impersonation) or 'read_only' (customer-support view).
-- Defaults to 'full' so every existing ticket keeps its current behaviour.
ALTER TABLE "support_access_impersonation_tickets"
  ADD COLUMN IF NOT EXISTS "mode" VARCHAR(16) NOT NULL DEFAULT 'full';
