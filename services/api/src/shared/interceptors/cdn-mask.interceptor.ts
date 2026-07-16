import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { from } from 'rxjs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { buildFileUrlMaskMap } from '@shared/utils/masked-file-url';

const PRESIGNED_UPLOAD_FIELDS = new Set([
  'upload_url',
  'uploadUrl',
  'presigned_upload_url',
  'presignedUploadUrl',
]);

function isPresignedStorageUrl(url: string): boolean {
  return /[?&]X-Amz-Algorithm=/i.test(url) || /[?&]X-Amz-Signature=/i.test(url);
}

function isMaskCandidate(value: string): boolean {
  return /^https?:\/\//i.test(value) || /\/v1\/files\/[0-9a-f-]{36}\/download/i.test(value);
}

function collectMaskCandidates(value: unknown, output: Set<string>, parentKey?: string): void {
  if (typeof value === 'string') {
    if (
      (parentKey && PRESIGNED_UPLOAD_FIELDS.has(parentKey)) ||
      isPresignedStorageUrl(value) ||
      !isMaskCandidate(value)
    ) {
      return;
    }
    output.add(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectMaskCandidates(item, output, parentKey);
    }
    return;
  }

  if (Buffer.isBuffer(value)) return;
  if (value && typeof (value as { getStream?: unknown }).getStream === 'function') return;
  if (value && typeof (value as { pipe?: unknown }).pipe === 'function') return;
  if (value instanceof Date) return;

  if (value !== null && typeof value === 'object' && isPlainObject(value)) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      collectMaskCandidates(v, output, k);
    }
  }
}

function applyMaskMap(value: unknown, maskMap: Map<string, string>, parentKey?: string): unknown {
  if (typeof value === 'string') {
    // Never rewrite signed storage URLs used for direct-to-storage uploads.
    if (
      (parentKey && PRESIGNED_UPLOAD_FIELDS.has(parentKey)) ||
      isPresignedStorageUrl(value)
    ) {
      return value;
    }
    return maskMap.get(value) ?? value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => applyMaskMap(item, maskMap, parentKey));
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
        applyMaskMap(v, maskMap, k),
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
  constructor(private readonly prisma: PrismaService) {}

  private async maskUrls(value: unknown): Promise<unknown> {
    const candidates = new Set<string>();
    collectMaskCandidates(value, candidates);
    if (candidates.size === 0) {
      return value;
    }

    const maskMap = await buildFileUrlMaskMap(this.prisma, Array.from(candidates));
    if (maskMap.size === 0) {
      return value;
    }

    return applyMaskMap(value, maskMap);
  }

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(mergeMap((data) => from(this.maskUrls(data))));
  }
}
