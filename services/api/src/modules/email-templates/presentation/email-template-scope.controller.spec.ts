// services/api/src/modules/email-templates/presentation/email-template-scope.controller.spec.ts
//
// /admin/email-templates carried only @Roles(ADMIN, SUPER_ADMIN), so a
// brand-scoped admin could list, read, rewrite or delete any brand's (or the
// global fallback) templates by id. Driven through the HTTP stack so the check
// is proven to run before the service is reached.
import { Test } from '@nestjs/testing';
import { ExecutionContext, INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { EmailTemplateController } from './email-template.controller';
import { EmailTemplateService } from '../application/services/email-template.service';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { UserRole } from '@core/entities/user.entity';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { HttpExceptionFilter } from '@shared/filters/http-exception.filter';

const BRAND_A = '0a000000-0000-4000-8000-00000000000a';
const BRAND_B = '0b000000-0000-4000-8000-00000000000b';
const PROG_A = '1a000000-0000-4000-8000-00000000000a';
const PROG_B = '1b000000-0000-4000-8000-00000000000b';
const TPL_A = '2a000000-0000-4000-8000-00000000000a';
const TPL_B = '2b000000-0000-4000-8000-00000000000b';
const TPL_GLOBAL = '2c000000-0000-4000-8000-00000000000c';

const templates: Record<string, { id: string; brandId: string | null; programId: string | null }> = {
  [TPL_A]: { id: TPL_A, brandId: BRAND_A, programId: PROG_A },
  [TPL_B]: { id: TPL_B, brandId: BRAND_B, programId: null },
  [TPL_GLOBAL]: { id: TPL_GLOBAL, brandId: null, programId: null },
};

const programs: Record<string, { id: string; brandId: string; name: string; deletedAt: null }> = {
  [PROG_A]: { id: PROG_A, brandId: BRAND_A, name: 'A', deletedAt: null },
  [PROG_B]: { id: PROG_B, brandId: BRAND_B, name: 'B', deletedAt: null },
};

const admins = {
  // News Writer shape: brand_scope over brand A only.
  brandA: { accessLevel: 1, adminBrands: [{ brandId: BRAND_A, permissions: [] }], adminPrograms: [] },
  platform: { accessLevel: 800, adminBrands: [], adminPrograms: [] },
};

function buildService() {
  return {
    findAll: jest.fn().mockResolvedValue([]),
    findById: jest.fn(async (id: string) => {
      const row = templates[id];
      if (!row) throw new NotFoundException(`Email template with ID '${id}' not found`);
      return row;
    }),
    create: jest.fn(async (dto: object) => ({ id: TPL_A, ...dto })),
    update: jest.fn(async (id: string) => templates[id]),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

async function bootstrap(persona: keyof typeof admins, service: ReturnType<typeof buildService>) {
  const readPrisma = {
    admin: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'admin-1',
        canManageAdmins: false,
        canAssignRoles: false,
        customPermissions: null,
        role: { name: 'Role', permissions: [] },
        ...admins[persona],
      }),
    },
    program: { findUnique: jest.fn(async ({ where }: { where: { id: string } }) => programs[where.id] ?? null) },
  };
  const module = await Test.createTestingModule({
    controllers: [EmailTemplateController],
    providers: [
      { provide: EmailTemplateService, useValue: service },
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
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  return app;
}

const newTemplate = { name: 'n', type: 'welcome', subject: 's', body: 'b' };

describe('/admin/email-templates is scoped to the admin\'s brands/programmes', () => {
  let app: INestApplication;
  let service: ReturnType<typeof buildService>;

  afterEach(async () => {
    if (app) await app.close();
  });

  describe('brand-scoped admin (brand A)', () => {
    beforeEach(async () => {
      service = buildService();
      app = await bootstrap('brandA', service);
    });

    it('lists its own brand and programme', async () => {
      await request(app.getHttpServer()).get(`/admin/email-templates?brandId=${BRAND_A}`).expect(200);
      await request(app.getHttpServer()).get(`/admin/email-templates?programId=${PROG_A}`).expect(200);
      expect(service.findAll).toHaveBeenCalledTimes(2);
    });

    it('cannot list another brand, another brand\'s programme, or everything', async () => {
      await request(app.getHttpServer()).get(`/admin/email-templates?brandId=${BRAND_B}`).expect(403);
      await request(app.getHttpServer()).get(`/admin/email-templates?programId=${PROG_B}`).expect(404);
      await request(app.getHttpServer()).get('/admin/email-templates').expect(403);
      expect(service.findAll).not.toHaveBeenCalled();
    });

    it('reads/updates/deletes its own template', async () => {
      await request(app.getHttpServer()).get(`/admin/email-templates/${TPL_A}`).expect(200);
      await request(app.getHttpServer()).put(`/admin/email-templates/${TPL_A}`).send({ name: 'x' }).expect(200);
      await request(app.getHttpServer()).delete(`/admin/email-templates/${TPL_A}`).expect(200);
      expect(service.update).toHaveBeenCalledTimes(1);
      expect(service.delete).toHaveBeenCalledTimes(1);
    });

    it.each([TPL_B, TPL_GLOBAL])('another brand\'s or the global template %s reads as missing', async (id) => {
      const res = await request(app.getHttpServer()).get(`/admin/email-templates/${id}`).expect(404);
      expect(JSON.stringify(res.body)).not.toContain(BRAND_B);
      await request(app.getHttpServer()).put(`/admin/email-templates/${id}`).send({ name: 'x' }).expect(404);
      await request(app.getHttpServer()).delete(`/admin/email-templates/${id}`).expect(404);
      expect(service.update).not.toHaveBeenCalled();
      expect(service.delete).not.toHaveBeenCalled();
    });

    it('creates under its own brand/programme only', async () => {
      await request(app.getHttpServer()).post('/admin/email-templates').send({ ...newTemplate, brandId: BRAND_A }).expect(201);
      await request(app.getHttpServer()).post('/admin/email-templates').send({ ...newTemplate, programId: PROG_A }).expect(201);
      expect(service.create).toHaveBeenCalledTimes(2);
    });

    it('cannot create globally, under another brand, or pair its programme with another brand', async () => {
      await request(app.getHttpServer()).post('/admin/email-templates').send(newTemplate).expect(403);
      await request(app.getHttpServer()).post('/admin/email-templates').send({ ...newTemplate, brandId: BRAND_B }).expect(403);
      await request(app.getHttpServer()).post('/admin/email-templates').send({ ...newTemplate, programId: PROG_B }).expect(404);
      await request(app.getHttpServer())
        .post('/admin/email-templates')
        .send({ ...newTemplate, programId: PROG_A, brandId: BRAND_B })
        .expect(403);
      expect(service.create).not.toHaveBeenCalled();
    });
  });

  describe('platform admin', () => {
    beforeEach(async () => {
      service = buildService();
      app = await bootstrap('platform', service);
    });

    it('lists everything and acts on any template, including global ones', async () => {
      await request(app.getHttpServer()).get('/admin/email-templates').expect(200);
      await request(app.getHttpServer()).get(`/admin/email-templates/${TPL_B}`).expect(200);
      await request(app.getHttpServer()).put(`/admin/email-templates/${TPL_GLOBAL}`).send({ name: 'x' }).expect(200);
      await request(app.getHttpServer()).post('/admin/email-templates').send(newTemplate).expect(201);
      expect(service.findAll).toHaveBeenCalled();
      expect(service.update).toHaveBeenCalled();
      expect(service.create).toHaveBeenCalled();
    });
  });
});
