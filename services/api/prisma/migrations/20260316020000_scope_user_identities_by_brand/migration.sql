ALTER TABLE "user_identities"
ADD COLUMN "brand_id" UUID;

UPDATE "user_identities" ui
SET "brand_id" = u."brand_id"
FROM "users" u
WHERE u."id" = ui."user_id";

ALTER TABLE "user_identities"
ALTER COLUMN "brand_id" SET NOT NULL;

ALTER TABLE "user_identities"
ADD CONSTRAINT "user_identities_brand_id_fkey"
FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "user_identities_provider_id_provider_user_id_key";

CREATE UNIQUE INDEX "user_identities_brand_id_provider_id_provider_user_id_key"
ON "user_identities"("brand_id", "provider_id", "provider_user_id");

CREATE INDEX "user_identities_brand_id_idx"
ON "user_identities"("brand_id");