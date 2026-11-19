// src/app.module.spec.ts
// The one provider that opens a socket during compile(): ThrottlerModule's
// useFactory constructs RedisThrottlerStorage, whose constructor does an eager
// (non-lazyConnect) `new Redis()`. On a passing run moduleRef.close() quits it,
// but when compile() throws - the exact case this suite exists to catch -
// there is no moduleRef to close, ioredis retries forever and jest never exits.
// Automocking the class keeps the factory itself (and its ConfigService /
// REDIS_PASSWORD reads) under test while making construction inert.
jest.mock('@shared/infrastructure/throttler/redis-throttler.storage');

import { Test, TestingModule } from '@nestjs/testing';
import { ConsumerStatusService } from '@shared/infrastructure/messaging/consumer-status.service';

// Obviously fake values, assigned (not defaulted) so a local services/api/.env
// can never feed real credentials into this suite: @nestjs/config does not
// override vars already present in process.env. These are the vars
// config/env.validation.ts and JwtStrategy throw without at module load and
// construction time. Same set as the CI job env in .github/workflows/verify.yml.
const FAKE_BOOT_ENV = {
  DATABASE_URL: 'postgresql://boot-smoke:boot-smoke@127.0.0.1:5432/boot-smoke',
  JWT_SECRET: 'boot-smoke-only-not-a-real-secret',
  RABBITMQ_URL: 'amqp://boot-smoke:boot-smoke@127.0.0.1:5672/',
  REDIS_PASSWORD: 'boot-smoke-only-not-a-real-password',
} as const;

// Nothing else in this suite compiles the REAL AppModule graph — main.spec.ts
// mocks it out wholesale (`jest.mock('./app.module')`). That is how a missing
// module import in this codebase reaches production: tsc is happy, every spec
// stubs its own providers, and the failure only ever surfaces as a boot-time
// crash-loop in a container (2026-09-08). The five RMQ consumer roots that
// main.ts bootstraps separately each have the same compile test in
// src/bootstrap/*.module.spec.ts.
//
// compile() builds the DI graph WITHOUT running onModuleInit, so this asserts
// resolvability without opening a database, Redis or AMQP connection.
describe('AppModule DI graph', () => {
  let moduleRef: TestingModule | undefined;

  beforeAll(() => {
    Object.assign(process.env, FAKE_BOOT_ENV);
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('resolves ConsumerStatusService the way main.ts bootstrap() does', async () => {
    // Imported here, after the env above is in place: ConfigModule.forRoot
    // validates the environment while app.module.ts is being evaluated.
    const { AppModule } = await import('./app.module');
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    // main.ts calls app.get(ConsumerStatusService) right after app.listen().
    // It reaches it through HealthModule -> ConsumerStatusModule; if that
    // export chain is ever broken, bootstrap throws AFTER the HTTP server is
    // already listening, which is the worst possible place to find out.
    expect(moduleRef.get(ConsumerStatusService, { strict: false })).toBeDefined();
  });
});
