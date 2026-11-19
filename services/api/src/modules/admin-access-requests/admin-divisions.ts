// services/api/src/modules/admin-access-requests/admin-divisions.ts
import { getAdminProgramAccessScope, AdminAccessLike } from '@shared/admin-access-response';
import { isSuperAdminRole, RankedRole } from '../admins/application/utils/admin-rank.util';

/** Division key -> label and the RBAC role (by name) the approver form pre-fills. */
export const ADMIN_DIVISIONS = [
  { key: 'digital_marketing', label: 'Digital Marketing', defaultRoleName: 'Digital Marketing' },
  { key: 'reviewer', label: 'Reviewer / Mentoring', defaultRoleName: 'Reviewer' },
  { key: 'news_writer', label: 'News Writer / Content', defaultRoleName: 'News Writer' },
  // The approver may upgrade to 'Admin' explicitly; it is platform tier, so never a default.
  { key: 'admin', label: 'Admin / Program Operations', defaultRoleName: 'Program Admin' },
  // Same: 'Project Manager' is an explicit upgrade.
  { key: 'project_management', label: 'Project Management', defaultRoleName: 'Program Admin' },
  { key: 'other', label: 'Other', defaultRoleName: null },
] as const satisfies ReadonlyArray<{ key: string; label: string; defaultRoleName: string | null }>;

export const ADMIN_DIVISION_KEYS: string[] = ADMIN_DIVISIONS.map((division) => division.key);

export const divisionByKey = (key: string) => ADMIN_DIVISIONS.find((division) => division.key === key);

/**
 * A role that would make its holder platform scope (or super). Checked against a
 * level-1 admin with no assignments, so only the role's own permissions count.
 * Such a role must never be pre-selected for a stranger's request.
 */
export function isPlatformTierRole(role: RankedRole & { permissions?: unknown }): boolean {
  if (isSuperAdminRole(role)) return true;
  const probe = { accessLevel: 1, role, adminBrands: [], adminPrograms: [] } as unknown as AdminAccessLike;
  return getAdminProgramAccessScope(probe) === 'platform';
}
