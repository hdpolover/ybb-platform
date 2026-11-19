// services/api/src/modules/system/presentation/platform-only-content-routes.spec.ts
//
// Admin routes that carried only @Roles(ADMIN, SUPER_ADMIN) and are now
// @ScopedBy('platform'): newsletter subscribers (cross-brand PII), legal
// documents (ToS/Privacy), AI bot configs (raw embed code) and system
// announcements (site-wide banners + every brand's drafts). A brand-scoped admin
// gets 403 with the handler never reached; a platform admin passes; the
// public/participant routes sharing these controllers stay open to anyone.
import { Test } from '@nestjs/testing';
import { ExecutionContext, INestApplication, Type } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import * as request from 'supertest';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { UserRole } from '@core/entities/user.entity';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { HttpExceptionFilter } from '@shared/filters/http-exception.filter';
import { NewsletterController } from '@modules/newsletter/newsletter.controller';
import { NewsletterService } from '@modules/newsletter/newsletter.service';
import { LegalDocumentController } from '@modules/legal/presentation/legal-document.controller';
import { LegalDocumentService } from '@modules/legal/application/services/legal-document.service';
import { AiBotController } from '@modules/ai-bot/ai-bot.controller';
import { AiBotService } from '@modules/ai-bot/ai-bot.service';
import { SystemAnnouncementsController } from './system-announcements.controller';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
type Route = [Method, string];

interface Case {
  name: string;
  controller: Type<unknown>;
  service: Type<unknown>;
  methods: Record<string, unknown>;
  adminRoutes: Route[];
  publicRoutes: Route[];
}

const doc = { id: 'doc-1', brandId: 'brand-a' };

const cases: Case[] = [
  {
    name: 'newsletter',
    controller: NewsletterController,
    service: NewsletterService,
    methods: { getSubscribers: [], subscribe: {} },
    adminRoutes: [['get', '/newsletter/subscribers']],
    publicRoutes: [['post', '/newsletter/subscribe']],
  },
  {
    name: 'legal documents',
    controller: LegalDocumentController,
    service: LegalDocumentService,
    methods: {
      findAllByBrandForAdmin: [],
      findById: doc,
      create: doc,
      update: doc,
      delete: {},
      findAllByBrand: [],
      findOneByBrandAndType: doc,
    },
    adminRoutes: [
      ['get', '/brands/ybb/legal-documents/admin'],
      ['get', '/brands/ybb/legal-documents/admin/doc-1'],
      ['post', '/brands/ybb/legal-documents'],
      ['put', '/brands/ybb/legal-documents/doc-1'],
      ['delete', '/brands/ybb/legal-documents/doc-1'],
    ],
    publicRoutes: [
      ['get', '/brands/ybb/legal-documents'],
      ['get', '/brands/ybb/legal-documents/privacy-policy'],
    ],
  },
  {
    name: 'ai bot',
    controller: AiBotController,
    service: AiBotService,
    methods: { create: {}, findAll: [], findOne: {}, update: {}, remove: {}, getActiveConfig: {} },
    adminRoutes: [
      ['post', '/ai-bot'],
      ['get', '/ai-bot'],
      ['get', '/ai-bot/bot-1'],
      ['patch', '/ai-bot/bot-1'],
      ['delete', '/ai-bot/bot-1'],
    ],
    publicRoutes: [['get', '/ai-bot/active']],
  },
  {
    name: 'system announcements',
    controller: SystemAnnouncementsController,
    service: CommandBus,
    methods: { execute: {} },
    adminRoutes: [
      ['get', '/system/announcements/admin/all'],
      ['get', '/system/announcements/admin/ann-1'],
      ['post', '/system/announcements/admin'],
      ['patch', '/system/announcements/admin/ann-1'],
      ['delete', '/system/announcements/admin/ann-1'],
      ['post', '/system/announcements/admin/ann-1/publish'],
    ],
    // Public reads go through the QueryBus, so the CommandBus mock staying
    // untouched also proves no admin handler ran for them.
    publicRoutes: [
      ['get', '/system/announcements'],
      ['get', '/system/announcements/ann-1'],
    ],
  },
];

const admins = {
  // News Writer / Digital Marketing / Reviewer shape.
  brandScoped: { accessLevel: 1, adminBrands: [{ brandId: 'brand-a', permissions: [] }], adminPrograms: [] },
  platform: { accessLevel: 800, adminBrands: [], adminPrograms: [] },
};

async function bootstrap(c: Case, persona: keyof typeof admins) {
  const service = Object.fromEntries(
    Object.entries(c.methods).map(([key, value]) => [key, jest.fn().mockResolvedValue(value)]),
  ) as Record<string, jest.Mock>;
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
  };
  const providers = [
    { provide: c.service, useValue: service },
    { provide: PrismaReadService, useValue: readPrisma },
    ...(c.service === CommandBus ? [{ provide: QueryBus, useValue: { execute: jest.fn().mockResolvedValue([]) } }] : []),
  ];
  const module = await Test.createTestingModule({ controllers: [c.controller], providers })
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
  return { app, service };
}

describe.each(cases)('$name admin routes are platform-only', (c) => {
  let app: INestApplication;

  afterEach(async () => {
    if (app) await app.close();
  });

  it('brand-scoped admin gets 403 on every admin route and no handler runs', async () => {
    const built = await bootstrap(c, 'brandScoped');
    app = built.app;

    for (const [method, path] of c.adminRoutes) {
      const res = await request(app.getHttpServer())[method](path).send({});
      expect({ path, status: res.status }).toEqual({ path, status: 403 });
      expect(JSON.stringify(res.body)).toContain('restricted to platform administrators');
    }

    const adminMethods = c.service === CommandBus ? ['execute'] : Object.keys(c.methods);
    const publicMethods = ['subscribe', 'findAllByBrand', 'findOneByBrandAndType', 'getActiveConfig'];
    for (const key of adminMethods.filter((k) => !publicMethods.includes(k))) {
      expect(built.service[key]).not.toHaveBeenCalled();
    }
  });

  it('brand-scoped admin still reaches the public routes', async () => {
    const built = await bootstrap(c, 'brandScoped');
    app = built.app;

    for (const [method, path] of c.publicRoutes) {
      const res = await request(app.getHttpServer())[method](path).send({});
      expect({ path, ok: res.status < 400 }).toEqual({ path, ok: true });
    }
  });

  it('platform admin passes every admin route', async () => {
    const built = await bootstrap(c, 'platform');
    app = built.app;

    for (const [method, path] of c.adminRoutes) {
      const res = await request(app.getHttpServer())[method](path).send({});
      expect({ path, ok: res.status < 400 }).toEqual({ path, ok: true });
    }
  });
});
