/*
  Warnings:

  - You are about to drop the column `provider` on the `user_identities` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[user_id,provider_id]` on the table `user_identities` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[provider_id,provider_user_id]` on the table `user_identities` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `provider_id` to the `user_identities` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "user_identities_provider_idx";

-- DropIndex
DROP INDEX "user_identities_provider_provider_id_key";

-- DropIndex
DROP INDEX "user_identities_user_id_provider_key";

-- AlterTable
ALTER TABLE "user_identities" DROP COLUMN "provider",
ADD COLUMN     "provider_user_id" VARCHAR(255),
DROP COLUMN "provider_id",
ADD COLUMN     "provider_id" UUID NOT NULL;

-- CreateTable
CREATE TABLE "auth_providers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "client_id" VARCHAR(255),
    "client_secret" VARCHAR(255),
    "auth_url" VARCHAR(500),
    "token_url" VARCHAR(500),
    "scopes" JSON DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_oauth" BOOLEAN NOT NULL DEFAULT false,
    "icon" VARCHAR(100),
    "button_color" VARCHAR(7),
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "auth_providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_providers_name_key" ON "auth_providers"("name");

-- CreateIndex
CREATE INDEX "auth_providers_name_idx" ON "auth_providers"("name");

-- CreateIndex
CREATE INDEX "auth_providers_is_active_idx" ON "auth_providers"("is_active");

-- CreateIndex
CREATE INDEX "auth_providers_order_idx" ON "auth_providers"("order");

-- CreateIndex
CREATE INDEX "user_identities_provider_id_idx" ON "user_identities"("provider_id");

-- CreateIndex
CREATE INDEX "user_identities_provider_user_id_idx" ON "user_identities"("provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_user_id_provider_id_key" ON "user_identities"("user_id", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_provider_id_provider_user_id_key" ON "user_identities"("provider_id", "provider_user_id");

-- AddForeignKey
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "auth_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
