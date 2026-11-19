import { NotFoundException } from '@nestjs/common';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';
import { resolveRevenueAccessScope, assertProgramAccess } from '@modules/stats/revenue/utils/revenue-access.util';
import { assertProgramPermission } from '@shared/guards/admin-permission.guard';

// Write-level twin of the dashboard's "ambassadors" menu rule
// (services/admin-dashboard/lib/admin-access.ts programWritePermissions.ambassadors).
export const AMBASSADOR_WRITE_PERMISSIONS = ['participants:write', 'program:write'];

/**
 * The programmes whose ambassadors this admin may see and act on.
 *
 * Returns null meaning "no restriction", which only a platform-scope admin
 * obtains. An empty array means the admin is scoped to nothing and must be shown
 * nothing - it must never be treated as "no filter", which is the trap that made
 * the users list return every brand when its parameter was simply omitted.
 *
 * Deliberately expressed as a set of PROGRAMME ids rather than a single brand
 * id, unlike resolveUsersBrandFilter. Ambassadors hang off programmes, and a
 * brand-scoped admin owns every programme in their brands while a program-scoped
 * admin owns an explicit list - collapsing either to one brand id would silently
 * widen or narrow what they can reach.
 */
export async function resolveAmbassadorProgramScope(
  prismaRead: PrismaReadService,
  actor: CurrentUserData,
): Promise<string[] | null> {
  const scope = await resolveRevenueAccessScope(prismaRead, actor);

  if (scope.kind === 'platform') return null;

  if (scope.kind === 'brand_scope') {
    const programs = await prismaRead.program.findMany({
      where: { brandId: { in: scope.allowedBrandIds ?? [] }, deletedAt: null },
      select: { id: true },
    });
    // Plus explicit admin_programs grants outside those brands (additive, see RevenueAccessScope).
    return [...new Set([...programs.map((program) => program.id), ...(scope.allowedProgramIds ?? [])])];
  }

  // 'assigned': an explicit programme list. resolveRevenueAccessScope also fails
  // closed into this kind with an empty list when the caller has no admin row,
  // so an empty result here is a refusal, not an oversight.
  return scope.allowedProgramIds ?? [];
}

/**
 * Refuse an action on an ambassador outside the caller's programmes.
 *
 * Resolves the ambassador's programme SERVER-SIDE from its own row. These routes
 * carry only the ambassador id, so there is no tenant id in the request for a
 * guard to check and nothing the caller supplies is trusted.
 *
 * Answers 404 rather than 403 for an out-of-scope ambassador. A 403 would
 * confirm the id exists, turning these routes into a cross-brand existence
 * oracle reachable by id enumeration - the same reason assertCanChangeUserStatus
 * scopes its lookup rather than reporting what it found.
 */
export async function assertAmbassadorAccess(
  prismaRead: PrismaReadService,
  actor: CurrentUserData,
  ambassadorId: string,
  requiredPermissions?: readonly string[],
): Promise<void> {
  const allowedProgramIds = await resolveAmbassadorProgramScope(prismaRead, actor);
  if (allowedProgramIds === null) return;

  const ambassador = await prismaRead.ambassador.findFirst({
    where: { id: ambassadorId, deletedAt: null },
    select: { programId: true },
  });

  if (!ambassador?.programId || !allowedProgramIds.includes(ambassador.programId)) {
    throw new NotFoundException('Ambassador not found');
  }
  // After the 404, so ids still cannot be probed across brands.
  if (requiredPermissions) {
    await assertProgramPermission(prismaRead, actor, ambassador.programId, requiredPermissions);
  }
}

/**
 * Refuse creating an ambassador in a programme the caller does not hold.
 *
 * The programme id arrives in the BODY here, so a route-param guard cannot cover
 * it. assertProgramAccess is used rather than assertBrandAccess because the
 * latter is brand-grant-only and would reject every program-scoped admin.
 */
export async function assertAmbassadorCreateAccess(
  prismaRead: PrismaReadService,
  actor: CurrentUserData,
  programId: string,
): Promise<void> {
  const scope = await resolveRevenueAccessScope(prismaRead, actor);
  await assertProgramAccess(prismaRead, scope, programId);
  if (scope.kind !== 'platform') {
    await assertProgramPermission(prismaRead, actor, programId, AMBASSADOR_WRITE_PERMISSIONS);
  }
}
