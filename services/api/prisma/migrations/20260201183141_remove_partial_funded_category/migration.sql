-- AlterEnum
BEGIN;
CREATE TYPE "ApplicationCategory_new" AS ENUM ('fully_funded', 'self_funded');
ALTER TABLE "public"."program_pricing_tiers" ALTER COLUMN "allowed_categories" DROP DEFAULT;
ALTER TABLE "program_pricing_tiers" ALTER COLUMN "allowed_categories" TYPE "ApplicationCategory_new"[] USING ("allowed_categories"::text::"ApplicationCategory_new"[]);
ALTER TABLE "participant_applications" ALTER COLUMN "application_category" TYPE "ApplicationCategory_new" USING ("application_category"::text::"ApplicationCategory_new");
ALTER TABLE "program_participation_infos" ALTER COLUMN "category" TYPE "ApplicationCategory_new" USING ("category"::text::"ApplicationCategory_new");
ALTER TYPE "ApplicationCategory" RENAME TO "ApplicationCategory_old";
ALTER TYPE "ApplicationCategory_new" RENAME TO "ApplicationCategory";
DROP TYPE "public"."ApplicationCategory_old";
ALTER TABLE "program_pricing_tiers" ALTER COLUMN "allowed_categories" SET DEFAULT ARRAY['self_funded']::"ApplicationCategory"[];
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PricingTarget_new" AS ENUM ('self_funded', 'fully_funded', 'all');
ALTER TABLE "public"."program_timeline" ALTER COLUMN "target_audience" DROP DEFAULT;
ALTER TABLE "program_timeline" ALTER COLUMN "target_audience" TYPE "PricingTarget_new" USING ("target_audience"::text::"PricingTarget_new");
ALTER TYPE "PricingTarget" RENAME TO "PricingTarget_old";
ALTER TYPE "PricingTarget_new" RENAME TO "PricingTarget";
DROP TYPE "public"."PricingTarget_old";
ALTER TABLE "program_timeline" ALTER COLUMN "target_audience" SET DEFAULT 'all';
COMMIT;

-- CreateTable
CREATE TABLE "program_announcement_reads" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "announcement_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_announcement_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "program_announcement_reads_user_id_idx" ON "program_announcement_reads"("user_id");

-- CreateIndex
CREATE INDEX "program_announcement_reads_announcement_id_idx" ON "program_announcement_reads"("announcement_id");

-- CreateIndex
CREATE UNIQUE INDEX "program_announcement_reads_user_id_announcement_id_key" ON "program_announcement_reads"("user_id", "announcement_id");

-- AddForeignKey
ALTER TABLE "program_announcement_reads" ADD CONSTRAINT "program_announcement_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_announcement_reads" ADD CONSTRAINT "program_announcement_reads_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "program_announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

