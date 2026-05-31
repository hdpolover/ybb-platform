-- Legacy content migration support: legacy_id anchors on content models, plus
-- speaker session/instagram fields and announcement SEO (slug/meta) fields.
--
-- Written idempotently (IF NOT EXISTS) on purpose: production had these columns
-- applied via raw DDL during the legacy-content data migration on 2026-05-31, so on
-- prod this migration is a recorded no-op. On fresh/staging databases it creates them.

ALTER TABLE "program_faqs"          ADD COLUMN IF NOT EXISTS "legacy_id" INTEGER;
ALTER TABLE "program_schedules"     ADD COLUMN IF NOT EXISTS "legacy_id" INTEGER;
ALTER TABLE "program_gallery"       ADD COLUMN IF NOT EXISTS "legacy_id" INTEGER;
ALTER TABLE "program_testimonials"  ADD COLUMN IF NOT EXISTS "legacy_id" INTEGER;

ALTER TABLE "program_speakers"      ADD COLUMN IF NOT EXISTS "legacy_id" INTEGER;
ALTER TABLE "program_speakers"      ADD COLUMN IF NOT EXISTS "instagram_url" VARCHAR(500);
ALTER TABLE "program_speakers"      ADD COLUMN IF NOT EXISTS "session_title" VARCHAR(500);
ALTER TABLE "program_speakers"      ADD COLUMN IF NOT EXISTS "session_description" TEXT;
ALTER TABLE "program_speakers"      ADD COLUMN IF NOT EXISTS "session_time" TIMESTAMPTZ(6);
ALTER TABLE "program_speakers"      ADD COLUMN IF NOT EXISTS "is_keynote" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "program_speakers"      ADD COLUMN IF NOT EXISTS "expertise_areas" TEXT;

ALTER TABLE "program_announcements" ADD COLUMN IF NOT EXISTS "legacy_id" INTEGER;
ALTER TABLE "program_announcements" ADD COLUMN IF NOT EXISTS "slug" VARCHAR(255);
ALTER TABLE "program_announcements" ADD COLUMN IF NOT EXISTS "meta_title" VARCHAR(255);
ALTER TABLE "program_announcements" ADD COLUMN IF NOT EXISTS "meta_description" VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS "program_faqs_legacy_id_key"          ON "program_faqs"("legacy_id");
CREATE UNIQUE INDEX IF NOT EXISTS "program_schedules_legacy_id_key"     ON "program_schedules"("legacy_id");
CREATE UNIQUE INDEX IF NOT EXISTS "program_gallery_legacy_id_key"       ON "program_gallery"("legacy_id");
CREATE UNIQUE INDEX IF NOT EXISTS "program_testimonials_legacy_id_key"  ON "program_testimonials"("legacy_id");
CREATE UNIQUE INDEX IF NOT EXISTS "program_speakers_legacy_id_key"      ON "program_speakers"("legacy_id");
CREATE UNIQUE INDEX IF NOT EXISTS "program_announcements_legacy_id_key" ON "program_announcements"("legacy_id");
