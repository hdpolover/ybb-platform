
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module'; // Adjust path
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service'; // Adjust path
import * as bcrypt from 'bcrypt';

describe('Admin Auth Controller (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    beforeAll(async () => {
        try {
            const moduleFixture: TestingModule = await Test.createTestingModule({
                imports: [AppModule],
            }).compile();

            app = moduleFixture.createNestApplication();
            await app.init();

            prisma = app.get<PrismaService>(PrismaService);

            // Cleanup before tests to remove stale data
            try {
                await prisma.$executeRaw`DELETE FROM "admins" WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "email" LIKE '%e2e-%@test.com%')`;
                await prisma.$executeRaw`DELETE FROM "user_identities" WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "email" LIKE '%e2e-%@test.com%')`;
                await prisma.$executeRaw`DELETE FROM "users" WHERE "email" LIKE '%e2e-%@test.com%'`;
            } catch (e) {
                console.error('Cleanup failed:', e);
            }
        } catch (error) {
            console.error('Error in beforeAll:', error);
            throw error;
        }
    });

    afterAll(async () => {
        // Cleanup
        if (prisma) {
            try {
                await prisma.$executeRaw`DELETE FROM "admins" WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "email" LIKE '%e2e-%@test.com%')`;
                await prisma.$executeRaw`DELETE FROM "user_identities" WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "email" LIKE '%e2e-%@test.com%')`;
                await prisma.$executeRaw`DELETE FROM "users" WHERE "email" LIKE '%e2e-%@test.com%'`;
            } catch (e) {
                console.error('Cleanup failed:', e);
            }
        }
        if (app) await app.close();
    });

    it('/auth/admin/login (POST) - should return tokens for valid admin', async () => {
        const email = 'e2e-admin-auth@test.com';
        const password = 'passWORD123!';
        const hash = await bcrypt.hash(password, 10);

        // Create Brand (mock or use default)
        const brand = await prisma.brand.findFirst();
        if (!brand) throw new Error('No brand found');

        // Create User & Admin
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash: hash,
                brandId: brand.id,
                isActive: true,
                emailVerified: true
            }
        });

        await prisma.admin.create({
            data: {
                userId: user.id,
                fullName: 'E2E Admin',
            }
        });

        const response = await request(app.getHttpServer())
            .post('/auth/admin/login')
            .send({ email, password })
            .expect(201); // NestJS default for POST is 201

        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).toHaveProperty('admin');
        expect(response.body.admin).toHaveProperty('id');
    });

    it('/auth/admin/login (POST) - should fail for non-admin user', async () => {
        // Create user without admin record
        const email = 'e2e-user-not-admin@test.com';
        const password = 'passWORD123!';
        const hash = await bcrypt.hash(password, 10);
        const brand = await prisma.brand.findFirst();
        if (!brand) throw new Error('No brand found');

        await prisma.user.create({
            data: {
                email,
                passwordHash: hash,
                brandId: brand.id,
                isActive: true,
                emailVerified: true
            }
        });

        await request(app.getHttpServer())
            .post('/auth/admin/login')
            .send({ email, password })
            .expect(401);

        // Cleanup
        await prisma.user.deleteMany({ where: { email } });
    });
});
