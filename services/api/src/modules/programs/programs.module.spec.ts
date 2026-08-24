// services/api/src/modules/programs/programs.module.spec.ts
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { ProgramCopierRegistry } from './application/copy/program-copier.registry';
import { ProgramCopier } from './application/copy/program-copier.interface';
import { FormFieldsCopier } from './application/copy/copiers/form-fields.copier';
import { ParticipationCategoriesCopier } from './application/copy/copiers/participation-categories.copier';
import { TimelinesCopier } from './application/copy/copiers/timelines.copier';
import { RundownsCopier } from './application/copy/copiers/rundowns.copier';
import { FaqsCopier } from './application/copy/copiers/faqs.copier';
import { PaymentsCopier } from './application/copy/copiers/payments.copier';
import { ProgramDetailsCopier } from './application/copy/copiers/program-details.copier';

// This spec exercises the *exact* provider registration shape used in
// programs.module.ts for the copy feature: the seven copiers as ordinary
// providers, plus ProgramCopierRegistry registered via an explicit
// useFactory/inject pair (required because its constructor is a rest
// parameter, which Nest cannot resolve positionally from `providers`).
//
// It deliberately does not import the full ProgramsModule — that module
// also imports AuthModule, which instantiates JwtStrategy and fails in this
// environment without a JWT secret configured (see baseline: 3 suites fail
// on "JwtStrategy requires a secret or key", unrelated to this feature).
// Building a focused testing module keeps this spec's pass/fail signal
// scoped to the copy DI graph.
describe('ProgramsModule copy DI graph', () => {
  let moduleRef: TestingModule;
  let registry: ProgramCopierRegistry;

  const mockPrismaService = {};

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        { provide: PrismaService, useValue: mockPrismaService },
        FormFieldsCopier,
        ParticipationCategoriesCopier,
        TimelinesCopier,
        RundownsCopier,
        FaqsCopier,
        PaymentsCopier,
        ProgramDetailsCopier,
        {
          provide: ProgramCopierRegistry,
          useFactory: (...copiers: ProgramCopier[]) => new ProgramCopierRegistry(...copiers),
          inject: [
            FormFieldsCopier,
            ParticipationCategoriesCopier,
            TimelinesCopier,
            RundownsCopier,
            FaqsCopier,
            PaymentsCopier,
            ProgramDetailsCopier,
          ],
        },
      ],
    }).compile();

    registry = moduleRef.get(ProgramCopierRegistry);
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('resolves ProgramCopierRegistry from the container without throwing', () => {
    expect(registry).toBeInstanceOf(ProgramCopierRegistry);
  });

  it('lists exactly seven copiers', () => {
    expect(registry.list()).toHaveLength(7);
  });

  it.each([
    ['form-fields', FormFieldsCopier],
    ['participation-categories', ParticipationCategoriesCopier],
    ['timelines', TimelinesCopier],
    ['rundowns', RundownsCopier],
    ['faqs', FaqsCopier],
    ['payments', PaymentsCopier],
    ['program-details', ProgramDetailsCopier],
  ] as const)('get(%s) returns the %s instance', (key, CopierClass) => {
    expect(registry.get(key)).toBeInstanceOf(CopierClass);
  });

  it('throws NotFoundException for an unknown key', () => {
    expect(() => registry.get('not-a-real-key')).toThrow(NotFoundException);
  });
});
