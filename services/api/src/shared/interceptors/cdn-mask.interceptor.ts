import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Matches CDN file URLs where the filename is a UUID (documents, PDFs, etc.)
// Does NOT match image files whose filenames are not UUIDs.
const UUID_FILE_RE =
  /https:\/\/cdn\.ybbhub\.com\/[^\s"'>]+\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.[a-z0-9]+/gi;

function maskUrls(value: unknown, apiBase: string): unknown {
  if (typeof value === 'string') {
    return value.replace(UUID_FILE_RE, (_match, fileId: string) =>
      `${apiBase}/v1/files/${fileId}/download`,
    );
  }
  if (Array.isArray(value)) {
    return value.map((item) => maskUrls(item, apiBase));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        maskUrls(v, apiBase),
      ]),
    );
  }
  return value;
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
