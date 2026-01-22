-- Add performance indexes for program queries
-- This migration ensures all critical indexes exist for optimal query performance

-- Programs table indexes (if not exist)
CREATE INDEX IF NOT EXISTS idx_programs_slug ON programs(slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_programs_status ON programs(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_programs_category_status ON programs(program_category_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_programs_visibility ON programs(is_visible_to_users, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_programs_dates ON programs(start_date, end_date) WHERE deleted_at IS NULL;

-- Program payments indexes
CREATE INDEX IF NOT EXISTS idx_program_payments_program_active ON program_payments(program_id, is_active);
CREATE INDEX IF NOT EXISTS idx_program_payments_type ON program_payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_program_payments_order ON program_payments(program_id, "order");

-- Program payment periods indexes
CREATE INDEX IF NOT EXISTS idx_payment_periods_payment_active ON program_payment_periods(program_payment_id, is_active);
CREATE INDEX IF NOT EXISTS idx_payment_periods_dates ON program_payment_periods(start_date, end_date, is_active);

-- Program content indexes (FAQs, speakers, etc.)
CREATE INDEX IF NOT EXISTS idx_program_faqs_program_active ON program_faqs(program_id, is_active, "order");
CREATE INDEX IF NOT EXISTS idx_program_speakers_program_active ON program_speakers(program_id, is_active, "order");
CREATE INDEX IF NOT EXISTS idx_program_timeline_program_active ON program_timeline(program_id, is_active, "order");
CREATE INDEX IF NOT EXISTS idx_program_testimonials_program_active ON program_testimonials(program_id, is_active, "order");

-- Program requirements indexes
CREATE INDEX IF NOT EXISTS idx_program_requirements_program_active ON program_requirements(program_id, is_active, "order");
CREATE INDEX IF NOT EXISTS idx_application_form_fields_program_active ON application_form_fields(program_id, is_active, "order");

-- Program partners and resources
CREATE INDEX IF NOT EXISTS idx_program_partners_program_active ON program_partners(program_id, is_active, "order");
CREATE INDEX IF NOT EXISTS idx_program_resources_program_public ON program_resources(program_id, is_active, is_public, "order");

-- Program announcements (with date filtering)
CREATE INDEX IF NOT EXISTS idx_program_announcements_program_published ON program_announcements(program_id, is_active, publish_date DESC, is_pinned DESC);

-- Program tags (many-to-many)
CREATE INDEX IF NOT EXISTS idx_program_tags_program ON program_tags(program_id);
CREATE INDEX IF NOT EXISTS idx_program_tags_tag ON program_tags(tag_id);

-- Composite index for list queries
CREATE INDEX IF NOT EXISTS idx_programs_list_query ON programs(program_category_id, status, is_visible_to_users, start_date DESC) 
  WHERE deleted_at IS NULL;

-- Add comments for documentation
COMMENT ON INDEX idx_programs_slug IS 'Fast lookup by slug for public program pages';
COMMENT ON INDEX idx_programs_list_query IS 'Optimized for program listing with filters';
COMMENT ON INDEX idx_payment_periods_dates IS 'Fast filtering for active payment periods by date range';
COMMENT ON INDEX idx_program_announcements_program_published IS 'Optimized for announcements with pinned sorting';
