-- Migration: Add support for legacy data migration
-- Date: 2024-12-11
-- Purpose: Add columns and table to support migrating Midtrans/Xendit data from MySQL

\c ybb_payments_db;

-- Add legacy_id column to payments table for migration tracking
ALTER TABLE payments ADD COLUMN IF NOT EXISTS legacy_id INTEGER;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS legacy_payment_id INTEGER;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS legacy_participant_id INTEGER;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS legacy_program_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_legacy_id ON payments(legacy_id) WHERE legacy_id IS NOT NULL;

-- Gateway transactions table (stores detailed gateway-specific data)
-- This consolidates midtrans_payment and xendit_payment into one table
CREATE TABLE IF NOT EXISTS gateway_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    
    -- Gateway identification (with proper FK relationship)
    gateway_config_id UUID REFERENCES gateway_configs(id),
    gateway_name VARCHAR(50) NOT NULL, -- Denormalized for convenience
    gateway_transaction_id VARCHAR(255), -- transaction_id (midtrans) or id_xendit (xendit)
    gateway_order_id VARCHAR(255), -- order_id (midtrans) or external_id (xendit)
    gateway_user_id VARCHAR(255), -- user_id_xendit for Xendit
    
    -- Transaction details
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
    status VARCHAR(50),
    status_code VARCHAR(10), -- Midtrans status_code
    
    -- Payment method details
    payment_type VARCHAR(50), -- bank_transfer, e_wallet, credit_card, etc.
    payment_method VARCHAR(100), -- Specific method (BCA VA, GoPay, etc.)
    bank VARCHAR(100),
    va_number VARCHAR(100),
    
    -- URLs
    redirect_url TEXT,
    pdf_url TEXT,
    
    -- Customer info (for reference)
    customer_email VARCHAR(255),
    merchant_name VARCHAR(100),
    description TEXT,
    
    -- Timestamps
    transaction_time TIMESTAMP,
    expired_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Full response data (original gateway response)
    raw_response JSONB,
    
    -- Legacy tracking for migration
    legacy_id INTEGER,
    legacy_table VARCHAR(50), -- 'midtrans_payment' or 'xendit_payment'
    
    CONSTRAINT valid_gateway CHECK (gateway_name IN ('midtrans', 'xendit', 'stripe', 'paypal'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gateway_transactions_payment_id ON gateway_transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_gateway_transactions_config_id ON gateway_transactions(gateway_config_id);
CREATE INDEX IF NOT EXISTS idx_gateway_transactions_gateway_name ON gateway_transactions(gateway_name);
CREATE INDEX IF NOT EXISTS idx_gateway_transactions_gateway_order_id ON gateway_transactions(gateway_order_id);
CREATE INDEX IF NOT EXISTS idx_gateway_transactions_gateway_tx_id ON gateway_transactions(gateway_transaction_id);
CREATE INDEX IF NOT EXISTS idx_gateway_transactions_status ON gateway_transactions(status);
CREATE INDEX IF NOT EXISTS idx_gateway_transactions_created_at ON gateway_transactions(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gateway_transactions_legacy ON gateway_transactions(legacy_table, legacy_id) 
    WHERE legacy_id IS NOT NULL;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_gateway_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_gateway_transactions_updated_at ON gateway_transactions;
CREATE TRIGGER update_gateway_transactions_updated_at
    BEFORE UPDATE ON gateway_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_gateway_transactions_updated_at();

-- Migration tracking table for payment service
CREATE TABLE IF NOT EXISTS migration_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    mysql_id INTEGER NOT NULL,
    postgres_id UUID NOT NULL,
    migrated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    migration_batch VARCHAR(50),
    
    UNIQUE(table_name, mysql_id)
);

CREATE INDEX IF NOT EXISTS idx_migration_tracking_table ON migration_tracking(table_name);
CREATE INDEX IF NOT EXISTS idx_migration_tracking_mysql_id ON migration_tracking(mysql_id);

\echo 'Payment service migration support schema created successfully!';
