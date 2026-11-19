// services/api/src/modules/admins/application/utils/admin-rank.util.ts
import { normalizePermissions } from '@shared/admin-access-response';

/**
 * How senior an admin is, for deciding who may manage whom.
 *
 * Deliberately NOT `isSuperAdmin()` from admin-access-response: that one also
 * counts accessLevel >= 10, canManageAdmins and canAssignRoles, which every
 * platform admin holds (prod "Admin" is level 800 with both flags). Used as a
 * rank it would put that Admin level with the real Super Admins and let them
 * reset a Super Admin's password. This tier is only what nobody may grant
 * without already holding it.
 */
export const SUPER_ADMIN_ACCESS_LEVEL = 999;
export const SUPER_ADMIN_RANK = Number.POSITIVE_INFINITY;

const SUPER_ROLE_NAMES = new Set(['super admin', 'super_admin', 'super-admin', 'owner']);
const SUPER_PERMISSIONS = new Set(['*', 'admin.*', 'platform.*']);

export type RankedRole = { name?: string | null; permissions?: unknown } | null | undefined;

export type RankedAdmin = {
  accessLevel: number;
  customPermissions?: unknown;
  role?: RankedRole;
  adminBrands?: Array<{ permissions?: unknown }>;
  adminPrograms?: Array<{ permissions?: unknown }>;
};

function hasSuperPermission(values: unknown[]): boolean {
  return values
    .flatMap((value) => normalizePermissions(value))
    .some((permission) => SUPER_PERMISSIONS.has(permission.trim().toLowerCase()));
}

export function isSuperAdminRole(role: RankedRole): boolean {
  return (
    SUPER_ROLE_NAMES.has(role?.name?.trim().toLowerCase() ?? '') ||
    hasSuperPermission([role?.permissions])
  );
}

export function isSuperAdminTier(admin: RankedAdmin): boolean {
  return (
    admin.accessLevel >= SUPER_ADMIN_ACCESS_LEVEL ||
    isSuperAdminRole(admin.role) ||
    // Brand/program assignments carry a copy of the role's permissions, and the
    // permission guards read them, so a '*' there is as powerful as on the role.
    hasSuperPermission([
      admin.customPermissions,
      ...(admin.adminBrands ?? []).map((assignment) => assignment.permissions),
      ...(admin.adminPrograms ?? []).map((assignment) => assignment.permissions),
    ])
  );
}

export function getAdminRank(admin: RankedAdmin): number {
  return isSuperAdminTier(admin) ? SUPER_ADMIN_RANK : admin.accessLevel;
}
