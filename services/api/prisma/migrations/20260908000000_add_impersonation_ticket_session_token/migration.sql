-- Anchors an impersonation ticket to the single UserSession its redeemed
-- access token carries as `sid`. Nullable + no backfill: 236 existing rows
-- were minted before this column existed and are long past their 5-minute
-- exchange TTL, so they legitimately have no session to point at.
ALTER TABLE "support_access_impersonation_tickets"
  ADD COLUMN IF NOT EXISTS "session_token" VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS "support_access_impersonation_tickets_session_token_key"
  ON "support_access_impersonation_tickets" ("session_token");
