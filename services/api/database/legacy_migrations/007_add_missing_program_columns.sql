-- Migration: Add missing columns to programs table
-- Date: November 26, 2025

-- Add slug column (required for caching)
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS slug VARCHAR(255) NOT NULL DEFAULT '';

-- Add short_description
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS short_description VARCHAR(500);

-- Add visibility and status columns
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS is_visible_to_users BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'draft';

-- Add media columns
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(500);

ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS banner_url VARCHAR(500);

ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS video_url VARCHAR(500);

-- Add program settings
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS require_email_verification BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD';

ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS enable_currency_conversion BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);

-- Add registration settings
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS allow_registration BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS registration_open_date TIMESTAMPTZ;

ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS registration_close_date TIMESTAMPTZ;

ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS require_payment BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS registration_fee DECIMAL(10,2);

-- Add additional info
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS requirements_description TEXT;

ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS benefits_description TEXT;

ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;

-- Add SEO columns
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS meta_title VARCHAR(255);

ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS meta_description TEXT;

-- Generate slugs for existing programs (from name)
UPDATE programs 
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
WHERE slug = '';

-- Add unique constraint on program_category_id + slug
ALTER TABLE programs 
ADD CONSTRAINT programs_program_category_id_slug_key 
UNIQUE (program_category_id, slug);

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_programs_slug ON programs(slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS programs_is_visible_to_users_idx ON programs(is_visible_to_users);
CREATE INDEX IF NOT EXISTS programs_status_idx ON programs(status);

COMMENT ON COLUMN programs.slug IS 'URL-friendly identifier for programs';
COMMENT ON COLUMN programs.is_visible_to_users IS 'Whether program is visible on public website';
COMMENT ON COLUMN programs.status IS 'Program status: draft, published, ongoing, completed, cancelled';
