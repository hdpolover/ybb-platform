// src/modules/applications/application/commands/handlers/create-application.handler.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { CreateApplicationHandler } from './create-application.handler';
import { CreateApplicationCommand } from '../create-application.command';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ApplicationCategory } from '@core/entities/participant-application.entity';

describe('CreateApplicationHandler (admin path)', () => {
  let handler: CreateApplicationHandler;

  const mockAppRepository = {
    findByParticipantAndProgram: jest.fn(),
    create: jest.fn(),
  };
  const mockMapper = { toDto: jest.fn().mockReturnValue({ id: 'app-1' }) };
  const mockMetrics = { applicationStartedTotal: { inc: jest.fn() } };
  const mockCacheService = {
    invalidatePortalCache: jest.fn().mockResolvedValue(undefined),
    invalidateKeys: jest.fn().mockResolvedValue(undefined),
  };
  const mockPrisma = { participant: { findUnique: jest.fn() } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateApplicationHandler,
        { provide: APPLICATION_REPOSITORY, useValue: mockAppRepository },
        { provide: ApplicationMapper, useValue: mockMapper },
        { provide: MetricsService, useValue: mockMetrics },
        { provide: CacheService, useValue: mockCacheService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    handler = module.get(CreateApplicationHandler);
    jest.clearAllMocks();
    mockAppRepository.findByParticipantAndProgram.mockResolvedValue(null);
    mockAppRepository.create.mockResolvedValue({ id: 'app-1', participantId: 'participant-1' });
    mockPrisma.participant.findUnique.mockResolvedValue({ userId: 'participant-user-1' });
  });

  it('throws ConflictException when an application already exists', async () => {
    mockAppRepository.findByParticipantAndProgram.mockResolvedValue({ id: 'existing' });

    await expect(
      handler.execute(
        new CreateApplicationCommand('participant-1', 'program-1', ApplicationCategory.SELF_FUNDED),
      ),
    ).rejects.toThrow(ConflictException);
  });

  // Audit M103/M120: POST /applications is admin-only. The removed
  // @CacheInvalidate(['portal:*:${userId}']) decorator resolved ${userId}
  // from the acting ADMIN's JWT, never the participant's. A cached
  // portal:submissions list the participant loaded before this admin action
  // would keep hiding the newly created draft for the full TTL. Prove the
  // fix resolves and busts the PARTICIPANT's key.
  it("invalidates the PARTICIPANT's portal cache, not the acting admin's", async () => {
    await handler.execute(
      new CreateApplicationCommand('participant-1', 'program-1', ApplicationCategory.SELF_FUNDED),
    );

    expect(mockPrisma.participant.findUnique).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
      select: { userId: true },
    });
    expect(mockCacheService.invalidatePortalCache).toHaveBeenCalledWith('participant-user-1');
    expect(mockCacheService.invalidatePortalCache).not.toHaveBeenCalledWith('admin-user-999');
  });
});
