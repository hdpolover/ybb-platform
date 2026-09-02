import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { CdnMaskInterceptor } from './cdn-mask.interceptor';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';

describe('CdnMaskInterceptor', () => {
  const prismaMock = {
    file: {
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;
  const interceptor = new CdnMaskInterceptor(prismaMock);

  // In-memory stand-in for the Redis-backed CacheService.
  const makeCache = () => {
    const store = new Map<string, unknown>();
    return {
      get: jest.fn(async (key: string) => store.get(key)),
      set: jest.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
    } as unknown as CacheService;
  };

  const makeContext = (): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          get: (header: string) => {
            if (header === 'x-forwarded-proto') return 'https';
            if (header === 'host') return 'api.ybbhub.com';
            return undefined;
          },
          protocol: 'http',
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    // reset (not clear) so an unconsumed mockResolvedValueOnce from a test whose
    // urls never reached the DB can't leak into the next test's queue.
    jest.resetAllMocks();
  });

  it('preserves Date values while masking file URLs', async () => {
    const createdAt = new Date('2026-04-29T00:00:00.000Z');
    (prismaMock.file.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        url: 'https://cdn.ybbhub.com/uploads/123e4567-e89b-12d3-a456-426614174000.pdf',
      },
    ]);

    const handler: CallHandler = {
      handle: () =>
        of({
          createdAt,
          validityPeriods: [{ startDate: createdAt }],
          fileUrl:
            'https://cdn.ybbhub.com/uploads/123e4567-e89b-12d3-a456-426614174000.pdf',
        }),
    };

    const result = (await lastValueFrom(
      interceptor.intercept(makeContext(), handler),
    )) as {
      createdAt: Date;
      validityPeriods: Array<{ startDate: Date }>;
      fileUrl: string;
    };

    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.createdAt.toISOString()).toBe(createdAt.toISOString());
    expect(result.validityPeriods[0].startDate).toBeInstanceOf(Date);
    expect(result.fileUrl).toBe(
      '/v1/files/123e4567-e89b-12d3-a456-426614174000/download',
    );
  });

  it('does not rewrite presigned upload URLs', async () => {
    (prismaMock.file.findMany as jest.Mock).mockResolvedValueOnce([]);

    const presignedUrl =
      'https://sgp1.digitaloceanspaces.com/resources/123e4567-e89b-12d3-a456-426614174000.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=test';
    const handler: CallHandler = {
      handle: () =>
        of({
          upload_url: presignedUrl,
          nested: {
            uploadUrl: presignedUrl,
          },
        }),
    };

    const result = (await lastValueFrom(
      interceptor.intercept(makeContext(), handler),
    )) as {
      upload_url: string;
      nested: { uploadUrl: string };
    };

    expect(result.upload_url).toBe(presignedUrl);
    expect(result.nested.uploadUrl).toBe(presignedUrl);
  });

  it('skips the files lookup when the response carries no URLs', async () => {
    const handler: CallHandler = {
      handle: () => of({ id: 'abc', name: 'no urls here', count: 3 }),
    };

    const result = await lastValueFrom(interceptor.intercept(makeContext(), handler));

    expect(result).toEqual({ id: 'abc', name: 'no urls here', count: 3 });
    expect(prismaMock.file.findMany).not.toHaveBeenCalled();
  });

  it('resolves many URLs with a single batched query', async () => {
    (prismaMock.file.findMany as jest.Mock).mockResolvedValueOnce([]);

    const handler: CallHandler = {
      handle: () =>
        of({
          a: 'https://cdn.ybbhub.com/uploads/one.pdf',
          nested: { b: 'https://cdn.ybbhub.com/uploads/two.pdf' },
          list: [{ c: 'https://cdn.ybbhub.com/uploads/three.pdf' }],
        }),
    };

    await lastValueFrom(interceptor.intercept(makeContext(), handler));

    expect(prismaMock.file.findMany).toHaveBeenCalledTimes(1);
  });

  it('serves repeat responses from the cache without querying again', async () => {
    const cache = makeCache();
    const cachedInterceptor = new CdnMaskInterceptor(prismaMock, cache);
    const rawUrl =
      'https://cdn.ybbhub.com/uploads/123e4567-e89b-12d3-a456-426614174000.pdf';
    const otherUrl = 'https://example.com/brochure.pdf';

    (prismaMock.file.findMany as jest.Mock).mockResolvedValueOnce([
      { id: '123e4567-e89b-12d3-a456-426614174000', url: rawUrl },
    ]);

    const handler: CallHandler = {
      handle: () => of({ fileUrl: rawUrl, otherUrl }),
    };

    const first = (await lastValueFrom(
      cachedInterceptor.intercept(makeContext(), handler),
    )) as { fileUrl: string; otherUrl: string };
    const second = (await lastValueFrom(
      cachedInterceptor.intercept(makeContext(), handler),
    )) as { fileUrl: string; otherUrl: string };

    expect(prismaMock.file.findMany).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(second.fileUrl).toBe(
      '/v1/files/123e4567-e89b-12d3-a456-426614174000/download',
    );
    // Misses are negative-cached too, so the second pass queries nothing.
    expect(second.otherUrl).toBe(otherUrl);
  });

  it('skips URLs that are not on a configured storage/CDN host', async () => {
    const previous = process.env.FILE_CDN_HOSTS;
    process.env.FILE_CDN_HOSTS = 'cdn.ybbhub.com';
    try {
      const handler: CallHandler = {
        handle: () => of({ external: 'https://www.youtube.com/watch?v=abc' }),
      };

      const result = await lastValueFrom(interceptor.intercept(makeContext(), handler));

      expect(result).toEqual({ external: 'https://www.youtube.com/watch?v=abc' });
      expect(prismaMock.file.findMany).not.toHaveBeenCalled();
    } finally {
      process.env.FILE_CDN_HOSTS = previous;
      if (previous === undefined) delete process.env.FILE_CDN_HOSTS;
    }
  });
});
