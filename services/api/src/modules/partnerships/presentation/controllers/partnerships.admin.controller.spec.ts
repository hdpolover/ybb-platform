import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PartnershipsAdminController } from './partnerships.admin.controller';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('PartnershipsAdminController', () => {
  let controller: PartnershipsAdminController;

  const mockPrismaService = {
    partnershipEnquiry: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const actor = { userId: 'u-1', email: 'admin@ybb.id', brandId: 'b-1', adminId: 'adm-1' } as never;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PartnershipsAdminController],
      providers: [{ provide: PrismaService, useValue: mockPrismaService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PartnershipsAdminController>(PartnershipsAdminController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // The bug this whole feature build started from: list() previously had no
  // deletedAt filter, so a soft-deleted enquiry (once soft-delete existed)
  // would silently reappear in the admin list the moment it was added.
  describe('list', () => {
    it('always filters deletedAt: null in the where clause', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[], 0]);

      await controller.list('prog-1');

      // $transaction is called with an array of already-invoked prisma
      // promises, so assert against the calls captured on the mocked
      // findMany/count methods directly rather than on $transaction itself.
      expect(mockPrismaService.partnershipEnquiry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ programId: 'prog-1', deletedAt: null }),
        }),
      );
      expect(mockPrismaService.partnershipEnquiry.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ programId: 'prog-1', deletedAt: null }),
        }),
      );
    });

    it('filters by partnershipType when type is passed', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[], 0]);

      await controller.list('prog-1', undefined, undefined, undefined, 'ambassador-program');

      expect(mockPrismaService.partnershipEnquiry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ partnershipType: 'ambassador-program' }),
        }),
      );
    });
  });

  describe('getOne', () => {
    it('404s when the enquiry does not exist for the program', async () => {
      mockPrismaService.partnershipEnquiry.findFirst.mockResolvedValue(null);

      await expect(controller.getOne('prog-1', 'enq-missing')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.partnershipEnquiry.findFirst).toHaveBeenCalledWith({
        where: { id: 'enq-missing', programId: 'prog-1', deletedAt: null },
      });
    });

    // A soft-deleted row must read as gone through the detail endpoint too,
    // not just filtered out of the list — otherwise a direct-link/deep-link
    // to its id would still resolve.
    it('404s when the enquiry is soft-deleted (deletedAt filter excludes it)', async () => {
      mockPrismaService.partnershipEnquiry.findFirst.mockResolvedValue(null);

      await expect(controller.getOne('prog-1', 'enq-deleted')).rejects.toThrow(NotFoundException);
    });

    it('returns the full row when found', async () => {
      const row = { id: 'enq-1', programId: 'prog-1', description: 'a very long description' };
      mockPrismaService.partnershipEnquiry.findFirst.mockResolvedValue(row);

      const result = await controller.getOne('prog-1', 'enq-1');
      expect(result).toBe(row);
    });
  });

  describe('remove (soft-delete)', () => {
    it('sets deletedAt on a matching, not-yet-deleted row', async () => {
      mockPrismaService.partnershipEnquiry.updateMany.mockResolvedValue({ count: 1 });

      const result = await controller.remove('prog-1', 'enq-1');

      expect(mockPrismaService.partnershipEnquiry.updateMany).toHaveBeenCalledWith({
        where: { id: 'enq-1', programId: 'prog-1', deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
      expect(result).toEqual({ success: true });
    });

    // Idempotent-ish per the spec: deleting an already-deleted row is a 404,
    // not a crash and not a silent success.
    it('404s instead of throwing when the row is already deleted', async () => {
      mockPrismaService.partnershipEnquiry.updateMany.mockResolvedValue({ count: 0 });

      await expect(controller.remove('prog-1', 'enq-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update (status + notes)', () => {
    it('404s when the target row does not exist or is soft-deleted', async () => {
      mockPrismaService.partnershipEnquiry.findFirst.mockResolvedValue(null);

      await expect(
        controller.update('prog-1', 'enq-1', { notes: 'called them' }, actor),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.partnershipEnquiry.update).not.toHaveBeenCalled();
    });

    it('sets handledBy/handledAt whenever status and/or notes are updated', async () => {
      mockPrismaService.partnershipEnquiry.findFirst.mockResolvedValue({ id: 'enq-1' });
      mockPrismaService.partnershipEnquiry.findUniqueOrThrow.mockResolvedValue({ id: 'enq-1' });

      await controller.update('prog-1', 'enq-1', { status: 'contacted', notes: 'called them' }, actor);

      expect(mockPrismaService.partnershipEnquiry.update).toHaveBeenCalledWith({
        where: { id: 'enq-1' },
        data: {
          status: 'contacted',
          notes: 'called them',
          handledBy: 'adm-1',
          handledAt: expect.any(Date),
        },
      });
    });

    it('rejects an explicit empty-string status', async () => {
      mockPrismaService.partnershipEnquiry.findFirst.mockResolvedValue({ id: 'enq-1' });

      await expect(
        controller.update('prog-1', 'enq-1', { status: '   ' }, actor),
      ).rejects.toThrow(BadRequestException);
    });
  });

});
