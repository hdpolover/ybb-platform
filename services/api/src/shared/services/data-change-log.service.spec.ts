
import { Test, TestingModule } from '@nestjs/testing';
import { DataChangeLogService } from './data-change-log.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { ChangeType, RiskLevel } from '@prisma/client';

describe('DataChangeLogService', () => {
    let service: DataChangeLogService;

    const mockPrismaService = {
        dataChangeLog: {
            create: jest.fn().mockResolvedValue({ id: 'log-id' }),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DataChangeLogService,
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        service = module.get<DataChangeLogService>(DataChangeLogService);
    });

    it('should compute changed fields correctly', () => {
        const before = { name: 'Old', status: 'ACTIVE', metadata: { a: 1 } };
        const after = { name: 'New', status: 'ACTIVE', metadata: { a: 2 } };

        const diff = service.computeChangedFields(before, after);

        expect(diff).toContain('name');
        expect(diff).toContain('metadata');
        expect(diff).not.toContain('status');
        expect(diff.length).toBe(2);
    });

    it('should classify risk correctly', () => {
        expect(service.classifyRisk('User', ChangeType.delete)).toBe(RiskLevel.critical);
        expect(service.classifyRisk('ParticipantApplication', ChangeType.status_change)).toBe(RiskLevel.high);
        expect(service.classifyRisk('Program', ChangeType.update)).toBe(RiskLevel.medium);
        expect(service.classifyRisk('SomethingElse', ChangeType.create)).toBe(RiskLevel.low);
    });

    it('should log with diff and compute states correctly', async () => {
        const before = { id: '1', name: 'Old' };
        const after = { id: '1', name: 'New' };

        await service.logWithDiff({
            entityType: 'User',
            entityId: '1',
            action: ChangeType.update,
            beforeState: before,
            afterState: after,
            actorId: 'admin-1',
            actorType: 'admin',
        });

        expect(mockPrismaService.dataChangeLog.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                entityType: 'User',
                action: ChangeType.update,
                changedFields: ['name'],
                riskLevel: RiskLevel.medium, // User + Update = Medium by default in our logic
            }),
        }));
    });

    it('should sanitize and redact large audit payloads', async () => {
        const hugeString = 'x'.repeat(30_000);

        await service.log({
            entityType: 'User',
            action: ChangeType.update,
            beforeState: {
                password: 'secret-value',
                nested: { apiKey: 'token-value' },
                list: Array.from({ length: 30 }, (_, i) => i),
                hugeString,
            },
            afterState: {
                token: 'super-secret-token',
                changed: true,
            },
        });

        const call = mockPrismaService.dataChangeLog.create.mock.calls.at(-1)?.[0];
        expect(call).toBeDefined();
        const beforeState = call.data.beforeState as Record<string, unknown>;
        const afterState = call.data.afterState as Record<string, unknown>;
        expect(beforeState.password).toBe('[Redacted]');
        expect((beforeState.nested as Record<string, unknown>).apiKey).toBe('[Redacted]');
        expect(afterState.token).toBe('[Redacted]');
    });

    it('should serialize Date values as ISO strings instead of empty objects', async () => {
        const now = new Date('2024-01-15T10:30:00.000Z');

        await service.log({
            entityType: 'ParticipantApplication',
            action: ChangeType.update,
            beforeState: { id: '1', updatedAt: now },
            afterState: { id: '1', updatedAt: new Date('2024-01-16T10:30:00.000Z') },
        });

        const call = mockPrismaService.dataChangeLog.create.mock.calls.at(-1)?.[0];
        expect(call).toBeDefined();
        const beforeState = call.data.beforeState as Record<string, unknown>;
        expect(beforeState.updatedAt).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should serialize objects with toJSON (e.g. Prisma.Decimal) to their scalar form', async () => {
        // Simulate a Prisma.Decimal-like object that has a toJSON method
        const decimalLike = { toJSON: () => '99.50', toString: () => '99.50' };

        await service.log({
            entityType: 'ApplicationInvoice',
            action: ChangeType.update,
            beforeState: { id: '1', amount: decimalLike as unknown as Record<string, unknown> },
            afterState: { id: '1', amount: decimalLike as unknown as Record<string, unknown> },
        });

        const call = mockPrismaService.dataChangeLog.create.mock.calls.at(-1)?.[0];
        expect(call).toBeDefined();
        const beforeState = call.data.beforeState as Record<string, unknown>;
        expect(beforeState.amount).toBe('99.50');
    });
});
