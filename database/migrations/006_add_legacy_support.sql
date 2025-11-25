-- Migration: Add Legacy Support for MySQL Migration
-- Created: 2025-11-11
-- Purpose: Add columns and tables needed for MySQL to PostgreSQL migration

-- Add legacy_id columns to track original MySQL IDs
ALTER TABLE users ADD COLUMN IF NOT EXISTS legacy_id INTEGER UNIQUE;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS legacy_id INTEGER UNIQUE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS legacy_id INTEGER UNIQUE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS legacy_id INTEGER UNIQUE;
ALTER TABLE files ADD COLUMN IF NOT EXISTS legacy_id INTEGER UNIQUE;

-- Add soft delete support
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);
ALTER TABLE programs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);

-- Create migration tracking table
CREATE TABLE IF NOT EXISTS migration_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    mysql_id INTEGER NOT NULL,
    postgres_id UUID NOT NULL,
    migrated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    migration_batch VARCHAR(50),
    UNIQUE(table_name, mysql_id)
);

CREATE INDEX IF NOT EXISTS idx_migration_tracking_table ON migration_tracking(table_name);
CREATE INDEX IF NOT EXISTS idx_migration_tracking_mysql_id ON migration_tracking(mysql_id);
CREATE INDEX IF NOT EXISTS idx_migration_tracking_postgres_id ON migration_tracking(postgres_id);

-- Create indexes for soft deletes
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_programs_deleted_at ON programs(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_applications_deleted_at ON applications(deleted_at) WHERE deleted_at IS NULL;

COMMENT ON TABLE migration_tracking IS 'Tracks MySQL to PostgreSQL ID mappings for data migration';
COMMENT ON COLUMN users.legacy_id IS 'Original MySQL integer ID for reference';
COMMENT ON COLUMN users.deleted_at IS 'Soft delete timestamp - NULL means active';
