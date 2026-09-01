// src/modules/programs/infrastructure/persistence/loa-batch-recipient-send.repository.spec.ts
import {
  LoaBatchRecipientSendRepository,
  truncateSendError,
  MAX_SEND_ERROR_LENGTH,
} from './loa-batch-recipient-send.repository';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

const recipients = [
  { participantId: 'p-1', userId: 'u-1', email: 'ada@example.com', fullName: 'Ada' },
  { participantId: 'p-2', userId: 'u-2', email: 'bob@example.com', fullName: 'Bob' },
];

describe('LoaBatchRecipientSendRepository', () => {
  let createMany: jest.Mock;
  let updateMany: jest.Mock;
  let repo: LoaBatchRecipientSendRepository;

  beforeEach(() => {
    createMany = jest.fn().mockResolvedValue({ count: 2 });
    updateMany = jest.fn().mockResolvedValue({ count: 0 });
    repo = new LoaBatchRecipientSendRepository({
      loaBatchRecipientSend: { createMany, updateMany },
    } as unknown as PrismaService);
  });

  describe('markPending', () => {
    it('inserts one pending row per recipient, skipping duplicates', async () => {
      await repo.markPending('batch-1', 'prog-1', recipients);

      expect(createMany).toHaveBeenCalledWith({
        data: [
          {
            batchId: 'batch-1',
            programId: 'prog-1',
            participantId: 'p-1',
            userId: 'u-1',
            email: 'ada@example.com',
            status: 'pending',
          },
          {
            batchId: 'batch-1',
            programId: 'prog-1',
            participantId: 'p-2',
            userId: 'u-2',
            email: 'bob@example.com',
            status: 'pending',
          },
        ],
        skipDuplicates: true,
      });
    });

    it('resets an already-recorded outcome on re-release instead of appending a second row', async () => {
      await repo.markPending('batch-1', 'prog-1', recipients);

      // skipDuplicates above leaves existing rows untouched, so a stale
      // `sent` must be cleared explicitly or the UI keeps reporting the
      // previous release's outcome while a new attempt is in flight.
      expect(updateMany).toHaveBeenCalledWith({
        where: {
          batchId: 'batch-1',
          participantId: { in: ['p-1', 'p-2'] },
          status: { not: 'pending' },
        },
        data: {
          status: 'pending',
          providerMessageId: null,
          errorMessage: null,
          sentAt: null,
        },
      });
    });

    it('does nothing for an empty recipient list', async () => {
      await repo.markPending('batch-1', 'prog-1', []);

      expect(createMany).not.toHaveBeenCalled();
      expect(updateMany).not.toHaveBeenCalled();
    });
  });

  describe('recordResult', () => {
    it('marks a success as sent, stamps sentAt and clears any prior error', async () => {
      await repo.recordResult({
        batchId: 'batch-1',
        participantId: 'p-1',
        providerMessageId: 'resend-1',
        error: null,
      });

      const call = updateMany.mock.calls[0][0];
      expect(call.where).toEqual({ batchId: 'batch-1', participantId: 'p-1' });
      expect(call.data.status).toBe('sent');
      expect(call.data.providerMessageId).toBe('resend-1');
      expect(call.data.errorMessage).toBeNull();
      expect(call.data.sentAt).toBeInstanceOf(Date);
      expect(call.data.attemptCount).toEqual({ increment: 1 });
    });

    it('marks a failure as failed, keeps sentAt null and stores the error', async () => {
      await repo.recordResult({
        batchId: 'batch-1',
        participantId: 'p-2',
        providerMessageId: null,
        error: 'mailbox full',
      });

      const { data } = updateMany.mock.calls[0][0];
      expect(data.status).toBe('failed');
      expect(data.errorMessage).toBe('mailbox full');
      expect(data.sentAt).toBeNull();
    });

    it('increments attemptCount so a retried recipient is distinguishable', async () => {
      await repo.recordResult({
        batchId: 'batch-1',
        participantId: 'p-1',
        providerMessageId: null,
        error: 'timeout',
      });

      expect(updateMany.mock.calls[0][0].data.attemptCount).toEqual({ increment: 1 });
    });

    it('uses updateMany so a result for a batch with no logged row is a no-op, not a throw', async () => {
      updateMany.mockResolvedValue({ count: 0 });

      await expect(
        repo.recordResult({
          batchId: 'unknown-batch',
          participantId: 'p-9',
          providerMessageId: null,
          error: null,
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('truncateSendError', () => {
    it('leaves a short message untouched', () => {
      expect(truncateSendError('mailbox full')).toBe('mailbox full');
    });

    it('caps an oversized provider stack trace', () => {
      const truncated = truncateSendError('x'.repeat(2000));
      expect(truncated).toHaveLength(MAX_SEND_ERROR_LENGTH);
      expect(truncated.endsWith('…')).toBe(true);
    });
  });
});
