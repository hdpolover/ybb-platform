-- Add program_format enum + column to programs table.
-- Captures the delivery mode of a program (in-person, hybrid, online).
-- Distinct from program_type, which captures the event style (cohort, conference, workshop, etc.).
-- Nullable so existing programs are unaffected until explicitly set.

CREATE TYPE "ProgramFormat" AS ENUM ('in_person', 'hybrid', 'online');

ALTER TABLE "programs" ADD COLUMN "program_format" "ProgramFormat";
