// src/modules/users/application/commands/handlers/review-deletion-request.handler.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ReviewDeletionRequestHandler } from './review-deletion-request.handler';
import { ReviewDeletionRequestCommand } from '../review-deletion-request.command';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DeletionStatus } from '@prisma/client';

describe('ReviewDeletionRequestHandler', () => {
  let handler: ReviewDeletionRequestHandler;
  let mockPrisma: {
    accountDeletionRequest: { findUnique: jest.Mock; update: jest.Mock };
    user: { update: jest.Mock };
    $transaction: jest.Mock;
  };

  const pendingRequest = {
    id: 'req-1',
    userId: 'user-1',
    status: DeletionStatus.pending,
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
      $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReviewDeletionRequestHandler, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    handler = module.get<ReviewDeletionRequestHandler>(ReviewDeletionRequestHandler);
  });

  it('throws NotFoundException when the request does not exist', async () => {
    mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue(null);
    await expect(
      handler.execute(new ReviewDeletionRequestCommand('missing', 'admin-1', 'approve')),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when the request is no longer pending', async () => {
    mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue({
      ...pendingRequest,
      status: DeletionStatus.approved,
    });
    await expect(
      handler.execute(new ReviewDeletionRequestCommand('req-1', 'admin-1', 'approve')),
    ).rejects.toThrow(BadRequestException);
  });

  it('deactivates the account when a deletion request is approved', async () => {
    await handler.execute(new ReviewDeletionRequestCommand('req-1', 'admin-1', 'approve'));

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { isActive: false },
    });
  });

  it('does not touch the account when a deletion request is rejected', async () => {
    await handler.execute(new ReviewDeletionRequestCommand('req-1', 'admin-1', 'reject'));

    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.accountDeletionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: DeletionStatus.rejected }) }),
    );
  });
});
