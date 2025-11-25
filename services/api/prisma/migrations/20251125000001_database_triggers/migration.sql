-- Database Triggers and Functions for YBB Platform
-- Implements automatic timestamp management and business logic automation

-- ============================================================================
-- 1. UPDATE updated_at TRIGGER
-- ============================================================================
-- Automatically updates the updated_at timestamp on any row modification

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_program_categories_updated_at BEFORE UPDATE ON program_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_roles_updated_at BEFORE UPDATE ON admin_roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admins_updated_at BEFORE UPDATE ON admins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON programs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_participants_updated_at BEFORE UPDATE ON participants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ambassadors_updated_at BEFORE UPDATE ON ambassadors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_participant_applications_updated_at BEFORE UPDATE ON participant_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_deletion_requests_updated_at BEFORE UPDATE ON account_deletion_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_announcements_updated_at BEFORE UPDATE ON system_announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. APPLICATION STATUS TIMESTAMP TRIGGER
-- ============================================================================
-- Automatically populates status-specific timestamps when application status changes

CREATE OR REPLACE FUNCTION update_application_status_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    -- Update timestamp based on status change
    IF NEW.status != OLD.status THEN
        CASE NEW.status
            WHEN 'submitted' THEN
                NEW.submitted_at = CURRENT_TIMESTAMP;
            WHEN 'under_review' THEN
                NEW.under_review_at = CURRENT_TIMESTAMP;
            WHEN 'interview_scheduled' THEN
                NEW.interview_scheduled_at = CURRENT_TIMESTAMP;
            WHEN 'accepted' THEN
                NEW.accepted_at = CURRENT_TIMESTAMP;
            WHEN 'rejected' THEN
                NEW.rejected_at = CURRENT_TIMESTAMP;
            WHEN 'waitlisted' THEN
                NEW.waitlisted_at = CURRENT_TIMESTAMP;
            WHEN 'withdrawn' THEN
                NEW.withdrawn_at = CURRENT_TIMESTAMP;
            ELSE
                -- No specific timestamp for other statuses
        END CASE;
        
        -- Update status_history JSONB array
        NEW.status_history = COALESCE(NEW.status_history, '[]'::json)::jsonb || 
            jsonb_build_object(
                'status', NEW.status,
                'timestamp', CURRENT_TIMESTAMP,
                'changed_by', COALESCE(NEW.reviewed_by, NEW.withdrawn_by),
                'notes', NEW.reviewer_notes
            );
    END IF;
    
    -- Track last edit
    IF NEW.motivation_letter != OLD.motivation_letter OR
       NEW.achievements != OLD.achievements OR
       NEW.experiences != OLD.experiences THEN
        NEW.last_edited_at = CURRENT_TIMESTAMP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_application_status_ts BEFORE UPDATE ON participant_applications
    FOR EACH ROW EXECUTE FUNCTION update_application_status_timestamps();

-- ============================================================================
-- 3. PROFILE COMPLETION PERCENTAGE TRIGGER
-- ============================================================================
-- Automatically calculates and updates profile completion percentage

CREATE OR REPLACE FUNCTION calculate_profile_completion()
RETURNS TRIGGER AS $$
DECLARE
    total_fields INTEGER := 25; -- Total number of fields to track
    completed_fields INTEGER := 0;
    completion_percentage INTEGER;
BEGIN
    -- Count non-null important fields
    IF NEW.full_name IS NOT NULL AND LENGTH(NEW.full_name) > 0 THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.birthdate IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.gender IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.phone_number IS NOT NULL AND LENGTH(NEW.phone_number) > 0 THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.phone_verified THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.nationality IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.origin_country IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.origin_city IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.origin_address IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.current_country IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.current_city IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.education_level IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.institution IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.major IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.graduation_year IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.occupation IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.instagram_username IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.linkedin_url IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.emergency_contact_name IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.emergency_contact_phone IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.emergency_contact_email IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.profile_picture_url IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.resume_url IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.tshirt_size IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
    IF NEW.knowledge_source IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
    
    -- Calculate percentage
    completion_percentage := (completed_fields * 100) / total_fields;
    NEW.profile_completion_percentage := completion_percentage;
    
    -- Mark profile as completed if 100%
    IF completion_percentage = 100 AND OLD.profile_completed_at IS NULL THEN
        NEW.profile_completed_at := CURRENT_TIMESTAMP;
    END IF;
    
    -- Track last update
    IF TG_OP = 'UPDATE' THEN
        NEW.last_profile_update := CURRENT_TIMESTAMP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_participant_profile_completion 
