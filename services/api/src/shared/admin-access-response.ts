type BrandSummaryLike = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  logoUrl?: string | null;
  logoWhiteUrl?: string | null;
  logoColorUrl?: string | null;
  logoIconUrl?: string | null;
};

type ProgramSummaryLike = {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  year: number;
  status: string;
  isActive: boolean;
  startDate: Date;
  endDate: Date;
  logoUrl?: string | null;
  logoWhiteUrl?: string | null;
  logoColorUrl?: string | null;
  logoIconUrl?: string | null;
  brand: BrandSummaryLike;
};

type AdminRoleLike = {
  id?: string;
  name?: string | null;
  permissions?: unknown;
} | null;

type AdminBrandAssignmentLike = {
  brandId: string;
  roleInBrand?: string | null;
  permissions?: unknown;
  brand: BrandSummaryLike;
};

type AdminProgramAssignmentLike = {
  programId: string;
  roleInProgram?: string | null;
  permissions?: unknown;
  program: ProgramSummaryLike;
};

/**
 * The kinds of programme access an admin can have.
 *
 * Owner policy (2026-11-19): a non-platform admin reaches a programme ONLY
 * through an explicit admin_programs row; a supervisor adds each new edition by
 * hand. Brand rows (admin_brands) grant nothing: no programmes, no users, no
 * permissions, no brand-level routes. Brand-level features stay platform-only,
 * except where a route explicitly accepts an assigned programme inside that
 * brand (LOA signatures, assertBrandPermission). There is deliberately no
 * 'brand_scope' kind any more, so nothing can derive programme access from a
 * brand.
 *
 * NAMED, and exported, on purpose. It was written inline in three places, and
 * an inline union cannot be enumerated — which is how the `'assigned'` persona
 * came to have no test fixture anywhere, and how PR #149 shipped an admin
 * lockout that two reviews looked straight at. See ADMIN_SCOPE_FIXTURES in
 * test/utils/admin-scope-fixtures.ts: it is keyed by this type, so adding a
 * fourth kind here is a COMPILE error until a fixture exists for it.
 */
export type AdminProgramAccessScope = 'assigned' | 'platform';

export type AdminAccessLike = {
  accessLevel: number;
  canManageAdmins?: boolean;
  canAssignRoles?: boolean;
  customPermissions?: unknown;
  role?: AdminRoleLike;
  adminBrands: AdminBrandAssignmentLike[];
  adminPrograms: AdminProgramAssignmentLike[];
};

export type AdminBrandSummary = {
  brandId: string;
  brandName: string;
  brandSlug: string;
  isActive: boolean;
  logoUrl?: string | null;
  role: string;
  permissions: string[];
};

export type AdminProgramSummary = {
  programId: string;
  brandId: string;
  brandName: string;
  brandSlug: string;
  programName: string;
  programSlug: string;
  programYear: number;
  programStatus: string;
  isActive: boolean;
  startDate: Date;
  endDate: Date;
  logoUrl?: string | null;
  role: string | null;
  permissions: string[];
  accessType: AdminProgramAccessScope;
};

export function normalizePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((permission): permission is string => typeof permission === 'string');
}

function buildPermissionSet(admin: AdminAccessLike): Set<string> {
  const values = [
    ...normalizePermissions(admin.role?.permissions),
    ...normalizePermissions(admin.customPermissions),
    ...admin.adminPrograms.flatMap((assignment) => normalizePermissions(assignment.permissions)),
  ].map((permission) => permission.toLowerCase());

  return new Set(values);
}

/**
 * The slug admin tokens carry next to the role's display name; RolesGuard
 * matches it against UserRole ("Super Admin" -> "super_admin"). Anything that
 * decides what a role name grants must go through this, or "Super  Admin"
 * reads as ordinary while it logs in as super_admin.
 */
export function adminRoleSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_');
}

const SUPER_ADMIN_ROLE_SLUGS = new Set(['super_admin', 'super-admin', 'owner']);

export function isSuperAdminRoleName(name: string | null | undefined): boolean {
  // Trimming first only widens the match: a slug that is exactly super_admin
  // never came from a name with edge whitespace.
  return SUPER_ADMIN_ROLE_SLUGS.has(adminRoleSlug((name ?? '').trim()));
}

