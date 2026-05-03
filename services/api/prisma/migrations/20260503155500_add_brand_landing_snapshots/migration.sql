CREATE TABLE "brand_landing_snapshots" (
  "brand_id" UUID NOT NULL,
  "page" VARCHAR(64) NOT NULL,
  "slug" VARCHAR(255) NOT NULL DEFAULT '',
  "payload_json" JSONB NOT NULL,
  "schema_version" INTEGER NOT NULL DEFAULT 1,
  "published_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "brand_landing_snapshots_pkey" PRIMARY KEY ("brand_id", "page", "slug")
);

CREATE INDEX "brand_landing_snapshots_published_at_idx"
  ON "brand_landing_snapshots"("published_at");

ALTER TABLE "brand_landing_snapshots"
  ADD CONSTRAINT "brand_landing_snapshots_brand_id_fkey"
  FOREIGN KEY ("brand_id") REFERENCES "brands"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