BEFORE INSERT OR UPDATE ON participants
    FOR EACH ROW EXECUTE FUNCTION calculate_profile_completion();

-- ============================================================================
-- 4. APPLICATION EDIT HISTORY TRIGGER
-- ============================================================================
-- Automatically logs all changes to application fields for audit trail

CREATE OR REPLACE FUNCTION log_application_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if this is an update operation
    IF TG_OP = 'UPDATE' THEN
        -- Log motivation letter changes
        IF NEW.motivation_letter IS DISTINCT FROM OLD.motivation_letter THEN
            INSERT INTO application_edit_history (
                application_id, field_changed, old_value, new_value, 
                change_type, changed_by, changed_by_type
            ) VALUES (
                NEW.id, 'motivation_letter', OLD.motivation_letter, NEW.motivation_letter,
                'update', 
                COALESCE(NEW.reviewed_by, NEW.withdrawn_by), 
                CASE 
                    WHEN NEW.reviewed_by IS NOT NULL THEN 'admin'
                    WHEN NEW.withdrawn_by IS NOT NULL THEN 'participant'
                    ELSE 'system'
                END
            );
        END IF;
        
        -- Log achievements changes
        IF NEW.achievements IS DISTINCT FROM OLD.achievements THEN
            INSERT INTO application_edit_history (
                application_id, field_changed, old_value, new_value,
                change_type, changed_by, changed_by_type
            ) VALUES (
                NEW.id, 'achievements', OLD.achievements, NEW.achievements,
                'update',
                COALESCE(NEW.reviewed_by, NEW.withdrawn_by),
                CASE 
                    WHEN NEW.reviewed_by IS NOT NULL THEN 'admin'
                    WHEN NEW.withdrawn_by IS NOT NULL THEN 'participant'
                    ELSE 'system'
                END
            );
        END IF;
        
        -- Log experiences changes
        IF NEW.experiences IS DISTINCT FROM OLD.experiences THEN
            INSERT INTO application_edit_history (
                application_id, field_changed, old_value, new_value,
                change_type, changed_by, changed_by_type
            ) VALUES (
                NEW.id, 'experiences', OLD.experiences, NEW.experiences,
                'update',
                COALESCE(NEW.reviewed_by, NEW.withdrawn_by),
                CASE 
                    WHEN NEW.reviewed_by IS NOT NULL THEN 'admin'
                    WHEN NEW.withdrawn_by IS NOT NULL THEN 'participant'
                    ELSE 'system'
                END
            );
        END IF;
        
        -- Log status changes
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            INSERT INTO application_edit_history (
                application_id, field_changed, old_value, new_value,
                change_type, changed_by, changed_by_type
            ) VALUES (
                NEW.id, 'status', OLD.status::TEXT, NEW.status::TEXT,
                'status_change',
                COALESCE(NEW.reviewed_by, NEW.withdrawn_by),
                CASE 
                    WHEN NEW.reviewed_by IS NOT NULL THEN 'admin'
                    WHEN NEW.withdrawn_by IS NOT NULL THEN 'participant'
                    ELSE 'system'
                END
            );
        END IF;
        
        -- Log application_category changes
        IF NEW.application_category IS DISTINCT FROM OLD.application_category THEN
            INSERT INTO application_edit_history (
                application_id, field_changed, old_value, new_value,
                change_type, changed_by, changed_by_type
            ) VALUES (
                NEW.id, 'application_category', OLD.application_category::TEXT, NEW.application_category::TEXT,
                'update',
                COALESCE(NEW.reviewed_by, NEW.withdrawn_by),
                CASE 
                    WHEN NEW.reviewed_by IS NOT NULL THEN 'admin'
                    WHEN NEW.withdrawn_by IS NOT NULL THEN 'participant'
                    ELSE 'system'
                END
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_application_edit_history 
AFTER UPDATE ON participant_applications
    FOR EACH ROW EXECUTE FUNCTION log_application_changes();

-- ============================================================================
-- 5. AMBASSADOR REFERRAL STATS TRIGGER
-- ============================================================================
-- Automatically updates ambassador statistics when referrals change

CREATE OR REPLACE FUNCTION update_ambassador_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment total referrals
        UPDATE ambassadors 
        SET total_referrals = total_referrals + 1,
            last_referral_at = CURRENT_TIMESTAMP
        WHERE id = NEW.ambassador_id;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- If status changed to accepted, increment successful referrals
        IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
            UPDATE ambassadors 
            SET successful_referrals = successful_referrals + 1,
                first_successful_referral_at = CASE 
                    WHEN first_successful_referral_at IS NULL THEN CURRENT_TIMESTAMP 
                    ELSE first_successful_referral_at 
                END
            WHERE id = NEW.ambassador_id;
        END IF;
        
        -- Calculate conversion funnel days
        IF NEW.registered_at IS NOT NULL AND OLD.registered_at IS NULL THEN
            NEW.days_to_register := EXTRACT(DAY FROM NEW.registered_at - NEW.referred_at)::INTEGER;
        END IF;
        
        IF NEW.applied_at IS NOT NULL AND OLD.applied_at IS NULL THEN
            NEW.days_to_apply := EXTRACT(DAY FROM NEW.applied_at - NEW.referred_at)::INTEGER;
        END IF;
        
        IF NEW.accepted_at IS NOT NULL AND OLD.accepted_at IS NULL THEN
            NEW.days_to_accept := EXTRACT(DAY FROM NEW.accepted_at - NEW.referred_at)::INTEGER;
            NEW.total_conversion_days := EXTRACT(DAY FROM NEW.accepted_at - NEW.referred_at)::INTEGER;
        END IF;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement total referrals on deletion
        UPDATE ambassadors 
        SET total_referrals = GREATEST(total_referrals - 1, 0),
            successful_referrals = CASE 
                WHEN OLD.status = 'accepted' THEN GREATEST(successful_referrals - 1, 0)
                ELSE successful_referrals 
            END
        WHERE id = OLD.ambassador_id;
        
        RETURN OLD;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ambassador_referral_stats 
AFTER INSERT OR UPDATE OR DELETE ON ambassador_referrals
    FOR EACH ROW EXECUTE FUNCTION update_ambassador_stats();

-- ============================================================================
-- INDEXES FOR TIMESTAMP-BASED QUERIES
-- ============================================================================

-- Application timeline analysis
CREATE INDEX idx_applications_timeline ON participant_applications(
    draft_created_at, submitted_at, accepted_at
) WHERE deleted_at IS NULL;

-- Participant verification tracking
CREATE INDEX idx_participants_verification ON participants(
    created_at, email_verified_at, phone_verified_at, profile_completed_at
) WHERE deleted_at IS NULL;

-- Ambassador conversion funnel
CREATE INDEX idx_referrals_conversion ON ambassador_referrals(
    referred_at, registered_at, applied_at, accepted_at
);

-- Admin activity tracking
CREATE INDEX idx_admins_activity ON admins(
    activated_at, last_active_at, deactivated_at
) WHERE deleted_at IS NULL;

-- Session expiry cleanup
CREATE INDEX idx_sessions_cleanup ON user_sessions(
    expires_at, is_active, revoked_at
);

COMMENT ON FUNCTION update_updated_at_column() IS 'Universal trigger function to automatically update updated_at timestamp';
COMMENT ON FUNCTION update_application_status_timestamps() IS 'Auto-populates status-specific timestamps and maintains status history';
COMMENT ON FUNCTION calculate_profile_completion() IS 'Calculates profile completion percentage based on 25 key fields';
COMMENT ON FUNCTION log_application_changes() IS 'Creates audit trail entries for all application field changes';
COMMENT ON FUNCTION update_ambassador_stats() IS 'Maintains real-time ambassador referral statistics and conversion metrics';
