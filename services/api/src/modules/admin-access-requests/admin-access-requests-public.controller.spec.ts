// services/api/src/modules/admin-access-requests/admin-access-requests-public.controller.spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { TurnstileGuard } from '../auth/infrastructure/guards/turnstile.guard';
import { AdminAccessRequestsPublicController } from './admin-access-requests-public.controller';
import { AdminAccessRequestsService } from './admin-access-requests.service';

const PROGRAM = '11111111-1111-4111-8111-111111111111';
const valid = { fullName: 'Rani Putri', email: ' Rani@Example.COM ', division: 'reviewer', programIds: [PROGRAM] };

describe('POST /admin-access-requests (public)', () => {
  let app: INestApplication;
  const service = { submit: jest.fn().mockResolvedValue(undefined), getOptions: jest.fn().mockResolvedValue({ divisions: [], programs: [] }) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminAccessRequestsPublicController],
      providers: [{ provide: AdminAccessRequestsService, useValue: service }],
    })
      .overrideGuard(TurnstileGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    // Same options as main.ts
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('answers 202 { submitted: true } and passes a normalised email to the service', async () => {
    const res = await request(app.getHttpServer()).post('/admin-access-requests').send(valid);

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ submitted: true });
    expect(service.submit).toHaveBeenCalledWith(expect.objectContaining({ email: 'rani@example.com' }), expect.any(String), expect.any(String));
  });

  it('answers the same 202 whatever the service resolved (existing admin, duplicate, no matching programs)', async () => {
    service.submit.mockResolvedValueOnce(undefined);
    const a = await request(app.getHttpServer()).post('/admin-access-requests').send(valid);
    service.submit.mockResolvedValueOnce(undefined);
    const b = await request(app.getHttpServer()).post('/admin-access-requests').send({ ...valid, programIds: [] });
    expect([a.status, a.body]).toEqual([b.status, b.body]);
  });

  it('accepts the optional turnstileToken body field', async () => {
    const res = await request(app.getHttpServer()).post('/admin-access-requests').send({ ...valid, turnstileToken: 'tok' });
    expect(res.status).toBe(202);
  });

  it.each([
    ['name too short', { fullName: 'R' }],
    ['name too long', { fullName: 'x'.repeat(101) }],
    ['bad email', { email: 'not-an-email' }],
    ['unknown division', { division: 'ceo' }],
    ['non-uuid program', { programIds: ['nope'] }],
    ['too many programs', { programIds: Array.from({ length: 31 }, () => PROGRAM) }],
    ['whatsapp too long', { whatsapp: '1'.repeat(31) }],
    ['note too long', { note: 'n'.repeat(1001) }],
    ['unknown field', { isAdmin: true }],
    ['missing programIds', { programIds: undefined }],
  ])('400s on %s and never reaches the service', async (_label, patch) => {
    const res = await request(app.getHttpServer()).post('/admin-access-requests').send({ ...valid, ...patch });
    expect(res.status).toBe(400);
    expect(service.submit).not.toHaveBeenCalled();
  });

  it('serves the options without auth', async () => {
    const res = await request(app.getHttpServer()).get('/admin-access-requests/options');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ divisions: [], programs: [] });
  });
});
