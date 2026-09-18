/**
 * Unit tests for GetDocumentReviewQueueHandler.
 *
 * Covers the two things this handler must never get wrong: the ordering
 * clause (never updatedAt, nulls fall back to generated_at deterministically)
 * and the file url resolution (never the raw stored url when a private
 * presign fails, never /v1/files/:id/download).
 */

import { GetDocumentReviewQueueHandler } from './get-document-review-queue.handler';
import { GetDocumentReviewQueueQuery } from '../get-document-review-queue.query';
import { PRIVATE_FILE_UNAVAILABLE } from '@modules/files/application/private-file-url-resolver.service';

function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    applicationId: 'app-1',
    name: 'Agreement Letter',
    submissionStatus: 'uploaded',
    submissionNote: null,
    signedCopyUrl: 'https://cdn.example.com/signed-copies/doc-1.pdf',
    signedCopyUploadedAt: new Date('2026-01-01T00:00:00.000Z'),
    generatedAt: new Date('2025-12-01T00:00:00.000Z'),
    reviewedBy: null,
    reviewedAt: null,
    reviewer: null,
    application: {
      program: { name: 'YBB Program' },
      participant: { fullName: 'Jane Doe', user: { email: 'jane@example.com' } },
    },
    ...overrides,
  };
}

describe('GetDocumentReviewQueueHandler', () => {
  it('orders by signedCopyUploadedAt asc with nulls last, then generatedAt, then id, never updatedAt', async () => {
    const row = buildRow();
    const prisma = {
      participantDocument: {
        findMany: jest.fn().mockResolvedValue([row]),
        count: jest.fn().mockResolvedValue(1),
      },
      file: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const privateFileUrlResolver = { resolve: jest.fn().mockResolvedValue(null) };

    const handler = new GetDocumentReviewQueueHandler(prisma as never, privateFileUrlResolver as never);
    await handler.execute(new GetDocumentReviewQueueQuery('prog-1', 'uploaded', 20, 0));

    const call = prisma.participantDocument.findMany.mock.calls[0][0];
    expect(call.orderBy).toEqual([
      { signedCopyUploadedAt: { sort: 'asc', nulls: 'last' } },
      { generatedAt: 'asc' },
      { id: 'asc' },
    ]);
    expect(JSON.stringify(call.orderBy)).not.toContain('updatedAt');
    expect(call.where).toMatchObject({
      type: 'agreement_letter',
      deletedAt: null,
      submissionStatus: 'uploaded',
      application: { programId: 'prog-1' },
    });
  });

  it('omits the url when a private file fails to presign, instead of falling back to the raw stored url', async () => {
    const row = buildRow();
    const prisma = {
      participantDocument: {
        findMany: jest.fn().mockResolvedValue([row]),
        count: jest.fn().mockResolvedValue(1),
      },
      file: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const privateFileUrlResolver = { resolve: jest.fn().mockResolvedValue(PRIVATE_FILE_UNAVAILABLE) };

    const handler = new GetDocumentReviewQueueHandler(prisma as never, privateFileUrlResolver as never);
    const result = await handler.execute(new GetDocumentReviewQueueQuery('prog-1', 'uploaded', 20, 0));

    expect(result.items[0].signedCopyUrl).toBeNull();
  });

  it('uses a fresh presigned url for a private-category document', async () => {
    const row = buildRow();
    const prisma = {
      participantDocument: {
        findMany: jest.fn().mockResolvedValue([row]),
        count: jest.fn().mockResolvedValue(1),
      },
      file: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const privateFileUrlResolver = { resolve: jest.fn().mockResolvedValue('https://presigned.example.com/x') };

    const handler = new GetDocumentReviewQueueHandler(prisma as never, privateFileUrlResolver as never);
    const result = await handler.execute(new GetDocumentReviewQueueQuery('prog-1', 'uploaded', 20, 0));

    expect(result.items[0].signedCopyUrl).toBe('https://presigned.example.com/x');
  });

  it('maps participant, program and reviewer fields onto each item', async () => {
    const row = buildRow({
      reviewedBy: 'admin-1',
      reviewedAt: new Date('2026-02-01T00:00:00.000Z'),
      reviewer: { fullName: 'Admin One' },
      submissionStatus: 'approved',
    });
    const prisma = {
      participantDocument: {
        findMany: jest.fn().mockResolvedValue([row]),
        count: jest.fn().mockResolvedValue(1),
      },
      file: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const privateFileUrlResolver = { resolve: jest.fn().mockResolvedValue(null) };

    const handler = new GetDocumentReviewQueueHandler(prisma as never, privateFileUrlResolver as never);
    const result = await handler.execute(new GetDocumentReviewQueueQuery('prog-1', 'approved', 20, 0));

    expect(result.items[0]).toMatchObject({
      participantName: 'Jane Doe',
      participantEmail: 'jane@example.com',
      programName: 'YBB Program',
      reviewedByName: 'Admin One',
      submissionStatus: 'approved',
    });
    expect(result.total).toBe(1);
  });
});
