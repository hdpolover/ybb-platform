-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "ApplicationCategory" AS ENUM ('fully_funded', 'self_funded', 'partial_funded');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('draft', 'submitted', 'under_review', 'interview_scheduled', 'accepted', 'rejected', 'waitlisted', 'withdrawn');

-- CreateEnum
CREATE TYPE "ScoreStatus" AS ENUM ('pending', 'scored', 'go_to_interview', 'rejected');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('referred', 'registered', 'applied', 'accepted', 'completed');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('temporary', 'permanent');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "AnnouncementTarget" AS ENUM ('all', 'participants', 'ambassadors', 'specific_program');

-- CreateEnum
CREATE TYPE "AnnouncementPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "AnnouncementType" AS ENUM ('general', 'maintenance', 'deadline', 'feature', 'alert');

-- CreateEnum
CREATE TYPE "FaqCategory" AS ENUM ('general', 'registration', 'payment', 'event_details', 'accommodation', 'visa', 'other');

-- CreateEnum
CREATE TYPE "DeletionStatus" AS ENUM ('pending', 'approved', 'rejected', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('light', 'dark', 'auto');

-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('create', 'update', 'delete', 'status_change');

-- CreateEnum
CREATE TYPE "ChangedByType" AS ENUM ('participant', 'admin', 'system');

-- CreateEnum
CREATE TYPE "PricingFeeType" AS ENUM ('registration_fee', 'program_fee_1', 'program_fee_2', 'full_fee', 'custom_fee');

-- CreateEnum
CREATE TYPE "PricingTarget" AS ENUM ('self_funded', 'fully_funded', 'partial_funded', 'all');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('open', 'in_progress', 'waiting_response', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "DocumentTemplateType" AS ENUM ('letter_of_acceptance', 'letter_of_invitation', 'certificate_participation', 'certificate_achievement', 'certificate_speaker', 'letter_recommendation', 'agreement_letter', 'custom');

-- CreateEnum
CREATE TYPE "TimelineType" AS ENUM ('registration', 'announcement_loa', 'payment_1', 'payment_2', 'mentoring', 'interview', 'announcement_final', 'program_start', 'program_end', 'onboarding', 'custom');

-- CreateEnum
CREATE TYPE "TimelineCompletionType" AS ENUM ('date_passed', 'status_change', 'payment_completed', 'document_uploaded', 'manual', 'always_open');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('unpaid', 'pending', 'paid', 'captured', 'settled', 'failed', 'refunded', 'cancelled', 'expired');

-- CreateTable
CREATE TABLE "program_pricing_tiers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IDR',
    "capacity" INTEGER DEFAULT 0,
    "current_count" INTEGER NOT NULL DEFAULT 0,
    "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fee_type" "PricingFeeType" NOT NULL DEFAULT 'registration_fee',
    "target" "PricingTarget" NOT NULL DEFAULT 'self_funded',
    "icon" VARCHAR(255),
    "sold_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "program_pricing_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_tier_validity_periods" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "pricing_tier_id" UUID NOT NULL,
    "start_date" TIMESTAMPTZ(6) NOT NULL,
    "end_date" TIMESTAMPTZ(6) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pricing_tier_validity_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_requirements" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "type" VARCHAR(50) NOT NULL DEFAULT 'document',
    "file_max_size" INTEGER,
    "file_allowed_types" VARCHAR(255),
    "options" JSON DEFAULT '[]',
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "program_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_form_fields" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "section" VARCHAR(50) NOT NULL DEFAULT 'personal_info',
    "label" VARCHAR(255) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "placeholder" VARCHAR(255),
    "help_text" TEXT,
    "options" JSON DEFAULT '[]',
    "validation_rules" JSON DEFAULT '{}',
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "application_form_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participant_applications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'draft',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
    "ticket_status" TEXT NOT NULL DEFAULT 'regular',
    "referral_code" VARCHAR(50),
    "submission_date" TIMESTAMPTZ(6),
    "personal_data" JSON NOT NULL DEFAULT '{}',
    "essay_answers" JSON NOT NULL DEFAULT '{}',
    "uploaded_files" JSON NOT NULL DEFAULT '{}',
    "review_score" DECIMAL(5,2),
    "admin_notes" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "withdrawn_by" UUID,
    "interview_date" TIMESTAMPTZ(6),
    "interview_link" VARCHAR(500),
    "interview_score" DECIMAL(5,2),
    "interview_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "participant_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_edit_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "application_id" UUID NOT NULL,
    "edited_by" UUID NOT NULL,
    "reason" TEXT,
    "changes" JSON NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_edit_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participant_awards" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "application_id" UUID NOT NULL,
    "program_award_id" UUID NOT NULL,
    "awarded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "awarded_by" UUID,
    "notes" TEXT,
    "certificate_url" VARCHAR(500),

    CONSTRAINT "participant_awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participant_documents" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "application_id" UUID NOT NULL,
    "template_id" UUID,
    "document_number" VARCHAR(50),
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "file_url" VARCHAR(500) NOT NULL,
    "file_type" VARCHAR(10) NOT NULL DEFAULT 'pdf',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "legacy_id" INTEGER,

    CONSTRAINT "participant_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_providers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "client_id" VARCHAR(255),
    "client_secret" VARCHAR(255),
    "auth_url" VARCHAR(500),
    "token_url" VARCHAR(500),
    "scopes" JSON DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_oauth" BOOLEAN NOT NULL DEFAULT false,
    "icon" VARCHAR(100),
    "button_color" VARCHAR(7),
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "auth_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" VARCHAR(255) NOT NULL,
    "program_category_id" UUID NOT NULL,
    "password_hash" VARCHAR(255),
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified_at" TIMESTAMPTZ(6),
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

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_identities" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "provider_user_id" VARCHAR(255),
    "provider_email" VARCHAR(255),
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expiry" TIMESTAMPTZ(6),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "last_used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "session_token" VARCHAR(255) NOT NULL,
    "refresh_token" TEXT,
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "program_faqs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" "FaqCategory" NOT NULL DEFAULT 'general',
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "program_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_timeline" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL,
    "end_date" TIMESTAMPTZ(6),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(100),
    "type" "TimelineType" NOT NULL DEFAULT 'custom',
    "completion_type" "TimelineCompletionType" NOT NULL DEFAULT 'date_passed',
    "completion_config" JSON NOT NULL DEFAULT '{}',
    "target_audience" "PricingTarget" NOT NULL DEFAULT 'all',
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "program_timeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_schedules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "day" VARCHAR(100) NOT NULL,
    "start_time" VARCHAR(20),
    "end_time" VARCHAR(20),
    "activity" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "location" VARCHAR(255),
    "speaker" VARCHAR(255),
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "program_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_speakers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255),
    "organization" VARCHAR(255),
    "bio" TEXT,
    "photo_url" VARCHAR(500),
    "email" VARCHAR(255),
    "linkedin_url" VARCHAR(500),
    "twitter_url" VARCHAR(500),
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "program_speakers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_gallery" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "image_url" VARCHAR(500) NOT NULL,
    "video_url" VARCHAR(500),
    "title" VARCHAR(255),
    "description" TEXT,
    "type" VARCHAR(50) NOT NULL DEFAULT 'image',
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "program_gallery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_testimonials" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID,
    "program_category_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "role" VARCHAR(255),
    "company" VARCHAR(255),
    "testimonial" TEXT NOT NULL,
    "category" VARCHAR(50) NOT NULL DEFAULT 'alumni',
    "type" VARCHAR(20) NOT NULL DEFAULT 'text',
    "video_url" VARCHAR(500),
    "thumbnail_url" VARCHAR(500),
    "avatar_url" VARCHAR(500),
    "rating" SMALLINT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "program_testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsors" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_category_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "logo_url" VARCHAR(500),
    "website_url" VARCHAR(500),
    "description" TEXT,
    "tier" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_category_id" UUID,
    "program_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "variables" JSON DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_team" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_category_id" UUID,
    "program_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "role" VARCHAR(100) NOT NULL,
    "bio" TEXT,
    "photo_url" VARCHAR(500),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "linkedin_url" VARCHAR(500),
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "program_team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_partners" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "role" VARCHAR(255),
    "logo_url" VARCHAR(500),
    "website_url" VARCHAR(500),
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "program_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_resources" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "file_url" VARCHAR(500) NOT NULL,
    "file_size" BIGINT,
    "file_type" VARCHAR(50),
    "type" VARCHAR(50) NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "program_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_announcements" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "image_url" VARCHAR(500),
    "target_audience" VARCHAR(50) NOT NULL DEFAULT 'all',
    "send_email" BOOLEAN NOT NULL DEFAULT false,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "publish_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "program_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "template_url" VARCHAR(500) NOT NULL,
    "fields" JSON NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "certificate_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_awards" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(100),
    "tier" VARCHAR(50),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "winner_count" INTEGER,
    "color" VARCHAR(7),
    "badge_url" VARCHAR(500),
    "icon_url" VARCHAR(500),
    "certificate_template_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "legacy_id" INTEGER,

    CONSTRAINT "program_awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "DocumentTemplateType" NOT NULL DEFAULT 'custom',
    "description" TEXT,
    "template_url" VARCHAR(500),
    "html_content" TEXT,
    "placeholders" JSON NOT NULL DEFAULT '[]',
    "layout_config" JSON NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "legacy_id" INTEGER,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "user_announcement_reads" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "announcement_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6),
    "is_dismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissed_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_announcement_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "participant_id" UUID NOT NULL,
    "assigned_to" UUID,
    "program_id" UUID,
    "ticket_number" VARCHAR(20) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "sub_category" VARCHAR(100),
    "subject" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'open',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'normal',
    "resolution" TEXT,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" UUID,
    "closed_at" TIMESTAMPTZ(6),
    "closed_by" UUID,
    "closed_reason" TEXT,
    "satisfaction_rating" SMALLINT,
    "feedback" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "legacy_id" INTEGER,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_messages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ticket_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "is_from_admin" BOOLEAN NOT NULL DEFAULT false,
    "sender_id" UUID NOT NULL,
    "sender_name" VARCHAR(255) NOT NULL,
    "attachments" JSON NOT NULL DEFAULT '[]',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(6),
    "is_internal_note" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "legacy_id" INTEGER,

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "program_pricing_tier_id" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IDR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "payment_type" VARCHAR(20) NOT NULL,
    "payment_method" VARCHAR(100),
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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
    "website_url" VARCHAR(255),
    "about" TEXT,
    "vision" TEXT,
    "mission" TEXT,
    "logo_url" VARCHAR(500),
    "banner_url" VARCHAR(500),
    "primary_color" VARCHAR(7),
    "contact_email" VARCHAR(255),
    "contact_phone" VARCHAR(50),
    "contact_whatsapp" VARCHAR(50),
    "contact_address" TEXT,
    "social_media_links" JSON DEFAULT '{}',
    "default_location" VARCHAR(255),
    "default_country" VARCHAR(100),
    "default_timezone" VARCHAR(50),
    "require_email_verification" BOOLEAN NOT NULL DEFAULT true,
    "default_currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "enable_multi_currency" BOOLEAN NOT NULL DEFAULT false,
    "meta_title" VARCHAR(255),
    "meta_description" TEXT,
    "meta_keywords" TEXT,

    CONSTRAINT "program_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_category_settings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_category_id" UUID NOT NULL,
    "is_maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "maintenance_message" TEXT,
    "maintenance_scheduled_end" TIMESTAMPTZ(6),
    "footer_navigation" JSON NOT NULL DEFAULT '[]',
    "usd_in_idr" DECIMAL(10,2) NOT NULL DEFAULT 16000,
    "google_analytics_id" VARCHAR(50),
    "pixel_id" VARCHAR(50),
    "support_email" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "program_category_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_social_feeds" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_category_id" UUID NOT NULL,
    "platform" VARCHAR(50) NOT NULL DEFAULT 'instagram',
    "post_id" VARCHAR(100) NOT NULL,
    "image_url" VARCHAR(500) NOT NULL,
    "permalink" VARCHAR(500) NOT NULL,
    "caption" TEXT,
    "posted_at" TIMESTAMPTZ(6) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_social_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_category_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "short_description" VARCHAR(500),
    "year" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "application_deadline" TIMESTAMPTZ(6) NOT NULL,
    "location" VARCHAR(255),
    "capacity" INTEGER,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_visible_to_users" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
    "thumbnail_url" VARCHAR(500),
    "banner_url" VARCHAR(500),
    "video_url" VARCHAR(500),
    "require_email_verification" BOOLEAN NOT NULL DEFAULT true,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "enable_currency_conversion" BOOLEAN NOT NULL DEFAULT false,
    "logo_url" VARCHAR(500),
    "allow_registration" BOOLEAN NOT NULL DEFAULT true,
    "registration_open_date" TIMESTAMPTZ(6),
    "registration_close_date" TIMESTAMPTZ(6),
    "require_payment" BOOLEAN NOT NULL DEFAULT false,
    "registration_fee" DECIMAL(10,2),
    "requirements_description" TEXT,
    "benefits_description" TEXT,
    "terms_and_conditions" TEXT,
    "meta_title" VARCHAR(255),
    "meta_description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "legacy_id" INTEGER,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_tags" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "color" VARCHAR(7),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "program_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_tag_relations" (
    "program_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "program_tag_relations_pkey" PRIMARY KEY ("program_id","tag_id")
);

-- CreateTable
CREATE TABLE "program_waitlist" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
    "custom_permissions" JSONB NOT NULL DEFAULT '[]',
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

-- CreateTable
CREATE TABLE "admin_roles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "legacy_id" INTEGER,

    CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_programs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "admin_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "role_in_program" VARCHAR(50),
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,
    "removed_at" TIMESTAMPTZ(6),
    "removed_by" UUID,
    "legacy_id" INTEGER,

    CONSTRAINT "admin_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_program_categories" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "admin_id" UUID NOT NULL,
    "program_category_id" UUID NOT NULL,
    "role_in_brand" VARCHAR(50),
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,
    "legacy_id" INTEGER,

    CONSTRAINT "admin_program_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

    CONSTRAINT "ambassador_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "filename" VARCHAR(255) NOT NULL,
    "content_type" VARCHAR(100) NOT NULL,
    "size" BIGINT NOT NULL,
    "url" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "entity_type" VARCHAR(50),
    "entity_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_tracking" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "table_name" VARCHAR(100) NOT NULL,
    "mysql_id" INTEGER NOT NULL,
    "postgres_id" UUID NOT NULL,
    "migrated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "migration_batch" VARCHAR(50),

    CONSTRAINT "migration_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "program_pricing_tiers_program_id_idx" ON "program_pricing_tiers"("program_id");

-- CreateIndex
CREATE INDEX "program_pricing_tiers_is_active_idx" ON "program_pricing_tiers"("is_active");

-- CreateIndex
CREATE INDEX "pricing_tier_validity_periods_pricing_tier_id_idx" ON "pricing_tier_validity_periods"("pricing_tier_id");

-- CreateIndex
CREATE INDEX "pricing_tier_validity_periods_start_date_end_date_idx" ON "pricing_tier_validity_periods"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "program_requirements_program_id_idx" ON "program_requirements"("program_id");

-- CreateIndex
CREATE INDEX "program_requirements_type_idx" ON "program_requirements"("type");

-- CreateIndex
CREATE INDEX "program_requirements_order_idx" ON "program_requirements"("order");

-- CreateIndex
CREATE INDEX "application_form_fields_program_id_idx" ON "application_form_fields"("program_id");

-- CreateIndex
CREATE INDEX "application_form_fields_section_idx" ON "application_form_fields"("section");

-- CreateIndex
CREATE INDEX "application_form_fields_order_idx" ON "application_form_fields"("order");

-- CreateIndex
CREATE INDEX "participant_applications_program_id_idx" ON "participant_applications"("program_id");

-- CreateIndex
CREATE INDEX "participant_applications_participant_id_idx" ON "participant_applications"("participant_id");

-- CreateIndex
CREATE INDEX "participant_applications_status_idx" ON "participant_applications"("status");

-- CreateIndex
CREATE INDEX "participant_applications_payment_status_idx" ON "participant_applications"("payment_status");

-- CreateIndex
CREATE INDEX "participant_applications_referral_code_idx" ON "participant_applications"("referral_code");

-- CreateIndex
CREATE UNIQUE INDEX "participant_applications_participant_id_program_id_key" ON "participant_applications"("participant_id", "program_id");

-- CreateIndex
CREATE INDEX "application_edit_history_application_id_idx" ON "application_edit_history"("application_id");

-- CreateIndex
CREATE INDEX "participant_awards_application_id_idx" ON "participant_awards"("application_id");

-- CreateIndex
CREATE INDEX "participant_awards_program_award_id_idx" ON "participant_awards"("program_award_id");

-- CreateIndex
CREATE UNIQUE INDEX "participant_awards_application_id_program_award_id_key" ON "participant_awards"("application_id", "program_award_id");

-- CreateIndex
CREATE UNIQUE INDEX "participant_documents_legacy_id_key" ON "participant_documents"("legacy_id");

-- CreateIndex
CREATE INDEX "participant_documents_application_id_idx" ON "participant_documents"("application_id");

-- CreateIndex
CREATE INDEX "participant_documents_type_idx" ON "participant_documents"("type");

-- CreateIndex
CREATE UNIQUE INDEX "auth_providers_name_key" ON "auth_providers"("name");

-- CreateIndex
CREATE INDEX "auth_providers_name_idx" ON "auth_providers"("name");

-- CreateIndex
CREATE INDEX "auth_providers_is_active_idx" ON "auth_providers"("is_active");

-- CreateIndex
CREATE INDEX "auth_providers_order_idx" ON "auth_providers"("order");

-- CreateIndex
CREATE UNIQUE INDEX "users_legacy_id_key" ON "users"("legacy_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_program_category_id_idx" ON "users"("program_category_id");

-- CreateIndex
CREATE INDEX "users_email_verified_idx" ON "users"("email_verified");

-- CreateIndex
CREATE INDEX "users_is_active_deleted_at_idx" ON "users"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "users_password_reset_token_idx" ON "users"("password_reset_token");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_program_category_id_key" ON "users"("email", "program_category_id");

-- CreateIndex
CREATE INDEX "user_identities_user_id_idx" ON "user_identities"("user_id");

-- CreateIndex
CREATE INDEX "user_identities_provider_id_idx" ON "user_identities"("provider_id");

-- CreateIndex
CREATE INDEX "user_identities_provider_user_id_idx" ON "user_identities"("provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_user_id_provider_id_key" ON "user_identities"("user_id", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_provider_id_provider_user_id_key" ON "user_identities"("provider_id", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_session_token_key" ON "user_sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refresh_token_key" ON "user_sessions"("refresh_token");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_session_token_idx" ON "user_sessions"("session_token");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_is_active_revoked_at_idx" ON "user_sessions"("user_id", "is_active", "revoked_at");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "user_security_logs_user_id_idx" ON "user_security_logs"("user_id");

-- CreateIndex
CREATE INDEX "user_security_logs_event_type_idx" ON "user_security_logs"("event_type");

-- CreateIndex
CREATE INDEX "user_security_logs_created_at_idx" ON "user_security_logs"("created_at");

-- CreateIndex
CREATE INDEX "user_security_logs_user_id_flagged_idx" ON "user_security_logs"("user_id", "flagged");

-- CreateIndex
CREATE INDEX "user_security_logs_risk_level_idx" ON "user_security_logs"("risk_level");

-- CreateIndex
CREATE INDEX "user_privacy_consents_user_id_idx" ON "user_privacy_consents"("user_id");

-- CreateIndex
CREATE INDEX "user_privacy_consents_user_id_consent_type_idx" ON "user_privacy_consents"("user_id", "consent_type");

-- CreateIndex
CREATE INDEX "user_privacy_consents_user_id_consent_type_is_granted_revok_idx" ON "user_privacy_consents"("user_id", "consent_type", "is_granted", "revoked_at");

-- CreateIndex
CREATE INDEX "user_blocked_accounts_user_id_idx" ON "user_blocked_accounts"("user_id");

-- CreateIndex
CREATE INDEX "user_blocked_accounts_user_id_is_active_idx" ON "user_blocked_accounts"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "user_blocked_accounts_blocked_until_idx" ON "user_blocked_accounts"("blocked_until");

-- CreateIndex
CREATE INDEX "user_activity_logs_user_id_idx" ON "user_activity_logs"("user_id");

-- CreateIndex
CREATE INDEX "user_activity_logs_activity_type_idx" ON "user_activity_logs"("activity_type");

-- CreateIndex
CREATE INDEX "user_activity_logs_created_at_idx" ON "user_activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "user_activity_logs_session_id_idx" ON "user_activity_logs"("session_id");

-- CreateIndex
CREATE INDEX "account_deletion_requests_user_id_idx" ON "account_deletion_requests"("user_id");

-- CreateIndex
CREATE INDEX "account_deletion_requests_status_created_at_idx" ON "account_deletion_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "account_deletion_requests_scheduled_deletion_date_idx" ON "account_deletion_requests"("scheduled_deletion_date");

-- CreateIndex
CREATE INDEX "program_faqs_program_id_idx" ON "program_faqs"("program_id");

-- CreateIndex
CREATE INDEX "program_faqs_category_idx" ON "program_faqs"("category");

-- CreateIndex
CREATE INDEX "program_faqs_order_idx" ON "program_faqs"("order");

-- CreateIndex
CREATE INDEX "program_timeline_program_id_idx" ON "program_timeline"("program_id");

-- CreateIndex
CREATE INDEX "program_timeline_date_idx" ON "program_timeline"("date");

-- CreateIndex
CREATE INDEX "program_timeline_order_idx" ON "program_timeline"("order");

-- CreateIndex
CREATE INDEX "program_schedules_program_id_idx" ON "program_schedules"("program_id");

-- CreateIndex
CREATE INDEX "program_schedules_order_idx" ON "program_schedules"("order");

-- CreateIndex
CREATE INDEX "program_speakers_program_id_idx" ON "program_speakers"("program_id");

-- CreateIndex
CREATE INDEX "program_speakers_order_idx" ON "program_speakers"("order");

-- CreateIndex
CREATE INDEX "program_gallery_program_id_idx" ON "program_gallery"("program_id");

-- CreateIndex
CREATE INDEX "program_gallery_type_idx" ON "program_gallery"("type");

-- CreateIndex
CREATE INDEX "program_gallery_order_idx" ON "program_gallery"("order");

-- CreateIndex
CREATE INDEX "program_testimonials_program_id_idx" ON "program_testimonials"("program_id");

-- CreateIndex
CREATE INDEX "program_testimonials_program_category_id_idx" ON "program_testimonials"("program_category_id");

-- CreateIndex
CREATE INDEX "program_testimonials_type_idx" ON "program_testimonials"("type");

-- CreateIndex
CREATE INDEX "program_testimonials_is_featured_idx" ON "program_testimonials"("is_featured");

-- CreateIndex
CREATE INDEX "program_testimonials_order_idx" ON "program_testimonials"("order");

-- CreateIndex
CREATE INDEX "sponsors_program_category_id_idx" ON "sponsors"("program_category_id");

-- CreateIndex
CREATE INDEX "sponsors_type_idx" ON "sponsors"("type");

-- CreateIndex
CREATE INDEX "sponsors_tier_idx" ON "sponsors"("tier");

-- CreateIndex
CREATE INDEX "sponsors_order_idx" ON "sponsors"("order");

-- CreateIndex
CREATE INDEX "email_templates_program_category_id_idx" ON "email_templates"("program_category_id");

-- CreateIndex
CREATE INDEX "email_templates_program_id_idx" ON "email_templates"("program_id");

-- CreateIndex
CREATE INDEX "email_templates_type_idx" ON "email_templates"("type");

-- CreateIndex
CREATE INDEX "program_team_program_category_id_idx" ON "program_team"("program_category_id");

-- CreateIndex
CREATE INDEX "program_team_program_id_idx" ON "program_team"("program_id");

-- CreateIndex
CREATE INDEX "program_team_order_idx" ON "program_team"("order");

-- CreateIndex
CREATE INDEX "program_partners_program_id_idx" ON "program_partners"("program_id");

-- CreateIndex
CREATE INDEX "program_partners_type_idx" ON "program_partners"("type");

-- CreateIndex
CREATE INDEX "program_partners_order_idx" ON "program_partners"("order");

-- CreateIndex
CREATE INDEX "program_resources_program_id_idx" ON "program_resources"("program_id");

-- CreateIndex
CREATE INDEX "program_resources_type_idx" ON "program_resources"("type");

-- CreateIndex
CREATE INDEX "program_resources_is_public_idx" ON "program_resources"("is_public");

-- CreateIndex
CREATE INDEX "program_resources_order_idx" ON "program_resources"("order");

-- CreateIndex
CREATE INDEX "program_announcements_program_id_idx" ON "program_announcements"("program_id");

-- CreateIndex
CREATE INDEX "program_announcements_target_audience_idx" ON "program_announcements"("target_audience");

-- CreateIndex
CREATE INDEX "program_announcements_is_pinned_idx" ON "program_announcements"("is_pinned");

-- CreateIndex
CREATE INDEX "program_announcements_publish_date_idx" ON "program_announcements"("publish_date");

-- CreateIndex
CREATE INDEX "certificate_templates_program_id_idx" ON "certificate_templates"("program_id");

-- CreateIndex
CREATE UNIQUE INDEX "program_awards_legacy_id_key" ON "program_awards"("legacy_id");

-- CreateIndex
CREATE INDEX "program_awards_program_id_idx" ON "program_awards"("program_id");

-- CreateIndex
CREATE INDEX "program_awards_category_idx" ON "program_awards"("category");

-- CreateIndex
CREATE INDEX "program_awards_is_active_idx" ON "program_awards"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "document_templates_legacy_id_key" ON "document_templates"("legacy_id");

-- CreateIndex
CREATE INDEX "document_templates_program_id_idx" ON "document_templates"("program_id");

-- CreateIndex
CREATE INDEX "document_templates_type_idx" ON "document_templates"("type");

-- CreateIndex
CREATE INDEX "document_templates_is_active_idx" ON "document_templates"("is_active");

-- CreateIndex
CREATE INDEX "system_announcements_is_published_published_at_deleted_at_idx" ON "system_announcements"("is_published", "published_at", "deleted_at");

-- CreateIndex
CREATE INDEX "system_announcements_start_date_end_date_is_published_delet_idx" ON "system_announcements"("start_date", "end_date", "is_published", "deleted_at");

-- CreateIndex
CREATE INDEX "system_announcements_target_audience_program_category_id_idx" ON "system_announcements"("target_audience", "program_category_id");

-- CreateIndex
CREATE INDEX "system_announcements_show_banner_is_published_deleted_at_idx" ON "system_announcements"("show_banner", "is_published", "deleted_at");

-- CreateIndex
CREATE INDEX "user_announcement_reads_user_id_idx" ON "user_announcement_reads"("user_id");

-- CreateIndex
CREATE INDEX "user_announcement_reads_announcement_id_idx" ON "user_announcement_reads"("announcement_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_announcement_reads_user_id_announcement_id_key" ON "user_announcement_reads"("user_id", "announcement_id");

-- CreateIndex
CREATE INDEX "user_notifications_user_id_idx" ON "user_notifications"("user_id");

-- CreateIndex
CREATE INDEX "user_notifications_user_id_is_read_deleted_at_idx" ON "user_notifications"("user_id", "is_read", "deleted_at");

-- CreateIndex
CREATE INDEX "user_notifications_user_id_created_at_idx" ON "user_notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "user_notifications_user_id_priority_idx" ON "user_notifications"("user_id", "priority");

-- CreateIndex
CREATE INDEX "user_notifications_type_idx" ON "user_notifications"("type");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticket_number_key" ON "support_tickets"("ticket_number");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_legacy_id_key" ON "support_tickets"("legacy_id");

-- CreateIndex
CREATE INDEX "support_tickets_participant_id_idx" ON "support_tickets"("participant_id");

-- CreateIndex
CREATE INDEX "support_tickets_assigned_to_idx" ON "support_tickets"("assigned_to");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_tickets_priority_idx" ON "support_tickets"("priority");

-- CreateIndex
CREATE INDEX "support_tickets_ticket_number_idx" ON "support_tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "support_tickets_created_at_idx" ON "support_tickets"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "support_ticket_messages_legacy_id_key" ON "support_ticket_messages"("legacy_id");

-- CreateIndex
CREATE INDEX "support_ticket_messages_ticket_id_idx" ON "support_ticket_messages"("ticket_id");

-- CreateIndex
CREATE INDEX "support_ticket_messages_sender_id_idx" ON "support_ticket_messages"("sender_id");

-- CreateIndex
CREATE INDEX "support_ticket_messages_created_at_idx" ON "support_ticket_messages"("created_at");

-- CreateIndex
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");

-- CreateIndex
CREATE INDEX "payments_application_id_idx" ON "payments"("application_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_payment_type_idx" ON "payments"("payment_type");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences"("user_id");

-- CreateIndex
CREATE INDEX "user_preferences_user_id_idx" ON "user_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "program_categories_name_key" ON "program_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "program_categories_slug_key" ON "program_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "program_categories_legacy_id_key" ON "program_categories"("legacy_id");

-- CreateIndex
CREATE INDEX "program_categories_slug_idx" ON "program_categories"("slug");

-- CreateIndex
CREATE INDEX "program_categories_is_active_idx" ON "program_categories"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "program_category_settings_program_category_id_key" ON "program_category_settings"("program_category_id");

-- CreateIndex
CREATE INDEX "program_social_feeds_program_category_id_idx" ON "program_social_feeds"("program_category_id");

-- CreateIndex
CREATE INDEX "program_social_feeds_platform_idx" ON "program_social_feeds"("platform");

-- CreateIndex
CREATE INDEX "program_social_feeds_posted_at_idx" ON "program_social_feeds"("posted_at");

-- CreateIndex
CREATE UNIQUE INDEX "programs_legacy_id_key" ON "programs"("legacy_id");

-- CreateIndex
CREATE INDEX "programs_program_category_id_idx" ON "programs"("program_category_id");

-- CreateIndex
CREATE INDEX "programs_year_idx" ON "programs"("year");

-- CreateIndex
CREATE INDEX "programs_is_published_idx" ON "programs"("is_published");

-- CreateIndex
CREATE INDEX "programs_is_visible_to_users_idx" ON "programs"("is_visible_to_users");

-- CreateIndex
CREATE INDEX "programs_status_idx" ON "programs"("status");

-- CreateIndex
CREATE INDEX "programs_deleted_at_idx" ON "programs"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "programs_program_category_id_slug_key" ON "programs"("program_category_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "program_tags_name_key" ON "program_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "program_tags_slug_key" ON "program_tags"("slug");

-- CreateIndex
CREATE INDEX "program_tags_slug_idx" ON "program_tags"("slug");

-- CreateIndex
CREATE INDEX "program_tag_relations_program_id_idx" ON "program_tag_relations"("program_id");

-- CreateIndex
CREATE INDEX "program_tag_relations_tag_id_idx" ON "program_tag_relations"("tag_id");

-- CreateIndex
CREATE INDEX "program_waitlist_program_id_idx" ON "program_waitlist"("program_id");

-- CreateIndex
CREATE INDEX "program_waitlist_user_id_idx" ON "program_waitlist"("user_id");

-- CreateIndex
CREATE INDEX "program_waitlist_position_idx" ON "program_waitlist"("position");

-- CreateIndex
CREATE UNIQUE INDEX "program_waitlist_program_id_user_id_key" ON "program_waitlist"("program_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "admins_user_id_key" ON "admins"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "admins_employee_id_key" ON "admins"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "admins_legacy_id_key" ON "admins"("legacy_id");

-- CreateIndex
CREATE INDEX "admins_user_id_idx" ON "admins"("user_id");

-- CreateIndex
CREATE INDEX "admins_role_id_idx" ON "admins"("role_id");

-- CreateIndex
CREATE INDEX "admins_employee_id_idx" ON "admins"("employee_id");

-- CreateIndex
CREATE INDEX "admins_department_idx" ON "admins"("department");

-- CreateIndex
CREATE INDEX "admins_deleted_at_idx" ON "admins"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "admin_roles_name_key" ON "admin_roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "admin_roles_legacy_id_key" ON "admin_roles"("legacy_id");

-- CreateIndex
CREATE INDEX "admin_roles_name_idx" ON "admin_roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "admin_programs_legacy_id_key" ON "admin_programs"("legacy_id");

-- CreateIndex
CREATE INDEX "admin_programs_admin_id_idx" ON "admin_programs"("admin_id");

-- CreateIndex
CREATE INDEX "admin_programs_program_id_idx" ON "admin_programs"("program_id");

-- CreateIndex
CREATE INDEX "admin_programs_removed_at_idx" ON "admin_programs"("removed_at");

-- CreateIndex
CREATE UNIQUE INDEX "admin_programs_admin_id_program_id_key" ON "admin_programs"("admin_id", "program_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_program_categories_legacy_id_key" ON "admin_program_categories"("legacy_id");

-- CreateIndex
CREATE INDEX "admin_program_categories_admin_id_idx" ON "admin_program_categories"("admin_id");

-- CreateIndex
CREATE INDEX "admin_program_categories_program_category_id_idx" ON "admin_program_categories"("program_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_program_categories_admin_id_program_category_id_key" ON "admin_program_categories"("admin_id", "program_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "participants_user_id_key" ON "participants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "participants_legacy_id_key" ON "participants"("legacy_id");

-- CreateIndex
CREATE INDEX "participants_user_id_idx" ON "participants"("user_id");

-- CreateIndex
CREATE INDEX "participants_nationality_code_idx" ON "participants"("nationality_code");

-- CreateIndex
CREATE INDEX "participants_institution_idx" ON "participants"("institution");

-- CreateIndex
CREATE INDEX "participants_referral_code_idx" ON "participants"("referral_code");

-- CreateIndex
CREATE INDEX "participants_deleted_at_idx" ON "participants"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "ambassadors_user_id_key" ON "ambassadors"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ambassadors_referral_code_key" ON "ambassadors"("referral_code");

-- CreateIndex
CREATE UNIQUE INDEX "ambassadors_legacy_id_key" ON "ambassadors"("legacy_id");

-- CreateIndex
CREATE INDEX "ambassadors_user_id_idx" ON "ambassadors"("user_id");

-- CreateIndex
CREATE INDEX "ambassadors_referral_code_idx" ON "ambassadors"("referral_code");

-- CreateIndex
CREATE INDEX "ambassadors_program_id_idx" ON "ambassadors"("program_id");

-- CreateIndex
CREATE INDEX "ambassadors_deleted_at_idx" ON "ambassadors"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "ambassador_referrals_legacy_id_key" ON "ambassador_referrals"("legacy_id");

-- CreateIndex
CREATE INDEX "ambassador_referrals_ambassador_id_idx" ON "ambassador_referrals"("ambassador_id");

-- CreateIndex
CREATE INDEX "ambassador_referrals_participant_id_idx" ON "ambassador_referrals"("participant_id");

-- CreateIndex
CREATE INDEX "ambassador_referrals_status_idx" ON "ambassador_referrals"("status");

-- CreateIndex
CREATE INDEX "ambassador_referrals_referred_at_accepted_at_idx" ON "ambassador_referrals"("referred_at", "accepted_at");

-- CreateIndex
CREATE UNIQUE INDEX "ambassador_referrals_ambassador_id_participant_id_key" ON "ambassador_referrals"("ambassador_id", "participant_id");

-- CreateIndex
CREATE INDEX "files_user_id_idx" ON "files"("user_id");

-- CreateIndex
CREATE INDEX "files_entity_type_entity_id_idx" ON "files"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "migration_tracking_table_name_idx" ON "migration_tracking"("table_name");

-- CreateIndex
CREATE INDEX "migration_tracking_mysql_id_idx" ON "migration_tracking"("mysql_id");

-- CreateIndex
CREATE INDEX "migration_tracking_postgres_id_idx" ON "migration_tracking"("postgres_id");

-- CreateIndex
CREATE UNIQUE INDEX "migration_tracking_table_name_mysql_id_key" ON "migration_tracking"("table_name", "mysql_id");

-- AddForeignKey
ALTER TABLE "program_pricing_tiers" ADD CONSTRAINT "program_pricing_tiers_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_tier_validity_periods" ADD CONSTRAINT "pricing_tier_validity_periods_pricing_tier_id_fkey" FOREIGN KEY ("pricing_tier_id") REFERENCES "program_pricing_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_requirements" ADD CONSTRAINT "program_requirements_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_form_fields" ADD CONSTRAINT "application_form_fields_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_applications" ADD CONSTRAINT "participant_applications_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_applications" ADD CONSTRAINT "participant_applications_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_applications" ADD CONSTRAINT "participant_applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_applications" ADD CONSTRAINT "participant_applications_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_applications" ADD CONSTRAINT "participant_applications_withdrawn_by_fkey" FOREIGN KEY ("withdrawn_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_edit_history" ADD CONSTRAINT "application_edit_history_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "participant_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_edit_history" ADD CONSTRAINT "application_edit_history_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_awards" ADD CONSTRAINT "participant_awards_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "participant_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_awards" ADD CONSTRAINT "participant_awards_program_award_id_fkey" FOREIGN KEY ("program_award_id") REFERENCES "program_awards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_awards" ADD CONSTRAINT "participant_awards_awarded_by_fkey" FOREIGN KEY ("awarded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_documents" ADD CONSTRAINT "participant_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "participant_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_documents" ADD CONSTRAINT "participant_documents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "document_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "auth_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_security_logs" ADD CONSTRAINT "user_security_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_privacy_consents" ADD CONSTRAINT "user_privacy_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocked_accounts" ADD CONSTRAINT "user_blocked_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocked_accounts" ADD CONSTRAINT "user_blocked_accounts_blocked_by_fkey" FOREIGN KEY ("blocked_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocked_accounts" ADD CONSTRAINT "user_blocked_accounts_unblocked_by_fkey" FOREIGN KEY ("unblocked_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activity_logs" ADD CONSTRAINT "user_activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activity_logs" ADD CONSTRAINT "user_activity_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "user_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_faqs" ADD CONSTRAINT "program_faqs_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_timeline" ADD CONSTRAINT "program_timeline_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_schedules" ADD CONSTRAINT "program_schedules_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_speakers" ADD CONSTRAINT "program_speakers_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_gallery" ADD CONSTRAINT "program_gallery_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_testimonials" ADD CONSTRAINT "program_testimonials_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_testimonials" ADD CONSTRAINT "program_testimonials_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_team" ADD CONSTRAINT "program_team_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_team" ADD CONSTRAINT "program_team_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_partners" ADD CONSTRAINT "program_partners_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_resources" ADD CONSTRAINT "program_resources_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_announcements" ADD CONSTRAINT "program_announcements_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_templates" ADD CONSTRAINT "certificate_templates_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_awards" ADD CONSTRAINT "program_awards_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_announcements" ADD CONSTRAINT "system_announcements_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_announcements" ADD CONSTRAINT "system_announcements_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_announcements" ADD CONSTRAINT "system_announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_announcements" ADD CONSTRAINT "system_announcements_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_announcement_reads" ADD CONSTRAINT "user_announcement_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_announcement_reads" ADD CONSTRAINT "user_announcement_reads_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "system_announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "participant_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_program_pricing_tier_id_fkey" FOREIGN KEY ("program_pricing_tier_id") REFERENCES "program_pricing_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_category_settings" ADD CONSTRAINT "program_category_settings_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_social_feeds" ADD CONSTRAINT "program_social_feeds_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_tag_relations" ADD CONSTRAINT "program_tag_relations_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_tag_relations" ADD CONSTRAINT "program_tag_relations_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "program_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_waitlist" ADD CONSTRAINT "program_waitlist_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_waitlist" ADD CONSTRAINT "program_waitlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "admin_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_programs" ADD CONSTRAINT "admin_programs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_programs" ADD CONSTRAINT "admin_programs_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_program_categories" ADD CONSTRAINT "admin_program_categories_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_program_categories" ADD CONSTRAINT "admin_program_categories_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "fk_participant_deleted_by_user" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "fk_participant_deleted_by_admin" FOREIGN KEY ("deleted_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambassadors" ADD CONSTRAINT "ambassadors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambassadors" ADD CONSTRAINT "ambassadors_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambassadors" ADD CONSTRAINT "fk_ambassador_deleted_by_user" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambassadors" ADD CONSTRAINT "fk_ambassador_deleted_by_admin" FOREIGN KEY ("deleted_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambassador_referrals" ADD CONSTRAINT "ambassador_referrals_ambassador_id_fkey" FOREIGN KEY ("ambassador_id") REFERENCES "ambassadors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambassador_referrals" ADD CONSTRAINT "ambassador_referrals_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambassador_referrals" ADD CONSTRAINT "ambassador_referrals_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
