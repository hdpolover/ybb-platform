// services/api/src/modules/programs/presentation/program-copy.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ProgramCopyController } from './program-copy.controller';
import { ProgramCopierRegistry } from '../application/copy/program-copier.registry';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/infrastructure/guards/roles.guard';

describe('ProgramCopyController', () => {
  let controller: ProgramCopyController;
  const mockRegistryGet = jest.fn();
  const mockPrismaTransaction = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProgramCopyController],
      providers: [
        { provide: ProgramCopierRegistry, useValue: { get: mockRegistryGet, list: jest.fn() } },
        { provide: PrismaService, useValue: { $transaction: mockPrismaTransaction } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProgramCopyController>(ProgramCopyController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCounts', () => {
    it('calls countFor for each program id in the comma-separated query param', async () => {
      const countFor = jest.fn().mockImplementation((id: string) => Promise.resolve(id === 'p1' ? 3 : 0));
      mockRegistryGet.mockReturnValue({ countFor });
      const result = await controller.getCounts('faqs', 'p1,p2');
      expect(mockRegistryGet).toHaveBeenCalledWith('faqs');
      expect(result).toEqual([
        { programId: 'p1', count: 3 },
        { programId: 'p2', count: 0 },
      ]);
    });

    it('returns an empty array when programIds is missing', async () => {
      mockRegistryGet.mockReturnValue({ countFor: jest.fn() });
      const result = await controller.getCounts('faqs', undefined);
      expect(result).toEqual([]);
    });
  });

  describe('preview', () => {
    it('delegates to the copier registered under entityKey', async () => {
      const preview = jest.fn().mockResolvedValue([{ id: 'x', label: 'X' }]);
      mockRegistryGet.mockReturnValue({ preview });
      const result = await controller.preview('prog-1', 'faqs');
      expect(mockRegistryGet).toHaveBeenCalledWith('faqs');
      expect(preview).toHaveBeenCalledWith('prog-1');
      expect(result).toEqual([{ id: 'x', label: 'X' }]);
    });
  });

  describe('copy', () => {
    it('rejects when sourceProgramId equals the target programId', async () => {
      mockRegistryGet.mockReturnValue({ supportsAppend: true, copy: jest.fn() });
      await expect(
        controller.copy('prog-1', 'faqs', { sourceProgramId: 'prog-1', mode: 'append' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
    });

    it('rejects replace mode without confirm: true', async () => {
      mockRegistryGet.mockReturnValue({ supportsAppend: true, copy: jest.fn() });
      await expect(
        controller.copy('tgt', 'faqs', { sourceProgramId: 'src', mode: 'replace' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
    });

    it('rejects append mode when the copier does not support it', async () => {
      mockRegistryGet.mockReturnValue({ supportsAppend: false, copy: jest.fn() });
      await expect(
        controller.copy('tgt', 'program-details', { sourceProgramId: 'src', mode: 'append' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
    });

    it('opens a transaction and calls the copier with sourceProgramId/targetProgramId/itemIds/mode (no confirm)', async () => {
      const copy = jest.fn().mockResolvedValue({ created: 2, skipped: 1, replaced: 0 });
      mockRegistryGet.mockReturnValue({ supportsAppend: true, copy });
      mockPrismaTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb('fake-tx'));

      const result = await controller.copy('tgt', 'faqs', {
        sourceProgramId: 'src',
        itemIds: ['a', 'b'],
        mode: 'append',
      });

      expect(copy).toHaveBeenCalledWith('fake-tx', {
        sourceProgramId: 'src',
        targetProgramId: 'tgt',
        itemIds: ['a', 'b'],
        mode: 'append',
      });
      expect(result).toEqual({ created: 2, skipped: 1, replaced: 0 });
    });

    it('accepts replace mode when confirm is true', async () => {
      const copy = jest.fn().mockResolvedValue({ created: 0, skipped: 0, replaced: 4 });
      mockRegistryGet.mockReturnValue({ supportsAppend: true, copy });
      mockPrismaTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb('fake-tx'));

      const result = await controller.copy('tgt', 'faqs', { sourceProgramId: 'src', mode: 'replace', confirm: true });

      expect(copy).toHaveBeenCalledWith('fake-tx', { sourceProgramId: 'src', targetProgramId: 'tgt', itemIds: undefined, mode: 'replace' });
      expect(result).toEqual({ created: 0, skipped: 0, replaced: 4 });
    });
  });
});
