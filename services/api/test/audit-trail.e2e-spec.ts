
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { QueueMonitoringService } from '../src/shared/infrastructure/monitoring/queue-monitoring.service';
import { ChangeType } from '@prisma/client';

describe('Audit Trail (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let adminToken: string;
    let adminId: string;
    let userId: string;

    beforeAll(async () => {
        jest.setTimeout(60000);

        // Override environment variables for host-to-container access
        process.env.DATABASE_URL = 'postgresql://ybb_user:ybb_password@localhost:5438/ybb_platform_db';
        process.env.REDIS_URL = 'redis://:redis_password@localhost:6380';
        process.env.REDIS_HOST = 'localhost';
        process.env.REDIS_PORT = '6380';

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(QueueMonitoringService)
            .useValue({
                onModuleInit: () => { },
                onModuleDestroy: () => { },
            })
            .compile();

        app = moduleFixture.createNestApplication();
        await app.init();

        prisma = app.get(PrismaService);

        // Setup: Create Admin and get token
        const uniqueId = Date.now().toString();
        const testEmail = `audit-e2e-${uniqueId}@test.com`;

        const brand = await prisma.brand.findFirst();
        if (!brand) throw new Error('No brand found');

        const user = await prisma.user.create({
            data: {
                email: testEmail,
                passwordHash: await bcrypt.hash('pass123', 10),
                brandId: brand.id,
                isActive: true,
                emailVerified: true
            }
        });
        userId = user.id;

        const admin = await prisma.admin.create({
            data: {
                userId: user.id,
                fullName: 'Audit Admin E2E',
            }
        });
        adminId = admin.id;

        const jwtService = app.get(JwtService);
        adminToken = jwtService.sign({
            sub: user.id,
            email: user.email,
            brandId: brand.id,
            roles: [],
            adminId: adminId,
        });
    });

    afterAll(async () => {
        // Cleanup - use raw delete to bypass soft delete if any
        await prisma.$executeRaw`DELETE FROM "admins" WHERE "id" = ${adminId}`;
        await prisma.$executeRaw`DELETE FROM "users" WHERE "id" = ${userId}`;
        await prisma.$executeRaw`DELETE FROM "data_change_logs" WHERE "actor_id" = ${adminId}`;
        await app.close();
    });

    it('should create an audit log entry when an instrumented endpoint is called', async () => {
        // Using Patch Admin endpoint as it is instrumented with @AuditTrail
        const updateRes = await request(app.getHttpServer())
            .patch(`/admins/${adminId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ fullName: 'Updated Audit Admin E2E' })
            .expect(200);

        // Wait a bit for the async fire-and-forget log write
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify log entry exists
        const log = await prisma.dataChangeLog.findFirst({
            where: {
                entityType: 'Admin',
                entityId: adminId,
                action: ChangeType.update,
            }
        });

        expect(log).toBeDefined();
        expect(log!.actorId).toBe(adminId);
        expect(log!.changedFields).toContain('fullName');
        expect(log!.beforeState).toBeDefined();
        expect(log!.afterState).toBeDefined();
    });

    it('should allow admin to query audit logs', async () => {
        const res = await request(app.getHttpServer())
            .get('/admin/audit-logs')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(res.body.data).toBeInstanceOf(Array);
        expect(res.body.data.length).toBeGreaterThan(0);
        expect(res.body.meta.total).toBeGreaterThan(0);
    });

    it('should allow admin to get entity history', async () => {
        const res = await request(app.getHttpServer())
            .get(`/admin/audit-logs/entity/Admin/${adminId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(res.body.data).toBeInstanceOf(Array);
        expect(res.body.data.some((l: any) => l.entityId === adminId)).toBe(true);
    });

    it('should allow admin to get audit log detail', async () => {
        const logs = await prisma.dataChangeLog.findMany({
            where: { actorId: adminId },
            take: 1
        });
        const logId = logs[0].id;

        const res = await request(app.getHttpServer())
            .get(`/admin/audit-logs/${logId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(res.body.id).toBe(logId);
        expect(res.body.actorId).toBe(adminId);
    });
});
