import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

const FILE_DOWNLOAD_URL_PATTERN =
  /\/v1\/files\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/download(?:[?#].*)?$/i;
const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function extractFileIdFromDownloadUrl(url: string): string | null {
  const match = FILE_DOWNLOAD_URL_PATTERN.exec(url);
  return match?.[1]?.toLowerCase() ?? null;
}

/** First UUID appearing anywhere in the url (stored CDN urls use the file id as filename). */
export function extractFileUuidFromUrl(url: string): string | null {
  return url.match(UUID_PATTERN)?.[0]?.toLowerCase() ?? null;
}

/**
 * Hosts whose urls the mask lookup can ever resolve. Derived from config, never
 * hardcoded: FILE_CDN_HOSTS (comma-separated hosts or urls) plus the
 * PUBLIC_API_BASE_URL host so already-masked links stay candidates.
 *
 * When FILE_CDN_HOSTS is unset the allowlist is empty and every url stays a
 * candidate, i.e. the pre-existing behaviour. Set it to skip the files lookup
 * for the many responses that only carry third-party or marketing urls.
 */
let maskableHostsEnv: string | undefined;
let maskableHosts = new Set<string>();

function normalizeHost(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  const host = withoutScheme.split('/')[0].split('@').pop() ?? '';
  return host.replace(/:\d+$/, '') || null;
}

function getMaskableHosts(): Set<string> {
  const configured = process.env.FILE_CDN_HOSTS ?? '';
  const envKey = `${configured}|${process.env.PUBLIC_API_BASE_URL ?? ''}`;
  if (envKey !== maskableHostsEnv) {
    maskableHostsEnv = envKey;
    const hosts = new Set<string>();
    for (const entry of configured.split(',')) {
      const host = normalizeHost(entry);
      if (host) hosts.add(host);
    }
    if (hosts.size > 0) {
      const apiHost = normalizeHost(process.env.PUBLIC_API_BASE_URL ?? '');
      if (apiHost) hosts.add(apiHost);
    }
    maskableHosts = hosts;
  }
  return maskableHosts;
}

/** True when the url could plausibly resolve to a files row (see getMaskableHosts). */
export function isMaskableUrl(url: string): boolean {
  const hosts = getMaskableHosts();
  if (hosts.size === 0) return true;
  const absolute = /^https?:\/\//i.test(url);
  if (!absolute) return true; // relative /v1/files/<id>/download path
  const host = normalizeHost(url);
  return host !== null && hosts.has(host);
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

  const uuidMatch = extractFileUuidFromUrl(url);
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
    .map((url) => extractFileUuidFromUrl(url))
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
