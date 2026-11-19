
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuditCleanupService } from './audit-cleanup.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { CronLockService } from '../../shared/infrastructure/database/cron-lock.service';

describe('AuditCleanupService', () => {
    let service: AuditCleanupService;
    let prisma: PrismaService;

    const mockPrismaService = {
        dataChangeLog: {
            deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
        },
    };
    let adminDays: unknown;
    const mockConfigService = {
        get: jest.fn((_key: string, fallback: unknown) => adminDays ?? fallback),
    };
    const mockCronLock = {
        runExclusive: jest.fn((_jobName: string, fn: () => Promise<void>) => fn()),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuditCleanupService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: CronLockService, useValue: mockCronLock },
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();

        service = module.get<AuditCleanupService>(AuditCleanupService);
        prisma = module.get<PrismaService>(PrismaService);
        jest.clearAllMocks();
        adminDays = undefined;
        mockPrismaService.dataChangeLog.deleteMany.mockResolvedValue({ count: 5 });
    });

    const daysBetween = (cutoff: Date) => Math.round((Date.now() - cutoff.getTime()) / 86_400_000);

    it('deletes non-admin logs after 30 days and admin logs after 365 days, in two calls', async () => {
        const result = await service.cleanup();

        expect(result.deleted).toBe(10);
        const calls = mockPrismaService.dataChangeLog.deleteMany.mock.calls.map((c) => c[0]);
        expect(calls).toHaveLength(2);
        const [other, admin] = calls;
        // participant/system/webhook rows 40 days old are past the 30-day cutoff -> deleted
        expect(other.where.actorType).toEqual({ not: 'admin' });
        expect(daysBetween(other.where.createdAt.lt)).toBe(30);
        expect(other.where.createdAt.lt.getTime()).toBeGreaterThan(Date.now() - 40 * 86_400_000);
        // admin rows 40 days old are NOT past the 365-day cutoff -> survive; 366 days old -> deleted
        expect(admin.where.actorType).toBe('admin');
        expect(daysBetween(admin.where.createdAt.lt)).toBe(365);
        expect(admin.where.createdAt.lt.getTime()).toBeLessThan(Date.now() - 40 * 86_400_000);
        expect(admin.where.createdAt.lt.getTime()).toBeGreaterThan(Date.now() - 366 * 86_400_000);
    });

    it('honours RETENTION_ADMIN_AUDIT_DAYS (env strings included)', async () => {
        adminDays = '90';
        await service.cleanup();

        const admin = mockPrismaService.dataChangeLog.deleteMany.mock.calls[1][0];
        expect(daysBetween(admin.where.createdAt.lt)).toBe(90);
    });

    it.each(['abc', '0', '-5'])('falls back to 365 days for an invalid RETENTION_ADMIN_AUDIT_DAYS (%s)', async (bad) => {
        adminDays = bad;
        await service.cleanup();

        const admin = mockPrismaService.dataChangeLog.deleteMany.mock.calls[1][0];
        expect(daysBetween(admin.where.createdAt.lt)).toBe(365);
    });

    it('returns { deleted: 0 } without deleting anything when the lock is not acquired', async () => {
        mockCronLock.runExclusive.mockImplementationOnce(async () => undefined); // simulate lock lost

        const result = await service.cleanup();

        expect(result).toEqual({ deleted: 0 });
        expect(mockPrismaService.dataChangeLog.deleteMany).not.toHaveBeenCalled();
    });
});
