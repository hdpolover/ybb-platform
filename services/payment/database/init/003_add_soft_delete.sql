\c ybb_payments_db;

-- Add deleted_at to payments table
ALTER TABLE payments ADD COLUMN deleted_at TIMESTAMP;
CREATE INDEX idx_payments_deleted_at ON payments(deleted_at);

-- Add deleted_at to refunds table
ALTER TABLE refunds ADD COLUMN deleted_at TIMESTAMP;
CREATE INDEX idx_refunds_deleted_at ON refunds(deleted_at);

-- Add deleted_at to gateway_configs table
ALTER TABLE gateway_configs ADD COLUMN deleted_at TIMESTAMP;
CREATE INDEX idx_gateway_configs_deleted_at ON gateway_configs(deleted_at);
