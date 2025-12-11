-- ============================================================================
-- PAYMENT SYSTEM REFACTOR
-- Replace ProgramPricingTier with comprehensive payment management system
-- ============================================================================

-- Drop old pricing tiers table and relations
ALTER TABLE "participant_applications" DROP CONSTRAINT IF EXISTS "participant_applications_pricing_tier_id_fkey";
DROP INDEX IF EXISTS "participant_applications_pricing_tier_id_idx";
ALTER TABLE "participant_applications" DROP COLUMN IF EXISTS "pricing_tier_id";
ALTER TABLE "participant_applications" DROP COLUMN IF EXISTS "payment_amount";

DROP TABLE IF EXISTS "program_pricing_tiers" CASCADE;

-- ============================================================================
-- CREATE NEW PAYMENT TABLES
-- ============================================================================

-- 1. Program Payments (what needs to be paid: registration, installments)
CREATE TABLE "program_payments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "payment_type" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CONSTRAINT "program_payments_pkey" PRIMARY KEY ("id")
);

-- 2. Program Payment Periods (when payments are available)
CREATE TABLE "program_payment_periods" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_payment_id" UUID NOT NULL,
    "name" VARCHAR(100),
    "start_date" TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    "end_date" TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    "amount" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CONSTRAINT "program_payment_periods_pkey" PRIMARY KEY ("id")
);

-- 3. Program Payment Transactions (actual payment records)
CREATE TABLE "program_payment_transactions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "application_id" UUID NOT NULL,
    "program_payment_id" UUID NOT NULL,
    "program_payment_period_id" UUID,
    "funding_type" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "payment_service_id" UUID,
    "payment_method" VARCHAR(50),
    "payment_gateway" VARCHAR(50),
    "due_date" TIMESTAMP(6) WITH TIME ZONE,
    "paid_at" TIMESTAMP(6) WITH TIME ZONE,
    "notes" TEXT,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CONSTRAINT "program_payment_transactions_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- UPDATE PARTICIPANT APPLICATIONS TABLE
-- ============================================================================

-- Add new payment-related columns
ALTER TABLE "participant_applications"
ADD COLUMN "funding_type" VARCHAR(50),
ADD COLUMN "total_amount" DECIMAL(10,2),
ADD COLUMN "total_paid" DECIMAL(10,2) DEFAULT 0,
-- payment_status already exists, handled via ALTER below
ADD COLUMN "reimbursement_status" VARCHAR(50) DEFAULT 'not_applicable',
ADD COLUMN "reimbursed_at" TIMESTAMP(6) WITH TIME ZONE,
ADD COLUMN "reimbursement_amount" DECIMAL(10,2),
ADD COLUMN "reimbursement_method" VARCHAR(100),
ADD COLUMN "reimbursement_notes" TEXT;

-- Set default for existing payment_status column
ALTER TABLE "participant_applications" ALTER COLUMN "payment_status" SET DEFAULT 'pending';


-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

-- program_payments indexes
CREATE INDEX "program_payments_program_id_idx" ON "program_payments"("program_id");
CREATE INDEX "program_payments_payment_type_idx" ON "program_payments"("payment_type");
CREATE INDEX "program_payments_is_active_idx" ON "program_payments"("is_active");

-- program_payment_periods indexes
CREATE INDEX "program_payment_periods_program_payment_id_idx" ON "program_payment_periods"("program_payment_id");
CREATE INDEX "program_payment_periods_start_date_end_date_idx" ON "program_payment_periods"("start_date", "end_date");
CREATE INDEX "program_payment_periods_is_active_idx" ON "program_payment_periods"("is_active");

-- program_payment_transactions indexes
CREATE INDEX "program_payment_transactions_application_id_idx" ON "program_payment_transactions"("application_id");
CREATE INDEX "program_payment_transactions_program_payment_id_idx" ON "program_payment_transactions"("program_payment_id");
CREATE INDEX "program_payment_transactions_status_idx" ON "program_payment_transactions"("status");
CREATE INDEX "program_payment_transactions_due_date_idx" ON "program_payment_transactions"("due_date");
CREATE INDEX "program_payment_transactions_paid_at_idx" ON "program_payment_transactions"("paid_at");

-- ============================================================================
-- ADD FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE "program_payments" 
ADD CONSTRAINT "program_payments_program_id_fkey" 
FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_payment_periods" 
ADD CONSTRAINT "program_payment_periods_program_payment_id_fkey" 
FOREIGN KEY ("program_payment_id") REFERENCES "program_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_payment_transactions" 
ADD CONSTRAINT "program_payment_transactions_application_id_fkey" 
FOREIGN KEY ("application_id") REFERENCES "participant_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_payment_transactions" 
ADD CONSTRAINT "program_payment_transactions_program_payment_id_fkey" 
FOREIGN KEY ("program_payment_id") REFERENCES "program_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- CREATE TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE TRIGGER update_program_payments_updated_at 
BEFORE UPDATE ON program_payments 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_program_payment_periods_updated_at 
BEFORE UPDATE ON program_payment_periods 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_program_payment_transactions_updated_at 
BEFORE UPDATE ON program_payment_transactions 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();
