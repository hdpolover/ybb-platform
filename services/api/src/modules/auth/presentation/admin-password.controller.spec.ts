// services/api/src/modules/auth/presentation/admin-password.controller.spec.ts
import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../infrastructure/guards/jwt-auth.guard';
import { TurnstileGuard } from '../infrastructure/guards/turnstile.guard';
import { AdminPasswordService } from '../application/services/admin-password.service';
import { AdminPasswordController } from './admin-password.controller';

describe('AdminPasswordController', () => {
  let app: INestApplication;
  const service = { changeOwnPassword: jest.fn(), requestReset: jest.fn() };
  const user = { userId: 'u1', email: 'a@b.co', brandId: 'b1', adminId: 'adm1', sid: 's1' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminPasswordController],
      providers: [{ provide: AdminPasswordService, useValue: service }],
    })
      .overrideGuard(TurnstileGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().user = user;
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    service.changeOwnPassword.mockResolvedValue({ ok: true });
    service.requestReset.mockResolvedValue(undefined);
  });

  describe('POST /auth/admin/forgot-password', () => {
    const post = (body: object) => request(app.getHttpServer()).post('/auth/admin/forgot-password').send(body);

    it('answers 202 { submitted: true } with a normalised email', async () => {
      const res = await post({ email: ' Admin@Example.COM ' });
      expect(res.status).toBe(202);
      expect(res.body).toEqual({ submitted: true });
      expect(service.requestReset).toHaveBeenCalledWith('admin@example.com', expect.any(String), expect.any(String));
    });

    it('answers identically whether or not the service found an admin to mail', async () => {
      const a = await post({ email: 'known@example.com' });
      const b = await post({ email: 'unknown@example.com' });
      expect([a.status, a.body]).toEqual([b.status, b.body]);
    });

    it('400s on a malformed email without calling the service', async () => {
      const res = await post({ email: 'nope' });
      expect(res.status).toBe(400);
      expect(service.requestReset).not.toHaveBeenCalled();
    });

    it('is public, enforces Turnstile regardless of the rollout flag, and throttles per mailbox and per IP', () => {
      const handler = AdminPasswordController.prototype.forgotPassword;
      expect(Reflect.getMetadata('isPublic', handler)).toBe(true);
      expect(Reflect.getMetadata('turnstile:enforced', handler)).toBe(true);
      expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(5);
      expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(3600000);
      expect(Reflect.getMetadata('THROTTLER:LIMITlong', handler)).toBe(30);
    });
  });

  describe('POST /auth/admin/change-password', () => {
    const post = (body: object) => request(app.getHttpServer()).post('/auth/admin/change-password').send(body);

    it('passes the authenticated user and both passwords to the service and answers 200 { ok: true }', async () => {
      const res = await post({ currentPassword: 'OldPassw0rd!', newPassword: 'NewPassw0rd!' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(service.changeOwnPassword).toHaveBeenCalledWith(user, 'OldPassw0rd!', 'NewPassw0rd!', expect.any(String), expect.any(String));
    });

    it.each([
      ['too short', { newPassword: 'Ab1!' }],
      ['no uppercase', { newPassword: 'alllowercase1!' }],
      ['no digit or symbol', { newPassword: 'OnlyLettersHere' }],
      ['missing current password', { currentPassword: undefined }],
      ['unknown field', { isAdmin: true }],
    ])('400s on %s and never reaches the service', async (_label, patch) => {
      const res = await post({ currentPassword: 'OldPassw0rd!', newPassword: 'NewPassw0rd!', ...patch });
      expect(res.status).toBe(400);
      expect(service.changeOwnPassword).not.toHaveBeenCalled();
    });

    it('is guarded by JwtAuthGuard and throttled per user', () => {
      const handler = AdminPasswordController.prototype.changePassword;
      expect(Reflect.getMetadata('__guards__', handler)).toEqual([JwtAuthGuard]);
      expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(10);
    });
  });
});
