-- Migration: 005_reset_payment_v2.sql
-- Description: Full reset and implementation of the V2 Hybrid Payment Schema
-- Author: GitHub Copilot

-- ============================================================================
-- 0. CLEANUP (Destructive)
-- ============================================================================
-- We drop everything to ensure a clean slate for the V2 schema.
DROP TABLE IF EXISTS payment_events CASCADE;
DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS payment_intents CASCADE;
DROP TABLE IF EXISTS manual_payment_details CASCADE;
DROP TABLE IF EXISTS payment_methods CASCADE;
DROP TABLE IF EXISTS payment_gateway_configs CASCADE;
DROP TABLE IF EXISTS refunds CASCADE;
DROP TABLE IF EXISTS payments CASCADE; -- Legacy table if exists
DROP TABLE IF EXISTS gateway_configs CASCADE; -- Legacy
DROP TYPE IF EXISTS payment_intent_status CASCADE;
DROP TYPE IF EXISTS payment_transaction_status CASCADE;
DROP TYPE IF EXISTS payment_method_type CASCADE;

-- ============================================================================
-- 1. EXTENSIONS & ENUMS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Status Enums (State Machine)
CREATE TYPE payment_intent_status AS ENUM (
    'REQUIRES_PAYMENT_METHOD', -- Waiting for user input / retry
    'PROCESSING',              -- Waiting for Gateway (VA pending) or Redirecting
    'SUCCEEDED',               -- Money in bank
    'CANCELED',                -- User aborted
    'EXPIRED'                  -- Cleanup job flagged it
);

CREATE TYPE payment_transaction_status AS ENUM (
    'PENDING',      -- Initial state before Gateway response
    'NEEDS_REVIEW', -- Manual payment waiting for admin
    'SUCCESS',      -- Gateway confirmed
    'FAILED',       -- Gateway rejected (Insufficient funds, etc)
    'VOID',         -- Cancelled by Admin
    'REJECTED'      -- Manual proof rejected by Admin
);

CREATE TYPE payment_method_type AS ENUM (
    'MANUAL',    -- Offline transfer + Proof upload
    'AUTOMATIC'  -- Midtrans/Xendit/Stripe
);

-- ============================================================================
-- 2. TABLE: Payment Gateway Configurations
-- ============================================================================
-- Stores credentials (Server Keys) per Program.
-- If program_category_id IS NULL, it acts as a Global Fallback.

CREATE TABLE payment_gateway_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_category_id UUID, -- Optional: Link to Tenant/Program in API Service (Loose Ref)
    
    provider VARCHAR(50) NOT NULL, -- 'midtrans', 'xendit'
    mode VARCHAR(20) DEFAULT 'sandbox', -- 'sandbox', 'production'
    
    server_key TEXT NOT NULL,
    client_key TEXT NOT NULL,
    webhook_secret TEXT,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pgc_program_category ON payment_gateway_configs(program_category_id);

-- ============================================================================
-- 3. TABLE: Payment Methods (Master List)
-- ============================================================================
-- Defines what options show up on the Checkout UI.

CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    code VARCHAR(50) UNIQUE NOT NULL, -- 'manual_bca', 'midtrans_gopay'
    name VARCHAR(100) NOT NULL,       -- 'Bank Transfer BCA'
    type payment_method_type NOT NULL,
    provider VARCHAR(50),             -- 'midtrans' or NULL for manual
    
    logo_url TEXT,
    is_enabled BOOLEAN DEFAULT TRUE,
    description TEXT,
    sort_order INT DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. TABLE: Manual Payment Details
-- ============================================================================
-- The "Instructions" shown to users when they pick a Manual method.

CREATE TABLE manual_payment_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_method_id UUID NOT NULL REFERENCES payment_methods(id) ON DELETE CASCADE,
    
    provider_name VARCHAR(100) NOT NULL, -- 'BCA', 'PayPal'
    account_number VARCHAR(100) NOT NULL,
    account_holder VARCHAR(100) NOT NULL,
    instruction_text TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 5. TABLE: Payment Intents (The "Bill")
