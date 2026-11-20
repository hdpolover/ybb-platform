// services/api/src/modules/portal/application/commands/handlers/download-certificate.handler.spec.ts
import { DownloadCertificateHandler } from './download-certificate.handler';
import { DownloadCertificateCommand } from '../../queries/portal-queries';

jest.mock('@shared/utils/masked-file-url', () => ({
  resolveMaskedFileUrl: jest.fn(async (_p: unknown, url: string) => url),
}));

describe('DownloadCertificateHandler', () => {
  function build() {
    const prisma = {
      participantDocument: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'doc-1',
          name: 'Cert',
          fileUrl: 'https://cdn/x.pdf',
          fileType: 'pdf',
          downloadCount: 2,
          application: { participantId: 'part-1' },
        }),
        update: jest.fn(),
      },
    };
    const portalCache = { getParticipantProfile: jest.fn().mockResolvedValue({ id: 'part-1' }) };
    const cache = { invalidateKey: jest.fn() };
    const handler = new DownloadCertificateHandler(prisma as never, portalCache as never, cache as never);
    return { handler, prisma, cache };
  }

  it('counts the download for a normal participant session', async () => {
    const { handler, prisma, cache } = build();
    await handler.execute(new DownloadCertificateCommand('u1', 'doc-1'));
    expect(prisma.participantDocument.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { downloadCount: 3 },
    });
    expect(cache.invalidateKey).toHaveBeenCalled();
  });

  it('writes nothing in a read-only support view', async () => {
    const { handler, prisma, cache } = build();
    const res = await handler.execute(new DownloadCertificateCommand('u1', 'doc-1', true));
    expect(res.fileName).toBe('Cert.pdf');
    expect(prisma.participantDocument.update).not.toHaveBeenCalled();
    expect(cache.invalidateKey).not.toHaveBeenCalled();
  });
});
