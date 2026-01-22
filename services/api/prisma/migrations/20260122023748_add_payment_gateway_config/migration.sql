-- CreateTable
CREATE TABLE "payment_gateway_configs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_category_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "mode" VARCHAR(20) NOT NULL DEFAULT 'sandbox',
    "server_key" TEXT NOT NULL,
    "client_key" TEXT NOT NULL,
    "webhook_secret" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payment_gateway_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_gateway_configs_program_category_id_idx" ON "payment_gateway_configs"("program_category_id");

-- AddForeignKey
ALTER TABLE "payment_gateway_configs" ADD CONSTRAINT "payment_gateway_configs_program_category_id_fkey" FOREIGN KEY ("program_category_id") REFERENCES "program_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
