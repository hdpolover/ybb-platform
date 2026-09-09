// Parity between the per-url resolver and the batched map resolver.
//
// M189 replaced a per-resource resolveMaskedFileUrl() call with one
// buildFileUrlMaskMap() plus resolveUrlFromMaskMap() per url. That is only a
// performance change if the two agree on every url shape, and nothing else
// pins them together - so this does.
import {
  buildFileUrlMaskMap,
  resolveMaskedFileUrl,
  resolveUrlFromMaskMap,
} from './masked-file-url';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

const FILE_ID = 'b2f1c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const OTHER_ID = 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5e';
const STORED_URL = `https://cdn.example.test/files/${FILE_ID}.pdf`;
const PLAIN_STORED_URL = 'https://cdn.example.test/files/brochure.pdf';

// One row keyed by id + url, matching what the real table holds.
const rows = [
  { id: FILE_ID, url: STORED_URL, createdAt: new Date('2026-01-01') },
  { id: OTHER_ID, url: PLAIN_STORED_URL, createdAt: new Date('2026-01-02') },
];

function makePrisma(): PrismaService {
  return {
    file: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const row = rows.find((r) => r.id === where.id);
        return row ? { id: row.id } : null;
      }),
      findFirst: jest.fn(async ({ where }: { where: { url: string } }) => {
        const matches = rows.filter((r) => r.url === where.url);
        return matches.length > 0 ? { id: matches[matches.length - 1].id } : null;
      }),
      findMany: jest.fn(async ({ where }: { where: { OR: Array<Record<string, unknown>> } }) => {
        const ids = new Set<string>();
        const urls = new Set<string>();
        for (const clause of where.OR) {
          const idClause = clause['id'] as { in?: string[] } | undefined;
          const urlClause = clause['url'] as { in?: string[] } | undefined;
          idClause?.in?.forEach((id) => ids.add(id));
          urlClause?.in?.forEach((url) => urls.add(url));
        }
        return rows
          .filter((r) => ids.has(r.id) || urls.has(r.url))
          .map((r) => ({ id: r.id, url: r.url }));
      }),
    },
  } as unknown as PrismaService;
}

describe('masked file url resolution', () => {
  const cases: Array<[string, string]> = [
    ['a stored cdn url whose filename is the file id', STORED_URL],
    ['a stored cdn url with no id in it', PLAIN_STORED_URL],
    ['an already-masked download url', `/v1/files/${FILE_ID}/download`],
    ['an already-masked absolute download url', `https://api.example.test/v1/files/${FILE_ID}/download`],
    ['a url containing an id that has no files row', 'https://cdn.example.test/files/ffffffff-1111-4222-8333-444444444444.pdf'],
    ['a url with no id and no matching row', 'https://cdn.example.test/files/unknown.pdf'],
  ];

  it.each(cases)('resolves %s identically through both paths', async (_label, url) => {
    const prisma = makePrisma();

    const perUrl = await resolveMaskedFileUrl(prisma, url);
    const maskMap = await buildFileUrlMaskMap(prisma, [url]);
    const batched = resolveUrlFromMaskMap(url, maskMap);

    expect(batched).toBe(perUrl);
  });

  it('builds one map covering every url in a batch', async () => {
    const prisma = makePrisma();
    const urls = cases.map(([, url]) => url);

    const maskMap = await buildFileUrlMaskMap(prisma, urls);

    // The whole point of M189: one query for the batch, not one per url.
    expect((prisma.file.findMany as jest.Mock)).toHaveBeenCalledTimes(1);

    for (const url of urls) {
      expect(resolveUrlFromMaskMap(url, maskMap)).toBe(await resolveMaskedFileUrl(prisma, url));
    }
  });
});
