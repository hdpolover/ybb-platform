-- Migration: 022_gateway_config_scope.sql
-- Description: Scope payment gateway configs to global, brand or program, and let a
-- transaction pin the config that charged it (only set for brand/program-scoped configs).

ALTER TABLE payment_gateway_configs ADD COLUMN IF NOT EXISTS program_id UUID;

ALTER TABLE payment_gateway_configs DROP CONSTRAINT IF EXISTS chk_pgc_single_scope;
ALTER TABLE payment_gateway_configs
    ADD CONSTRAINT chk_pgc_single_scope CHECK (brand_id IS NULL OR program_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_pgc_program ON payment_gateway_configs (program_id);

-- One active config per (provider, scope) instead of per provider.
DROP INDEX IF EXISTS idx_gateway_config_one_active_per_provider;
CREATE UNIQUE INDEX IF NOT EXISTS idx_gateway_config_one_active_per_scope
    ON payment_gateway_configs (
        provider,
        COALESCE(brand_id,   '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(program_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    WHERE is_active = true AND deleted_at IS NULL;

-- No FK on purpose: gateway configs are soft-deleted and a txn must outlive its config row.
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS gateway_config_id UUID;
CREATE INDEX IF NOT EXISTS idx_txn_gateway_config
    ON payment_transactions (gateway_config_id) WHERE gateway_config_id IS NOT NULL;
