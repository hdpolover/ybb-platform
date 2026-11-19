// services/api/src/shared/admin-access-response.spec.ts
import { AdminAccessLike, getAdminProgramAccessScope, isSuperAdmin } from './admin-access-response';

const admin = (overrides: Partial<AdminAccessLike>): AdminAccessLike => ({
  accessLevel: 1,
  role: { name: 'Program Admin', permissions: ['program:read'] },
  adminBrands: [],
  adminPrograms: [],
  ...overrides,
});

const programRow = (permissions: string[]) =>
  ({ programId: 'program-1', permissions, program: {} }) as unknown as AdminAccessLike['adminPrograms'][number];

// Platform status comes only from the role or admin-level permissions. A program
// assignment row scopes what the admin may do inside that program; it never
// makes the admin platform, even if it carries a platform permission.
describe('getAdminProgramAccessScope', () => {
  it.each(['platform_access', 'platform.manage', 'admin.manage'])(
    'a program row carrying %s does not make the admin platform',
    (permission) => {
      expect(getAdminProgramAccessScope(admin({ adminPrograms: [programRow([permission])] }))).toBe('assigned');
    },
  );

  it.each(['*', 'admin.*', 'platform.*'])('a program row carrying %s is not super admin either', (permission) => {
    const row = admin({ adminPrograms: [programRow([permission])] });
    expect(isSuperAdmin(row)).toBe(false);
    expect(getAdminProgramAccessScope(row)).toBe('assigned');
  });

  it.each(['platform_access', 'platform.manage', 'admin.manage'])(
    'a role with %s is still platform',
    (permission) => {
      const row = admin({ role: { name: 'Project Manager', permissions: [permission] }, adminPrograms: [programRow([])] });
      expect(getAdminProgramAccessScope(row)).toBe('platform');
    },
  );

  it('custom (admin-level) permissions still make the admin platform', () => {
    expect(getAdminProgramAccessScope(admin({ customPermissions: ['platform_access'] }))).toBe('platform');
  });

  it('access level 5 and super admin signals are still platform', () => {
    expect(getAdminProgramAccessScope(admin({ accessLevel: 5 }))).toBe('platform');
    expect(getAdminProgramAccessScope(admin({ role: { name: 'Super Admin' } }))).toBe('platform');
  });
});
