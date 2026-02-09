--
-- PostgreSQL database dump
--

\restrict Jf6l2fvpqi9YZh4o8mq3FZUmGHkK0imKSn0mnq2bt0DnR8aFlYu5zvG6hO606n7

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: ybb_user
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO ybb_user;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: ybb_user
--

COMMENT ON SCHEMA public IS '';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: AnnouncementPriority; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."AnnouncementPriority" AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);


ALTER TYPE public."AnnouncementPriority" OWNER TO ybb_user;

--
-- Name: AnnouncementTarget; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."AnnouncementTarget" AS ENUM (
    'all',
    'participants',
    'ambassadors',
    'specific_program'
);


ALTER TYPE public."AnnouncementTarget" OWNER TO ybb_user;

--
-- Name: AnnouncementType; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."AnnouncementType" AS ENUM (
    'general',
    'maintenance',
    'deadline',
    'feature',
    'alert'
);


ALTER TYPE public."AnnouncementType" OWNER TO ybb_user;

--
-- Name: ApplicationCategory; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."ApplicationCategory" AS ENUM (
    'fully_funded',
    'self_funded'
);


ALTER TYPE public."ApplicationCategory" OWNER TO ybb_user;

--
-- Name: ApplicationStatus; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."ApplicationStatus" AS ENUM (
    'draft',
    'submitted',
    'under_review',
    'interview_scheduled',
    'accepted',
    'rejected',
    'waitlisted',
    'withdrawn'
);


ALTER TYPE public."ApplicationStatus" OWNER TO ybb_user;

--
-- Name: AssessmentStatus; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."AssessmentStatus" AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'skipped'
);


ALTER TYPE public."AssessmentStatus" OWNER TO ybb_user;

--
-- Name: AssessmentType; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."AssessmentType" AS ENUM (
    'document_review',
    'interview',
    'essay_scoring',
    'final_assessment'
);


ALTER TYPE public."AssessmentType" OWNER TO ybb_user;

--
-- Name: BlockType; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."BlockType" AS ENUM (
    'temporary',
    'permanent'
);


ALTER TYPE public."BlockType" OWNER TO ybb_user;

--
-- Name: ChangeType; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."ChangeType" AS ENUM (
    'create',
    'update',
    'delete',
    'status_change'
);


ALTER TYPE public."ChangeType" OWNER TO ybb_user;

--
-- Name: ChangedByType; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."ChangedByType" AS ENUM (
    'participant',
    'admin',
    'system'
);


ALTER TYPE public."ChangedByType" OWNER TO ybb_user;

--
-- Name: DeletionStatus; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."DeletionStatus" AS ENUM (
    'pending',
    'approved',
    'rejected',
    'completed',
    'cancelled'
);


ALTER TYPE public."DeletionStatus" OWNER TO ybb_user;

--
-- Name: DocumentTemplateType; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."DocumentTemplateType" AS ENUM (
    'letter_of_acceptance',
    'letter_of_invitation',
    'certificate_participation',
    'certificate_achievement',
    'certificate_speaker',
    'letter_recommendation',
    'agreement_letter',
    'custom'
);


ALTER TYPE public."DocumentTemplateType" OWNER TO ybb_user;

--
-- Name: FaqCategory; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."FaqCategory" AS ENUM (
    'general',
    'registration',
    'payment',
    'event_details',
    'accommodation',
    'visa',
    'other'
);


ALTER TYPE public."FaqCategory" OWNER TO ybb_user;

--
-- Name: Gender; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."Gender" AS ENUM (
    'male',
    'female',
    'other'
);


ALTER TYPE public."Gender" OWNER TO ybb_user;

--
-- Name: NotificationPriority; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."NotificationPriority" AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);


ALTER TYPE public."NotificationPriority" OWNER TO ybb_user;

--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'unpaid',
    'paid',
    'processing',
    'failed',
    'refunded'
);


ALTER TYPE public."PaymentStatus" OWNER TO ybb_user;

--
-- Name: PricingFeeType; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."PricingFeeType" AS ENUM (
    'registration_fee',
    'program_fee_1',
    'program_fee_2',
    'full_fee',
    'custom_fee'
);


ALTER TYPE public."PricingFeeType" OWNER TO ybb_user;

--
-- Name: PricingTarget; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."PricingTarget" AS ENUM (
    'self_funded',
    'fully_funded',
    'all'
);


ALTER TYPE public."PricingTarget" OWNER TO ybb_user;

--
-- Name: ReferralStatus; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."ReferralStatus" AS ENUM (
    'referred',
    'registered',
    'applied',
    'accepted',
    'completed'
);


ALTER TYPE public."ReferralStatus" OWNER TO ybb_user;

--
-- Name: RiskLevel; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."RiskLevel" AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


ALTER TYPE public."RiskLevel" OWNER TO ybb_user;

--
-- Name: ScoreStatus; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."ScoreStatus" AS ENUM (
    'pending',
    'scored',
    'go_to_interview',
    'rejected'
);


ALTER TYPE public."ScoreStatus" OWNER TO ybb_user;

--
-- Name: SupportTicketPriority; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."SupportTicketPriority" AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);


ALTER TYPE public."SupportTicketPriority" OWNER TO ybb_user;

--
-- Name: SupportTicketStatus; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."SupportTicketStatus" AS ENUM (
    'open',
    'in_progress',
    'waiting_response',
    'resolved',
    'closed'
);


ALTER TYPE public."SupportTicketStatus" OWNER TO ybb_user;

--
-- Name: Theme; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."Theme" AS ENUM (
    'light',
    'dark',
    'auto'
);


ALTER TYPE public."Theme" OWNER TO ybb_user;

--
-- Name: TimelineCompletionType; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."TimelineCompletionType" AS ENUM (
    'date_passed',
    'status_change',
    'payment_completed',
    'document_uploaded',
    'manual',
    'always_open'
);


ALTER TYPE public."TimelineCompletionType" OWNER TO ybb_user;

--
-- Name: TimelineType; Type: TYPE; Schema: public; Owner: ybb_user
--

CREATE TYPE public."TimelineType" AS ENUM (
    'registration',
    'announcement_loa',
    'payment_1',
    'payment_2',
    'mentoring',
    'interview',
    'announcement_final',
    'program_start',
    'program_end',
    'onboarding',
    'custom'
);


ALTER TYPE public."TimelineType" OWNER TO ybb_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO ybb_user;

--
-- Name: account_deletion_requests; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.account_deletion_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    reason text,
    reason_category character varying(50),
    status public."DeletionStatus" DEFAULT 'pending'::public."DeletionStatus" NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp(6) with time zone,
    review_notes text,
    scheduled_deletion_date timestamp(6) with time zone,
    actual_deletion_date timestamp(6) with time zone,
    data_snapshot json,
    deletion_log json DEFAULT '{}'::json NOT NULL,
    ip_address inet,
    user_agent text,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


ALTER TABLE public.account_deletion_requests OWNER TO ybb_user;

--
-- Name: admin_brands; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.admin_brands (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    admin_id uuid NOT NULL,
    brand_id uuid NOT NULL,
    role_in_brand character varying(50),
    permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    assigned_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    assigned_by uuid,
    legacy_id integer
);


ALTER TABLE public.admin_brands OWNER TO ybb_user;

--
-- Name: admin_programs; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.admin_programs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    admin_id uuid NOT NULL,
    program_id uuid NOT NULL,
    role_in_program character varying(50),
    permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    assigned_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    assigned_by uuid,
    removed_at timestamp(6) with time zone,
    removed_by uuid,
    legacy_id integer
);


ALTER TABLE public.admin_programs OWNER TO ybb_user;

--
-- Name: admin_roles; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.admin_roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    legacy_id integer,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.admin_roles OWNER TO ybb_user;

--
-- Name: admins; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.admins (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    full_name character varying(255) NOT NULL,
    phone_number character varying(20),
    bio text,
    avatar_url character varying(500),
    employee_id character varying(50),
    department character varying(100),
    job_title character varying(100),
    role_id uuid,
    custom_permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    access_level integer DEFAULT 1 NOT NULL,
    can_manage_admins boolean DEFAULT false NOT NULL,
    can_assign_roles boolean DEFAULT false NOT NULL,
    timezone character varying(50) DEFAULT 'UTC'::character varying NOT NULL,
    locale character varying(10) DEFAULT 'en'::character varying NOT NULL,
    preferences json DEFAULT '{}'::json NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    activated_at timestamp(6) with time zone,
    deactivated_at timestamp(6) with time zone,
    last_active_at timestamp(6) with time zone,
    deleted_at timestamp(6) with time zone,
    created_by uuid,
    deleted_by uuid,
    legacy_id integer
);


ALTER TABLE public.admins OWNER TO ybb_user;

--
-- Name: ai_chatbot_configs; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.ai_chatbot_configs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    brand_id uuid,
    name character varying(100) NOT NULL,
    type character varying(20) DEFAULT 'iframe'::character varying NOT NULL,
    bot_config text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    display_on_web boolean DEFAULT true NOT NULL,
    allowed_domains text[] DEFAULT ARRAY[]::text[],
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.ai_chatbot_configs OWNER TO ybb_user;

--
-- Name: ambassador_referrals; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.ambassador_referrals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    ambassador_id uuid NOT NULL,
    participant_id uuid NOT NULL,
    status public."ReferralStatus" DEFAULT 'referred'::public."ReferralStatus" NOT NULL,
    verified_at timestamp(6) with time zone,
    verified_by uuid,
    referred_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    registered_at timestamp(6) with time zone,
    profile_completed_at timestamp(6) with time zone,
    applied_at timestamp(6) with time zone,
    accepted_at timestamp(6) with time zone,
    completed_at timestamp(6) with time zone,
    days_to_register integer,
    days_to_apply integer,
    days_to_accept integer,
    total_conversion_days integer,
    legacy_id integer,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.ambassador_referrals OWNER TO ybb_user;

--
-- Name: ambassadors; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.ambassadors (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    full_name character varying(255) NOT NULL,
    phone_number character varying(25),
    referral_code character varying(20) NOT NULL,
    program_id uuid NOT NULL,
    institution character varying(255),
    gender public."Gender",
    total_referrals integer DEFAULT 0 NOT NULL,
    successful_referrals integer DEFAULT 0 NOT NULL,
    last_referral_at timestamp(6) with time zone,
    first_successful_referral_at timestamp(6) with time zone,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    activated_at timestamp(6) with time zone,
    deactivated_at timestamp(6) with time zone,
    deactivation_reason text,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone,
    deleted_by uuid,
    legacy_id integer
);


ALTER TABLE public.ambassadors OWNER TO ybb_user;

--
-- Name: application_assessments; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.application_assessments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    application_id uuid NOT NULL,
    type public."AssessmentType" DEFAULT 'document_review'::public."AssessmentType" NOT NULL,
    status public."AssessmentStatus" DEFAULT 'pending'::public."AssessmentStatus" NOT NULL,
    score numeric(5,2),
    notes text,
    feedback text,
    assessor_id uuid,
    assessed_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


ALTER TABLE public.application_assessments OWNER TO ybb_user;

--
-- Name: application_edit_history; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.application_edit_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    application_id uuid NOT NULL,
    edited_by uuid NOT NULL,
    reason text,
    changes json NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    snapshot json
);


ALTER TABLE public.application_edit_history OWNER TO ybb_user;

--
-- Name: application_form_fields; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.application_form_fields (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    program_id uuid NOT NULL,
    section character varying(50) DEFAULT 'personal_info'::character varying NOT NULL,
    label character varying(255) NOT NULL,
    name character varying(100) NOT NULL,
    type character varying(50) NOT NULL,
    placeholder character varying(255),
    help_text text,
    options json DEFAULT '[]'::json,
    validation_rules json DEFAULT '{}'::json,
    is_required boolean DEFAULT true NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.application_form_fields OWNER TO ybb_user;

--
-- Name: application_invoices; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.application_invoices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    application_id uuid NOT NULL,
    pricing_tier_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'IDR'::character varying NOT NULL,
    status public."PaymentStatus" DEFAULT 'unpaid'::public."PaymentStatus" NOT NULL,
    paid_at timestamp(6) with time zone,
    external_transaction_id character varying(100),
    payment_method character varying(50),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


ALTER TABLE public.application_invoices OWNER TO ybb_user;

--
-- Name: application_reviews; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.application_reviews (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    application_id uuid NOT NULL,
    schema_id uuid NOT NULL,
    reviewer_id uuid NOT NULL,
    total_score numeric(5,2) NOT NULL,
    notes text,
    status character varying(50) DEFAULT 'draft'::character varying NOT NULL,
    started_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp(6) with time zone
);


ALTER TABLE public.application_reviews OWNER TO ybb_user;

--
-- Name: application_score_items; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.application_score_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    review_id uuid NOT NULL,
    criterion_id uuid NOT NULL,
    score numeric(5,2) NOT NULL,
    notes text,
    legacy_id integer
);


ALTER TABLE public.application_score_items OWNER TO ybb_user;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event character varying(255) NOT NULL,
    payload jsonb,
    entity_type character varying(50),
    entity_id character varying(255),
    actor_id uuid,
    ip_address character varying(45),
    user_agent text,
    status character varying(50),
    error_message text,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO ybb_user;

--
-- Name: auth_providers; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.auth_providers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(50) NOT NULL,
    display_name character varying(100) NOT NULL,
    description text,
    client_id character varying(255),
    client_secret character varying(255),
    auth_url character varying(500),
    token_url character varying(500),
    scopes json DEFAULT '[]'::json,
    is_active boolean DEFAULT true NOT NULL,
    is_oauth boolean DEFAULT false NOT NULL,
    icon character varying(100),
    button_color character varying(7),
    "order" integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.auth_providers OWNER TO ybb_user;

--
-- Name: brand_settings; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.brand_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    brand_id uuid NOT NULL,
    is_maintenance_mode boolean DEFAULT false NOT NULL,
    maintenance_message text,
    maintenance_scheduled_end timestamp(6) with time zone,
    footer_navigation json DEFAULT '[]'::json NOT NULL,
    usd_in_idr numeric(10,2) DEFAULT 16000 NOT NULL,
    google_analytics_id character varying(50),
    pixel_id character varying(50),
    support_email character varying(255),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.brand_settings OWNER TO ybb_user;

--
-- Name: brand_social_feeds; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.brand_social_feeds (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    brand_id uuid NOT NULL,
    platform character varying(50) DEFAULT 'instagram'::character varying NOT NULL,
    post_id character varying(100) NOT NULL,
    image_url character varying(500) NOT NULL,
    permalink character varying(500) NOT NULL,
    caption text,
    posted_at timestamp(6) with time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.brand_social_feeds OWNER TO ybb_user;

--
-- Name: brands; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.brands (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    slug character varying(100) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone,
    legacy_id integer,
    website_url character varying(255),
    about text,
    vision text,
    mission text,
    logo_url character varying(500),
    banner_url character varying(500),
    primary_color character varying(7),
    contact_email character varying(255),
    contact_phone character varying(50),
    contact_whatsapp character varying(50),
    contact_address text,
    social_media_links json DEFAULT '{}'::json,
    default_location character varying(255),
    default_country character varying(100),
    default_timezone character varying(50),
    require_email_verification boolean DEFAULT true NOT NULL,
    default_currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    enable_multi_currency boolean DEFAULT false NOT NULL,
    meta_title character varying(255),
    meta_description text,
    meta_keywords text
);


ALTER TABLE public.brands OWNER TO ybb_user;

--
-- Name: certificate_templates; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.certificate_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    program_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    template_url character varying(500) NOT NULL,
    fields json DEFAULT '[]'::json NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.certificate_templates OWNER TO ybb_user;

--
-- Name: document_templates; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.document_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    program_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    type public."DocumentTemplateType" DEFAULT 'custom'::public."DocumentTemplateType" NOT NULL,
    description text,
    template_url character varying(500),
    html_content text,
    placeholders json DEFAULT '[]'::json NOT NULL,
    layout_config json DEFAULT '{}'::json NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    legacy_id integer,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.document_templates OWNER TO ybb_user;

--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.email_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    brand_id uuid,
    program_id uuid,
    name character varying(100) NOT NULL,
    type character varying(50) NOT NULL,
    subject character varying(255) NOT NULL,
    body text NOT NULL,
    variables json DEFAULT '[]'::json,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.email_templates OWNER TO ybb_user;

--
-- Name: files; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.files (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    filename character varying(255) NOT NULL,
    content_type character varying(100) NOT NULL,
    size bigint NOT NULL,
    url text NOT NULL,
    storage_path text NOT NULL,
    user_id uuid NOT NULL,
    entity_type character varying(50),
    entity_id uuid,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


ALTER TABLE public.files OWNER TO ybb_user;

--
-- Name: legal_documents; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.legal_documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    brand_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    content text NOT NULL,
    version character varying(20) DEFAULT '1.0'::character varying NOT NULL,
    description text,
    is_required boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    published_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.legal_documents OWNER TO ybb_user;

--
-- Name: migration_tracking; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.migration_tracking (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    table_name character varying(100) NOT NULL,
    mysql_id integer NOT NULL,
    postgres_id uuid NOT NULL,
    migrated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    migration_batch character varying(50)
);


ALTER TABLE public.migration_tracking OWNER TO ybb_user;

--
-- Name: newsletter_subscribers; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.newsletter_subscribers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255),
    source character varying(50),
    is_subscribed boolean DEFAULT true NOT NULL,
    subscribed_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    unsubscribed_at timestamp(6) with time zone,
    user_id uuid,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.newsletter_subscribers OWNER TO ybb_user;

--
-- Name: participant_applications; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.participant_applications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    program_id uuid NOT NULL,
    participant_id uuid NOT NULL,
    status public."ApplicationStatus" DEFAULT 'draft'::public."ApplicationStatus" NOT NULL,
    ticket_status text DEFAULT 'regular'::text NOT NULL,
    referral_code character varying(50),
    submission_date timestamp(6) with time zone,
    personal_data json DEFAULT '{}'::json NOT NULL,
    essay_answers json DEFAULT '{}'::json NOT NULL,
    uploaded_files json DEFAULT '{}'::json NOT NULL,
    deleted_at timestamp(6) with time zone,
    deleted_by uuid,
    withdrawn_by uuid,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    application_category public."ApplicationCategory",
    program_payment_status public."PaymentStatus" DEFAULT 'unpaid'::public."PaymentStatus" NOT NULL,
    registration_payment_status public."PaymentStatus" DEFAULT 'unpaid'::public."PaymentStatus" NOT NULL,
    participation_category_id uuid,
    pricing_tier_id uuid
);


ALTER TABLE public.participant_applications OWNER TO ybb_user;

--
-- Name: participant_awards; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.participant_awards (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    application_id uuid NOT NULL,
    program_award_id uuid NOT NULL,
    awarded_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    awarded_by uuid,
    notes text,
    certificate_url character varying(500),
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.participant_awards OWNER TO ybb_user;

--
-- Name: participant_documents; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.participant_documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    application_id uuid NOT NULL,
    template_id uuid,
    document_number character varying(50),
    name character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    file_url character varying(500) NOT NULL,
    file_type character varying(10) DEFAULT 'pdf'::character varying NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    download_count integer DEFAULT 0 NOT NULL,
    generated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp(6) with time zone,
    legacy_id integer,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.participant_documents OWNER TO ybb_user;

--
-- Name: participants; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.participants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    full_name character varying(255) NOT NULL,
    nick_name character varying(100),
    display_name character varying(100),
    birthdate date,
    gender public."Gender",
    phone_country_code character varying(10),
    phone_number character varying(25),
    phone_verified boolean DEFAULT false NOT NULL,
    nationality character varying(100),
    nationality_code character varying(3),
    origin_country character varying(100),
    origin_city character varying(100),
    origin_address text,
    current_country character varying(100),
    current_city character varying(100),
    current_address text,
    education_level character varying(100),
    institution character varying(200),
    major character varying(200),
    graduation_year integer,
    occupation character varying(100),
    instagram_username character varying(50),
    linkedin_url character varying(500),
    portfolio_url character varying(500),
    organizations text,
    tshirt_size character varying(10),
    dietary_restrictions text,
    medical_conditions text,
    special_needs text,
    emergency_contact_name character varying(255),
    emergency_contact_relation character varying(50),
    emergency_contact_country_code character varying(10),
    emergency_contact_phone character varying(25),
    emergency_contact_email character varying(255),
    profile_picture_url character varying(500),
    resume_url character varying(500),
    knowledge_source character varying(100),
    referral_code character varying(20),
    preferences json DEFAULT '{}'::json NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    profile_completed_at timestamp(6) with time zone,
    profile_completion_percentage integer DEFAULT 0 NOT NULL,
    last_profile_update timestamp(6) with time zone,
    email_verified_at timestamp(6) with time zone,
    phone_verified_at timestamp(6) with time zone,
    deleted_at timestamp(6) with time zone,
    deleted_by uuid,
    legacy_id integer
);


ALTER TABLE public.participants OWNER TO ybb_user;

--
-- Name: partnership_enquiries; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.partnership_enquiries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    brand_id uuid,
    program_id uuid,
    partnership_type character varying(50) NOT NULL,
    sub_category character varying(50),
    full_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    whatsapp_number character varying(25),
    company character varying(255),
    subject character varying(255),
    description text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.partnership_enquiries OWNER TO ybb_user;

--
-- Name: partnership_opportunities; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.partnership_opportunities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    brand_id uuid,
    program_id uuid,
    title character varying(255) NOT NULL,
    subtitle character varying(255),
    description text,
    features json DEFAULT '[]'::json,
    cta_label character varying(50),
    type character varying(50) NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.partnership_opportunities OWNER TO ybb_user;

--
-- Name: pricing_tier_validity_periods; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.pricing_tier_validity_periods (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pricing_tier_id uuid NOT NULL,
    start_date timestamp(6) with time zone NOT NULL,
    end_date timestamp(6) with time zone NOT NULL,
    description character varying(255),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


ALTER TABLE public.pricing_tier_validity_periods OWNER TO ybb_user;

--
-- Name: program_announcement_reads; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.program_announcement_reads (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    announcement_id uuid NOT NULL,
    read_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.program_announcement_reads OWNER TO ybb_user;

--
-- Name: program_announcements; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.program_announcements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    program_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    image_url character varying(500),
    target_audience character varying(50) DEFAULT 'all'::character varying NOT NULL,
    send_email boolean DEFAULT false NOT NULL,
    is_pinned boolean DEFAULT false NOT NULL,
    publish_date timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone,
    category character varying(50),
    tags text[] DEFAULT ARRAY[]::text[]
);


ALTER TABLE public.program_announcements OWNER TO ybb_user;

--
-- Name: program_awards; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.program_awards (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    program_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100),
    tier character varying(50),
    tags text[] DEFAULT ARRAY[]::text[],
    winner_count integer,
    color character varying(7),
    badge_url character varying(500),
    icon_url character varying(500),
    certificate_template_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    legacy_id integer,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.program_awards OWNER TO ybb_user;

--
-- Name: program_essays; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.program_essays (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    program_id uuid NOT NULL,
    question text NOT NULL,
    description text,
    word_limit integer,
    is_required boolean DEFAULT true NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.program_essays OWNER TO ybb_user;

--
-- Name: program_faqs; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.program_faqs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    program_id uuid NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    category public."FaqCategory" DEFAULT 'general'::public."FaqCategory" NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.program_faqs OWNER TO ybb_user;

--
-- Name: program_gallery; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.program_gallery (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    program_id uuid NOT NULL,
    image_url character varying(500) NOT NULL,
    video_url character varying(500),
    title character varying(255),
    description text,
    type character varying(50) DEFAULT 'image'::character varying NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.program_gallery OWNER TO ybb_user;

--
-- Name: program_objectives; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.program_objectives (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    program_id uuid NOT NULL,
    description text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.program_objectives OWNER TO ybb_user;

--
-- Name: program_participation_categories; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.program_participation_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    program_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    benefits text,
    eligibility text,
    "order" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


ALTER TABLE public.program_participation_categories OWNER TO ybb_user;

--
-- Name: program_participation_infos; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.program_participation_infos (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    program_id uuid NOT NULL,
    category public."ApplicationCategory" NOT NULL,
    hero_title character varying(255),
    hero_description text,
    benefits json DEFAULT '[]'::json,
    requirements json DEFAULT '[]'::json,
    sections json DEFAULT '[]'::json,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


ALTER TABLE public.program_participation_infos OWNER TO ybb_user;

--
-- Name: program_partners; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.program_partners (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    program_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    role character varying(255),
    logo_url character varying(500),
    website_url character varying(500),
    description text,
    "order" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.program_partners OWNER TO ybb_user;

--
-- Name: program_pricing_tiers; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.program_pricing_tiers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    program_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'IDR'::character varying NOT NULL,
    capacity integer DEFAULT 0,
    current_count integer DEFAULT 0 NOT NULL,
    benefits text[] DEFAULT ARRAY[]::text[],
    requirements text[] DEFAULT ARRAY[]::text[],
    fee_type public."PricingFeeType" DEFAULT 'registration_fee'::public."PricingFeeType" NOT NULL,
    icon character varying(255),
    sold_count integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone,
    allowed_categories public."ApplicationCategory"[] DEFAULT ARRAY['self_funded'::public."ApplicationCategory"]
);


ALTER TABLE public.program_pricing_tiers OWNER TO ybb_user;

--
-- Name: program_requirements; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.program_requirements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    program_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    type character varying(50) DEFAULT 'document'::character varying NOT NULL,
    file_max_size integer,
    file_allowed_types character varying(255),
    options json DEFAULT '[]'::json,
    is_required boolean DEFAULT true NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.program_requirements OWNER TO ybb_user;

--
-- Name: program_resources; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.program_resources (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    program_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    file_url character varying(500) NOT NULL,
    file_size bigint,
    file_type character varying(50),
    type character varying(50) NOT NULL,
    is_public boolean DEFAULT true NOT NULL,
    downloads integer DEFAULT 0 NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.program_resources OWNER TO ybb_user;

--
-- Name: program_schedules; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.program_schedules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    program_id uuid NOT NULL,
    day character varying(100) NOT NULL,
    start_time character varying(20),
    end_time character varying(20),
    activity character varying(255) NOT NULL,
    description text,
    location character varying(255),
    speaker character varying(255),
    "order" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.program_schedules OWNER TO ybb_user;

--
-- Name: program_speakers; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.program_speakers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    program_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    title character varying(255),
    organization character varying(255),
    bio text,
    photo_url character varying(500),
    email character varying(255),
    linkedin_url character varying(500),
    twitter_url character varying(500),
    "order" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.program_speakers OWNER TO ybb_user;

--
-- Name: program_subthemes; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.program_subthemes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    program_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    "order" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.program_subthemes OWNER TO ybb_user;

--
-- Name: program_tag_relations; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.program_tag_relations (
    program_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


ALTER TABLE public.program_tag_relations OWNER TO ybb_user;

--
-- Name: program_tags; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.program_tags (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    description text,
    color character varying(7),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.program_tags OWNER TO ybb_user;

--
-- Name: program_team; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.program_team (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    brand_id uuid,
    program_id uuid,
    name character varying(255) NOT NULL,
    role character varying(100) NOT NULL,
    bio text,
    photo_url character varying(500),
    email character varying(255),
    phone character varying(50),
    linkedin_url character varying(500),
    "order" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.program_team OWNER TO ybb_user;

--
-- Name: program_testimonials; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.program_testimonials (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    program_id uuid,
    brand_id uuid,
    name character varying(255) NOT NULL,
    role character varying(255),
    company character varying(255),
    testimonial text NOT NULL,
    category character varying(50) DEFAULT 'alumni'::character varying NOT NULL,
    type character varying(20) DEFAULT 'text'::character varying NOT NULL,
    video_url character varying(500),
    thumbnail_url character varying(500),
    avatar_url character varying(500),
    rating smallint,
    is_featured boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.program_testimonials OWNER TO ybb_user;

--
-- Name: program_timeline; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.program_timeline (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    program_id uuid NOT NULL,
    date timestamp(6) with time zone NOT NULL,
    end_date timestamp(6) with time zone,
    title character varying(255) NOT NULL,
    description text,
    icon character varying(100),
    type public."TimelineType" DEFAULT 'custom'::public."TimelineType" NOT NULL,
    completion_type public."TimelineCompletionType" DEFAULT 'date_passed'::public."TimelineCompletionType" NOT NULL,
    completion_config json DEFAULT '{}'::json NOT NULL,
    target_audience public."PricingTarget" DEFAULT 'all'::public."PricingTarget" NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.program_timeline OWNER TO ybb_user;

--
-- Name: program_waitlist; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.program_waitlist (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    program_id uuid NOT NULL,
    user_id uuid NOT NULL,
    "position" integer NOT NULL,
    notified boolean DEFAULT false NOT NULL,
    joined_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.program_waitlist OWNER TO ybb_user;

--
-- Name: programs; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.programs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    brand_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    description text,
    short_description character varying(500),
    year integer NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    application_deadline timestamp(6) with time zone NOT NULL,
    location character varying(255),
    capacity integer,
    is_published boolean DEFAULT false NOT NULL,
    is_visible_to_users boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying NOT NULL,
    thumbnail_url character varying(500),
    banner_url character varying(500),
    video_url character varying(500),
    require_email_verification boolean DEFAULT true NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    enable_currency_conversion boolean DEFAULT false NOT NULL,
    logo_url character varying(500),
    allow_registration boolean DEFAULT true NOT NULL,
    registration_open_date timestamp(6) with time zone,
    registration_close_date timestamp(6) with time zone,
    require_payment boolean DEFAULT false NOT NULL,
    registration_fee numeric(10,2),
    requirements_description text,
    benefits_description text,
    terms_and_conditions text,
    meta_title character varying(255),
    meta_description text,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone,
    legacy_id integer,
    theme character varying(255)
);


ALTER TABLE public.programs OWNER TO ybb_user;

--
-- Name: scoring_categories; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.scoring_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    schema_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    weight numeric(5,2) NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    legacy_reference text
);


ALTER TABLE public.scoring_categories OWNER TO ybb_user;

--
-- Name: scoring_criteria; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.scoring_criteria (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    category_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    weight numeric(5,2) NOT NULL,
    max_score numeric(5,2) DEFAULT 100.00 NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    legacy_id integer
);


ALTER TABLE public.scoring_criteria OWNER TO ybb_user;

--
-- Name: scoring_schemas; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.scoring_schemas (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    program_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone,
    legacy_id integer
);


ALTER TABLE public.scoring_schemas OWNER TO ybb_user;

--
-- Name: sponsors; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.sponsors (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    brand_id uuid,
    name character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    logo_url character varying(500),
    website_url character varying(500),
    description text,
    tier character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.sponsors OWNER TO ybb_user;

--
-- Name: sponsorship_tiers; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.sponsorship_tiers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    brand_id uuid,
    program_id uuid,
    name character varying(255) NOT NULL,
    price_description character varying(255),
    description text,
    features json DEFAULT '[]'::json,
    "order" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.sponsorship_tiers OWNER TO ybb_user;

--
-- Name: support_ticket_messages; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.support_ticket_messages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    ticket_id uuid NOT NULL,
    message text NOT NULL,
    is_from_admin boolean DEFAULT false NOT NULL,
    sender_id uuid NOT NULL,
    sender_name character varying(255) NOT NULL,
    attachments json DEFAULT '[]'::json NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp(6) with time zone,
    is_internal_note boolean DEFAULT false NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp(6) with time zone,
    legacy_id integer
);


ALTER TABLE public.support_ticket_messages OWNER TO ybb_user;

--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.support_tickets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    participant_id uuid NOT NULL,
    assigned_to uuid,
    program_id uuid,
    ticket_number character varying(20) NOT NULL,
    category character varying(100) NOT NULL,
    sub_category character varying(100),
    subject character varying(255) NOT NULL,
    description text NOT NULL,
    status public."SupportTicketStatus" DEFAULT 'open'::public."SupportTicketStatus" NOT NULL,
    priority public."SupportTicketPriority" DEFAULT 'normal'::public."SupportTicketPriority" NOT NULL,
    resolution text,
    resolved_at timestamp(6) with time zone,
    resolved_by uuid,
    closed_at timestamp(6) with time zone,
    closed_by uuid,
    closed_reason text,
    satisfaction_rating smallint,
    feedback text,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone,
    legacy_id integer
);


ALTER TABLE public.support_tickets OWNER TO ybb_user;

--
-- Name: system_announcements; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.system_announcements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    summary text,
    target_audience public."AnnouncementTarget" DEFAULT 'all'::public."AnnouncementTarget" NOT NULL,
    brand_id uuid,
    program_id uuid,
    priority public."AnnouncementPriority" DEFAULT 'normal'::public."AnnouncementPriority" NOT NULL,
    type public."AnnouncementType" DEFAULT 'general'::public."AnnouncementType" NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    published_at timestamp(6) with time zone,
    is_dismissible boolean DEFAULT true NOT NULL,
    show_banner boolean DEFAULT false NOT NULL,
    action_url character varying(500),
    action_label character varying(100),
    start_date timestamp(6) with time zone,
    end_date timestamp(6) with time zone,
    created_by uuid NOT NULL,
    updated_by uuid,
    metadata json DEFAULT '{}'::json NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.system_announcements OWNER TO ybb_user;

--
-- Name: user_activity_logs; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.user_activity_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    activity_type character varying(100) NOT NULL,
    activity_category character varying(50),
    activity_data json DEFAULT '{}'::json NOT NULL,
    page_url character varying(500),
    referrer_url character varying(500),
    session_id uuid,
    ip_address inet,
    user_agent text,
    device_type character varying(50),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.user_activity_logs OWNER TO ybb_user;

--
-- Name: user_announcement_reads; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.user_announcement_reads (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    announcement_id uuid NOT NULL,
    read_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_seen_at timestamp(6) with time zone,
    is_dismissed boolean DEFAULT false NOT NULL,
    dismissed_at timestamp(6) with time zone
);


ALTER TABLE public.user_announcement_reads OWNER TO ybb_user;

--
-- Name: user_blocked_accounts; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.user_blocked_accounts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    block_reason character varying(50) NOT NULL,
    block_description text NOT NULL,
    block_type public."BlockType" DEFAULT 'temporary'::public."BlockType" NOT NULL,
    blocked_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    blocked_until timestamp(6) with time zone,
    unblocked_at timestamp(6) with time zone,
    blocked_by uuid,
    unblocked_by uuid,
    violations_count integer DEFAULT 1 NOT NULL,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.user_blocked_accounts OWNER TO ybb_user;

--
-- Name: user_identities; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.user_identities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    provider_user_id character varying(255),
    provider_email character varying(255),
    access_token text,
    refresh_token text,
    token_expiry timestamp(6) with time zone,
    is_primary boolean DEFAULT false NOT NULL,
    last_used_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.user_identities OWNER TO ybb_user;

--
-- Name: user_notifications; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.user_notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    action_url character varying(500),
    action_label character varying(100),
    related_entity_type character varying(50),
    related_entity_id uuid,
    metadata json DEFAULT '{}'::json NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp(6) with time zone,
    priority public."NotificationPriority" DEFAULT 'normal'::public."NotificationPriority" NOT NULL,
    sent_via_email boolean DEFAULT false NOT NULL,
    sent_via_sms boolean DEFAULT false NOT NULL,
    email_sent_at timestamp(6) with time zone,
    sms_sent_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp(6) with time zone,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.user_notifications OWNER TO ybb_user;

--
-- Name: user_preferences; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.user_preferences (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    theme public."Theme" DEFAULT 'light'::public."Theme" NOT NULL,
    language character varying(10) DEFAULT 'en'::character varying NOT NULL,
    timezone character varying(50) DEFAULT 'UTC'::character varying NOT NULL,
    date_format character varying(20) DEFAULT 'YYYY-MM-DD'::character varying NOT NULL,
    email_notifications boolean DEFAULT true NOT NULL,
    sms_notifications boolean DEFAULT false NOT NULL,
    marketing_emails boolean DEFAULT false NOT NULL,
    newsletter_subscription boolean DEFAULT false NOT NULL,
    program_updates boolean DEFAULT true NOT NULL,
    application_updates boolean DEFAULT true NOT NULL,
    reminder_emails boolean DEFAULT true NOT NULL,
    custom_settings json DEFAULT '{}'::json NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


ALTER TABLE public.user_preferences OWNER TO ybb_user;

--
-- Name: user_privacy_consents; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.user_privacy_consents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    consent_type character varying(100) NOT NULL,
    consent_version character varying(50) NOT NULL,
    consent_text text,
    is_granted boolean NOT NULL,
    granted_at timestamp(6) with time zone,
    revoked_at timestamp(6) with time zone,
    ip_address inet,
    user_agent text,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.user_privacy_consents OWNER TO ybb_user;

--
-- Name: user_security_logs; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.user_security_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    event_type character varying(50) NOT NULL,
    event_status character varying(20) NOT NULL,
    event_description text,
    ip_address inet,
    user_agent text,
    device_fingerprint character varying(255),
    location character varying(255),
    risk_level public."RiskLevel",
    flagged boolean DEFAULT false NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.user_security_logs OWNER TO ybb_user;

--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.user_sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    session_token character varying(255) NOT NULL,
    refresh_token text,
    device_type character varying(50),
    device_name character varying(100),
    browser character varying(100),
    operating_system character varying(100),
    ip_address inet,
    country character varying(100),
    city character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    last_activity timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp(6) with time zone NOT NULL,
    revoked_at timestamp(6) with time zone
);


ALTER TABLE public.user_sessions OWNER TO ybb_user;

--
-- Name: users; Type: TABLE; Schema: public; Owner: ybb_user
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    brand_id uuid NOT NULL,
    password_hash character varying(255),
    email_verified boolean DEFAULT false NOT NULL,
    email_verified_at timestamp(6) with time zone,
    email_verification_token character varying(255),
    email_verification_expires timestamp(6) with time zone,
    password_reset_token character varying(255),
    password_reset_expires timestamp(6) with time zone,
    is_active boolean DEFAULT true NOT NULL,
    failed_login_attempts integer DEFAULT 0 NOT NULL,
    last_failed_login timestamp(6) with time zone,
    last_login_at timestamp(6) with time zone,
    last_password_change timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone,
    legacy_id integer,
    legacy_type character varying(20),
    is_onboarding_completed boolean DEFAULT false NOT NULL
);


ALTER TABLE public.users OWNER TO ybb_user;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
75fc5e6f-9ff9-4c3a-b33d-4f75e7a97154	ef53a8883625df67f0d02771e858b68d7674483ff5198eaad051d372b438bc6a	2026-02-08 07:16:27.845568+00	20260121092221_init_v7	\N	\N	2026-02-08 07:16:27.57177+00	1
bdf8efe3-d338-488d-95af-1b9f6ef05f79	13b6bc40e933f0359cbff0c156611569c004b504dccf16014936443ec6372d8c	2026-02-08 07:16:27.935824+00	20260125131457_restructure_applications_payments_v2	\N	\N	2026-02-08 07:16:27.925882+00	1
d13ad302-df5c-4f0f-955b-42182c90521b	f2d82e2051f52eefd4604d0ea4eecf9f4e84ae77b6e4425b09ed14ef6a2d802f	2026-02-08 07:16:27.857742+00	20260121150331_add_program_subthemes	\N	\N	2026-02-08 07:16:27.845936+00	1
12fa1fe0-2604-40a9-a297-e0abf4487fa1	867f6b7d267c8c0e40d2e7a5a5920114ea02de9a6e0aef7fbd81e393b311014d	2026-02-08 07:16:27.86216+00	20260121151101_add_soft_delete_columns	\N	\N	2026-02-08 07:16:27.858005+00	1
9113a0c7-cf3d-4573-af42-ae557d3fc87e	da013d445a7dee846a8a395753873939aef107c05805df610a9bb6e907286cdd	2026-02-08 07:16:27.867256+00	20260121152609_add_newsletter	\N	\N	2026-02-08 07:16:27.862374+00	1
3f58d712-3113-48ad-9c09-a20c96fb368a	73136fd181ae626575dee8e6a02663a4f9601a75dcd6381c1d8a55ec265b321f	2026-02-08 07:16:27.936959+00	20260125135616_add_participation_category	\N	\N	2026-02-08 07:16:27.936061+00	1
a0adf194-3245-460b-8fcf-42bcabfe86ed	9b89a48d038d7faa8a9a0c8b7bd70e5db2a8847272d7bef088779c0174a15fda	2026-02-08 07:16:27.871628+00	20260121153102_add_ai_chatbot	\N	\N	2026-02-08 07:16:27.867483+00	1
eae81066-54de-4d33-910a-c5c82523582c	6959c6b6b9308e7be0e3908432c96a45455b0410299b0af558818e49a546a1f0	2026-02-08 07:16:27.875232+00	20260121154105_add_program_participation_info	\N	\N	2026-02-08 07:16:27.871878+00	1
5b2f00d5-62b9-44d1-b8a5-237639cc8059	fc6dc0a0d8f1bc07fecaf1e2097d1c0a328a3cfac801547cd240f24707730d31	2026-02-08 07:16:27.877385+00	20260121155739_add_category_to_announcement	\N	\N	2026-02-08 07:16:27.875603+00	1
6573a051-efe0-44d3-8811-a0835c060dc5	a3f3391ebce873c85895f9836ba549f585367d357533d877d117e8c686b09b5c	2026-02-08 07:16:27.941113+00	20260125135911_restructure_participation_categories	\N	\N	2026-02-08 07:16:27.937183+00	1
9d93f8a5-398e-4e1a-baa1-45b13a9f9198	9252c0c08729d1f5d184b647ca52609d1fe4845d00c56d9844a3013e116a978e	2026-02-08 07:16:27.890979+00	20260121161239_add_partnership_models	\N	\N	2026-02-08 07:16:27.877633+00	1
337d6709-ec64-4329-a147-64628ac23c7f	77f88352751eb661d5f6dd46aa3909db37ce58181b4089e539c23d7feef4e4fa	2026-02-08 07:16:27.892196+00	20260123112457_add_onboarding_status	\N	\N	2026-02-08 07:16:27.891199+00	1
20cef448-1c40-4eb6-b231-fb35f294dcd0	90beca6584b6ee6603d3f9ecc0e76f526c4120768f4d5685c0dfe1850fedcce3	2026-02-08 07:16:27.90237+00	20260123144024_sync_schema_fixed	\N	\N	2026-02-08 07:16:27.892441+00	1
5c5a5a00-d7e1-4d1a-96ba-db8b15bb8433	5f676690540bb0fc0943968cd0b6c0b4a5174c14784fd14749ba81949b756f17	2026-02-08 07:16:27.961415+00	20260201183141_remove_partial_funded_category	\N	\N	2026-02-08 07:16:27.941331+00	1
40788638-eec3-4798-8889-33896744e975	e945631311745fceb5067eaca87f81081115f577c076925d624f3aa845f8c2b0	2026-02-08 07:16:27.903972+00	20260125082629_add_allow_categories	\N	\N	2026-02-08 07:16:27.902594+00	1
62401e05-10f6-4765-85f1-86df9a799ce5	610c0f0394f43e8604ca149fed78378cbdb0889c0c66eff9fb4bff14f35a73f1	2026-02-08 07:16:27.907978+00	20260125120218_add_program_essays	\N	\N	2026-02-08 07:16:27.904225+00	1
1bf669e0-e0aa-4e8c-b95b-f9b87797f261	9c558966baa2abb7324df4d9dffd95ea98b4858dd66b2eae8a13edc6a1ab2744	2026-02-08 07:16:27.92559+00	20260125130008_add_scoring_rubrics	\N	\N	2026-02-08 07:16:27.90823+00	1
4ddce842-4857-4c64-bb9a-c0597c45056e	51dec9f34103998d1a8cf8a31ca8ecb1a552865022dac8a0d823fa9506d7f0d3	2026-02-08 07:16:27.96519+00	20260202093400_rename_program_category_to_brand	\N	\N	2026-02-08 07:16:27.961701+00	1
12ed06b6-afb5-4a50-851c-8eb4f1086dd4	b2afdd96b03089276a6c7f4a6270e81f9d54a12bca33fc59aab03ad080a1cb75	2026-02-08 07:16:27.967782+00	20260202184246_add_pricing_tier_id	\N	\N	2026-02-08 07:16:27.965444+00	1
f7a7d831-8cf6-40b0-ba74-d8871aec36e8	bf1dcc297adf1ae03ca7c6b75d5e3f66e1a26b8f361e4d6c96d1164c2ec761b8	2026-02-08 07:16:27.973373+00	20260203044248_add_audit_logs	\N	\N	2026-02-08 07:16:27.968015+00	1
5a0f7b46-98b5-4bc9-ad66-2d659ff91a24	b9e2e27998c7cc9144648b7ecd304c5f5ec7a31c7bf7872ea2da4d74691bbb6b	\N	20260208000000_add_portal_performance_indexes	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20260208000000_add_portal_performance_indexes\n\nDatabase error code: 42P01\n\nDatabase error:\nERROR: relation "announcement_reads" does not exist\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42P01), message: "relation \\"announcement_reads\\" does not exist", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("namespace.c"), line: Some(433), routine: Some("RangeVarGetRelidExtended") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20260208000000_add_portal_performance_indexes"\n             at schema-engine/connectors/sql-schema-connector/src/apply_migration.rs:113\n   1: schema_commands::commands::apply_migrations::Applying migration\n           with migration_name="20260208000000_add_portal_performance_indexes"\n             at schema-engine/commands/src/commands/apply_migrations.rs:95\n   2: schema_core::state::ApplyMigrations\n             at schema-engine/core/src/state.rs:246	2026-02-08 09:04:57.050479+00	2026-02-08 09:03:53.413935+00	0
6e71dfd4-7365-4a50-a597-c6a4da8f5fc3	6460035c626c1867065142079f9ed26b7fd358ba19176821e5518bd58c9b7518	2026-02-08 09:04:57.051489+00	20260208000000_add_portal_performance_indexes		\N	2026-02-08 09:04:57.051489+00	0
\.


--
-- Data for Name: account_deletion_requests; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.account_deletion_requests (id, user_id, reason, reason_category, status, reviewed_by, reviewed_at, review_notes, scheduled_deletion_date, actual_deletion_date, data_snapshot, deletion_log, ip_address, user_agent, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: admin_brands; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.admin_brands (id, admin_id, brand_id, role_in_brand, permissions, assigned_at, assigned_by, legacy_id) FROM stdin;
\.


--
-- Data for Name: admin_programs; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.admin_programs (id, admin_id, program_id, role_in_program, permissions, assigned_at, assigned_by, removed_at, removed_by, legacy_id) FROM stdin;
\.


--
-- Data for Name: admin_roles; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.admin_roles (id, name, description, permissions, is_active, created_at, updated_at, legacy_id, deleted_at) FROM stdin;
d349ebac-0245-41d8-9cb1-58b45f276d4a	Super Admin	\N	["*"]	t	2026-02-08 07:16:30.999+00	2026-02-08 07:16:30.999+00	\N	\N
5ba540e1-8e34-41fe-aa37-15c4cbe05c4b	Admin	\N	["program:read", "program:write"]	t	2026-02-08 07:16:31.001+00	2026-02-08 07:16:31.001+00	\N	\N
6b728593-1c0f-4be8-a7c2-bf3402b501d8	Editor	\N	["content:write"]	t	2026-02-08 07:16:31.003+00	2026-02-08 07:16:31.003+00	\N	\N
67de74bb-288b-45e3-bec8-8a8c646f8b8e	Participant	\N	["application:read", "application:write"]	t	2026-02-08 07:16:31.006+00	2026-02-08 07:16:31.006+00	\N	\N
\.


--
-- Data for Name: admins; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.admins (id, user_id, full_name, phone_number, bio, avatar_url, employee_id, department, job_title, role_id, custom_permissions, access_level, can_manage_admins, can_assign_roles, timezone, locale, preferences, created_at, updated_at, activated_at, deactivated_at, last_active_at, deleted_at, created_by, deleted_by, legacy_id) FROM stdin;
6dfc58b2-2102-4a3d-b3fb-754e9c0fc2bc	bbad751b-4a31-426b-b7bb-667363380998	Super Admin	\N	\N	\N	\N	\N	\N	d349ebac-0245-41d8-9cb1-58b45f276d4a	[]	999	t	t	UTC	en	{}	2026-02-09 02:22:05.281+00	2026-02-09 02:22:05.281+00	\N	\N	\N	\N	\N	\N	\N
51cdc3ea-904c-42fa-b932-0f1805f8df1a	9b8ee528-e9ca-40d3-a391-2420c025b881	Program Manager	\N	\N	\N	\N	\N	\N	5ba540e1-8e34-41fe-aa37-15c4cbe05c4b	[]	500	f	f	UTC	en	{}	2026-02-09 02:22:05.289+00	2026-02-09 02:22:05.289+00	\N	\N	\N	\N	\N	\N	\N
34af60fc-2686-465f-a614-d362251ba56e	84e3505c-0dd4-4028-9828-d11b42ff20a4	Content Editor	\N	\N	\N	\N	\N	\N	6b728593-1c0f-4be8-a7c2-bf3402b501d8	[]	100	f	f	UTC	en	{}	2026-02-09 02:22:05.292+00	2026-02-09 02:22:05.292+00	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: ai_chatbot_configs; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.ai_chatbot_configs (id, brand_id, name, type, bot_config, is_active, display_on_web, allowed_domains, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: ambassador_referrals; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.ambassador_referrals (id, ambassador_id, participant_id, status, verified_at, verified_by, referred_at, registered_at, profile_completed_at, applied_at, accepted_at, completed_at, days_to_register, days_to_apply, days_to_accept, total_conversion_days, legacy_id, deleted_at) FROM stdin;
\.


--
-- Data for Name: ambassadors; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.ambassadors (id, user_id, full_name, phone_number, referral_code, program_id, institution, gender, total_referrals, successful_referrals, last_referral_at, first_successful_referral_at, notes, is_active, activated_at, deactivated_at, deactivation_reason, created_at, updated_at, deleted_at, deleted_by, legacy_id) FROM stdin;
\.


--
-- Data for Name: application_assessments; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.application_assessments (id, application_id, type, status, score, notes, feedback, assessor_id, assessed_at, created_at, updated_at) FROM stdin;
de76d301-3501-4308-aafa-7c900716b6eb	a2e199a2-b305-4cab-8ab1-13d067e9a132	document_review	completed	95.50	Excellent submission.	\N	\N	\N	2026-02-09 02:22:05.647+00	2026-02-09 02:22:05.647+00
\.


--
-- Data for Name: application_edit_history; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.application_edit_history (id, application_id, edited_by, reason, changes, created_at, snapshot) FROM stdin;
\.


--
-- Data for Name: application_form_fields; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.application_form_fields (id, program_id, section, label, name, type, placeholder, help_text, options, validation_rules, is_required, "order", is_active, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: application_invoices; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.application_invoices (id, application_id, pricing_tier_id, amount, currency, status, paid_at, external_transaction_id, payment_method, created_at, updated_at) FROM stdin;
dfe63922-426a-4e14-99d7-97693e1e34e3	a2e199a2-b305-4cab-8ab1-13d067e9a132	75d8ac15-fda6-4b74-99f7-8242d4f3b6e9	15.00	USD	paid	2026-02-09 02:22:05.651+00	TXN_93099	credit_card	2026-02-09 02:22:05.651+00	2026-02-09 02:22:05.651+00
\.


--
-- Data for Name: application_reviews; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.application_reviews (id, application_id, schema_id, reviewer_id, total_score, notes, status, started_at, completed_at) FROM stdin;
c4b4d280-71e9-46d9-be8c-3594e0941c9a	a2e199a2-b305-4cab-8ab1-13d067e9a132	36c81810-08cf-4db2-9c04-547b02a30933	6dfc58b2-2102-4a3d-b3fb-754e9c0fc2bc	95.40	Exceptional candidate. Strong alignment with SDGS.	submitted	2026-02-09 02:22:05.686+00	\N
\.


--
-- Data for Name: application_score_items; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.application_score_items (id, review_id, criterion_id, score, notes, legacy_id) FROM stdin;
73e11f53-cb4c-4474-8e96-361eb3266abc	c4b4d280-71e9-46d9-be8c-3594e0941c9a	9870eefe-0082-49d3-b5a8-594c9a8d76a0	95.00	Excellent point	\N
bfaa9bfc-a745-440d-8079-d1166654aa88	c4b4d280-71e9-46d9-be8c-3594e0941c9a	015778a7-e266-479c-8670-bb8711f73867	95.00	Excellent point	\N
1fc72c4f-e5cb-4bc3-bfbf-d52fdc90f96e	c4b4d280-71e9-46d9-be8c-3594e0941c9a	d48bfe7f-092c-45b8-8512-3480c7fc3689	95.00	Excellent point	\N
d8513b1d-2407-443d-85f0-3ac3465b961b	c4b4d280-71e9-46d9-be8c-3594e0941c9a	b65581a1-638a-47de-88f5-9a25c34ca27e	95.00	Excellent point	\N
2482c920-d08b-4011-abe2-aa430a4c8caf	c4b4d280-71e9-46d9-be8c-3594e0941c9a	9b93f297-f846-4c51-adc9-d00f7960006f	96.00	Very impressive background	\N
345a79de-cecc-4bf1-95e8-c9419b26d9ac	c4b4d280-71e9-46d9-be8c-3594e0941c9a	5a719c47-d159-4969-be57-e4f59b884b96	96.00	Very impressive background	\N
75f774b7-1808-43a8-82ce-f397c2db1a66	c4b4d280-71e9-46d9-be8c-3594e0941c9a	d1e6c8a3-54f8-4a3e-857e-a80eb4edaa7c	96.00	Very impressive background	\N
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.audit_logs (id, event, payload, entity_type, entity_id, actor_id, ip_address, user_agent, status, error_message, created_at) FROM stdin;
\.


--
-- Data for Name: auth_providers; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.auth_providers (id, name, display_name, description, client_id, client_secret, auth_url, token_url, scopes, is_active, is_oauth, icon, button_color, "order", created_at, updated_at, deleted_at) FROM stdin;
de282685-7a4e-48ad-bc56-c700d31b5719	local	Email & Password	Sign in with Email & Password	\N	\N	\N	\N	[]	t	f	email	#4A5568	1	2026-02-09 02:21:37.698+00	2026-02-09 02:21:37.698+00	\N
c24a20ab-33be-4737-927e-42671e4c1911	google	Google	Sign in with Google	\N	\N	\N	\N	[]	t	t	google	#4285F4	2	2026-02-09 02:21:37.711+00	2026-02-09 02:21:37.711+00	\N
0a8aeaf5-b226-4b97-ab7b-129d91cc38d6	facebook	Facebook	Sign in with Facebook	\N	\N	\N	\N	[]	t	t	facebook	#1877F2	3	2026-02-09 02:21:37.714+00	2026-02-09 02:21:37.714+00	\N
583cd1db-4f04-4675-a1c4-0656e42a18fa	apple	Apple	Sign in with Apple	\N	\N	\N	\N	[]	t	t	apple	#000000	4	2026-02-09 02:21:37.716+00	2026-02-09 02:21:37.716+00	\N
\.


--
-- Data for Name: brand_settings; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.brand_settings (id, brand_id, is_maintenance_mode, maintenance_message, maintenance_scheduled_end, footer_navigation, usd_in_idr, google_analytics_id, pixel_id, support_email, created_at, updated_at, deleted_at) FROM stdin;
b708ec5f-284e-4884-9772-8979c78a3e8e	1ea6d070-0b94-4867-b6d2-ae07169dae40	f	\N	\N	[]	16900.00	\N	\N	\N	2026-02-09 02:21:42.529+00	2026-02-09 02:21:42.529+00	\N
5fda408e-411d-494d-a41a-de0160a8c9d0	f5d5b61a-5eba-4eba-a3a0-d840c420a10a	f	\N	\N	[]	17500.00	\N	\N	\N	2026-02-09 02:21:42.538+00	2026-02-09 02:21:42.538+00	\N
019eaa6b-e814-487d-b720-294a386ddd28	b46695c9-e58b-45a4-a930-56822cb0d560	f	\N	\N	[]	16750.00	\N	\N	\N	2026-02-09 02:21:42.545+00	2026-02-09 02:21:42.545+00	\N
554cc693-114e-481e-9cfc-5a142c51f287	9b1a6ce7-58af-4fd1-9f30-7d0dfc8f662d	f	\N	\N	[]	17000.00	\N	\N	\N	2026-02-09 02:21:42.549+00	2026-02-09 02:21:42.549+00	\N
820ce773-b26b-48af-bfc1-051f262f3d91	8bf7988a-7822-4a36-94d8-4df9ebe12b8b	f	\N	\N	[]	16900.00	\N	\N	\N	2026-02-09 02:21:42.559+00	2026-02-09 02:21:42.559+00	\N
48b4cd67-974f-4b65-809c-1b6cfe455cfc	6cbd815c-7d2b-45c9-b45b-114088dc4f37	f	\N	\N	[]	16900.00	\N	\N	\N	2026-02-09 02:21:42.571+00	2026-02-09 02:21:42.571+00	\N
ed8a6b2a-ba88-4043-9d06-354682d9413c	9f3ef4a3-304b-440a-add6-e13d0f23172b	f	\N	\N	[]	15000.00	\N	\N	\N	2026-02-09 02:21:42.578+00	2026-02-09 02:21:42.578+00	\N
\.


--
-- Data for Name: brand_social_feeds; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.brand_social_feeds (id, brand_id, platform, post_id, image_url, permalink, caption, posted_at, is_active, created_at, deleted_at) FROM stdin;
e0c29555-e18e-47b6-bfce-ae80d215d911	b46695c9-e58b-45a4-a930-56822cb0d560	instagram	ig_001	https://placehold.co/400x400?text=IG+Post+1	https://instagram.com/p/123	Registration is now OPEN! #IYS2026	2026-02-09 02:22:05.196+00	t	2026-02-09 02:22:05.202+00	\N
5c7458df-c2c9-4e64-8ea3-c1d8bbe7e3d2	b46695c9-e58b-45a4-a930-56822cb0d560	instagram	ig_002	https://placehold.co/400x400?text=IG+Post+2	https://instagram.com/p/456	Highlights from last year. #IYS2025	2026-02-08 02:22:05.196+00	t	2026-02-09 02:22:05.202+00	\N
\.


--
-- Data for Name: brands; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.brands (id, name, description, slug, is_active, created_at, updated_at, deleted_at, legacy_id, website_url, about, vision, mission, logo_url, banner_url, primary_color, contact_email, contact_phone, contact_whatsapp, contact_address, social_media_links, default_location, default_country, default_timezone, require_email_verification, default_currency, enable_multi_currency, meta_title, meta_description, meta_keywords) FROM stdin;
b46695c9-e58b-45a4-a930-56822cb0d560	Istanbul Youth Summit	The Istanbul Youth Summit (IYS) is a premier international platform that empowers young leaders to address global challenges through innovation, collaboration, and transformative leadership. Organized by the Youth Break the Boundaries (YBB) Foundation, IYS cultivates a dynamic environment where youth gain the confidence, skills, and global outlook needed to become catalysts for change.\r\nMore than just a gathering, IYS is a space where ideas come to life. Through inspiring talks, interactive sessions, and meaningful group activities, participants are encouraged to explore new perspectives, grow as leaders, and connect with youth from around the world. The summit promotes open dialogue and practical learning in a supportive and inclusive setting.\r\nA highlight of the program is the Social Project Competition, which invites delegates to propose creative initiatives aimed at solving global issues or empowering their communities. It is an opportunity to turn ideas into action and make a lasting contribution with real impact.\r\nAt IYS, participants are not only learners but also active contributors. The summit offers opportunities for cultural exchange, collaboration, and lasting friendships among emerging leaders from different countries. With the support of experienced mentors and global peers, IYS helps shape a new generation ready to lead and inspire change across borders.	istanbul-youth-summit	t	2026-02-09 02:21:40.958+00	2026-02-09 02:21:40.958+00	\N	1	istanbulyouthsummit.com	<p class="ql-align-justify"><strong style="background-color: transparent; color: rgb(0, 0, 0);">The Istanbul Youth Summit (IYS)</strong><span style="background-color: transparent; color: rgb(0, 0, 0);"> is a premier international platform that empowers young leaders to address global challenges through innovation, collaboration, and transformative leadership. Organized by the Youth Break the Boundaries (YBB) Foundation, IYS cultivates a dynamic environment where youth gain the confidence, skills, and global outlook needed to become catalysts for change.</span></p><p class="ql-align-justify"><span style="background-color: transparent; color: rgb(0, 0, 0);">More than just a gathering, IYS is a space where ideas come to life. Through inspiring talks, interactive sessions, and meaningful group activities, participants are encouraged to explore new perspectives, grow as leaders, and connect with youth from around the world. The summit promotes open dialogue and practical learning in a supportive and inclusive setting.</span></p><p class="ql-align-justify"><span style="background-color: transparent; color: rgb(0, 0, 0);">A highlight of the program is </span><strong style="background-color: transparent; color: rgb(0, 0, 0);">the Social Project Competition</strong><span style="background-color: transparent; color: rgb(0, 0, 0);">, which invites delegates to propose creative initiatives aimed at solving global issues or empowering their communities. It is an opportunity to turn ideas into action and make a lasting contribution with real impact.</span></p><p class="ql-align-justify"><span style="background-color: transparent; color: rgb(0, 0, 0);">At IYS, participants are not only learners but also active contributors. The summit offers opportunities for cultural exchange, collaboration, and lasting friendships among emerging leaders from different countries. With the support of experienced mentors and global peers, IYS helps shape a new generation ready to lead and inspire change across borders.</span></p>	<p class="ql-align-justify"><span style="background-color: transparent; color: rgb(0, 0, 0);">The objectives of the Istanbul Youth Summit (IYS) are as follows:</span></p><p class="ql-align-justify"><br></p><ol><li><span style="background-color: transparent;">To cultivate a spirit of youth leadership and collaboration on a global scale.</span></li><li><span style="background-color: transparent;">To encourage innovative thinking and initiative-based learning among young participants.</span></li><li><span style="background-color: transparent;">To provide an inclusive platform where youth can present real-world solutions and engage in meaningful dialogue.</span></li><li><span style="background-color: transparent;">To establish a vibrant international network that supports ongoing youth empowerment.</span></li><li><span style="background-color: transparent;">To highlight the role of youth in shaping a more sustainable, inclusive, and equitable future.</span></li></ol><p><br></p>	<h3 class="ql-align-justify"><strong style="color: rgb(0, 0, 0); background-color: transparent;">Our Vision</strong></h3><p class="ql-align-justify"><span style="color: rgb(0, 0, 0); background-color: transparent;">To empower young people to become impactful contributors in addressing global challenges through leadership, collaboration, and innovation. Through the Istanbul Youth Summit, we aspire to create a dynamic environment where youth can explore ideas, grow their potential, and take part in shaping a more connected and solution-oriented global community.</span></p><h3 class="ql-align-justify"><strong style="color: rgb(0, 0, 0); background-color: transparent;">Our Missions</strong></h3><ol><li><span style="background-color: transparent;">To build the capacity of youth in leadership, communication, and critical thinking.</span></li><li><span style="background-color: transparent;">To strengthen international collaboration and cultural understanding among participants.</span></li><li><span style="background-color: transparent;">To provide a platform for youth to initiate and implement social projects that bring real impact.</span></li><li><span style="background-color: transparent;">To facilitate meaningful dialogue and experience-sharing between youth and global change-makers.</span></li><li><span style="background-color: transparent;">To establish sustainable networks that support long-term youth engagement and cooperation.</span></li></ol>	https://storage.ybbfoundation.com/program-categories/1/images/logo_1745006651.png	https://storage.ybbfoundation.com/program-categories/1/images/banner_1753707314.jpg	\N	istanbulyouthsummit@gmail.com	+6285173386622	\N	\N	{"instagram":"https://www.instagram.com/istanbulyouthsummit/","tiktok":"https://www.tiktok.com/@istanbulyouthsummit","youtube":"https://www.youtube.com/@ybbfoundation","telegram":"https://t.me/IYS2022Sponsorship"}	Istanbul, Turkiye	\N	\N	f	USD	f	Collaboration in Diversity	\N	\N
f5d5b61a-5eba-4eba-a3a0-d840c420a10a	World Youth Fest	The World Youth Festival (WYF) is an international program organized by Youth Break the Boundaries (YBB), dedicated to empowering young leaders to take an active role in shaping a sustainable future. As a prestigious global platform, WYF unites youth from diverse nations, cultures, and backgrounds under the spirit of “Unlock Your Full Potential.”\r\n\r\nAt the core of the program is the Global Sustainability Project Competition, where participants design and present innovative solutions that aim to create meaningful social impact. These projects are closely aligned with the United Nations Sustainable Development Goals (SDGs), with a primary focus on SDG 3 (Good Health & Well-being), SDG 4 (Quality Education), SDG 8 (Decent Work & Economic Growth), and SDG 13 (Climate Action).\r\n\r\nDelegates are assigned to multicultural teams based on their selected SDG, ensuring that each group reflects the richness of international perspectives. Through this collaborative process, participants strengthen essential leadership capacities, including critical thinking, problem-solving, communication, and teamwork.\r\n\r\nThe program also provides recognition and visibility for outstanding ideas, with awards presented to the most impactful projects demonstrating innovation, feasibility, and long-term potential. More than a competition, WYF offers a transformative experience where young people gain the confidence and skills to #LeadTheFuture within their communities and beyond.	world-youth-fest	t	2026-02-09 02:21:40.97+00	2026-02-09 02:21:40.97+00	\N	2	worldyouthfest.com	<p><strong style="color: rgba(0,0,0,var(--O42jJQ,1));">The World Youth Festival (WYF)</strong><span style="color: rgba(0,0,0,var(--O42jJQ,1));"> </span><strong style="color: rgba(0,0,0,var(--O42jJQ,1));">#Chapter Vietnam</strong><span style="color: rgba(0,0,0,var(--O42jJQ,1));"> is an international program organized by </span><strong style="color: rgba(0,0,0,var(--O42jJQ,1));">Youth Break the Boundaries (YBB)</strong><span style="color: rgba(0,0,0,var(--O42jJQ,1));">, dedicated to empowering young leaders to take an active role in shaping a sustainable future. As a prestigious global platform, WYF unites youth from diverse nations, cultures, and backgrounds under the spirit of </span><strong style="color: rgba(0,0,0,var(--O42jJQ,1));">“Unlock Your Full Potential.”</strong></p><p><span style="color: rgba(0,0,0,var(--O42jJQ,1));">At the core of the program is the </span><strong style="color: rgba(0,0,0,var(--O42jJQ,1));">Global Sustainability Project Competition</strong><span style="color: rgba(0,0,0,var(--O42jJQ,1));">, where participants design and present innovative solutions that aim to create meaningful social impact. These projects are closely aligned with the United Nations Sustainable Development Goals (SDGs), with a primary focus on </span><strong style="color: rgb(0, 138, 0);">SDG 3 (Good Health &amp; Well-being)</strong><strong style="color: rgba(0,0,0,var(--O42jJQ,1));">, </strong><strong style="color: rgb(230, 0, 0);">SDG 4 (Quality Education)</strong><strong style="color: rgba(0,0,0,var(--O42jJQ,1));">, </strong><strong style="color: rgb(102, 185, 102);">SDG 8 (Decent Work &amp; Economic Growth)</strong><strong style="color: rgba(0,0,0,var(--O42jJQ,1));">, and </strong><strong style="color: rgb(161, 0, 0);">SDG 13 (Climate Action)</strong><strong style="color: rgba(0,0,0,var(--O42jJQ,1));">.</strong></p><p><strong style="color: rgba(0,0,0,var(--O42jJQ,1));">Delegates are assigned to multicultural teams based on their selected SDG</strong><span style="color: rgba(0,0,0,var(--O42jJQ,1));">, ensuring that each group reflects the richness of international perspectives. Through this collaborative process, participants strengthen essential leadership capacities, including critical thinking, problem-solving, communication, and teamwork.</span></p><p><span style="color: rgba(0,0,0,var(--O42jJQ,1));">The program also provides recognition and visibility for outstanding ideas, with awards presented to the most impactful projects demonstrating innovation, feasibility, and long-term potential. More than a competition, WYF offers a transformative experience where young people gain the confidence and skills to </span><strong style="color: rgba(0,0,0,var(--O42jJQ,1));">#LeadTheFuture</strong><span style="color: rgba(0,0,0,var(--O42jJQ,1));"> within their communities and beyond.</span></p>	<h3><strong>World Youth Festival Objectives</strong></h3><ul><li class="ql-align-justify"><strong style="color: rgb(0, 0, 0); background-color: transparent;">Empower Youth Leadership</strong></li></ul><p class="ql-align-justify"><span style="color: rgb(0, 0, 0); background-color: transparent;">Strengthen the capacity of young people as future leaders through exposure to global issues and collaborative problem-solving.</span></p><ul><li class="ql-align-justify"><strong style="color: rgb(0, 0, 0); background-color: transparent;">Promote Collaboration in Diversity</strong></li></ul><p class="ql-align-justify"><span style="color: rgb(0, 0, 0); background-color: transparent;">Foster mutual understanding and cross-cultural cooperation among youth from diverse nations and backgrounds.</span></p><ul><li class="ql-align-justify"><strong style="color: rgb(0, 0, 0); background-color: transparent;">Support the UN Sustainable Development Goals (SDGs)</strong></li></ul><p class="ql-align-justify"><span style="color: rgb(0, 0, 0); background-color: transparent;">Provide a platform where youth can design and implement impactful projects aligned with global sustainability goals.</span></p><ul><li class="ql-align-justify"><strong style="color: rgb(0, 0, 0); background-color: transparent;">Enhance Critical and Creative Thinking Skills</strong></li></ul><p class="ql-align-justify"><span style="color: rgb(0, 0, 0); background-color: transparent;">Encourage innovative solutions while developing participants’ communication and problem-solving abilities.</span></p><ul><li class="ql-align-justify"><strong style="color: rgb(0, 0, 0); background-color: transparent;">Encourage Social Project Implementation</strong></li></ul><p class="ql-align-justify"><span style="color: rgb(0, 0, 0); background-color: transparent;">Transform ideas into actionable social initiatives with recognition and awards for excellence.</span></p><ul><li class="ql-align-justify"><strong style="color: rgb(0, 0, 0); background-color: transparent;">Build Global Networks and Partnerships</strong></li></ul><p class="ql-align-justify"><span style="color: rgb(0, 0, 0); background-color: transparent;">Connect young leaders with peers, mentors, and organizations to establish long-term collaborations.</span></p><ul><li class="ql-align-justify"><strong style="color: rgb(0, 0, 0); background-color: transparent;">Recognize Outstanding Contributions</strong></li></ul><p class="ql-align-justify"><span style="color: rgb(0, 0, 0); background-color: transparent;">Celebrate youth who excel in leadership, innovation, and collaboration through the Social Project Competition.</span></p><ul><li class="ql-align-justify"><strong style="color: rgb(0, 0, 0); background-color: transparent;">Support Career and Academic Development</strong></li></ul><p class="ql-align-justify"><span style="color: rgb(0, 0, 0); background-color: transparent;">Provide international exposure, certificates, and achievements that strengthen participants’ academic portfolios, scholarship applications, and career opportunities.</span></p><p><br></p>	<h2>OUR VISION</h2><p class="ql-align-justify"><span style="background-color: transparent; color: rgb(0, 0, 0);">Empowering a global movement of young leaders to strengthen their capacities, drive transformative solutions, and lead collective action for a sustainable, inclusive, and resilient world.</span></p><p><br></p><h2>OUR MISSION</h2><ul><li class="ql-align-justify"><span style="background-color: transparent;">Inspire youth leadership by nurturing purpose-driven, ethical, and forward-thinking young leaders committed to global sustainability.</span></li><li class="ql-align-justify"><span style="background-color: transparent;">Empower innovation for impact through youth-led sustainability projects aligned with the United Nations Sustainable Development Goals.</span></li><li class="ql-align-justify"><span style="background-color: transparent;">Connect global voices by uniting diverse young leaders across cultures and nations to collaborate, learn, and co-create solutions beyond borders.</span></li><li class="ql-align-justify"><span style="background-color: transparent;">Cultivate future-ready changemakers by strengthening critical thinking, creativity, collaboration, and leadership through experiential and project-based learning.</span></li><li class="ql-align-justify"><span style="background-color: transparent;">﻿Accelerate sustainable change by equipping youth with the confidence, skills, and networks to lead meaningful impact within their communities and the world.</span></li></ul>	https://storage.ybbfoundation.com/logo/WYF.png	https://storage.ybbfoundation.com/program-categories/2/images/banner_1769996945.webp	\N	ybb.worldyouthfest@gmail.com	+6285173386622	\N	\N	{"instagram":"https://www.instagram.com/worldyouthfestival/","tiktok":"https://www.tiktok.com/@worldyouthfestival","youtube":"https://www.youtube.com/@ybbfoundation","telegram":"https://t.me/worldyouthfestival"}	Hanoi, Vietnam	\N	\N	f	USD	f	Unlock Your Full Potential	\N	\N
8bf7988a-7822-4a36-94d8-4df9ebe12b8b	Middle East Youth Summit	The Middle East Youth Summit (MEYS), initiated by Youth Break the Boundaries (YBB), is a transformative platform designed to empower emerging Muslim youth leaders through character development, ethical leadership, and global cultural exchange. More than just an event, MEYS serves as a dynamic space for young changemakers to share their experiences, explore initiatives to empower the Muslim community, and build strong international networks rooted in shared values.\r\n\r\nThrough a series of capacity-building programs, collaborative forums, and leadership workshops, MEYS encourages participants to develop innovative solutions for the challenges faced by Muslim societies today. It aims to strengthen youth agency in advancing education, social innovation, and community development within an Islamic ethical framework.\r\n\r\nParticipants will also experience the richness of Islamic moral values by learning about key moments in Islamic history and heritage. From the Golden Age of Islamic civilization to the cultural legacies of the Middle East, MEYS offers deep insights that inspire a sense of pride, purpose, and unity among young Muslims committed to a better future.	middle-east-youth-summit	t	2026-02-09 02:21:40.975+00	2026-02-09 02:21:40.975+00	\N	3	middleeastyouthsummit.com	<p>The Middle East Youth Summit (MEYS), initiated by Youth Break the Boundaries (YBB), is a transformative platform designed to empower emerging Muslim youth leaders through <strong>character development, ethical leadership, </strong>and<strong> global cultural exchange.</strong> More than just an event, MEYS serves as a dynamic space for young changemakers to share their experiences, explore initiatives to empower the Muslim community, and build strong international networks rooted in shared values.</p><p><br></p><p>Through a series of capacity-building programs, collaborative forums, and leadership workshops, MEYS encourages participants to develop innovative solutions for the challenges faced by Muslim societies today. It aims to <strong style="color: rgb(0, 102, 204);">strengthen youth agency in advancing education, social innovation, and community development within an Islamic ethical framework.</strong></p><p><br></p><p>Participants will also experience the richness of Islamic moral values by learning about key moments in Islamic history and heritage. From the Golden Age of Islamic civilization to the cultural legacies of the Middle East, MEYS offers deep insights that inspire a sense of pride, purpose, and unity among young Muslims committed to a better future.</p>	<p class="ql-align-justify"><strong style="background-color: transparent; color: rgb(0, 0, 0);">MEYS Objectives</strong></p><p><br></p><p class="ql-align-justify"><span style="background-color: transparent; color: rgb(0, 0, 0);">The objectives of the Middle East Youth Summit (MEYS) are as follows:</span></p><p><br></p><ol><li class="ql-align-justify"><span style="background-color: transparent;">To connect young Muslim leaders globally to promote unity and cultural exchange.</span></li><li class="ql-align-justify"><span style="background-color: transparent;">To strengthen Islamic values through meaningful spiritual and leadership experiences.</span></li><li class="ql-align-justify"><span style="background-color: transparent;">To equip youth with leadership skills to drive positive change in the communities.</span></li><li class="ql-align-justify"><span style="background-color: transparent;">To support Muslim community development through education, innovation, and collaboration.</span></li><li class="ql-align-justify"><span style="background-color: transparent;">To build a strong global network of youth committed to continuous growth and impact.</span></li></ol>	<p class="ql-align-justify"><strong style="background-color: transparent; color: rgb(0, 0, 0);">Our Vision</strong></p><p><br></p><p class="ql-align-justify"><span style="background-color: transparent; color: rgb(0, 0, 0);">To cultivate a generation of young Muslim leaders with strong spiritual, intellectual, and emotional integrity who are equipped to unlock their potential, respond to global challenges, and contribute meaningfully to the development of their communities and the ummah.</span></p><p><br></p><p class="ql-align-justify"><strong style="background-color: transparent; color: rgb(0, 0, 0);">Our Mission</strong></p><p><br></p><ol><li class="ql-align-justify"><span style="background-color: transparent;">To enhance the professionalism, competence, and resilience of youth through continuous personal growth and leadership development.</span></li><li class="ql-align-justify"><span style="background-color: transparent;">To optimize the potential of the youth by cultivating impactful collaborations and fostering a deep sense of social responsibility.</span></li><li class="ql-align-justify"><span style="background-color: transparent;">To promote self-reliance and values-based living, while preparing youth cadres to lead and contribute meaningfully within their communities.</span></li><li class="ql-align-justify"><span style="background-color: transparent;">To strengthen the role of youth as visionary leaders and active contributors to the advancement of society and Islamic civilization.</span></li></ol><p><br></p>	https://storage.ybbfoundation.com/logo/MEYS.png	https://storage.ybbfoundation.com/program-categories/3/images/banner_1763819952.jpg	\N	middleeastyouthsummit@gmail.com	+6285714936778	\N	\N	{"instagram":"https://www.instagram.com/meysummit/","tiktok":"https://www.tiktok.com/@middleeastyouthsummit","youtube":"https://www.youtube.com/@ybbfoundation","telegram":"https://t.me/middleeastyouthsummit"}	Makkah, Saudi Arabia	\N	\N	f	USD	f	Together for Ummah	\N	\N
1ea6d070-0b94-4867-b6d2-ae07169dae40	Korea Youth Summit	KOREA YOUTH SUMMIT\r\nThe Korea Youth Summit (KYS) is an inspiring international gathering that brings together young changemakers to explore the power of culture in shaping inclusive, creative, and resilient societies. Organized by the Youth Break the Boundaries (YBB) Foundation, KYS places youth at the heart of cultural preservation and innovation, celebrating Korea’s global reputation as a vibrant cultural hub.\r\nCarrying the tagline “Living Culture, Lasting Legacy,” the summit fosters deep reflection and action on how tradition and modernity can coexist. Through insightful sessions, cultural immersion, and collaborative learning, participants are encouraged to rethink the role of youth in preserving heritage, reimagining identity, and fostering intercultural understanding.\r\nA signature element of the summit is the Cultural Project Competition, where delegates propose creative solutions and campaigns to preserve, celebrate, and innovate around local and global cultural values. These youth-led initiatives aim to address real-world cultural challenges while promoting diversity and unity.\r\nKYS is more than an event. It's a movement that empowers young people to be cultural ambassadors, innovators, and protectors of legacy. By building bridges across nations and traditions, the summit provides an immersive platform for dialogue, learning, and collaboration among future leaders committed to making culture a force for positive change.	korea-youth-summit	t	2026-02-09 02:21:40.981+00	2026-02-09 02:21:40.981+00	\N	4	koreayouthsummit.com	<p class="ql-align-center"><strong style="color: rgb(0, 0, 0); background-color: transparent;">KOREA YOUTH SUMMIT</strong></p><p class="ql-align-justify"><strong style="color: rgb(0, 0, 0); background-color: transparent;">The Korea Youth Summit (KYS)</strong><span style="color: rgb(0, 0, 0); background-color: transparent;"> is an inspiring international gathering that brings together young changemakers to explore the power of culture in shaping inclusive, creative, and resilient societies. Organized by the Youth Break the Boundaries (YBB) Foundation, KYS places youth at the heart of cultural preservation and innovation, celebrating Korea’s global reputation as a vibrant cultural hub.</span></p><p class="ql-align-justify"><span style="color: rgb(0, 0, 0); background-color: transparent;">Carrying the tagline “Living Culture, Lasting Legacy,” the summit fosters deep reflection and action on how tradition and modernity can coexist. Through insightful sessions, cultural immersion, and collaborative learning, participants are encouraged to rethink the role of youth in preserving heritage, reimagining identity, and fostering intercultural understanding.</span></p><p class="ql-align-justify"><span style="color: rgb(0, 0, 0); background-color: transparent;">A signature element of the summit is </span><strong style="color: rgb(0, 0, 0); background-color: transparent;">the Cultural Project Competition, where delegates propose creative solutions and campaigns to preserve, celebrate, and innovate around local and global cultural values.</strong><span style="color: rgb(0, 0, 0); background-color: transparent;"> These youth-led initiatives aim to address real-world cultural challenges while promoting diversity and unity.</span></p><p><span style="color: rgb(0, 0, 0); background-color: transparent;">KYS is more than an event. It's a movement that </span><strong style="color: rgb(0, 0, 0); background-color: transparent;">empowers young people to be cultural ambassadors, innovators, and protectors of legacy.</strong><span style="color: rgb(0, 0, 0); background-color: transparent;"> By building bridges across nations and traditions, the summit provides an immersive platform for dialogue, learning, and collaboration among future leaders committed to making culture a force for positive change.</span></p>	<p class="ql-align-justify"><strong style="color: rgb(0, 0, 0);">The objectives of the Korea Youth Summit (KYS) are as follows:</strong></p><p class="ql-align-justify"><br></p><ol><li>Empowering youth to lead in sustainability and cultural innovation.</li><li>Strengthening leadership skills and character development.</li><li>Providing a platform for youth voices on global issues.</li><li>Equipping participants to contribute to national and global progress.</li><li>Building a global network of young leaders for ongoing collaboration, particularly among Youth Break the Boundaries alumni.</li></ol>	<p class="ql-align-center"><strong style="color: rgb(0, 0, 0);">OUR VISION&nbsp;&nbsp;</strong></p><p class="ql-align-justify"><span style="color: rgb(0, 0, 0);">Inspiring young leaders to create innovative solutions that harmonize sustainability with the preservation and celebration of cultural heritage. By fostering creativity and collaboration, the program empowers participants to drive meaningful change in their communities.</span></p><p><br></p><p class="ql-align-center"><strong style="color: rgb(0, 0, 0); background-color: transparent;">OUR MISSION&nbsp;</strong></p><p class="ql-align-justify"><strong style="color: rgb(0, 0, 0); background-color: transparent;">The Missions of the Korea Youth Summit (KYS include:</strong></p><ol><li><span style="background-color: transparent;">Empowering young leaders through cultural exchange and sustainable innovation.</span></li><li><span style="background-color: transparent;">Inspiring youth to harmonize traditional heritage with modern solutions for global challenges.</span></li><li><span style="background-color: transparent;">Cultivating collaboration and mutual respect among diverse participants.</span></li><li><span style="background-color: transparent;">Equipping participants with skills and knowledge for impactful community change.</span></li><li><span style="background-color: transparent;">Building a global network of youth committed to inclusive and sustainable development.</span></li></ol>	https://storage.ybbfoundation.com/logo/KYS.png	https://storage.ybbfoundation.com/program-categories/4/images/banner_1745046040.png	\N	koreayouthsummit@gmail.com	+6285173386622	\N	\N	{"instagram":"https://www.instagram.com/koreayouthsummit/","tiktok":"https://www.tiktok.com/@koreayouthsummit","youtube":"https://www.youtube.com/@ybbfoundation","telegram":"https://t.me/koreayouthsummit"}	Seoul, South Korea	\N	\N	f	USD	f	LIVING CULTURE, LASTING LEGACY 	\N	\N
9b1a6ce7-58af-4fd1-9f30-7d0dfc8f662d	Youth Academic Forum	The Youth Academic Forum, an initiative of Youth Break the Boundaries (YBB), stands as a dynamic and inclusive platform designed to elevate and empower the young research community. With a steadfast commitment to promoting original, objective, and credible research, the forum provides accessible pathways for young researchers to publish and present their work on a global stage.\r\nMore than just a publication platform, the Youth Academic Forum is a hub of intellectual exchange, where emerging scholars, practitioners, and change-makers collaborate, learn, and grow. We believe that meaningful research should not remain confined to academic institutions but should inform real-world progress, policy, and innovation.\r\nThrough strategic partnerships with academic institutions, journals, and research networks, we aim to encourage more publications and build a strong culture of scientific contribution among youth. By supporting the dissemination of diverse perspectives and solutions, we strive to ensure that the ideas of this generation shape a more informed and equitable future.	youth-academic-forum	t	2026-02-09 02:21:40.99+00	2026-02-09 02:21:40.99+00	\N	5	youthacademicforum.com	<p class="ql-align-justify"><span style="color: rgb(0, 0, 0);">The </span><strong style="color: rgb(0, 0, 0);">Youth Academic Forum</strong><span style="color: rgb(0, 0, 0);">, an initiative of </span><strong style="color: rgb(0, 0, 0);">Youth Break the Boundaries (YBB)</strong><span style="color: rgb(0, 0, 0);">, stands as a dynamic and inclusive platform designed to elevate and empower the </span><strong style="color: rgb(0, 0, 0);">young research community</strong><span style="color: rgb(0, 0, 0);">. With a steadfast commitment to promoting </span><strong style="color: rgb(0, 0, 0);">original, objective, and credible research</strong><span style="color: rgb(0, 0, 0);">, the forum provides accessible pathways for young researchers to publish and present their work on a global stage.</span></p><p class="ql-align-justify"><span style="color: rgb(0, 0, 0);">More than just a publication platform, the Youth Academic Forum is a </span><strong style="color: rgb(0, 102, 204);">hub of intellectual exchange</strong><span style="color: rgb(0, 102, 204);">,</span><span style="color: rgb(0, 0, 0);"> where emerging scholars, practitioners, and change-makers collaborate, learn, and grow. We believe that meaningful research should not remain confined to academic institutions but should inform real-world progress, policy, and innovation.</span></p><p class="ql-align-justify"><span style="color: rgb(0, 0, 0);">Through strategic partnerships with academic institutions, journals, and research networks, we aim to encourage more publications and build a strong culture of scientific contribution among youth. By supporting the dissemination of diverse perspectives and solutions, we strive to ensure that the ideas of this generation shape a more informed and equitable future.</span></p><p><strong style="background-color: transparent; color: rgb(0, 0, 0);">This Program is Highly Recommended For:</strong></p><ol><li><span style="background-color: transparent;">Young Researchers and Academics</span></li><li><span style="background-color: transparent;">University Students and Recent Graduates</span></li><li><span style="background-color: transparent;">Emerging Scholars in Various Fields</span></li><li><span style="background-color: transparent;">Young Professionals with Research Interest</span></li><li><span style="background-color: transparent;">Youth Leaders and Social Innovators</span></li><li><span style="background-color: transparent;">Educators and Policy Enthusiasts</span></li><li><span style="background-color: transparent;">Aspiring Entrepreneurs and Change-makers</span></li></ol><p class="ql-align-justify"><br></p><p><br></p><p><br></p>	<p><strong style="color: rgb(0, 0, 0);">Objectives of the Youth Academic Forum Program</strong></p><p><span style="color: rgb(0, 0, 0);">The Youth Academic Forum aims to:</span></p><ol><li><strong>Build an inclusive research platform</strong> that supports youth in publishing credible, multidisciplinary studies.</li><li><strong>Encourage innovation and critical thinking</strong> through research that addresses real-world challenges.</li><li><strong>Promote global academic exchange</strong> by facilitating youth-led publications and international collaboration.</li><li><strong>Support the growth of young scholars</strong> through accessible academic resources and mentoring.</li><li><strong style="color: rgb(0, 0, 0);">Bridge research and impact</strong><span style="color: rgb(0, 0, 0);"> by connecting youth ideas with broader communities and policy discourse.</span></li></ol><p><br></p>	<p class="ql-align-justify"><strong style="color: rgb(0, 0, 0);">Vision and Mission of Youth Academic Forum</strong></p><p class="ql-align-justify"><strong style="color: rgb(0, 0, 0);">Vision</strong></p><p class="ql-align-justify"><span style="color: rgb(0, 0, 0);">To become </span><strong style="color: rgb(0, 102, 204);">a leading independent research platform that fosters excellence in research, publication, and academic support services</strong><span style="color: rgb(0, 0, 0);">—dedicated to global youth and committed to cultivating a culture of intellectual advancement across the world.</span></p><p class="ql-align-justify"><strong style="color: rgb(0, 0, 0);">Mission</strong></p><ol><li>To support and empower youth in conducting and publishing quality research.</li><li>To promote practical and innovative studies in social sciences, humanities, and related fields.</li><li>To offer accessible services in research, publication, and educational support.</li><li>To share youth-driven research widely for greater impact and global collaboration.</li></ol><h5 class="ql-align-justify"><br></h5>	https://storage.ybbfoundation.com/logo/YAF.png	https://storage.ybbfoundation.com/program-categories/5/images/banner_1749469446.jpg	\N	youthacademicforum@gmail.com	+6285173386622	\N	\N	{"instagram":"","tiktok":"","youtube":"https://www.youtube.com/@ybbfoundation","telegram":"ac"}	Bangkok, Thailand	\N	\N	f	USD	f	Research Beyond Borders	\N	\N
6cbd815c-7d2b-45c9-b45b-114088dc4f37	Japan Youth Summit	\tJapan Youth Summit, organized by the Youth Break the Boundaries (YBB) Foundation, is an international innovation competition and youth summit that aims to inspire emerging leaders to push the limits of their potential, come together, and implement strategies under the main theme of “Innovation Beyond Borders: Building the Future through Collaboration.” The summit promotes collaboration among diverse young people from various fields to harness their leadership skills in working toward achieving sustainable development goals. The Sustainable Development Goals (SDGs) are a set of goals that serve as a guide for countries worldwide in their development effort, replacing the Millennium Development Goals (MDGs) that concluded in 2015. The SDGs encompass a range of areas, including Education (SDG 4), Economy (SDG 8), Industry, Innovation, and Infrastructure (SDG 9), Sustainable Cities and Communities (SDG 11), as well as Climate Action (SDG 13).	japan-youth-summit	t	2026-02-09 02:21:40.994+00	2026-02-09 02:21:40.994+00	\N	6	japanyouthsummit.com	<p><strong style="color: rgb(0, 0, 0); background-color: transparent;">Japan Youth Summit (JYS)</strong><span style="color: rgb(0, 0, 0); background-color: transparent;"> is an international program organized by </span><strong style="color: rgb(0, 0, 0); background-color: transparent;">Youth Break the Boundaries (YBB)</strong><span style="color: rgb(0, 0, 0); background-color: transparent;">, dedicated to empowering young leaders to take an active role in shaping a sustainable future. As a prestigious platform, JYS brings together youth from across nations, cultures, and backgrounds under the spirit of </span><strong style="color: rgb(0, 0, 0); background-color: transparent;">“Innovate for Tomorrow.”</strong></p><p><span style="color: rgb(0, 0, 0); background-color: transparent;">At the heart of the summit lies the </span><strong style="color: rgb(0, 0, 0); background-color: transparent;">Social Project Competition</strong><span style="color: rgb(0, 0, 0); background-color: transparent;">, where participants design and present innovative projects that aim to create real social impact. These projects are directly connected to the </span><strong style="color: rgb(0, 0, 0); background-color: transparent;">United Nations Sustainable Development Goals (SDGs)</strong><span style="color: rgb(0, 0, 0); background-color: transparent;">, with a primary focus on </span><strong style="color: rgb(0, 0, 0); background-color: transparent;">SDG 4 (Quality of Education), SDG 8 (Inclusive Economic Development), SDG 9 (Industry, Innovation, and Infrastructure), SDG 11 (Sustainable Cities and Communities), SDG 13 (Climate Change).</strong></p><p class="ql-align-justify"><br></p><p class="ql-align-justify"><strong style="color: rgb(0, 0, 0); background-color: transparent;">﻿With the 2026 theme, “Innovation Beyond Borders: Building the Future through Collaboration” </strong><span style="color: rgb(0, 0, 0); background-color: transparent;">JYS continues its mission of nurturing young changemakers, celebrating diversity, and building global networks that transcend borders.</span></p><p><br></p><p><br></p><p><br></p>	<p class="ql-align-justify"><strong style="background-color: transparent; color: rgb(0, 0, 0);">The Japan Youth Summit program is held to achieve the following objectives:</strong></p><ol><li class="ql-align-justify"><span style="background-color: transparent;">Build the character of youth leadership.</span></li><li class="ql-align-justify"><span style="background-color: transparent;">Build the confidence of the youth through competition.</span></li><li class="ql-align-justify"><span style="background-color: transparent;">Sharpen up the ability to see and take advantage of opportunities.</span></li><li class="ql-align-justify"><span style="background-color: transparent;">Build the existence of the youth at the international level.</span></li><li class="ql-align-justify"><span style="background-color: transparent;">Train the spirit of collaboration to actively contribute to building the country.</span></li><li class="ql-align-justify"><span style="background-color: transparent;">Create a robust network and lasting connections among YBB alumni to ensure the continuity of the program for years to come.</span></li></ol><p><br></p>	<p class="ql-align-justify"><strong style="color: rgb(19, 19, 30);">JAPAN YOUTH SUMMIT VISION</strong></p><p class="ql-align-justify"><span style="color: rgb(0, 0, 0);">Inspiring young leaders to create innovative solutions that harmonize sustainability with the preservation and celebration of cultural heritage. By fostering creativity and collaboration, the program empowers participants to drive meaningful change in their communities.</span></p><p><br></p><p class="ql-align-justify"><strong style="color: rgb(19, 19, 30);">JAPAN YOUTH SUMMIT MISSION</strong></p><ol><li class="ql-align-justify"><strong>Elevate</strong> the professionalism, capabilities, and reliability of humans.</li><li class="ql-align-justify"><strong>Empower</strong> youth to understand and fulfill their roles as the spearhead of national development.</li><li class="ql-align-justify"><strong>Cultivate</strong> a sense of responsibility and leadership among young individuals to actively contribute to the development of their nations.</li><li class="ql-align-justify"><strong>Foster</strong> agility among youth to effectively respond to future challenges.</li></ol><p><br></p>	https://storage.ybbfoundation.com/logo/jys.png	https://storage.ybbfoundation.com/program-categories/6/images/banner_1745045216.jpg	\N	japanyouthsummit@gmail.com	+6285173386622	\N	\N	{"instagram":"https://www.instagram.com/japanyouthsummitofficial","tiktok":"https://www.tiktok.com/@japanyouthsummitofficial","youtube":"https://www.youtube.com/@ybbfoundation","telegram":"https://t.me/japanyouthsummit"}	Osaka, Japan	\N	\N	f	USD	f	Innovate for Tomorrow	\N	\N
9f3ef4a3-304b-440a-add6-e13d0f23172b	Vietnam Youth Summit	The Vietnam Youth Summit (VYS) is a transformative international platform that unites young leaders from across Southeast Asia and beyond to address regional and global challenges through innovation, cultural exchange, and collaborative leadership. Organized by the Youth Break the Boundaries (YBB) Foundation, VYS creates an inspiring environment where participants develop the skills, networks, and vision needed to drive positive change in their communities and beyond.\n\nMore than just a gathering, VYS is a catalyst for meaningful dialogue and action. Through engaging workshops, cultural immersion experiences, and innovative project competitions, participants explore Vietnamese heritage while tackling contemporary issues facing the region. The summit emphasizes the rich cultural diversity of Southeast Asia as a foundation for building stronger, more connected communities.\n\nA signature component of VYS is the Innovation for Impact Competition, where delegates propose creative solutions to challenges facing Vietnam and the broader Southeast Asian region. This platform transforms ideas into actionable initiatives with real potential for community transformation.\n\nAt VYS, participants become part of a growing network of young changemakers committed to fostering understanding, collaboration, and sustainable development across cultural and national boundaries. With support from experienced mentors and cultural ambassadors, VYS shapes a new generation of leaders ready to bridge cultures and create lasting positive impact throughout Southeast Asia and beyond.	vietnam-youth-summit	t	2026-02-09 02:21:40.999+00	2026-02-09 02:21:40.999+00	\N	10	https://vietnamyouthsummit.ybbfoundation.com	The Vietnam Youth Summit celebrates the vibrant spirit of Vietnamese culture while addressing the dynamic challenges and opportunities facing Southeast Asia in the 21st century. Set against the backdrop of Vietnam's remarkable economic growth and cultural renaissance, VYS provides an immersive platform for young leaders to explore how tradition and modernity can work together to create sustainable solutions.\n\nVietnam's strategic position as a bridge between East and West, combined with its young and entrepreneurial population, makes it an ideal setting for fostering innovative thinking and cross-cultural collaboration. The summit leverages Vietnam's rich history of resilience and adaptation to inspire participants to develop creative approaches to regional and global challenges.\n\nThrough authentic cultural experiences, from exploring ancient temples to engaging with modern startups in Ho Chi Minh City and Hanoi, participants gain deep insights into how Vietnamese society has successfully navigated rapid transformation while preserving its cultural identity. These experiences serve as powerful examples for other developing nations and provide valuable lessons in sustainable development and cultural preservation.	Foster regional understanding and cooperation among Southeast Asian youth â€¢ Promote Vietnamese culture as a bridge for international collaboration â€¢ Develop innovative solutions for regional challenges â€¢ Build lasting networks of young leaders across ASEAN nations â€¢ Encourage sustainable development practices rooted in cultural wisdom	Cultural Heritage & Innovation â€¢ Cross-Cultural Collaboration â€¢ Sustainable Development â€¢ Youth Empowerment â€¢ Regional Integration	\N	\N	\N	vys@ybbfoundation.com	+84 123-456-789	\N	\N	{"instagram":"https://instagram.com/vietnamyouthsummit","tiktok":"https://tiktok.com/@vietnamyouthsummit","youtube":"https://youtube.com/@vietnamyouthsummit","telegram":"https://t.me/vietnamyouthsummit"}	Ho Chi Minh City & Hanoi, Vietnam	\N	\N	t	USD	f	Heritage Meets Innovation: Building Bridges Across Southeast Asia	\N	\N
\.


--
-- Data for Name: certificate_templates; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.certificate_templates (id, program_id, name, template_url, fields, is_active, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: document_templates; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.document_templates (id, program_id, name, type, description, template_url, html_content, placeholders, layout_config, is_active, "order", created_at, updated_at, legacy_id, deleted_at) FROM stdin;
\.


--
-- Data for Name: email_templates; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.email_templates (id, brand_id, program_id, name, type, subject, body, variables, is_active, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: files; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.files (id, filename, content_type, size, url, storage_path, user_id, entity_type, entity_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: legal_documents; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.legal_documents (id, brand_id, title, slug, content, version, description, is_required, is_active, published_at, created_at, updated_at, deleted_at) FROM stdin;
f754de9b-5e59-4a67-8381-5ea58c2606c4	b46695c9-e58b-45a4-a930-56822cb0d560	Privacy Policy	privacy-policy	\n          <h1>Privacy Policy</h1>\n          <p>Effective Date: January 1, 2026</p>\n          <p>We value your privacy. This document explains how we collect, use, and share your personal information...</p>\n          <h2>1. Information We Collect</h2>\n          <p>We collect information you provide directly to us when you create an account, register for an event...</p>\n          <h2>2. How We Use Your Information</h2>\n          <p>We use the information we collect to provide, maintain, and improve our services...</p>\n        	1.0	Our policy regarding user data collection and usage.	t	t	2026-02-09 02:22:05.219+00	2026-02-09 02:22:05.219+00	2026-02-09 02:22:05.219+00	\N
1a90f0e3-b494-45e2-9171-4968977d5e97	b46695c9-e58b-45a4-a930-56822cb0d560	Terms of Service	terms-of-service	\n          <h1>Terms of Service</h1>\n          <p>Welcome to Istanbul Youth Summit.</p>\n          <p>By accessing or using our services, you agree to be bound by these Terms...</p>\n          <h2>1. Eligibility</h2>\n          <p>You must be at least 18 years old to use our services...</p>\n          <h2>2. Code of Conduct</h2>\n          <p>Participants are expected to behave professionally...</p>\n        	1.0	Rules and regulations for using our platform and attending events.	t	t	2026-02-09 02:22:05.219+00	2026-02-09 02:22:05.219+00	2026-02-09 02:22:05.219+00	\N
ef4c1f8d-7c90-49df-9a1e-d33222576a05	b46695c9-e58b-45a4-a930-56822cb0d560	Refund Policy	refund-policy	\n          <h1>Refund Policy</h1>\n          <p>All registration fees are non-refundable unless the event is cancelled...</p>\n        	1.0	Conditions under which refunds are granted.	f	t	2026-02-09 02:22:05.219+00	2026-02-09 02:22:05.219+00	2026-02-09 02:22:05.219+00	\N
\.


--
-- Data for Name: migration_tracking; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.migration_tracking (id, table_name, mysql_id, postgres_id, migrated_at, migration_batch) FROM stdin;
\.


--
-- Data for Name: newsletter_subscribers; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.newsletter_subscribers (id, email, name, source, is_subscribed, subscribed_at, unsubscribed_at, user_id, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: participant_applications; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.participant_applications (id, program_id, participant_id, status, ticket_status, referral_code, submission_date, personal_data, essay_answers, uploaded_files, deleted_at, deleted_by, withdrawn_by, created_at, updated_at, application_category, program_payment_status, registration_payment_status, participation_category_id, pricing_tier_id) FROM stdin;
e6adf4b6-6943-40e7-873a-21ef77125b57	eedb6e37-8d7d-438f-91a2-fb8c2635acdb	8864b749-9968-46f9-b66a-a0cc1a0eb0f1	draft	regular	\N	\N	{"full_name":"John Participant","whatsapp_number":"+6281234567890","tshirt_size":"M"}	{"question_1":"My motivation is huge.","question_2":"I want to solve poverty."}	{}	\N	\N	\N	2026-02-09 02:22:05.519+00	2026-02-09 02:22:05.519+00	self_funded	unpaid	unpaid	\N	\N
89c460b8-3065-4864-8b57-7f07a91d616b	eedb6e37-8d7d-438f-91a2-fb8c2635acdb	6d9aeab8-c3ac-44fd-ae94-0251940b54b3	submitted	regular	\N	2026-02-09 02:22:05.575+00	{"full_name":"Jane Applicant","whatsapp_number":"+639123456789","tshirt_size":"M"}	{"question_1":"My motivation is huge.","question_2":"I want to solve poverty."}	{}	\N	\N	\N	2026-02-09 02:22:05.575+00	2026-02-09 02:22:05.575+00	fully_funded	unpaid	unpaid	\N	\N
a2e199a2-b305-4cab-8ab1-13d067e9a132	eedb6e37-8d7d-438f-91a2-fb8c2635acdb	be441a45-c24a-4f9f-a875-ef9de9f65008	accepted	regular	\N	2026-02-09 02:22:05.641+00	{"full_name":"Alex Winner","whatsapp_number":"+60123456789","tshirt_size":"M"}	{"question_1":"My motivation is huge.","question_2":"I want to solve poverty."}	{}	\N	\N	\N	2026-02-09 02:22:05.641+00	2026-02-09 02:22:05.641+00	self_funded	unpaid	paid	\N	\N
\.


--
-- Data for Name: participant_awards; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.participant_awards (id, application_id, program_award_id, awarded_at, awarded_by, notes, certificate_url, deleted_at) FROM stdin;
\.


--
-- Data for Name: participant_documents; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.participant_documents (id, application_id, template_id, document_number, name, type, file_url, file_type, is_public, download_count, generated_at, expires_at, legacy_id, deleted_at) FROM stdin;
499c618b-95a2-4333-8008-399bf0951803	a2e199a2-b305-4cab-8ab1-13d067e9a132	\N	\N	Letter of Acceptance	loa	https://example.com/loa.pdf	pdf	f	0	2026-02-09 02:22:05.653+00	\N	\N	\N
\.


--
-- Data for Name: participants; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.participants (id, user_id, full_name, nick_name, display_name, birthdate, gender, phone_country_code, phone_number, phone_verified, nationality, nationality_code, origin_country, origin_city, origin_address, current_country, current_city, current_address, education_level, institution, major, graduation_year, occupation, instagram_username, linkedin_url, portfolio_url, organizations, tshirt_size, dietary_restrictions, medical_conditions, special_needs, emergency_contact_name, emergency_contact_relation, emergency_contact_country_code, emergency_contact_phone, emergency_contact_email, profile_picture_url, resume_url, knowledge_source, referral_code, preferences, created_at, updated_at, profile_completed_at, profile_completion_percentage, last_profile_update, email_verified_at, phone_verified_at, deleted_at, deleted_by, legacy_id) FROM stdin;
8864b749-9968-46f9-b66a-a0cc1a0eb0f1	3976679f-b793-4c12-bed0-4d6134536d70	John Participant	\N	\N	2000-01-01	male	\N	+6281234567890	f	Indonesia	\N	Indonesia	City	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{}	2026-02-09 02:22:05.517+00	2026-02-09 02:22:05.517+00	\N	0	\N	\N	\N	\N	\N	\N
6d9aeab8-c3ac-44fd-ae94-0251940b54b3	44cc5035-4eef-4acc-9d36-c3751ea4a121	Jane Applicant	\N	\N	2000-01-01	female	\N	+639123456789	f	Philippines	\N	Philippines	City	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{}	2026-02-09 02:22:05.573+00	2026-02-09 02:22:05.573+00	\N	0	\N	\N	\N	\N	\N	\N
be441a45-c24a-4f9f-a875-ef9de9f65008	a321808a-822b-41f9-b8ae-a08547c1acd9	Alex Winner	\N	\N	2000-01-01	male	\N	+60123456789	f	Malaysia	\N	Malaysia	City	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{}	2026-02-09 02:22:05.639+00	2026-02-09 02:22:05.639+00	\N	0	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: partnership_enquiries; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.partnership_enquiries (id, brand_id, program_id, partnership_type, sub_category, full_name, email, whatsapp_number, company, subject, description, status, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: partnership_opportunities; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.partnership_opportunities (id, brand_id, program_id, title, subtitle, description, features, cta_label, type, "order", is_active, created_at, updated_at, deleted_at) FROM stdin;
dfa0a270-5d22-449c-b609-30ddfdab658c	b46695c9-e58b-45a4-a930-56822cb0d560	\N	Campus Ambassador	\N	Represent IYS in your university.	["Certificate","Discount on registration","Networking"]	Apply Now	ambassador	1	t	2026-02-09 02:22:05.21+00	2026-02-09 02:22:05.21+00	\N
3962825d-6dae-4679-b68f-7caaa0440970	b46695c9-e58b-45a4-a930-56822cb0d560	\N	Media Partner	\N	Cover our event and get exclusive access.	["Press Pass","Interview opportunities","Logo placement"]	Contact Us	media_partner	2	t	2026-02-09 02:22:05.21+00	2026-02-09 02:22:05.21+00	\N
\.


--
-- Data for Name: pricing_tier_validity_periods; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.pricing_tier_validity_periods (id, pricing_tier_id, start_date, end_date, description, created_at, updated_at) FROM stdin;
cf90f67c-fba7-4810-87ed-ae3f92ee7607	00000000-0000-0000-0000-000000000001	2024-05-05 17:35:31+00	2024-07-05 17:35:31+00	\N	2026-02-09 02:21:55.259+00	2026-02-09 02:21:55.259+00
5ef0479d-b2a1-4d7e-8c89-054c3498deae	00000000-0000-0000-0000-000000000002	2024-05-05 17:35:31+00	2024-10-08 00:00:00+00	\N	2026-02-09 02:21:55.523+00	2026-02-09 02:21:55.523+00
b7dbe621-a9d5-408f-b25f-a6286b0d736b	00000000-0000-0000-0000-000000000003	2024-05-05 17:35:31+00	2024-10-08 00:00:00+00	\N	2026-02-09 02:21:55.629+00	2026-02-09 02:21:55.629+00
bec59bcf-c411-4fa1-8259-913e680d7a00	00000000-0000-0000-0000-000000000004	2024-05-05 17:35:31+00	2024-10-08 00:00:00+00	\N	2026-02-09 02:21:55.656+00	2026-02-09 02:21:55.656+00
8ffdef6a-d746-4027-a8b9-94e869f116fd	00000000-0000-0000-0000-000000000005	2024-08-01 17:35:31+00	2024-11-01 00:00:00+00	\N	2026-02-09 02:21:55.681+00	2026-02-09 02:21:55.681+00
5e14f3f7-deec-466b-94ab-8614b53ede27	00000000-0000-0000-0000-000000000006	2024-10-01 00:00:00+00	2025-02-11 00:00:00+00	\N	2026-02-09 02:21:55.708+00	2026-02-09 02:21:55.708+00
d5f0ff50-e7ab-47c3-bdc1-abdb1bb524d6	00000000-0000-0000-0000-000000000007	2024-10-05 00:00:00+00	2025-02-11 00:00:00+00	\N	2026-02-09 02:21:55.735+00	2026-02-09 02:21:55.735+00
7975f4c9-165a-4e95-abd0-53d93a345faf	00000000-0000-0000-0000-000000000008	2024-11-01 17:35:31+00	2025-01-16 00:00:00+00	\N	2026-02-09 02:21:55.759+00	2026-02-09 02:21:55.759+00
28a01a15-2788-4f2c-b578-f64e8b17ee4e	00000000-0000-0000-0000-000000000009	2025-07-08 00:00:00+00	2025-09-30 23:59:00+00	\N	2026-02-09 02:21:55.782+00	2026-02-09 02:21:55.782+00
44bc99be-4aac-4439-8218-a5ed795b760e	00000000-0000-0000-0000-000000000010	2025-01-10 00:00:00+00	2025-04-06 00:00:00+00	\N	2026-02-09 02:21:55.808+00	2026-02-09 02:21:55.808+00
fd46742a-c2a7-4b41-87fc-0cdb7940fe0c	00000000-0000-0000-0000-000000000011	2025-08-25 00:00:00+00	2025-10-31 00:00:00+00	\N	2026-02-09 02:21:55.833+00	2026-02-09 02:21:55.833+00
314d480b-ca01-4ca6-b064-ca3033b40dc1	00000000-0000-0000-0000-000000000012	2025-09-01 00:00:00+00	2025-11-30 00:00:00+00	\N	2026-02-09 02:21:55.866+00	2026-02-09 02:21:55.866+00
1c9d8dfe-c524-4113-b7dc-b616005e58f8	00000000-0000-0000-0000-000000000013	2025-07-08 00:00:00+00	2025-11-08 23:59:00+00	\N	2026-02-09 02:21:55.892+00	2026-02-09 02:21:55.892+00
002eb8b9-264f-4365-ab22-288223cfc348	00000000-0000-0000-0000-000000000014	2025-03-05 00:00:00+00	2025-06-21 00:00:00+00	\N	2026-02-09 02:21:55.918+00	2026-02-09 02:21:55.918+00
4812a98d-52d1-4dc7-9fb4-2284180109b6	00000000-0000-0000-0000-000000000015	2025-03-05 00:00:00+00	2025-06-25 00:00:00+00	\N	2026-02-09 02:21:55.943+00	2026-02-09 02:21:55.943+00
62fa7213-fe8d-4a92-a677-0480040c2f79	00000000-0000-0000-0000-000000000016	2025-04-07 00:00:00+00	2025-06-30 00:00:00+00	\N	2026-02-09 02:21:55.965+00	2026-02-09 02:21:55.965+00
d120c30c-4aff-45e4-ad09-3258594eb900	00000000-0000-0000-0000-000000000017	2025-04-15 00:00:00+00	2025-07-18 00:00:00+00	\N	2026-02-09 02:21:55.99+00	2026-02-09 02:21:55.99+00
45b65c45-629a-4b76-a189-1aabe6a1a5d3	00000000-0000-0000-0000-000000000018	2025-06-20 00:00:00+00	2025-10-01 00:00:00+00	\N	2026-02-09 02:21:56.015+00	2026-02-09 02:21:56.015+00
9b1c135b-472f-4ad2-bdce-9570a606e56d	00000000-0000-0000-0000-000000000019	2025-07-18 00:00:00+00	2025-10-01 00:00:00+00	\N	2026-02-09 02:21:56.042+00	2026-02-09 02:21:56.042+00
7cd7e26b-e88e-4649-97f3-f10e6ea5ce03	00000000-0000-0000-0000-000000000020	2025-04-21 00:00:00+00	2025-07-01 00:00:00+00	\N	2026-02-09 02:21:56.155+00	2026-02-09 02:21:56.155+00
2e81563f-8a1e-41f3-8940-f4ca48067fd7	00000000-0000-0000-0000-000000000021	2025-08-01 00:00:00+00	2025-10-01 00:00:00+00	\N	2026-02-09 02:21:56.179+00	2026-02-09 02:21:56.179+00
3b9099de-0d66-4c5e-8d01-0ecc1f2f886f	00000000-0000-0000-0000-000000000022	2025-06-20 00:00:00+00	2025-10-01 00:00:00+00	\N	2026-02-09 02:21:56.204+00	2026-02-09 02:21:56.204+00
a8295531-a814-400e-abfe-e5e77c96775d	00000000-0000-0000-0000-000000000023	2025-07-01 00:00:00+00	2025-10-10 23:59:00+00	\N	2026-02-09 02:21:56.227+00	2026-02-09 02:21:56.227+00
9a15971a-74d8-40fb-a03c-f2447b4829d2	00000000-0000-0000-0000-000000000024	2025-07-17 00:00:00+00	2025-09-09 00:00:00+00	\N	2026-02-09 02:21:56.251+00	2026-02-09 02:21:56.251+00
3d6b60ce-e8a8-43ba-88af-43a2d732e1ad	00000000-0000-0000-0000-000000000026	2025-09-16 00:00:00+00	2025-11-10 23:59:00+00	\N	2026-02-09 02:21:56.279+00	2026-02-09 02:21:56.279+00
d5e17dc7-fc6a-4ab6-a927-d2de27c3dc96	00000000-0000-0000-0000-000000000027	2025-08-01 00:00:00+00	2025-10-01 00:00:00+00	\N	2026-02-09 02:21:56.312+00	2026-02-09 02:21:56.312+00
26d682ea-a8df-47a7-b8dc-53e2beaadfff	00000000-0000-0000-0000-000000000036	2025-08-20 00:00:00+00	2025-10-20 23:59:00+00	\N	2026-02-09 02:21:56.831+00	2026-02-09 02:21:56.831+00
7decd68f-f4c6-4c58-bb63-fe3eba6022aa	00000000-0000-0000-0000-000000000037	2025-11-09 00:00:00+00	2025-12-08 23:59:59+00	\N	2026-02-09 02:21:57.076+00	2026-02-09 02:21:57.076+00
4a5ed02d-7f62-474b-8674-09548eb61a7b	00000000-0000-0000-0000-000000000038	2025-10-01 00:00:00+00	2025-10-15 23:59:00+00	\N	2026-02-09 02:21:57.101+00	2026-02-09 02:21:57.101+00
1f183d06-f70c-4bef-9f9f-f93dfe105e61	00000000-0000-0000-0000-000000000039	2025-10-20 00:00:00+00	2025-10-31 23:59:59+00	\N	2026-02-09 02:21:57.202+00	2026-02-09 02:21:57.202+00
e02ce7c7-7a55-4358-8e47-554dceb3dc6d	00000000-0000-0000-0000-000000000040	2025-09-30 04:33:59+00	2026-03-30 04:33:59+00	\N	2026-02-09 02:21:57.225+00	2026-02-09 02:21:57.225+00
498d8aa5-184f-49eb-9667-a310f38b8161	00000000-0000-0000-0000-000000000042	2025-10-01 14:03:00+00	2026-04-03 14:03:00+00	\N	2026-02-09 02:21:57.249+00	2026-02-09 02:21:57.249+00
75901d2c-e79d-4abc-864e-31d607184310	00000000-0000-0000-0000-000000000043	2025-10-21 00:01:00+00	2025-10-31 23:29:00+00	\N	2026-02-09 02:21:57.274+00	2026-02-09 02:21:57.274+00
48a79468-14e5-4e8f-bbc5-dcc5f9844413	00000000-0000-0000-0000-000000000054	2025-11-03 00:01:00+00	2025-11-10 23:59:00+00	\N	2026-02-09 02:21:57.412+00	2026-02-09 02:21:57.412+00
1ea88fe8-4b19-4d7b-8d96-7ee7dbf2c00b	00000000-0000-0000-0000-000000000055	2025-11-01 00:01:00+00	2025-11-05 11:59:00+00	\N	2026-02-09 02:21:57.435+00	2026-02-09 02:21:57.435+00
952e94a9-30c2-46f6-8202-50a4e0e8786c	00000000-0000-0000-0000-000000000056	2025-11-06 00:01:00+00	2025-11-20 23:59:00+00	\N	2026-02-09 02:21:57.456+00	2026-02-09 02:21:57.456+00
6b38d9a4-b766-4b09-81af-f077fd1e3a7f	00000000-0000-0000-0000-000000000084	2025-11-10 23:59:00+00	2025-11-20 23:59:00+00	\N	2026-02-09 02:21:58.798+00	2026-02-09 02:21:58.798+00
\.


--
-- Data for Name: program_announcement_reads; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.program_announcement_reads (id, user_id, announcement_id, read_at) FROM stdin;
\.


--
-- Data for Name: program_announcements; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.program_announcements (id, program_id, title, content, image_url, target_audience, send_email, is_pinned, publish_date, is_active, created_at, updated_at, deleted_at, category, tags) FROM stdin;
\.


--
-- Data for Name: program_awards; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.program_awards (id, program_id, name, description, category, tier, tags, winner_count, color, badge_url, icon_url, certificate_template_id, is_active, "order", created_at, updated_at, legacy_id, deleted_at) FROM stdin;
\.


--
-- Data for Name: program_essays; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.program_essays (id, program_id, question, description, word_limit, is_required, "order", is_active, created_at, updated_at, deleted_at) FROM stdin;
c75a7a6e-38bc-41d9-b60c-b57ee9a221e0	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	What innovative business ideas can you propose to accelerate progress toward achieving the SDG while creating lasting social impact?	\N	\N	t	1	t	2026-02-09 02:21:41.935+00	2026-02-09 02:21:41.935+00	\N
1c71aa89-41f7-4738-8b16-ae38093e7b8a	532ac7e2-ff62-4587-92cf-37c12387fbcf	As a youth leader, how have you contributed — or how do you plan to contribute — to advancing solutions within your chosen SDG focus area to create sustainable and inclusive change in your community or beyond?	\N	\N	t	1	t	2026-02-09 02:21:41.952+00	2026-02-09 02:21:41.952+00	\N
b9746b58-3f96-477b-af5c-3fed93ab22f1	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	How can Muslims contribute to building a just, inclusive, and sustainable society despite the challenges they face?	\N	\N	t	1	t	2026-02-09 02:21:41.971+00	2026-02-09 02:21:41.971+00	\N
e8b4deb2-49b0-47bd-ac6b-90565d3ebd23	359aaba8-b950-44b2-951c-6a10b61fdaf8	How can a youth-led social initiative effectively address challenges within one of the SDG focus areas while ensuring long-term community impact?	\N	\N	t	1	t	2026-02-09 02:21:42.009+00	2026-02-09 02:21:42.009+00	\N
54910532-c0fe-4a55-90fc-e0f1011aae4b	eedb6e37-8d7d-438f-91a2-fb8c2635acdb	How can a youth-led social initiative effectively address challenges within one of the SDG focus areas while ensuring long-term community impact?	\N	\N	t	1	t	2026-02-09 02:21:42.026+00	2026-02-09 02:21:42.026+00	\N
899f97be-83e8-47f1-9b38-66ae372d6813	0d660fb3-b707-47c4-8969-4282653cb745	As a youth leader, how have you contributed — or how do you plan to contribute — to advancing solutions within your chosen SDG focus area to create sustainable and inclusive change in your community or beyond?	\N	\N	t	1	t	2026-02-09 02:21:42.051+00	2026-02-09 02:21:42.051+00	\N
36b1b0ea-14f0-4c91-b9ac-28869da69c95	9412ce6a-cbd5-4789-9291-b3121f18526d	How can Muslims contribute to building a just, inclusive, and sustainable society despite the challenges they face?	\N	\N	t	1	t	2026-02-09 02:21:42.073+00	2026-02-09 02:21:42.073+00	\N
e24c12a8-2fbb-4576-9427-4522c9007ef1	c007679c-7ed9-4d3e-a4cb-dbe99dbdc3a6	How can Vietnamese cultural values and modern innovation work together to address current challenges facing Southeast Asia? Please provide a specific example of a problem in your community that could benefit from this approach.	\N	\N	t	1	t	2026-02-09 02:21:42.094+00	2026-02-09 02:21:42.094+00	\N
c12da320-ce20-4d21-b808-e902485dabea	ee83ea00-0396-457a-9abd-85cf6b1c746f	As a young changemaker, how will you design a scalable and feasible sustainability project aligned with one of the SDG focus areas to create global impact?	\N	\N	t	1	t	2026-02-09 02:21:42.118+00	2026-02-09 02:21:42.118+00	\N
\.


--
-- Data for Name: program_faqs; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.program_faqs (id, program_id, question, answer, category, "order", is_active, created_at, updated_at, deleted_at) FROM stdin;
32714648-7ff7-45e3-92b5-d67d661a0639	723cbfda-d5ba-40c1-80b0-c90eab48049f	What is the World Youth Festival?	The World Youth Festival (WYF), orchestrated by the Youth Break the Boundaries (YBB) Foundation, This platform is designed to cultivate the spirit of entrepreneurship, encourage collaboration, and foster the contribution of youth globally, Additionally, it aims to ensure the readiness of the next generation to tackle the challenges of the future.	event_details	0	t	2026-02-09 02:21:52.242+00	2026-02-09 02:21:52.242+00	\N
5a2d20b6-7416-4264-b71e-4e455e37ad9a	723cbfda-d5ba-40c1-80b0-c90eab48049f	When will the program be implemented?	It is 4 day program in Kuala Lumpur, Malaysia on October 5 - 8, 2024.	event_details	0	t	2026-02-09 02:21:52.296+00	2026-02-09 02:21:52.296+00	\N
7e6bdfbb-c23f-43ff-9432-cdf91a6dcace	723cbfda-d5ba-40c1-80b0-c90eab48049f	I made a payment but it is still pending. Why?	Ensure that you have completed a purchase using the selected payment method on our website. The process is automatic. Please contact ybb.worldyouthfest@gmail.com or Whatsapp +62 851-7338-6622	payment	0	t	2026-02-09 02:21:52.303+00	2026-02-09 02:21:52.303+00	\N
93e9507a-878b-4b70-8b46-be24de20233f	723cbfda-d5ba-40c1-80b0-c90eab48049f	How to register for the World Youth Festival?	To register for the World Youth Festival, participants need to visit the World Youth Festival website. From there, they will create a new account, fill in their information details, write an essay, ensure payment is complete, and finally submit the application.	registration	0	t	2026-02-09 02:21:52.308+00	2026-02-09 02:21:52.308+00	\N
832c9a79-c030-44d6-ac8b-376c7b3d9c88	723cbfda-d5ba-40c1-80b0-c90eab48049f	What documents should be prepared for the application?	Participants are only required to prepare an essay. For guidelines on writing the essay, please refer to the provided instructions.	registration	0	t	2026-02-09 02:21:52.316+00	2026-02-09 02:21:52.316+00	\N
17f87736-5757-4a92-a13c-974126725de6	22eeb004-f921-492a-af50-6d6afbbbe97c	What is the Istanbul Youth Summit?	Istanbul Youth Summit 2025 is the eight international youth summit in Istanbul, Turkiye organized by Youth Break the Boundaries (YBB) foundation, aims to inspire emerging leaders who push the limits of their potential to come together to discuss and implement strategies for Empowering Youth Leaders to Drive Sustainable Change for A Brighter Future. The summit also promotes collaboration among diverse young people from various fields to harness their leadership skills in working towards achieving sustainable development goals. The program will be held on February 17 - 20, 2025.	event_details	0	t	2026-02-09 02:21:52.321+00	2026-02-09 02:21:52.321+00	\N
ca8da977-01fb-4314-ba41-d9fb1a9a9ddd	22eeb004-f921-492a-af50-6d6afbbbe97c	What is the theme of Istanbul Youth Summit?	The Istanbul Youth Summit 2025 will bring the theme Empowering Youth Leaders to Drive Sustainable Change for A Brighter Future with five subthemes: Health (SDG 3: Good Health and Well-being), Education (SDG 4: Quality of Education), Economy (SDG 8: Decent Work and Economic Growth), Environment (SDG 13: Climate Action), and Peace and Justice (SDG 16: Peace, Justice, and Strong Institutions)	event_details	0	t	2026-02-09 02:21:52.328+00	2026-02-09 02:21:52.328+00	\N
8b396561-8ef3-4842-9cf2-e6137d466d7b	22eeb004-f921-492a-af50-6d6afbbbe97c	What are the programs at the Istanbul Youth Summit?	Istanbul Youth Summit 2025 will be held for four days starting from February 17 -20, 2025. The program will consist of an International Youth Summit, Global Panel Discussion, Competition on Social Projects and Sustainability, Cultural Performance, Awarding Ceremony, and Worldwide Networking	event_details	0	t	2026-02-09 02:21:52.336+00	2026-02-09 02:21:52.336+00	\N
53fa265c-9367-420d-8ce8-114cc08f21e2	22eeb004-f921-492a-af50-6d6afbbbe97c	What are the objectives of the Istanbul Youth Summit?	The objectives of the Istanbul Youth Summit (IYS) are to cultivate the spirit of talented youth leaders across diverse fields, foster and nurture the character of youth leadership, establish a strong presence for youth on the international stage, develop the leadership capabilities of youth, empowering them to actively contribute to their country's development, and create a robust network and lasting connections among IYS alumni to ensure the continuity of the Istanbul Youth Summit program for years to come.	event_details	0	t	2026-02-09 02:21:52.34+00	2026-02-09 02:21:52.34+00	\N
867f75f7-d029-4df8-bda3-d221b7ecbc97	22eeb004-f921-492a-af50-6d6afbbbe97c	When will I get the announcement for the selected participants?	The registration will be held on August 1 - September 30, 2024. Then we will give the announcement for the selected participants on October 10 - 20, 2024.	registration	0	t	2026-02-09 02:21:52.346+00	2026-02-09 02:21:52.346+00	\N
cffd7f9e-5c7b-4395-b932-f5bf627af41f	22eeb004-f921-492a-af50-6d6afbbbe97c	Why am I unable to sign up on my own?	Please review the instructions for the registration process. The registration can be completed on the following website.	registration	0	t	2026-02-09 02:21:52.367+00	2026-02-09 02:21:52.367+00	\N
fbce744f-2535-4e3d-a02e-df479174b67b	22eeb004-f921-492a-af50-6d6afbbbe97c	I submitted a payment, but it is still in the processing stage. Can you explain the delay?	Make sure that you have made a purchase with the selected payment method on our website. The process is automatic. Please contact istanbulyouthsummit@gmail.com or Whatsapp +62 851-7338-6622	payment	0	t	2026-02-09 02:21:52.373+00	2026-02-09 02:21:52.373+00	\N
5f4631f7-d0e6-40cd-8a93-a6b0c27614a4	22eeb004-f921-492a-af50-6d6afbbbe97c	Am I eligible for the fully funded participant?	All participants have the chance to receive full funding for the program. Your profile, application, essay, and interview will be carefully evaluated. Present your best self and seize this valuable opportunity!	event_details	0	t	2026-02-09 02:21:52.378+00	2026-02-09 02:21:52.378+00	\N
4164b10c-5ad1-45cd-8924-e0546d5f1062	22eeb004-f921-492a-af50-6d6afbbbe97c	If I am unable to participate in the Istanbul Youth Summit, am I eligible to receive a refund?	No, the registration fee as well as program fee aren’t entitled to refund.	event_details	0	t	2026-02-09 02:21:52.381+00	2026-02-09 02:21:52.381+00	\N
ce393d2f-7042-47f8-9554-f1eb60fa0acf	22eeb004-f921-492a-af50-6d6afbbbe97c	If my parents inquire about the individuals in charge of managing the project and handling public relations for this event, whose contact information should I provide them with?	You can contact IYS Project Manager on istanbulyouthsummit@gmail.com and IYS Public Relations on Whatsapp +62 851-7338-6622.	event_details	0	t	2026-02-09 02:21:52.384+00	2026-02-09 02:21:52.384+00	\N
d71c50dc-d736-4348-b0df-5531c442eba0	22eeb004-f921-492a-af50-6d6afbbbe97c	Where should I submit my application?	Participants submit their application on the website https://istanbulyouthsummit.com.	registration	0	t	2026-02-09 02:21:52.389+00	2026-02-09 02:21:52.389+00	\N
e03d5f6d-bd5e-487a-bc6f-0b6b8a031b9b	22eeb004-f921-492a-af50-6d6afbbbe97c	How to register Istanbul Youth Summit?	Participants need to register through our website, https://istanbulyouthsummit.com.	registration	0	t	2026-02-09 02:21:52.393+00	2026-02-09 02:21:52.393+00	\N
98473a97-6ce9-43ca-9681-314086ca2103	22eeb004-f921-492a-af50-6d6afbbbe97c	How to join Istanbul Youth Summit and secure the fully funded program?	The Istanbul Youth Summit program is funded by participants themselves, but we also offer a fully funded option for top participants. Those who qualify after the initial application process will be invited to participate in the interview round to be considered for the fully funded program.	registration	0	t	2026-02-09 02:21:52.415+00	2026-02-09 02:21:52.415+00	\N
3ab7ad53-18e1-4041-b751-bfa1b5264ef1	22eeb004-f921-492a-af50-6d6afbbbe97c	What documents should we prepare for the application?	Participants only need to prepare an essay. For the rules of writing the essay, all the details can be found in this guidelines.	registration	0	t	2026-02-09 02:21:52.485+00	2026-02-09 02:21:52.485+00	\N
045af107-2fa1-48fc-baf4-d476b3f560f7	22eeb004-f921-492a-af50-6d6afbbbe97c	Is English required to join the Istanbul Youth Summit?	All activities at the Istanbul Youth Summit will be conducted in English, so it is recommended that participants have a strong command of the language.	registration	0	t	2026-02-09 02:21:52.558+00	2026-02-09 02:21:52.558+00	\N
91f695a1-111b-45f8-bf61-ccbecdc15a29	22eeb004-f921-492a-af50-6d6afbbbe97c	How can I confirm that my application and payment have been successfully submitted?	Participants will receive email confirmation from Youth Break the Boundaries when the application and payment is submitted successfully.	registration	0	t	2026-02-09 02:21:52.619+00	2026-02-09 02:21:52.619+00	\N
35509b04-b952-4d2c-96c2-7f5df6c2e09c	22eeb004-f921-492a-af50-6d6afbbbe97c	What are the requirements to join the Istanbul Youth Summit?	Individuals between the ages of 15 and 35, regardless of educational or nationality background, are eligible as long as they have not been involved in any criminal activities.	registration	0	t	2026-02-09 02:21:52.868+00	2026-02-09 02:21:52.868+00	\N
7d6557d1-1c8d-45b0-9cc8-d735171bd07b	4487fb74-b208-4ddc-ac37-d1dab65a84c1	What is the Youth Academic Forum?	The Youth Academic Forum, an initiative of Youth Break the Boundaries (YBB), stands as a dynamic and inclusive platform designed to elevate and empower the young research community. With a steadfast commitment to promoting original, objective, and credible research, the forum provides accessible pathways for young researchers to publish and present their work on a global stage.\r\n\r\nMore than just a publication platform, the Youth Academic Forum is a hub of intellectual exchange, where emerging scholars, practitioners, and change-makers collaborate, learn, and grow. We believe that meaningful research should not remain confined to academic institutions but should inform real-world progress, policy, and innovation.	event_details	2	t	2026-02-09 02:21:52.882+00	2026-02-09 02:21:52.882+00	\N
8e94ad5d-20e4-434b-9d71-53e6ae482b5c	4487fb74-b208-4ddc-ac37-d1dab65a84c1	When will the program be implemented?	It is a 4-day program in Bangkok, Thailand from December 8 - 11, 2025.	event_details	1	t	2026-02-09 02:21:52.885+00	2026-02-09 02:21:52.885+00	\N
759190d3-da44-4847-abff-7776bdb4372a	4487fb74-b208-4ddc-ac37-d1dab65a84c1	What is the theme of Youth Academic Forum?	The Youth Academic Forum will bring the theme "Building the Foundation of Innovation and Cross-Disciplinary Collaboration for Youth Intellectual Development on a Global Scale”	event_details	3	t	2026-02-09 02:21:52.888+00	2026-02-09 02:21:52.888+00	\N
0d21e381-bc6a-4a10-916a-956ee2d6679a	4487fb74-b208-4ddc-ac37-d1dab65a84c1	Why am I unable to sign up on my own?	Please review the instructions for the registration process. The registration can be completed on the following website.	registration	0	t	2026-02-09 02:21:52.891+00	2026-02-09 02:21:52.891+00	\N
86a5439d-a1dc-4a82-9ffd-c265d3af0b1e	4487fb74-b208-4ddc-ac37-d1dab65a84c1	I submitted a payment, but it is still in the processing stage. Can you explain the delay?	Make sure that you have made a purchase with the selected payment method on our website. The process is automatic. Please contact youthacademicforum@gmail.com or Whatsapp +62 851-7338-6622	payment	0	t	2026-02-09 02:21:52.894+00	2026-02-09 02:21:52.894+00	\N
6973e1e3-865a-4b5d-bdeb-7cefb204aa65	a1c30442-e6a2-4c13-97ba-797c99806e0a	What is the Korea Youth Summit?	Korea Youth Summit 2025 is the first international youth summit in Seoul, South Korea  organized by Youth Break the Boundaries (YBB) foundation, aimed to inspire emerging leaders who push the limits of their potential to come together to discuss and implement strategies for  Cultural Heritage, Preservation Project. The summit also promotes collaboration among diverse young people from various fields to harness their leadership skills in working towards achieving sustainable development goals. The program will be held on June 16 - 19, 2025.	event_details	1	t	2026-02-09 02:21:52.897+00	2026-02-09 02:21:52.897+00	\N
6f21c974-98ba-459e-8c92-51775453013c	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	What is the World Youth Festival?	The World Youth Festival (WYF), organized by the Youth Break the Boundaries (YBB) Foundation, is an international business idea competition designed to empower young entrepreneurs, foster collaboration, and accelerate global innovation. This event serves as a dynamic hub where young visionaries can transform ideas into impactful solutions, ensuring the next generation is equipped to tackle future challenges with confidence and creativity.\r\n\r\nThe World Youth Festival is more than just a gathering—it’s a catalyst for entrepreneurial excellence, providing a space where young leaders from diverse backgrounds connect, exchange ideas, and collaborate on projects with real-world impact. Through interactive workshops, insightful discussions, and high-level networking, participants gain valuable skills, industry knowledge, and strategic connections that enhance their potential in the global marketplace.\r\n	event_details	1	t	2026-02-09 02:21:52.9+00	2026-02-09 02:21:52.9+00	\N
89aa1d69-d399-47e9-8aff-83a5c6793beb	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	What is the theme of World Youth Festival?	The World Youth Festival will bring the theme Cultivating Youth Creativity in Entrepreneurship with\r\nfive sub themes which was Education, Food and Beverage, Fintech, Environment, and Creative\r\nIndustry	event_details	2	t	2026-02-09 02:21:52.904+00	2026-02-09 02:21:52.904+00	\N
8b006406-fa77-41b9-bf39-89c0496e6b95	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	What are the programs at the World Youth Festival?	The World Youth Festival will be held for four days starting from October 6 - 9, 2025. The program\r\nwill consist of International Business Idea Competition, International Youth Summit, Global Panel Discussion,\r\nCultural Performance, Awarding Ceremony, and Worldwide Networking.	event_details	3	t	2026-02-09 02:21:52.907+00	2026-02-09 02:21:52.907+00	\N
bb317099-f3bc-42a0-bba2-61a435bae382	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	What are the objectives of the World Youth Festival?	The objectives of the World Youth Festival (WYF) are to cultivate the spirit of talented youth leaders\r\nacross diverse fields, foster and nurture the character of youth leadership, establish a strong\r\npresence for youth on the international stage, develop the leadership capabilities of youth,\r\nempowering them to actively contribute to their country's development, and create a robust network\r\nand lasting connections among WYF alumni to ensure the continuity of the World Youth Festival\r\nprogram for years to come.	event_details	4	t	2026-02-09 02:21:52.909+00	2026-02-09 02:21:52.909+00	\N
b8ff08bb-4ae4-4db5-bf0b-e8667fcb2942	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	When will I get the announcement of the selected participants?	The registration will be held on April 15, 2025 until June 15, 2025 Then the participants will get an\r\nacceptance announcement on June 20 - 30, 2025.	registration	5	t	2026-02-09 02:21:52.912+00	2026-02-09 02:21:52.912+00	\N
5955ca3e-7cb4-4561-9680-6e044be3d95a	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	Why am I unable to sign up on my own?	Please review the instructions for the registration process. The registration can be completed on the following website.	registration	6	t	2026-02-09 02:21:52.923+00	2026-02-09 02:21:52.923+00	\N
43179423-7b50-4dfa-b4a1-23dca65f6b5c	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	I submitted a payment, but it is still in the processing stage.     Can you explain the delay?	Make sure that you have made a purchase with the selected payment method on our website. The process is automatic. Please contact ybb.worldyouthfest@gmail.com or Whatsapp at \r\n+62 851-7338-6622.	registration	7	t	2026-02-09 02:21:52.927+00	2026-02-09 02:21:52.927+00	\N
677fe4de-db76-444c-9570-445a7355ecd0	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	Am I eligible for the fully funded participant?	All participants have the chance to receive full funding for the program. Your profile, application, essay, and interview will be carefully evaluated. Present your best self and seize this valuable opportunity!	registration	8	t	2026-02-09 02:21:52.932+00	2026-02-09 02:21:52.932+00	\N
2b5b1774-7d96-409b-864e-a3695bd821b3	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	If I am unable to participate in World Youth Festival, am I eligible to receive a refund?	No, the registration fee as well as program fee aren’t entitled to refund.	registration	9	t	2026-02-09 02:21:52.935+00	2026-02-09 02:21:52.935+00	\N
36587977-1da2-405b-9e7e-f7bbcdeb81aa	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	If my parents inquire about the individuals in charge of managing the project and handling public relations for this event, whose contact information should I provide them with?	You can contact WYF Project Manager on ybb.worldyouthfest@gmail.com and WYF Public Relations on Whatsapp +62 851-7338-6622.	registration	10	t	2026-02-09 02:21:52.939+00	2026-02-09 02:21:52.939+00	\N
6ad0b55f-a360-4a55-9268-1f53df2af8c0	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	Where should I submit my application?	Participants submit their application on the website https://worldyouthfestival.com	registration	11	t	2026-02-09 02:21:52.942+00	2026-02-09 02:21:52.942+00	\N
769c7a7d-de16-4963-b227-271d300f0103	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	How to register for the World Youth Festival?	Participants need to register through our website at: https://worldyouthfestival.com	registration	12	t	2026-02-09 02:21:52.947+00	2026-02-09 02:21:52.947+00	\N
76b0f4b2-3673-4df9-98ed-fb06bb9c3749	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	How to join the World Youth Festival and secure the fully funded program?	The World Youth Festival program is funded by participants themselves, but we also offer a fully funded option for top participants. Those who qualify after the initial application process will be invited to participate in the interview round to be considered for the fully funded program.	registration	13	t	2026-02-09 02:21:52.951+00	2026-02-09 02:21:52.951+00	\N
6662e83b-296d-4cc4-adcf-92869edf2c06	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	What documents should we prepare for the application?	Participants only need to prepare an essay. For the rules of writing the essay, all the details can be found in this guidelines book.	registration	14	t	2026-02-09 02:21:52.956+00	2026-02-09 02:21:52.956+00	\N
9468608b-0f57-4df0-9279-790826fce359	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	Is English required for joining the World Youth Festival?	All activities at the World Youth Festival will be conducted in English, so it is recommended that participants have a strong command of the language.	registration	15	t	2026-02-09 02:21:52.961+00	2026-02-09 02:21:52.961+00	\N
e8c4b62a-a52b-4b3e-a685-41db426d24f9	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	How can I confirm that my application and payment have been successfully submitted?	Participants will receive email confirmation from Youth Break the Boundaries when the application and payment is submitted successfully.	payment	16	t	2026-02-09 02:21:52.966+00	2026-02-09 02:21:52.966+00	\N
0f8af477-29b3-47ce-a18d-69b04b039dc4	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	What are the requirements to join the World Youth Festival?	Individuals between the ages of 15 and 40, regardless of educational or nationality background, are eligible as long as they have not been involved in any criminal activities.	registration	17	t	2026-02-09 02:21:52.971+00	2026-02-09 02:21:52.971+00	\N
08cba65a-edb2-4da9-b9d1-43f9444b327f	532ac7e2-ff62-4587-92cf-37c12387fbcf	What is Japan Youth Summit	The Japan Youth Summit is an international innovation competition program by the Youth Break the Boundaries Foundation, which initiates and aspires to bring together outstanding young minds to collectively address future challenges and propose innovative solutions. Beyond individual brilliance, collaboration takes center stage, encouraging the commitment of young generations to collaborate for shared and improved goals.	event_details	1	t	2026-02-09 02:21:52.976+00	2026-02-09 02:21:52.976+00	\N
0b7cd986-2913-4370-b9b7-54ef41eed46e	532ac7e2-ff62-4587-92cf-37c12387fbcf	What is the theme of the Japan Youth Summit?	Japan Youth Summit 2025 will bring the theme “Pioneering Innovation for Sustainable Futures” with four subthemes: Innovation in Education (SDG 4 - Quality Education), Sustainable Economic Growth (SDG 8 - Decent Work and Economic Growth),Technology Infrastructure and Sustainable Cities (SDG 9 - Industry, Innovation, and Infrastructure SDG 11 - Sustainable Cities and Communities) And SDG 13 - Climate Action	event_details	2	t	2026-02-09 02:21:52.983+00	2026-02-09 02:21:52.983+00	\N
9b29958d-3679-434d-a839-b914b0ba54f1	532ac7e2-ff62-4587-92cf-37c12387fbcf	What are the agendas at the Japan Youth Summit?	Japan Youth Summit 2025 will be held four days from October 12 - 15, 2025. The program will consist of International Innovation Competition, International Youth Summit, Leadership Training, Intercultural Exploration, Culture and Awards Night, Global Network, etc.	event_details	3	t	2026-02-09 02:21:52.985+00	2026-02-09 02:21:52.985+00	\N
623514ff-1bea-4c26-93cb-c54252b08268	532ac7e2-ff62-4587-92cf-37c12387fbcf	What are the objectives of the Japan Youth Summit?	The Japan Youth Summit is orchestrated with the following paramount objectives: Empower young leaders to enhance their leadership skills and contribute actively to societal progress. Foster youth Innovation to address current and future challenges. Promote sustainable futures and propose solutions for global issues. Facilitate cross-sectoral collaboration among youths from diverse backgrounds and nations. Build a strong alumni network to ensure the continuity and success of the Japan Youth Summit in the years to come.	event_details	4	t	2026-02-09 02:21:52.988+00	2026-02-09 02:21:52.988+00	\N
d0e325b8-1937-4251-b1e6-178736254faa	532ac7e2-ff62-4587-92cf-37c12387fbcf	When will I get the announcement for the selected participants?	The announcement will be posted on September 1 - 10, 2025.	registration	5	t	2026-02-09 02:21:52.989+00	2026-02-09 02:21:52.989+00	\N
2bff42f8-6855-424c-94e4-20ee5efe1ab7	532ac7e2-ff62-4587-92cf-37c12387fbcf	Why can't I register myself?	Please read the guideline for the registration process. The registration is on this website. \r\njapanyouthsummit.com	registration	6	t	2026-02-09 02:21:52.991+00	2026-02-09 02:21:52.991+00	\N
3618b8e1-4c74-4ee9-8aa0-22a08ee57cc9	532ac7e2-ff62-4587-92cf-37c12387fbcf	How to register for the Japan Youth Summit?	Participants need to register through our website japanyouthsummit.com	registration	7	t	2026-02-09 02:21:52.993+00	2026-02-09 02:21:52.993+00	\N
e5108780-1749-4e74-8569-f5bab03aef4a	532ac7e2-ff62-4587-92cf-37c12387fbcf	I made a payment but it is still pending. Why?	Make sure that you have made a purchase with the selected payment method on our website. The process is automatic. Please contact japanyouthsummit@gmail.com or Whatsapp +62 851-7338-6622.	payment	8	t	2026-02-09 02:21:52.995+00	2026-02-09 02:21:52.995+00	\N
c80be35e-2f9e-4f22-b260-905e91bc0906	532ac7e2-ff62-4587-92cf-37c12387fbcf	Where should I submit my application?	Participants submit their application on the website japanyouthsummit.com	registration	9	t	2026-02-09 02:21:52.997+00	2026-02-09 02:21:52.997+00	\N
074b9414-1958-44e3-ae45-d584527443b3	532ac7e2-ff62-4587-92cf-37c12387fbcf	Am I eligible for the fully funded participant?	All of the participants can have an opportunity to get a fully funded program. The committee will assess participants’ profile, application form, essay, plus interview. Show the best version of yourself\r\nand grab this golden chance!	registration	10	t	2026-02-09 02:21:52.999+00	2026-02-09 02:21:52.999+00	\N
b7dc673a-a69a-4a0b-a21c-1893366ec7c1	532ac7e2-ff62-4587-92cf-37c12387fbcf	If I can’t attend the Japan Youth Summit, can I get a refund?	No, the registration fee as well as program fee aren’t entitled to refund.	payment	11	t	2026-02-09 02:21:53.001+00	2026-02-09 02:21:53.001+00	\N
18db7578-04eb-4bad-b68f-c039c3fd145e	532ac7e2-ff62-4587-92cf-37c12387fbcf	If my parents ask me who is the Project Manager and Public Relations of this event, whose contact I should give?	You can contact Japan Youth Summit Admin on japanyouthsummit@gmail.com and JYS Public Relations on Whatsapp +62 851-7338-6622.	event_details	12	t	2026-02-09 02:21:53.003+00	2026-02-09 02:21:53.003+00	\N
a9ab829d-6472-4683-b349-dcd5dc35cd81	532ac7e2-ff62-4587-92cf-37c12387fbcf	Why should you join Japan Youth Summit?	Embark on the Japan Youth Summit for meaningful conversations on global challenges, connect with young leaders globally, immerse yourself in diverse cultures, enhance leadership skills, and contribute to a more inclusive and sustainable future through collaborative youth-driven innovation for positive change.	event_details	13	t	2026-02-09 02:21:53.005+00	2026-02-09 02:21:53.005+00	\N
039fd1a5-10a6-4fe4-a8dc-ff64a1e734cd	532ac7e2-ff62-4587-92cf-37c12387fbcf	How to join the Japan Youth Summit & get the fully funded program?	The Japan Youth Summit extends both Fully Funded and Self-Funded Opportunities. To qualify for Full Funding, delegates must complete all registration steps and fulfill payment by the specified deadline. If not selected for Full Funding, delegates can still participate through a self-funded scheme.	event_details	14	t	2026-02-09 02:21:53.007+00	2026-02-09 02:21:53.007+00	\N
da3cce37-0de8-423a-af99-c3047b047df1	532ac7e2-ff62-4587-92cf-37c12387fbcf	What documents should we prepare for the application?	Participants only need to prepare an essay. For the rules of writing the essay, all the details can be found in these guidelines.	registration	15	t	2026-02-09 02:21:53.01+00	2026-02-09 02:21:53.01+00	\N
42d975ea-efd5-4176-940b-e70086516105	532ac7e2-ff62-4587-92cf-37c12387fbcf	Is English required for joining the Japan Youth Summit?	All programs at Japan Youth Summit will be conducted in English. Therefore, participants are advised to have a good understanding of English, but fluency is not required.	registration	16	t	2026-02-09 02:21:53.013+00	2026-02-09 02:21:53.013+00	\N
0a6338e3-1f0e-4907-be0f-41768d9e0772	532ac7e2-ff62-4587-92cf-37c12387fbcf	How can I know if my application & payment is submitted successfully?	Participants will receive email confirmation from Youth Break the Boundaries when the application and payment is submitted successfully.	registration	17	t	2026-02-09 02:21:53.015+00	2026-02-09 02:21:53.015+00	\N
f235ff0f-077e-4872-a692-8d3cd19b0c42	532ac7e2-ff62-4587-92cf-37c12387fbcf	What are the requirements to join the Japan Youth Summit?	The eligibility criteria is 15 - 40 years old, open for any educational and nationality background, never involved in criminal issues.	registration	18	t	2026-02-09 02:21:53.017+00	2026-02-09 02:21:53.017+00	\N
8b916bc2-2550-4000-9522-88955948301c	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	What is the Middle East Youth Summit?	The Middle East Youth Summit (MEYS), initiated by Youth Break the Boundaries (YBB), is a transformative platform designed to empower emerging Muslim youth leaders through character development, ethical leadership, and global cultural exchange. More than just an event, MEYS serves as a dynamic space for young changemakers to share their experiences, explore initiatives to empower the Muslim community, and build strong international networks rooted in shared values.	event_details	1	t	2026-02-09 02:21:53.019+00	2026-02-09 02:21:53.019+00	\N
3971ac79-0d77-4e10-a708-e0c7bad7f19b	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	When will the program take place?	The program will be held over 4 days in Mecca, Kingdom of Saudi Arabia (KSA), from December 1 - 4, 2025.	event_details	1	t	2026-02-09 02:21:53.021+00	2026-02-09 02:21:53.021+00	\N
0b7b4bf5-c7b3-4827-9efe-a14f09e4bd13	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	What is the main theme of the Middle East Youth Summit?	The Middle East Youth Summit carries the theme: "Empowering Emerging Leaders for Positive Change within the Islamic Brotherhood."	event_details	1	t	2026-02-09 02:21:53.022+00	2026-02-09 02:21:53.022+00	\N
b2d5e42f-382e-465b-9be2-4069d2b39484	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	What is the goal of the Middle East Youth Summit?	This program aims to connect young Muslim leaders from around the world, promote unity through cultural exchange, and strengthen Islamic values through meaningful spiritual and leadership experiences. It also seeks to equip youth with the skills needed to lead positive change in their communities, support Muslim community development through education and innovation, and build a strong global network of youth committed to continuous growth and impact.	event_details	1	t	2026-02-09 02:21:53.027+00	2026-02-09 02:21:53.027+00	\N
a3b5161f-d8cb-41e6-864e-f00210df2490	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	When will I get the announcement for the selected participants?	The registration will be held from June 1 to August 10, 2025. The announcement of the selected participants will be made between August 15 and 20, 2025.	registration	2	t	2026-02-09 02:21:53.029+00	2026-02-09 02:21:53.029+00	\N
767ac1e5-f231-4bcf-adee-41dd6dd89e2f	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	How can I know if my application & payment is submitted successfully?	Participants will receive email confirmation from Youth Break Boundaries when the application and payment is submitted successfully. 	payment	3	t	2026-02-09 02:21:53.031+00	2026-02-09 02:21:53.031+00	\N
eb02001f-5d8a-4266-a579-5753da246903	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	I made a payment but it is still pending. Why?	Ensure that you completed the transaction using the selected payment method on our website. The process is automatic. For assistance, contact us at middleeastyouthsummit@gmail.com or via WhatsApp at +62 857-1493-6778.	payment	3	t	2026-02-09 02:21:53.032+00	2026-02-09 02:21:53.032+00	\N
95b78d02-f07a-48c8-9fbf-3e4eb54efa59	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	If I can’t attend the Middle East Youth Summit, can I get a refund?	No, both the registration and program fees are non-refundable.	payment	3	t	2026-02-09 02:21:53.035+00	2026-02-09 02:21:53.035+00	\N
d024df43-cf9b-41a7-bd77-60f9000e7e0f	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	How do I register for the Middle East Youth Summit?	Participants must register through the official Middle East Youth Summit website. Create a new account, complete your personal information, write an essay, complete the payment, and submit the application.	registration	2	t	2026-02-09 02:21:53.037+00	2026-02-09 02:21:53.037+00	\N
2c2138f4-d0e0-4356-8944-51d0625773da	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	Why can't I register myself?	Please refer to the registration guidelines. Registration is conducted through the official Middle East Youth Summit website.	registration	2	t	2026-02-09 02:21:53.039+00	2026-02-09 02:21:53.039+00	\N
3d510d95-c21d-4533-856b-e03e509c7a9c	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	How many delegates will be selected?	There will be 100 selected delegates for the Middle East Youth Summit (MEYS) program.	registration	2	t	2026-02-09 02:21:53.04+00	2026-02-09 02:21:53.04+00	\N
76612c51-e472-44fe-bdd3-5697ec57c444	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	What documents should we prepare for the application?	Participants only need to prepare an essay. For the rules of writing the essay, all the details can be found on the website.	registration	2	t	2026-02-09 02:21:53.042+00	2026-02-09 02:21:53.042+00	\N
394c7298-3f08-4987-a055-07f270b57c75	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	Where should I submit my application? 	When registering, you are only required to fill in your personal information and submit an essay. Please refer to the essay guidelines below.	registration	2	t	2026-02-09 02:21:53.044+00	2026-02-09 02:21:53.044+00	\N
effb9e5a-40c6-404b-a56a-3fd0eae21375	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	What are the requirements to join the Middle East Youth Summit?	The eligibility criteria is young Muslim aged 15 - 40 years old, open for any educational and nationality background, never been convicted of a crime , and not affiliated with any extremist organization. 	registration	2	t	2026-02-09 02:21:53.045+00	2026-02-09 02:21:53.045+00	\N
ca57d256-422d-4a61-afe9-d81b36e7209c	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	What is the age requirement to join the Middle East Youth Summit?	The minimum age is 15. If you are under 15, you can still join, but you must be accompanied by a guardian to avoid issues at immigration. The maximum age is 40. However, if you are over 40 and have the spirit of youth and a passion for community, you are still welcome to participate.	event_details	1	t	2026-02-09 02:21:53.047+00	2026-02-09 02:21:53.047+00	\N
cc0de1fc-d223-4ce2-8c6b-99691bc65d13	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	Is TOEFL or IELTS required for joining the program? 	No, a TOEFL or IELTS certificate is not required to participate in the program.	registration	2	t	2026-02-09 02:21:53.048+00	2026-02-09 02:21:53.048+00	\N
92d26aaa-3af2-484d-a820-f451b73f3561	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	How do we get the visa to attend the Middle East Youth Summit?	The participants will get the visa from the appointed travel agent in their origin countries. 	registration	2	t	2026-02-09 02:21:53.05+00	2026-02-09 02:21:53.05+00	\N
48bc7ab0-7c7d-4fc9-a1da-8de90b0f8b84	a1c30442-e6a2-4c13-97ba-797c99806e0a	What is the theme of the Korea Youth Summit?	The Istanbul Youth Summit 2025 will bring the theme  Cultural Heritage, Preservation Project with five subthemes:Education (SDG 4: Quality of Education), Economy (SDG 8: Decent Work and Economic Growth), Industry, Innovation, and Infrastructure (SDG 9),  and Sustainable Cities and Communities  (SDG 11)	event_details	1	t	2026-02-09 02:21:53.051+00	2026-02-09 02:21:53.051+00	\N
dbdc9fbd-6f04-4809-bdb1-7b96b118cf44	a1c30442-e6a2-4c13-97ba-797c99806e0a	What are the programs at the Korea Youth Summit?	Istanbul Youth Summit 2025 will be held for four days starting from June 16-19, 2025. The program will consist of an International Youth Summit, Global Panel Discussion, Competition on Social Projects and Sustainability, Cultural Performance, Awarding Ceremony, and Worldwide Networking	event_details	1	t	2026-02-09 02:21:53.053+00	2026-02-09 02:21:53.053+00	\N
a1b80be6-fffd-4291-a671-26238b4f5eed	a1c30442-e6a2-4c13-97ba-797c99806e0a	What are the objectives of the Korea Youth Summit?	The objectives of the Korea Youth Summit (KYS) are to cultivate the spirit of talented youth leaders across diverse fields, foster and nurture the character of youth leadership, establish a strong presence for youth on the international stage, develop the leadership capabilities of youth, empowering them to actively contribute to their country's development, and create a robust network and lasting connections among KYS alumni to Summit program for years to come.	event_details	1	t	2026-02-09 02:21:53.055+00	2026-02-09 02:21:53.055+00	\N
d75eaa56-bdcc-47d6-ab38-f7082a6704cb	a1c30442-e6a2-4c13-97ba-797c99806e0a	When will I get the announcement for the selected participants?	The registration will be held on December 5 - January 15 2025. Then we will give the announcement for the selected participants on April 15 - 20, 2025.	registration	2	t	2026-02-09 02:21:53.057+00	2026-02-09 02:21:53.057+00	\N
bf9a6c1c-8d5f-4af9-86ad-bc4999567284	a1c30442-e6a2-4c13-97ba-797c99806e0a	Why am I unable to sign up on my own?	Please review the instructions for the registration process. The registration can be completed on the following website.	registration	2	t	2026-02-09 02:21:53.059+00	2026-02-09 02:21:53.059+00	\N
12966321-db2f-4a8f-bf9f-6c6ef668b4db	a1c30442-e6a2-4c13-97ba-797c99806e0a	I submitted a payment, but it is still in the processing stage. Can you explain the delay?	Make sure that you have made a purchase with the selected payment method on our website. The process is automatic. Please contact koreayouthsummit@gmail.com or Whatsapp +62 851-7338-6622.	registration	2	t	2026-02-09 02:21:53.061+00	2026-02-09 02:21:53.061+00	\N
3baf84c0-0d7a-48c0-a3ef-f36c081de3c6	a1c30442-e6a2-4c13-97ba-797c99806e0a	Am I eligible for the fully funded participant?	All participants have the chance to receive full funding for the program. Your profile, application, essay, and interview will be carefully evaluated. Present your best self and seize this valuable opportunity.	registration	2	t	2026-02-09 02:21:53.062+00	2026-02-09 02:21:53.062+00	\N
e61ab82e-d689-46a3-847b-1a977c1e05e3	a1c30442-e6a2-4c13-97ba-797c99806e0a	If I am unable to participate in the Korea Youth Summit, am I eligible to receive a refund?	No, the registration fee as well as program fee aren’t entitled to refund.	registration	2	t	2026-02-09 02:21:53.063+00	2026-02-09 02:21:53.063+00	\N
ce1f5a29-1d53-485f-a821-b9e1fe02e3f1	a1c30442-e6a2-4c13-97ba-797c99806e0a	If my parents inquire about the individuals in charge of managing the project and handling public relations for this event, whose contact information should I provide them with?	You can contact KYS Project Manager on koreayouthsummit@gmail.com and KYS Public Relations on Whatsapp +62 851-7338-6622.	registration	2	t	2026-02-09 02:21:53.065+00	2026-02-09 02:21:53.065+00	\N
17c05c3d-d9d5-41b8-b672-d8829ff28e32	a1c30442-e6a2-4c13-97ba-797c99806e0a	Where should I submit my application?	Participants submit their application on the website https://koreayouthsummit.com	registration	2	t	2026-02-09 02:21:53.067+00	2026-02-09 02:21:53.067+00	\N
e565aaf4-f96d-4ef0-9c0e-ef495b0d215a	a1c30442-e6a2-4c13-97ba-797c99806e0a	How to register Korea Youth Summit?	Participants need to register through our website, https://koreayouthsummit.com	registration	2	t	2026-02-09 02:21:53.069+00	2026-02-09 02:21:53.069+00	\N
16cca26b-87ef-4554-a951-d6d4411b7464	a1c30442-e6a2-4c13-97ba-797c99806e0a	How to join Korea Youth Summit and secure the fully funded program?	The Korea Youth Summit program is funded by participants themselves, but we also offer a fully funded option for top participants. Those who qualify after the initial application process will be invited to participate in the interview round to be considered for the fully funded program.	registration	2	t	2026-02-09 02:21:53.07+00	2026-02-09 02:21:53.07+00	\N
552ba645-29f5-495d-a334-7e116254c686	a1c30442-e6a2-4c13-97ba-797c99806e0a	What documents should we prepare for the application?	Participants only need to prepare an essay. For the rules of writing the essay, all the details can be found in this guidelines.	registration	2	t	2026-02-09 02:21:53.072+00	2026-02-09 02:21:53.072+00	\N
f43112f1-9474-4830-96de-6a41c81c4083	a1c30442-e6a2-4c13-97ba-797c99806e0a	Is English required for joining the Korea Youth Summit?	All activities at the Korea Youth Summit will be conducted in English, so it is recommended that participants have a strong command of the language.	registration	2	t	2026-02-09 02:21:53.074+00	2026-02-09 02:21:53.074+00	\N
ce0d2970-66ca-4cc7-b6af-8ed2c543fa6c	a1c30442-e6a2-4c13-97ba-797c99806e0a	How can I confirm that my application and payment have been successfully submitted?	Participants will receive email confirmation from Youth Break the Boundaries when the application and payment is submitted successfully.	payment	3	t	2026-02-09 02:21:53.076+00	2026-02-09 02:21:53.076+00	\N
e8a5095a-3b3c-48de-95a4-dbbd0ab586bb	a1c30442-e6a2-4c13-97ba-797c99806e0a	What are the requirements to join Korea Youth Summit?	Individuals between the ages of 15 and 40, regardless of educational or nationality background, are eligible as long as they have not been involved in any criminal activities.	registration	2	t	2026-02-09 02:21:53.079+00	2026-02-09 02:21:53.079+00	\N
a20004c6-cb72-4bd2-ba4c-737bdfc8fa83	4487fb74-b208-4ddc-ac37-d1dab65a84c1	 What are the goals of the Youth Academic Forum?	The goals of the Youth Academic Forum program are to encourage academic\r\n collaboration and research among youth, showcase innovative research that addresses\r\n global challenges, and provide a platform for young researchers to present their work	event_details	4	t	2026-02-09 02:21:53.168+00	2026-02-09 02:21:53.168+00	\N
fdd8e30f-e11d-4a53-beb0-8d093db93869	4487fb74-b208-4ddc-ac37-d1dab65a84c1	 What are the goals of the Youth Academic Forum?	The goals of the Youth Academic Forum program are to encourage academic\r\n collaboration and research among youth, showcase innovative research that addresses\r\n global challenges, and provide a platform for young researchers to present their work	event_details	4	t	2026-02-09 02:21:53.17+00	2026-02-09 02:21:53.17+00	\N
a5dd50ef-d218-4109-b0a6-80099f0e9739	4487fb74-b208-4ddc-ac37-d1dab65a84c1	 When will I get the announcement for the selected participants?	The registration will start from July 1 - August 31, 2025, and Participants will\r\n receive feedback from the reviewer within a week of submission. They can\r\n revise and resubmit their abstract up to 3 times. Once the abstract is accepted,\r\n the participant will promptly receive the acceptance letter	registration	5	t	2026-02-09 02:21:53.174+00	2026-02-09 02:21:53.174+00	\N
30239d1f-b438-4af1-b2a1-1bbc027305c7	4487fb74-b208-4ddc-ac37-d1dab65a84c1	 When will I get the announcement for the selected participants?	The registration will start from July 1 - August 31, 2025, and Participants will\r\n receive feedback from the reviewer within a week of submission. They can\r\n revise and resubmit their abstract up to 3 times. Once the abstract is accepted,\r\n the participant will promptly receive the acceptance letter	registration	5	t	2026-02-09 02:21:53.177+00	2026-02-09 02:21:53.177+00	\N
8dcb175e-0e23-4af6-a08a-9eba0ee6463a	4487fb74-b208-4ddc-ac37-d1dab65a84c1	Why can't I register myself?	 Please read the guidelines for the registration process\r\n [ https://bit.ly/RegistrationYAF25 ]. The registration is on this website.	registration	6	t	2026-02-09 02:21:53.179+00	2026-02-09 02:21:53.179+00	\N
958ccd53-a785-4f60-93f3-8004e3f15389	4487fb74-b208-4ddc-ac37-d1dab65a84c1	 I made a payment but it is still pending. Why?	 Ensure that you have completed a purchase using the selected payment\r\n method on our website. The process is automatic. Please contact\r\n youthacademicforum@gmail.com or WhatsApp +62 851-7338-6622	payment	7	t	2026-02-09 02:21:53.181+00	2026-02-09 02:21:53.181+00	\N
c07fa364-e07c-4c8c-ac76-2852d5009ee1	4487fb74-b208-4ddc-ac37-d1dab65a84c1	Am I eligible for the fully funded participant program?	 All participants have the opportunity to be considered for a fully funded program.\r\n The committee will evaluate your profile, application form, abstract, and\r\n interview. Present the best version of yourself and seize this golden opportunity!\r\n	event_details	8	t	2026-02-09 02:21:53.184+00	2026-02-09 02:21:53.184+00	\N
8b016435-30be-40ae-91b8-db03c00ac424	4487fb74-b208-4ddc-ac37-d1dab65a84c1	Am I eligible for the fully funded participant program?	 All participants have the opportunity to be considered for a fully funded program.\r\n The committee will evaluate your profile, application form, abstract, and\r\n interview. Present the best version of yourself and seize this golden opportunity!\r\n	event_details	8	t	2026-02-09 02:21:53.185+00	2026-02-09 02:21:53.185+00	\N
df6d80f3-7493-4e55-93e0-7dfbb831638e	4487fb74-b208-4ddc-ac37-d1dab65a84c1	 If I am unable to attend the Youth Academic Forum, am I eligible for a refund?	 No, neither the registration fee nor the program fee is eligible for a refund.	registration	9	t	2026-02-09 02:21:53.188+00	2026-02-09 02:21:53.188+00	\N
28029519-969c-4186-9deb-ff083c678434	4487fb74-b208-4ddc-ac37-d1dab65a84c1	 If I am unable to attend the Youth Academic Forum, am I eligible for a refund?	 No, neither the registration fee nor the program fee is eligible for a refund.	registration	9	t	2026-02-09 02:21:53.193+00	2026-02-09 02:21:53.193+00	\N
cea39d9b-105e-4d5f-8105-52082076722d	4487fb74-b208-4ddc-ac37-d1dab65a84c1	 If my parents ask me who is the Project Manager and Public  Relations of this event, whose contact I should give?	You can contact the Project Manager at youthacademicforum@gmail.com\r\n and the Public Relations on WhatsApp +62 851-7338-6622	event_details	10	t	2026-02-09 02:21:53.197+00	2026-02-09 02:21:53.197+00	\N
63c9b245-5820-4f63-9362-7e12ecb11436	4487fb74-b208-4ddc-ac37-d1dab65a84c1	 If my parents ask me who is the Project Manager and Public  Relations of this event, whose contact I should give?	You can contact the Project Manager at youthacademicforum@gmail.com\r\n and the Public Relations on WhatsApp +62 851-7338-6622	event_details	10	t	2026-02-09 02:21:53.199+00	2026-02-09 02:21:53.199+00	\N
7004e318-e15a-43f3-a68f-3c9f2f91cbff	4487fb74-b208-4ddc-ac37-d1dab65a84c1	How to register for the Youth Academic Forum?	\r\n To register for the Youth Academic Forum, participants need to visit the Youth Academic\r\n Forum website. From there, they will create a new account, fill in their information details,\r\n write an abstract, ensure payment is complete, and finally submit the application form	registration	11	t	2026-02-09 02:21:53.2+00	2026-02-09 02:21:53.2+00	\N
6445daa7-c6ea-4a1d-8a0d-932e0bdef2be	eedb6e37-8d7d-438f-91a2-fb8c2635acdb	What is Istanbul Youth Summit?	Istanbul Youth Summit is a global platform for youth innovation.	general	1	t	2026-02-09 02:22:05.303+00	2026-02-09 02:22:05.303+00	\N
8a3ca64c-2749-4739-a61f-56d063d11b66	eedb6e37-8d7d-438f-91a2-fb8c2635acdb	Is accommodation provided?	Yes, accommodation is included in the full package.	accommodation	2	t	2026-02-09 02:22:05.303+00	2026-02-09 02:22:05.303+00	\N
2568a87e-09c5-471d-93a3-75981692366f	eedb6e37-8d7d-438f-91a2-fb8c2635acdb	How can I pay?	We accept Credit Cards and Bank Transfers.	payment	3	t	2026-02-09 02:22:05.303+00	2026-02-09 02:22:05.303+00	\N
15855f1a-4f1c-407d-853b-9670902cd79d	ee83ea00-0396-457a-9abd-85cf6b1c746f	What is World Youth Fest?	World Youth Fest is a global platform for youth innovation.	general	1	t	2026-02-09 02:22:05.316+00	2026-02-09 02:22:05.316+00	\N
cb78efe0-f7e2-44d2-86ac-27f2b8bd1f06	ee83ea00-0396-457a-9abd-85cf6b1c746f	Is accommodation provided?	Yes, accommodation is included in the full package.	accommodation	2	t	2026-02-09 02:22:05.316+00	2026-02-09 02:22:05.316+00	\N
781986d1-ed3a-4054-82b5-189916eecc33	ee83ea00-0396-457a-9abd-85cf6b1c746f	How can I pay?	We accept Credit Cards and Bank Transfers.	payment	3	t	2026-02-09 02:22:05.316+00	2026-02-09 02:22:05.316+00	\N
5f043e9a-2118-46c6-847d-41a3adc50801	9412ce6a-cbd5-4789-9291-b3121f18526d	What is Middle East Youth Summit?	Middle East Youth Summit is a global platform for youth innovation.	general	1	t	2026-02-09 02:22:05.334+00	2026-02-09 02:22:05.334+00	\N
ddf8e8d6-1eab-4818-bb6d-9a61092b859b	9412ce6a-cbd5-4789-9291-b3121f18526d	Is accommodation provided?	Yes, accommodation is included in the full package.	accommodation	2	t	2026-02-09 02:22:05.334+00	2026-02-09 02:22:05.334+00	\N
57a790f1-6263-4249-b188-48e275972278	9412ce6a-cbd5-4789-9291-b3121f18526d	How can I pay?	We accept Credit Cards and Bank Transfers.	payment	3	t	2026-02-09 02:22:05.334+00	2026-02-09 02:22:05.334+00	\N
9d751ba2-8dc9-450c-846a-5d71ea9030fb	359aaba8-b950-44b2-951c-6a10b61fdaf8	What is Korea Youth Summit?	Korea Youth Summit is a global platform for youth innovation.	general	1	t	2026-02-09 02:22:05.352+00	2026-02-09 02:22:05.352+00	\N
beb463ac-86e7-4b01-a8e8-cb2fa5c78215	359aaba8-b950-44b2-951c-6a10b61fdaf8	Is accommodation provided?	Yes, accommodation is included in the full package.	accommodation	2	t	2026-02-09 02:22:05.352+00	2026-02-09 02:22:05.352+00	\N
0c291c1b-2ba1-4fd5-b489-529a5becc516	359aaba8-b950-44b2-951c-6a10b61fdaf8	How can I pay?	We accept Credit Cards and Bank Transfers.	payment	3	t	2026-02-09 02:22:05.352+00	2026-02-09 02:22:05.352+00	\N
281e0e39-0e43-4bb5-9133-eab402482174	05f66b78-e261-4e30-8d9e-b377e83df3ca	What is Youth Academic Forum?	Youth Academic Forum is a global platform for youth innovation.	general	1	t	2026-02-09 02:22:05.369+00	2026-02-09 02:22:05.369+00	\N
061506d5-9649-4f36-a67e-5de91c99aaaf	05f66b78-e261-4e30-8d9e-b377e83df3ca	Is accommodation provided?	Yes, accommodation is included in the full package.	accommodation	2	t	2026-02-09 02:22:05.369+00	2026-02-09 02:22:05.369+00	\N
bdb84a80-0aec-460a-b6bc-520fc2158c45	05f66b78-e261-4e30-8d9e-b377e83df3ca	How can I pay?	We accept Credit Cards and Bank Transfers.	payment	3	t	2026-02-09 02:22:05.369+00	2026-02-09 02:22:05.369+00	\N
e5f49b17-1091-483d-89bd-77f4e0e37d7c	0d660fb3-b707-47c4-8969-4282653cb745	What is Japan Youth Summit?	Japan Youth Summit is a global platform for youth innovation.	general	1	t	2026-02-09 02:22:05.449+00	2026-02-09 02:22:05.449+00	\N
ba33ec46-c3c7-4274-b4f5-9ce08ae19e46	0d660fb3-b707-47c4-8969-4282653cb745	Is accommodation provided?	Yes, accommodation is included in the full package.	accommodation	2	t	2026-02-09 02:22:05.449+00	2026-02-09 02:22:05.449+00	\N
48f2e203-51ba-4aa7-ad01-ab788e90999d	0d660fb3-b707-47c4-8969-4282653cb745	How can I pay?	We accept Credit Cards and Bank Transfers.	payment	3	t	2026-02-09 02:22:05.449+00	2026-02-09 02:22:05.449+00	\N
3ef2bf7e-669b-4964-91c9-34e52cad9c84	c007679c-7ed9-4d3e-a4cb-dbe99dbdc3a6	What is Vietnam Youth Summit?	Vietnam Youth Summit is a global platform for youth innovation.	general	1	t	2026-02-09 02:22:05.457+00	2026-02-09 02:22:05.457+00	\N
d9848037-bc61-41ad-8f8d-fef27490688f	c007679c-7ed9-4d3e-a4cb-dbe99dbdc3a6	Is accommodation provided?	Yes, accommodation is included in the full package.	accommodation	2	t	2026-02-09 02:22:05.457+00	2026-02-09 02:22:05.457+00	\N
28d1731f-d5b8-4277-8475-550563adc751	c007679c-7ed9-4d3e-a4cb-dbe99dbdc3a6	How can I pay?	We accept Credit Cards and Bank Transfers.	payment	3	t	2026-02-09 02:22:05.457+00	2026-02-09 02:22:05.457+00	\N
\.


--
-- Data for Name: program_gallery; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.program_gallery (id, program_id, image_url, video_url, title, description, type, "order", is_active, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: program_objectives; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.program_objectives (id, program_id, description, "order", is_active, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: program_participation_categories; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.program_participation_categories (id, program_id, name, description, benefits, eligibility, "order", is_active, created_at, updated_at) FROM stdin;
1af11483-fdb4-46e4-a62a-f1509239444d	eedb6e37-8d7d-438f-91a2-fb8c2635acdb	High School Students	For students currently enrolled in high school (ages 15-18).	Certificate of Participation, Mentorship Sessions, Networking with Peers	Must be currently enrolled in high school. Must have parental consent.	1	t	2026-02-09 02:22:05.308+00	2026-02-09 02:22:05.308+00
10008ef9-a2e7-4dcb-8f1d-1e7e801e43e3	eedb6e37-8d7d-438f-91a2-fb8c2635acdb	Future Innovators	For university students and young professionals (ages 18-30).	Access to Investor Pitch, Advanced Workshops, Career Fair	Must be 18+ years old. Open to all nationalities.	2	t	2026-02-09 02:22:05.308+00	2026-02-09 02:22:05.308+00
ae9da6da-3b90-4e89-a022-e172edae8cdc	ee83ea00-0396-457a-9abd-85cf6b1c746f	High School Students	For students currently enrolled in high school (ages 15-18).	Certificate of Participation, Mentorship Sessions, Networking with Peers	Must be currently enrolled in high school. Must have parental consent.	1	t	2026-02-09 02:22:05.324+00	2026-02-09 02:22:05.324+00
c6992c8e-2e0d-4c3d-99b9-53b7c955337f	ee83ea00-0396-457a-9abd-85cf6b1c746f	Future Innovators	For university students and young professionals (ages 18-30).	Access to Investor Pitch, Advanced Workshops, Career Fair	Must be 18+ years old. Open to all nationalities.	2	t	2026-02-09 02:22:05.324+00	2026-02-09 02:22:05.324+00
b8baed75-0956-4493-84ac-d09f75c71996	9412ce6a-cbd5-4789-9291-b3121f18526d	High School Students	For students currently enrolled in high school (ages 15-18).	Certificate of Participation, Mentorship Sessions, Networking with Peers	Must be currently enrolled in high school. Must have parental consent.	1	t	2026-02-09 02:22:05.343+00	2026-02-09 02:22:05.343+00
3f7af141-1494-4ea1-a48f-f223e262bd08	9412ce6a-cbd5-4789-9291-b3121f18526d	Future Innovators	For university students and young professionals (ages 18-30).	Access to Investor Pitch, Advanced Workshops, Career Fair	Must be 18+ years old. Open to all nationalities.	2	t	2026-02-09 02:22:05.343+00	2026-02-09 02:22:05.343+00
7cafac51-4444-4ea0-a640-20650529b993	359aaba8-b950-44b2-951c-6a10b61fdaf8	High School Students	For students currently enrolled in high school (ages 15-18).	Certificate of Participation, Mentorship Sessions, Networking with Peers	Must be currently enrolled in high school. Must have parental consent.	1	t	2026-02-09 02:22:05.36+00	2026-02-09 02:22:05.36+00
0e6ba069-1472-4a3c-8fe9-70758afe4328	359aaba8-b950-44b2-951c-6a10b61fdaf8	Future Innovators	For university students and young professionals (ages 18-30).	Access to Investor Pitch, Advanced Workshops, Career Fair	Must be 18+ years old. Open to all nationalities.	2	t	2026-02-09 02:22:05.36+00	2026-02-09 02:22:05.36+00
6df6e7d3-e5aa-43d7-9da8-04a418a8b64f	05f66b78-e261-4e30-8d9e-b377e83df3ca	High School Students	For students currently enrolled in high school (ages 15-18).	Certificate of Participation, Mentorship Sessions, Networking with Peers	Must be currently enrolled in high school. Must have parental consent.	1	t	2026-02-09 02:22:05.374+00	2026-02-09 02:22:05.374+00
1e39a975-dfaf-4ab9-9542-c71cbab89610	05f66b78-e261-4e30-8d9e-b377e83df3ca	Future Innovators	For university students and young professionals (ages 18-30).	Access to Investor Pitch, Advanced Workshops, Career Fair	Must be 18+ years old. Open to all nationalities.	2	t	2026-02-09 02:22:05.374+00	2026-02-09 02:22:05.374+00
7c2a7bfe-88f0-4e08-bb68-107e7db9b44e	0d660fb3-b707-47c4-8969-4282653cb745	High School Students	For students currently enrolled in high school (ages 15-18).	Certificate of Participation, Mentorship Sessions, Networking with Peers	Must be currently enrolled in high school. Must have parental consent.	1	t	2026-02-09 02:22:05.452+00	2026-02-09 02:22:05.452+00
7213554b-3412-4eab-a619-9ed6966102d9	0d660fb3-b707-47c4-8969-4282653cb745	Future Innovators	For university students and young professionals (ages 18-30).	Access to Investor Pitch, Advanced Workshops, Career Fair	Must be 18+ years old. Open to all nationalities.	2	t	2026-02-09 02:22:05.452+00	2026-02-09 02:22:05.452+00
05693722-2c46-4b86-8151-ce2fb17887d4	c007679c-7ed9-4d3e-a4cb-dbe99dbdc3a6	High School Students	For students currently enrolled in high school (ages 15-18).	Certificate of Participation, Mentorship Sessions, Networking with Peers	Must be currently enrolled in high school. Must have parental consent.	1	t	2026-02-09 02:22:05.46+00	2026-02-09 02:22:05.46+00
9d1085b3-132d-4c07-bdbe-29fecc94d4c8	c007679c-7ed9-4d3e-a4cb-dbe99dbdc3a6	Future Innovators	For university students and young professionals (ages 18-30).	Access to Investor Pitch, Advanced Workshops, Career Fair	Must be 18+ years old. Open to all nationalities.	2	t	2026-02-09 02:22:05.46+00	2026-02-09 02:22:05.46+00
\.


--
-- Data for Name: program_participation_infos; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.program_participation_infos (id, program_id, category, hero_title, hero_description, benefits, requirements, sections, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: program_partners; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.program_partners (id, program_id, name, type, role, logo_url, website_url, description, "order", is_active, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: program_pricing_tiers; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.program_pricing_tiers (id, program_id, name, description, price, currency, capacity, current_count, benefits, requirements, fee_type, icon, sold_count, is_active, "order", created_at, updated_at, deleted_at, allowed_categories) FROM stdin;
00000000-0000-0000-0000-000000000001	723cbfda-d5ba-40c1-80b0-c90eab48049f	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:55.259+00	2026-02-09 02:21:55.259+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000002	723cbfda-d5ba-40c1-80b0-c90eab48049f	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:55.523+00	2026-02-09 02:21:55.523+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000003	723cbfda-d5ba-40c1-80b0-c90eab48049f	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:55.629+00	2026-02-09 02:21:55.629+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000004	723cbfda-d5ba-40c1-80b0-c90eab48049f	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:55.656+00	2026-02-09 02:21:55.656+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000005	22eeb004-f921-492a-af50-6d6afbbbe97c	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:55.681+00	2026-02-09 02:21:55.681+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000006	22eeb004-f921-492a-af50-6d6afbbbe97c	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:55.708+00	2026-02-09 02:21:55.708+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000007	22eeb004-f921-492a-af50-6d6afbbbe97c	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:55.735+00	2026-02-09 02:21:55.735+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000008	22eeb004-f921-492a-af50-6d6afbbbe97c	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:55.759+00	2026-02-09 02:21:55.759+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000009	4487fb74-b208-4ddc-ac37-d1dab65a84c1	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:55.782+00	2026-02-09 02:21:55.782+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000010	a1c30442-e6a2-4c13-97ba-797c99806e0a	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:55.808+00	2026-02-09 02:21:55.808+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000011	4487fb74-b208-4ddc-ac37-d1dab65a84c1	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:55.833+00	2026-02-09 02:21:55.833+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000012	4487fb74-b208-4ddc-ac37-d1dab65a84c1	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:55.866+00	2026-02-09 02:21:55.866+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000013	4487fb74-b208-4ddc-ac37-d1dab65a84c1	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:55.892+00	2026-02-09 02:21:55.892+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000014	a1c30442-e6a2-4c13-97ba-797c99806e0a	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:55.918+00	2026-02-09 02:21:55.918+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000015	a1c30442-e6a2-4c13-97ba-797c99806e0a	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:55.943+00	2026-02-09 02:21:55.943+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000016	a1c30442-e6a2-4c13-97ba-797c99806e0a	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:55.965+00	2026-02-09 02:21:55.965+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000017	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:55.99+00	2026-02-09 02:21:55.99+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000018	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:56.015+00	2026-02-09 02:21:56.015+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000019	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:56.042+00	2026-02-09 02:21:56.042+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000020	532ac7e2-ff62-4587-92cf-37c12387fbcf	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:56.155+00	2026-02-09 02:21:56.155+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000021	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:56.179+00	2026-02-09 02:21:56.179+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000022	532ac7e2-ff62-4587-92cf-37c12387fbcf	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:56.204+00	2026-02-09 02:21:56.204+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000023	532ac7e2-ff62-4587-92cf-37c12387fbcf	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:56.227+00	2026-02-09 02:21:56.227+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000024	532ac7e2-ff62-4587-92cf-37c12387fbcf	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:56.251+00	2026-02-09 02:21:56.251+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000026	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:56.279+00	2026-02-09 02:21:56.279+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000027	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:56.312+00	2026-02-09 02:21:56.312+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000036	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	Main Period	Migrated from original payment date range	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:56.831+00	2026-02-09 02:21:56.831+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000037	4487fb74-b208-4ddc-ac37-d1dab65a84c1	Extension Period	Extended registration period for late applicants	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:57.076+00	2026-02-09 02:21:57.076+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000038	4487fb74-b208-4ddc-ac37-d1dab65a84c1	Extension Registration	Extended deadline for late applicants	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:57.101+00	2026-02-09 02:21:57.101+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000039	4487fb74-b208-4ddc-ac37-d1dab65a84c1	Final Extension	Last chance registration period	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:57.202+00	2026-02-09 02:21:57.202+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000040	4487fb74-b208-4ddc-ac37-d1dab65a84c1	Main Period	Default availability period - please update as needed	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:57.225+00	2026-02-09 02:21:57.225+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000042	22eeb004-f921-492a-af50-6d6afbbbe97c	Main Period	Default availability period - please update as needed	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:57.249+00	2026-02-09 02:21:57.249+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000043	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	Second Period		0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:57.274+00	2026-02-09 02:21:57.274+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000054	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	Additional Period	Additional Period	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:57.412+00	2026-02-09 02:21:57.412+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000055	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	Additional Period	Additional Period	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:57.435+00	2026-02-09 02:21:57.435+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000056	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	Additional Period	Additional Period	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:57.456+00	2026-02-09 02:21:57.456+00	\N	{self_funded,fully_funded}
00000000-0000-0000-0000-000000000084	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	Additional Period	Additional Period	0.00	USD	0	0	{}	{}	full_fee	\N	0	t	0	2026-02-09 02:21:58.798+00	2026-02-09 02:21:58.798+00	\N	{self_funded,fully_funded}
58ecc656-d5c8-480d-93cf-5c70b9f6de65	eedb6e37-8d7d-438f-91a2-fb8c2635acdb	Regular Access	Full access to the 3-day event.	350.00	USD	0	0	{}	{}	full_fee	\N	0	t	1	2026-02-09 02:22:05.306+00	2026-02-09 02:22:05.306+00	\N	{self_funded}
75d8ac15-fda6-4b74-99f7-8242d4f3b6e9	eedb6e37-8d7d-438f-91a2-fb8c2635acdb	Scholarship Registration	Admin fee for fully funded applicants.	15.00	USD	0	0	{}	{}	registration_fee	\N	0	t	2	2026-02-09 02:22:05.306+00	2026-02-09 02:22:05.306+00	\N	{fully_funded}
81e28ee3-fe53-48ec-afb9-a3af1e639361	ee83ea00-0396-457a-9abd-85cf6b1c746f	Regular Access	Full access to the 3-day event.	350.00	USD	0	0	{}	{}	full_fee	\N	0	t	1	2026-02-09 02:22:05.322+00	2026-02-09 02:22:05.322+00	\N	{self_funded}
3b2531cf-3491-479c-9e44-1e88a8812f36	ee83ea00-0396-457a-9abd-85cf6b1c746f	Scholarship Registration	Admin fee for fully funded applicants.	15.00	USD	0	0	{}	{}	registration_fee	\N	0	t	2	2026-02-09 02:22:05.322+00	2026-02-09 02:22:05.322+00	\N	{fully_funded}
60151c26-79b8-4517-8fa8-d82bf78f9b19	9412ce6a-cbd5-4789-9291-b3121f18526d	Regular Access	Full access to the 3-day event.	350.00	USD	0	0	{}	{}	full_fee	\N	0	t	1	2026-02-09 02:22:05.34+00	2026-02-09 02:22:05.34+00	\N	{self_funded}
78e40077-5751-41b1-a371-57752da8a73b	9412ce6a-cbd5-4789-9291-b3121f18526d	Scholarship Registration	Admin fee for fully funded applicants.	15.00	USD	0	0	{}	{}	registration_fee	\N	0	t	2	2026-02-09 02:22:05.34+00	2026-02-09 02:22:05.34+00	\N	{fully_funded}
27b54dea-674b-4993-97db-af7acb60b07b	359aaba8-b950-44b2-951c-6a10b61fdaf8	Regular Access	Full access to the 3-day event.	350.00	USD	0	0	{}	{}	full_fee	\N	0	t	1	2026-02-09 02:22:05.358+00	2026-02-09 02:22:05.358+00	\N	{self_funded}
9f76b509-61e3-4858-addd-b4f4f1f9bea3	359aaba8-b950-44b2-951c-6a10b61fdaf8	Scholarship Registration	Admin fee for fully funded applicants.	15.00	USD	0	0	{}	{}	registration_fee	\N	0	t	2	2026-02-09 02:22:05.358+00	2026-02-09 02:22:05.358+00	\N	{fully_funded}
609e1c8d-7fd6-41e3-94d6-c250af8cedd6	05f66b78-e261-4e30-8d9e-b377e83df3ca	Regular Access	Full access to the 3-day event.	350.00	USD	0	0	{}	{}	full_fee	\N	0	t	1	2026-02-09 02:22:05.372+00	2026-02-09 02:22:05.372+00	\N	{self_funded}
71776621-b2f0-4ffd-a4a9-793cf1fc4268	05f66b78-e261-4e30-8d9e-b377e83df3ca	Scholarship Registration	Admin fee for fully funded applicants.	15.00	USD	0	0	{}	{}	registration_fee	\N	0	t	2	2026-02-09 02:22:05.372+00	2026-02-09 02:22:05.372+00	\N	{fully_funded}
6827415e-c172-4c34-a699-7129bbb244af	0d660fb3-b707-47c4-8969-4282653cb745	Regular Access	Full access to the 3-day event.	350.00	USD	0	0	{}	{}	full_fee	\N	0	t	1	2026-02-09 02:22:05.451+00	2026-02-09 02:22:05.451+00	\N	{self_funded}
6ced7089-efb2-4d13-be01-1391bea0dffe	0d660fb3-b707-47c4-8969-4282653cb745	Scholarship Registration	Admin fee for fully funded applicants.	15.00	USD	0	0	{}	{}	registration_fee	\N	0	t	2	2026-02-09 02:22:05.451+00	2026-02-09 02:22:05.451+00	\N	{fully_funded}
dc46a8d8-90df-4c5a-a5cc-4fa36711eea7	c007679c-7ed9-4d3e-a4cb-dbe99dbdc3a6	Regular Access	Full access to the 3-day event.	350.00	USD	0	0	{}	{}	full_fee	\N	0	t	1	2026-02-09 02:22:05.458+00	2026-02-09 02:22:05.458+00	\N	{self_funded}
8c05eba0-bbbe-45de-ae33-e327f265c8eb	c007679c-7ed9-4d3e-a4cb-dbe99dbdc3a6	Scholarship Registration	Admin fee for fully funded applicants.	15.00	USD	0	0	{}	{}	registration_fee	\N	0	t	2	2026-02-09 02:22:05.458+00	2026-02-09 02:22:05.458+00	\N	{fully_funded}
\.


--
-- Data for Name: program_requirements; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.program_requirements (id, program_id, name, description, type, file_max_size, file_allowed_types, options, is_required, "order", is_active, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: program_resources; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.program_resources (id, program_id, title, description, file_url, file_size, file_type, type, is_public, downloads, "order", is_active, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: program_schedules; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.program_schedules (id, program_id, day, start_time, end_time, activity, description, location, speaker, "order", is_active, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: program_speakers; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.program_speakers (id, program_id, name, title, organization, bio, photo_url, email, linkedin_url, twitter_url, "order", is_active, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: program_subthemes; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.program_subthemes (id, program_id, name, description, "order", is_active, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: program_tag_relations; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.program_tag_relations (program_id, tag_id) FROM stdin;
\.


--
-- Data for Name: program_tags; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.program_tags (id, name, slug, description, color, is_active, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: program_team; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.program_team (id, brand_id, program_id, name, role, bio, photo_url, email, phone, linkedin_url, "order", is_active, created_at, updated_at, deleted_at) FROM stdin;
14da64c7-ee34-4d49-926c-1d3912a3862c	b46695c9-e58b-45a4-a930-56822cb0d560	\N	John Doe	Founder & CEO	Visionary leader with 10+ years in youth empowerment.	https://placehold.co/400x400?text=CEO	\N	\N	\N	1	t	2026-02-09 02:22:05.212+00	2026-02-09 02:22:05.212+00	\N
af8b7831-b6db-400c-b13b-0bb46eebb7e5	b46695c9-e58b-45a4-a930-56822cb0d560	\N	Jane Smith	Director of Partnerships	Connecting global organizations for impact.	https://placehold.co/400x400?text=Director	\N	\N	\N	2	t	2026-02-09 02:22:05.212+00	2026-02-09 02:22:05.212+00	\N
\.


--
-- Data for Name: program_testimonials; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.program_testimonials (id, program_id, brand_id, name, role, company, testimonial, category, type, video_url, thumbnail_url, avatar_url, rating, is_featured, is_active, "order", created_at, updated_at, deleted_at) FROM stdin;
9540295f-8741-45ac-8ccf-256607396141	\N	b46695c9-e58b-45a4-a930-56822cb0d560	Alice Johnson	Alumni 2020	\N	YBB changed my life and career trajectory.	alumni	text	\N	\N	https://placehold.co/100x100?text=Alice	\N	t	t	1	2026-02-09 02:22:05.215+00	2026-02-09 02:22:05.215+00	\N
\.


--
-- Data for Name: program_timeline; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.program_timeline (id, program_id, date, end_date, title, description, icon, type, completion_type, completion_config, target_audience, "order", is_active, created_at, updated_at, deleted_at) FROM stdin;
f77fd2b1-7527-4e3c-9eff-bd239e19c393	723cbfda-d5ba-40c1-80b0-c90eab48049f	2024-05-05 14:15:27+00	2024-06-05 14:15:27+00	Participant Registration	desc	\N	custom	date_passed	{}	all	1	t	2026-02-09 02:21:54.608+00	2026-02-09 02:21:54.608+00	\N
d3e2ae20-3c99-4550-8d9f-8089363a18cf	723cbfda-d5ba-40c1-80b0-c90eab48049f	2024-06-10 14:15:27+00	2024-06-20 14:15:27+00	LoA Announcement for Participants	desc	\N	custom	date_passed	{}	all	2	t	2026-02-09 02:21:54.613+00	2026-02-09 02:21:54.613+00	\N
324405c3-d3dc-468b-bcb2-2bb789b232fa	723cbfda-d5ba-40c1-80b0-c90eab48049f	2024-07-20 14:15:27+00	2024-07-20 14:15:27+00	Payment Deadline for Batch 1\r\n	desc	\N	custom	date_passed	{}	all	3	t	2026-02-09 02:21:54.615+00	2026-02-09 02:21:54.615+00	\N
bdd91509-f557-4e10-ade4-03842c3baef5	723cbfda-d5ba-40c1-80b0-c90eab48049f	2024-08-01 14:15:27+00	2024-08-05 14:15:27+00	Interview Announcement for Fully Funded Participants	desc	\N	custom	date_passed	{}	all	4	t	2026-02-09 02:21:54.617+00	2026-02-09 02:21:54.617+00	\N
8f4dcc9f-e160-45fe-bf38-6e8d8948c9c3	723cbfda-d5ba-40c1-80b0-c90eab48049f	2024-08-05 14:15:27+00	2024-08-15 14:15:27+00	Fully Funded Interview	desc	\N	custom	date_passed	{}	all	5	t	2026-02-09 02:21:54.619+00	2026-02-09 02:21:54.619+00	\N
e1b78d72-0820-4a72-8049-e24622f85271	723cbfda-d5ba-40c1-80b0-c90eab48049f	2024-08-20 14:15:27+00	2024-08-20 14:15:27+00	Payment Deadline for Batch 2\r\n	desc	\N	custom	date_passed	{}	all	6	t	2026-02-09 02:21:54.621+00	2026-02-09 02:21:54.621+00	\N
e603e991-855b-47cf-9a0b-1340d895c2fb	723cbfda-d5ba-40c1-80b0-c90eab48049f	2024-09-01 14:15:27+00	2024-09-05 14:15:27+00	Final Announcement for Fully Funded Participants	desc	\N	custom	date_passed	{}	all	7	t	2026-02-09 02:21:54.623+00	2026-02-09 02:21:54.623+00	\N
87f93c0e-0754-4408-bcd5-a3f8337522fa	723cbfda-d5ba-40c1-80b0-c90eab48049f	2024-10-05 14:15:27+00	2024-10-08 14:15:27+00	World Youth Festival 2024\r\n	desc	\N	custom	date_passed	{}	all	8	t	2026-02-09 02:21:54.625+00	2026-02-09 02:21:54.625+00	\N
86faf072-ab44-4e67-b73a-30d4d57d01c1	22eeb004-f921-492a-af50-6d6afbbbe97c	2024-08-01 00:00:00+00	2024-09-30 00:00:00+00	Participant Registration	\t\r\nParticipant Registration (Fully Funded)	\N	custom	date_passed	{}	all	1	t	2026-02-09 02:21:54.63+00	2026-02-09 02:21:54.63+00	\N
66ff115b-1558-4da6-9e9f-da5e7e912786	22eeb004-f921-492a-af50-6d6afbbbe97c	2024-09-10 00:00:00+00	2024-09-30 00:00:00+00	LoA Announcement for Participants	Letters of Acceptance (LoA) will be officially announced for selected participants. Check your email and the official website to confirm your selection and next steps for the Istanbul Youth Summit 2025.	\N	custom	date_passed	{}	all	2	t	2026-02-09 02:21:54.633+00	2026-02-09 02:21:54.633+00	\N
d4536ca7-acbc-46e3-afb8-465d74104f0e	723cbfda-d5ba-40c1-80b0-c90eab48049f	2024-11-20 14:15:27+00	2024-11-20 14:15:27+00	Payment Deadline for Batch 1\r\n	desc	\N	custom	date_passed	{}	all	3	t	2026-02-09 02:21:54.635+00	2026-02-09 02:21:54.635+00	\N
450f20a8-e27f-4b50-94c8-f27d5b14f814	22eeb004-f921-492a-af50-6d6afbbbe97c	2024-12-01 00:00:00+00	2024-12-05 00:00:00+00	Interview Announcement for Fully Funded Participants	Selected applicants for the fully funded program will be invited to an interview. Check your email and the official website for the schedule and further instructions.	\N	custom	date_passed	{}	all	4	t	2026-02-09 02:21:54.637+00	2026-02-09 02:21:54.637+00	\N
8d33b0ce-6fe3-4fa4-b820-73a7a39e0f53	22eeb004-f921-492a-af50-6d6afbbbe97c	2024-12-06 00:00:00+00	2024-12-10 00:00:00+00	Fully Funded Interview	Shortlisted candidates for the fully funded program will undergo an interview process to assess their qualifications and motivation. Stay tuned to your email and the official website for updates and interview details.	\N	custom	date_passed	{}	all	5	t	2026-02-09 02:21:54.639+00	2026-02-09 02:21:54.639+00	\N
72670a5f-9639-4fde-9753-09fc405d440b	22eeb004-f921-492a-af50-6d6afbbbe97c	2024-12-20 00:00:00+00	2024-12-20 00:00:00+00	Second Installment Payment Deadline	Second Installment Payment Due Date.	\N	custom	date_passed	{}	all	7	t	2026-02-09 02:21:54.641+00	2026-02-09 02:21:54.641+00	\N
0679e531-1f9c-4437-b4c3-e2564b840b39	22eeb004-f921-492a-af50-6d6afbbbe97c	2025-01-01 00:00:00+00	2025-01-05 00:00:00+00	Final Announcement for Fully Funded Participants	The final list of fully funded participants will be officially announced. Check your email and the official website to confirm your selection and follow the next steps for the Istanbul Youth Summit 2025.	\N	custom	date_passed	{}	all	7	t	2026-02-09 02:21:54.645+00	2026-02-09 02:21:54.645+00	\N
c7aa29de-3d97-41fe-b936-cc9b546bffff	22eeb004-f921-492a-af50-6d6afbbbe97c	2025-02-17 00:00:00+00	2025-02-20 00:00:00+00	Istanbul Youth Summit 2025	Istanbul Youth Summit 2025 Program	\N	custom	date_passed	{}	all	8	t	2026-02-09 02:21:54.647+00	2026-02-09 02:21:54.647+00	\N
287f53c3-a6f7-42d0-ba9b-03dec009018a	a1c30442-e6a2-4c13-97ba-797c99806e0a	2024-12-15 00:00:00+00	2025-02-28 00:00:00+00	Participant Registration	Participant Registration	\N	custom	date_passed	{}	all	1	t	2026-02-09 02:21:54.651+00	2026-02-09 02:21:54.651+00	\N
3c0940c9-01e0-4a13-8d8a-2b8a0cbe024b	a1c30442-e6a2-4c13-97ba-797c99806e0a	2025-03-05 00:00:00+00	2025-03-10 00:00:00+00	LOA Announcement	LOA Announcement (Batch 1 for those who completed registration until February 28, 2025)	\N	custom	date_passed	{}	all	2	t	2026-02-09 02:21:54.653+00	2026-02-09 02:21:54.653+00	\N
e162a23c-f707-41ee-933e-d3755ad4089c	a1c30442-e6a2-4c13-97ba-797c99806e0a	2025-03-05 00:00:00+00	2025-04-16 00:00:00+00	First Installment Payment	First Installment Payment	\N	custom	date_passed	{}	all	5	t	2026-02-09 02:21:54.655+00	2026-02-09 02:21:54.655+00	\N
4169f88f-a694-444a-9227-cc3631fbbfff	a1c30442-e6a2-4c13-97ba-797c99806e0a	2025-03-01 00:00:00+00	2025-03-31 00:00:00+00	Participant Registration	Extension of Registration Time	\N	custom	date_passed	{}	all	3	t	2026-02-09 02:21:54.657+00	2026-02-09 02:21:54.657+00	\N
2e4d94ca-9da4-48c5-8a31-074d54216c45	a1c30442-e6a2-4c13-97ba-797c99806e0a	2025-04-05 00:00:00+00	2025-04-10 00:00:00+00	LOA Announcement	LOA Announcement (Batch 2 for those who completed registration until February 28, 2025)	\N	custom	date_passed	{}	all	4	t	2026-02-09 02:21:54.658+00	2026-02-09 02:21:54.658+00	\N
f23e2fc1-8e89-4821-a783-dc9e0aa31cd7	a1c30442-e6a2-4c13-97ba-797c99806e0a	2025-03-05 00:00:00+00	2025-05-16 00:00:00+00	Second Installment Payment	Second Installment Payment	\N	custom	date_passed	{}	all	6	t	2026-02-09 02:21:54.66+00	2026-02-09 02:21:54.66+00	\N
421f4081-f920-433a-9862-3a3050d31dbe	a1c30442-e6a2-4c13-97ba-797c99806e0a	2025-04-20 00:00:00+00	2025-04-30 00:00:00+00	Interview Announcement for Fully Funded Participants	Interview Announcement for Fully Funded Participants	\N	custom	date_passed	{}	all	7	t	2026-02-09 02:21:54.661+00	2026-02-09 02:21:54.661+00	\N
e16dd2de-79df-4b91-bd83-afabe0c35b27	a1c30442-e6a2-4c13-97ba-797c99806e0a	2025-05-01 00:00:00+00	2025-05-11 00:00:00+00	Fully Funded Interview	Fully Funded Interview	\N	custom	date_passed	{}	all	8	t	2026-02-09 02:21:54.663+00	2026-02-09 02:21:54.663+00	\N
e46d9a1e-36ca-4a04-93a1-1b5e5c8689fa	a1c30442-e6a2-4c13-97ba-797c99806e0a	2025-05-15 00:00:00+00	2025-05-25 00:00:00+00	Final Announcement for Fully Funded Participants	Final Announcement for Fully Funded Participants	\N	custom	date_passed	{}	all	9	t	2026-02-09 02:21:54.665+00	2026-02-09 02:21:54.665+00	\N
50fa4c5b-adf9-4b94-a01a-da3fce451dfd	a1c30442-e6a2-4c13-97ba-797c99806e0a	2025-06-30 00:00:00+00	2025-07-03 00:00:00+00	Korea Youth Summit Program	Korea Youth Summit Program	\N	custom	date_passed	{}	all	10	t	2026-02-09 02:21:54.668+00	2026-02-09 02:21:54.668+00	\N
6698c4ed-26ab-4c34-9deb-048a582cdc61	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	2025-04-20 00:00:00+00	2025-06-15 00:00:00+00	Participant Registration	During this period, aspiring young entrepreneurs from around the world are invited to submit their applications to join this prestigious international competition.\r\n	\N	custom	date_passed	{}	all	1	t	2026-02-09 02:21:54.67+00	2026-02-09 02:21:54.67+00	\N
c5ff6f64-fe40-4f8b-87d4-3cee8569ddc7	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	2025-06-20 00:00:00+00	2025-06-30 00:00:00+00	Letter of Acceptance (LoA) Announcement	Successful applicants will receive their official Letters of Acceptance, marking the first step toward their journey to Kuala Lumpur.	\N	custom	date_passed	{}	all	2	t	2026-02-09 02:21:54.674+00	2026-02-09 02:21:54.674+00	\N
8bc3b2e5-3d47-43c3-9fd6-261c9eb4ca39	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	2025-07-31 00:00:00+00	2025-07-31 00:00:00+00	Payment for Batch I	Payment for Batch I	\N	custom	date_passed	{}	all	3	t	2026-02-09 02:21:54.676+00	2026-02-09 02:21:54.676+00	\N
86e89ec4-ad15-44b6-b545-a6676ac599fd	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	2025-08-01 00:00:00+00	2025-08-10 00:00:00+00	Interview Announcement for Fully Funded Participants	Interview Announcement for Fully Funded Participants	\N	custom	date_passed	{}	all	4	t	2026-02-09 02:21:54.679+00	2026-02-09 02:21:54.679+00	\N
17a43acf-ab0b-4d8a-84a7-747eae000c7e	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	2025-08-11 00:00:00+00	2025-08-20 00:00:00+00	Fully Funded Interview	Fully Funded Interview	\N	custom	date_passed	{}	all	5	t	2026-02-09 02:21:54.681+00	2026-02-09 02:21:54.681+00	\N
76a99754-c10f-410f-be0a-b63f1451c295	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	2025-08-31 00:00:00+00	2025-08-31 00:00:00+00	Payment  for Batch 2	Payment  for Batch 2	\N	custom	date_passed	{}	all	6	t	2026-02-09 02:21:54.683+00	2026-02-09 02:21:54.683+00	\N
c5ba7e44-b011-4b36-bb71-3d3da929cfb0	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	2025-09-01 00:00:00+00	2025-09-10 00:00:00+00	Final Announcement for Fully Funded Participants	Final Announcement for Fully Funded Participants	\N	custom	date_passed	{}	all	7	t	2026-02-09 02:21:54.685+00	2026-02-09 02:21:54.685+00	\N
6471e46c-4512-4962-9558-330dd77fa3dc	5c871a0c-6b81-499c-86f6-6a7ff287fc5d	2025-10-06 00:00:00+00	2025-10-09 00:00:00+00	World Youth Festival 2025	World Youth Festival 2025	\N	custom	date_passed	{}	all	8	t	2026-02-09 02:21:54.687+00	2026-02-09 02:21:54.687+00	\N
68f0c43d-38ea-4844-b87a-0f666320604f	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	2025-06-01 00:00:00+00	2025-08-10 00:00:00+00	Participant Registration	Participant Registration	\N	custom	date_passed	{}	all	1	t	2026-02-09 02:21:54.689+00	2026-02-09 02:21:54.689+00	\N
de98ff4c-1813-40af-bd98-7c12f3f58e1f	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	2025-08-15 00:00:00+00	2025-08-20 00:00:00+00	LoA Announcement	LoA Announcement	\N	custom	date_passed	{}	all	2	t	2026-02-09 02:21:54.691+00	2026-02-09 02:21:54.691+00	\N
4c569c22-dd33-4239-af9e-8be23fb5c716	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	2025-09-30 00:00:00+00	2025-09-30 00:00:00+00	First Installment Payment	First Installment Payment	\N	custom	date_passed	{}	all	3	t	2026-02-09 02:21:54.692+00	2026-02-09 02:21:54.692+00	\N
fdc14b1b-b313-4107-ab6e-7a448da89135	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	2025-10-01 00:00:00+00	2025-10-10 00:00:00+00	Interview Announcement	Interview Announcement	\N	custom	date_passed	{}	all	4	t	2026-02-09 02:21:54.694+00	2026-02-09 02:21:54.694+00	\N
853fe778-b7f9-452c-9d32-ddf3c8b84099	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	2025-10-11 00:00:00+00	2025-10-20 00:00:00+00	Interview for Fully Funded Candidates	Interview for Fully Funded Candidates	\N	custom	date_passed	{}	all	5	t	2026-02-09 02:21:54.696+00	2026-02-09 02:21:54.696+00	\N
176249eb-5cb4-441e-bdba-81b97c921550	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	2025-10-31 00:00:00+00	2025-10-31 00:00:00+00	Second Installment Payment	Second Installment Payment	\N	custom	date_passed	{}	all	6	t	2026-02-09 02:21:54.697+00	2026-02-09 02:21:54.697+00	\N
514e2646-0716-4cda-ba7b-384b48f7b470	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	2025-11-01 00:00:00+00	2025-11-05 00:00:00+00	Fully Funded Announcement	Fully Funded Announcement	\N	custom	date_passed	{}	all	7	t	2026-02-09 02:21:54.699+00	2026-02-09 02:21:54.699+00	\N
82a46504-1d96-4a07-ad39-56b4ef3fcad1	a89f4a34-cdba-4ad2-a297-a0f3c8117a93	2025-12-01 00:00:00+00	2025-12-04 00:00:00+00	Program Implementation	Program Implementation	\N	custom	date_passed	{}	all	8	t	2026-02-09 02:21:54.701+00	2026-02-09 02:21:54.701+00	\N
006d9c52-060f-4178-89e9-af0149e7fb47	4487fb74-b208-4ddc-ac37-d1dab65a84c1	2025-07-01 00:00:00+00	2025-08-31 00:00:00+00	 Participant Registration and Abstract Submission (Fully Funded)	 Participant Registration and Abstract Submission (Fully Funded)	\N	custom	date_passed	{}	all	1	t	2026-02-09 02:21:54.703+00	2026-02-09 02:21:54.703+00	\N
8b56b3ef-a606-446f-b21c-9cb402113d7f	4487fb74-b208-4ddc-ac37-d1dab65a84c1	2025-09-05 00:00:00+00	2025-09-10 00:00:00+00	 Abstract and Acceptance Letter Announcement	 Abstract and Acceptance Letter Announcement	\N	custom	date_passed	{}	all	2	t	2026-02-09 02:21:54.705+00	2026-02-09 02:21:54.705+00	\N
ce763f50-8362-4089-82fb-c695af85a882	4487fb74-b208-4ddc-ac37-d1dab65a84c1	2025-09-01 00:00:00+00	2025-09-30 00:00:00+00	 Participant Registration and Abstract Submission (Fully Funded-Extended Registration))	 Participant Registration and Abstract Submission (Fully Funded-Extended Registration))	\N	custom	date_passed	{}	all	3	t	2026-02-09 02:21:54.745+00	2026-02-09 02:21:54.745+00	\N
1d042e67-5759-44aa-9bd0-20cf2c950368	4487fb74-b208-4ddc-ac37-d1dab65a84c1	2025-10-10 00:00:00+00	2025-10-10 00:00:00+00	Payment Submission Deadline Batch 1	Payment Submission Deadline Batch 1	\N	custom	date_passed	{}	all	4	t	2026-02-09 02:21:54.747+00	2026-02-09 02:21:54.747+00	\N
8bdfd518-a285-46e4-86ce-3ddb4c040983	4487fb74-b208-4ddc-ac37-d1dab65a84c1	2025-10-15 00:00:00+00	2025-10-20 00:00:00+00	Interview Announcement for Fully Funded Delegates	Interview Announcement for Fully Funded Delegates	\N	custom	date_passed	{}	all	5	t	2026-02-09 02:21:54.748+00	2026-02-09 02:21:54.748+00	\N
8b012e64-2c19-4216-8d9c-8532400329ac	4487fb74-b208-4ddc-ac37-d1dab65a84c1	2025-10-20 00:00:00+00	2025-10-30 00:00:00+00	Interview for Fully Funded Candidates	Interview for Fully Funded Candidates	\N	custom	date_passed	{}	all	6	t	2026-02-09 02:21:54.75+00	2026-02-09 02:21:54.75+00	\N
a02c77e9-ff81-4b3c-84ce-0d9e42e91f11	4487fb74-b208-4ddc-ac37-d1dab65a84c1	2025-11-10 00:00:00+00	2025-11-10 00:00:00+00	Payment Submission Deadline Batch 2	Payment Submission Deadline Batch 2	\N	custom	date_passed	{}	all	7	t	2026-02-09 02:21:54.751+00	2026-02-09 02:21:54.751+00	\N
5fd3a541-2b56-4c31-8ed7-084b54b6d821	4487fb74-b208-4ddc-ac37-d1dab65a84c1	2025-11-11 00:00:00+00	2025-11-15 00:00:00+00	Announcement of Fully Funded Delegates	Announcement of Fully Funded Delegates	\N	custom	date_passed	{}	all	8	t	2026-02-09 02:21:54.753+00	2026-02-09 02:21:54.753+00	\N
3bbb2b44-eebb-49f1-867f-c9487bb26d22	4487fb74-b208-4ddc-ac37-d1dab65a84c1	2025-11-15 00:00:00+00	2025-11-15 00:00:00+00	Full Paper Submission Deadline	Full Paper Submission Deadline	\N	custom	date_passed	{}	all	9	t	2026-02-09 02:21:54.755+00	2026-02-09 02:21:54.755+00	\N
2a5d18cd-6b62-41e6-b298-338aa2c9e52c	4487fb74-b208-4ddc-ac37-d1dab65a84c1	2025-12-08 00:00:00+00	2025-12-11 00:00:00+00	Youth Academic Forum	Youth Academic Forum	\N	custom	date_passed	{}	all	10	t	2026-02-09 02:21:54.757+00	2026-02-09 02:21:54.757+00	\N
1758379c-8e9f-4c47-8ac6-e0b8c2a6bc10	22eeb004-f921-492a-af50-6d6afbbbe97c	2024-11-20 00:00:00+00	2024-11-20 00:00:00+00	First Installment Payment Deadline	First Installment Payment Deadline	\N	custom	date_passed	{}	all	3	t	2026-02-09 02:21:54.759+00	2026-02-09 02:21:54.759+00	\N
bfe78b32-d4f4-44b7-bdfc-1d4d9e25e85f	532ac7e2-ff62-4587-92cf-37c12387fbcf	2025-04-10 00:00:00+00	2025-06-15 00:00:00+00	Participant Registration	\r\nParticipant Registration for Self Funded and Fully Funded.	\N	custom	date_passed	{}	all	1	t	2026-02-09 02:21:54.822+00	2026-02-09 02:21:54.822+00	\N
91b23ec8-955b-4d61-a019-e35768666339	532ac7e2-ff62-4587-92cf-37c12387fbcf	2025-06-20 00:00:00+00	2025-06-30 00:00:00+00	LOA Announcement	LOA Announcement for Japan Youth Summit 2025.\r\n	\N	custom	date_passed	{}	all	0	t	2026-02-09 02:21:54.824+00	2026-02-09 02:21:54.824+00	\N
201d983d-0242-4257-9dc7-04bbc7944472	532ac7e2-ff62-4587-92cf-37c12387fbcf	2025-07-31 00:00:00+00	2025-07-31 00:00:00+00	First Installment Payment	First Installment Payment Deadline.	\N	custom	date_passed	{}	all	0	t	2026-02-09 02:21:54.826+00	2026-02-09 02:21:54.826+00	\N
8c6532a0-1e42-4b67-96e0-9bf0defefaf4	532ac7e2-ff62-4587-92cf-37c12387fbcf	2025-08-01 00:00:00+00	2025-08-10 00:00:00+00	Interview Announcement for Fully Funded Candidates	Interview Announcement for Fully Funded Participants.	\N	custom	date_passed	{}	all	0	t	2026-02-09 02:21:54.827+00	2026-02-09 02:21:54.827+00	\N
30a938b7-06ac-4ef8-b1e8-a6e4c861e463	532ac7e2-ff62-4587-92cf-37c12387fbcf	2025-08-11 00:00:00+00	2025-08-20 00:00:00+00	Fully Funded Interview	Fully Funded Interview for Japan Youth Summit 2025.	\N	custom	date_passed	{}	all	0	t	2026-02-09 02:21:54.829+00	2026-02-09 02:21:54.829+00	\N
3168c766-f1a6-424f-a573-9bae743e9665	532ac7e2-ff62-4587-92cf-37c12387fbcf	2025-08-31 00:00:00+00	2025-08-31 00:00:00+00	Second Payment Installment	Second Payment Installment Deadline.	\N	custom	date_passed	{}	all	0	t	2026-02-09 02:21:54.83+00	2026-02-09 02:21:54.83+00	\N
c47c9788-9eee-4575-975c-16b89bac19fc	532ac7e2-ff62-4587-92cf-37c12387fbcf	2025-09-01 00:00:00+00	2025-09-10 00:00:00+00	Final Announcement for Fully Funded Participants	Final Announcement for Fully Funded Participants \r\n	\N	custom	date_passed	{}	all	0	t	2026-02-09 02:21:54.832+00	2026-02-09 02:21:54.832+00	\N
1f1f0914-0bf8-4e8e-9de3-fdcdba69a31f	532ac7e2-ff62-4587-92cf-37c12387fbcf	2025-10-12 00:00:00+00	2025-10-15 00:00:00+00	Japan Youth Summit 2025	\r\nJapan Youth Summit 2025 	\N	custom	date_passed	{}	all	0	t	2026-02-09 02:21:54.834+00	2026-02-09 02:21:54.834+00	\N
4d0b2493-8f28-4c3b-951c-dd654642b234	532ac7e2-ff62-4587-92cf-37c12387fbcf	2025-10-12 00:00:00+00	2025-10-15 00:00:00+00	Japan Youth Summit 2025	\r\nJapan Youth Summit 2025 	\N	custom	date_passed	{}	all	0	t	2026-02-09 02:21:54.835+00	2026-02-09 02:21:54.835+00	\N
0b3c99fa-e53a-4def-ad6a-2f5d235ea0c6	eedb6e37-8d7d-438f-91a2-fb8c2635acdb	2026-01-01 00:00:00+00	\N	Registration Opens	Applications open for all tracks.	\N	custom	date_passed	{}	all	1	t	2026-02-09 02:22:05.301+00	2026-02-09 02:22:05.301+00	\N
3e20be99-3f49-4cc0-8df9-d88603189227	eedb6e37-8d7d-438f-91a2-fb8c2635acdb	2026-03-01 00:00:00+00	\N	Early Bird Deadline	Last chance for discounted fee.	\N	custom	date_passed	{}	all	2	t	2026-02-09 02:22:05.301+00	2026-02-09 02:22:05.301+00	\N
a2190093-4f2d-46d8-8e0b-e9c2ec59bfd0	eedb6e37-8d7d-438f-91a2-fb8c2635acdb	2026-05-01 00:00:00+00	\N	Final Deadline	Submission closes.	\N	custom	date_passed	{}	all	3	t	2026-02-09 02:22:05.301+00	2026-02-09 02:22:05.301+00	\N
7be96a39-9404-49f8-90da-6def04abf8f8	ee83ea00-0396-457a-9abd-85cf6b1c746f	2026-01-01 00:00:00+00	\N	Registration Opens	Applications open for all tracks.	\N	custom	date_passed	{}	all	1	t	2026-02-09 02:22:05.312+00	2026-02-09 02:22:05.312+00	\N
49f1b8c5-4e42-4fb3-9fda-21b92925c343	ee83ea00-0396-457a-9abd-85cf6b1c746f	2026-03-01 00:00:00+00	\N	Early Bird Deadline	Last chance for discounted fee.	\N	custom	date_passed	{}	all	2	t	2026-02-09 02:22:05.312+00	2026-02-09 02:22:05.312+00	\N
bd400590-ad57-401b-9de9-428897499d84	ee83ea00-0396-457a-9abd-85cf6b1c746f	2026-05-01 00:00:00+00	\N	Final Deadline	Submission closes.	\N	custom	date_passed	{}	all	3	t	2026-02-09 02:22:05.312+00	2026-02-09 02:22:05.312+00	\N
ee7210bb-ccce-41a0-9343-b2143fdee283	9412ce6a-cbd5-4789-9291-b3121f18526d	2026-01-01 00:00:00+00	\N	Registration Opens	Applications open for all tracks.	\N	custom	date_passed	{}	all	1	t	2026-02-09 02:22:05.33+00	2026-02-09 02:22:05.33+00	\N
fb8d4531-dae4-49bb-9e8d-8638bf5259f6	9412ce6a-cbd5-4789-9291-b3121f18526d	2026-03-01 00:00:00+00	\N	Early Bird Deadline	Last chance for discounted fee.	\N	custom	date_passed	{}	all	2	t	2026-02-09 02:22:05.33+00	2026-02-09 02:22:05.33+00	\N
b2611a7d-f5e2-488b-b32c-1e01c99482d7	9412ce6a-cbd5-4789-9291-b3121f18526d	2026-05-01 00:00:00+00	\N	Final Deadline	Submission closes.	\N	custom	date_passed	{}	all	3	t	2026-02-09 02:22:05.33+00	2026-02-09 02:22:05.33+00	\N
c6f86e1b-1fbc-4944-b584-47c2e7ce8f2a	359aaba8-b950-44b2-951c-6a10b61fdaf8	2026-01-01 00:00:00+00	\N	Registration Opens	Applications open for all tracks.	\N	custom	date_passed	{}	all	1	t	2026-02-09 02:22:05.35+00	2026-02-09 02:22:05.35+00	\N
fc101d9b-33eb-43a3-8ac5-ac8d5a4cd119	359aaba8-b950-44b2-951c-6a10b61fdaf8	2026-03-01 00:00:00+00	\N	Early Bird Deadline	Last chance for discounted fee.	\N	custom	date_passed	{}	all	2	t	2026-02-09 02:22:05.35+00	2026-02-09 02:22:05.35+00	\N
23081b32-5dca-4498-adc8-94f4a272a8ab	359aaba8-b950-44b2-951c-6a10b61fdaf8	2026-05-01 00:00:00+00	\N	Final Deadline	Submission closes.	\N	custom	date_passed	{}	all	3	t	2026-02-09 02:22:05.35+00	2026-02-09 02:22:05.35+00	\N
472db1d3-05cc-4ac7-b75f-ada498105103	05f66b78-e261-4e30-8d9e-b377e83df3ca	2026-01-01 00:00:00+00	\N	Registration Opens	Applications open for all tracks.	\N	custom	date_passed	{}	all	1	t	2026-02-09 02:22:05.366+00	2026-02-09 02:22:05.366+00	\N
497cddb4-d3b0-49b3-8a09-1c30d74bcd95	05f66b78-e261-4e30-8d9e-b377e83df3ca	2026-03-01 00:00:00+00	\N	Early Bird Deadline	Last chance for discounted fee.	\N	custom	date_passed	{}	all	2	t	2026-02-09 02:22:05.366+00	2026-02-09 02:22:05.366+00	\N
219f32bb-0dc9-4edd-b65a-30645a0ed950	05f66b78-e261-4e30-8d9e-b377e83df3ca	2026-05-01 00:00:00+00	\N	Final Deadline	Submission closes.	\N	custom	date_passed	{}	all	3	t	2026-02-09 02:22:05.366+00	2026-02-09 02:22:05.366+00	\N
52a86682-8347-40a2-aace-f486ac5f0ed7	0d660fb3-b707-47c4-8969-4282653cb745	2026-01-01 00:00:00+00	\N	Registration Opens	Applications open for all tracks.	\N	custom	date_passed	{}	all	1	t	2026-02-09 02:22:05.445+00	2026-02-09 02:22:05.445+00	\N
c506cb7c-14c3-4a5a-810b-1d2a1d7082ba	0d660fb3-b707-47c4-8969-4282653cb745	2026-03-01 00:00:00+00	\N	Early Bird Deadline	Last chance for discounted fee.	\N	custom	date_passed	{}	all	2	t	2026-02-09 02:22:05.445+00	2026-02-09 02:22:05.445+00	\N
2d1b3851-d0db-4f4d-b075-304bc1508180	0d660fb3-b707-47c4-8969-4282653cb745	2026-05-01 00:00:00+00	\N	Final Deadline	Submission closes.	\N	custom	date_passed	{}	all	3	t	2026-02-09 02:22:05.445+00	2026-02-09 02:22:05.445+00	\N
94a3360b-48b2-4f05-9bf1-e8c6537454e0	c007679c-7ed9-4d3e-a4cb-dbe99dbdc3a6	2026-01-01 00:00:00+00	\N	Registration Opens	Applications open for all tracks.	\N	custom	date_passed	{}	all	1	t	2026-02-09 02:22:05.455+00	2026-02-09 02:22:05.455+00	\N
0430addc-0744-47c1-b2fa-77b88134eccf	c007679c-7ed9-4d3e-a4cb-dbe99dbdc3a6	2026-03-01 00:00:00+00	\N	Early Bird Deadline	Last chance for discounted fee.	\N	custom	date_passed	{}	all	2	t	2026-02-09 02:22:05.455+00	2026-02-09 02:22:05.455+00	\N
d3ef587a-b4d3-4fb8-8b30-b5ba3005b79c	c007679c-7ed9-4d3e-a4cb-dbe99dbdc3a6	2026-05-01 00:00:00+00	\N	Final Deadline	Submission closes.	\N	custom	date_passed	{}	all	3	t	2026-02-09 02:22:05.455+00	2026-02-09 02:22:05.455+00	\N
\.


--
-- Data for Name: program_waitlist; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.program_waitlist (id, program_id, user_id, "position", notified, joined_at) FROM stdin;
\.


--
-- Data for Name: programs; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.programs (id, brand_id, name, slug, description, short_description, year, start_date, end_date, application_deadline, location, capacity, is_published, is_visible_to_users, is_active, status, thumbnail_url, banner_url, video_url, require_email_verification, currency, enable_currency_conversion, logo_url, allow_registration, registration_open_date, registration_close_date, require_payment, registration_fee, requirements_description, benefits_description, terms_and_conditions, meta_title, meta_description, created_at, updated_at, deleted_at, legacy_id, theme) FROM stdin;
07b4dcd5-7514-46f7-b8f8-c148210ecb69	b46695c9-e58b-45a4-a930-56822cb0d560	IYS 2024	iys-2024	123	\N	2024	2024-02-21	2024-02-29	2024-02-21 20:29:22+00	\N	\N	f	t	f	draft	\N	\N	effe	t	USD	f	\N	f	\N	\N	f	\N	\N	\N	\N	\N	\N	2026-02-09 02:21:41.871+00	2026-02-09 02:21:41.871+00	\N	1	\N
532ac7e2-ff62-4587-92cf-37c12387fbcf	6cbd815c-7d2b-45c9-b45b-114088dc4f37	Japan Youth Summit 2025	japan-youth-summit-2025	<p class="ql-align-justify"><strong style="color: rgb(0, 0, 0);">Japan Youth Summit</strong><span style="color: rgb(0, 0, 0);">, organized by the Youth Break the Boundaries (YBB) Foundation, is a</span>n international innovation competition and youth summit that aims to inspire emerging leaders to push the limits of their potential, come together, and implement strategies under the main theme of “<strong style="color: rgb(230, 0, 0);">Pioneering Innovation for Sustainable Futures</strong>.”<span style="color: rgb(0, 0, 0);"> The summit promotes collaboration among diverse young people from various fields to harness their leadership skills in working toward achieving sustainable development goals. The Sustainable Development Goals (SDGs) are a set of goals that serve as a guide for countries worldwide in their development effort, replacing the Millennium Development Goals (MDGs) that concluded in 2015. The SDGs encompass a range of areas, including</span><strong style="color: rgb(0, 0, 0);"> Education (SDG 4)</strong><span style="color: rgb(0, 0, 0);">, </span><strong style="color: rgb(0, 0, 0);">Economy (SDG 8)</strong><span style="color: rgb(0, 0, 0);">, </span><strong style="color: rgb(0, 0, 0);">Industry, Innovation, and Infrastructure (SDG 9</strong><span style="color: rgb(0, 0, 0);">), </span><strong style="color: rgb(0, 0, 0);">Sustainable Cities and Communities (SDG 11)</strong><span style="color: rgb(0, 0, 0);">, as well as </span><strong style="color: rgb(0, 0, 0);">Climate Action (SDG 13</strong><span style="color: rgb(0, 0, 0);">).</span></p><p><br></p><p><br></p>	\N	2025	2025-10-12	2025-10-15	2025-10-12 00:00:00+00	\N	\N	f	t	f	draft	\N	\N	https://www.youtube.com/embed/tUR55Fi53rM?si=NtuTc1RVhzcl7lgh	t	USD	f	\N	f	\N	\N	f	\N	\N	\N	\N	\N	\N	2026-02-09 02:21:41.948+00	2026-02-09 02:21:41.948+00	\N	7	Pioneering Innovation for Sustainable Futures
a89f4a34-cdba-4ad2-a297-a0f3c8117a93	8bf7988a-7822-4a36-94d8-4df9ebe12b8b	Middle East Youth Summit 2025	middle-east-youth-summit-2025	<p class="ql-align-justify"><strong style="color: rgb(0, 0, 0); background-color: transparent;">MEYS MAIN THEME</strong></p><p class="ql-align-center"><strong style="color: rgb(0, 0, 0); background-color: transparent;">Empowering Emerging Leaders for Positive Change within the Islamic Brotherhood</strong></p><p><br></p><p><strong style="color: rgb(0, 0, 0); background-color: transparent;">SUBTHEMES</strong></p><p><br></p><ul><li class="ql-align-justify"><strong style="background-color: transparent;">SDG 4 – Quality Education</strong></li></ul><p class="ql-align-justify"><span style="background-color: transparent;">To provide inclusive and equitable education that equips youth with skills, knowledge, and values for leadership.</span></p><ul><li class="ql-align-justify"><strong style="background-color: transparent;">SDG 5 – Gender Equality</strong></li></ul><p class="ql-align-justify"><span style="background-color: transparent;">To ensure equal opportunities for young Muslim women and men to lead and contribute meaningfully to society.</span></p><ul><li class="ql-align-justify"><strong style="background-color: transparent;">SDG 10 – Reduced Inequality</strong></li></ul><p class="ql-align-justify"><span style="background-color: transparent;">To empower marginalized youth and reduce socio-economic disparities within the Muslim community.</span></p><ul><li class="ql-align-justify"><strong style="background-color: transparent;">SDG 16 – Peace, Justice, and Strong Institutions</strong></li></ul><p class="ql-align-justify"><span style="background-color: transparent;">To cultivate active youth leaders committed to justice, transparency, and peaceful civic engagement.</span></p><ul><li class="ql-align-justify"><strong style="background-color: transparent;">SDG 17 – Partnerships for the Goals</strong></li></ul><p class="ql-align-justify"><span style="background-color: transparent;">To strengthen intergenerational and cross-border collaborations for sustainable impact within the Islamic world.</span></p><p><br></p>	\N	2025	2025-12-01	2025-12-04	2025-12-01 00:00:00+00	\N	\N	f	t	f	draft	\N	\N	https://bit.ly/tutorialMEYS2025	t	USD	f	\N	f	\N	\N	f	\N	\N	\N	\N	\N	\N	2026-02-09 02:21:41.964+00	2026-02-09 02:21:41.964+00	\N	8	Empowering Emerging Leaders for Positive Change within the Islamic Brotherhood
5c871a0c-6b81-499c-86f6-6a7ff287fc5d	f5d5b61a-5eba-4eba-a3a0-d840c420a10a	World Youth Fest 2025	world-youth-fest-2025	The World Youth Festival (WYF), orchestrated by the Youth Break the Boundaries (YBB) Foundation, This platform is designed to cultivate the spirit of entrepreneurship, encourage collaboration, and foster the contribution of youth globally, Additionally, it aims to ensure the readiness of the next generation to tackle the challenges of the future.\r\n\r\nThe dynamic platform serves as a global hub for young visionaries, where innovative ideas converge to shape a brighter tomorrow. The festival also provides a unique opportunity for young leaders from diverse backgrounds to connect, exchange ideas, and collaborate on projects that benefit society. Through interactive workshops, insightful discussions, and networking sessions, participants gain valuable skills and insights to drive positive change in their communities and beyond. Together, participants embark on a transformative journey towards a more sustainable and inclusive future.\r\n<br/><br/>tes<br/><br/>tes<br/><br/><p><strong>The World Youth Festival (WYF)</strong>, is orchestrated by the <strong>Youth Break the Boundaries (YBB) Foundation</strong>. This platform is designed to cultivate the spirit of entrepreneurship, encourage collaboration, and foster the contribution of youth globally. Additionally, it aims to ensure the readiness of the next generation to tackle the challenges of the future.</p><p>The dynamic platform serves as a global hub for young visionaries, where innovative ideas converge to shape a brighter tomorrow. The festival also provides a unique opportunity for young leaders from diverse backgrounds to connect, exchange ideas, and collaborate on projects that benefit society.</p><p>Through <strong>interactive workshops, insightful discussions, and networking sessions</strong>, participants gain valuable skills and insights to drive positive change in their communities and beyond. Together, participants embark on a transformative journey towards a more <strong>sustainable and inclusive future</strong>.</p>	\N	2025	2025-10-06	2025-10-09	2025-10-06 00:00:00+00	\N	\N	f	t	f	draft	\N	https://storage.ybbfoundation.com/web-setting-home/2/banner_1.png	https://www.youtube.com/embed/nrBa3CfSLzc?si=wI5qaRD5ZP3r0Ddr	t	USD	f	\N	f	\N	\N	f	\N	\N	\N	\N	\N	\N	2026-02-09 02:21:41.922+00	2026-02-09 02:22:05.191+00	\N	6	Cultivating Youth Creativity in Entrepreneurship
a1c30442-e6a2-4c13-97ba-797c99806e0a	1ea6d070-0b94-4867-b6d2-ae07169dae40	Korea Youth Summit 2025	korea-youth-summit-2025	<header>\n        <h1>Korea Youth Summit 2025</h1>\n        <p>\n            The <strong>Korea Youth Summit 2025</strong>, the first international youth summit in Seoul, Korea, is organized by the \n            Youth Break the Boundaries Foundation. This summit aims to inspire emerging leaders to push the limits of their potential, \n            come together to discuss, and implement strategies for <strong>Empowering Youth Leaders to Drive Sustainable Change for a Brighter Future</strong>.\n        </p>\n        <p>\n            KYS 2025 promotes collaboration among diverse young people from various fields, harnessing their leadership skills to work \n            toward achieving <strong>Sustainable Development Goals (SDGs)</strong>. The SDGs serve as a guide for countries worldwide \n            in their development efforts, replacing the Millennium Development Goals (MDGs) that concluded in 2015.\n        </p>\n    </header>\n\n    <section>\n        <h2>Focus on Sustainable Development Goals (SDGs)</h2>\n        <p>The SDGs encompass a wide range of areas, including:</p>\n        <ul>\n            <li><strong>Education</strong> (SDG 4)</li>\n            <li><strong>Economy</strong> (SDG 8)</li>\n            <li><strong>Industry, Innovation, and Infrastructure</strong> (SDG 9)</li>\n            <li><strong>Sustainable Cities and Communities</strong> (SDG 11)</li>\n        </ul>\n    </section>\n\n    <section>\n        <h2>Opportunities at KYS 2025</h2>\n        <p>\n            KYS 2025 offers a valuable opportunity for young leaders to explore effective social development strategies that can \n            bring about real progress in their nations. The summit delves into four key sub-themes, encouraging attendees to think \n            critically about strategies related to SDGs in the areas of Education, Economy, Industry, Innovation, Infrastructure, \n            and Sustainable Cities and Communities.\n        </p>\n        <p>\n            Delegates will gain valuable insights from a variety of perspectives and build global connections to aid their development \n            as future leaders. Participants can fully benefit from the program through knowledge-sharing, networking, and enhancing \n            youth representation on a global scale.\n        </p>\n    </section>\n\n    <section>\n        <h2>Main Goals of KYS 2025</h2>\n        <p>\n            The primary aim of KYS 2025 is to advance the progress of nations, making it a pivotal tool in shaping a better future. \n            By empowering young leaders, KYS 2025 contributes to building a brighter future for communities worldwide.\n        </p>\n    </section><br/><br/>tes<br/><br/>tes<br/><br/><p>123</p>	\N	2025	2025-06-30	2025-07-03	2025-06-30 00:00:00+00	\N	\N	f	t	f	draft	\N	https://storage.ybbfoundation.com/web-setting-home/5/banner_1_kys.png	https://www.youtube.com/embed/1m7BQbCC1g0?si=OkUDLu20eLT8-LDw	t	USD	f	\N	f	\N	\N	f	\N	\N	\N	\N	\N	\N	2026-02-09 02:21:41.914+00	2026-02-09 02:22:05.188+00	\N	5	https://youtube.com/shorts/kZwp0RS7sf8?feature=share
359aaba8-b950-44b2-951c-6a10b61fdaf8	1ea6d070-0b94-4867-b6d2-ae07169dae40	Korea Youth Summit 2026	korea-youth-summit-2026	<p class="ql-align-center"><strong style="background-color: transparent; color: rgb(0, 0, 0);">KOREA YOUTH SUMMIT</strong></p><p class="ql-align-justify"><strong style="background-color: transparent; color: rgb(0, 0, 0);">The Korea Youth Summit (KYS)</strong><span style="background-color: transparent; color: rgb(0, 0, 0);"> is an inspiring international gathering that brings together young changemakers to explore the power of culture in shaping inclusive, creative, and resilient societies. Organized by the Youth Break the Boundaries (YBB) Foundation, KYS places youth at the heart of cultural preservation and innovation, celebrating Korea’s global reputation as a vibrant cultural hub.</span></p><p class="ql-align-justify"><span style="background-color: transparent; color: rgb(0, 0, 0);">Carrying the tagline “Living Culture, Lasting Legacy,” the summit fosters deep reflection and action on how tradition and modernity can coexist. Through insightful sessions, cultural immersion, and collaborative learning, participants are encouraged to rethink the role of youth in preserving heritage, reimagining identity, and fostering intercultural understanding.</span></p><p class="ql-align-justify"><span style="background-color: transparent; color: rgb(0, 0, 0);">A signature element of the summit is </span><strong style="background-color: transparent; color: rgb(0, 0, 0);">the Cultural Project Competition, where delegates propose creative solutions and campaigns to preserve, celebrate, and innovate around local and global cultural values.</strong><span style="background-color: transparent; color: rgb(0, 0, 0);"> These youth-led initiatives aim to address real-world cultural challenges while promoting diversity and unity.</span></p><p><span style="background-color: transparent; color: rgb(0, 0, 0);">KYS is more than an event. It's a movement that </span><strong style="background-color: transparent; color: rgb(0, 0, 0);">empowers young people to be cultural ambassadors, innovators, and protectors of legacy.</strong><span style="background-color: transparent; color: rgb(0, 0, 0);"> By building bridges across nations and traditions, the summit provides an immersive platform for dialogue, learning, and collaboration among future leaders committed to making culture a force for positive change.</span></p>	\N	2026	2026-02-02	2026-02-05	2026-02-02 00:00:00+00	\N	\N	t	t	t	published	\N	\N	https://www.youtube.com/embed/1m7BQbCC1g0?si=OkUDLu20eLT8-LDw	t	USD	f	\N	t	\N	\N	f	\N	\N	\N	\N	\N	\N	2026-02-09 02:21:41.988+00	2026-02-09 02:21:41.988+00	\N	9	Connecting Generations Through Cultural Collaboration
eedb6e37-8d7d-438f-91a2-fb8c2635acdb	b46695c9-e58b-45a4-a930-56822cb0d560	Istanbul Youth Summit 2026	istanbul-youth-summit-2026	<p class="ql-align-justify"><strong style="color: rgb(0, 0, 0); background-color: transparent;">The Istanbul Youth Summit (IYS)</strong><span style="color: rgb(0, 0, 0); background-color: transparent;"> is a premier international platform that empowers young leaders to address global challenges through innovation, collaboration, and transformative leadership. Organized by the Youth Break the Boundaries (YBB) Foundation, IYS cultivates a dynamic environment where youth gain the confidence, skills, and global outlook needed to become catalysts for change.</span></p><p class="ql-align-justify"><span style="color: rgb(0, 0, 0); background-color: transparent;">More than just a gathering, IYS is a space where ideas come to life. Through inspiring talks, interactive sessions, and meaningful group activities, participants are encouraged to explore new perspectives, grow as leaders, and connect with youth from around the world. The summit promotes open dialogue and practical learning in a supportive and inclusive setting.</span></p><p class="ql-align-justify"><span style="color: rgb(0, 0, 0); background-color: transparent;">A highlight of the program is </span><strong style="color: rgb(0, 0, 0); background-color: transparent;">the Social Project Competition</strong><span style="color: rgb(0, 0, 0); background-color: transparent;">, which invites delegates to propose creative initiatives aimed at solving global issues or empowering their communities. It is an opportunity to turn ideas into action and make a lasting contribution with real impact.</span></p><p class="ql-align-justify"><span style="color: rgb(0, 0, 0); background-color: transparent;">At IYS, participants are not only learners but also active contributors. The summit offers opportunities for cultural exchange, collaboration, and lasting friendships among emerging leaders from different countries. With the support of experienced mentors and global peers, IYS helps shape a new generation ready to lead and inspire change across borders.</span></p>	\N	2026	2026-02-09	2026-02-12	2026-02-09 00:00:00+00	\N	\N	t	t	t	published	\N	\N	https://www.youtube.com/embed/begwqSG5VCE?si=EzjD-6WXfwLEJGQb	t	USD	f	\N	t	\N	\N	f	\N	\N	\N	\N	\N	\N	2026-02-09 02:21:42.021+00	2026-02-09 02:21:42.021+00	\N	10	From Vision to Action: Empowering Youth for Lasting Global Impact
0d660fb3-b707-47c4-8969-4282653cb745	6cbd815c-7d2b-45c9-b45b-114088dc4f37	Japan Youth Summit 2026	japan-youth-summit-2026	<p class="ql-align-justify"><strong style="color: rgb(0, 0, 0);">Japan Youth Summit</strong><span style="color: rgb(0, 0, 0);">, organized by the Youth Break the Boundaries (YBB) Foundation, is a</span>n international innovation competition and youth summit that aims to inspire emerging leaders to push the limits of their potential, come together, and implement strategies under the main theme of “<strong style="background-color: transparent; color: rgb(0, 0, 0);">Innovation Beyond Borders: Building the Future through Collaboration</strong>.”<span style="color: rgb(0, 0, 0);"> The summit promotes collaboration among diverse young people from various fields to harness their leadership skills in working toward achieving sustainable development goals. The Sustainable Development Goals (SDGs) are a set of goals that serve as a guide for countries worldwide in their development effort, replacing the Millennium Development Goals (MDGs) that concluded in 2015. The SDGs encompass a range of areas, including</span><strong style="color: rgb(0, 0, 0);"> Education (SDG 4)</strong><span style="color: rgb(0, 0, 0);">, </span><strong style="color: rgb(0, 0, 0);">Economy (SDG 8)</strong><span style="color: rgb(0, 0, 0);">, </span><strong style="color: rgb(0, 0, 0);">Industry, Innovation, and Infrastructure (SDG 9</strong><span style="color: rgb(0, 0, 0);">), </span><strong style="color: rgb(0, 0, 0);">Sustainable Cities and Communities (SDG 11)</strong><span style="color: rgb(0, 0, 0);">, as well as </span><strong style="color: rgb(0, 0, 0);">Climate Action (SDG 13</strong><span style="color: rgb(0, 0, 0);">).</span></p><p><br></p><p><br></p>	\N	2026	2026-05-11	2026-05-14	2026-05-11 00:00:00+00	\N	\N	t	t	t	published	\N	\N	https://www.youtube.com/embed/tUR55Fi53rM?si=NtuTc1RVhzcl7lgh	t	USD	f	\N	t	\N	\N	f	\N	\N	\N	\N	\N	\N	2026-02-09 02:21:42.043+00	2026-02-09 02:21:42.043+00	\N	11	Innovation Beyond Borders: Building the Future through Collaboration
9412ce6a-cbd5-4789-9291-b3121f18526d	8bf7988a-7822-4a36-94d8-4df9ebe12b8b	Middle East Youth Summit 2026	middle-east-youth-summit-2026	<p class="ql-align-justify"><strong style="background-color: transparent; color: rgb(0, 0, 0);">MEYS MAIN THEME</strong></p><p class="ql-align-center"><strong>Global Muslim Youth Collaboration for Sustainable Development</strong></p><p><strong style="background-color: transparent; color: rgb(0, 0, 0);">SUBTHEMES</strong></p><p><br></p><ul><li class="ql-align-justify"><strong style="background-color: transparent;">SDG 4 – Quality Education</strong></li></ul><p class="ql-align-justify"><span style="color: rgb(0, 0, 0);">Empowering Muslim Youth Through Accessible, Inclusive, and Future-Ready Education</span>.</p><ul><li class="ql-align-justify"><strong style="background-color: transparent;">SDG 5 – Gender Equality</strong></li></ul><p class="ql-align-justify">Advancing Gender Equity and Empowerment within Muslim Communities<span style="background-color: transparent;">.</span></p><ul><li class="ql-align-justify"><strong style="background-color: transparent;">SDG 10 – Reduced Inequality</strong></li></ul><p class="ql-align-justify">Building Inclusive Muslim Societies by Reducing Social and Economic Gaps.</p><ul><li class="ql-align-justify"><strong style="background-color: transparent;">SDG 16 – Peace, Justice, and Strong Institutions</strong></li></ul><p class="ql-align-justify">Promoting Peacebuilding, Ethical Leadership, and Good Governance in the Muslim World.</p><ul><li class="ql-align-justify"><strong style="background-color: transparent;">SDG 17 – Partnerships for the Goals</strong></li></ul><p class="ql-align-justify">Strengthening Global Muslim Youth Networks for Collaborative Action.</p><p><br></p>	\N	2026	2026-03-30	2026-04-02	2026-03-30 00:00:00+00	\N	\N	t	t	t	published	\N	\N	https://bit.ly/tutorialMEYS2025	t	USD	f	\N	t	\N	\N	f	\N	\N	\N	\N	\N	\N	2026-02-09 02:21:42.067+00	2026-02-09 02:21:42.067+00	\N	12	Global Muslim Youth Collaboration for Sustainable Development
c007679c-7ed9-4d3e-a4cb-dbe99dbdc3a6	9f3ef4a3-304b-440a-add6-e13d0f23172b	Vietnam Youth Summit 2026	vietnam-youth-summit-2026	Join the Vietnam Youth Summit 2026 and be part of a transformative journey that celebrates Vietnamese heritage while addressing the challenges and opportunities of modern Southeast Asia. This summit brings together young innovators, cultural ambassadors, and future leaders to explore how tradition and innovation can work together to create positive change.	\N	2026	2026-08-15	2026-08-18	2026-08-15 00:00:00+00	\N	\N	f	t	f	draft	\N	\N	https://youtube.com/watch?v=vys2026_registration	t	USD	f	\N	f	\N	\N	f	\N	\N	\N	\N	\N	\N	2026-02-09 02:21:42.087+00	2026-02-09 02:21:42.087+00	\N	16	Heritage Meets Innovation: Building Bridges Across Southeast Asia
ee83ea00-0396-457a-9abd-85cf6b1c746f	f5d5b61a-5eba-4eba-a3a0-d840c420a10a	World Youth Fest 2026	world-youth-fest-2026	<p><strong style="color: rgba(0,0,0,var(--O42jJQ,1));">The World Youth Festival (WYF)</strong><span style="color: rgba(0,0,0,var(--O42jJQ,1));"> </span><strong style="color: rgba(0,0,0,var(--O42jJQ,1));">#Chapter Vietnam</strong><span style="color: rgba(0,0,0,var(--O42jJQ,1));"> is an international program organized by </span><strong style="color: rgba(0,0,0,var(--O42jJQ,1));">Youth Break the Boundaries (YBB)</strong><span style="color: rgba(0,0,0,var(--O42jJQ,1));">, dedicated to empowering young leaders to take an active role in shaping a sustainable future. As a prestigious global platform, WYF unites youth from diverse nations, cultures, and backgrounds under the spirit of </span><strong style="color: rgba(0,0,0,var(--O42jJQ,1));">“Unlock Your Full Potential.”</strong></p><p><span style="color: rgba(0,0,0,var(--O42jJQ,1));">At the core of the program is the </span><strong style="color: rgba(0,0,0,var(--O42jJQ,1));">Global Sustainability Project Competition</strong><span style="color: rgba(0,0,0,var(--O42jJQ,1));">, where participants design and present innovative solutions that aim to create meaningful social impact. These projects are closely aligned with the United Nations Sustainable Development Goals (SDGs), with a primary focus on </span><strong style="color: rgba(0,0,0,var(--O42jJQ,1));">SDG 3 (Good Health &amp; Well-being), SDG 4 (Quality Education), SDG 8 (Decent Work &amp; Economic Growth), and SDG 13 (Climate Action).</strong></p><p><strong style="color: rgba(0,0,0,var(--O42jJQ,1));">Delegates are assigned to multicultural teams based on their selected SDG</strong><span style="color: rgba(0,0,0,var(--O42jJQ,1));">, ensuring that each group reflects the richness of international perspectives. Through this collaborative process, participants strengthen essential leadership capacities, including critical thinking, problem-solving, communication, and teamwork.</span></p><p><span style="color: rgba(0,0,0,var(--O42jJQ,1));">The program also provides recognition and visibility for outstanding ideas, with awards presented to the most impactful projects demonstrating innovation, feasibility, and long-term potential. More than a competition, WYF offers a transformative experience where young people gain the confidence and skills to </span><strong style="color: rgba(0,0,0,var(--O42jJQ,1));">#LeadTheFuture</strong><span style="color: rgba(0,0,0,var(--O42jJQ,1));"> within their communities and beyond.</span></p><p><span style="color: rgba(0,0,0,var(--O42jJQ,1));">With the 2026 theme, </span><strong style="color: rgba(0,0,0,var(--O42jJQ,1));">“Youth Solutions for a Sustainable Tomorrow,”</strong><span style="color: rgba(0,0,0,var(--O42jJQ,1));"> WYF continues its mission to nurture young changemakers, celebrate diversity, and build global networks that transcend borders.</span></p>	\N	2026	2026-07-06	2026-07-09	2026-07-06 00:00:00+00	\N	\N	t	t	t	published	\N	\N	https://www.youtube.com/embed/nrBa3CfSLzc?si=wI5qaRD5ZP3r0Ddr	t	USD	f	\N	t	\N	\N	f	\N	\N	\N	\N	\N	\N	2026-02-09 02:21:42.112+00	2026-02-09 02:21:42.112+00	\N	17	Youth Solutions for a Sustainable Tomorrow
723cbfda-d5ba-40c1-80b0-c90eab48049f	f5d5b61a-5eba-4eba-a3a0-d840c420a10a	World Youth Fest 2024	world-youth-fest-2024	The World Youth Festival (WYF), orchestrated by the Youth Break the Boundaries (YBB) Foundation, This platform is designed to cultivate the spirit of entrepreneurship, encourage collaboration, and foster the contribution of youth globally, Additionally, it aims to ensure the readiness of the next generation to tackle the challenges of the future.\n\nThe dynamic platform serves as a global hub for young visionaries, where innovative ideas converge to shape a brighter tomorrow. The festival also provides a unique opportunity for young leaders from diverse backgrounds to connect, exchange ideas, and collaborate on projects that benefit society. Through interactive workshops, insightful discussions, and networking sessions, participants gain valuable skills and insights to drive positive change in their communities and beyond. Together, participants embark on a transformative journey towards a more sustainable and inclusive future.\n<br/><br/>tes<br/><br/>tes<br/><br/><p>123</p>	\N	2024	2024-10-05	2024-10-08	2024-10-05 00:00:00+00	\N	\N	f	t	f	draft	\N	https://storage.ybbfoundation.com/web-setting-home/2/banner_1.png	https://www.youtube.com/embed/nrBa3CfSLzc?si=wI5qaRD5ZP3r0Ddr	t	USD	f	\N	t	\N	\N	f	\N	\N	\N	\N	\N	\N	2026-02-09 02:21:41.882+00	2026-02-09 02:22:05.181+00	\N	2	
4487fb74-b208-4ddc-ac37-d1dab65a84c1	9b1a6ce7-58af-4fd1-9f30-7d0dfc8f662d	Youth Academic Forum 2025	youth-academic-forum-2025	<p>The Youth Academic Forum (YAF) is a series of international conference events aimed at providing a forum to establish new foundational principles in the application of various scientific fields. Therefore, the conference invites participants from diverse backgrounds to expose and discuss innovative theories, frameworks, methodologies, and other findings across various disciplines.</p>\n\n    <p>This event is organized by <strong>Youth Break the Boundaries</strong> as a more specific platform for the intellectual development of youth. The forum is designed as a space for young people interested in research to interact in various fields of knowledge and collaborate on innovative research projects.</p>\n\n    <h2>Event Location</h2>\n    <p>The first Youth Academic Forum will be held in <strong>Bangkok, Thailand</strong>, as an initial step in developing a global youth community focused on research. By facilitating academic discussions and cross-disciplinary collaboration, YAF is committed to supporting young people in producing research that positively impacts society.</p>\n\n    <h2>Long-Term Goals</h2>\n    <p>In the long term, YAF aims to become a leading center for youth intellectual development, strengthening young researchers' networks, and promoting a sustainable research culture. Thus, the Youth Academic Forum becomes an integral part of YBB's mission to shape future leaders who are not only competent but also possess noble character and a commitment to collective progress.</p>\n<br/><br/>tes<br/><br/>tes<br/><br/><p class="ql-align-justify"><span style="color: rgb(0, 0, 0);">The </span><strong style="color: rgb(0, 0, 0);">Youth Academic Forum</strong><span style="color: rgb(0, 0, 0);">, an initiative of </span><strong style="color: rgb(0, 0, 0);">Youth Break the Boundaries (YBB)</strong><span style="color: rgb(0, 0, 0);">, stands as a dynamic and inclusive platform designed to elevate and empower the </span><strong style="color: rgb(0, 0, 0);">young research community</strong><span style="color: rgb(0, 0, 0);">. With a steadfast commitment to promoting </span><strong style="color: rgb(0, 0, 0);">original, objective, and credible research</strong><span style="color: rgb(0, 0, 0);">, the forum provides accessible pathways for young researchers to publish and present their work on a global stage.</span></p><p><span style="color: rgb(0, 0, 0);">More than just a publication platform, the Youth Academic Forum is a </span><strong style="color: rgb(0, 0, 0);">hub of intellectual exchange</strong><span style="color: rgb(0, 0, 0);">, where emerging scholars, practitioners, and change-makers collaborate, learn, and grow. We believe that meaningful research should not remain confined to academic institutions but should inform real-world progress, policy, and innovation.</span></p>	\N	2025	2025-12-08	2025-12-11	2025-12-08 00:00:00+00	\N	\N	t	t	t	published	\N	https://storage.ybbfoundation.com/web-setting-home/4/banner_1_yaf.png	https://www.youtube.com/embed/iTaAbFK_iyY?si=nu8hMI37M0cNS9L4	t	USD	f	\N	t	\N	\N	f	\N	\N	\N	\N	\N	\N	2026-02-09 02:21:41.906+00	2026-02-09 02:22:05.185+00	\N	4	Building the Foundation of Innovation and Cross-Disciplinary Collaboration for Youth Intellectual Development on a Global Scale
22eeb004-f921-492a-af50-6d6afbbbe97c	b46695c9-e58b-45a4-a930-56822cb0d560	Istanbul Youth Summit 2025	istanbul-youth-summit-2025	The World Youth Festival (WYF), orchestrated by the Youth Break the Boundaries (YBB) Foundation, This platform is designed to cultivate the spirit of entrepreneurship, encourage collaboration, and foster the contribution of youth globally, Additionally, it aims to ensure the readiness of the next generation to tackle the challenges of the future.\r\n\r\nThe dynamic platform serves as a global hub for young visionaries, where innovative ideas converge to shape a brighter tomorrow. The festival also provides a unique opportunity for young leaders from diverse backgrounds to connect, exchange ideas, and collaborate on projects that benefit society. Through interactive workshops, insightful discussions, and networking sessions, participants gain valuable skills and insights to drive positive change in their communities and beyond. Together, participants embark on a transformative journey towards a more sustainable and inclusive future.\r\n<br/><br/>tes<br/><br/>tes<br/><br/><p>IYS 2025, the eighth iteration of the Istanbul Youth Summit organized by Youth Break the</p><p>Boundaries (YBB) foundation, aims to inspire emerging leaders who push the limits of their potential</p><p>to come together to discuss and implement strategies for Empowering Youth Leaders to Drive</p><p>Sustainable Change for A Brighter Future. The summit also promotes collaboration among diverse</p><p>young people from various fields to harness their leadership skills in working towards achieving</p><p>sustainable development goals.</p><p>The Sustainable Development Goals (SDGs) are a set of goals that serve as a guide for countries</p><p>worldwide in their development efforts, replacing the Millennium Development Goals (MDGs) that</p><p>concluded in 2015. The SDGs encompass a range of areas including Education (SDG 4), Health (SDG</p><p>3), Economy (SDG 8), and Environment (SDG 13), among others.</p>	\N	2025	2025-02-17	2025-02-20	2025-02-17 00:00:00+00	\N	\N	f	t	f	draft	\N	https://storage.ybbfoundation.com/web-setting-home/3/banner_1_iys.png	https://www.youtube.com/embed/begwqSG5VCE?si=MZY8xEgYV-uoN0fH	t	USD	f	\N	f	\N	\N	f	\N	\N	\N	\N	\N	\N	2026-02-09 02:21:41.896+00	2026-02-09 02:22:05.183+00	\N	3	https://youtube.com/shorts/9hyuDNUpSjc?si=NGA5QCcSQvlDY7YD
05f66b78-e261-4e30-8d9e-b377e83df3ca	9b1a6ce7-58af-4fd1-9f30-7d0dfc8f662d	Youth Academic Forum 2026	youth-academic-forum-2026	Join us for the Youth Academic Forum 2026. A transformative experience.	The official 2026 edition of Youth Academic Forum.	2026	2026-08-15	2026-08-18	2026-05-01 00:00:00+00	TBD	\N	t	t	t	published	https://placehold.co/600x400?text=Youth+Academic+Forum	https://placehold.co/1200x600?text=Youth+Academic+Forum+Banner	\N	t	USD	f	\N	t	\N	\N	t	\N	\N	\N	\N	\N	\N	2026-02-09 02:22:05.362+00	2026-02-09 02:22:05.362+00	\N	\N	\N
\.


--
-- Data for Name: scoring_categories; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.scoring_categories (id, schema_id, name, description, weight, "order", legacy_reference) FROM stdin;
48c8a14f-cd3d-42fd-84d4-896a297134df	36c81810-08cf-4db2-9c04-547b02a30933	Essay Assessment	\N	0.60	1	\N
8db2e067-832c-4e89-b688-df93305dae25	36c81810-08cf-4db2-9c04-547b02a30933	Achievement & Experience	\N	0.40	2	\N
\.


--
-- Data for Name: scoring_criteria; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.scoring_criteria (id, category_id, name, description, weight, max_score, "order", legacy_id) FROM stdin;
9870eefe-0082-49d3-b5a8-594c9a8d76a0	48c8a14f-cd3d-42fd-84d4-896a297134df	Topic Relevance to SDGS Themes	\N	0.30	100.00	1	\N
015778a7-e266-479c-8670-bb8711f73867	48c8a14f-cd3d-42fd-84d4-896a297134df	Argumentation, Innovation, and Creativity	\N	0.50	100.00	2	\N
d48bfe7f-092c-45b8-8512-3480c7fc3689	48c8a14f-cd3d-42fd-84d4-896a297134df	Validity of Sources and References	\N	0.10	100.00	3	\N
b65581a1-638a-47de-88f5-9a25c34ca27e	48c8a14f-cd3d-42fd-84d4-896a297134df	Writing Format	\N	0.10	100.00	4	\N
9b93f297-f846-4c51-adc9-d00f7960006f	8db2e067-832c-4e89-b688-df93305dae25	Project Experiences	\N	0.30	100.00	1	\N
5a719c47-d159-4969-be57-e4f59b884b96	8db2e067-832c-4e89-b688-df93305dae25	Achievement	\N	0.40	100.00	2	\N
d1e6c8a3-54f8-4a3e-857e-a80eb4edaa7c	8db2e067-832c-4e89-b688-df93305dae25	Leadership	\N	0.30	100.00	3	\N
\.


--
-- Data for Name: scoring_schemas; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.scoring_schemas (id, program_id, name, description, is_active, created_at, updated_at, deleted_at, legacy_id) FROM stdin;
36c81810-08cf-4db2-9c04-547b02a30933	eedb6e37-8d7d-438f-91a2-fb8c2635acdb	IYS 2026 Selection Rubric	Standard rubric for assessing essays and achievements.	t	2026-02-09 02:22:05.66+00	2026-02-09 02:22:05.66+00	\N	\N
\.


--
-- Data for Name: sponsors; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.sponsors (id, brand_id, name, type, logo_url, website_url, description, tier, is_active, "order", created_at, updated_at, deleted_at) FROM stdin;
da242186-b76a-4b98-b3a8-7d253509cfc3	b46695c9-e58b-45a4-a930-56822cb0d560	Tech Corp Global	corporate	https://placehold.co/200x100?text=Tech+Corp	https://techcorp.example.com	Leading innovation worldwide.	platinum	t	1	2026-02-09 02:22:05.207+00	2026-02-09 02:22:05.207+00	\N
8d1f8d4d-9f6c-4d72-bb4a-f970bf658896	b46695c9-e58b-45a4-a930-56822cb0d560	Education First	ngo	https://placehold.co/200x100?text=Education+First	https://edu-first.example.org	Promoting global literacy.	gold	t	2	2026-02-09 02:22:05.207+00	2026-02-09 02:22:05.207+00	\N
aa2fccaf-aafe-43e7-9715-9ced682d2831	b46695c9-e58b-45a4-a930-56822cb0d560	Local Media Group	media_partner	https://placehold.co/200x100?text=Media+Group	https://media.example.com	\N	partner	t	3	2026-02-09 02:22:05.207+00	2026-02-09 02:22:05.207+00	\N
\.


--
-- Data for Name: sponsorship_tiers; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.sponsorship_tiers (id, brand_id, program_id, name, price_description, description, features, "order", is_active, created_at, updated_at, deleted_at) FROM stdin;
a9d18098-50fd-47d6-87ad-460ab3a49561	b46695c9-e58b-45a4-a930-56822cb0d560	\N	Platinum Sponsor	$10,000+	Maximum visibility and keynote speech opportunity.	["Logo on main banner","Keynote speech","Booth at venue","Social media shoutout"]	1	t	2026-02-09 02:22:05.204+00	2026-02-09 02:22:05.204+00	\N
f3e8a7fc-83a7-482c-9e56-2308d11f220f	b46695c9-e58b-45a4-a930-56822cb0d560	\N	Gold Sponsor	$5,000+	High visibility and booth.	["Logo on website","Booth at venue","Social media shoutout"]	2	t	2026-02-09 02:22:05.204+00	2026-02-09 02:22:05.204+00	\N
\.


--
-- Data for Name: support_ticket_messages; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.support_ticket_messages (id, ticket_id, message, is_from_admin, sender_id, sender_name, attachments, is_read, read_at, is_internal_note, created_at, deleted_at, legacy_id) FROM stdin;
\.


--
-- Data for Name: support_tickets; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.support_tickets (id, participant_id, assigned_to, program_id, ticket_number, category, sub_category, subject, description, status, priority, resolution, resolved_at, resolved_by, closed_at, closed_by, closed_reason, satisfaction_rating, feedback, created_at, updated_at, deleted_at, legacy_id) FROM stdin;
\.


--
-- Data for Name: system_announcements; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.system_announcements (id, title, content, summary, target_audience, brand_id, program_id, priority, type, is_published, published_at, is_dismissible, show_banner, action_url, action_label, start_date, end_date, created_by, updated_by, metadata, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: user_activity_logs; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.user_activity_logs (id, user_id, activity_type, activity_category, activity_data, page_url, referrer_url, session_id, ip_address, user_agent, device_type, created_at) FROM stdin;
\.


--
-- Data for Name: user_announcement_reads; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.user_announcement_reads (id, user_id, announcement_id, read_at, last_seen_at, is_dismissed, dismissed_at) FROM stdin;
\.


--
-- Data for Name: user_blocked_accounts; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.user_blocked_accounts (id, user_id, block_reason, block_description, block_type, blocked_at, blocked_until, unblocked_at, blocked_by, unblocked_by, violations_count, notes, is_active, deleted_at) FROM stdin;
\.


--
-- Data for Name: user_identities; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.user_identities (id, user_id, provider_id, provider_user_id, provider_email, access_token, refresh_token, token_expiry, is_primary, last_used_at, created_at, updated_at, deleted_at) FROM stdin;
3fb1c759-fb27-4637-96a2-bd6df1868e01	3976679f-b793-4c12-bed0-4d6134536d70	de282685-7a4e-48ad-bc56-c700d31b5719	\N	\N	\N	\N	\N	t	\N	2026-02-09 02:22:05.514+00	2026-02-09 02:22:05.514+00	\N
952d7e38-19ee-4369-8fc2-dc8abaa92622	44cc5035-4eef-4acc-9d36-c3751ea4a121	de282685-7a4e-48ad-bc56-c700d31b5719	\N	\N	\N	\N	\N	t	\N	2026-02-09 02:22:05.569+00	2026-02-09 02:22:05.569+00	\N
b3e1a11d-b662-4147-8ec3-01e25b34016a	a321808a-822b-41f9-b8ae-a08547c1acd9	de282685-7a4e-48ad-bc56-c700d31b5719	\N	\N	\N	\N	\N	t	\N	2026-02-09 02:22:05.634+00	2026-02-09 02:22:05.634+00	\N
\.


--
-- Data for Name: user_notifications; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.user_notifications (id, user_id, type, title, message, action_url, action_label, related_entity_type, related_entity_id, metadata, is_read, read_at, priority, sent_via_email, sent_via_sms, email_sent_at, sms_sent_at, created_at, expires_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: user_preferences; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.user_preferences (id, user_id, theme, language, timezone, date_format, email_notifications, sms_notifications, marketing_emails, newsletter_subscription, program_updates, application_updates, reminder_emails, custom_settings, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_privacy_consents; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.user_privacy_consents (id, user_id, consent_type, consent_version, consent_text, is_granted, granted_at, revoked_at, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: user_security_logs; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.user_security_logs (id, user_id, event_type, event_status, event_description, ip_address, user_agent, device_fingerprint, location, risk_level, flagged, created_at) FROM stdin;
\.


--
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.user_sessions (id, user_id, session_token, refresh_token, device_type, device_name, browser, operating_system, ip_address, country, city, is_active, last_activity, created_at, expires_at, revoked_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: ybb_user
--

COPY public.users (id, email, brand_id, password_hash, email_verified, email_verified_at, email_verification_token, email_verification_expires, password_reset_token, password_reset_expires, is_active, failed_login_attempts, last_failed_login, last_login_at, last_password_change, created_at, updated_at, deleted_at, legacy_id, legacy_type, is_onboarding_completed) FROM stdin;
bbad751b-4a31-426b-b7bb-667363380998	admin@ybbhub.com	b46695c9-e58b-45a4-a930-56822cb0d560	$2b$10$ahkbtcFfv4KT9L0px2Z0XebDZT.f1JvlUkNRIPc8KTdG4dV8Nta0m	t	\N	\N	\N	\N	\N	t	0	\N	\N	\N	2026-02-09 02:22:05.275+00	2026-02-09 02:22:05.275+00	\N	\N	\N	f
9b8ee528-e9ca-40d3-a391-2420c025b881	manager@ybbhub.com	b46695c9-e58b-45a4-a930-56822cb0d560	$2b$10$ahkbtcFfv4KT9L0px2Z0XebDZT.f1JvlUkNRIPc8KTdG4dV8Nta0m	t	\N	\N	\N	\N	\N	t	0	\N	\N	\N	2026-02-09 02:22:05.287+00	2026-02-09 02:22:05.287+00	\N	\N	\N	f
84e3505c-0dd4-4028-9828-d11b42ff20a4	editor@ybbhub.com	b46695c9-e58b-45a4-a930-56822cb0d560	$2b$10$ahkbtcFfv4KT9L0px2Z0XebDZT.f1JvlUkNRIPc8KTdG4dV8Nta0m	t	\N	\N	\N	\N	\N	t	0	\N	\N	\N	2026-02-09 02:22:05.291+00	2026-02-09 02:22:05.291+00	\N	\N	\N	f
3976679f-b793-4c12-bed0-4d6134536d70	john.participant@example.com	b46695c9-e58b-45a4-a930-56822cb0d560	$2b$10$taMcWrnLC0IZXvcn3N4PxumI7nbaOWB6VSHG2jZH1Fmj3TkyJjJau	t	\N	\N	\N	\N	\N	t	0	\N	\N	\N	2026-02-09 02:22:05.512+00	2026-02-09 02:22:05.512+00	\N	\N	\N	f
44cc5035-4eef-4acc-9d36-c3751ea4a121	jane.applicant@example.com	b46695c9-e58b-45a4-a930-56822cb0d560	$2b$10$GtEQvApjjwwdw/3bDsYguewdLYbiudybmEXQ5nnf5iWOZByQxn/p.	t	\N	\N	\N	\N	\N	t	0	\N	\N	\N	2026-02-09 02:22:05.568+00	2026-02-09 02:22:05.568+00	\N	\N	\N	f
a321808a-822b-41f9-b8ae-a08547c1acd9	alex.winner@example.com	b46695c9-e58b-45a4-a930-56822cb0d560	$2b$10$6YCpYYIvlCakzxVCc8eExeh6HaOJQql6cgPaHQsmg2N2tGCOdQ5Xy	t	\N	\N	\N	\N	\N	t	0	\N	\N	\N	2026-02-09 02:22:05.631+00	2026-02-09 02:22:05.631+00	\N	\N	\N	f
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: account_deletion_requests account_deletion_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.account_deletion_requests
    ADD CONSTRAINT account_deletion_requests_pkey PRIMARY KEY (id);


--
-- Name: admin_brands admin_brands_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.admin_brands
    ADD CONSTRAINT admin_brands_pkey PRIMARY KEY (id);


--
-- Name: admin_programs admin_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.admin_programs
    ADD CONSTRAINT admin_programs_pkey PRIMARY KEY (id);


--
-- Name: admin_roles admin_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.admin_roles
    ADD CONSTRAINT admin_roles_pkey PRIMARY KEY (id);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- Name: ai_chatbot_configs ai_chatbot_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.ai_chatbot_configs
    ADD CONSTRAINT ai_chatbot_configs_pkey PRIMARY KEY (id);


--
-- Name: ambassador_referrals ambassador_referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.ambassador_referrals
    ADD CONSTRAINT ambassador_referrals_pkey PRIMARY KEY (id);


--
-- Name: ambassadors ambassadors_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.ambassadors
    ADD CONSTRAINT ambassadors_pkey PRIMARY KEY (id);


--
-- Name: application_assessments application_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.application_assessments
    ADD CONSTRAINT application_assessments_pkey PRIMARY KEY (id);


--
-- Name: application_edit_history application_edit_history_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.application_edit_history
    ADD CONSTRAINT application_edit_history_pkey PRIMARY KEY (id);


--
-- Name: application_form_fields application_form_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.application_form_fields
    ADD CONSTRAINT application_form_fields_pkey PRIMARY KEY (id);


--
-- Name: application_invoices application_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.application_invoices
    ADD CONSTRAINT application_invoices_pkey PRIMARY KEY (id);


--
-- Name: application_reviews application_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.application_reviews
    ADD CONSTRAINT application_reviews_pkey PRIMARY KEY (id);


--
-- Name: application_score_items application_score_items_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.application_score_items
    ADD CONSTRAINT application_score_items_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: auth_providers auth_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.auth_providers
    ADD CONSTRAINT auth_providers_pkey PRIMARY KEY (id);


--
-- Name: brand_settings brand_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.brand_settings
    ADD CONSTRAINT brand_settings_pkey PRIMARY KEY (id);


--
-- Name: brand_social_feeds brand_social_feeds_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.brand_social_feeds
    ADD CONSTRAINT brand_social_feeds_pkey PRIMARY KEY (id);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: certificate_templates certificate_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.certificate_templates
    ADD CONSTRAINT certificate_templates_pkey PRIMARY KEY (id);


--
-- Name: document_templates document_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: legal_documents legal_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.legal_documents
    ADD CONSTRAINT legal_documents_pkey PRIMARY KEY (id);


--
-- Name: migration_tracking migration_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.migration_tracking
    ADD CONSTRAINT migration_tracking_pkey PRIMARY KEY (id);


--
-- Name: newsletter_subscribers newsletter_subscribers_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_pkey PRIMARY KEY (id);


--
-- Name: participant_applications participant_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.participant_applications
    ADD CONSTRAINT participant_applications_pkey PRIMARY KEY (id);


--
-- Name: participant_awards participant_awards_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.participant_awards
    ADD CONSTRAINT participant_awards_pkey PRIMARY KEY (id);


--
-- Name: participant_documents participant_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.participant_documents
    ADD CONSTRAINT participant_documents_pkey PRIMARY KEY (id);


--
-- Name: participants participants_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_pkey PRIMARY KEY (id);


--
-- Name: partnership_enquiries partnership_enquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.partnership_enquiries
    ADD CONSTRAINT partnership_enquiries_pkey PRIMARY KEY (id);


--
-- Name: partnership_opportunities partnership_opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.partnership_opportunities
    ADD CONSTRAINT partnership_opportunities_pkey PRIMARY KEY (id);


--
-- Name: pricing_tier_validity_periods pricing_tier_validity_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.pricing_tier_validity_periods
    ADD CONSTRAINT pricing_tier_validity_periods_pkey PRIMARY KEY (id);


--
-- Name: program_announcement_reads program_announcement_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_announcement_reads
    ADD CONSTRAINT program_announcement_reads_pkey PRIMARY KEY (id);


--
-- Name: program_announcements program_announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_announcements
    ADD CONSTRAINT program_announcements_pkey PRIMARY KEY (id);


--
-- Name: program_awards program_awards_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_awards
    ADD CONSTRAINT program_awards_pkey PRIMARY KEY (id);


--
-- Name: program_essays program_essays_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_essays
    ADD CONSTRAINT program_essays_pkey PRIMARY KEY (id);


--
-- Name: program_faqs program_faqs_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_faqs
    ADD CONSTRAINT program_faqs_pkey PRIMARY KEY (id);


--
-- Name: program_gallery program_gallery_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_gallery
    ADD CONSTRAINT program_gallery_pkey PRIMARY KEY (id);


--
-- Name: program_objectives program_objectives_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_objectives
    ADD CONSTRAINT program_objectives_pkey PRIMARY KEY (id);


--
-- Name: program_participation_categories program_participation_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_participation_categories
    ADD CONSTRAINT program_participation_categories_pkey PRIMARY KEY (id);


--
-- Name: program_participation_infos program_participation_infos_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_participation_infos
    ADD CONSTRAINT program_participation_infos_pkey PRIMARY KEY (id);


--
-- Name: program_partners program_partners_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_partners
    ADD CONSTRAINT program_partners_pkey PRIMARY KEY (id);


--
-- Name: program_pricing_tiers program_pricing_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_pricing_tiers
    ADD CONSTRAINT program_pricing_tiers_pkey PRIMARY KEY (id);


--
-- Name: program_requirements program_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_requirements
    ADD CONSTRAINT program_requirements_pkey PRIMARY KEY (id);


--
-- Name: program_resources program_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_resources
    ADD CONSTRAINT program_resources_pkey PRIMARY KEY (id);


--
-- Name: program_schedules program_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_schedules
    ADD CONSTRAINT program_schedules_pkey PRIMARY KEY (id);


--
-- Name: program_speakers program_speakers_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_speakers
    ADD CONSTRAINT program_speakers_pkey PRIMARY KEY (id);


--
-- Name: program_subthemes program_subthemes_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_subthemes
    ADD CONSTRAINT program_subthemes_pkey PRIMARY KEY (id);


--
-- Name: program_tag_relations program_tag_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_tag_relations
    ADD CONSTRAINT program_tag_relations_pkey PRIMARY KEY (program_id, tag_id);


--
-- Name: program_tags program_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_tags
    ADD CONSTRAINT program_tags_pkey PRIMARY KEY (id);


--
-- Name: program_team program_team_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_team
    ADD CONSTRAINT program_team_pkey PRIMARY KEY (id);


--
-- Name: program_testimonials program_testimonials_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_testimonials
    ADD CONSTRAINT program_testimonials_pkey PRIMARY KEY (id);


--
-- Name: program_timeline program_timeline_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_timeline
    ADD CONSTRAINT program_timeline_pkey PRIMARY KEY (id);


--
-- Name: program_waitlist program_waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_waitlist
    ADD CONSTRAINT program_waitlist_pkey PRIMARY KEY (id);


--
-- Name: programs programs_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_pkey PRIMARY KEY (id);


--
-- Name: scoring_categories scoring_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.scoring_categories
    ADD CONSTRAINT scoring_categories_pkey PRIMARY KEY (id);


--
-- Name: scoring_criteria scoring_criteria_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.scoring_criteria
    ADD CONSTRAINT scoring_criteria_pkey PRIMARY KEY (id);


--
-- Name: scoring_schemas scoring_schemas_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.scoring_schemas
    ADD CONSTRAINT scoring_schemas_pkey PRIMARY KEY (id);


--
-- Name: sponsors sponsors_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.sponsors
    ADD CONSTRAINT sponsors_pkey PRIMARY KEY (id);


--
-- Name: sponsorship_tiers sponsorship_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.sponsorship_tiers
    ADD CONSTRAINT sponsorship_tiers_pkey PRIMARY KEY (id);


--
-- Name: support_ticket_messages support_ticket_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.support_ticket_messages
    ADD CONSTRAINT support_ticket_messages_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: system_announcements system_announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.system_announcements
    ADD CONSTRAINT system_announcements_pkey PRIMARY KEY (id);


--
-- Name: user_activity_logs user_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.user_activity_logs
    ADD CONSTRAINT user_activity_logs_pkey PRIMARY KEY (id);


--
-- Name: user_announcement_reads user_announcement_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.user_announcement_reads
    ADD CONSTRAINT user_announcement_reads_pkey PRIMARY KEY (id);


--
-- Name: user_blocked_accounts user_blocked_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.user_blocked_accounts
    ADD CONSTRAINT user_blocked_accounts_pkey PRIMARY KEY (id);


--
-- Name: user_identities user_identities_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT user_identities_pkey PRIMARY KEY (id);


--
-- Name: user_notifications user_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_pkey PRIMARY KEY (id);


--
-- Name: user_preferences user_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_privacy_consents user_privacy_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.user_privacy_consents
    ADD CONSTRAINT user_privacy_consents_pkey PRIMARY KEY (id);


--
-- Name: user_security_logs user_security_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.user_security_logs
    ADD CONSTRAINT user_security_logs_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: account_deletion_requests_scheduled_deletion_date_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX account_deletion_requests_scheduled_deletion_date_idx ON public.account_deletion_requests USING btree (scheduled_deletion_date);


--
-- Name: account_deletion_requests_status_created_at_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX account_deletion_requests_status_created_at_idx ON public.account_deletion_requests USING btree (status, created_at);


--
-- Name: account_deletion_requests_user_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX account_deletion_requests_user_id_idx ON public.account_deletion_requests USING btree (user_id);


--
-- Name: admin_brands_admin_id_brand_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX admin_brands_admin_id_brand_id_key ON public.admin_brands USING btree (admin_id, brand_id);


--
-- Name: admin_brands_admin_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX admin_brands_admin_id_idx ON public.admin_brands USING btree (admin_id);


--
-- Name: admin_brands_brand_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX admin_brands_brand_id_idx ON public.admin_brands USING btree (brand_id);


--
-- Name: admin_brands_legacy_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX admin_brands_legacy_id_key ON public.admin_brands USING btree (legacy_id);


--
-- Name: admin_programs_admin_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX admin_programs_admin_id_idx ON public.admin_programs USING btree (admin_id);


--
-- Name: admin_programs_admin_id_program_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX admin_programs_admin_id_program_id_key ON public.admin_programs USING btree (admin_id, program_id);


--
-- Name: admin_programs_legacy_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX admin_programs_legacy_id_key ON public.admin_programs USING btree (legacy_id);


--
-- Name: admin_programs_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX admin_programs_program_id_idx ON public.admin_programs USING btree (program_id);


--
-- Name: admin_programs_removed_at_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX admin_programs_removed_at_idx ON public.admin_programs USING btree (removed_at);


--
-- Name: admin_roles_legacy_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX admin_roles_legacy_id_key ON public.admin_roles USING btree (legacy_id);


--
-- Name: admin_roles_name_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX admin_roles_name_idx ON public.admin_roles USING btree (name);


--
-- Name: admin_roles_name_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX admin_roles_name_key ON public.admin_roles USING btree (name);


--
-- Name: admins_deleted_at_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX admins_deleted_at_idx ON public.admins USING btree (deleted_at);


--
-- Name: admins_department_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX admins_department_idx ON public.admins USING btree (department);


--
-- Name: admins_employee_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX admins_employee_id_idx ON public.admins USING btree (employee_id);


--
-- Name: admins_employee_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX admins_employee_id_key ON public.admins USING btree (employee_id);


--
-- Name: admins_legacy_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX admins_legacy_id_key ON public.admins USING btree (legacy_id);


--
-- Name: admins_role_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX admins_role_id_idx ON public.admins USING btree (role_id);


--
-- Name: admins_user_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX admins_user_id_idx ON public.admins USING btree (user_id);


--
-- Name: admins_user_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX admins_user_id_key ON public.admins USING btree (user_id);


--
-- Name: ai_chatbot_configs_brand_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX ai_chatbot_configs_brand_id_idx ON public.ai_chatbot_configs USING btree (brand_id);


--
-- Name: ai_chatbot_configs_is_active_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX ai_chatbot_configs_is_active_idx ON public.ai_chatbot_configs USING btree (is_active);


--
-- Name: ambassador_referrals_ambassador_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX ambassador_referrals_ambassador_id_idx ON public.ambassador_referrals USING btree (ambassador_id);


--
-- Name: ambassador_referrals_ambassador_id_participant_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX ambassador_referrals_ambassador_id_participant_id_key ON public.ambassador_referrals USING btree (ambassador_id, participant_id);


--
-- Name: ambassador_referrals_legacy_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX ambassador_referrals_legacy_id_key ON public.ambassador_referrals USING btree (legacy_id);


--
-- Name: ambassador_referrals_participant_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX ambassador_referrals_participant_id_idx ON public.ambassador_referrals USING btree (participant_id);


--
-- Name: ambassador_referrals_referred_at_accepted_at_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX ambassador_referrals_referred_at_accepted_at_idx ON public.ambassador_referrals USING btree (referred_at, accepted_at);


--
-- Name: ambassador_referrals_status_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX ambassador_referrals_status_idx ON public.ambassador_referrals USING btree (status);


--
-- Name: ambassadors_deleted_at_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX ambassadors_deleted_at_idx ON public.ambassadors USING btree (deleted_at);


--
-- Name: ambassadors_legacy_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX ambassadors_legacy_id_key ON public.ambassadors USING btree (legacy_id);


--
-- Name: ambassadors_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX ambassadors_program_id_idx ON public.ambassadors USING btree (program_id);


--
-- Name: ambassadors_referral_code_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX ambassadors_referral_code_idx ON public.ambassadors USING btree (referral_code);


--
-- Name: ambassadors_referral_code_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX ambassadors_referral_code_key ON public.ambassadors USING btree (referral_code);


--
-- Name: ambassadors_user_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX ambassadors_user_id_idx ON public.ambassadors USING btree (user_id);


--
-- Name: ambassadors_user_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX ambassadors_user_id_key ON public.ambassadors USING btree (user_id);


--
-- Name: application_assessments_application_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX application_assessments_application_id_idx ON public.application_assessments USING btree (application_id);


--
-- Name: application_assessments_type_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX application_assessments_type_idx ON public.application_assessments USING btree (type);


--
-- Name: application_edit_history_application_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX application_edit_history_application_id_idx ON public.application_edit_history USING btree (application_id);


--
-- Name: application_form_fields_order_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX application_form_fields_order_idx ON public.application_form_fields USING btree ("order");


--
-- Name: application_form_fields_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX application_form_fields_program_id_idx ON public.application_form_fields USING btree (program_id);


--
-- Name: application_form_fields_section_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX application_form_fields_section_idx ON public.application_form_fields USING btree (section);


--
-- Name: application_invoices_application_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX application_invoices_application_id_idx ON public.application_invoices USING btree (application_id);


--
-- Name: application_invoices_status_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX application_invoices_status_idx ON public.application_invoices USING btree (status);


--
-- Name: application_reviews_application_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX application_reviews_application_id_idx ON public.application_reviews USING btree (application_id);


--
-- Name: application_reviews_reviewer_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX application_reviews_reviewer_id_idx ON public.application_reviews USING btree (reviewer_id);


--
-- Name: application_reviews_schema_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX application_reviews_schema_id_idx ON public.application_reviews USING btree (schema_id);


--
-- Name: application_score_items_legacy_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX application_score_items_legacy_id_key ON public.application_score_items USING btree (legacy_id);


--
-- Name: application_score_items_review_id_criterion_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX application_score_items_review_id_criterion_id_key ON public.application_score_items USING btree (review_id, criterion_id);


--
-- Name: application_score_items_review_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX application_score_items_review_id_idx ON public.application_score_items USING btree (review_id);


--
-- Name: audit_logs_actor_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX audit_logs_actor_id_idx ON public.audit_logs USING btree (actor_id);


--
-- Name: audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX audit_logs_created_at_idx ON public.audit_logs USING btree (created_at);


--
-- Name: audit_logs_entity_type_entity_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX audit_logs_entity_type_entity_id_idx ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: audit_logs_event_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX audit_logs_event_idx ON public.audit_logs USING btree (event);


--
-- Name: auth_providers_is_active_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX auth_providers_is_active_idx ON public.auth_providers USING btree (is_active);


--
-- Name: auth_providers_name_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX auth_providers_name_idx ON public.auth_providers USING btree (name);


--
-- Name: auth_providers_name_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX auth_providers_name_key ON public.auth_providers USING btree (name);


--
-- Name: auth_providers_order_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX auth_providers_order_idx ON public.auth_providers USING btree ("order");


--
-- Name: brand_settings_brand_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX brand_settings_brand_id_key ON public.brand_settings USING btree (brand_id);


--
-- Name: brand_social_feeds_brand_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX brand_social_feeds_brand_id_idx ON public.brand_social_feeds USING btree (brand_id);


--
-- Name: brand_social_feeds_platform_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX brand_social_feeds_platform_idx ON public.brand_social_feeds USING btree (platform);


--
-- Name: brand_social_feeds_posted_at_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX brand_social_feeds_posted_at_idx ON public.brand_social_feeds USING btree (posted_at);


--
-- Name: brands_is_active_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX brands_is_active_idx ON public.brands USING btree (is_active);


--
-- Name: brands_legacy_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX brands_legacy_id_key ON public.brands USING btree (legacy_id);


--
-- Name: brands_name_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX brands_name_key ON public.brands USING btree (name);


--
-- Name: brands_slug_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX brands_slug_idx ON public.brands USING btree (slug);


--
-- Name: brands_slug_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX brands_slug_key ON public.brands USING btree (slug);


--
-- Name: certificate_templates_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX certificate_templates_program_id_idx ON public.certificate_templates USING btree (program_id);


--
-- Name: document_templates_is_active_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX document_templates_is_active_idx ON public.document_templates USING btree (is_active);


--
-- Name: document_templates_legacy_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX document_templates_legacy_id_key ON public.document_templates USING btree (legacy_id);


--
-- Name: document_templates_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX document_templates_program_id_idx ON public.document_templates USING btree (program_id);


--
-- Name: document_templates_type_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX document_templates_type_idx ON public.document_templates USING btree (type);


--
-- Name: email_templates_brand_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX email_templates_brand_id_idx ON public.email_templates USING btree (brand_id);


--
-- Name: email_templates_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX email_templates_program_id_idx ON public.email_templates USING btree (program_id);


--
-- Name: email_templates_type_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX email_templates_type_idx ON public.email_templates USING btree (type);


--
-- Name: files_entity_type_entity_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX files_entity_type_entity_id_idx ON public.files USING btree (entity_type, entity_id);


--
-- Name: files_user_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX files_user_id_idx ON public.files USING btree (user_id);


--
-- Name: idx_app_participant_status; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX idx_app_participant_status ON public.participant_applications USING btree (participant_id, status);


--
-- Name: idx_app_participant_updated; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX idx_app_participant_updated ON public.participant_applications USING btree (participant_id, updated_at DESC);


--
-- Name: idx_app_updated_at; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX idx_app_updated_at ON public.participant_applications USING btree (updated_at DESC);


--
-- Name: idx_doc_application_type; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX idx_doc_application_type ON public.participant_documents USING btree (application_id, type);


--
-- Name: idx_invoice_application_status; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX idx_invoice_application_status ON public.application_invoices USING btree (application_id, status);


--
-- Name: idx_invoice_pricing_tier; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX idx_invoice_pricing_tier ON public.application_invoices USING btree (pricing_tier_id);


--
-- Name: idx_participant_userid; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX idx_participant_userid ON public.participants USING btree (user_id);


--
-- Name: idx_pricing_tier_program_active; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX idx_pricing_tier_program_active ON public.program_pricing_tiers USING btree (program_id, is_active);


--
-- Name: idx_program_announcement_program_active; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX idx_program_announcement_program_active ON public.program_announcements USING btree (program_id, is_active, created_at DESC);


--
-- Name: idx_program_announcement_reads_announcement; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX idx_program_announcement_reads_announcement ON public.program_announcement_reads USING btree (announcement_id);


--
-- Name: idx_program_announcement_reads_user; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX idx_program_announcement_reads_user ON public.program_announcement_reads USING btree (user_id);


--
-- Name: idx_program_essay_program_active; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX idx_program_essay_program_active ON public.program_essays USING btree (program_id, is_active);


--
-- Name: idx_program_requirement_program_active; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX idx_program_requirement_program_active ON public.program_requirements USING btree (program_id, is_active);


--
-- Name: idx_program_resource_program_active; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX idx_program_resource_program_active ON public.program_resources USING btree (program_id, is_active, is_public);


--
-- Name: idx_system_announcement_published; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX idx_system_announcement_published ON public.system_announcements USING btree (is_published, created_at DESC);


--
-- Name: idx_user_announcement_reads_announcement; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX idx_user_announcement_reads_announcement ON public.user_announcement_reads USING btree (announcement_id);


--
-- Name: idx_user_announcement_reads_user; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX idx_user_announcement_reads_user ON public.user_announcement_reads USING btree (user_id);


--
-- Name: legal_documents_brand_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX legal_documents_brand_id_idx ON public.legal_documents USING btree (brand_id);


--
-- Name: legal_documents_brand_id_slug_version_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX legal_documents_brand_id_slug_version_key ON public.legal_documents USING btree (brand_id, slug, version);


--
-- Name: legal_documents_slug_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX legal_documents_slug_idx ON public.legal_documents USING btree (slug);


--
-- Name: migration_tracking_mysql_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX migration_tracking_mysql_id_idx ON public.migration_tracking USING btree (mysql_id);


--
-- Name: migration_tracking_postgres_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX migration_tracking_postgres_id_idx ON public.migration_tracking USING btree (postgres_id);


--
-- Name: migration_tracking_table_name_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX migration_tracking_table_name_idx ON public.migration_tracking USING btree (table_name);


--
-- Name: migration_tracking_table_name_mysql_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX migration_tracking_table_name_mysql_id_key ON public.migration_tracking USING btree (table_name, mysql_id);


--
-- Name: newsletter_subscribers_email_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX newsletter_subscribers_email_idx ON public.newsletter_subscribers USING btree (email);


--
-- Name: newsletter_subscribers_email_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX newsletter_subscribers_email_key ON public.newsletter_subscribers USING btree (email);


--
-- Name: newsletter_subscribers_is_subscribed_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX newsletter_subscribers_is_subscribed_idx ON public.newsletter_subscribers USING btree (is_subscribed);


--
-- Name: participant_applications_participant_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX participant_applications_participant_id_idx ON public.participant_applications USING btree (participant_id);


--
-- Name: participant_applications_participant_id_program_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX participant_applications_participant_id_program_id_key ON public.participant_applications USING btree (participant_id, program_id);


--
-- Name: participant_applications_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX participant_applications_program_id_idx ON public.participant_applications USING btree (program_id);


--
-- Name: participant_applications_registration_payment_status_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX participant_applications_registration_payment_status_idx ON public.participant_applications USING btree (registration_payment_status);


--
-- Name: participant_applications_status_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX participant_applications_status_idx ON public.participant_applications USING btree (status);


--
-- Name: participant_awards_application_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX participant_awards_application_id_idx ON public.participant_awards USING btree (application_id);


--
-- Name: participant_awards_application_id_program_award_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX participant_awards_application_id_program_award_id_key ON public.participant_awards USING btree (application_id, program_award_id);


--
-- Name: participant_awards_program_award_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX participant_awards_program_award_id_idx ON public.participant_awards USING btree (program_award_id);


--
-- Name: participant_documents_application_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX participant_documents_application_id_idx ON public.participant_documents USING btree (application_id);


--
-- Name: participant_documents_legacy_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX participant_documents_legacy_id_key ON public.participant_documents USING btree (legacy_id);


--
-- Name: participant_documents_type_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX participant_documents_type_idx ON public.participant_documents USING btree (type);


--
-- Name: participants_deleted_at_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX participants_deleted_at_idx ON public.participants USING btree (deleted_at);


--
-- Name: participants_institution_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX participants_institution_idx ON public.participants USING btree (institution);


--
-- Name: participants_legacy_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX participants_legacy_id_key ON public.participants USING btree (legacy_id);


--
-- Name: participants_nationality_code_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX participants_nationality_code_idx ON public.participants USING btree (nationality_code);


--
-- Name: participants_referral_code_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX participants_referral_code_idx ON public.participants USING btree (referral_code);


--
-- Name: participants_user_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX participants_user_id_idx ON public.participants USING btree (user_id);


--
-- Name: participants_user_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX participants_user_id_key ON public.participants USING btree (user_id);


--
-- Name: partnership_enquiries_brand_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX partnership_enquiries_brand_id_idx ON public.partnership_enquiries USING btree (brand_id);


--
-- Name: partnership_enquiries_partnership_type_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX partnership_enquiries_partnership_type_idx ON public.partnership_enquiries USING btree (partnership_type);


--
-- Name: partnership_enquiries_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX partnership_enquiries_program_id_idx ON public.partnership_enquiries USING btree (program_id);


--
-- Name: partnership_enquiries_status_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX partnership_enquiries_status_idx ON public.partnership_enquiries USING btree (status);


--
-- Name: partnership_opportunities_brand_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX partnership_opportunities_brand_id_idx ON public.partnership_opportunities USING btree (brand_id);


--
-- Name: partnership_opportunities_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX partnership_opportunities_program_id_idx ON public.partnership_opportunities USING btree (program_id);


--
-- Name: partnership_opportunities_type_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX partnership_opportunities_type_idx ON public.partnership_opportunities USING btree (type);


--
-- Name: pricing_tier_validity_periods_pricing_tier_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX pricing_tier_validity_periods_pricing_tier_id_idx ON public.pricing_tier_validity_periods USING btree (pricing_tier_id);


--
-- Name: pricing_tier_validity_periods_start_date_end_date_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX pricing_tier_validity_periods_start_date_end_date_idx ON public.pricing_tier_validity_periods USING btree (start_date, end_date);


--
-- Name: program_announcement_reads_announcement_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_announcement_reads_announcement_id_idx ON public.program_announcement_reads USING btree (announcement_id);


--
-- Name: program_announcement_reads_user_id_announcement_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX program_announcement_reads_user_id_announcement_id_key ON public.program_announcement_reads USING btree (user_id, announcement_id);


--
-- Name: program_announcement_reads_user_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_announcement_reads_user_id_idx ON public.program_announcement_reads USING btree (user_id);


--
-- Name: program_announcements_category_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_announcements_category_idx ON public.program_announcements USING btree (category);


--
-- Name: program_announcements_is_pinned_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_announcements_is_pinned_idx ON public.program_announcements USING btree (is_pinned);


--
-- Name: program_announcements_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_announcements_program_id_idx ON public.program_announcements USING btree (program_id);


--
-- Name: program_announcements_publish_date_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_announcements_publish_date_idx ON public.program_announcements USING btree (publish_date);


--
-- Name: program_announcements_target_audience_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_announcements_target_audience_idx ON public.program_announcements USING btree (target_audience);


--
-- Name: program_awards_category_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_awards_category_idx ON public.program_awards USING btree (category);


--
-- Name: program_awards_is_active_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_awards_is_active_idx ON public.program_awards USING btree (is_active);


--
-- Name: program_awards_legacy_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX program_awards_legacy_id_key ON public.program_awards USING btree (legacy_id);


--
-- Name: program_awards_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_awards_program_id_idx ON public.program_awards USING btree (program_id);


--
-- Name: program_essays_is_active_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_essays_is_active_idx ON public.program_essays USING btree (is_active);


--
-- Name: program_essays_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_essays_program_id_idx ON public.program_essays USING btree (program_id);


--
-- Name: program_faqs_category_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_faqs_category_idx ON public.program_faqs USING btree (category);


--
-- Name: program_faqs_order_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_faqs_order_idx ON public.program_faqs USING btree ("order");


--
-- Name: program_faqs_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_faqs_program_id_idx ON public.program_faqs USING btree (program_id);


--
-- Name: program_gallery_order_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_gallery_order_idx ON public.program_gallery USING btree ("order");


--
-- Name: program_gallery_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_gallery_program_id_idx ON public.program_gallery USING btree (program_id);


--
-- Name: program_gallery_type_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_gallery_type_idx ON public.program_gallery USING btree (type);


--
-- Name: program_objectives_order_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_objectives_order_idx ON public.program_objectives USING btree ("order");


--
-- Name: program_objectives_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_objectives_program_id_idx ON public.program_objectives USING btree (program_id);


--
-- Name: program_participation_categories_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_participation_categories_program_id_idx ON public.program_participation_categories USING btree (program_id);


--
-- Name: program_participation_infos_program_id_category_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX program_participation_infos_program_id_category_key ON public.program_participation_infos USING btree (program_id, category);


--
-- Name: program_partners_order_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_partners_order_idx ON public.program_partners USING btree ("order");


--
-- Name: program_partners_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_partners_program_id_idx ON public.program_partners USING btree (program_id);


--
-- Name: program_partners_type_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_partners_type_idx ON public.program_partners USING btree (type);


--
-- Name: program_pricing_tiers_is_active_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_pricing_tiers_is_active_idx ON public.program_pricing_tiers USING btree (is_active);


--
-- Name: program_pricing_tiers_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_pricing_tiers_program_id_idx ON public.program_pricing_tiers USING btree (program_id);


--
-- Name: program_requirements_order_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_requirements_order_idx ON public.program_requirements USING btree ("order");


--
-- Name: program_requirements_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_requirements_program_id_idx ON public.program_requirements USING btree (program_id);


--
-- Name: program_requirements_type_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_requirements_type_idx ON public.program_requirements USING btree (type);


--
-- Name: program_resources_is_public_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_resources_is_public_idx ON public.program_resources USING btree (is_public);


--
-- Name: program_resources_order_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_resources_order_idx ON public.program_resources USING btree ("order");


--
-- Name: program_resources_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_resources_program_id_idx ON public.program_resources USING btree (program_id);


--
-- Name: program_resources_type_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_resources_type_idx ON public.program_resources USING btree (type);


--
-- Name: program_schedules_order_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_schedules_order_idx ON public.program_schedules USING btree ("order");


--
-- Name: program_schedules_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_schedules_program_id_idx ON public.program_schedules USING btree (program_id);


--
-- Name: program_speakers_order_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_speakers_order_idx ON public.program_speakers USING btree ("order");


--
-- Name: program_speakers_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_speakers_program_id_idx ON public.program_speakers USING btree (program_id);


--
-- Name: program_subthemes_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_subthemes_program_id_idx ON public.program_subthemes USING btree (program_id);


--
-- Name: program_tag_relations_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_tag_relations_program_id_idx ON public.program_tag_relations USING btree (program_id);


--
-- Name: program_tag_relations_tag_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_tag_relations_tag_id_idx ON public.program_tag_relations USING btree (tag_id);


--
-- Name: program_tags_name_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX program_tags_name_key ON public.program_tags USING btree (name);


--
-- Name: program_tags_slug_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_tags_slug_idx ON public.program_tags USING btree (slug);


--
-- Name: program_tags_slug_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX program_tags_slug_key ON public.program_tags USING btree (slug);


--
-- Name: program_team_brand_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_team_brand_id_idx ON public.program_team USING btree (brand_id);


--
-- Name: program_team_order_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_team_order_idx ON public.program_team USING btree ("order");


--
-- Name: program_team_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_team_program_id_idx ON public.program_team USING btree (program_id);


--
-- Name: program_testimonials_brand_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_testimonials_brand_id_idx ON public.program_testimonials USING btree (brand_id);


--
-- Name: program_testimonials_is_featured_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_testimonials_is_featured_idx ON public.program_testimonials USING btree (is_featured);


--
-- Name: program_testimonials_order_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_testimonials_order_idx ON public.program_testimonials USING btree ("order");


--
-- Name: program_testimonials_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_testimonials_program_id_idx ON public.program_testimonials USING btree (program_id);


--
-- Name: program_testimonials_type_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_testimonials_type_idx ON public.program_testimonials USING btree (type);


--
-- Name: program_timeline_date_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_timeline_date_idx ON public.program_timeline USING btree (date);


--
-- Name: program_timeline_order_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_timeline_order_idx ON public.program_timeline USING btree ("order");


--
-- Name: program_timeline_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_timeline_program_id_idx ON public.program_timeline USING btree (program_id);


--
-- Name: program_waitlist_position_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_waitlist_position_idx ON public.program_waitlist USING btree ("position");


--
-- Name: program_waitlist_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_waitlist_program_id_idx ON public.program_waitlist USING btree (program_id);


--
-- Name: program_waitlist_program_id_user_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX program_waitlist_program_id_user_id_key ON public.program_waitlist USING btree (program_id, user_id);


--
-- Name: program_waitlist_user_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX program_waitlist_user_id_idx ON public.program_waitlist USING btree (user_id);


--
-- Name: programs_brand_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX programs_brand_id_idx ON public.programs USING btree (brand_id);


--
-- Name: programs_brand_id_slug_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX programs_brand_id_slug_key ON public.programs USING btree (brand_id, slug);


--
-- Name: programs_deleted_at_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX programs_deleted_at_idx ON public.programs USING btree (deleted_at);


--
-- Name: programs_is_published_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX programs_is_published_idx ON public.programs USING btree (is_published);


--
-- Name: programs_is_visible_to_users_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX programs_is_visible_to_users_idx ON public.programs USING btree (is_visible_to_users);


--
-- Name: programs_legacy_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX programs_legacy_id_key ON public.programs USING btree (legacy_id);


--
-- Name: programs_status_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX programs_status_idx ON public.programs USING btree (status);


--
-- Name: programs_year_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX programs_year_idx ON public.programs USING btree (year);


--
-- Name: scoring_categories_schema_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX scoring_categories_schema_id_idx ON public.scoring_categories USING btree (schema_id);


--
-- Name: scoring_criteria_category_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX scoring_criteria_category_id_idx ON public.scoring_criteria USING btree (category_id);


--
-- Name: scoring_criteria_legacy_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX scoring_criteria_legacy_id_key ON public.scoring_criteria USING btree (legacy_id);


--
-- Name: scoring_schemas_is_active_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX scoring_schemas_is_active_idx ON public.scoring_schemas USING btree (is_active);


--
-- Name: scoring_schemas_legacy_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX scoring_schemas_legacy_id_key ON public.scoring_schemas USING btree (legacy_id);


--
-- Name: scoring_schemas_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX scoring_schemas_program_id_idx ON public.scoring_schemas USING btree (program_id);


--
-- Name: sponsors_brand_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX sponsors_brand_id_idx ON public.sponsors USING btree (brand_id);


--
-- Name: sponsors_order_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX sponsors_order_idx ON public.sponsors USING btree ("order");


--
-- Name: sponsors_tier_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX sponsors_tier_idx ON public.sponsors USING btree (tier);


--
-- Name: sponsors_type_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX sponsors_type_idx ON public.sponsors USING btree (type);


--
-- Name: sponsorship_tiers_brand_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX sponsorship_tiers_brand_id_idx ON public.sponsorship_tiers USING btree (brand_id);


--
-- Name: sponsorship_tiers_program_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX sponsorship_tiers_program_id_idx ON public.sponsorship_tiers USING btree (program_id);


--
-- Name: support_ticket_messages_created_at_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX support_ticket_messages_created_at_idx ON public.support_ticket_messages USING btree (created_at);


--
-- Name: support_ticket_messages_legacy_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX support_ticket_messages_legacy_id_key ON public.support_ticket_messages USING btree (legacy_id);


--
-- Name: support_ticket_messages_sender_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX support_ticket_messages_sender_id_idx ON public.support_ticket_messages USING btree (sender_id);


--
-- Name: support_ticket_messages_ticket_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX support_ticket_messages_ticket_id_idx ON public.support_ticket_messages USING btree (ticket_id);


--
-- Name: support_tickets_assigned_to_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX support_tickets_assigned_to_idx ON public.support_tickets USING btree (assigned_to);


--
-- Name: support_tickets_created_at_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX support_tickets_created_at_idx ON public.support_tickets USING btree (created_at);


--
-- Name: support_tickets_legacy_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX support_tickets_legacy_id_key ON public.support_tickets USING btree (legacy_id);


--
-- Name: support_tickets_participant_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX support_tickets_participant_id_idx ON public.support_tickets USING btree (participant_id);


--
-- Name: support_tickets_priority_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX support_tickets_priority_idx ON public.support_tickets USING btree (priority);


--
-- Name: support_tickets_status_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX support_tickets_status_idx ON public.support_tickets USING btree (status);


--
-- Name: support_tickets_ticket_number_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX support_tickets_ticket_number_idx ON public.support_tickets USING btree (ticket_number);


--
-- Name: support_tickets_ticket_number_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX support_tickets_ticket_number_key ON public.support_tickets USING btree (ticket_number);


--
-- Name: system_announcements_is_published_published_at_deleted_at_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX system_announcements_is_published_published_at_deleted_at_idx ON public.system_announcements USING btree (is_published, published_at, deleted_at);


--
-- Name: system_announcements_show_banner_is_published_deleted_at_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX system_announcements_show_banner_is_published_deleted_at_idx ON public.system_announcements USING btree (show_banner, is_published, deleted_at);


--
-- Name: system_announcements_start_date_end_date_is_published_delet_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX system_announcements_start_date_end_date_is_published_delet_idx ON public.system_announcements USING btree (start_date, end_date, is_published, deleted_at);


--
-- Name: system_announcements_target_audience_brand_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX system_announcements_target_audience_brand_id_idx ON public.system_announcements USING btree (target_audience, brand_id);


--
-- Name: user_activity_logs_activity_type_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_activity_logs_activity_type_idx ON public.user_activity_logs USING btree (activity_type);


--
-- Name: user_activity_logs_created_at_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_activity_logs_created_at_idx ON public.user_activity_logs USING btree (created_at);


--
-- Name: user_activity_logs_session_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_activity_logs_session_id_idx ON public.user_activity_logs USING btree (session_id);


--
-- Name: user_activity_logs_user_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_activity_logs_user_id_idx ON public.user_activity_logs USING btree (user_id);


--
-- Name: user_announcement_reads_announcement_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_announcement_reads_announcement_id_idx ON public.user_announcement_reads USING btree (announcement_id);


--
-- Name: user_announcement_reads_user_id_announcement_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX user_announcement_reads_user_id_announcement_id_key ON public.user_announcement_reads USING btree (user_id, announcement_id);


--
-- Name: user_announcement_reads_user_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_announcement_reads_user_id_idx ON public.user_announcement_reads USING btree (user_id);


--
-- Name: user_blocked_accounts_blocked_until_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_blocked_accounts_blocked_until_idx ON public.user_blocked_accounts USING btree (blocked_until);


--
-- Name: user_blocked_accounts_user_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_blocked_accounts_user_id_idx ON public.user_blocked_accounts USING btree (user_id);


--
-- Name: user_blocked_accounts_user_id_is_active_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_blocked_accounts_user_id_is_active_idx ON public.user_blocked_accounts USING btree (user_id, is_active);


--
-- Name: user_identities_provider_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_identities_provider_id_idx ON public.user_identities USING btree (provider_id);


--
-- Name: user_identities_provider_id_provider_user_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX user_identities_provider_id_provider_user_id_key ON public.user_identities USING btree (provider_id, provider_user_id);


--
-- Name: user_identities_provider_user_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_identities_provider_user_id_idx ON public.user_identities USING btree (provider_user_id);


--
-- Name: user_identities_user_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_identities_user_id_idx ON public.user_identities USING btree (user_id);


--
-- Name: user_identities_user_id_provider_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX user_identities_user_id_provider_id_key ON public.user_identities USING btree (user_id, provider_id);


--
-- Name: user_notifications_type_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_notifications_type_idx ON public.user_notifications USING btree (type);


--
-- Name: user_notifications_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_notifications_user_id_created_at_idx ON public.user_notifications USING btree (user_id, created_at);


--
-- Name: user_notifications_user_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_notifications_user_id_idx ON public.user_notifications USING btree (user_id);


--
-- Name: user_notifications_user_id_is_read_deleted_at_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_notifications_user_id_is_read_deleted_at_idx ON public.user_notifications USING btree (user_id, is_read, deleted_at);


--
-- Name: user_notifications_user_id_priority_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_notifications_user_id_priority_idx ON public.user_notifications USING btree (user_id, priority);


--
-- Name: user_preferences_user_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_preferences_user_id_idx ON public.user_preferences USING btree (user_id);


--
-- Name: user_preferences_user_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX user_preferences_user_id_key ON public.user_preferences USING btree (user_id);


--
-- Name: user_privacy_consents_user_id_consent_type_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_privacy_consents_user_id_consent_type_idx ON public.user_privacy_consents USING btree (user_id, consent_type);


--
-- Name: user_privacy_consents_user_id_consent_type_is_granted_revok_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_privacy_consents_user_id_consent_type_is_granted_revok_idx ON public.user_privacy_consents USING btree (user_id, consent_type, is_granted, revoked_at);


--
-- Name: user_privacy_consents_user_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_privacy_consents_user_id_idx ON public.user_privacy_consents USING btree (user_id);


--
-- Name: user_security_logs_created_at_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_security_logs_created_at_idx ON public.user_security_logs USING btree (created_at);


--
-- Name: user_security_logs_event_type_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_security_logs_event_type_idx ON public.user_security_logs USING btree (event_type);


--
-- Name: user_security_logs_risk_level_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_security_logs_risk_level_idx ON public.user_security_logs USING btree (risk_level);


--
-- Name: user_security_logs_user_id_flagged_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_security_logs_user_id_flagged_idx ON public.user_security_logs USING btree (user_id, flagged);


--
-- Name: user_security_logs_user_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_security_logs_user_id_idx ON public.user_security_logs USING btree (user_id);


--
-- Name: user_sessions_expires_at_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_sessions_expires_at_idx ON public.user_sessions USING btree (expires_at);


--
-- Name: user_sessions_refresh_token_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX user_sessions_refresh_token_key ON public.user_sessions USING btree (refresh_token);


--
-- Name: user_sessions_session_token_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_sessions_session_token_idx ON public.user_sessions USING btree (session_token);


--
-- Name: user_sessions_session_token_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX user_sessions_session_token_key ON public.user_sessions USING btree (session_token);


--
-- Name: user_sessions_user_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_sessions_user_id_idx ON public.user_sessions USING btree (user_id);


--
-- Name: user_sessions_user_id_is_active_revoked_at_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX user_sessions_user_id_is_active_revoked_at_idx ON public.user_sessions USING btree (user_id, is_active, revoked_at);


--
-- Name: users_brand_id_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX users_brand_id_idx ON public.users USING btree (brand_id);


--
-- Name: users_email_brand_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX users_email_brand_id_key ON public.users USING btree (email, brand_id);


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX users_email_idx ON public.users USING btree (email);


--
-- Name: users_email_verified_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX users_email_verified_idx ON public.users USING btree (email_verified);


--
-- Name: users_is_active_deleted_at_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX users_is_active_deleted_at_idx ON public.users USING btree (is_active, deleted_at);


--
-- Name: users_legacy_id_key; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE UNIQUE INDEX users_legacy_id_key ON public.users USING btree (legacy_id);


--
-- Name: users_password_reset_token_idx; Type: INDEX; Schema: public; Owner: ybb_user
--

CREATE INDEX users_password_reset_token_idx ON public.users USING btree (password_reset_token);


--
-- Name: account_deletion_requests account_deletion_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.account_deletion_requests
    ADD CONSTRAINT account_deletion_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.admins(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: account_deletion_requests account_deletion_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.account_deletion_requests
    ADD CONSTRAINT account_deletion_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: admin_brands admin_brands_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.admin_brands
    ADD CONSTRAINT admin_brands_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admins(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: admin_brands admin_brands_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.admin_brands
    ADD CONSTRAINT admin_brands_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: admin_programs admin_programs_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.admin_programs
    ADD CONSTRAINT admin_programs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admins(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: admin_programs admin_programs_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.admin_programs
    ADD CONSTRAINT admin_programs_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: admins admins_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.admin_roles(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: admins admins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ai_chatbot_configs ai_chatbot_configs_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.ai_chatbot_configs
    ADD CONSTRAINT ai_chatbot_configs_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ambassador_referrals ambassador_referrals_ambassador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.ambassador_referrals
    ADD CONSTRAINT ambassador_referrals_ambassador_id_fkey FOREIGN KEY (ambassador_id) REFERENCES public.ambassadors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ambassador_referrals ambassador_referrals_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.ambassador_referrals
    ADD CONSTRAINT ambassador_referrals_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ambassador_referrals ambassador_referrals_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.ambassador_referrals
    ADD CONSTRAINT ambassador_referrals_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.admins(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ambassadors ambassadors_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.ambassadors
    ADD CONSTRAINT ambassadors_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ambassadors ambassadors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.ambassadors
    ADD CONSTRAINT ambassadors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: application_assessments application_assessments_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.application_assessments
    ADD CONSTRAINT application_assessments_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.participant_applications(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: application_assessments application_assessments_assessor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.application_assessments
    ADD CONSTRAINT application_assessments_assessor_id_fkey FOREIGN KEY (assessor_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: application_edit_history application_edit_history_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.application_edit_history
    ADD CONSTRAINT application_edit_history_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.participant_applications(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: application_edit_history application_edit_history_edited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.application_edit_history
    ADD CONSTRAINT application_edit_history_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: application_form_fields application_form_fields_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.application_form_fields
    ADD CONSTRAINT application_form_fields_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: application_invoices application_invoices_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.application_invoices
    ADD CONSTRAINT application_invoices_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.participant_applications(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: application_invoices application_invoices_pricing_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.application_invoices
    ADD CONSTRAINT application_invoices_pricing_tier_id_fkey FOREIGN KEY (pricing_tier_id) REFERENCES public.program_pricing_tiers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: application_reviews application_reviews_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.application_reviews
    ADD CONSTRAINT application_reviews_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.participant_applications(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: application_reviews application_reviews_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.application_reviews
    ADD CONSTRAINT application_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.admins(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: application_reviews application_reviews_schema_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.application_reviews
    ADD CONSTRAINT application_reviews_schema_id_fkey FOREIGN KEY (schema_id) REFERENCES public.scoring_schemas(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: application_score_items application_score_items_criterion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.application_score_items
    ADD CONSTRAINT application_score_items_criterion_id_fkey FOREIGN KEY (criterion_id) REFERENCES public.scoring_criteria(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: application_score_items application_score_items_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.application_score_items
    ADD CONSTRAINT application_score_items_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.application_reviews(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: brand_settings brand_settings_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.brand_settings
    ADD CONSTRAINT brand_settings_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: brand_social_feeds brand_social_feeds_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.brand_social_feeds
    ADD CONSTRAINT brand_social_feeds_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: certificate_templates certificate_templates_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.certificate_templates
    ADD CONSTRAINT certificate_templates_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: email_templates email_templates_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: email_templates email_templates_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: files files_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ambassadors fk_ambassador_deleted_by_admin; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.ambassadors
    ADD CONSTRAINT fk_ambassador_deleted_by_admin FOREIGN KEY (deleted_by) REFERENCES public.admins(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ambassadors fk_ambassador_deleted_by_user; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.ambassadors
    ADD CONSTRAINT fk_ambassador_deleted_by_user FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: participants fk_participant_deleted_by_admin; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT fk_participant_deleted_by_admin FOREIGN KEY (deleted_by) REFERENCES public.admins(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: participants fk_participant_deleted_by_user; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT fk_participant_deleted_by_user FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: legal_documents legal_documents_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.legal_documents
    ADD CONSTRAINT legal_documents_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: newsletter_subscribers newsletter_subscribers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: participant_applications participant_applications_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.participant_applications
    ADD CONSTRAINT participant_applications_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: participant_applications participant_applications_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.participant_applications
    ADD CONSTRAINT participant_applications_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: participant_applications participant_applications_participation_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.participant_applications
    ADD CONSTRAINT participant_applications_participation_category_id_fkey FOREIGN KEY (participation_category_id) REFERENCES public.program_participation_categories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: participant_applications participant_applications_pricing_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.participant_applications
    ADD CONSTRAINT participant_applications_pricing_tier_id_fkey FOREIGN KEY (pricing_tier_id) REFERENCES public.program_pricing_tiers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: participant_applications participant_applications_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.participant_applications
    ADD CONSTRAINT participant_applications_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: participant_applications participant_applications_withdrawn_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.participant_applications
    ADD CONSTRAINT participant_applications_withdrawn_by_fkey FOREIGN KEY (withdrawn_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: participant_awards participant_awards_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.participant_awards
    ADD CONSTRAINT participant_awards_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.participant_applications(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: participant_awards participant_awards_awarded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.participant_awards
    ADD CONSTRAINT participant_awards_awarded_by_fkey FOREIGN KEY (awarded_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: participant_awards participant_awards_program_award_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.participant_awards
    ADD CONSTRAINT participant_awards_program_award_id_fkey FOREIGN KEY (program_award_id) REFERENCES public.program_awards(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: participant_documents participant_documents_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.participant_documents
    ADD CONSTRAINT participant_documents_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.participant_applications(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: participant_documents participant_documents_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.participant_documents
    ADD CONSTRAINT participant_documents_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.document_templates(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: participants participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: partnership_enquiries partnership_enquiries_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.partnership_enquiries
    ADD CONSTRAINT partnership_enquiries_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: partnership_enquiries partnership_enquiries_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.partnership_enquiries
    ADD CONSTRAINT partnership_enquiries_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: partnership_opportunities partnership_opportunities_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.partnership_opportunities
    ADD CONSTRAINT partnership_opportunities_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: partnership_opportunities partnership_opportunities_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.partnership_opportunities
    ADD CONSTRAINT partnership_opportunities_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: pricing_tier_validity_periods pricing_tier_validity_periods_pricing_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.pricing_tier_validity_periods
    ADD CONSTRAINT pricing_tier_validity_periods_pricing_tier_id_fkey FOREIGN KEY (pricing_tier_id) REFERENCES public.program_pricing_tiers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_announcement_reads program_announcement_reads_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_announcement_reads
    ADD CONSTRAINT program_announcement_reads_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.program_announcements(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_announcement_reads program_announcement_reads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_announcement_reads
    ADD CONSTRAINT program_announcement_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_announcements program_announcements_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_announcements
    ADD CONSTRAINT program_announcements_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_awards program_awards_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_awards
    ADD CONSTRAINT program_awards_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_essays program_essays_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_essays
    ADD CONSTRAINT program_essays_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_faqs program_faqs_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_faqs
    ADD CONSTRAINT program_faqs_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_gallery program_gallery_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_gallery
    ADD CONSTRAINT program_gallery_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_objectives program_objectives_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_objectives
    ADD CONSTRAINT program_objectives_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_participation_categories program_participation_categories_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_participation_categories
    ADD CONSTRAINT program_participation_categories_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_participation_infos program_participation_infos_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_participation_infos
    ADD CONSTRAINT program_participation_infos_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_partners program_partners_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_partners
    ADD CONSTRAINT program_partners_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_pricing_tiers program_pricing_tiers_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_pricing_tiers
    ADD CONSTRAINT program_pricing_tiers_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_requirements program_requirements_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_requirements
    ADD CONSTRAINT program_requirements_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_resources program_resources_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_resources
    ADD CONSTRAINT program_resources_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_schedules program_schedules_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_schedules
    ADD CONSTRAINT program_schedules_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_speakers program_speakers_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_speakers
    ADD CONSTRAINT program_speakers_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_subthemes program_subthemes_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_subthemes
    ADD CONSTRAINT program_subthemes_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_tag_relations program_tag_relations_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_tag_relations
    ADD CONSTRAINT program_tag_relations_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_tag_relations program_tag_relations_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_tag_relations
    ADD CONSTRAINT program_tag_relations_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.program_tags(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_team program_team_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_team
    ADD CONSTRAINT program_team_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_team program_team_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_team
    ADD CONSTRAINT program_team_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_testimonials program_testimonials_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_testimonials
    ADD CONSTRAINT program_testimonials_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_testimonials program_testimonials_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_testimonials
    ADD CONSTRAINT program_testimonials_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_timeline program_timeline_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_timeline
    ADD CONSTRAINT program_timeline_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_waitlist program_waitlist_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_waitlist
    ADD CONSTRAINT program_waitlist_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_waitlist program_waitlist_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.program_waitlist
    ADD CONSTRAINT program_waitlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: programs programs_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: scoring_categories scoring_categories_schema_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.scoring_categories
    ADD CONSTRAINT scoring_categories_schema_id_fkey FOREIGN KEY (schema_id) REFERENCES public.scoring_schemas(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: scoring_criteria scoring_criteria_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.scoring_criteria
    ADD CONSTRAINT scoring_criteria_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.scoring_categories(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: scoring_schemas scoring_schemas_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.scoring_schemas
    ADD CONSTRAINT scoring_schemas_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sponsors sponsors_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.sponsors
    ADD CONSTRAINT sponsors_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sponsorship_tiers sponsorship_tiers_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.sponsorship_tiers
    ADD CONSTRAINT sponsorship_tiers_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sponsorship_tiers sponsorship_tiers_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.sponsorship_tiers
    ADD CONSTRAINT sponsorship_tiers_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: support_ticket_messages support_ticket_messages_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.support_ticket_messages
    ADD CONSTRAINT support_ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: system_announcements system_announcements_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.system_announcements
    ADD CONSTRAINT system_announcements_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: system_announcements system_announcements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.system_announcements
    ADD CONSTRAINT system_announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admins(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: system_announcements system_announcements_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.system_announcements
    ADD CONSTRAINT system_announcements_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: system_announcements system_announcements_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.system_announcements
    ADD CONSTRAINT system_announcements_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.admins(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: user_activity_logs user_activity_logs_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.user_activity_logs
    ADD CONSTRAINT user_activity_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.user_sessions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: user_activity_logs user_activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.user_activity_logs
    ADD CONSTRAINT user_activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_announcement_reads user_announcement_reads_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.user_announcement_reads
    ADD CONSTRAINT user_announcement_reads_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.system_announcements(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_announcement_reads user_announcement_reads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.user_announcement_reads
    ADD CONSTRAINT user_announcement_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_blocked_accounts user_blocked_accounts_blocked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.user_blocked_accounts
    ADD CONSTRAINT user_blocked_accounts_blocked_by_fkey FOREIGN KEY (blocked_by) REFERENCES public.admins(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: user_blocked_accounts user_blocked_accounts_unblocked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.user_blocked_accounts
    ADD CONSTRAINT user_blocked_accounts_unblocked_by_fkey FOREIGN KEY (unblocked_by) REFERENCES public.admins(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: user_blocked_accounts user_blocked_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.user_blocked_accounts
    ADD CONSTRAINT user_blocked_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_identities user_identities_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT user_identities_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.auth_providers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_identities user_identities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT user_identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_notifications user_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_preferences user_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_privacy_consents user_privacy_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.user_privacy_consents
    ADD CONSTRAINT user_privacy_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_security_logs user_security_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.user_security_logs
    ADD CONSTRAINT user_security_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ybb_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: ybb_user
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict Jf6l2fvpqi9YZh4o8mq3FZUmGHkK0imKSn0mnq2bt0DnR8aFlYu5zvG6hO606n7

