-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other');
CREATE TYPE "ApplicationCategory" AS ENUM ('fully_funded', 'self_funded', 'partial_funded');
CREATE TYPE "ApplicationStatus" AS ENUM ('draft', 'submitted', 'under_review', 'interview_scheduled', 'accepted', 'rejected', 'waitlisted', 'withdrawn');
CREATE TYPE "ScoreStatus" AS ENUM ('pending', 'scored', 'go_to_interview', 'rejected');
CREATE TYPE "ReferralStatus" AS ENUM ('referred', 'registered', 'applied', 'accepted', 'completed');
CREATE TYPE "BlockType" AS ENUM ('temporary', 'permanent');
CREATE TYPE "RiskLevel" AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE "NotificationPriority" AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE "AnnouncementTarget" AS ENUM ('all', 'participants', 'ambassadors', 'specific_program');
CREATE TYPE "AnnouncementPriority" AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE "AnnouncementType" AS ENUM ('general', 'maintenance', 'deadline', 'feature', 'alert');
CREATE TYPE "DeletionStatus" AS ENUM ('pending', 'approved', 'rejected', 'completed', 'cancelled');
CREATE TYPE "Theme" AS ENUM ('light', 'dark', 'auto');
CREATE TYPE "ChangeType" AS ENUM ('create', 'update', 'delete', 'status_change');
CREATE TYPE "ChangedByType" AS ENUM ('participant', 'admin', 'system');

-- CreateTable: program_categories (Foundation for brand-scoped auth)
CREATE TABLE "program_categories" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "slug" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "legacy_id" INTEGER,
    CONSTRAINT "program_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable: users (Brand-Scoped Authentication)
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" VARCHAR(255) NOT NULL,
    "program_category_id" UUID NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verification_token" VARCHAR(255),
    "email_verification_expires" TIMESTAMPTZ(6),
    "password_reset_token" VARCHAR(255),
    "password_reset_expires" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_failed_login" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "last_password_change" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "legacy_id" INTEGER,
    "legacy_type" VARCHAR(20),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_email_program_category_id_key" UNIQUE ("email", "program_category_id")
);

-- CreateTable: admin_roles
CREATE TABLE "admin_roles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "permissions" JSON NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "legacy_id" INTEGER,
    CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: admins
CREATE TABLE "admins" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "phone_number" VARCHAR(20),
    "bio" TEXT,
    "avatar_url" VARCHAR(500),
    "employee_id" VARCHAR(50),
    "department" VARCHAR(100),
    "job_title" VARCHAR(100),
    "role_id" UUID,
    "custom_permissions" JSON NOT NULL DEFAULT '[]',
    "access_level" INTEGER NOT NULL DEFAULT 1,
    "can_manage_admins" BOOLEAN NOT NULL DEFAULT false,
    "can_assign_roles" BOOLEAN NOT NULL DEFAULT false,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en',
    "preferences" JSON NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "activated_at" TIMESTAMPTZ(6),
    "deactivated_at" TIMESTAMPTZ(6),
    "last_active_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "deleted_by" UUID,
    "legacy_id" INTEGER,
    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable: programs
CREATE TABLE "programs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_category_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "year" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "application_deadline" TIMESTAMPTZ(6) NOT NULL,
    "location" VARCHAR(255),
    "capacity" INTEGER,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "legacy_id" INTEGER,
    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: admin_programs
CREATE TABLE "admin_programs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "admin_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "role_in_program" VARCHAR(50),
    "permissions" JSON NOT NULL DEFAULT '[]',
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,
    "removed_at" TIMESTAMPTZ(6),
    "removed_by" UUID,
    "legacy_id" INTEGER,
    CONSTRAINT "admin_programs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_programs_admin_id_program_id_key" UNIQUE ("admin_id", "program_id")
);

