import { GetLoaStatusHandler, GetLoaStatusQuery } from './get-loa-status.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('GetLoaStatusHandler', () => {
  it('returns per-participant LoA status rows', async () => {
    const mockDocs = [
      {
        id: 'doc-1',
        documentNumber: 'LOA-2026-000001',
        generatedAt: new Date('2026-06-15T10:00:00Z'),
        emailedAt: new Date('2026-06-15T10:01:00Z'),
        fileUrl: 'https://cdn.ybb.io/docs/loa-1.pdf',
        application: {
          participant: {
            id: 'user-1',
            fullName: 'Jane Doe',
            user: { email: 'jane@example.com' },
          },
        },
      },
    ];
    const prisma = {
      participantDocument: {
        findMany: jest.fn().mockResolvedValue(mockDocs),
      },
    } as unknown as PrismaService;

    const handler = new GetLoaStatusHandler(prisma);
    const result = await handler.execute(new GetLoaStatusQuery('tmpl-1', 'prog-1'));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      participantId: 'user-1',
      participantName: 'Jane Doe',
      email: 'jane@example.com',
      documentNumber: 'LOA-2026-000001',
      status: 'emailed',
    });
  });
});
