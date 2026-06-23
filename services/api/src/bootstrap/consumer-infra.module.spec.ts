// src/bootstrap/consumer-infra.module.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConsumerInfraModule } from './consumer-infra.module';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('ConsumerInfraModule', () => {
  let moduleRef: TestingModule;

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('compiles and exposes shared infra (no live DB/Redis connection at compile time)', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConsumerInfraModule],
    }).compile();

    // .compile() runs constructors but not onModuleInit, so no real connections open.
    expect(moduleRef.get(PrismaService, { strict: false })).toBeDefined();
  });
});
