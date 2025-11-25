-- AlterTable: Add new columns to program_categories
ALTER TABLE "program_categories" ADD COLUMN "website_url" VARCHAR(255),
ADD COLUMN "about" TEXT,
ADD COLUMN "vision" TEXT,
ADD COLUMN "mission" TEXT,
ADD COLUMN "logo_url" VARCHAR(500),
ADD COLUMN "banner_url" VARCHAR(500),
ADD COLUMN "primary_color" VARCHAR(7),
ADD COLUMN "contact_email" VARCHAR(255),
ADD COLUMN "contact_phone" VARCHAR(50),
ADD COLUMN "contact_whatsapp" VARCHAR(50),
ADD COLUMN "contact_address" TEXT,
ADD COLUMN "social_media_links" JSONB DEFAULT '{}',
ADD COLUMN "default_location" VARCHAR(255),
ADD COLUMN "default_country" VARCHAR(100),
ADD COLUMN "default_timezone" VARCHAR(50),
ADD COLUMN "require_email_verification" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "default_currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
ADD COLUMN "enable_multi_currency" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "meta_title" VARCHAR(255),
ADD COLUMN "meta_description" TEXT,
ADD COLUMN "meta_keywords" TEXT;

-- AlterTable: Add new columns to programs
ALTER TABLE "programs" ADD COLUMN "slug" VARCHAR(255),
ADD COLUMN "short_description" VARCHAR(500),
ADD COLUMN "is_visible_to_users" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
ADD COLUMN "thumbnail_url" VARCHAR(500),
ADD COLUMN "banner_url" VARCHAR(500),
ADD COLUMN "video_url" VARCHAR(500),
ADD COLUMN "require_email_verification" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
ADD COLUMN "enable_currency_conversion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "logo_url" VARCHAR(500),
ADD COLUMN "allow_registration" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "registration_open_date" TIMESTAMP(6) WITH TIME ZONE,
ADD COLUMN "registration_close_date" TIMESTAMP(6) WITH TIME ZONE,
ADD COLUMN "require_payment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "registration_fee" DECIMAL(10,2),
ADD COLUMN "requirements_description" TEXT,
ADD COLUMN "benefits_description" TEXT,
ADD COLUMN "terms_and_conditions" TEXT,
ADD COLUMN "meta_title" VARCHAR(255),
ADD COLUMN "meta_description" TEXT;

-- Generate slugs for existing programs (use name as slug, lowercase, replace spaces with hyphens)
UPDATE "programs" SET "slug" = LOWER(REGEXP_REPLACE("name", '\s+', '-', 'g')) WHERE "slug" IS NULL;

-- Make slug NOT NULL after populating
ALTER TABLE "programs" ALTER COLUMN "slug" SET NOT NULL;

-- CreateTable: program_faqs
CREATE TABLE "program_faqs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CONSTRAINT "program_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: program_timeline
CREATE TABLE "program_timeline" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "date" TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(100),
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CONSTRAINT "program_timeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable: program_schedules
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
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CONSTRAINT "program_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable: program_speakers
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
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CONSTRAINT "program_speakers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: program_gallery
CREATE TABLE "program_gallery" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "image_url" VARCHAR(500) NOT NULL,
    "title" VARCHAR(255),
    "description" TEXT,
    "type" VARCHAR(50) NOT NULL DEFAULT 'image',
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CONSTRAINT "program_gallery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "program_faqs_program_id_idx" ON "program_faqs"("program_id");
CREATE INDEX "program_faqs_order_idx" ON "program_faqs"("order");

CREATE INDEX "program_timeline_program_id_idx" ON "program_timeline"("program_id");
CREATE INDEX "program_timeline_date_idx" ON "program_timeline"("date");
CREATE INDEX "program_timeline_order_idx" ON "program_timeline"("order");

CREATE INDEX "program_schedules_program_id_idx" ON "program_schedules"("program_id");
CREATE INDEX "program_schedules_order_idx" ON "program_schedules"("order");

CREATE INDEX "program_speakers_program_id_idx" ON "program_speakers"("program_id");
CREATE INDEX "program_speakers_order_idx" ON "program_speakers"("order");

CREATE INDEX "program_gallery_program_id_idx" ON "program_gallery"("program_id");
CREATE INDEX "program_gallery_type_idx" ON "program_gallery"("type");
CREATE INDEX "program_gallery_order_idx" ON "program_gallery"("order");

CREATE INDEX "programs_is_visible_to_users_idx" ON "programs"("is_visible_to_users");
CREATE INDEX "programs_status_idx" ON "programs"("status");

-- CreateIndex: Unique constraint for slug per program category
CREATE UNIQUE INDEX "programs_program_category_id_slug_key" ON "programs"("program_category_id", "slug");

-- AddForeignKey
ALTER TABLE "program_faqs" ADD CONSTRAINT "program_faqs_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_timeline" ADD CONSTRAINT "program_timeline_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_schedules" ADD CONSTRAINT "program_schedules_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_speakers" ADD CONSTRAINT "program_speakers_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_gallery" ADD CONSTRAINT "program_gallery_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create triggers for updated_at
CREATE TRIGGER update_program_faqs_updated_at BEFORE UPDATE ON program_faqs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_program_timeline_updated_at BEFORE UPDATE ON program_timeline FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_program_schedules_updated_at BEFORE UPDATE ON program_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_program_speakers_updated_at BEFORE UPDATE ON program_speakers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_program_gallery_updated_at BEFORE UPDATE ON program_gallery FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