-- CreateTable: participants
CREATE TABLE "participants" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "nick_name" VARCHAR(100),
    "display_name" VARCHAR(100),
    "birthdate" DATE,
    "gender" "Gender",
    "phone_country_code" VARCHAR(10),
    "phone_number" VARCHAR(25),
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "nationality" VARCHAR(100),
    "nationality_code" VARCHAR(3),
    "origin_country" VARCHAR(100),
    "origin_city" VARCHAR(100),
    "origin_address" TEXT,
    "current_country" VARCHAR(100),
    "current_city" VARCHAR(100),
    "current_address" TEXT,
    "education_level" VARCHAR(100),
    "institution" VARCHAR(200),
    "major" VARCHAR(200),
    "graduation_year" INTEGER,
    "occupation" VARCHAR(100),
    "instagram_username" VARCHAR(50),
    "linkedin_url" VARCHAR(500),
    "portfolio_url" VARCHAR(500),
    "organizations" TEXT,
    "tshirt_size" VARCHAR(10),
    "dietary_restrictions" TEXT,
    "medical_conditions" TEXT,
    "special_needs" TEXT,
    "emergency_contact_name" VARCHAR(255),
    "emergency_contact_relation" VARCHAR(50),
    "emergency_contact_country_code" VARCHAR(10),
    "emergency_contact_phone" VARCHAR(25),
    "emergency_contact_email" VARCHAR(255),
    "profile_picture_url" VARCHAR(500),
    "resume_url" VARCHAR(500),
    "knowledge_source" VARCHAR(100),
    "referral_code" VARCHAR(20),
    "preferences" JSON NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "profile_completed_at" TIMESTAMPTZ(6),
    "profile_completion_percentage" INTEGER NOT NULL DEFAULT 0,
    "last_profile_update" TIMESTAMPTZ(6),
    "email_verified_at" TIMESTAMPTZ(6),
    "phone_verified_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "legacy_id" INTEGER,
    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ambassadors
CREATE TABLE "ambassadors" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "phone_number" VARCHAR(25),
    "referral_code" VARCHAR(20) NOT NULL,
    "program_id" UUID NOT NULL,
    "institution" VARCHAR(255),
    "gender" "Gender",
    "total_referrals" INTEGER NOT NULL DEFAULT 0,
    "successful_referrals" INTEGER NOT NULL DEFAULT 0,
    "last_referral_at" TIMESTAMPTZ(6),
    "first_successful_referral_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "activated_at" TIMESTAMPTZ(6),
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "legacy_id" INTEGER,
    CONSTRAINT "ambassadors_pkey" PRIMARY KEY ("id")
);

-- CreateTable: participant_applications
CREATE TABLE "participant_applications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "participant_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "application_category" "ApplicationCategory",
    "motivation_letter" TEXT,
    "achievements" TEXT,
    "experiences" TEXT,
    "participant_snapshot" JSON,
    "documents" JSON NOT NULL DEFAULT '{}',
    "twibbon_link" VARCHAR(500),
    "requirement_files" JSON NOT NULL DEFAULT '[]',
    "status" "ApplicationStatus" NOT NULL DEFAULT 'draft',
    "score_total" DECIMAL(5,2),
    "score_breakdown" JSON,
    "score_status" "ScoreStatus",
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "reviewer_notes" TEXT,
    "draft_created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMPTZ(6),
    "last_edited_at" TIMESTAMPTZ(6),
    "under_review_at" TIMESTAMPTZ(6),
    "interview_scheduled_at" TIMESTAMPTZ(6),
    "accepted_at" TIMESTAMPTZ(6),
    "rejected_at" TIMESTAMPTZ(6),
    "waitlisted_at" TIMESTAMPTZ(6),
    "withdrawn_at" TIMESTAMPTZ(6),
    "withdrawn_by" UUID,
    "payment_requested_at" TIMESTAMPTZ(6),
    "payment_completed_at" TIMESTAMPTZ(6),
    "all_documents_uploaded_at" TIMESTAMPTZ(6),
    "status_history" JSON NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "legacy_participant_id" INTEGER,
    CONSTRAINT "participant_applications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "participant_applications_participant_id_program_id_key" UNIQUE ("participant_id", "program_id")
);