-- ============================================================================
-- Represents the User's Obligation to Pay. 
-- Valid for a specific amount and duration.

CREATE TABLE payment_intents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- From Main API (Reference Only)
    program_payment_id UUID, -- Optional: Link back to ParticipantApplication if needed
    
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'IDR',
    status payment_intent_status DEFAULT 'REQUIRES_PAYMENT_METHOD',
    
    -- Context Persistence
    metadata JSONB DEFAULT '{}'::JSONB, 
    -- Contains: { "program_id": "...", "tier_id": "...", "application_id": "..." }
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_intent_user ON payment_intents(user_id);
CREATE INDEX idx_intent_status ON payment_intents(status);

-- ============================================================================
-- 6. TABLE: Payment Transactions (The "Attempt")
-- ============================================================================
-- A single intent can have multiple attempts (failed cards, switched to VA, etc).

CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
    
    -- Snapshot of what they picked
    payment_method_code VARCHAR(50), -- e.g. 'midtrans_bca'
    is_manual BOOLEAN DEFAULT FALSE,
    
    -- Gateway Data
    gateway_reference_id TEXT, -- Midtrans Order ID or Transaction ID
    gateway_response JSONB,   -- Full raw response dump for debugging
    
    -- Manual Data
    proof_file_url TEXT,
    admin_notes TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    
    status payment_transaction_status DEFAULT 'PENDING',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_txn_intent ON payment_transactions(payment_intent_id);
CREATE INDEX idx_txn_gateway_ref ON payment_transactions(gateway_reference_id);

-- ============================================================================
-- 7. TABLE: Payment Events (Audit Trail)
-- ============================================================================
-- Logs every Webhook, Status Change, and Error.

CREATE TABLE payment_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_intent_id UUID REFERENCES payment_intents(id) ON DELETE SET NULL,
    payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
    
    event_type VARCHAR(100) NOT NULL, -- 'intent.created', 'webhook.received'
    payload JSONB,
    
    ip_address VARCHAR(45),
    user_agent TEXT,
    idempotency_key TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 8. SEED DATA (Testing & Defaults)
-- ============================================================================

-- A. Payment Methods
INSERT INTO payment_methods (code, name, type, provider, description, sort_order) VALUES
('manual_bca', 'Bank Transfer BCA (Manual)', 'MANUAL', NULL, 'Transfer manually via ATM/M-Banking', 1),
('manual_paypal', 'PayPal (Manual)', 'MANUAL', NULL, 'Send to our PayPal email', 2),
('midtrans_cc', 'Credit Card', 'AUTOMATIC', 'midtrans', 'Visa / Mastercard / JCB', 3),
('midtrans_gopay', 'GoPay', 'AUTOMATIC', 'midtrans', 'Scan QR Code', 4);

-- B. Manual Details (Assuming IDs from above, but using subquery for safety)
INSERT INTO manual_payment_details (payment_method_id, provider_name, account_number, account_holder, instruction_text)
SELECT id, 'BCA', '8080123456', 'YBB Foundation', 'Please include your Invoice ID in the transfer note.'
FROM payment_methods WHERE code = 'manual_bca';

INSERT INTO manual_payment_details (payment_method_id, provider_name, account_number, account_holder, instruction_text)
SELECT id, 'PayPal', 'finance@ybbhub.com', 'YBB International', 'Send as Friends & Family to avoid fee deduction.'
FROM payment_methods WHERE code = 'manual_paypal';

-- C. Gateway Config (Global Fallback for Sandbox)
INSERT INTO payment_gateway_configs (provider, mode, server_key, client_key) VALUES
('midtrans', 'sandbox', 'SB-Mid-server-YOUR_KEY_HERE', 'SB-Mid-client-YOUR_KEY_HERE');
