// src/app.module.spec.ts
// `uuid` ships ESM-only and this repo's jest transform does not process it.
// Every other suite avoids it by never importing a module that reaches it;
// compiling the whole AppModule graph does. Stubbing it here keeps that a
// local concern instead of a global jest-config change affecting 300+ suites.
jest.mock('uuid', () => ({ v4: () => '00000000-0000-4000-8000-000000000000' }));

import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { ConsumerStatusService } from '@shared/infrastructure/messaging/consumer-status.service';

// Nothing else in this suite compiles the REAL AppModule graph — main.spec.ts
// mocks it out wholesale (`jest.mock('./app.module')`). That is how a missing
// module import in this codebase reaches production: tsc is happy, every spec
// stubs its own providers, and the failure only ever surfaces as a boot-time
// crash-loop in a container.
//
// compile() builds the DI graph WITHOUT running onModuleInit, so this asserts
// resolvability without opening a database, Redis or AMQP connection.
describe('AppModule DI graph', () => {
  it('resolves ConsumerStatusService the way main.ts bootstrap() does', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    try {
      // main.ts calls app.get(ConsumerStatusService) right after app.listen().
      // It reaches it through HealthModule -> ConsumerStatusModule; if that
      // export chain is ever broken, bootstrap throws AFTER the HTTP server is
      // already listening, which is the worst possible place to find out.
      expect(moduleRef.get(ConsumerStatusService, { strict: false })).toBeDefined();
    } finally {
      await moduleRef.close();
    }
  });
});