-- CreateTable: ambassador_referrals
CREATE TABLE "ambassador_referrals" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ambassador_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'referred',
    "verified_at" TIMESTAMPTZ(6),
    "verified_by" UUID,
    "referred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registered_at" TIMESTAMPTZ(6),
    "profile_completed_at" TIMESTAMPTZ(6),
    "applied_at" TIMESTAMPTZ(6),
    "accepted_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "days_to_register" INTEGER,
    "days_to_apply" INTEGER,
    "days_to_accept" INTEGER,
    "total_conversion_days" INTEGER,
    "legacy_id" INTEGER,
    CONSTRAINT "ambassador_referrals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ambassador_referrals_ambassador_id_participant_id_key" UNIQUE ("ambassador_id", "participant_id")
);

-- CreateTable: user_preferences
CREATE TABLE "user_preferences" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "theme" "Theme" NOT NULL DEFAULT 'light',
    "language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "date_format" VARCHAR(20) NOT NULL DEFAULT 'YYYY-MM-DD',
    "email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "sms_notifications" BOOLEAN NOT NULL DEFAULT false,
    "marketing_emails" BOOLEAN NOT NULL DEFAULT false,
    "newsletter_subscription" BOOLEAN NOT NULL DEFAULT false,
    "program_updates" BOOLEAN NOT NULL DEFAULT true,
    "application_updates" BOOLEAN NOT NULL DEFAULT true,
    "reminder_emails" BOOLEAN NOT NULL DEFAULT true,
    "custom_settings" JSON NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable: user_sessions
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "session_token" VARCHAR(255) NOT NULL,
    "refresh_token" VARCHAR(255),
    "device_type" VARCHAR(50),
    "device_name" VARCHAR(100),
    "browser" VARCHAR(100),
    "operating_system" VARCHAR(100),
    "ip_address" INET,
    "country" VARCHAR(100),
    "city" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_activity" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: user_security_logs
CREATE TABLE "user_security_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID,
    "event_type" VARCHAR(50) NOT NULL,
    "event_status" VARCHAR(20) NOT NULL,
    "event_description" TEXT,
    "ip_address" INET,
    "user_agent" TEXT,
    "device_fingerprint" VARCHAR(255),
    "location" VARCHAR(255),
    "risk_level" "RiskLevel",
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_security_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: user_notifications
CREATE TABLE "user_notifications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "action_url" VARCHAR(500),
    "action_label" VARCHAR(100),
    "related_entity_type" VARCHAR(50),
    "related_entity_id" UUID,
    "metadata" JSON NOT NULL DEFAULT '{}',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(6),
    "priority" "NotificationPriority" NOT NULL DEFAULT 'normal',
    "sent_via_email" BOOLEAN NOT NULL DEFAULT false,
    "sent_via_sms" BOOLEAN NOT NULL DEFAULT false,
    "email_sent_at" TIMESTAMPTZ(6),
    "sms_sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable: user_privacy_consents
CREATE TABLE "user_privacy_consents" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "consent_type" VARCHAR(100) NOT NULL,
    "consent_version" VARCHAR(50) NOT NULL,
    "consent_text" TEXT,
    "is_granted" BOOLEAN NOT NULL,
    "granted_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_privacy_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable: user_blocked_accounts
CREATE TABLE "user_blocked_accounts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "block_reason" VARCHAR(50) NOT NULL,
    "block_description" TEXT NOT NULL,
    "block_type" "BlockType" NOT NULL DEFAULT 'temporary',
    "blocked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blocked_until" TIMESTAMPTZ(6),
    "unblocked_at" TIMESTAMPTZ(6),
    "blocked_by" UUID,
    "unblocked_by" UUID,
    "violations_count" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "user_blocked_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: user_activity_logs
