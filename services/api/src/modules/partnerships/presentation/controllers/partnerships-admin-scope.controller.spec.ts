// services/api/src/modules/partnerships/presentation/controllers/partnerships-admin-scope.controller.spec.ts
//
// /admin/programs/:programId/partnership-enquiries carried only @Roles, so any
// admin could read and edit any programme's enquiries (names, emails, WhatsApp
// numbers) by programme id. Now @ScopedBy('program', 'programId'), and the
// writes (PATCH/DELETE) also need the partners permission set.
import { Test } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PartnershipsAdminController } from './partnerships.admin.controller';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { UserRole } from '@core/entities/user.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { HttpExceptionFilter } from '@shared/filters/http-exception.filter';

const programs: Record<string, { id: string; brandId: string; name: string; deletedAt: null }> = {
  'prog-a': { id: 'prog-a', brandId: 'brand-a', name: 'A', deletedAt: null },
  'prog-b': { id: 'prog-b', brandId: 'brand-b', name: 'B', deletedAt: null },
};

const admins = {
  brandA: { accessLevel: 1, adminBrands: [{ brandId: 'brand-a', permissions: [] }], adminPrograms: [] },
  assignedA: { accessLevel: 1, adminBrands: [], adminPrograms: [{ programId: 'prog-a', permissions: [] }] },
  platform: { accessLevel: 800, adminBrands: [], adminPrograms: [] },
};

async function bootstrap(persona: keyof typeof admins, rolePermissions: string[] = ['partnerships:write']) {
  const prisma = {
    partnershipEnquiry: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue({ id: 'enq-1' }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'enq-1' }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const readPrisma = {
    admin: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'admin-1',
        canManageAdmins: false,
        canAssignRoles: false,
        customPermissions: null,
        role: { name: 'Role', permissions: rolePermissions },
        ...admins[persona],
      }),
    },
    program: { findUnique: jest.fn(async ({ where }: { where: { id: string } }) => programs[where.id] ?? null) },
  };
  const module = await Test.createTestingModule({
    controllers: [PartnershipsAdminController],
    providers: [
      { provide: PrismaService, useValue: prisma },
      { provide: PrismaReadService, useValue: readPrisma },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({
      canActivate: (ctx: ExecutionContext) => {
        ctx.switchToHttp().getRequest().user = { userId: 'u-1', adminId: 'admin-1', role: [UserRole.ADMIN] };
        return true;
      },
    })
    .overrideGuard(RolesGuard)
    .useValue({ canActivate: () => true })
    .compile();
  const app = module.createNestApplication();
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return { app, prisma };
}

const base = (programId: string) => `/admin/programs/${programId}/partnership-enquiries`;

describe('partnership enquiries are scoped to the admin\'s programmes', () => {
  let app: INestApplication;

  afterEach(async () => {
    if (app) await app.close();
  });

  it.each(['brandA', 'assignedA'] as const)('%s: an unassigned programme reads as missing on every route', async (persona) => {
    const built = await bootstrap(persona);
    app = built.app;
    const server = app.getHttpServer();

    await request(server).get(base('prog-b')).expect(404);
    await request(server).get(`${base('prog-b')}/enq-1`).expect(404);
    await request(server).patch(`${base('prog-b')}/enq-1`).send({ status: 'done' }).expect(404);
    await request(server).delete(`${base('prog-b')}/enq-1`).expect(404);

    expect(built.prisma.partnershipEnquiry.findMany).not.toHaveBeenCalled();
    expect(built.prisma.partnershipEnquiry.findFirst).not.toHaveBeenCalled();
    expect(built.prisma.partnershipEnquiry.update).not.toHaveBeenCalled();
    expect(built.prisma.partnershipEnquiry.updateMany).not.toHaveBeenCalled();
  });

  // brand rows grant nothing (owner policy 2026-11-19)
  it('brandA: a brand-row-only admin is refused even its own brand\'s programme, nothing touched', async () => {
    const built = await bootstrap('brandA');
    app = built.app;
    const server = app.getHttpServer();

    await request(server).get(base('prog-a')).expect(404);
    await request(server).get(`${base('prog-a')}/enq-1`).expect(404);
    await request(server).patch(`${base('prog-a')}/enq-1`).send({ status: 'done' }).expect(404);
    await request(server).delete(`${base('prog-a')}/enq-1`).expect(404);

    expect(built.prisma.partnershipEnquiry.findMany).not.toHaveBeenCalled();
    expect(built.prisma.partnershipEnquiry.update).not.toHaveBeenCalled();
    expect(built.prisma.partnershipEnquiry.updateMany).not.toHaveBeenCalled();
  });

  it.each(['assignedA', 'platform'] as const)('%s: its own programme passes', async (persona) => {
    const built = await bootstrap(persona);
    app = built.app;
    const server = app.getHttpServer();

    await request(server).get(base('prog-a')).expect(200);
    await request(server).get(`${base('prog-a')}/enq-1`).expect(200);
    await request(server).patch(`${base('prog-a')}/enq-1`).send({ status: 'done' }).expect(200);
    await request(server).delete(`${base('prog-a')}/enq-1`).expect(200);

    expect(built.prisma.partnershipEnquiry.update).toHaveBeenCalled();
    expect(built.prisma.partnershipEnquiry.updateMany).toHaveBeenCalled();
  });

  it.each(['assignedA'] as const)('%s: without a partners write permission reads pass but writes 403, nothing written', async (persona) => {
    const built = await bootstrap(persona, ['partnerships:read', 'applications:write']);
    app = built.app;
    const server = app.getHttpServer();

    await request(server).get(base('prog-a')).expect(200);
    await request(server).get(`${base('prog-a')}/enq-1`).expect(200);
    await request(server).patch(`${base('prog-a')}/enq-1`).send({ status: 'done' }).expect(403);
    await request(server).delete(`${base('prog-a')}/enq-1`).expect(403);

    expect(built.prisma.partnershipEnquiry.update).not.toHaveBeenCalled();
    expect(built.prisma.partnershipEnquiry.updateMany).not.toHaveBeenCalled();
  });

  it.each(['partnerships:write', 'content:write', 'program:write'])('assignedA with %s can write', async (permission) => {
    const built = await bootstrap('assignedA', [permission]);
    app = built.app;
    const server = app.getHttpServer();

    await request(server).patch(`${base('prog-a')}/enq-1`).send({ status: 'done' }).expect(200);
    await request(server).delete(`${base('prog-a')}/enq-1`).expect(200);
  });

  it('platform admin writes without any partners permission', async () => {
    const built = await bootstrap('platform', []);
    app = built.app;
    const server = app.getHttpServer();

    await request(server).patch(`${base('prog-b')}/enq-1`).send({ status: 'done' }).expect(200);
    await request(server).delete(`${base('prog-b')}/enq-1`).expect(200);
  });

  it('platform admin reaches any brand\'s programme', async () => {
    const built = await bootstrap('platform');
    app = built.app;
    await request(app.getHttpServer()).get(base('prog-b')).expect(200);
    expect(built.prisma.partnershipEnquiry.findMany).toHaveBeenCalled();
  });
});
