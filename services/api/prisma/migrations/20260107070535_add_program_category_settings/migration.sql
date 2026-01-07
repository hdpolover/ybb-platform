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

-- CreateIndex
CREATE UNIQUE INDEX "program_category_settings_program_category_id_key" ON "program_category_settings"("program_category_id");

-- AddForeignKey
ALTER TABLE "program_category_settings" ADD CONSTRAINT "program_category_settings_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
