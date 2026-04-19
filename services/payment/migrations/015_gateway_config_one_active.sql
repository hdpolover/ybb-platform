-- Migration: 015_gateway_config_one_active.sql
-- Description: Enforce "only one active config per provider" at the DB layer.
-- A partial unique index catches concurrent activations that the application
-- layer might miss. Matches the repository/handler guard in code.

CREATE UNIQUE INDEX IF NOT EXISTS idx_gateway_config_one_active_per_provider
    ON payment_gateway_configs (provider)
    WHERE is_active = true AND deleted_at IS NULL;

-- Supporting index for the PaymentMethod → GatewayConfig reverse lookup used
-- by the delete-guard (block removing a provider still referenced by methods).
CREATE INDEX IF NOT EXISTS idx_payment_methods_gateway_name
    ON payment_methods (gateway_name)
    WHERE deleted_at IS NULL AND gateway_name <> '';
