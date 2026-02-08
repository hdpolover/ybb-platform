-- Portal Performance Optimization Indexes
-- These indexes significantly improve query performance for portal endpoints

-- Participants - Most frequently queried by userId
CREATE INDEX IF NOT EXISTS "idx_participant_userid" ON "participants"("user_id");

-- Applications - Heavily queried for latest by participant
CREATE INDEX IF NOT EXISTS "idx_app_participant_updated" ON "participant_applications"("participant_id", "updated_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_app_participant_status" ON "participant_applications"("participant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_app_updated_at" ON "participant_applications"("updated_at" DESC);

-- Invoices - Queried for payment status per application
CREATE INDEX IF NOT EXISTS "idx_invoice_application_status" ON "application_invoices"("application_id", "status");
CREATE INDEX IF NOT EXISTS "idx_invoice_pricing_tier" ON "application_invoices"("pricing_tier_id");

-- Documents - Filtered by type for certificates and uploads
CREATE INDEX IF NOT EXISTS "idx_doc_application_type" ON "participant_documents"("application_id", "type");

-- Program Announcement Reads - Join table for read status
CREATE INDEX IF NOT EXISTS "idx_program_announcement_reads_user" ON "program_announcement_reads"("user_id");
CREATE INDEX IF NOT EXISTS "idx_program_announcement_reads_announcement" ON "program_announcement_reads"("announcement_id");

-- User Announcement Reads - System announcements read tracking
CREATE INDEX IF NOT EXISTS "idx_user_announcement_reads_user" ON "user_announcement_reads"("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_announcement_reads_announcement" ON "user_announcement_reads"("announcement_id");

-- Program Announcements - Filtered by active and sorted by date
CREATE INDEX IF NOT EXISTS "idx_program_announcement_program_active" ON "program_announcements"("program_id", "is_active", "created_at" DESC);

-- System Announcements - Filtered by published and sorted
CREATE INDEX IF NOT EXISTS "idx_system_announcement_published" ON "system_announcements"("is_published", "created_at" DESC);

-- Program Resources - Queried by program and filtered by active/public
CREATE INDEX IF NOT EXISTS "idx_program_resource_program_active" ON "program_resources"("program_id", "is_active", "is_public");

-- Program Essays - Queried by program and filtered by active
CREATE INDEX IF NOT EXISTS "idx_program_essay_program_active" ON "program_essays"("program_id", "is_active");

-- Program Requirements - Queried by program and filtered by active
CREATE INDEX IF NOT EXISTS "idx_program_requirement_program_active" ON "program_requirements"("program_id", "is_active");

-- Program Pricing Tiers - Queried by program and filtered by active
CREATE INDEX IF NOT EXISTS "idx_pricing_tier_program_active" ON "program_pricing_tiers"("program_id", "is_active");
