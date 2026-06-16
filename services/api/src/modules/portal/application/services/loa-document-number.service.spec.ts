import { Test } from '@nestjs/testing';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { LoaDocumentNumberService } from './loa-document-number.service';

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
});
