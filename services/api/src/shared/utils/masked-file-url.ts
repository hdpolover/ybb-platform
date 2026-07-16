import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

const FILE_DOWNLOAD_URL_PATTERN =
  /\/v1\/files\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/download(?:[?#].*)?$/i;
const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function extractFileIdFromDownloadUrl(url: string): string | null {
  const match = FILE_DOWNLOAD_URL_PATTERN.exec(url);
  return match?.[1]?.toLowerCase() ?? null;
}

export function getMaskedDownloadUrl(fileId: string, baseUrl?: string): string {
  const base = (baseUrl ?? process.env.PUBLIC_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
  const path = `/v1/files/${fileId}/download`;
  return base ? `${base}${path}` : path;
}

export async function resolveFileIdFromRawUrl(prisma: PrismaService, url: string): Promise<string | null> {
  const existingMaskedId = extractFileIdFromDownloadUrl(url);
  if (existingMaskedId) {
    return existingMaskedId;
  }

  const uuidMatch = url.match(UUID_PATTERN)?.[0]?.toLowerCase() ?? null;
  if (uuidMatch) {
    const byId = await prisma.file.findUnique({
      where: { id: uuidMatch },
      select: { id: true },
    });
    if (byId?.id) {
      return byId.id.toLowerCase();
    }
  }

  const byUrl = await prisma.file.findFirst({
    where: { url },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  return byUrl?.id?.toLowerCase() ?? null;
}

export async function resolveMaskedFileUrl(prisma: PrismaService, url: string): Promise<string> {
  const fileId = await resolveFileIdFromRawUrl(prisma, url);
  if (!fileId) {
    return url;
  }

  return getMaskedDownloadUrl(fileId);
}

export async function buildFileUrlMaskMap(prisma: PrismaService, urls: string[]): Promise<Map<string, string>> {
  const sanitizedUrls = urls.filter((url) => typeof url === 'string' && url.trim().length > 0);
  if (sanitizedUrls.length === 0) {
    return new Map();
  }

  const idsFromMaskedUrl = sanitizedUrls
    .map((url) => extractFileIdFromDownloadUrl(url))
    .filter((id): id is string => Boolean(id));

  const idsFromRawUrl = sanitizedUrls
    .map((url) => url.match(UUID_PATTERN)?.[0]?.toLowerCase() ?? null)
    .filter((id): id is string => Boolean(id));

  const candidateIds = Array.from(new Set([...idsFromMaskedUrl, ...idsFromRawUrl]));

  const files = await prisma.file.findMany({
    where: {
      OR: [
        ...(candidateIds.length > 0 ? [{ id: { in: candidateIds } }] : []),
        { url: { in: sanitizedUrls } },
      ],
    },
    select: { id: true, url: true },
  });

  const maskMap = new Map<string, string>();
  for (const file of files) {
    const masked = getMaskedDownloadUrl(file.id.toLowerCase());
    if (typeof file.url === 'string' && file.url.length > 0) {
      maskMap.set(file.url, masked);
    }
    maskMap.set(file.id.toLowerCase(), masked);
  }

  return maskMap;
}