export function isSuperAdmin(admin: AdminAccessLike): boolean {
  const permissionSet = buildPermissionSet(admin);

  return (
    admin.accessLevel >= 10 ||
    admin.canManageAdmins === true ||
    admin.canAssignRoles === true ||
    isSuperAdminRoleName(admin.role?.name) ||
    permissionSet.has('*') ||
    permissionSet.has('admin.*') ||
    permissionSet.has('platform.*')
  );
}

export function getAdminProgramAccessScope(
  admin: AdminAccessLike,
): AdminProgramAccessScope {
  if (isSuperAdmin(admin)) {
    return 'platform';
  }

  const permissionSet = buildPermissionSet(admin);

  if (
    admin.accessLevel >= 5 ||
    permissionSet.has('platform_access') ||
    permissionSet.has('platform.manage') ||
    permissionSet.has('admin.manage')
  ) {
    return 'platform';
  }

  return 'assigned';
}

export function mapAdminBrandAssignment(
  assignment: AdminBrandAssignmentLike,
): AdminBrandSummary {
  return {
    brandId: assignment.brandId,
    brandName: assignment.brand.name,
    brandSlug: assignment.brand.slug,
    isActive: assignment.brand.isActive,
    logoUrl:
      assignment.brand.logoUrl ??
      assignment.brand.logoColorUrl ??
      assignment.brand.logoWhiteUrl ??
      assignment.brand.logoIconUrl ??
      null,
    role: assignment.roleInBrand || 'member',
    permissions: normalizePermissions(assignment.permissions),
  };
}

export function mapAdminProgramAssignment(
  assignment: AdminProgramAssignmentLike,
): AdminProgramSummary {
  return mapProgramSummary(assignment.program, assignment, 'assigned');
}

export function buildAccessiblePrograms(params: {
  availablePrograms: ProgramSummaryLike[];
  assignments: AdminProgramAssignmentLike[];
  unassignedAccessType: 'platform';
}): AdminProgramSummary[] {
  const assignmentByProgramId = new Map(
    params.assignments.map((assignment) => [assignment.programId, assignment]),
  );

  const mergedPrograms = new Map<string, ProgramSummaryLike>();

  for (const program of params.availablePrograms) {
    mergedPrograms.set(program.id, program);
  }

  for (const assignment of params.assignments) {
    mergedPrograms.set(assignment.programId, assignment.program);
  }

  return Array.from(mergedPrograms.values())
    .map((program) => {
      const assignment = assignmentByProgramId.get(program.id);
      return mapProgramSummary(
        program,
        assignment,
        assignment ? 'assigned' : params.unassignedAccessType,
      );
    })
    .sort(sortPrograms);
}

function sanitizeLogoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes('X-Amz-')) return null;
  return url;
}

function mapProgramSummary(
  program: ProgramSummaryLike,
  assignment: AdminProgramAssignmentLike | undefined,
  accessType: AdminProgramSummary['accessType'],
): AdminProgramSummary {
  return {
    programId: program.id,
    brandId: program.brandId,
    brandName: program.brand.name,
    brandSlug: program.brand.slug,
    programName: program.name,
    programSlug: program.slug,
    programYear: program.year,
    programStatus: program.status,
    isActive: program.isActive,
    startDate: program.startDate,
    endDate: program.endDate,
    logoUrl:
      sanitizeLogoUrl(program.logoUrl) ??
      sanitizeLogoUrl(program.logoColorUrl) ??
      sanitizeLogoUrl(program.logoWhiteUrl) ??
      sanitizeLogoUrl(program.logoIconUrl) ??
      sanitizeLogoUrl(program.brand.logoUrl) ??
      sanitizeLogoUrl(program.brand.logoColorUrl) ??
      sanitizeLogoUrl(program.brand.logoWhiteUrl) ??
      sanitizeLogoUrl(program.brand.logoIconUrl) ??
      null,
    role: assignment?.roleInProgram || null,
    permissions: normalizePermissions(assignment?.permissions),
    accessType,
  };
}

function sortPrograms(left: AdminProgramSummary, right: AdminProgramSummary): number {
  if (left.isActive !== right.isActive) {
    return left.isActive ? -1 : 1;
  }

  if (left.programYear !== right.programYear) {
    return right.programYear - left.programYear;
  }

  return left.programName.localeCompare(right.programName);
}