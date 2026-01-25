-- CreateTable
CREATE TABLE "program_essays" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "description" TEXT,
    "word_limit" INTEGER,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "program_essays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "program_essays_program_id_idx" ON "program_essays"("program_id");

-- CreateIndex
CREATE INDEX "program_essays_is_active_idx" ON "program_essays"("is_active");

-- AddForeignKey
ALTER TABLE "program_essays" ADD CONSTRAINT "program_essays_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
