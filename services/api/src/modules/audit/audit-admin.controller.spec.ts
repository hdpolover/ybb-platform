import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { AuditAdminController } from './audit-admin.controller';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { ExcelService } from '../../shared/infrastructure/excel/excel.service';
import { AuditCleanupService } from './audit-cleanup.service';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
import { CurrentUserData } from '../../shared/decorators/current-user.decorator';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

const ADMIN_USER: CurrentUserData = {
    userId: 'user-id-1',
    email: 'admin@test.com',
    brandId: 'brand-id-1',
    role: [],
    adminId: 'admin-id-1',
};

const SAMPLE_LOG = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    createdAt: new Date('2024-01-15T10:00:00.000Z'),
    action: 'update',
    entityType: 'Admin',
    entityId: 'entity-id-1',
    event: 'admin.updated',
    actorType: 'admin',
    actorId: 'admin-id-1',
    riskLevel: 'low',
    source: 'http',
    endpoint: '/admins/1',
    status: 'success',
    changedFields: ['fullName'],
    reason: null,
    beforeState: null,
    afterState: null,
    ipAddress: '127.0.0.1',
};

describe('AuditAdminController – cursor pagination', () => {
    let controller: AuditAdminController;
    let mockPrisma: {
        dataChangeLog: {
            findMany: jest.Mock;
            count: jest.Mock;
        };
    };

    beforeEach(async () => {
        mockPrisma = {
            dataChangeLog: {
                findMany: jest.fn().mockResolvedValue([]),
                count: jest.fn().mockResolvedValue(0),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuditAdminController],
            providers: [
                { provide: PrismaService, useValue: mockPrisma },
                { provide: ExcelService, useValue: {} },
                { provide: AuditCleanupService, useValue: {} },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<AuditAdminController>(AuditAdminController);
        jest.clearAllMocks();
    });

    describe('list() – offset mode (no cursor param)', () => {
        it('should return offset-mode response with no nextCursor when cursor is not provided', async () => {
            mockPrisma.dataChangeLog.findMany.mockResolvedValue([SAMPLE_LOG]);
            mockPrisma.dataChangeLog.count.mockResolvedValue(1);

            const result = await controller.list({} as Partial<ListAuditLogsDto>, ADMIN_USER);

            expect(result.meta.mode).toBe('offset');
            expect(result.meta.nextCursor).toBeNull();
        });
    });

    describe('list() – cursor bootstrap (empty cursor param)', () => {
        it('should enter cursor mode and return nextCursor when cursor is empty string', async () => {
            // First page: limit + 1 items returned → hasMore = true
            mockPrisma.dataChangeLog.findMany.mockResolvedValue([
                SAMPLE_LOG,
                { ...SAMPLE_LOG, id: '550e8400-e29b-41d4-a716-446655440001' },
            ]);
            mockPrisma.dataChangeLog.count.mockResolvedValue(5);

            const result = await controller.list({ cursor: '', limit: 1 } as Partial<ListAuditLogsDto>, ADMIN_USER);

            expect(result.meta.mode).toBe('cursor');
            expect(typeof result.meta.nextCursor).toBe('string');
            expect(result.meta.nextCursor).not.toBeNull();
            // Window should be capped at limit (1)
            expect(result.data).toHaveLength(1);
        });

        it('should enter cursor mode with no results and return null nextCursor on empty first page', async () => {
            mockPrisma.dataChangeLog.findMany.mockResolvedValue([]);
            mockPrisma.dataChangeLog.count.mockResolvedValue(0);

            const result = await controller.list({ cursor: '' } as Partial<ListAuditLogsDto>, ADMIN_USER);

            expect(result.meta.mode).toBe('cursor');
            expect(result.meta.nextCursor).toBeNull();
            expect(result.data).toHaveLength(0);
        });
    });

    describe('list() – cursor continuation (valid token)', () => {
        it('should decode a valid cursor token and apply seek filter', async () => {
            const token = Buffer.from(
                JSON.stringify({
                    id: SAMPLE_LOG.id,
                    createdAt: SAMPLE_LOG.createdAt.toISOString(),
                }),
                'utf8',
            ).toString('base64url');

            mockPrisma.dataChangeLog.findMany.mockResolvedValue([SAMPLE_LOG]);
            mockPrisma.dataChangeLog.count.mockResolvedValue(1);

            const result = await controller.list({ cursor: token } as Partial<ListAuditLogsDto>, ADMIN_USER);

            expect(result.meta.mode).toBe('cursor');
            // The where clause passed to findMany should include seek conditions
            const findManyCall = mockPrisma.dataChangeLog.findMany.mock.calls[0][0];
            expect(findManyCall.where).toHaveProperty('AND');
        });
    });

    describe('list() – invalid cursor token', () => {
        it('should throw 400 for a non-base64url cursor token', async () => {
            await expect(
                controller.list({ cursor: 'not-valid-base64!' } as Partial<ListAuditLogsDto>, ADMIN_USER),
            ).rejects.toBeInstanceOf(HttpException);

            await expect(
                controller.list({ cursor: 'not-valid-base64!' } as Partial<ListAuditLogsDto>, ADMIN_USER),
            ).rejects.toMatchObject({ status: 400 });
        });

        it('should throw 400 for a base64 token with missing fields', async () => {
            const badToken = Buffer.from(JSON.stringify({ only: 'id' }), 'utf8').toString('base64url');

            await expect(
                controller.list({ cursor: badToken } as Partial<ListAuditLogsDto>, ADMIN_USER),
            ).rejects.toMatchObject({ status: 400 });
        });

        it('should throw 400 for a token with a non-UUID id', async () => {
            const badToken = Buffer.from(
                JSON.stringify({ id: 'not-a-uuid', createdAt: new Date().toISOString() }),
                'utf8',
            ).toString('base64url');

            await expect(
                controller.list({ cursor: badToken } as Partial<ListAuditLogsDto>, ADMIN_USER),
            ).rejects.toMatchObject({ status: 400 });
        });

        it('should throw 400 for a token with an invalid createdAt', async () => {
            const badToken = Buffer.from(
                JSON.stringify({ id: SAMPLE_LOG.id, createdAt: 'not-a-date' }),
                'utf8',
            ).toString('base64url');

            await expect(
                controller.list({ cursor: badToken } as Partial<ListAuditLogsDto>, ADMIN_USER),
            ).rejects.toMatchObject({ status: 400 });
        });
    });

    describe('entityHistory() – cursor bootstrap and invalid token', () => {
        it('should enter cursor mode when cursor is empty string', async () => {
            mockPrisma.dataChangeLog.findMany.mockResolvedValue([SAMPLE_LOG]);
            mockPrisma.dataChangeLog.count.mockResolvedValue(1);

            const result = await controller.entityHistory(
                'Admin', 'entity-id-1', 1, 50, '', ADMIN_USER,
            );

            expect(result.meta.mode).toBe('cursor');
        });

        it('should use offset mode when cursor is absent', async () => {
            mockPrisma.dataChangeLog.findMany.mockResolvedValue([SAMPLE_LOG]);
            mockPrisma.dataChangeLog.count.mockResolvedValue(1);

            const result = await controller.entityHistory(
                'Admin', 'entity-id-1', 1, 50, undefined, ADMIN_USER,
            );

            expect(result.meta.mode).toBe('offset');
        });

        it('should throw 400 for a cursor token with a non-UUID id', async () => {
            const badToken = Buffer.from(
                JSON.stringify({ id: 'not-a-uuid', createdAt: new Date().toISOString() }),
                'utf8',
            ).toString('base64url');

            await expect(
                controller.entityHistory('Admin', 'entity-id-1', 1, 50, badToken, ADMIN_USER),
            ).rejects.toMatchObject({ status: 400 });
        });
    });
});
