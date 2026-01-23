-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_onboarding_completed" BOOLEAN NOT NULL DEFAULT false;

