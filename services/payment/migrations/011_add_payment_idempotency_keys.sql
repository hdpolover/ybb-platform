CREATE TABLE IF NOT EXISTS payment_idempotency_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    idempotency_key VARCHAR(255) NOT NULL,
    scope VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL,
    transaction_id UUID,
    response_body JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_payment_idempotency_key_scope UNIQUE (idempotency_key, scope)
);

CREATE INDEX IF NOT EXISTS idx_payment_idempotency_scope_resource
    ON payment_idempotency_keys(scope, resource_id);