// src/modules/users/application/commands/handlers/review-deletion-request.handler.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ReviewDeletionRequestHandler } from './review-deletion-request.handler';
import { ReviewDeletionRequestCommand } from '../review-deletion-request.command';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DeletionStatus } from '@prisma/client';

describe('ReviewDeletionRequestHandler', () => {
  let handler: ReviewDeletionRequestHandler;

  const pendingRequest = {
    id: 'req-1',
    userId: 'user-1',
    status: DeletionStatus.pending,
  };

  const approvedRequest = {
    id: 'req-2',
    userId: 'user-2',
    status: DeletionStatus.approved,
  };

  // Interactive-transaction client for the 'approved' -> admin-cancel path.
  const mockTx = {
    accountDeletionRequest: { update: jest.fn() },
    user: { update: jest.fn() },
    participant: { updateMany: jest.fn() },
  };

  let mockPrisma: {
    accountDeletionRequest: { findUnique: jest.Mock; update: jest.Mock };
    user: { update: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    mockPrisma = {
      accountDeletionRequest: {
        findUnique: jest.fn().mockResolvedValue(pendingRequest),
        update: jest.fn().mockResolvedValue({ id: 'req-1', status: DeletionStatus.approved }),
      },
      user: {
        update: jest.fn().mockResolvedValue({ id: 'user-1', isActive: false }),
      },
      // Supports BOTH invocation styles this handler now uses: the legacy
      // array form ($transaction([...])) for the pending path, and the
      // interactive callback form ($transaction(async tx => ...)) for the
      // new admin-cancel path against an already-approved request.
      $transaction: jest.fn().mockImplementation((arg) =>
        Array.isArray(arg) ? Promise.all(arg) : arg(mockTx),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReviewDeletionRequestHandler, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    handler = module.get<ReviewDeletionRequestHandler>(ReviewDeletionRequestHandler);
    jest.clearAllMocks();
    mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue(pendingRequest);
    mockPrisma.accountDeletionRequest.update.mockResolvedValue({ id: 'req-1', status: DeletionStatus.approved });
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1', isActive: false });
    mockTx.accountDeletionRequest.update.mockResolvedValue({});
    mockTx.user.update.mockResolvedValue({});
    mockTx.participant.updateMany.mockResolvedValue({ count: 1 });
  });

  it('throws NotFoundException when the request does not exist', async () => {
    mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue(null);
    await expect(
      handler.execute(new ReviewDeletionRequestCommand('missing', 'admin-1', 'approve')),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when the request is already completed/rejected/cancelled', async () => {
    mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue({
      ...pendingRequest,
      status: DeletionStatus.completed,
    });
    await expect(
      handler.execute(new ReviewDeletionRequestCommand('req-1', 'admin-1', 'approve')),
    ).rejects.toThrow(BadRequestException);
  });

  describe('legacy: a still-pending request (pre-self-service rows only)', () => {
    it('deactivates the account when approved', async () => {
      await handler.execute(new ReviewDeletionRequestCommand('req-1', 'admin-1', 'approve'));

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isActive: false },
      });
    });

    it('does not touch the account when rejected', async () => {
      await handler.execute(new ReviewDeletionRequestCommand('req-1', 'admin-1', 'reject'));

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.accountDeletionRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: DeletionStatus.rejected }) }),
      );
    });
  });

  describe('current: an already-approved (auto-scheduled) request', () => {
    beforeEach(() => {
      mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue(approvedRequest);
    });

    it('"reject" is an admin-initiated CANCEL: restores the account', async () => {
      await handler.execute(new ReviewDeletionRequestCommand('req-2', 'admin-1', 'reject', 'user called support'));

      expect(mockTx.accountDeletionRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'req-2' },
          data: expect.objectContaining({ status: DeletionStatus.cancelled, scheduledDeletionDate: null }),
        }),
      );
      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: 'user-2' },
        data: { isActive: true, deletedAt: null },
      });
      expect(mockTx.participant.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-2' },
        data: { deletedAt: null },
      });
      // Reviewer attribution still recorded, alongside the restore.
      expect(mockTx.accountDeletionRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reviewedBy: 'admin-1', reviewNotes: 'user called support' }),
        }),
      );
    });

    it('"approve" on an already-approved request is refused - nothing left to approve', async () => {
      await expect(
        handler.execute(new ReviewDeletionRequestCommand('req-2', 'admin-1', 'approve')),
      ).rejects.toThrow(BadRequestException);
      expect(mockTx.user.update).not.toHaveBeenCalled();
    });
  });
});
