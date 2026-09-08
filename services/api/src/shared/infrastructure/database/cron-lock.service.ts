import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Cron Lock Service
 *
 * Infrastructure Layer - Replica-safe scheduled job execution
 *
 * The API today runs exactly one container, so every @Cron job firing on
 * "the" process has always been safe. Moving to N replicas for a zero-downtime
 * rolling deploy means every replica's ScheduleModule fires the same cron at
 * the same wall-clock tick, so without this, N replicas means N concurrent
 * runs of every scheduled job - N x the reconciliation traffic, N x the
 * outbox claims, N duplicate ops emails from the pricing-tier alert, etc.
 * Several jobs already tolerate this via their own internal claim guard (an
 * `updateMany` gated on a null column), but that is defence in depth for
 * event redelivery, not a substitute for this - some jobs (payment
 * reconciliation, the pricing-tier coverage alert) have no such guard at all.
 *
 * runExclusive() takes a Postgres SESSION-level advisory lock scoped to a
 * jobName, runs the callback only if this replica won the lock, and never
 * throws into the caller - a lock failure degrades to "skip this tick", never
 * a scheduler crash.
 */
/**
 * How long a claimed lease is held before it is considered abandoned.
 *
 * Must comfortably exceed the longest real runtime of any wrapped job: if a job
 * outlives its lease, a second replica may start it while the first is still
 * running, which is the duplicate-run this exists to prevent. Fifteen minutes
 * against jobs that complete in seconds leaves a wide margin, and the cost of
 * it being too long is only that a crashed replica's job waits until the lease
 * expires before another picks it up.
 */
export const CRON_LEASE_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class CronLockService {
  private readonly logger = new Logger(CronLockService.name);

  /**
   * Identifies this process for the lifetime of the container, so a release can
   * be guarded on still being the holder. Regenerated on restart, which is
   * correct: a restarted replica has no claim on a lease it took before.
   */
  private readonly holderId = `${process.env.HOSTNAME ?? 'api'}-${randomUUID().slice(0, 8)}`;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs `fn` only if this replica acquires the advisory lock for `jobName`;
   * otherwise logs and skips. Safe to call from every replica on every tick.
   *
   * Uses pg_try_advisory_lock (non-blocking), never pg_advisory_lock. For a
   * periodic job the correct behaviour when another replica already holds the
   * lock is to skip this tick, not to block and run late: a blocking lock
   * would queue every replica behind the holder, and the instant it releases
   * they would all acquire in succession and fire back-to-back - exactly the
   * pile-up this service exists to prevent, just delayed by one lock wait.
   *
   * The lock is SESSION-level (not transaction-level), taken and released
   * explicitly rather than via `pg_try_advisory_xact_lock`, and released in a
   * `finally` around the whole call - including a `fn` that throws - so a
   * crash mid-job still frees the lock instead of wedging every future tick
   * of this job until the connection is recycled.
   *
   * Acquiring the lock is itself wrapped in try/catch: a Postgres/pool blip
   * here must never propagate into the scheduler and crash the caller. It is
   * treated exactly like "lock not acquired" - skip this tick, try again next
   * time.
   */
  async runExclusive(jobName: string, fn: () => Promise<void>): Promise<void> {
    const acquired = await this.acquire(jobName);
    if (!acquired) return;

    try {
      await fn();
    } finally {
      await this.release(jobName);
    }
  }

  /**
   * Claim the lease in ONE statement, so two replicas racing the same tick
   * cannot both win.
   *
   * The `WHERE cron_locks.locked_until < now()` on the DO UPDATE is the whole
   * mechanism: an INSERT that conflicts only updates — and therefore only
   * RETURNS a row — when the existing lease has expired. A live lease returns
   * no rows, which is the signal to skip.
   *
   * now() is the DATABASE clock on purpose. Replica clocks can drift, and two
   * replicas disagreeing about whether a lease has expired is exactly the race
   * this exists to prevent.
   */
  private async acquire(jobName: string): Promise<boolean> {
    try {
      const rows = await this.prisma.$queryRaw<{ job_name: string }[]>`
        INSERT INTO cron_locks (job_name, locked_until, holder, updated_at)
        VALUES (
          ${jobName},
          now() + make_interval(secs => ${CRON_LEASE_TTL_MS / 1000}::double precision),
          ${this.holderId},
          now()
        )
        ON CONFLICT (job_name) DO UPDATE
          SET locked_until = EXCLUDED.locked_until,
              holder       = EXCLUDED.holder,
              updated_at   = now()
          WHERE cron_locks.locked_until < now()
        RETURNING job_name
      `;

      if (rows.length === 0) {
        this.logger.debug(`[cron-lock] ${jobName}: lease held by another replica, skipping this tick`);
        return false;
      }
      return true;
    } catch (error) {
      // A database blip must not take the scheduler down. Skipping a tick is
      // recoverable; throwing into Nest's scheduler is not.
      this.logger.warn(
        `[cron-lock] ${jobName}: could not claim lease, skipping this tick: ${toErrorMessage(error)}`,
      );
      return false;
    }
  }

  /**
   * Release by expiring the lease, guarded on `holder`.
   *
   * The holder guard matters: if this replica overran the TTL, another replica
   * may legitimately hold the lease now, and releasing it would let a third
   * start while that one is still working.
   *
   * A failed release is not a wedge — the lease expires on its own at
   * locked_until. That is the property the advisory-lock version did not have.
   */
  private async release(jobName: string): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        UPDATE cron_locks
        SET locked_until = now(), updated_at = now()
        WHERE job_name = ${jobName} AND holder = ${this.holderId}
      `;
    } catch (error) {
      this.logger.warn(
        `[cron-lock] ${jobName}: failed to release lease, it will expire on its own: ${toErrorMessage(error)}`,
      );
    }
  }

}

function toErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.length > 500 ? raw.slice(0, 500) : raw;
}
