-- CreateTable
CREATE TABLE "program_participation_infos" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "category" "ApplicationCategory" NOT NULL,
    "hero_title" VARCHAR(255),
    "hero_description" TEXT,
    "benefits" JSON DEFAULT '[]',
    "requirements" JSON DEFAULT '[]',
    "sections" JSON DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "program_participation_infos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "program_participation_infos_program_id_category_key" ON "program_participation_infos"("program_id", "category");

-- AddForeignKey
ALTER TABLE "program_participation_infos" ADD CONSTRAINT "program_participation_infos_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
