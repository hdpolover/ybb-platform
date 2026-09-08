
import { Test, TestingModule } from '@nestjs/testing';
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
    const mockCronLock = {
        runExclusive: jest.fn((_jobName: string, fn: () => Promise<void>) => fn()),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuditCleanupService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: CronLockService, useValue: mockCronLock },
            ],
        }).compile();

        service = module.get<AuditCleanupService>(AuditCleanupService);
        prisma = module.get<PrismaService>(PrismaService);
        jest.clearAllMocks();
    });

    it('should delete logs older than 30 days', async () => {
        const result = await service.cleanup();

        expect(result.deleted).toBe(5);
        expect(mockPrismaService.dataChangeLog.deleteMany).toHaveBeenCalledWith({
            where: {
                createdAt: {
                    lt: expect.any(Date),
                },
            },
        });

        // Verify the date is roughly 30 days ago
        const callArgs = mockPrismaService.dataChangeLog.deleteMany.mock.calls[0][0];
        const cutoffDate = callArgs.where.createdAt.lt;
        const now = new Date();
        const diffDays = Math.round((now.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24));
        expect(diffDays).toBe(30);
    });

    it('returns { deleted: 0 } without deleting anything when the lock is not acquired', async () => {
        mockCronLock.runExclusive.mockImplementationOnce(async () => undefined); // simulate lock lost

        const result = await service.cleanup();

        expect(result).toEqual({ deleted: 0 });
        expect(mockPrismaService.dataChangeLog.deleteMany).not.toHaveBeenCalled();
    });
});
