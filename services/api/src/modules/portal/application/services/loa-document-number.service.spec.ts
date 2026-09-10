import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { LoaDocumentNumberService } from './loa-document-number.service';

function p2002(targetFields: string[]): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    `Unique constraint failed on the fields: (${targetFields.map((f) => `\`${f}\``).join(', ')})`,
    { code: 'P2002', clientVersion: 'test', meta: { target: targetFields } },
  );
}

describe('LoaDocumentNumberService', () => {
  let service: LoaDocumentNumberService;
  let prisma: jest.Mocked<{ participantDocument: any }>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LoaDocumentNumberService,
        {
          provide: PrismaService,
          useValue: {
            participantDocument: {
              findFirst: jest.fn(),
              count: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();
    service = module.get(LoaDocumentNumberService);
    prisma = module.get(PrismaService) as any;
  });

  it('returns existing documentNumber when LOA row already exists for application', async () => {
    prisma.participantDocument.findFirst.mockResolvedValue({
      id: 'doc-1',
      documentNumber: 'LOA-YBB2026-0001',
    });
    const result = await service.assignOrGet('app-1', 'prog-1', 'YBB2026', 'tmpl-loa-1');
    expect(result).toEqual({ docNumber: 'LOA-YBB2026-0001', isNew: false, existingDocId: 'doc-1' });
    expect(prisma.participantDocument.count).not.toHaveBeenCalled();
  });

  it('assigns a new document number (0001) when no LOA row exists and program has no existing LOAs', async () => {
    prisma.participantDocument.findFirst.mockResolvedValue(null);
    prisma.participantDocument.count.mockResolvedValue(0);
    prisma.participantDocument.create.mockResolvedValue({
      id: 'doc-new',
      documentNumber: 'LOA-YBB2026-0001',
    });
    const result = await service.assignOrGet('app-1', 'prog-1', 'YBB2026', 'tmpl-loa-1');
    expect(result.docNumber).toBe('LOA-YBB2026-0001');
    expect(result.isNew).toBe(true);
  });

  it('sets templateId on the created ParticipantDocument row', async () => {
    prisma.participantDocument.findFirst.mockResolvedValue(null);
    prisma.participantDocument.count.mockResolvedValue(0);
    prisma.participantDocument.create.mockResolvedValue({
      id: 'doc-new',
      documentNumber: 'LOA-YBB2026-0001',
    });
    await service.assignOrGet('app-1', 'prog-1', 'YBB2026', 'tmpl-loa-1');
    expect(prisma.participantDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ templateId: 'tmpl-loa-1' }),
      }),
    );
  });

  it('assigns a sequential document number when other LOAs already exist', async () => {
    prisma.participantDocument.findFirst.mockResolvedValue(null);
    prisma.participantDocument.count.mockResolvedValue(5);
    prisma.participantDocument.create.mockResolvedValue({
      id: 'doc-new',
      documentNumber: 'LOA-YBB2026-0006',
    });
    const result = await service.assignOrGet('app-1', 'prog-1', 'YBB2026', 'tmpl-loa-1');
    expect(result.docNumber).toBe('LOA-YBB2026-0006');
  });

  // Audit M62: the partial unique index on participant_documents.document_number
  // is the actual uniqueness guarantee; this retry is what lets a collision there
  // (two concurrent first-calls for the same programCode racing on `count`, or -
  // before the M62 caller fix - two different programmes sharing a programCode)
  // succeed on a later attempt instead of 500ing.
  it('retries with the next padded number when document_number collides (P2002)', async () => {
    prisma.participantDocument.findFirst.mockResolvedValue(null);
    prisma.participantDocument.count.mockResolvedValue(0);
    prisma.participantDocument.create
      .mockRejectedValueOnce(p2002(['document_number']))
      .mockResolvedValueOnce({ id: 'doc-new', documentNumber: 'LOA-YBB2026-0002' });

    const result = await service.assignOrGet('app-1', 'prog-1', 'YBB2026', 'tmpl-loa-1');

    expect(result).toEqual({ docNumber: 'LOA-YBB2026-0002', isNew: true, existingDocId: 'doc-new' });
    expect(prisma.participantDocument.create).toHaveBeenCalledTimes(2);
    expect(prisma.participantDocument.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: expect.objectContaining({ documentNumber: 'LOA-YBB2026-0002' }) }),
    );
  });

  it('gives up and rethrows after MAX_ASSIGN_ATTEMPTS consecutive document_number collisions', async () => {
    prisma.participantDocument.findFirst.mockResolvedValue(null);
    prisma.participantDocument.count.mockResolvedValue(0);
    const conflict = p2002(['document_number']);
    prisma.participantDocument.create.mockRejectedValue(conflict);

    await expect(service.assignOrGet('app-1', 'prog-1', 'YBB2026', 'tmpl-loa-1')).rejects.toThrow(conflict);
    expect(prisma.participantDocument.create).toHaveBeenCalledTimes(5);
  });

  it('does not retry and rethrows immediately on a P2002 for an unrelated constraint', async () => {
    prisma.participantDocument.findFirst.mockResolvedValue(null);
    prisma.participantDocument.count.mockResolvedValue(0);
    const conflict = p2002(['legacy_id']);
    prisma.participantDocument.create.mockRejectedValue(conflict);

    await expect(service.assignOrGet('app-1', 'prog-1', 'YBB2026', 'tmpl-loa-1')).rejects.toThrow(conflict);
    expect(prisma.participantDocument.create).toHaveBeenCalledTimes(1);
  });
});
