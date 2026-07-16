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

type AdminAccessLike = {
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
  accessType: 'assigned' | 'brand_scope' | 'platform';
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
    ...admin.adminBrands.flatMap((assignment) => normalizePermissions(assignment.permissions)),
    ...admin.adminPrograms.flatMap((assignment) => normalizePermissions(assignment.permissions)),
  ].map((permission) => permission.toLowerCase());

  return new Set(values);
}

function isSuperAdmin(admin: AdminAccessLike): boolean {
  const roleName = admin.role?.name?.toLowerCase() ?? '';
  const permissionSet = buildPermissionSet(admin);

  return (
    admin.accessLevel >= 10 ||
    admin.canManageAdmins === true ||
    admin.canAssignRoles === true ||
    ['super admin', 'super_admin', 'super-admin', 'owner'].includes(roleName) ||
    permissionSet.has('*') ||
    permissionSet.has('admin.*') ||
    permissionSet.has('platform.*')
  );
}

export function getAdminProgramAccessScope(
  admin: AdminAccessLike,
): 'assigned' | 'brand_scope' | 'platform' {
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

  if (admin.adminBrands.length > 0) {
    return 'brand_scope';
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
  unassignedAccessType: 'brand_scope' | 'platform';
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