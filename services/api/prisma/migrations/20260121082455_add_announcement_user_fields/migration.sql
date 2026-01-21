-- AlterTable
ALTER TABLE "user_announcement_reads" ADD COLUMN     "is_dismissed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_seen_at" TIMESTAMPTZ(6);
