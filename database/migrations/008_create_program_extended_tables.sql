-- Migration: Create Extended Program Tables
-- Created: 2025-11-11
-- Purpose: Additional program-related tables from MySQL schema

-- Program Types
CREATE TABLE IF NOT EXISTS program_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    slug VARCHAR(100) UNIQUE NOT NULL,
    icon VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    legacy_id INTEGER UNIQUE
);

-- Program Categories
CREATE TABLE IF NOT EXISTS program_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_type_id UUID NOT NULL REFERENCES program_types(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(255) UNIQUE NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    parent_category_id UUID REFERENCES program_categories(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    legacy_id INTEGER UNIQUE
);

-- Update programs table to reference category
ALTER TABLE programs ADD COLUMN IF NOT EXISTS program_category_id UUID REFERENCES program_categories(id);
ALTER TABLE programs ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS theme VARCHAR(255);
ALTER TABLE programs ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';

-- Program Subthemes
CREATE TABLE IF NOT EXISTS program_subthemes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    legacy_id INTEGER UNIQUE
);

-- Program Documents (required documents for application)
CREATE TABLE IF NOT EXISTS program_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    document_type VARCHAR(50) NOT NULL, -- 'pdf', 'image', 'video', etc.
    is_required BOOLEAN DEFAULT TRUE,
    max_file_size INTEGER, -- in KB
    allowed_extensions JSONB DEFAULT '[]', -- e.g., ['pdf', 'jpg', 'png']
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    legacy_id INTEGER UNIQUE
);

-- Program Essays (essay questions for applications)
CREATE TABLE IF NOT EXISTS program_essays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    description TEXT,
    min_words INTEGER,
    max_words INTEGER,
    is_required BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    legacy_id INTEGER UNIQUE
);

-- Program FAQs
CREATE TABLE IF NOT EXISTS program_faqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    legacy_id INTEGER UNIQUE
);

-- Program Schedules
CREATE TABLE IF NOT EXISTS program_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    location VARCHAR(255),
    is_mandatory BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    legacy_id INTEGER UNIQUE
);

-- Program Speakers
CREATE TABLE IF NOT EXISTS program_speakers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    organization VARCHAR(255),
    bio TEXT,
    photo_url TEXT,
    email VARCHAR(255),
    linkedin_url TEXT,
    twitter_url TEXT,
    display_order INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    legacy_id INTEGER UNIQUE
);

-- Program Sponsors
CREATE TABLE IF NOT EXISTS program_sponsors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url TEXT,
    website_url TEXT,
    sponsor_tier VARCHAR(50), -- 'platinum', 'gold', 'silver', 'bronze'
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    legacy_id INTEGER UNIQUE
);

-- Program Announcements
CREATE TABLE IF NOT EXISTS program_announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    announcement_type VARCHAR(50) NOT NULL, -- 'info', 'warning', 'urgent'
    target_audience VARCHAR(50) DEFAULT 'all', -- 'all', 'applicants', 'accepted'
    is_pinned BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    legacy_id INTEGER UNIQUE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_program_types_slug ON program_types(slug);
CREATE INDEX IF NOT EXISTS idx_program_categories_type ON program_categories(program_type_id);
CREATE INDEX IF NOT EXISTS idx_program_categories_slug ON program_categories(slug);
CREATE INDEX IF NOT EXISTS idx_program_categories_parent ON program_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_programs_category ON programs(program_category_id);
CREATE INDEX IF NOT EXISTS idx_programs_slug ON programs(slug);
CREATE INDEX IF NOT EXISTS idx_program_subthemes_program ON program_subthemes(program_id);
CREATE INDEX IF NOT EXISTS idx_program_documents_program ON program_documents(program_id);
CREATE INDEX IF NOT EXISTS idx_program_essays_program ON program_essays(program_id);
CREATE INDEX IF NOT EXISTS idx_program_faqs_program ON program_faqs(program_id);
CREATE INDEX IF NOT EXISTS idx_program_schedules_program ON program_schedules(program_id);
CREATE INDEX IF NOT EXISTS idx_program_speakers_program ON program_speakers(program_id);
CREATE INDEX IF NOT EXISTS idx_program_sponsors_program ON program_sponsors(program_id);
CREATE INDEX IF NOT EXISTS idx_program_announcements_program ON program_announcements(program_id);

-- Create triggers
CREATE TRIGGER update_program_types_updated_at BEFORE UPDATE ON program_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_program_categories_updated_at BEFORE UPDATE ON program_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_program_subthemes_updated_at BEFORE UPDATE ON program_subthemes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_program_documents_updated_at BEFORE UPDATE ON program_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_program_essays_updated_at BEFORE UPDATE ON program_essays FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_program_faqs_updated_at BEFORE UPDATE ON program_faqs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_program_schedules_updated_at BEFORE UPDATE ON program_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_program_speakers_updated_at BEFORE UPDATE ON program_speakers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_program_sponsors_updated_at BEFORE UPDATE ON program_sponsors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_program_announcements_updated_at BEFORE UPDATE ON program_announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default program types
INSERT INTO program_types (name, description, slug) VALUES
    ('Conference', 'Academic and professional conferences', 'conference'),
    ('Competition', 'Competitive programs and contests', 'competition'),
    ('Workshop', 'Hands-on training workshops', 'workshop'),
    ('Bootcamp', 'Intensive training programs', 'bootcamp')
ON CONFLICT (slug) DO NOTHING;

COMMENT ON TABLE program_types IS 'Types of programs offered';
COMMENT ON TABLE program_categories IS 'Categories within program types';
COMMENT ON TABLE program_subthemes IS 'Subthemes or tracks within programs';
COMMENT ON TABLE program_documents IS 'Required documents for program applications';
COMMENT ON TABLE program_essays IS 'Essay questions for program applications';
