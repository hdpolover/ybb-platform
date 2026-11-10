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
import { AdminAccessLike, isSuperAdmin, normalizePermissions } from '@shared/admin-access-response';

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
 * grants on THIS program or its brand. A grant attached to some other program
 * or brand is deliberately not counted, which is stricter than the dashboard's
 * union of every assignment.
 */
export async function assertProgramPermission(
  prisma: PrismaReadService,
  user: CurrentUserData,
  programId: string,
  anyOf: readonly string[],
): Promise<void> {
  if (!user?.adminId) {
    throw new ForbiddenException(FORBIDDEN_MESSAGE);
  }

  const admin = await prisma.admin.findUnique({
    where: { id: user.adminId },
    select: {
      accessLevel: true,
      canManageAdmins: true,
      canAssignRoles: true,
      customPermissions: true,
      role: { select: { name: true, permissions: true } },
      adminBrands: { select: { brandId: true, permissions: true } },
      adminPrograms: { select: { programId: true, permissions: true } },
    },
  });

  if (!admin) {
    throw new ForbiddenException(FORBIDDEN_MESSAGE);
  }

  // Same cast, for the same reason, as resolveRevenueAccessScope: the classifier
  // never reads the nested brand/program summaries its parameter type asks for.
  if (isSuperAdmin(admin as unknown as AdminAccessLike)) {
    return;
  }

  const brandId =
    admin.adminBrands.length > 0
      ? (await prisma.program.findUnique({ where: { id: programId }, select: { brandId: true } }))?.brandId
      : undefined;

  const granted = new Set(
    [
      ...normalizePermissions(admin.role?.permissions),
      ...normalizePermissions(admin.customPermissions),
      ...admin.adminBrands
        .filter((grant) => brandId !== undefined && grant.brandId === brandId)
        .flatMap((grant) => normalizePermissions(grant.permissions)),
      ...admin.adminPrograms
        .filter((grant) => grant.programId === programId)
        .flatMap((grant) => normalizePermissions(grant.permissions)),
    ].map((permission) => permission.toLowerCase()),
  );

  const allowed =
    GRANT_ALL_PERMISSIONS.some((permission) => granted.has(permission)) ||
    anyOf.some((permission) => granted.has(permission.toLowerCase()));

  if (!allowed) {
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
