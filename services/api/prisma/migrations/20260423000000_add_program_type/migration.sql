-- Add program_type column to programs table.
-- Stores a human-readable category for the program (e.g. Cohort, Conference, Workshop).
-- Nullable so existing programs are unaffected until explicitly set.
ALTER TABLE "programs" ADD COLUMN "program_type" VARCHAR(100);
