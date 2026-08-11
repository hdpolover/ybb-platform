// src/shared/utils/resolve-acting-admin-id.spec.ts
import { ForbiddenException } from '@nestjs/common';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';
import { resolveActingAdminId } from './resolve-acting-admin-id';

function buildUser(overrides: Partial<CurrentUserData> = {}): CurrentUserData {
  return {
    userId: 'bf5375d5-404b-4a0f-a3cf-c89bf8bff192',
    email: 'super@ybbhub.com',
    brandId: 'brand-1',
    ...overrides,
  };
}

describe('resolveActingAdminId', () => {
  it('returns adminId when present', () => {
    const user = buildUser({ adminId: 'ccfb026b-b2d9-44c0-981e-fb3c36432b71' });

    expect(resolveActingAdminId(user)).toBe('ccfb026b-b2d9-44c0-981e-fb3c36432b71');
  });

  it('throws ForbiddenException instead of falling back to userId when adminId is absent', () => {
    const user = buildUser({ adminId: undefined });

    expect(() => resolveActingAdminId(user)).toThrow(ForbiddenException);
    expect(() => resolveActingAdminId(user)).toThrow('Authenticated user is not an admin.');
  });
});
