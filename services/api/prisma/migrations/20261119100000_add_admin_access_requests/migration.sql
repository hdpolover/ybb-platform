-- Public admin-access request form (approve -> Admin + set-password link).
-- New table, no backfill, no lock on existing tables.
CREATE TABLE "admin_access_requests" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "full_name" VARCHAR(100) NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "whatsapp" VARCHAR(30),
  "division" VARCHAR(50) NOT NULL,
  "requested_program_ids" UUID[] DEFAULT ARRAY[]::UUID[],
  "note" VARCHAR(1000),
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "reviewed_by_admin_id" UUID,
  "reviewed_at" TIMESTAMPTZ(6),
  "reject_reason" VARCHAR(1000),
  "created_admin_id" UUID,
  "ip" VARCHAR(64) NOT NULL,
  "user_agent" VARCHAR(500) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "admin_access_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_access_requests_status_created_at_idx"
  ON "admin_access_requests" ("status", "created_at");

-- One pending request per email: the public POST updates it instead of
-- inserting, and this closes the concurrent-submit race. Partial, so an
-- approved/rejected history row never blocks a fresh request.
CREATE UNIQUE INDEX "admin_access_requests_pending_email_key"
  ON "admin_access_requests" ("email") WHERE "status" = 'pending';
