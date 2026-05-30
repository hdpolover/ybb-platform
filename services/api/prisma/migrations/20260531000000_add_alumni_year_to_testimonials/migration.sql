-- Add alumni_year column to program_testimonials.
-- Nullable integer so existing rows are unaffected until set in admin.
ALTER TABLE "program_testimonials" ADD COLUMN "alumni_year" INTEGER;
