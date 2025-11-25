-- CreateTable: program_testimonials
CREATE TABLE "program_testimonials" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "role" VARCHAR(255),
    "company" VARCHAR(255),
    "testimonial" TEXT NOT NULL,
    "type" VARCHAR(20) NOT NULL DEFAULT 'text',
    "video_url" VARCHAR(500),
    "thumbnail_url" VARCHAR(500),
    "avatar_url" VARCHAR(500),
    "rating" SMALLINT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CONSTRAINT "program_testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable: sponsors
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
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "program_testimonials_program_id_idx" ON "program_testimonials"("program_id");
CREATE INDEX "program_testimonials_type_idx" ON "program_testimonials"("type");
CREATE INDEX "program_testimonials_is_featured_idx" ON "program_testimonials"("is_featured");
CREATE INDEX "program_testimonials_order_idx" ON "program_testimonials"("order");

CREATE INDEX "sponsors_program_category_id_idx" ON "sponsors"("program_category_id");
CREATE INDEX "sponsors_type_idx" ON "sponsors"("type");
CREATE INDEX "sponsors_tier_idx" ON "sponsors"("tier");
CREATE INDEX "sponsors_order_idx" ON "sponsors"("order");

-- AddForeignKey
ALTER TABLE "program_testimonials" ADD CONSTRAINT "program_testimonials_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create triggers for updated_at
CREATE TRIGGER update_program_testimonials_updated_at BEFORE UPDATE ON program_testimonials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sponsors_updated_at BEFORE UPDATE ON sponsors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
