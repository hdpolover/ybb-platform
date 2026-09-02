import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { from } from 'rxjs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { buildFileUrlMaskMap, isMaskableUrl } from '@shared/utils/masked-file-url';

// url -> masked-url cache. Misses are cached as MASK_MISS so a response full of
// non-file urls stops hitting the (unindexed) files lookup on every request.
const MASK_CACHE_TTL_MS = 5 * 60 * 1000;
const MASK_MISS = '';

function maskCacheKey(url: string): string {
  return `cdnmask:url:${createHash('sha1').update(url).digest('hex')}`;
}

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
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cache?: CacheService,
  ) {}

  private async maskUrls(value: unknown): Promise<unknown> {
    const collected = new Set<string>();
    collectMaskCandidates(value, collected);
    // Skip the files lookup entirely for responses whose urls can't live on our
    // storage/CDN hosts (see isMaskableUrl — allowlist comes from config).
    const candidates = Array.from(collected).filter(isMaskableUrl);
    if (candidates.length === 0) {
      return value;
    }

    const maskMap = new Map<string, string>();
    const unresolved: string[] = [];

    const cached = await Promise.all(
      candidates.map((url) => this.cache?.get<string>(maskCacheKey(url)) ?? Promise.resolve(undefined)),
    );
    candidates.forEach((url, index) => {
      const hit = cached[index];
      if (hit === undefined || hit === null) {
        unresolved.push(url);
        return;
      }
      if (hit !== MASK_MISS) {
        maskMap.set(url, hit);
      }
    });

    if (unresolved.length > 0) {
      const fresh = await buildFileUrlMaskMap(this.prisma, unresolved);
      for (const [key, masked] of fresh) {
        maskMap.set(key, masked);
      }
      if (this.cache) {
        await Promise.all(
          unresolved.map((url) =>
            this.cache!.set(maskCacheKey(url), fresh.get(url) ?? MASK_MISS, MASK_CACHE_TTL_MS),
          ),
        );
      }
    }

    if (maskMap.size === 0) {
      return value;
    }

    return applyMaskMap(value, maskMap);
  }

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(mergeMap((data) => from(this.maskUrls(data))));
  }
}
