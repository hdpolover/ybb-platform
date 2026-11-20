// src/shared/guards/admin-permission.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { AdminAccessLike, getAdminProgramAccessScope, normalizePermissions } from '@shared/admin-access-response';

export const ADMIN_PERMISSION_KEY = 'adminProgramPermission';

export interface RequiresProgramPermissionMetadata {
  anyOf: string[];
  paramName: string;
}

/**
 * Declares that a route needs at least one of `anyOf` on the program named by
 * the route param. Enforced by AdminPermissionGuard.
 *
 * This answers "may this admin do THIS", not "may they touch this program":
 * stack it after AdminScopeGuard + @ScopedBy, which answers the second
 * question and hides out-of-scope programs behind a 404 first.
 */
export const RequiresProgramPermission = (anyOf: string[], paramName = 'programId') =>
  SetMetadata(ADMIN_PERMISSION_KEY, { anyOf, paramName } satisfies RequiresProgramPermissionMetadata);

// Same grant-all set as hasRequiredPermissions() in the admin dashboard
// (services/admin-dashboard/lib/admin-access.ts). Keep the two in step, or the
// dashboard will offer an action this guard then refuses.
const GRANT_ALL_PERMISSIONS: readonly string[] = ['*', 'platform.*', 'admin.*', 'platform.manage'];

const FORBIDDEN_MESSAGE = 'You do not have permission to perform this action on this program.';

/**
 * Throws ForbiddenException unless the caller holds one of `anyOf` for this
 * program. Counted: role permissions, the admin's custom permissions, and the
 * grant on THIS program. A grant attached to some other program is deliberately
 * not counted, which is stricter than the dashboard's union of every
 * assignment; a brand row's grant never counts (brand rows grant nothing).
 */
export async function assertProgramPermission(
  prisma: PrismaReadService,
  user: Pick<CurrentUserData, 'adminId'> | undefined,
  programId: string,
  anyOf: readonly string[],
): Promise<void> {
  // An undefined programId (a route whose param name does not match the
  // decorator's) must not reach the queries below: the soft-delete extension
  // turns findUnique({ id: undefined }) into "first program", which would
  // count some unrelated brand's grants.
  if (!user?.adminId || !programId) {
    throw new ForbiddenException(FORBIDDEN_MESSAGE);
  }

  const admin = await loadNonPlatformAdmin(prisma, user.adminId);
  if (!admin) return;

  assertHoldsAny(admin, (grant) => grant.programId === programId, anyOf);
}

/**
 * Brand-keyed twin of assertProgramPermission, for brand-owned rows with no
 * program id (LOA signatures). Counted: role permissions, custom permissions,
 * and the grants on the admin's programs in this brand (not a brand row's).
 */
export async function assertBrandPermission(
  prisma: PrismaReadService,
  user: Pick<CurrentUserData, 'adminId'> | undefined,
  brandId: string,
  anyOf: readonly string[],
): Promise<void> {
  if (!user?.adminId || !brandId) {
    throw new ForbiddenException(FORBIDDEN_MESSAGE);
  }

  const admin = await loadNonPlatformAdmin(prisma, user.adminId);
  if (!admin) return;

  const grantedProgramIds = admin.adminPrograms.map((grant) => grant.programId);
  const programsInBrand = new Set(
    grantedProgramIds.length > 0
      ? (
          await prisma.program.findMany({
            where: { id: { in: grantedProgramIds }, brandId, deletedAt: null },
            select: { id: true },
          })
        ).map((program) => program.id)
      : [],
  );

  assertHoldsAny(admin, (grant) => programsInBrand.has(grant.programId), anyOf);
}

type PermissionAdmin = NonNullable<Awaited<ReturnType<typeof findPermissionAdmin>>>;

function findPermissionAdmin(prisma: PrismaReadService, adminId: string) {
  return prisma.admin.findUnique({
    where: { id: adminId },
    select: {
      accessLevel: true,
      canManageAdmins: true,
      canAssignRoles: true,
      customPermissions: true,
      role: { select: { name: true, permissions: true } },
      adminPrograms: { where: { removedAt: null }, select: { programId: true, permissions: true } },
    },
  });
}

/**
 * The admin row, or null for the platform tier (super admins, but also access
 * level >= 5, platform_access, admin.manage), which passes every check, as
 * AdminScopeGuard already lets it through every scope check; permissions only
 * narrow brand/program admins. Throws for an unknown admin.
 */
async function loadNonPlatformAdmin(prisma: PrismaReadService, adminId: string): Promise<PermissionAdmin | null> {
  const admin = await findPermissionAdmin(prisma, adminId);
  if (!admin) {
    throw new ForbiddenException(FORBIDDEN_MESSAGE);
  }
  // Same cast, for the same reason, as resolveRevenueAccessScope: the classifier
  // never reads the nested brand/program summaries its parameter type asks for.
  return getAdminProgramAccessScope({ ...admin, adminBrands: [] } as unknown as AdminAccessLike) === 'platform'
    ? null
    : admin;
}

/**
 * Of `programIds`, the ones on which the caller holds one of `anyOf`: the list
 * twin of assertProgramPermission, for routes with no single program id (a
 * cross-program list). One admin lookup for the whole list. The platform tier
 * keeps them all; an unknown principal keeps none.
 */
export async function programIdsWithPermission(
  prisma: PrismaReadService,
  user: Pick<CurrentUserData, 'adminId'> | undefined,
  programIds: readonly string[],
  anyOf: readonly string[],
): Promise<string[]> {
  if (!user?.adminId) return [];

  const admin = await loadNonPlatformAdmin(prisma, user.adminId);
  if (!admin) return [...programIds];

  return programIds.filter((programId) => holdsAny(admin, (grant) => grant.programId === programId, anyOf));
}

function holdsAny(
  admin: PermissionAdmin,
  countsProgramGrant: (grant: PermissionAdmin['adminPrograms'][number]) => boolean,
  anyOf: readonly string[],
): boolean {
  const granted = new Set(
    [
      ...normalizePermissions(admin.role?.permissions),
      ...normalizePermissions(admin.customPermissions),
      ...admin.adminPrograms.filter(countsProgramGrant).flatMap((grant) => normalizePermissions(grant.permissions)),
    ].map((permission) => permission.toLowerCase()),
  );

  return (
    GRANT_ALL_PERMISSIONS.some((permission) => granted.has(permission)) ||
    anyOf.some((permission) => granted.has(permission.toLowerCase()))
  );
}

function assertHoldsAny(
  admin: PermissionAdmin,
  countsProgramGrant: (grant: PermissionAdmin['adminPrograms'][number]) => boolean,
  anyOf: readonly string[],
): void {
  if (!holdsAny(admin, countsProgramGrant, anyOf)) {
    throw new ForbiddenException(FORBIDDEN_MESSAGE);
  }
}

/**
 * Enforces @RequiresProgramPermission(). Routes without the decorator are left
 * alone (and cost no lookup), so it is safe to stack onto a mixed controller.
 */
@Injectable()
export class AdminPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prismaRead: PrismaReadService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.getAllAndOverride<RequiresProgramPermissionMetadata | undefined>(
      ADMIN_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!metadata) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    await assertProgramPermission(
      this.prismaRead,
      request.user as CurrentUserData,
      request.params?.[metadata.paramName],
      metadata.anyOf,
    );

    return true;
  }
}
