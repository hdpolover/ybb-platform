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

-- CreateIndex
CREATE INDEX "program_social_feeds_program_category_id_idx" ON "program_social_feeds"("program_category_id");

-- CreateIndex
CREATE INDEX "program_social_feeds_platform_idx" ON "program_social_feeds"("platform");

-- CreateIndex
CREATE INDEX "program_social_feeds_posted_at_idx" ON "program_social_feeds"("posted_at");

-- AddForeignKey
ALTER TABLE "program_social_feeds" ADD CONSTRAINT "program_social_feeds_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
