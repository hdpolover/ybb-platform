-- CreateTable
CREATE TABLE "ai_chatbot_configs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_category_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "type" VARCHAR(20) NOT NULL DEFAULT 'iframe',
    "bot_config" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_on_web" BOOLEAN NOT NULL DEFAULT true,
    "allowed_domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "ai_chatbot_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_chatbot_configs_program_category_id_idx" ON "ai_chatbot_configs"("program_category_id");

-- CreateIndex
CREATE INDEX "ai_chatbot_configs_is_active_idx" ON "ai_chatbot_configs"("is_active");

-- AddForeignKey
ALTER TABLE "ai_chatbot_configs" ADD CONSTRAINT "ai_chatbot_configs_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
