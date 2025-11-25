-- CreateTable: program_pricing_tiers
CREATE TABLE "program_pricing_tiers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "capacity" INTEGER,
    "sold_count" INTEGER NOT NULL DEFAULT 0,
    "valid_from" TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    "valid_until" TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    "benefits" JSONB DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CONSTRAINT "program_pricing_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: program_requirements
CREATE TABLE "program_requirements" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "type" VARCHAR(50) NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "file_max_size" INTEGER,
    "file_allowed_types" VARCHAR(255),
    "options" JSONB DEFAULT '[]',
    "validation_rules" JSONB DEFAULT '{}',
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CONSTRAINT "program_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable: application_form_fields
CREATE TABLE "application_form_fields" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "field_name" VARCHAR(100) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "placeholder" VARCHAR(255),
    "help_text" TEXT,
    "field_type" VARCHAR(50) NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB DEFAULT '[]',
    "validation_rules" JSONB DEFAULT '{}',
    "default_value" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CONSTRAINT "application_form_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable: email_templates
CREATE TABLE "email_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_category_id" UUID,
    "program_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "variables" JSONB DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable: program_team
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
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CONSTRAINT "program_team_pkey" PRIMARY KEY ("id")
);

-- CreateTable: program_partners
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
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CONSTRAINT "program_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable: program_resources
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
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CONSTRAINT "program_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable: program_announcements
CREATE TABLE "program_announcements" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "target_audience" VARCHAR(50) NOT NULL DEFAULT 'all',
    "send_email" BOOLEAN NOT NULL DEFAULT false,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "publish_date" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CONSTRAINT "program_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable: program_tags
CREATE TABLE "program_tags" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "color" VARCHAR(7),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CONSTRAINT "program_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable: program_tag_relations
CREATE TABLE "program_tag_relations" (
    "program_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "program_tag_relations_pkey" PRIMARY KEY ("program_id","tag_id")
);

-- CreateTable: program_waitlist
CREATE TABLE "program_waitlist" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable: certificate_templates
CREATE TABLE "certificate_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "template_url" VARCHAR(500) NOT NULL,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CONSTRAINT "certificate_templates_pkey" PRIMARY KEY ("id")
);

-- AlterTable: participant_applications - Add pricing tier fields
ALTER TABLE "participant_applications" 
ADD COLUMN "pricing_tier_id" UUID,
ADD COLUMN "payment_amount" DECIMAL(10,2);

-- CreateIndex
CREATE INDEX "program_pricing_tiers_program_id_idx" ON "program_pricing_tiers"("program_id");
CREATE INDEX "program_pricing_tiers_is_active_idx" ON "program_pricing_tiers"("is_active");
CREATE INDEX "program_pricing_tiers_valid_from_valid_until_idx" ON "program_pricing_tiers"("valid_from", "valid_until");

CREATE INDEX "program_requirements_program_id_idx" ON "program_requirements"("program_id");
CREATE INDEX "program_requirements_type_idx" ON "program_requirements"("type");
CREATE INDEX "program_requirements_order_idx" ON "program_requirements"("order");

CREATE INDEX "application_form_fields_program_id_idx" ON "application_form_fields"("program_id");
CREATE INDEX "application_form_fields_field_type_idx" ON "application_form_fields"("field_type");
CREATE INDEX "application_form_fields_order_idx" ON "application_form_fields"("order");

CREATE INDEX "email_templates_program_category_id_idx" ON "email_templates"("program_category_id");
CREATE INDEX "email_templates_program_id_idx" ON "email_templates"("program_id");
CREATE INDEX "email_templates_type_idx" ON "email_templates"("type");

CREATE INDEX "program_team_program_category_id_idx" ON "program_team"("program_category_id");
CREATE INDEX "program_team_program_id_idx" ON "program_team"("program_id");
CREATE INDEX "program_team_order_idx" ON "program_team"("order");

CREATE INDEX "program_partners_program_id_idx" ON "program_partners"("program_id");
CREATE INDEX "program_partners_type_idx" ON "program_partners"("type");
CREATE INDEX "program_partners_order_idx" ON "program_partners"("order");

CREATE INDEX "program_resources_program_id_idx" ON "program_resources"("program_id");
CREATE INDEX "program_resources_type_idx" ON "program_resources"("type");
CREATE INDEX "program_resources_is_public_idx" ON "program_resources"("is_public");
CREATE INDEX "program_resources_order_idx" ON "program_resources"("order");

CREATE INDEX "program_announcements_program_id_idx" ON "program_announcements"("program_id");
CREATE INDEX "program_announcements_target_audience_idx" ON "program_announcements"("target_audience");
CREATE INDEX "program_announcements_is_pinned_idx" ON "program_announcements"("is_pinned");
CREATE INDEX "program_announcements_publish_date_idx" ON "program_announcements"("publish_date");

CREATE UNIQUE INDEX "program_tags_name_key" ON "program_tags"("name");
CREATE UNIQUE INDEX "program_tags_slug_key" ON "program_tags"("slug");
CREATE INDEX "program_tags_slug_idx" ON "program_tags"("slug");

CREATE INDEX "program_tag_relations_program_id_idx" ON "program_tag_relations"("program_id");
CREATE INDEX "program_tag_relations_tag_id_idx" ON "program_tag_relations"("tag_id");

CREATE UNIQUE INDEX "program_waitlist_program_id_user_id_key" ON "program_waitlist"("program_id", "user_id");
CREATE INDEX "program_waitlist_program_id_idx" ON "program_waitlist"("program_id");
CREATE INDEX "program_waitlist_user_id_idx" ON "program_waitlist"("user_id");
CREATE INDEX "program_waitlist_position_idx" ON "program_waitlist"("position");

CREATE INDEX "certificate_templates_program_id_idx" ON "certificate_templates"("program_id");

-- AddForeignKey
ALTER TABLE "program_pricing_tiers" ADD CONSTRAINT "program_pricing_tiers_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_requirements" ADD CONSTRAINT "program_requirements_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "application_form_fields" ADD CONSTRAINT "application_form_fields_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_team" ADD CONSTRAINT "program_team_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_team" ADD CONSTRAINT "program_team_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_partners" ADD CONSTRAINT "program_partners_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_resources" ADD CONSTRAINT "program_resources_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_announcements" ADD CONSTRAINT "program_announcements_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_tag_relations" ADD CONSTRAINT "program_tag_relations_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_tag_relations" ADD CONSTRAINT "program_tag_relations_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "program_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_waitlist" ADD CONSTRAINT "program_waitlist_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_waitlist" ADD CONSTRAINT "program_waitlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "certificate_templates" ADD CONSTRAINT "certificate_templates_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "participant_applications" ADD CONSTRAINT "participant_applications_pricing_tier_id_fkey" FOREIGN KEY ("pricing_tier_id") REFERENCES "program_pricing_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create triggers for updated_at
CREATE TRIGGER update_program_pricing_tiers_updated_at BEFORE UPDATE ON program_pricing_tiers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_program_requirements_updated_at BEFORE UPDATE ON program_requirements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_application_form_fields_updated_at BEFORE UPDATE ON application_form_fields FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_program_team_updated_at BEFORE UPDATE ON program_team FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_program_partners_updated_at BEFORE UPDATE ON program_partners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_program_resources_updated_at BEFORE UPDATE ON program_resources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_program_announcements_updated_at BEFORE UPDATE ON program_announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_program_tags_updated_at BEFORE UPDATE ON program_tags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_certificate_templates_updated_at BEFORE UPDATE ON certificate_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