CREATE TABLE "user_activity_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID,
    "activity_type" VARCHAR(100) NOT NULL,
    "activity_category" VARCHAR(50),
    "activity_data" JSON NOT NULL DEFAULT '{}',
    "page_url" VARCHAR(500),
    "referrer_url" VARCHAR(500),
    "session_id" UUID,
    "ip_address" INET,
    "user_agent" TEXT,
    "device_type" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: account_deletion_requests
CREATE TABLE "account_deletion_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "reason" TEXT,
    "reason_category" VARCHAR(50),
    "status" "DeletionStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_notes" TEXT,
    "scheduled_deletion_date" TIMESTAMPTZ(6),
    "actual_deletion_date" TIMESTAMPTZ(6),
    "data_snapshot" JSON,
    "deletion_log" JSON NOT NULL DEFAULT '{}',
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable: system_announcements
CREATE TABLE "system_announcements" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "target_audience" "AnnouncementTarget" NOT NULL DEFAULT 'all',
    "program_category_id" UUID,
    "program_id" UUID,
    "priority" "AnnouncementPriority" NOT NULL DEFAULT 'normal',
    "type" "AnnouncementType" NOT NULL DEFAULT 'general',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(6),
    "is_dismissible" BOOLEAN NOT NULL DEFAULT true,
    "show_banner" BOOLEAN NOT NULL DEFAULT false,
    "action_url" VARCHAR(500),
    "action_label" VARCHAR(100),
    "start_date" TIMESTAMPTZ(6),
    "end_date" TIMESTAMPTZ(6),
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "metadata" JSON NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "system_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable: user_announcement_reads
CREATE TABLE "user_announcement_reads" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "announcement_id" UUID NOT NULL,
    "is_dismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissed_at" TIMESTAMPTZ(6),
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_announcement_reads_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_announcement_reads_user_id_announcement_id_key" UNIQUE ("user_id", "announcement_id")
);

-- CreateTable: application_edit_history
CREATE TABLE "application_edit_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "application_id" UUID NOT NULL,
    "field_changed" VARCHAR(100) NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "change_type" "ChangeType" NOT NULL,
    "changed_by" UUID NOT NULL,
    "changed_by_type" "ChangedByType" NOT NULL,
    "ip_address" INET,
    "user_agent" TEXT,
    "change_reason" TEXT,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "application_edit_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable: migration_tracking
CREATE TABLE "migration_tracking" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "table_name" VARCHAR(100) NOT NULL,
    "mysql_id" INTEGER NOT NULL,
    "postgres_id" UUID NOT NULL,
    "migrated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "migration_batch" VARCHAR(50),
    CONSTRAINT "migration_tracking_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "migration_tracking_table_name_mysql_id_key" UNIQUE ("table_name", "mysql_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "program_categories_name_key" ON "program_categories"("name");
CREATE UNIQUE INDEX "program_categories_slug_key" ON "program_categories"("slug");
CREATE UNIQUE INDEX "program_categories_legacy_id_key" ON "program_categories"("legacy_id");
CREATE INDEX "program_categories_slug_idx" ON "program_categories"("slug");
CREATE INDEX "program_categories_is_active_idx" ON "program_categories"("is_active");

CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_program_category_id_idx" ON "users"("program_category_id");
CREATE INDEX "users_email_verified_idx" ON "users"("email_verified");
CREATE INDEX "users_is_active_deleted_at_idx" ON "users"("is_active", "deleted_at");
CREATE INDEX "users_password_reset_token_idx" ON "users"("password_reset_token");

CREATE UNIQUE INDEX "admin_roles_name_key" ON "admin_roles"("name");
CREATE UNIQUE INDEX "admin_roles_legacy_id_key" ON "admin_roles"("legacy_id");
CREATE INDEX "admin_roles_name_idx" ON "admin_roles"("name");

