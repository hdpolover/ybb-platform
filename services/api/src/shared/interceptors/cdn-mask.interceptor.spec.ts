import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { CdnMaskInterceptor } from './cdn-mask.interceptor';

describe('CdnMaskInterceptor', () => {
  const interceptor = new CdnMaskInterceptor();

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

  it('preserves Date values while masking document URLs', async () => {
    const createdAt = new Date('2026-04-29T00:00:00.000Z');
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
      'https://api.ybbhub.com/v1/files/123e4567-e89b-12d3-a456-426614174000/download',
    );
  });
});
