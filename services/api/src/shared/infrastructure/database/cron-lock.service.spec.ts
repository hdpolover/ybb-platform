// src/shared/infrastructure/database/cron-lock.service.spec.ts
//
// These lock scheduled jobs to ONE replica per tick. The first implementation
// used a Postgres session advisory lock, which is wrong here and wrong
// silently: Prisma issues each query on an arbitrary pooled connection (this
// API runs a pool of 9), so pg_try_advisory_lock and pg_advisory_unlock land on
// different sessions. The unlock no-ops, the lock stays held by a long-lived
// pooled connection, and every later tick fails to acquire — the job stops
// running for good, with no error anywhere. A lease row is pool-agnostic and
// expires on its own.
import { CronLockService } from './cron-lock.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CronLockService', () => {
    let prisma: { $queryRaw: jest.Mock; $executeRaw: jest.Mock };
    let service: CronLockService;

    beforeEach(() => {
        prisma = { $queryRaw: jest.fn(), $executeRaw: jest.fn().mockResolvedValue(1) };
        service = new CronLockService(prisma as unknown as PrismaService);
    });

    it('runs the job when it claims the lease', async () => {
        prisma.$queryRaw.mockResolvedValue([{ job_name: 'payment-reconciliation' }]);
        const fn = jest.fn().mockResolvedValue(undefined);

        await service.runExclusive('payment-reconciliation', fn);

        expect(fn).toHaveBeenCalledTimes(1);
    });

    // The claim returns no rows when another replica holds a live lease. Skipping
    // is deliberate: for a periodic job, waiting would queue this tick behind the
    // holder and then fire late, on top of the next scheduled tick.
    it('skips the job when another replica holds the lease, without throwing', async () => {
        prisma.$queryRaw.mockResolvedValue([]);
        const fn = jest.fn();

        await expect(service.runExclusive('payment-reconciliation', fn)).resolves.toBeUndefined();
        expect(fn).not.toHaveBeenCalled();
    });

    it('releases the lease even when the job throws', async () => {
        prisma.$queryRaw.mockResolvedValue([{ job_name: 'audit-cleanup' }]);
        const boom = new Error('job exploded');

        await expect(service.runExclusive('audit-cleanup', () => Promise.reject(boom))).rejects.toThrow(boom);
        expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    });

    // A database blip must cost one tick, not the scheduler. Throwing here would
    // propagate into Nest's scheduler rather than being retried next interval.
    it('skips rather than propagating when the claim itself fails', async () => {
        prisma.$queryRaw.mockRejectedValue(new Error('connection reset'));
        const fn = jest.fn();

        await expect(service.runExclusive('retention', fn)).resolves.toBeUndefined();
        expect(fn).not.toHaveBeenCalled();
    });

    // A failed release is survivable precisely because the lease expires by
    // itself — the property the advisory-lock version lacked.
    it('does not fail the job when releasing the lease fails', async () => {
        prisma.$queryRaw.mockResolvedValue([{ job_name: 'retention' }]);
        prisma.$executeRaw.mockRejectedValue(new Error('connection reset'));
        const fn = jest.fn().mockResolvedValue(undefined);

        await expect(service.runExclusive('retention', fn)).resolves.toBeUndefined();
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
