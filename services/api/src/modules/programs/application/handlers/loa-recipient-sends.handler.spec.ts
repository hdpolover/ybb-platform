// src/modules/programs/application/handlers/loa-recipient-sends.handler.spec.ts
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetLoaBatchRecipientSendsHandler } from './loa-batch.handlers';
import { GetLoaBatchRecipientSendsQuery } from '../queries/loa-batch.queries';
import { LoaReleaseBatchRepository } from '../../infrastructure/persistence/loa-release-batch.repository';
import { LoaBatchRecipientSendRepository } from '../../infrastructure/persistence/loa-batch-recipient-send.repository';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

const batch = {
  id: 'batch-1',
  programId: 'prog-1',
  name: 'Wave 1',
  submissionFrom: new Date('2026-01-01'),
  submissionTo: new Date('2026-01-31'),
  releasedAt: new Date('2026-02-01'),
};

const sentRow = {
  participantId: 'p-1',
  email: 'ada@example.com',
  status: 'sent',
  providerMessageId: 'resend-1',
  errorMessage: null,
  attemptCount: 1,
  sentAt: new Date('2026-02-01'),
};

const failedRow = {
  participantId: 'p-2',
  email: 'bob@example.com',
  status: 'failed',
  providerMessageId: null,
  errorMessage: 'mailbox full',
  attemptCount: 1,
  sentAt: null,
};

