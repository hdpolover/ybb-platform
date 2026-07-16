-- Migration: 000_bootstrap_helpers.sql
-- Description: Bootstrap database helpers required by the early payment
-- schema migrations. Dokploy prod runs the app-level migration runner only,
-- so these helpers must exist inside the migrations/ directory.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;