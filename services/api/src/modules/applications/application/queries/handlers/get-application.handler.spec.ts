// services/api/src/modules/applications/application/queries/handlers/get-application.handler.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { GetApplicationHandler } from './get-application.handler';
import { GetApplicationQuery } from '../get-application.query';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PaymentGrpcClient } from '@modules/payments/infrastructure/services/payment-grpc.client';
import { ParticipantApplication, ApplicationStatus } from '@core/entities/participant-application.entity';

describe('GetApplicationHandler birthdate resolution', () => {
  let handler: GetApplicationHandler;
  let applicationRepository: { findById: jest.Mock };
  let prisma: {
    participant: { findUnique: jest.Mock };
    programEssay: { findMany: jest.Mock };
    applicationFormField: { findMany: jest.Mock };
  };
  let paymentClient: { getIntentsByReference: jest.Mock };

  function buildApplication(personalData: Record<string, unknown>): ParticipantApplication {
    return new ParticipantApplication(
      'app-1',
      'participant-1',
      'program-1',
      ApplicationStatus.SUBMITTED,
      undefined,
      personalData,
    );
  }

  beforeEach(async () => {
    applicationRepository = { findById: jest.fn() };
    prisma = {
      participant: { findUnique: jest.fn() },
      programEssay: { findMany: jest.fn().mockResolvedValue([]) },
      applicationFormField: { findMany: jest.fn().mockResolvedValue([]) },
    };
    paymentClient = { getIntentsByReference: jest.fn().mockResolvedValue({ intents: [] }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetApplicationHandler,
        { provide: APPLICATION_REPOSITORY, useValue: applicationRepository },
        ApplicationMapper,
        { provide: CacheService, useValue: { get: jest.fn().mockResolvedValue(undefined), set: jest.fn() } },
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentGrpcClient, useValue: paymentClient },
      ],
    }).compile();

    handler = module.get(GetApplicationHandler);
  });

  it('prefers the real personal_data birthdate over the participant.birthdate column', async () => {
    applicationRepository.findById.mockResolvedValue(buildApplication({ birthdate: '1998-05-12' }));
    prisma.participant.findUnique.mockResolvedValue({
      id: 'participant-1',
      fullName: 'John Doe',
      birthdate: new Date('1990-01-01T00:00:00.000Z'),
      user: { email: 'john@example.com' },
    });

    const dto = await handler.execute(new GetApplicationQuery('app-1', true));

    expect(dto.participant?.birthdate?.toISOString().slice(0, 10)).toBe('1998-05-12');
  });

  it('reads date_of_birth from personal_data when birthdate key is absent', async () => {
    applicationRepository.findById.mockResolvedValue(buildApplication({ date_of_birth: '2001-11-20' }));
    prisma.participant.findUnique.mockResolvedValue({
      id: 'participant-1',
      fullName: 'John Doe',
      birthdate: null,
      user: { email: 'john@example.com' },
    });

    const dto = await handler.execute(new GetApplicationQuery('app-1', true));

    expect(dto.participant?.birthdate?.toISOString().slice(0, 10)).toBe('2001-11-20');
  });

  it('falls back to a real (non-Jan-1) participant.birthdate when personal_data has nothing usable', async () => {
    applicationRepository.findById.mockResolvedValue(buildApplication({}));
    prisma.participant.findUnique.mockResolvedValue({
      id: 'participant-1',
      fullName: 'John Doe',
      birthdate: new Date('1995-07-20T00:00:00.000Z'),
      user: { email: 'john@example.com' },
    });

    const dto = await handler.execute(new GetApplicationQuery('app-1', true));

    expect(dto.participant?.birthdate?.toISOString().slice(0, 10)).toBe('1995-07-20');
  });

  it('returns null (not the fake Jan-1 date) when personal_data has nothing and participant.birthdate is year-only', async () => {
    applicationRepository.findById.mockResolvedValue(buildApplication({}));
    prisma.participant.findUnique.mockResolvedValue({
      id: 'participant-1',
      fullName: 'John Doe',
      birthdate: new Date('1990-01-01T00:00:00.000Z'),
      user: { email: 'john@example.com' },
    });

    const dto = await handler.execute(new GetApplicationQuery('app-1', true));

    expect(dto.participant?.birthdate).toBeNull();
  });
});
