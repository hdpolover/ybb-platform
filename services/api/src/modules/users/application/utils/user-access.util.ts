import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';
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

  if (scope.kind === 'platform') {
    // A platform admin may name a brand, or omit it for the deliberate
    // cross-brand listing.
    return requestedBrandId || null;
  }

  const allowedBrandIds = await resolveAllowedBrandIds(prismaRead, scope);

  if (requestedBrandId) {
    if (!allowedBrandIds.includes(requestedBrandId)) {
      throw new ForbiddenException('You do not have access to this brand.');
    }
    return requestedBrandId;
  }

  // Omitting the parameter must never mean "no filter" for a scoped admin -
  // Prisma would drop the condition and return every brand. But when the
  // caller only has one brand there is nothing to disambiguate, so requiring
  // the parameter would just be a 400 the frontend has to learn to avoid.
  if (allowedBrandIds.length === 1) {
    return allowedBrandIds[0];
  }

  if (allowedBrandIds.length === 0) {
    throw new ForbiddenException('You do not have access to any brand.');
  }

  throw new BadRequestException('brandId is required.');
}

/**
 * Which brands a non-platform admin may act on.
 *
 * assertBrandAccess is not usable on its own here. Its docblock is explicit
 * that 'assigned' scope "carries no brand-level grant at all and never
 * passes" - which is right for the revenue routes it was written for, and
 * wrong here. A program-scoped admin (adminPrograms populated, adminBrands
 * empty) legitimately manages the participants of their assigned programs,
 * and the Users pages have always let them: they send the program's own
 * brandId. Handing that straight to assertBrandAccess 403s them, and omitting
 * it 400s them, so there was no way through in either direction.
 *
 * So for 'assigned' scope the allowed brands are derived from the brands of
 * the programs they are actually assigned to, rather than from a brand-level
 * grant they do not have.
 */
async function resolveAllowedBrandIds(
  prismaRead: PrismaReadService,
  scope: { kind: string; allowedBrandIds: string[] | null; allowedProgramIds: string[] | null },
): Promise<string[]> {
  if (scope.kind === 'brand_scope') {
    return scope.allowedBrandIds ?? [];
  }

  const programIds = scope.allowedProgramIds ?? [];
  if (programIds.length === 0) return [];

  const programs = await prismaRead.program.findMany({
    where: { id: { in: programIds } },
    select: { brandId: true },
  });

  return [...new Set(programs.map((program) => program.brandId))];
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
