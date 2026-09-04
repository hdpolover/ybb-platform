// src/modules/users/application/commands/handlers/cancel-deletion-request.handler.spec.ts
import { createHash } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DeletionStatus } from '@prisma/client';
import { CancelDeletionRequestHandler, DELETION_CANCEL_CODES } from './cancel-deletion-request.handler';
import { CancelDeletionRequestCommand } from '../cancel-deletion-request.command';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';

describe('CancelDeletionRequestHandler', () => {
  let handler: CancelDeletionRequestHandler;

  const RAW_TOKEN = 'a'.repeat(64);
  const TOKEN_HASH = createHash('sha256').update(RAW_TOKEN).digest('hex');

  const approvedRequest = {
    id: 'req-1',
    userId: 'user-1',
    status: DeletionStatus.approved,
    dataSnapshot: {
      cancellationTokenHash: TOKEN_HASH,
      cancellationTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // valid for 1 more day
    },
  };

  const mockTx = {
    accountDeletionRequest: { update: jest.fn() },
    user: { update: jest.fn() },
    participant: { updateMany: jest.fn() },
  };

  const mockPrisma = {
    accountDeletionRequest: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    brand: { findUnique: jest.fn() },
    participant: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  const mockRabbitmqProducer = { emit: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CancelDeletionRequestHandler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RabbitMQProducerService, useValue: mockRabbitmqProducer },
      ],
    }).compile();

    handler = module.get<CancelDeletionRequestHandler>(CancelDeletionRequestHandler);
    jest.clearAllMocks();

    mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue(approvedRequest);
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(mockTx));
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'real.person@example.com', brandId: 'brand-1' });
    mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'YBB' });
    mockPrisma.participant.findUnique.mockResolvedValue({ fullName: 'Jane Doe' });
    mockRabbitmqProducer.emit.mockResolvedValue(undefined);
  });

  it('genuinely restores the account: isActive true, deletedAt cleared, status cancelled', async () => {
    await handler.execute(new CancelDeletionRequestCommand('req-1', RAW_TOKEN));

    expect(mockTx.accountDeletionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req-1' },
        data: expect.objectContaining({ status: DeletionStatus.cancelled, scheduledDeletionDate: null }),
      }),
    );
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { isActive: true, deletedAt: null },
    });
    expect(mockTx.participant.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { deletedAt: null },
    });
  });

  it('emits the cancelled confirmation email', async () => {
    await handler.execute(new CancelDeletionRequestCommand('req-1', RAW_TOKEN));

    expect(mockRabbitmqProducer.emit).toHaveBeenCalledWith('user.account-deletion-cancelled', expect.objectContaining({
      email: 'real.person@example.com',
    }));
  });

  it('rejects an unknown request id', async () => {
    mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue(null);

    await expect(handler.execute(new CancelDeletionRequestCommand('missing', RAW_TOKEN))).rejects.toThrow(BadRequestException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a wrong token', async () => {
    await expect(
      handler.execute(new CancelDeletionRequestCommand('req-1', 'b'.repeat(64))),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an expired token', async () => {
    mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue({
      ...approvedRequest,
      dataSnapshot: { ...approvedRequest.dataSnapshot, cancellationTokenExpiresAt: new Date(Date.now() - 1000).toISOString() },
    });

    await expect(handler.execute(new CancelDeletionRequestCommand('req-1', RAW_TOKEN))).rejects.toThrow(BadRequestException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('REFUSES PLAINLY after the purge has run — does not appear to succeed', async () => {
    mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue({ ...approvedRequest, status: DeletionStatus.completed });

    await expect(handler.execute(new CancelDeletionRequestCommand('req-1', RAW_TOKEN))).rejects.toThrow(
      /already been permanently deleted/,
    );
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockRabbitmqProducer.emit).not.toHaveBeenCalled();
  });

  it('is idempotent: cancelling an already-cancelled request reports success without re-running the restore', async () => {
    mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue({ ...approvedRequest, status: DeletionStatus.cancelled });

    const result = await handler.execute(new CancelDeletionRequestCommand('req-1', RAW_TOKEN));

    expect(result.message).toMatch(/already cancelled/);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a request that was already rejected (dead legacy state)', async () => {
    mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue({ ...approvedRequest, status: DeletionStatus.rejected });

    await expect(handler.execute(new CancelDeletionRequestCommand('req-1', RAW_TOKEN))).rejects.toThrow(BadRequestException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  // The cancel page renders four visually distinct states. It must classify them
  // on these codes, never on the prose - a reworded message would otherwise send
  // a successfully-restored account down the "invalid link" branch, silently.
  describe('machine-readable outcome codes', () => {
    const codeOf = async (fn: () => Promise<unknown>): Promise<string | undefined> => {
      try {
        const ok = (await fn()) as { code?: string };
        return ok?.code;
      } catch (error) {
        const body = (error as BadRequestException).getResponse();
        return typeof body === 'object' ? (body as { code?: string }).code : undefined;
      }
    };

    it('returns a distinct code for every outcome the cancel page renders', async () => {
      const restored = await codeOf(() => handler.execute(new CancelDeletionRequestCommand('req-1', RAW_TOKEN)));
      expect(restored).toBe(DELETION_CANCEL_CODES.restored);

      mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue(null);
      const invalid = await codeOf(() => handler.execute(new CancelDeletionRequestCommand('missing', RAW_TOKEN)));
      expect(invalid).toBe(DELETION_CANCEL_CODES.invalidLink);

      expect(new Set([restored, invalid]).size).toBe(2);
    });
  });
});
