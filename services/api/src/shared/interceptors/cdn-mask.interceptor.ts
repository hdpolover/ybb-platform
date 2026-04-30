import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Matches storage/CDN URLs with UUID filenames across known public asset hosts.
// We keep these URLs direct so modules can open documents without relying on
// a proxy resolver that may not map filename UUIDs to file IDs.
const UUID_FILE_RE =
  /https?:\/\/(?:cdn\.ybbhub\.com|files\.ybbhub\.com|storage\.ybbfoundation\.com|[a-z0-9.-]+\.digitaloceanspaces\.com)\/[^\s"'>]+\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([a-z0-9]+)(?:\?[^\s"'>]*)?/gi;

const DIRECT_MEDIA_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'avif',
  'svg',
  'bmp',
  'ico',
  'tif',
  'tiff',
  'heic',
  'heif',
  'mp4',
  'webm',
  'mov',
  'm4v',
  'mkv',
  'avi',
  'mp3',
  'wav',
  'ogg',
  'oga',
  'flac',
  'aac',
  'm4a',
  'opus',
]);

const PRESIGNED_UPLOAD_FIELDS = new Set([
  'upload_url',
  'uploadUrl',
  'presigned_upload_url',
  'presignedUploadUrl',
]);

function isPresignedStorageUrl(url: string): boolean {
  return /[?&]X-Amz-Algorithm=/i.test(url) || /[?&]X-Amz-Signature=/i.test(url);
}

function maskUrls(value: unknown, apiBase: string, parentKey?: string): unknown {
  if (typeof value === 'string') {
    // Never rewrite signed storage URLs used for direct-to-storage uploads.
    if (
      (parentKey && PRESIGNED_UPLOAD_FIELDS.has(parentKey)) ||
      isPresignedStorageUrl(value)
    ) {
      return value;
    }
    return value.replace(UUID_FILE_RE, (match, _fileId: string, ext: string) => {
      if (DIRECT_MEDIA_EXTENSIONS.has(ext.toLowerCase())) {
        return match;
      }
      return match;
    });
  }
  if (Array.isArray(value)) {
    return value.map((item) => maskUrls(item, apiBase, parentKey));
  }
  // Don't traverse Buffers, streams, or StreamableFile-shaped objects — recursing
  // through them via Object.entries breaks binary downloads (collapses streams to
  // plain objects which then get JSON-serialized).
  if (Buffer.isBuffer(value)) return value;
  if (value && typeof (value as { getStream?: unknown }).getStream === 'function') {
    return value;
  }
  if (value && typeof (value as { pipe?: unknown }).pipe === 'function') {
    return value;
  }
  if (value !== null && typeof value === 'object') {
    // Preserve Date and other non-plain objects to avoid collapsing values
    // like Date -> {} when traversed via Object.entries.
    if (value instanceof Date) {
      return value;
    }
    if (!isPlainObject(value)) {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        maskUrls(v, apiBase, k),
      ]),
    );
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

@Injectable()
export class CdnMaskInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      get: (header: string) => string | undefined;
      protocol?: string;
    }>();

    const proto =
      (req.get('x-forwarded-proto') ?? req.protocol ?? 'https').split(',')[0].trim();
    const host = req.get('host') ?? 'localhost';
    const apiBase = `${proto}://${host}`;

    return next.handle().pipe(map((data) => maskUrls(data, apiBase)));
  }
}
