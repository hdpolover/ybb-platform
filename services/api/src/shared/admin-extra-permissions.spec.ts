// services/api/src/shared/admin-extra-permissions.spec.ts
import { BadRequestException } from '@nestjs/common';
import { AdminAccessLike, getAdminProgramAccessScope } from './admin-access-response';
import {
  EXTRA_PERMISSION_KEYS,
  PRIVILEGED_PERMISSIONS,
  isPrivilegedPermission,
  mergeCustomPermissions,
  normalizeExtraPermissions,
  storedExtraPermissions,
} from './admin-extra-permissions';

describe('isPrivilegedPermission', () => {
  it.each(['*', 'admin.*', 'platform.*', 'roles.*', 'platform_access', 'platform.manage', 'brand.manage', 'admin.manage', 'roles.manage', ' Admin.Manage '])(
    'flags %s',
    (permission) => expect(isPrivilegedPermission(permission)).toBe(true),
  );

  it.each(['program:read', 'payments:write', 'applications:read'])('does not flag %s', (permission) =>
    expect(isPrivilegedPermission(permission)).toBe(false),
  );
});

describe('EXTRA_PERMISSION_KEYS', () => {
  it('contains no privileged key', () => {
    expect(EXTRA_PERMISSION_KEYS.filter(isPrivilegedPermission)).toEqual([]);
  });

  it('offers the read/write keys the role editor offers', () => {
    expect(EXTRA_PERMISSION_KEYS).toEqual(
      expect.arrayContaining(['program:read', 'program:write', 'applications:write', 'review:write', 'payments:read', 'payments:write', 'support:write']),
    );
  });
});

describe('normalizeExtraPermissions', () => {
  it('trims, lowercases, dedupes and sorts', () => {
    expect(normalizeExtraPermissions([' Payments:Read', 'applications:read', 'payments:read'])).toEqual([
      'applications:read',
      'payments:read',
    ]);
  });

  it('accepts an empty list (clears extras)', () => {
    expect(normalizeExtraPermissions([])).toEqual([]);
  });

  it.each([...PRIVILEGED_PERMISSIONS, 'admin.*', 'platform.*'].map((permission) => [permission]))(
    'rejects privileged %s with 400',
    (permission) => {
      expect(() => normalizeExtraPermissions(['program:read', permission])).toThrow(BadRequestException);
    },
  );

  it('rejects unknown keys with 400', () => {
    expect(() => normalizeExtraPermissions(['payments:destroy'])).toThrow(BadRequestException);
  });

  it('rejects non-arrays and non-string entries with 400', () => {
    expect(() => normalizeExtraPermissions('payments:read')).toThrow(BadRequestException);
    expect(() => normalizeExtraPermissions([1])).toThrow(BadRequestException);
  });
});

describe('mergeCustomPermissions', () => {
  it('keeps existing privileged entries untouched and replaces the rest', () => {
    expect(mergeCustomPermissions(['*', 'admin.manage', 'program:read'], ['payments:read'])).toEqual([
      '*',
      'admin.manage',
      'payments:read',
    ]);
  });

  it('submitting nothing cannot remove privileged entries', () => {
    expect(mergeCustomPermissions(['*'], [])).toEqual(['*']);
  });

  it('submitting extras cannot add privileged entries (defence in depth)', () => {
    expect(mergeCustomPermissions([], ['admin.manage', 'program:read'])).toEqual(['program:read']);
  });

  it('tolerates a null or malformed stored value', () => {
    expect(mergeCustomPermissions(null, ['program:read'])).toEqual(['program:read']);
    expect(mergeCustomPermissions({ not: 'an array' }, [])).toEqual([]);
  });

  it('does not duplicate when privileged entries differ only by case', () => {
    expect(mergeCustomPermissions(['Admin.Manage', 'admin.manage'], [])).toEqual(['Admin.Manage']);
  });
});

describe('storedExtraPermissions', () => {
  it('returns only the non-privileged stored entries, normalised', () => {
    expect(storedExtraPermissions(['*', 'Payments:Read', 'admin.manage', 'program:read'])).toEqual(['payments:read', 'program:read']);
  });
});

describe('extras never lift a scoped admin to the platform tier', () => {
  const scopedAdmin = (customPermissions: string[]): AdminAccessLike => ({
    accessLevel: 1,
    canManageAdmins: false,
    canAssignRoles: false,
    customPermissions,
    role: { id: 'r', name: 'Program Admin', permissions: ['program:read', 'applications:read'] },
    adminBrands: [],
    adminPrograms: [{ programId: 'program-1' } as never],
  });

  it('the control: a privileged entry does flip the classifier', () => {
    expect(getAdminProgramAccessScope(scopedAdmin(['platform_access']))).toBe('platform');
  });

  it('every allow-listed key together stays assigned', () => {
    expect(getAdminProgramAccessScope(scopedAdmin([...EXTRA_PERMISSION_KEYS]))).toBe('assigned');
  });

  it('whatever normalizeExtraPermissions accepts stays assigned', () => {
    const accepted = normalizeExtraPermissions([...EXTRA_PERMISSION_KEYS]);
    expect(getAdminProgramAccessScope(scopedAdmin(accepted))).toBe('assigned');
  });
});
