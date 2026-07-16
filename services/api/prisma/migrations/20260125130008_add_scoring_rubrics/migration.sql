-- CreateTable
CREATE TABLE "scoring_schemas" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "legacy_id" INTEGER,

    CONSTRAINT "scoring_schemas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_categories" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "schema_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "weight" DECIMAL(5,2) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "legacy_reference" TEXT,

    CONSTRAINT "scoring_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_criteria" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "category_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "weight" DECIMAL(5,2) NOT NULL,
    "max_score" DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    "order" INTEGER NOT NULL DEFAULT 0,
    "legacy_id" INTEGER,

    CONSTRAINT "scoring_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_reviews" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "application_id" UUID NOT NULL,
    "schema_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "total_score" DECIMAL(5,2) NOT NULL,
    "notes" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "application_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_score_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "review_id" UUID NOT NULL,
    "criterion_id" UUID NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "notes" TEXT,
    "legacy_id" INTEGER,

    CONSTRAINT "application_score_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scoring_schemas_legacy_id_key" ON "scoring_schemas"("legacy_id");

-- CreateIndex
CREATE INDEX "scoring_schemas_program_id_idx" ON "scoring_schemas"("program_id");

-- CreateIndex
CREATE INDEX "scoring_schemas_is_active_idx" ON "scoring_schemas"("is_active");

-- CreateIndex
CREATE INDEX "scoring_categories_schema_id_idx" ON "scoring_categories"("schema_id");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_criteria_legacy_id_key" ON "scoring_criteria"("legacy_id");

-- CreateIndex
CREATE INDEX "scoring_criteria_category_id_idx" ON "scoring_criteria"("category_id");

-- CreateIndex
CREATE INDEX "application_reviews_application_id_idx" ON "application_reviews"("application_id");

-- CreateIndex
CREATE INDEX "application_reviews_reviewer_id_idx" ON "application_reviews"("reviewer_id");

-- CreateIndex
CREATE INDEX "application_reviews_schema_id_idx" ON "application_reviews"("schema_id");

-- CreateIndex
CREATE UNIQUE INDEX "application_score_items_legacy_id_key" ON "application_score_items"("legacy_id");

-- CreateIndex
CREATE INDEX "application_score_items_review_id_idx" ON "application_score_items"("review_id");

-- CreateIndex
CREATE UNIQUE INDEX "application_score_items_review_id_criterion_id_key" ON "application_score_items"("review_id", "criterion_id");

-- AddForeignKey
ALTER TABLE "scoring_schemas" ADD CONSTRAINT "scoring_schemas_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_categories" ADD CONSTRAINT "scoring_categories_schema_id_fkey" FOREIGN KEY ("schema_id") REFERENCES "scoring_schemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_criteria" ADD CONSTRAINT "scoring_criteria_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "scoring_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_reviews" ADD CONSTRAINT "application_reviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "participant_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_reviews" ADD CONSTRAINT "application_reviews_schema_id_fkey" FOREIGN KEY ("schema_id") REFERENCES "scoring_schemas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_reviews" ADD CONSTRAINT "application_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_score_items" ADD CONSTRAINT "application_score_items_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "application_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_score_items" ADD CONSTRAINT "application_score_items_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "scoring_criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