CREATE UNIQUE INDEX "admins_user_id_key" ON "admins"("user_id");
CREATE UNIQUE INDEX "admins_employee_id_key" ON "admins"("employee_id");
CREATE UNIQUE INDEX "admins_legacy_id_key" ON "admins"("legacy_id");
CREATE INDEX "admins_user_id_idx" ON "admins"("user_id");
CREATE INDEX "admins_role_id_idx" ON "admins"("role_id");
CREATE INDEX "admins_employee_id_idx" ON "admins"("employee_id");
CREATE INDEX "admins_department_idx" ON "admins"("department");
CREATE INDEX "admins_deleted_at_idx" ON "admins"("deleted_at");

CREATE UNIQUE INDEX "programs_legacy_id_key" ON "programs"("legacy_id");
CREATE INDEX "programs_program_category_id_idx" ON "programs"("program_category_id");
CREATE INDEX "programs_year_idx" ON "programs"("year");
CREATE INDEX "programs_is_published_idx" ON "programs"("is_published");
CREATE INDEX "programs_deleted_at_idx" ON "programs"("deleted_at");

CREATE UNIQUE INDEX "admin_programs_legacy_id_key" ON "admin_programs"("legacy_id");
CREATE INDEX "admin_programs_admin_id_idx" ON "admin_programs"("admin_id");
CREATE INDEX "admin_programs_program_id_idx" ON "admin_programs"("program_id");
CREATE INDEX "admin_programs_removed_at_idx" ON "admin_programs"("removed_at");

CREATE UNIQUE INDEX "participants_user_id_key" ON "participants"("user_id");
CREATE UNIQUE INDEX "participants_legacy_id_key" ON "participants"("legacy_id");
CREATE INDEX "participants_user_id_idx" ON "participants"("user_id");
CREATE INDEX "participants_nationality_code_idx" ON "participants"("nationality_code");
CREATE INDEX "participants_institution_idx" ON "participants"("institution");
CREATE INDEX "participants_referral_code_idx" ON "participants"("referral_code");
CREATE INDEX "participants_deleted_at_idx" ON "participants"("deleted_at");

CREATE UNIQUE INDEX "ambassadors_user_id_key" ON "ambassadors"("user_id");
CREATE UNIQUE INDEX "ambassadors_referral_code_key" ON "ambassadors"("referral_code");
CREATE UNIQUE INDEX "ambassadors_legacy_id_key" ON "ambassadors"("legacy_id");
CREATE INDEX "ambassadors_user_id_idx" ON "ambassadors"("user_id");
CREATE INDEX "ambassadors_referral_code_idx" ON "ambassadors"("referral_code");
CREATE INDEX "ambassadors_program_id_idx" ON "ambassadors"("program_id");
CREATE INDEX "ambassadors_deleted_at_idx" ON "ambassadors"("deleted_at");

CREATE INDEX "participant_applications_participant_id_idx" ON "participant_applications"("participant_id");
CREATE INDEX "participant_applications_program_id_idx" ON "participant_applications"("program_id");
CREATE INDEX "participant_applications_status_idx" ON "participant_applications"("status");
CREATE INDEX "participant_applications_application_category_idx" ON "participant_applications"("application_category");
CREATE INDEX "participant_applications_submitted_at_idx" ON "participant_applications"("submitted_at");
CREATE INDEX "participant_applications_deleted_at_idx" ON "participant_applications"("deleted_at");

CREATE UNIQUE INDEX "ambassador_referrals_legacy_id_key" ON "ambassador_referrals"("legacy_id");
CREATE INDEX "ambassador_referrals_ambassador_id_idx" ON "ambassador_referrals"("ambassador_id");
CREATE INDEX "ambassador_referrals_participant_id_idx" ON "ambassador_referrals"("participant_id");
CREATE INDEX "ambassador_referrals_status_idx" ON "ambassador_referrals"("status");
CREATE INDEX "ambassador_referrals_referred_at_accepted_at_idx" ON "ambassador_referrals"("referred_at", "accepted_at");

CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences"("user_id");
CREATE INDEX "user_preferences_user_id_idx" ON "user_preferences"("user_id");

CREATE UNIQUE INDEX "user_sessions_session_token_key" ON "user_sessions"("session_token");
CREATE UNIQUE INDEX "user_sessions_refresh_token_key" ON "user_sessions"("refresh_token");
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");
CREATE INDEX "user_sessions_session_token_idx" ON "user_sessions"("session_token");
CREATE INDEX "user_sessions_user_id_is_active_revoked_at_idx" ON "user_sessions"("user_id", "is_active", "revoked_at");
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

CREATE INDEX "user_security_logs_user_id_idx" ON "user_security_logs"("user_id");
CREATE INDEX "user_security_logs_event_type_idx" ON "user_security_logs"("event_type");
CREATE INDEX "user_security_logs_created_at_idx" ON "user_security_logs"("created_at");
CREATE INDEX "user_security_logs_user_id_flagged_idx" ON "user_security_logs"("user_id", "flagged");
CREATE INDEX "user_security_logs_risk_level_idx" ON "user_security_logs"("risk_level");

CREATE INDEX "user_notifications_user_id_idx" ON "user_notifications"("user_id");
CREATE INDEX "user_notifications_user_id_is_read_deleted_at_idx" ON "user_notifications"("user_id", "is_read", "deleted_at");
CREATE INDEX "user_notifications_user_id_created_at_idx" ON "user_notifications"("user_id", "created_at");
CREATE INDEX "user_notifications_user_id_priority_idx" ON "user_notifications"("user_id", "priority");
CREATE INDEX "user_notifications_type_idx" ON "user_notifications"("type");

CREATE INDEX "user_privacy_consents_user_id_idx" ON "user_privacy_consents"("user_id");
CREATE INDEX "user_privacy_consents_user_id_consent_type_idx" ON "user_privacy_consents"("user_id", "consent_type");
CREATE INDEX "user_privacy_consents_user_id_consent_type_is_granted_revoked_at_idx" ON "user_privacy_consents"("user_id", "consent_type", "is_granted", "revoked_at");

CREATE INDEX "user_blocked_accounts_user_id_idx" ON "user_blocked_accounts"("user_id");
CREATE INDEX "user_blocked_accounts_user_id_is_active_idx" ON "user_blocked_accounts"("user_id", "is_active");
CREATE INDEX "user_blocked_accounts_blocked_until_idx" ON "user_blocked_accounts"("blocked_until");

CREATE INDEX "user_activity_logs_user_id_idx" ON "user_activity_logs"("user_id");
CREATE INDEX "user_activity_logs_activity_type_idx" ON "user_activity_logs"("activity_type");
CREATE INDEX "user_activity_logs_created_at_idx" ON "user_activity_logs"("created_at");
CREATE INDEX "user_activity_logs_session_id_idx" ON "user_activity_logs"("session_id");

CREATE INDEX "account_deletion_requests_user_id_idx" ON "account_deletion_requests"("user_id");
CREATE INDEX "account_deletion_requests_status_created_at_idx" ON "account_deletion_requests"("status", "created_at");
CREATE INDEX "account_deletion_requests_scheduled_deletion_date_idx" ON "account_deletion_requests"("scheduled_deletion_date");

CREATE INDEX "system_announcements_is_published_published_at_deleted_at_idx" ON "system_announcements"("is_published", "published_at", "deleted_at");
CREATE INDEX "system_announcements_start_date_end_date_is_published_deleted_at_idx" ON "system_announcements"("start_date", "end_date", "is_published", "deleted_at");
CREATE INDEX "system_announcements_target_audience_program_category_id_idx" ON "system_announcements"("target_audience", "program_category_id");
CREATE INDEX "system_announcements_show_banner_is_published_deleted_at_idx" ON "system_announcements"("show_banner", "is_published", "deleted_at");

