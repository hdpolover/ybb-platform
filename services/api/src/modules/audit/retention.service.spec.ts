import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RetentionService } from './retention.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

function makeDelegate() {
    return {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    };
}

describe('RetentionService', () => {
    let service: RetentionService;
    let mockPrismaService: {
        userSession: ReturnType<typeof makeDelegate>;
        userSecurityLog: ReturnType<typeof makeDelegate>;
        userActivityLog: ReturnType<typeof makeDelegate>;
        submissionReminderLog: ReturnType<typeof makeDelegate>;
    };
    let mockConfigService: { get: jest.Mock };

    beforeEach(async () => {
        mockPrismaService = {
            userSession: makeDelegate(),
            userSecurityLog: makeDelegate(),
            userActivityLog: makeDelegate(),
            submissionReminderLog: makeDelegate(),
        };
        mockConfigService = {
            get: jest.fn((_key: string, defaultValue: number) => defaultValue),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RetentionService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();

        service = module.get<RetentionService>(RetentionService);
    });

    it('deletes expired sessions by expiresAt, not by a fixed age', async () => {
        await service.runScheduledCleanup();

        const where = mockPrismaService.userSession.findMany.mock.calls[0][0].where;
        expect(where.expiresAt.lt).toBeInstanceOf(Date);
        expect(where.expiresAt.lt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('prunes security and activity logs using RETENTION_ACTIVITY_LOG_DAYS (default 180)', async () => {
        await service.runScheduledCleanup();

        for (const model of ['userSecurityLog', 'userActivityLog'] as const) {
            const where = mockPrismaService[model].findMany.mock.calls[0][0].where;
            const diffDays = Math.round((Date.now() - where.createdAt.lt.getTime()) / 86_400_000);
            expect(diffDays).toBe(180);
        }
        expect(mockConfigService.get).toHaveBeenCalledWith('RETENTION_ACTIVITY_LOG_DAYS', 180);
    });

    it('prunes submission reminder logs by sentAt using RETENTION_REMINDER_LOG_DAYS (default 180)', async () => {
        await service.runScheduledCleanup();

        const where = mockPrismaService.submissionReminderLog.findMany.mock.calls[0][0].where;
        const diffDays = Math.round((Date.now() - where.sentAt.lt.getTime()) / 86_400_000);
        expect(diffDays).toBe(180);
        expect(mockConfigService.get).toHaveBeenCalledWith('RETENTION_REMINDER_LOG_DAYS', 180);
    });

    it('deletes matched rows by id in batches of 5000', async () => {
        const rows = Array.from({ length: 5000 }, (_, i) => ({ id: `s-${i}` }));
        mockPrismaService.userSession.findMany
            .mockResolvedValueOnce(rows)
            .mockResolvedValueOnce([{ id: 's-last' }])
            .mockResolvedValueOnce([]);
        mockPrismaService.userSession.deleteMany.mockResolvedValue({ count: 5000 });

        await service.runScheduledCleanup();

        expect(mockPrismaService.userSession.findMany).toHaveBeenCalledTimes(2);
        expect(mockPrismaService.userSession.deleteMany).toHaveBeenCalledWith({
            where: { id: { in: rows.map((r) => r.id) } },
        });
    });

    it('stops after a bounded number of batches per table even if rows remain', async () => {
        jest.useFakeTimers();
        const fullBatch = Array.from({ length: 5000 }, (_, i) => ({ id: `s-${i}` }));
        mockPrismaService.userSession.findMany.mockResolvedValue(fullBatch);
        mockPrismaService.userSession.deleteMany.mockResolvedValue({ count: 5000 });

        const run = service.runScheduledCleanup();
        await jest.runAllTimersAsync();
        await run;

        // Bounded (MAX_BATCHES_PER_TABLE = 20): a run that never runs dry
        // still stops, so one run can't hold the DB for long.
        expect(mockPrismaService.userSession.findMany).toHaveBeenCalledTimes(20);

        jest.useRealTimers();
    });

    it('does not touch data_change_logs — AuditCleanupService already owns that table', async () => {
        await service.runScheduledCleanup();

        expect((mockPrismaService as Record<string, unknown>).dataChangeLog).toBeUndefined();
    });
});