describe('GetLoaBatchRecipientSendsHandler', () => {
  let handler: GetLoaBatchRecipientSendsHandler;
  let mockBatchRepo: any;
  let mockSendRepo: any;
  let mockPrisma: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GetLoaBatchRecipientSendsHandler,
        {
          provide: LoaReleaseBatchRepository,
          useValue: { findById: jest.fn().mockResolvedValue(batch) },
        },
        {
          provide: LoaBatchRecipientSendRepository,
          useValue: { findByBatch: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: PrismaService,
          useValue: {
            participant: { findMany: jest.fn().mockResolvedValue([]) },
            loaReleaseBatch: { findMany: jest.fn().mockResolvedValue([]) },
            participantApplication: {
              count: jest.fn().mockResolvedValue(0),
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
      ],
    }).compile();

    handler = module.get(GetLoaBatchRecipientSendsHandler);
    mockBatchRepo = module.get(LoaReleaseBatchRepository);
    mockSendRepo = module.get(LoaBatchRecipientSendRepository);
    mockPrisma = module.get(PrismaService);
  });

  const run = () =>
    handler.execute(new GetLoaBatchRecipientSendsQuery('prog-1', 'batch-1'));

  it('throws NotFound for a batch belonging to another program', async () => {
    mockBatchRepo.findById.mockResolvedValue({ ...batch, programId: 'other-prog' });
    await expect(run()).rejects.toThrow(NotFoundException);
  });

  it('summarises sent and failed counts and lists every recipient', async () => {
    mockSendRepo.findByBatch.mockResolvedValue([sentRow, failedRow]);
    mockPrisma.participant.findMany.mockResolvedValue([
      { id: 'p-1', fullName: 'Ada Lovelace' },
      { id: 'p-2', fullName: 'Bob Stone' },
    ]);

    const result = await run();

    expect(result.summary).toEqual({ total: 2, pending: 0, sent: 1, failed: 1 });
    expect(result.hasSendLog).toBe(true);
    expect(result.recipients).toEqual([
      expect.objectContaining({
        participantId: 'p-1',
        participantName: 'Ada Lovelace',
        status: 'sent',
        providerMessageId: 'resend-1',
      }),
      expect.objectContaining({
        participantId: 'p-2',
        participantName: 'Bob Stone',
        status: 'failed',
        errorMessage: 'mailbox full',
      }),
    ]);
  });

  it('counts pending rows separately from sent — an unreported send is not a success', async () => {
    mockSendRepo.findByBatch.mockResolvedValue([
      { ...sentRow, status: 'pending', providerMessageId: null, sentAt: null },
      sentRow,
    ]);

    const result = await run();

    expect(result.summary).toEqual({ total: 2, pending: 1, sent: 1, failed: 0 });
  });

  it('reports hasSendLog false for a batch released before the log existed', async () => {
    mockSendRepo.findByBatch.mockResolvedValue([]);

    const result = await run();

    expect(result.hasSendLog).toBe(false);
    expect(result.summary).toEqual({ total: 0, pending: 0, sent: 0, failed: 0 });
    expect(result.recipients).toEqual([]);
  });

  it('falls back to the mailed address when the participant name is still blank', async () => {
    mockSendRepo.findByBatch.mockResolvedValue([sentRow]);
    mockPrisma.participant.findMany.mockResolvedValue([{ id: 'p-1', fullName: '' }]);

    const result = await run();

    expect(result.recipients[0].participantName).toBe('ada@example.com');
  });

  describe('uncovered participants (silent-exclusion blind spot)', () => {
    const releasedBatch = {
      id: 'batch-1',
      name: 'Wave 1',
      submissionFrom: batch.submissionFrom,
      submissionTo: batch.submissionTo,
      releasedAt: new Date('2026-02-01'),
    };
    const unreleasedBatch = {
      id: 'batch-2',
      name: 'Wave 2 (draft)',
      submissionFrom: new Date('2026-04-01'),
      submissionTo: new Date('2026-08-20'),
      releasedAt: null,
    };

    it('excludes every released batch window from the uncovered set', async () => {
      mockPrisma.loaReleaseBatch.findMany.mockResolvedValue([releasedBatch]);
      mockPrisma.participantApplication.count.mockResolvedValue(7);

      const result = await run();

      expect(result.uncoveredParticipantCount).toBe(7);
      expect(mockPrisma.participantApplication.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          programId: 'prog-1',
          status: { in: ['submitted', 'accepted'] },
          deletedAt: null,
          submittedAt: { not: null },
          NOT: {
            OR: [
              {
                submittedAt: {
                  gte: releasedBatch.submissionFrom,
                  lte: releasedBatch.submissionTo,
                },
              },
            ],
          },
        }),
      });
    });

    it('ignores UNRELEASED batches when deciding coverage — a draft batch notifies nobody', async () => {
      mockPrisma.loaReleaseBatch.findMany.mockResolvedValue([releasedBatch, unreleasedBatch]);
      mockPrisma.participantApplication.count.mockResolvedValue(1);

      await run();

      const uncoveredWhere = mockPrisma.participantApplication.count.mock.calls[0][0].where;
      expect(uncoveredWhere.NOT.OR).toEqual([
        {
          submittedAt: {
            gte: releasedBatch.submissionFrom,
            lte: releasedBatch.submissionTo,
          },
        },
      ]);
    });

    it('excludes deactivated accounts, which are never mailed anyway', async () => {
      await run();

      const where = mockPrisma.participantApplication.count.mock.calls[0][0].where;
      expect(where.participant).toEqual({
        deletedAt: null,
        user: { isActive: true, deletedAt: null },
      });
    });

    it('applies no window exclusion when the program has no released batch at all', async () => {
      mockPrisma.loaReleaseBatch.findMany.mockResolvedValue([unreleasedBatch]);
      mockPrisma.participantApplication.count.mockResolvedValue(42);

      const result = await run();

      expect(result.uncoveredParticipantCount).toBe(42);
      expect(
        mockPrisma.participantApplication.count.mock.calls[0][0].where.NOT,
      ).toBeUndefined();
    });

    it('lists the uncovered participants so an admin can act on them', async () => {
      mockPrisma.loaReleaseBatch.findMany.mockResolvedValue([releasedBatch]);
      mockPrisma.participantApplication.count.mockResolvedValue(1);
      mockPrisma.participantApplication.findMany.mockResolvedValue([
        {
          id: 'app-9',
          submittedAt: new Date('2026-08-28'),
          participant: {
            id: 'p-9',
            fullName: 'Wei Chen',
            user: { email: 'wei@example.com' },
          },
        },
      ]);

      const result = await run();

      expect(result.uncoveredParticipants).toEqual([
        {
          applicationId: 'app-9',
          participantId: 'p-9',
          participantName: 'Wei Chen',
          email: 'wei@example.com',
          submittedAt: new Date('2026-08-28'),
        },
      ]);
    });

    it('caps the listed participants at 100, earliest submission first', async () => {
      await run();

      const listArgs = mockPrisma.participantApplication.findMany.mock.calls[0][0];
      expect(listArgs.take).toBe(100);
      expect(listArgs.orderBy).toEqual({ submittedAt: 'asc' });
    });

    it('falls back to the email when an uncovered participant has no name yet', async () => {
      mockPrisma.participantApplication.findMany.mockResolvedValue([
        {
          id: 'app-9',
          submittedAt: new Date('2026-08-28'),
          participant: { id: 'p-9', fullName: '', user: { email: 'wei@example.com' } },
        },
      ]);

      const result = await run();

      expect(result.uncoveredParticipants[0].participantName).toBe('wei@example.com');
    });

    it('flags how many uncovered applicants an existing unreleased batch would cover', async () => {
      mockPrisma.loaReleaseBatch.findMany.mockResolvedValue([releasedBatch, unreleasedBatch]);
      mockPrisma.participantApplication.count
        .mockResolvedValueOnce(5) // uncovered total
        .mockResolvedValueOnce(3); // of those, inside the unreleased window

      const result = await run();

      expect(result.coveredByUnreleasedBatchCount).toBe(3);
      expect(result.unreleasedBatchNames).toEqual(['Wave 2 (draft)']);
      expect(mockPrisma.participantApplication.count).toHaveBeenLastCalledWith({
        where: expect.objectContaining({
          OR: [
            {
              submittedAt: {
                gte: unreleasedBatch.submissionFrom,
                lte: unreleasedBatch.submissionTo,
              },
            },
          ],
        }),
      });
    });

    it('does not run the unreleased-coverage count when there is no unreleased batch', async () => {
      mockPrisma.loaReleaseBatch.findMany.mockResolvedValue([releasedBatch]);
      mockPrisma.participantApplication.count.mockResolvedValue(2);

      const result = await run();

      expect(result.coveredByUnreleasedBatchCount).toBe(0);
      expect(result.unreleasedBatchNames).toEqual([]);
      expect(mockPrisma.participantApplication.count).toHaveBeenCalledTimes(1);
    });

    it('names no unreleased batch when none of the uncovered fall inside it', async () => {
      mockPrisma.loaReleaseBatch.findMany.mockResolvedValue([releasedBatch, unreleasedBatch]);
      mockPrisma.participantApplication.count
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(0);

      const result = await run();

      expect(result.coveredByUnreleasedBatchCount).toBe(0);
      expect(result.unreleasedBatchNames).toEqual([]);
    });
  });
});
