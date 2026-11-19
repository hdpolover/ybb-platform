// services/api/src/modules/audit/audit-admin-security-events.spec.ts
import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AuditAdminController } from './audit-admin.controller';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { ExcelService } from '../../shared/infrastructure/excel/excel.service';
import { AuditCleanupService } from './audit-cleanup.service';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
import { AdminScopeGuard, ADMIN_SCOPE_KEY } from '../../shared/guards/admin-scope.guard';
import { CurrentUserData } from '../../shared/decorators/current-user.decorator';

const ADMIN_USER: CurrentUserData = {
    userId: 'user-id-1',
    email: 'admin@test.com',
    brandId: 'brand-id-1',
    role: [],
    adminId: 'admin-id-1',
};

const ADMIN_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('AuditAdminController – admin-security-events', () => {
    let app: INestApplication;
    const findMany = jest.fn();
    const count = jest.fn();

    beforeAll(async () => {
        const module = await Test.createTestingModule({
            controllers: [AuditAdminController],
            providers: [
                { provide: PrismaService, useValue: { userSecurityLog: { findMany, count }, dataChangeLog: { findUnique: jest.fn() } } },
                { provide: ExcelService, useValue: {} },
                { provide: AuditCleanupService, useValue: {} },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({
                canActivate: (context: ExecutionContext) => {
                    context.switchToHttp().getRequest().user = ADMIN_USER;
                    return true;
                },
            })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(AdminScopeGuard)
            .useValue({ canActivate: () => true })
            .compile();

        app = module.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ transform: true }));
        await app.init();
    });

    afterAll(() => app.close());

    beforeEach(() => {
        findMany.mockReset().mockResolvedValue([]);
        count.mockReset().mockResolvedValue(0);
    });

    it('is covered by the controller-level guards and platform scope', () => {
        const guards = Reflect.getMetadata('__guards__', AuditAdminController) as unknown[];
        expect(guards).toEqual([JwtAuthGuard, RolesGuard, AdminScopeGuard]);
        expect(Reflect.getMetadata(ADMIN_SCOPE_KEY, AuditAdminController)).toMatchObject({ target: 'platform' });
    });

    it('only returns users that have an admins row', async () => {
        await request(app.getHttpServer()).get('/admin/audit-logs/admin-security-events').expect(200);

        expect(findMany.mock.calls[0][0].where).toEqual({ user: { admin: { isNot: null } } });
        expect(count.mock.calls[0][0].where).toEqual({ user: { admin: { isNot: null } } });
    });

    it('narrows to one admin by admins.id', async () => {
        await request(app.getHttpServer())
            .get(`/admin/audit-logs/admin-security-events?adminId=${ADMIN_UUID}`)
            .expect(200);

        expect(findMany.mock.calls[0][0].where.user).toEqual({ admin: { is: { id: ADMIN_UUID } } });
    });

    it('rejects a non-uuid adminId', async () => {
        await request(app.getHttpServer()).get('/admin/audit-logs/admin-security-events?adminId=nope').expect(400);
        expect(findMany).not.toHaveBeenCalled();
    });

    it('pages newest first and caps the page size', async () => {
        await request(app.getHttpServer())
            .get('/admin/audit-logs/admin-security-events?page=3&limit=10')
            .expect(200);

        const args = findMany.mock.calls[0][0];
        expect(args).toMatchObject({ skip: 20, take: 10 });
        expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);

        await request(app.getHttpServer()).get('/admin/audit-logs/admin-security-events?limit=101').expect(400);
    });

    it('applies the WIB day range to createdAt', async () => {
        await request(app.getHttpServer())
            .get('/admin/audit-logs/admin-security-events?dateFrom=2026-08-31&dateTo=2026-08-31')
            .expect(200);

        const { gte, lte } = findMany.mock.calls[0][0].where.createdAt;
        expect(gte.toISOString()).toBe('2026-08-30T17:00:00.000Z');
        expect(lte.toISOString()).toBe('2026-08-31T16:59:59.999Z');
    });

    it('selects only safe columns and flattens the admin', async () => {
        findMany.mockResolvedValue([
            {
                id: 'log-1',
                createdAt: new Date('2026-08-31T01:00:00.000Z'),
                eventType: 'LOGIN_SUCCESS',
                eventStatus: 'SUCCESS',
                ipAddress: '10.0.0.1',
                userAgent: 'UA',
                user: { email: 'a@b.com', admin: { id: ADMIN_UUID, fullName: 'Ada' } },
            },
        ]);
        count.mockResolvedValue(1);

        const res = await request(app.getHttpServer()).get('/admin/audit-logs/admin-security-events').expect(200);

        expect(Object.keys(findMany.mock.calls[0][0].select).sort()).toEqual(
            ['createdAt', 'eventStatus', 'eventType', 'id', 'ipAddress', 'user', 'userAgent'],
        );
        expect(res.body.data[0]).toEqual({
            id: 'log-1',
            createdAt: '2026-08-31T01:00:00.000Z',
            eventType: 'LOGIN_SUCCESS',
            eventStatus: 'SUCCESS',
            ipAddress: '10.0.0.1',
            userAgent: 'UA',
            adminId: ADMIN_UUID,
            adminName: 'Ada',
            adminEmail: 'a@b.com',
        });
        expect(res.body.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
    });

    it('is not swallowed by GET :id', async () => {
        await request(app.getHttpServer()).get('/admin/audit-logs/admin-security-events').expect(200);
        expect(findMany).toHaveBeenCalledTimes(1);
    });
});
