-- Payment Service Database Schema
-- Separate database for payment microservice following industry standards
-- Database: ybb_payments_db

\c ybb_payments_db;

-- Payment Methods Configuration Table
-- Admins can enable/disable and configure payment methods
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('automatic', 'manual')),
    code VARCHAR(50) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(255),
    
    -- For automatic methods (gateway-based)
    gateway_name VARCHAR(50),
    gateway_type VARCHAR(50),
    
    -- For manual methods
    account_number VARCHAR(100),
    account_name VARCHAR(255),
    bank_name VARCHAR(100),
    instructions TEXT,
    requires_proof BOOLEAN NOT NULL DEFAULT false,
    admin_instructions TEXT,
    
    -- Configuration
    config JSONB,
    sort_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    
    CONSTRAINT valid_method_type CHECK (type IN ('automatic', 'manual'))
);

CREATE INDEX idx_payment_methods_type ON payment_methods(type);
CREATE INDEX idx_payment_methods_is_active ON payment_methods(is_active);
CREATE INDEX idx_payment_methods_code ON payment_methods(code);
CREATE INDEX idx_payment_methods_deleted_at ON payment_methods(deleted_at);

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
    payment_type VARCHAR(20) NOT NULL DEFAULT 'automatic',
    payment_method VARCHAR(50),
    payment_method_id UUID REFERENCES payment_methods(id),
    description TEXT,
    
    -- Automatic payment fields (gateway-based)
    gateway_name VARCHAR(50),
    gateway_order_id VARCHAR(255),
    gateway_response JSONB,
    redirect_url TEXT,
    
    -- Manual payment fields
    proof_file_id UUID,
    proof_file_url TEXT,
    verified_by_id VARCHAR(255),
    verified_at TIMESTAMP,
    rejected_reason TEXT,
    
    -- Customer information
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    
    -- Callback URLs
    callback_url TEXT,
    
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
    CONSTRAINT valid_payment_type CHECK (payment_type IN ('automatic', 'manual'))
);

-- Indexes for performance
CREATE INDEX idx_payments_application_id ON payments(application_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_gateway_order_id ON payments(gateway_order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_type ON payments(payment_type);
CREATE INDEX idx_payments_method_id ON payments(payment_method_id);
CREATE INDEX idx_payments_gateway_name ON payments(gateway_name);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX idx_payments_user_status ON payments(user_id, status);
CREATE INDEX idx_payments_verified_by ON payments(verified_by_id) WHERE verified_by_id IS NOT NULL;

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
    ('xendit', false, false, '{"supported_methods": ["credit_card", "bank_transfer", "e_wallet"]}'),
    ('stripe', false, false, '{"supported_methods": ["credit_card"]}'),
    ('paypal', false, false, '{"supported_methods": ["e_wallet"]}')
ON CONFLICT (gateway_name) DO NOTHING;

-- Insert default payment methods
-- Automatic methods (via gateways)
INSERT INTO payment_methods (name, type, code, is_active, display_name, description, gateway_name, gateway_type, sort_order) VALUES
    ('Midtrans - Credit Card', 'automatic', 'midtrans_credit_card', true, 'Credit Card (Midtrans)', 'Pay with credit card via Midtrans', 'midtrans', 'credit_card', 1),
    ('Midtrans - Bank Transfer', 'automatic', 'midtrans_bank_transfer', true, 'Bank Transfer (Midtrans)', 'Pay via bank transfer through Midtrans', 'midtrans', 'bank_transfer', 2),
    ('Midtrans - E-Wallet', 'automatic', 'midtrans_ewallet', true, 'E-Wallet (GoPay, OVO)', 'Pay with e-wallet via Midtrans', 'midtrans', 'e_wallet', 3),
    ('Xendit - Virtual Account', 'automatic', 'xendit_va', false, 'Virtual Account (Xendit)', 'Pay via virtual account through Xendit', 'xendit', 'bank_transfer', 4)
ON CONFLICT (code) DO NOTHING;

-- Manual methods (requires proof upload)
INSERT INTO payment_methods (
    name, type, code, is_active, display_name, description, 
    account_number, account_name, bank_name, instructions, requires_proof, 
    admin_instructions, sort_order
) VALUES
    (
        'Bank Transfer - BCA',
        'manual',
        'manual_bca',
        true,
        'Bank Transfer BCA',
        'Transfer to BCA account',
        '1234567890',
        'YBB Foundation',
        'Bank Central Asia (BCA)',
        'Please transfer to the account above and upload your payment proof. Include your application ID in the transfer notes.',
        true,
        'Verify the transfer amount matches the payment amount. Check transaction date is within 24 hours.',
        10
    ),
    (
        'Bank Transfer - Mandiri',
        'manual',
        'manual_mandiri',
        true,
        'Bank Transfer Mandiri',
        'Transfer to Mandiri account',
        '0987654321',
        'YBB Foundation',
        'Bank Mandiri',
        'Please transfer to the account above and upload your payment proof. Include your application ID in the transfer notes.',
        true,
        'Verify the transfer amount matches the payment amount. Check transaction date is within 24 hours.',
        11
    ),
    (
        'Cash Payment',
        'manual',
        'manual_cash',
        false,
        'Cash Payment',
        'Pay with cash at our office',
        NULL,
        NULL,
        NULL,
        'Please visit our office at [address] during business hours (Mon-Fri, 9AM-5PM). Bring your application ID.',
        false,
        'Verify cash amount matches payment amount. Issue receipt to participant.',
        12
    )
ON CONFLICT (code) DO NOTHING;

\echo 'Payment service schema created successfully!';
