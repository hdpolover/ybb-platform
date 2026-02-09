
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { QueueMonitoringService } from '../src/shared/infrastructure/monitoring/queue-monitoring.service';

describe('Admins Controller (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let adminToken: string;
    let adminId: string;

    beforeAll(async () => {
        try {
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
            process.stdout.write('[DEBUG] App Initialized\n');

            // Setup: Create Super Admin and get token
            const uniqueId = Date.now().toString();
            const testEmail = `super-admin-e2e-${uniqueId}@test.com`;

            // Manual Cleanup
            // Manual Cleanup - HARD DELETE needed because of Soft Delete extension
            console.log('[DEBUG] Cleaning up test users...');
            try {
                // Delete Admins linked to test users
                await prisma.$executeRaw`DELETE FROM "admins" WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "email" LIKE '%e2e@test.com%')`;
                // Delete UserIdentities linked to test users
                await prisma.$executeRaw`DELETE FROM "user_identities" WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "email" LIKE '%e2e@test.com%')`;
                // Delete Users
                await prisma.$executeRaw`DELETE FROM "users" WHERE "email" LIKE '%e2e@test.com%'`;
                process.stdout.write('[DEBUG] Database Cleaned (Hard Delete)\n');
            } catch (e) {
                process.stdout.write(`[DEBUG] Cleanup failed: ${e.message}\n`);
            }
            process.stdout.write('[DEBUG] Database Cleaned\n');

            const password = 'passWORD123!';
            const brand = await prisma.brand.findFirst();
            if (!brand) throw new Error('No brand found');

            // Create Super Admin User
            const user = await prisma.user.create({
                data: {
                    email: testEmail,
                    passwordHash: await bcrypt.hash(password, 10),
                    brandId: brand.id,
                    isActive: true,
                    emailVerified: true
                }
            });
            process.stdout.write(`[DEBUG] User Created: ${user.id}\n`);

            // Create Admin Profile
            const admin = await prisma.admin.create({
                data: {
                    userId: user.id,
                    fullName: 'Super Admin E2E',
                }
            });
            adminId = admin.id;
            process.stdout.write(`[DEBUG] Admin Created: ${admin.id}\n`);

            // Generate token manually to avoid login endpoint issues and ensure validity
            const jwtService = app.get(JwtService);
            const payload = {
                sub: user.id,
                email: user.email,
                brandId: brand.id,
                roles: [],
                adminId: adminId,
            };
            adminToken = jwtService.sign(payload);
            process.stdout.write(`[DEBUG] beforeAll SUCCESS\n`);
        } catch (error) {
            process.stdout.write(`[DEBUG] beforeAll FAILED: ${error}\n`);
            throw error;
        }
    });

    afterAll(async () => {
        // Cleanup
        await prisma.admin.deleteMany({ where: { user: { email: { contains: 'e2e@test.com' } } } });
        await prisma.user.deleteMany({ where: { email: { contains: 'e2e@test.com' } } });
        await app.close();
    });

    describe('CRUD Operations', () => {
        let createdAdminId: string;
        const newAdminEmail = 'new-admin-e2e@test.com';

        it('/admins (POST) - Create new admin', async () => {
            const res = await request(app.getHttpServer())
                .post('/admins')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    email: newAdminEmail,
                    fullName: 'New Admin E2E',
                    password: 'passWORD123!'
                })
                .expect(201);

            // Verify creation
            const createdOps = await prisma.admin.findFirst({
                where: { user: { email: newAdminEmail } }
            });
            expect(createdOps).toBeDefined();
            createdAdminId = createdOps!.id;
        });

        it('/admins (GET) - List admins', async () => {
            const res = await request(app.getHttpServer())
                .get('/admins')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(res.body.data).toBeInstanceOf(Array);
            expect(res.body.data.length).toBeGreaterThan(0);
            const found = res.body.data.find((a: any) => a.email === newAdminEmail);
            expect(found).toBeDefined();
        });

        it('/admins/:id (GET) - Get admin details', async () => {
            const res = await request(app.getHttpServer())
                .get(`/admins/${createdAdminId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(res.body.email).toBe(newAdminEmail);
            expect(res.body.fullName).toBe('New Admin E2E');
        });

        it('/admins/:id (PATCH) - Update admin', async () => {
            await request(app.getHttpServer())
                .patch(`/admins/${createdAdminId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ fullName: 'Updated Admin E2E' })
                .expect(200);

            const updated = await prisma.admin.findUnique({ where: { id: createdAdminId } });
            expect(updated!.fullName).toBe('Updated Admin E2E');
        });

        it('/admins/:id (DELETE) - Delete admin', async () => {
            await request(app.getHttpServer())
                .delete(`/admins/${createdAdminId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            const deleted = await prisma.admin.findFirst({
                where: {
                    id: createdAdminId,
                    deletedAt: { not: null }
                }
            });
            expect(deleted).toBeDefined();
            expect(deleted!.deletedAt).not.toBeNull(); // Redundant but explicit verification
        });
    });
});
