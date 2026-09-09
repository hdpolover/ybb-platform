// src/modules/applications/application/commands/handlers/update-application.handler.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpdateApplicationHandler } from './update-application.handler';
import { UpdateApplicationCommand } from '../update-application.command';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

const makeDomainApp = (overrides: { participantId?: string; canEdit?: boolean } = {}) => ({
  id: 'app-1',
  participantId: overrides.participantId ?? 'participant-1',
  status: 'draft',
  canEdit: jest.fn().mockReturnValue(overrides.canEdit ?? true),
});

describe('UpdateApplicationHandler (admin path)', () => {
  let handler: UpdateApplicationHandler;

  const mockAppRepository = { findById: jest.fn(), update: jest.fn() };
  const mockMapper = { toDto: jest.fn().mockReturnValue({ id: 'app-1' }) };
  const mockCacheService = {
    invalidatePortalCache: jest.fn().mockResolvedValue(undefined),
    invalidateKeys: jest.fn().mockResolvedValue(undefined),
  };
  const mockPrisma = { participant: { findUnique: jest.fn() } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateApplicationHandler,
        { provide: APPLICATION_REPOSITORY, useValue: mockAppRepository },
        { provide: ApplicationMapper, useValue: mockMapper },
        { provide: CacheService, useValue: mockCacheService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    handler = module.get(UpdateApplicationHandler);
    jest.clearAllMocks();
    mockPrisma.participant.findUnique.mockResolvedValue({ userId: 'participant-user-1' });
  });

  it('throws NotFoundException when the application does not exist', async () => {
    mockAppRepository.findById.mockResolvedValue(null);
    await expect(
      handler.execute(new UpdateApplicationCommand('app-1', {})),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when the application is not editable', async () => {
    const app = makeDomainApp({ canEdit: false });
    mockAppRepository.findById.mockResolvedValue(app);

    await expect(
      handler.execute(new UpdateApplicationCommand('app-1', {})),
    ).rejects.toThrow(BadRequestException);
  });

  // Audit M103/M120: PUT /applications/:id is admin-only. The removed
  // @CacheInvalidate(['portal:*:${userId}']) decorator resolved ${userId}
  // from the acting ADMIN's JWT, so an admin edit to a draft never busted
  // the owning participant's real cache key, leaving the portal stale for
  // the full TTL. Prove the fix resolves and busts the PARTICIPANT's key.
  it("invalidates the PARTICIPANT's portal cache, not the acting admin's", async () => {
    const app = makeDomainApp({ participantId: 'participant-1' });
    mockAppRepository.findById.mockResolvedValue(app);
    mockAppRepository.update.mockResolvedValue(app);
    mockPrisma.participant.findUnique.mockResolvedValue({ userId: 'participant-user-1' });

    await handler.execute(
      new UpdateApplicationCommand('app-1', { motivationLetter: 'updated' }),
    );

    expect(mockPrisma.participant.findUnique).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
      select: { userId: true },
    });
    expect(mockCacheService.invalidatePortalCache).toHaveBeenCalledWith('participant-user-1');
    expect(mockCacheService.invalidatePortalCache).not.toHaveBeenCalledWith('admin-user-999');
  });
});
