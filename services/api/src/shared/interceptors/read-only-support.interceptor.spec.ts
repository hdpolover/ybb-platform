// services/api/src/shared/interceptors/read-only-support.interceptor.spec.ts
import { CallHandler, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ReadOnlySupportInterceptor } from './read-only-support.interceptor';

describe('ReadOnlySupportInterceptor', () => {
  const interceptor = new ReadOnlySupportInterceptor();
  const next: CallHandler = { handle: jest.fn(() => of('handled')) };

  const ctx = (
    method: string,
    user: Record<string, unknown> | undefined,
    path = '/v1/participants/me',
    type = 'http',
  ): ExecutionContext =>
    ({
      getType: () => type,
      switchToHttp: () => ({ getRequest: () => ({ method, user, path }) }),
    }) as unknown as ExecutionContext;

  const readOnlyUser = { impersonationTicketId: 't1', impersonationMode: 'read_only' };
  const fullUser = { impersonationTicketId: 't1' };

  beforeEach(() => jest.clearAllMocks());

  it.each(['POST', 'PATCH', 'PUT', 'DELETE'])('rejects %s under a read-only token', (method) => {
    expect(() => interceptor.intercept(ctx(method, readOnlyUser), next)).toThrow(ForbiddenException);
    expect(() => interceptor.intercept(ctx(method, readOnlyUser), next)).toThrow('Read-only support view');
    expect(next.handle).not.toHaveBeenCalled();
  });

  it.each(['GET', 'HEAD', 'OPTIONS'])('allows %s under a read-only token', async (method) => {
    await expect(lastValueFrom(interceptor.intercept(ctx(method, readOnlyUser), next))).resolves.toBe('handled');
  });

  it('allows logout under a read-only token', async () => {
    await expect(
      lastValueFrom(interceptor.intercept(ctx('POST', readOnlyUser, '/v1/auth/logout'), next)),
    ).resolves.toBe('handled');
  });

  it('does not let a look-alike path through', () => {
    expect(() => interceptor.intercept(ctx('POST', readOnlyUser, '/v1/auth/logout/../payments'), next)).toThrow(
      ForbiddenException,
    );
    expect(() => interceptor.intercept(ctx('POST', readOnlyUser, '/v1/other/auth/logout'), next)).toThrow(
      ForbiddenException,
    );
  });

  it('leaves full impersonation sessions alone', async () => {
    await expect(lastValueFrom(interceptor.intercept(ctx('POST', fullUser), next))).resolves.toBe('handled');
  });

  it('leaves ordinary participant and unauthenticated requests alone', async () => {
    await expect(lastValueFrom(interceptor.intercept(ctx('POST', { userId: 'u' }), next))).resolves.toBe('handled');
    await expect(lastValueFrom(interceptor.intercept(ctx('POST', undefined), next))).resolves.toBe('handled');
  });

  it('ignores non-http contexts', async () => {
    await expect(
      lastValueFrom(interceptor.intercept(ctx('POST', readOnlyUser, '/x', 'rpc'), next)),
    ).resolves.toBe('handled');
  });
});
