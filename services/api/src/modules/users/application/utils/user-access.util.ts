import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';
import { assertBrandAccess } from '@shared/guards/admin-scope.guard';
import { resolveRevenueAccessScope } from '@modules/stats/revenue/utils/revenue-access.util';

/**
 * Resolve which brand an admin request on the users module is allowed to act on.
 *
 * These routes took `?brandId=` and passed it straight into the Prisma filter,
 * so any admin could read, activate or deactivate any other brand's users just
 * by changing the query string. The @ScopedBy guard could not be dropped on
 * them: it resolves the tenant id from `request.params` only, and here the id
 * lives in the query.
 *
 * Two things this must get right, both of which a naive
 * `brandId === caller.brandId` check gets wrong:
 *
 * 1. A brand-scope admin can legitimately own SEVERAL brands, so the comparison
 *    has to go through assertBrandAccess and its allowedBrandIds list.
 * 2. Omitting the parameter must not mean "no filter". `where.brandId =
 *    undefined` is treated by Prisma as "no condition at all", so dropping the
 *    param returned every user in every brand - a wider hole than supplying
 *    someone else's id, and one that needs no guessing. Any equality-based fix
 *    that only rejects MISMATCHES leaves this open.
 *
 * Returns the brandId to filter on, or null meaning "no brand restriction",
 * which only a platform-scope admin can obtain. That preserves the existing
 * platform users view, which deliberately lists across brands.
 */
export async function resolveUsersBrandFilter(
  prismaRead: PrismaReadService,
  actor: CurrentUserData,
  requestedBrandId?: string,
): Promise<string | null> {
  const scope = await resolveRevenueAccessScope(prismaRead, actor);

  if (requestedBrandId) {
    assertBrandAccess(scope, requestedBrandId);
    return requestedBrandId;
  }

  if (scope.kind === 'platform') {
    return null;
  }

  throw new BadRequestException('brandId is required.');
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
): Promise<void> {
  if (actor.userId === targetUserId) {
    throw new ForbiddenException('You cannot change your own account status.');
  }

  const targetAdmin = await prismaRead.admin.findUnique({
    where: { userId: targetUserId },
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
