// services/api/src/modules/admins/application/utils/admin-rank.util.ts
import { UserRole } from '@core/entities/user.entity';
import {
  adminRoleSlug,
  AdminAccessLike,
  getAdminProgramAccessScope,
  isSuperAdminRoleName,
  normalizePermissions,
} from '@shared/admin-access-response';

/**
 * How senior an admin is, for deciding who may manage whom. Three tiers, then
 * accessLevel within a tier: super > platform > scoped (brand/assigned).
 *
 * The super tier is deliberately NOT `isSuperAdmin()` from admin-access-response:
 * that one also counts accessLevel >= 10, canManageAdmins and canAssignRoles,
 * which every platform admin holds (prod "Admin" is level 800 with both flags).
 * Used as a rank it would put that Admin level with the real Super Admins and
 * let them reset a Super Admin's password. The super tier is only what nobody
 * may grant without already holding it.
 *
 * The platform tier IS the scope classifier's 'platform', so "who is platform"
 * cannot drift between the console and this rule. It has to be a tier: every
 * non-super admin in prod but one is level 1, so by level alone the Project
 * Manager tied with a News Writer and could manage nobody.
 */
export const SUPER_ADMIN_ACCESS_LEVEL = 999;
export const SUPER_ADMIN_RANK = Number.POSITIVE_INFINITY;
// Below super tier accessLevel < 999, so platform ranks never overlap scoped ones.
const PLATFORM_TIER_BASE = 1000;

const SUPER_PERMISSIONS = new Set(['*', 'admin.*', 'platform.*']);
const RESERVED_ROLE_SLUGS = new Set<string>(Object.values(UserRole));

export type RankedRole = { name?: string | null; permissions?: unknown } | null | undefined;

export type RankedAdmin = {
  accessLevel: number;
  canManageAdmins?: boolean;
  canAssignRoles?: boolean;
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
  return isSuperAdminRoleName(role?.name) || hasSuperPermission([role?.permissions]);
}

/**
 * A name whose token slug is a UserRole value (super_admin, admin, ...) or a
 * super-admin alias. RolesGuard trusts that slug, so naming a role this way is
 * granting the matching @Roles() routes.
 */
export function isReservedRoleName(name: string | null | undefined): boolean {
  return isSuperAdminRoleName(name) || RESERVED_ROLE_SLUGS.has(adminRoleSlug((name ?? '').trim()));
}

export function isSuperAdminTier(admin: RankedAdmin): boolean {
  return (
    admin.accessLevel >= SUPER_ADMIN_ACCESS_LEVEL ||
    isSuperAdminRole(admin.role) ||
    // Role and custom permissions only: assignment rows (program or brand) scope
    // access inside one program and never raise the tier (owner policy 2026-11-19).
    hasSuperPermission([admin.customPermissions])
  );
}

function isPlatformTier(admin: RankedAdmin): boolean {
  // The classifier only reads accessLevel, flags, role, permissions and the
  // assignment counts; its brand/program summary fields are not needed here.
  const access = { ...admin, adminBrands: admin.adminBrands ?? [], adminPrograms: admin.adminPrograms ?? [] };
  return getAdminProgramAccessScope(access as unknown as AdminAccessLike) === 'platform';
}

export function getAdminRank(admin: RankedAdmin): number {
  if (isSuperAdminTier(admin)) return SUPER_ADMIN_RANK;
  return (isPlatformTier(admin) ? PLATFORM_TIER_BASE : 0) + admin.accessLevel;
}
