-- Payment Service Database Schema
-- Separate database for payment microservice following industry standards
-- Database: ybb_payments_db

\c ybb_payments_db;

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- External references (from API service)
    application_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    
    -- Payment details
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'IDR',
    status VARCHAR(50) NOT NULL,
    payment_method VARCHAR(50),
    description TEXT,
    
    -- Gateway information
    gateway_name VARCHAR(50) NOT NULL,
    gateway_order_id VARCHAR(255),
    gateway_response JSONB,
    
    -- Customer information
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    
    -- Callback URLs
    callback_url TEXT,
    redirect_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP,
    failed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    refunded_at TIMESTAMP,
    
    -- Metadata
    metadata JSONB,
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'success', 'failed', 'cancelled', 'refunded')),
    CONSTRAINT valid_currency CHECK (currency IN ('IDR', 'USD', 'SGD', 'MYR')),
    CONSTRAINT valid_payment_method CHECK (payment_method IN ('credit_card', 'bank_transfer', 'e_wallet', 'qr_code'))
);

-- Indexes for performance
CREATE INDEX idx_payments_application_id ON payments(application_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_gateway_order_id ON payments(gateway_order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_gateway_name ON payments(gateway_name);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX idx_payments_user_status ON payments(user_id, status);

-- Trigger for updated_at
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Payment events log (for audit trail)
CREATE TABLE IF NOT EXISTS payment_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_event_type CHECK (event_type IN (
        'payment.created',
        'payment.processing',
        'payment.succeeded',
        'payment.failed',
        'payment.cancelled',
        'payment.refunded',
        'webhook.received',
        'gateway.callback'
    ))
);

CREATE INDEX idx_payment_events_payment_id ON payment_events(payment_id);
CREATE INDEX idx_payment_events_type ON payment_events(event_type);
CREATE INDEX idx_payment_events_created_at ON payment_events(created_at DESC);

-- Refunds table
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    reason TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    gateway_refund_id VARCHAR(255),
    gateway_response JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    
    CONSTRAINT valid_refund_status CHECK (status IN ('pending', 'processing', 'success', 'failed'))
);

CREATE INDEX idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX idx_refunds_status ON refunds(status);
CREATE INDEX idx_refunds_created_at ON refunds(created_at DESC);

-- Payment gateway configurations (for multi-gateway support)
CREATE TABLE IF NOT EXISTS gateway_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gateway_name VARCHAR(50) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_production BOOLEAN NOT NULL DEFAULT false,
    config JSONB NOT NULL, -- Encrypted sensitive data should be in env vars
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_gateway_configs_updated_at
    BEFORE UPDATE ON gateway_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default gateway configurations
INSERT INTO gateway_configs (gateway_name, is_active, is_production, config) VALUES
    ('midtrans', true, false, '{"supported_methods": ["credit_card", "bank_transfer", "e_wallet", "qr_code"]}'),
    ('stripe', false, false, '{"supported_methods": ["credit_card"]}'),
    ('paypal', false, false, '{"supported_methods": ["e_wallet"]}')
ON CONFLICT (gateway_name) DO NOTHING;

\echo 'Payment service schema created successfully!';
