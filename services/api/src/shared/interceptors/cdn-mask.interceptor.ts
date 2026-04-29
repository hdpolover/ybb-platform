import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Matches storage/CDN URLs with UUID filenames across known public asset hosts.
// Documents/downloadables are masked to the authenticated proxy URL, while
// renderable media assets remain direct for frontend rendering.
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

function maskUrls(value: unknown, apiBase: string): unknown {
  if (typeof value === 'string') {
    return value.replace(UUID_FILE_RE, (match, fileId: string, ext: string) => {
      if (DIRECT_MEDIA_EXTENSIONS.has(ext.toLowerCase())) {
        return match;
      }
      return `${apiBase}/v1/files/${fileId}/download`;
    });
  }
  if (Array.isArray(value)) {
    return value.map((item) => maskUrls(item, apiBase));
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
        maskUrls(v, apiBase),
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
