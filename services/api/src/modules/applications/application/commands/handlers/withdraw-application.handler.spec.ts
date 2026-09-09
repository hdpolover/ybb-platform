// src/modules/applications/application/commands/handlers/withdraw-application.handler.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WithdrawApplicationHandler } from './withdraw-application.handler';
import { WithdrawApplicationCommand } from '../withdraw-application.command';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

const makeDomainApp = (overrides: { participantId?: string } = {}) => ({
  id: 'app-1',
  participantId: overrides.participantId ?? 'participant-1',
  status: 'submitted',
  canWithdraw: jest.fn().mockReturnValue(true),
  withdraw: jest.fn(),
  addStatusToHistory: jest.fn(),
});

describe('WithdrawApplicationHandler (admin path)', () => {
  let handler: WithdrawApplicationHandler;

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
        WithdrawApplicationHandler,
        { provide: APPLICATION_REPOSITORY, useValue: mockAppRepository },
        { provide: ApplicationMapper, useValue: mockMapper },
        { provide: CacheService, useValue: mockCacheService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    handler = module.get(WithdrawApplicationHandler);
    jest.clearAllMocks();
    mockPrisma.participant.findUnique.mockResolvedValue({ userId: 'participant-user-1' });
  });

  it('throws NotFoundException when the application does not exist', async () => {
    mockAppRepository.findById.mockResolvedValue(null);
    await expect(
      handler.execute(new WithdrawApplicationCommand('app-1', 'admin-user-999')),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when the application cannot be withdrawn', async () => {
    const app = makeDomainApp();
    app.canWithdraw.mockReturnValue(false);
    mockAppRepository.findById.mockResolvedValue(app);

    await expect(
      handler.execute(new WithdrawApplicationCommand('app-1', 'admin-user-999')),
    ).rejects.toThrow(BadRequestException);
  });

  // Audit M103/M120's named example: an admin withdraws an application on
  // behalf of a participant, and command.userId here is the ACTING ADMIN's
  // id (used for withdrawn_by attribution) — never the participant's. The
  // removed @CacheInvalidate(['portal:*:${userId}']) decorator resolved the
  // exact same admin id from the JWT, so it invalidated a key that was never
  // populated while the real participant:userId key stayed stale for the
  // full TTL. Prove the fix resolves and busts the PARTICIPANT's key.
  it("invalidates the PARTICIPANT's portal cache using participant.userId, not the acting admin's userId", async () => {
    const app = makeDomainApp({ participantId: 'participant-1' });
    mockAppRepository.findById.mockResolvedValue(app);
    mockAppRepository.update.mockResolvedValue(app);
    mockPrisma.participant.findUnique.mockResolvedValue({ userId: 'participant-user-1' });

    const adminUserId = 'admin-user-999';
    await handler.execute(new WithdrawApplicationCommand('app-1', adminUserId));

    expect(mockPrisma.participant.findUnique).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
      select: { userId: true },
    });
    expect(mockCacheService.invalidatePortalCache).toHaveBeenCalledWith('participant-user-1');
    expect(mockCacheService.invalidatePortalCache).not.toHaveBeenCalledWith(adminUserId);
  });

  it('attributes withdrawal to the acting caller while cache invalidation targets the participant', async () => {
    const app = makeDomainApp({ participantId: 'participant-1' });
    mockAppRepository.findById.mockResolvedValue(app);
    mockAppRepository.update.mockResolvedValue(app);

    const adminUserId = 'admin-user-999';
    await handler.execute(new WithdrawApplicationCommand('app-1', adminUserId));

    expect(app.withdraw).toHaveBeenCalledWith(adminUserId);
    expect(app.addStatusToHistory).toHaveBeenCalledWith(app.status, adminUserId, 'Application withdrawn');
  });
});
