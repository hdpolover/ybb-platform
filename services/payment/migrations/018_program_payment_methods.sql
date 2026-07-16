-- Migration: 018_program_payment_methods.sql
-- Description: Per-program payment method overlay table. Master payment_methods
--              stays shared (bank accounts, gateway config); this table holds
--              per-program selection + text overrides. A program with zero rows
--              here is "unconfigured" and falls back to all active master methods
--              (today's behavior) — enforced at the read path, not by this migration.
--              No backfill: overlay rows are created lazily on first admin save.

CREATE TABLE IF NOT EXISTS program_payment_methods (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id                  UUID NOT NULL,
    payment_method_id           UUID NOT NULL REFERENCES payment_methods(id) ON DELETE CASCADE,
    is_enabled                  BOOLEAN NOT NULL DEFAULT TRUE,
    description_override        TEXT,
    instructions_override       TEXT,
    admin_instructions_override TEXT,
    sort_order                  INT NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at                  TIMESTAMP,
    CONSTRAINT uq_program_method UNIQUE (program_id, payment_method_id)
);

CREATE INDEX IF NOT EXISTS idx_ppm_program ON program_payment_methods (program_id) WHERE deleted_at IS NULL;
-- No backfill. Fallback-to-global handles unconfigured programs.
