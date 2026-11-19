// services/api/src/modules/admins/application/utils/admin-rank.util.spec.ts
import { getAdminRank, isSuperAdminRole, isSuperAdminTier, SUPER_ADMIN_RANK } from './admin-rank.util';

describe('admin rank', () => {
  it('ranks access level >= 999 as super-admin tier', () => {
    expect(getAdminRank({ accessLevel: 999 })).toBe(SUPER_ADMIN_RANK);
  });

  it.each(['Super Admin', 'super_admin', 'OWNER'])('ranks role name %s as super-admin tier', (name) => {
    expect(getAdminRank({ accessLevel: 1, role: { name, permissions: [] } })).toBe(SUPER_ADMIN_RANK);
  });

  it.each(['*', 'admin.*', 'Platform.*'])('ranks the %s permission as super-admin tier wherever it is held', (permission) => {
    expect(isSuperAdminTier({ accessLevel: 1, role: { name: 'X', permissions: [permission] } })).toBe(true);
    expect(isSuperAdminTier({ accessLevel: 1, customPermissions: [permission] })).toBe(true);
    expect(isSuperAdminTier({ accessLevel: 1, adminBrands: [{ permissions: [permission] }] })).toBe(true);
    expect(isSuperAdminTier({ accessLevel: 1, adminPrograms: [{ permissions: [permission] }] })).toBe(true);
  });

  it('ranks the prod Admin (800, admin.manage, both flags) by access level, below super admin', () => {
    const admin = {
      accessLevel: 800,
      canManageAdmins: true,
      canAssignRoles: true,
      customPermissions: ['brand.manage', 'admin.manage'],
      role: { name: 'Admin', permissions: ['platform_access', 'brand.manage'] },
    };

    expect(getAdminRank(admin)).toBe(800);
    expect(getAdminRank(admin)).toBeLessThan(getAdminRank({ accessLevel: 999 }));
  });

  it('ranks the prod Project Manager (level 1, admin.manage + platform.manage) at 1', () => {
    expect(
      getAdminRank({
        accessLevel: 1,
        role: { name: 'Project Manager', permissions: ['platform_access', 'platform.manage', 'admin.manage'] },
      }),
    ).toBe(1);
  });

  it('tells a super-admin role from an ordinary one', () => {
    expect(isSuperAdminRole({ name: 'Program Admin', permissions: ['program:read'] })).toBe(false);
    expect(isSuperAdminRole(null)).toBe(false);
    expect(isSuperAdminRole({ name: 'Anything', permissions: ['admin.*'] })).toBe(true);
  });
});
