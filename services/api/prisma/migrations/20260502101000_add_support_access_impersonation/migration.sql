CREATE TABLE "support_access_configs" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "key" VARCHAR(32) NOT NULL DEFAULT 'global',
  "is_enabled" BOOLEAN NOT NULL DEFAULT false,
  "secret_hash" VARCHAR(255),
  "last_rotated_at" TIMESTAMPTZ(6),
  "updated_by_admin_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_access_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "support_access_configs_key_key" ON "support_access_configs"("key");

CREATE TABLE "support_access_impersonation_tickets" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "admin_id" UUID NOT NULL,
  "target_user_id" UUID NOT NULL,
  "target_participant_id" UUID,
  "target_program_id" UUID,
  "target_brand_id" UUID NOT NULL,
  "reason" TEXT NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "consumed_at" TIMESTAMPTZ(6),
  "revoked_at" TIMESTAMPTZ(6),
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "created_ip_address" INET,
  "created_user_agent" TEXT,
  "consumed_ip_address" INET,
  "consumed_user_agent" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_access_impersonation_tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "support_access_impersonation_tickets_token_hash_key"
  ON "support_access_impersonation_tickets"("token_hash");
CREATE INDEX "support_access_impersonation_tickets_admin_id_idx"
  ON "support_access_impersonation_tickets"("admin_id");
CREATE INDEX "support_access_impersonation_tickets_target_user_id_idx"
  ON "support_access_impersonation_tickets"("target_user_id");
CREATE INDEX "support_access_impersonation_tickets_target_brand_id_idx"
  ON "support_access_impersonation_tickets"("target_brand_id");
CREATE INDEX "support_access_impersonation_tickets_status_expires_at_idx"
  ON "support_access_impersonation_tickets"("status", "expires_at");
