-- Migration: Create Programs Table
-- Created: 2025-11-11

CREATE TABLE IF NOT EXISTS programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('conference', 'competition', 'workshop', 'bootcamp')),
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    application_deadline TIMESTAMP NOT NULL,
    location VARCHAR(255) NOT NULL,
    capacity INTEGER NOT NULL,
    registered_count INTEGER DEFAULT 0,
    fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    cover_image TEXT,
    requirements JSONB,
    benefits JSONB,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_programs_status ON programs(status);
CREATE INDEX IF NOT EXISTS idx_programs_type ON programs(type);
CREATE INDEX IF NOT EXISTS idx_programs_start_date ON programs(start_date);

-- Trigger for updated_at
CREATE TRIGGER update_programs_updated_at 
BEFORE UPDATE ON programs 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();