CREATE INDEX "user_announcement_reads_user_id_announcement_id_idx" ON "user_announcement_reads"("user_id", "announcement_id");
CREATE INDEX "user_announcement_reads_announcement_id_idx" ON "user_announcement_reads"("announcement_id");

CREATE INDEX "application_edit_history_application_id_changed_at_idx" ON "application_edit_history"("application_id", "changed_at");
CREATE INDEX "application_edit_history_changed_by_idx" ON "application_edit_history"("changed_by");
CREATE INDEX "application_edit_history_field_changed_idx" ON "application_edit_history"("field_changed");
CREATE INDEX "application_edit_history_changed_at_idx" ON "application_edit_history"("changed_at");

CREATE INDEX "migration_tracking_table_name_idx" ON "migration_tracking"("table_name");
CREATE INDEX "migration_tracking_mysql_id_idx" ON "migration_tracking"("mysql_id");
CREATE INDEX "migration_tracking_postgres_id_idx" ON "migration_tracking"("postgres_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "admins" ADD CONSTRAINT "admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admins" ADD CONSTRAINT "admins_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "admin_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "programs" ADD CONSTRAINT "programs_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "admin_programs" ADD CONSTRAINT "admin_programs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_programs" ADD CONSTRAINT "admin_programs_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "participants" ADD CONSTRAINT "participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "participants" ADD CONSTRAINT "fk_participant_deleted_by_user" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "participants" ADD CONSTRAINT "fk_participant_deleted_by_admin" FOREIGN KEY ("deleted_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ambassadors" ADD CONSTRAINT "ambassadors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ambassadors" ADD CONSTRAINT "ambassadors_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ambassadors" ADD CONSTRAINT "fk_ambassador_deleted_by_user" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ambassadors" ADD CONSTRAINT "fk_ambassador_deleted_by_admin" FOREIGN KEY ("deleted_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "participant_applications" ADD CONSTRAINT "participant_applications_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "participant_applications" ADD CONSTRAINT "participant_applications_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "participant_applications" ADD CONSTRAINT "participant_applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "participant_applications" ADD CONSTRAINT "participant_applications_withdrawn_by_fkey" FOREIGN KEY ("withdrawn_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "participant_applications" ADD CONSTRAINT "participant_applications_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ambassador_referrals" ADD CONSTRAINT "ambassador_referrals_ambassador_id_fkey" FOREIGN KEY ("ambassador_id") REFERENCES "ambassadors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ambassador_referrals" ADD CONSTRAINT "ambassador_referrals_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ambassador_referrals" ADD CONSTRAINT "ambassador_referrals_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_security_logs" ADD CONSTRAINT "user_security_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_privacy_consents" ADD CONSTRAINT "user_privacy_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_blocked_accounts" ADD CONSTRAINT "user_blocked_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_blocked_accounts" ADD CONSTRAINT "user_blocked_accounts_blocked_by_fkey" FOREIGN KEY ("blocked_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_blocked_accounts" ADD CONSTRAINT "user_blocked_accounts_unblocked_by_fkey" FOREIGN KEY ("unblocked_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_activity_logs" ADD CONSTRAINT "user_activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_activity_logs" ADD CONSTRAINT "user_activity_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "user_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "system_announcements" ADD CONSTRAINT "system_announcements_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "system_announcements" ADD CONSTRAINT "system_announcements_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "system_announcements" ADD CONSTRAINT "system_announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "system_announcements" ADD CONSTRAINT "system_announcements_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_announcement_reads" ADD CONSTRAINT "user_announcement_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_announcement_reads" ADD CONSTRAINT "user_announcement_reads_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "system_announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "application_edit_history" ADD CONSTRAINT "application_edit_history_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "participant_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_edit_history" ADD CONSTRAINT "application_edit_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
