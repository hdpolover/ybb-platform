import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LoaPreviewParticipantService } from './loa-preview-participant.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('LoaPreviewParticipantService', () => {
  let service: LoaPreviewParticipantService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoaPreviewParticipantService,
        {
          provide: PrismaService,
          useValue: {
            participantApplication: { findFirst: jest.fn() },
            participantDocument: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get(LoaPreviewParticipantService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  describe('resolveApplicationId', () => {
    it('returns the explicit applicationId when it belongs to the program', async () => {
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue({ id: 'app-42' });

      const result = await service.resolveApplicationId('program-1', 'app-42');

      expect(prisma.participantApplication.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'app-42', programId: 'program-1' } }),
      );
      expect(result).toEqual({ isSample: false, applicationId: 'app-42' });
    });

    it('throws NotFoundException (never falls back to auto-pick) when the explicit applicationId does not belong to this program', async () => {
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.resolveApplicationId('program-1', 'wrong-app')).rejects.toThrow(NotFoundException);
    });

    it('auto-picks the pool without gating on batch release state - status in [submitted, accepted] only', async () => {
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue({ id: 'app-auto-1' });

      const result = await service.resolveApplicationId('program-1', undefined);

      expect(prisma.participantApplication.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { programId: 'program-1', status: { in: ['submitted', 'accepted'] } },
        }),
      );
      expect(result).toEqual({ isSample: false, applicationId: 'app-auto-1' });
    });

    it('orders by submittedAt then id, so two independent calls against the same pool always agree', async () => {
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue({ id: 'app-auto-1' });

      await service.resolveApplicationId('program-1', undefined);

      expect(prisma.participantApplication.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
        }),
      );
    });

    it('falls back to isSample: true only when the pool is empty', async () => {
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.resolveApplicationId('program-1', undefined);

      expect(result).toEqual({ isSample: true });
    });
  });

  describe('resolveDocumentNumber', () => {
    it('returns the existing document number without creating or updating anything', async () => {
      (prisma.participantDocument.findFirst as jest.Mock).mockResolvedValue({ documentNumber: 'LOA-2026-0005' });

      const result = await service.resolveDocumentNumber('app-42');

      expect(result).toBe('LOA-2026-0005');
      expect(prisma.participantDocument.create).not.toHaveBeenCalled();
      expect(prisma.participantDocument.update).not.toHaveBeenCalled();
    });

    it('returns the literal PREVIEW/000 without allocating when no document exists yet', async () => {
      (prisma.participantDocument.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.resolveDocumentNumber('app-42');

      expect(result).toBe('PREVIEW/000');
      expect(prisma.participantDocument.create).not.toHaveBeenCalled();
      expect(prisma.participantDocument.update).not.toHaveBeenCalled();
    });
  });
});
