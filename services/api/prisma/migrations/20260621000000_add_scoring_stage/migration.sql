-- CreateEnum
CREATE TYPE "ScoringStage" AS ENUM ('application', 'interview');

-- AlterTable
ALTER TABLE "scoring_schemas" ADD COLUMN "stage" "ScoringStage" NOT NULL DEFAULT 'application';

-- CreateIndex
CREATE INDEX "scoring_schemas_program_id_stage_idx" ON "scoring_schemas" ("program_id", "stage");

-- CreateIndex (partial unique): enforce one active ScoringSchema per (program_id, stage).
-- A partial index is used because Prisma cannot express WHERE clauses in @@unique.
CREATE UNIQUE INDEX "scoring_schemas_program_id_stage_active_uidx"
  ON "scoring_schemas" ("program_id", "stage")
  WHERE "deleted_at" IS NULL;
