-- Lease table making each @Cron singleton across API replicas.
--
-- Not an advisory lock: those are session-scoped, and Prisma issues each query
-- on an arbitrary pooled connection, so lock and unlock land on different
-- sessions — the unlock no-ops and the lock wedges a pooled connection forever,
-- silently stopping the job. A lease row is pool-agnostic and self-healing.
--
-- Additive and idempotent; safe to replay on boot.
CREATE TABLE IF NOT EXISTS "cron_locks" (
  "job_name"     VARCHAR(100) PRIMARY KEY,
  "locked_until" TIMESTAMPTZ(6) NOT NULL,
  "holder"       VARCHAR(120)   NOT NULL,
  "updated_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
