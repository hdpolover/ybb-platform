// services/api/src/modules/admins/application/utils/admin-rank.util.spec.ts
import { UserRole } from '@core/entities/user.entity';
import { adminRoleSlug } from '@shared/admin-access-response';
import {
  getAdminRank,
  isReservedRoleName,
  isSuperAdminRole,
  isSuperAdminTier,
  SUPER_ADMIN_RANK,
} from './admin-rank.util';

const PROD_ADMIN = {
  accessLevel: 800,
  canManageAdmins: true,
  canAssignRoles: true,
  customPermissions: ['brand.manage', 'admin.manage'],
  role: { name: 'Admin', permissions: ['platform_access', 'brand.manage'] },
};
const PROJECT_MANAGER = {
  accessLevel: 1,
  role: { name: 'Project Manager', permissions: ['platform_access', 'platform.manage', 'admin.manage'] },
};
const NEWS_WRITER = { accessLevel: 1, role: { name: 'News Writer', permissions: ['news:write'] } };
const BRAND_REVIEWER = {
  accessLevel: 1,
  role: { name: 'Reviewer', permissions: ['review:read'] },
  adminBrands: [{ permissions: ['review:read'] }],
};

describe('admin rank', () => {
  it('ranks access level >= 999 as super-admin tier', () => {
    expect(getAdminRank({ accessLevel: 999 })).toBe(SUPER_ADMIN_RANK);
  });

  it.each(['Super Admin', 'super_admin', 'OWNER'])('ranks role name %s as super-admin tier', (name) => {
    expect(getAdminRank({ accessLevel: 1, role: { name, permissions: [] } })).toBe(SUPER_ADMIN_RANK);
  });

  // The token carries adminRoleSlug(name) and RolesGuard matches it exactly, so
  // every name that logs in as super_admin must rank as super-admin tier.
  it.each(['Super  Admin', 'Super\tAdmin', 'super admin', 'SUPER\nADMIN', 'Super Admin'])(
    'treats %j as super admin, because it logs in as super_admin',
    (name) => {
      expect(adminRoleSlug(name)).toBe(UserRole.SUPER_ADMIN);
      expect(isSuperAdminRole({ name, permissions: [] })).toBe(true);
      expect(getAdminRank({ accessLevel: 1, role: { name, permissions: [] } })).toBe(SUPER_ADMIN_RANK);
    },
  );

  it.each(['*', 'admin.*', 'Platform.*'])('ranks the %s permission as super-admin tier on role, custom or program grants', (permission) => {
    expect(isSuperAdminTier({ accessLevel: 1, role: { name: 'X', permissions: [permission] } })).toBe(true);
    expect(isSuperAdminTier({ accessLevel: 1, customPermissions: [permission] })).toBe(true);
    expect(isSuperAdminTier({ accessLevel: 1, adminPrograms: [{ permissions: [permission] }] })).toBe(true);
  });

  it.each(['*', 'admin.*', 'Platform.*'])('ignores %s on a brand row (brand rows grant nothing below platform)', (permission) => {
    expect(isSuperAdminTier({ accessLevel: 1, adminBrands: [{ permissions: [permission] }] })).toBe(false);
  });

  it('ranks the prod Admin (800, admin.manage, both flags) in the platform tier, below super admin', () => {
    expect(getAdminRank(PROD_ADMIN)).toBe(1800);
    expect(getAdminRank(PROD_ADMIN)).toBeLessThan(getAdminRank({ accessLevel: 999 }));
  });

  it('ranks the prod Project Manager (level 1, platform perms) above every scoped admin, below the Admin', () => {
    expect(getAdminRank(PROJECT_MANAGER)).toBe(1001);
    expect(getAdminRank(PROJECT_MANAGER)).toBeGreaterThan(getAdminRank(NEWS_WRITER));
    expect(getAdminRank(PROJECT_MANAGER)).toBeGreaterThan(getAdminRank(BRAND_REVIEWER));
    expect(getAdminRank(PROJECT_MANAGER)).toBeLessThan(getAdminRank(PROD_ADMIN));
  });

  it('ranks brand-scoped and assigned admins in the same tier, by access level', () => {
    expect(getAdminRank(BRAND_REVIEWER)).toBe(getAdminRank(NEWS_WRITER));
    expect(getAdminRank({ ...NEWS_WRITER, accessLevel: 3 })).toBeGreaterThan(getAdminRank(BRAND_REVIEWER));
  });

  it.each([
    ['accessLevel >= 5', { accessLevel: 5 }],
    ['canManageAdmins', { accessLevel: 1, canManageAdmins: true }],
    ['canAssignRoles', { accessLevel: 1, canAssignRoles: true }],
    ['platform_access', { accessLevel: 1, customPermissions: ['platform_access'] }],
    ['platform.manage', { accessLevel: 1, role: { name: 'X', permissions: ['platform.manage'] } }],
    ['admin.manage', { accessLevel: 1, adminPrograms: [{ permissions: ['admin.manage'] }] }],
  ])('puts %s in the platform tier, as the scope classifier does', (_label, admin) => {
    expect(getAdminRank(admin)).toBeGreaterThanOrEqual(1000);
    expect(getAdminRank(admin)).toBeLessThan(SUPER_ADMIN_RANK);
  });

  it('tells a super-admin role from an ordinary one', () => {
    expect(isSuperAdminRole({ name: 'Program Admin', permissions: ['program:read'] })).toBe(false);
    expect(isSuperAdminRole(null)).toBe(false);
    expect(isSuperAdminRole({ name: 'Anything', permissions: ['admin.*'] })).toBe(true);
  });

  it.each(['Admin', 'Program Manager', 'reviewer', 'Participant', 'AMBASSADOR', 'super  admin', 'Owner', 'super-admin'])(
    'reserves the role name %j',
    (name) => {
      expect(isReservedRoleName(name)).toBe(true);
    },
  );

  it.each(['Project Manager', 'News Writer', 'Program Admin', 'Document Reviewer'])('does not reserve %j', (name) => {
    expect(isReservedRoleName(name)).toBe(false);
  });
});
