-- CreateTable
CREATE TABLE "partnership_opportunities" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_category_id" UUID,
    "program_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "subtitle" VARCHAR(255),
    "description" TEXT,
    "features" JSON DEFAULT '[]',
    "cta_label" VARCHAR(50),
    "type" VARCHAR(50) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "partnership_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsorship_tiers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_category_id" UUID,
    "program_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "price_description" VARCHAR(255),
    "description" TEXT,
    "features" JSON DEFAULT '[]',
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "sponsorship_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partnership_enquiries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_category_id" UUID,
    "program_id" UUID,
    "partnership_type" VARCHAR(50) NOT NULL,
    "sub_category" VARCHAR(50),
    "full_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "whatsapp_number" VARCHAR(25),
    "company" VARCHAR(255),
    "subject" VARCHAR(255),
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "partnership_enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partnership_opportunities_program_category_id_idx" ON "partnership_opportunities"("program_category_id");

-- CreateIndex
CREATE INDEX "partnership_opportunities_program_id_idx" ON "partnership_opportunities"("program_id");

-- CreateIndex
CREATE INDEX "partnership_opportunities_type_idx" ON "partnership_opportunities"("type");

-- CreateIndex
CREATE INDEX "sponsorship_tiers_program_category_id_idx" ON "sponsorship_tiers"("program_category_id");

-- CreateIndex
CREATE INDEX "sponsorship_tiers_program_id_idx" ON "sponsorship_tiers"("program_id");

-- CreateIndex
CREATE INDEX "partnership_enquiries_program_category_id_idx" ON "partnership_enquiries"("program_category_id");

-- CreateIndex
CREATE INDEX "partnership_enquiries_program_id_idx" ON "partnership_enquiries"("program_id");

-- CreateIndex
CREATE INDEX "partnership_enquiries_partnership_type_idx" ON "partnership_enquiries"("partnership_type");

-- CreateIndex
CREATE INDEX "partnership_enquiries_status_idx" ON "partnership_enquiries"("status");

-- AddForeignKey
ALTER TABLE "partnership_opportunities" ADD CONSTRAINT "partnership_opportunities_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partnership_opportunities" ADD CONSTRAINT "partnership_opportunities_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsorship_tiers" ADD CONSTRAINT "sponsorship_tiers_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsorship_tiers" ADD CONSTRAINT "sponsorship_tiers_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partnership_enquiries" ADD CONSTRAINT "partnership_enquiries_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partnership_enquiries" ADD CONSTRAINT "partnership_enquiries_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
