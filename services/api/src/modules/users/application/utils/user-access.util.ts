import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';
import { resolveRevenueAccessScope } from '@modules/stats/revenue/utils/revenue-access.util';

/**
 * Who an admin request on the users module may see and act on.
 *
 * - brandId: the brand to filter on; null = no brand restriction, which only a
 *   platform-scope admin can obtain (the deliberate cross-brand listing).
 * - programIds: only users with an application in one of these programmes;
 *   null = no restriction (platform only). A non-platform admin manages the
 *   participants of their assigned programmes, never the whole brand behind
 *   them (owner policy 2026-11-19: no program assignment => whole brand).
 */
export interface UsersScope {
  brandId: string | null;
  programIds: string[] | null;
}

/**
 * Resolve the UsersScope for a request.
 *
 * These routes took `?brandId=` and passed it straight into the Prisma filter,
 * so any admin could read, activate or deactivate any other brand's users just
 * by changing the query string. The @ScopedBy guard could not be dropped on
 * them: it resolves the tenant id from `request.params` only, and here the id
 * lives in the query.
 *
 * Omitting the parameter must not mean "no filter": `where.brandId = undefined`
 * is treated by Prisma as "no condition at all". For a non-platform admin the
 * brand must be one their assigned programmes belong to (the Users pages send
 * the programme's own brandId), and the programme filter then narrows it to
 * those programmes' applicants.
 */
export async function resolveUsersScope(
  prismaRead: PrismaReadService,
  actor: CurrentUserData,
  requestedBrandId?: string,
): Promise<UsersScope> {
  const scope = await resolveRevenueAccessScope(prismaRead, actor);

  if (scope.kind === 'platform') {
    return { brandId: requestedBrandId || null, programIds: null };
  }

  const programIds = scope.allowedProgramIds ?? [];
  const programs = programIds.length
    ? await prismaRead.program.findMany({
        where: { id: { in: programIds }, deletedAt: null },
        select: { id: true, brandId: true },
      })
    : [];
  const brandId = pickBrand([...new Set(programs.map((program) => program.brandId))], requestedBrandId);

  return { brandId, programIds: programs.filter((program) => program.brandId === brandId).map((program) => program.id) };
}

function pickBrand(allowedBrandIds: string[], requestedBrandId?: string): string {
  if (requestedBrandId) {
    if (!allowedBrandIds.includes(requestedBrandId)) {
      throw new ForbiddenException('You do not have access to this brand.');
    }
    return requestedBrandId;
  }

  // With one brand there is nothing to disambiguate, so requiring the
  // parameter would just be a 400 the frontend has to learn to avoid.
  if (allowedBrandIds.length === 1) {
    return allowedBrandIds[0];
  }

  if (allowedBrandIds.length === 0) {
    throw new ForbiddenException('You do not have access to any brand.');
  }

  throw new BadRequestException('brandId is required.');
}

/**
 * Throws `notFound()` unless the user is inside the scope: in its brand and,
 * for a non-platform admin, an applicant to one of its programmes. Same error
 * as a missing user, so these id-keyed routes are no existence oracle.
 */
export async function assertUserInScope(
  prismaRead: PrismaReadService,
  scope: UsersScope,
  userId: string,
  notFound: () => Error,
): Promise<void> {
  if (!scope.programIds) return;

  const count = await prismaRead.user.count({ where: { id: userId, ...usersScopeWhere(scope) } });
  if (count === 0) throw notFound();
}

/** The Prisma User filter for a non-platform scope; {} for platform. */
export function usersScopeWhere(scope: UsersScope): Prisma.UserWhereInput {
  return {
    ...(scope.brandId ? { brandId: scope.brandId } : {}),
    ...(scope.programIds
      ? { participant: { applications: { some: { programId: { in: scope.programIds }, deletedAt: null } } } }
      : {}),
  };
}

/**
 * Refuse to activate or deactivate an account the caller does not outrank.
 *
 * Separate defect from the brand scoping above, and NOT fixed by it: once
 * scoping lands, an admin can still deactivate anyone inside their own brand,
 * including that brand's super admin. `User.deactivate()` is a bare `isActive`
 * flag flip with no awareness of the target's role, even though the Admin model
 * carries `accessLevel` and `canManageAdmins` for exactly this purpose.
 *
 * This is not merely "they cannot log in": JwtStrategy re-checks `isActive` on
 * every request, so deactivating an admin kills their existing sessions
 * immediately.
 */
export async function assertCanChangeUserStatus(
  prismaRead: PrismaReadService,
  actor: CurrentUserData,
  targetUserId: string,
  scopedBrandId: string | null,
): Promise<void> {
  if (actor.userId === targetUserId) {
    throw new ForbiddenException('You cannot change your own account status.');
  }

  // Scoped by the brand the caller was authorised for. This lookup runs BEFORE
  // the handler's own brand-filtered findById, so an unscoped version answered
  // "is this id an admin, and how senior" for users in brands the caller
  // cannot see - a rank oracle reachable by id enumeration. A target outside
  // the caller's brand simply reads as absent here; the handler then 404s it.
  const targetAdmin = await prismaRead.admin.findFirst({
    where: {
      userId: targetUserId,
      ...(scopedBrandId ? { user: { brandId: scopedBrandId } } : {}),
    },
    select: { accessLevel: true },
  });

  // Ordinary participants and ambassadors are not ranked; brand scoping is the
  // only control that applies to them.
  if (!targetAdmin) return;

  if (!actor.adminId) {
    throw new ForbiddenException('You cannot change an administrator\'s account status.');
  }

  const actorAdmin = await prismaRead.admin.findUnique({
    where: { id: actor.adminId },
    select: { accessLevel: true, canManageAdmins: true },
  });

  if (!actorAdmin?.canManageAdmins) {
    throw new ForbiddenException('You cannot change an administrator\'s account status.');
  }

  if (actorAdmin.accessLevel <= targetAdmin.accessLevel) {
    throw new ForbiddenException(
      'You cannot change the status of an administrator at or above your own access level.',
    );
  }
}
