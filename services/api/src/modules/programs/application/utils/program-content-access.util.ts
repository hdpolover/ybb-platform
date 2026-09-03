import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';
import { assertProgramAccess } from '@modules/stats/revenue/utils/revenue-access.util';
import { resolveRevenueAccessScope } from '@modules/stats/revenue/utils/revenue-access.util';

/**
 * Refuse a program-content write the caller's scope does not cover.
 *
 * These routes carried no tenant check at all: RolesGuard only compares the
 * coarse JWT role string, so a brand-scoped or program-scoped admin passed it
 * identically to a platform admin and could write to any program's content by
 * id.
 *
 * Deliberately built on assertProgramAccess, NOT assertBrandAccess. The latter
 * is brand-grant-only - its own docblock says 'assigned' scope "never passes" -
 * and reaching for it here would lock out every program-scoped admin, which is
 * exactly the incident PR #149 shipped and #152 had to fix. assertProgramAccess
 * handles all three scope kinds, and it matches what the admin dashboard
 * actually offers: for an 'assigned' admin, accessiblePrograms IS adminPrograms,
 * which is the list it checks.
 *
 * @param programId MUST be the program id the handler will actually act on -
 *   the one it writes, or the one it resolved from the target row. Not a
 *   parallel value from the route when the handler uses the body, or vice
 *   versa: authorising one id while acting on another passes the check and
 *   still writes to the wrong tenant, and leaves a clean audit entry saying it
 *   was fine.
 */
export async function assertProgramContentAccess(
  prismaRead: PrismaReadService,
  actor: CurrentUserData,
  programId: string,
): Promise<void> {
  const scope = await resolveRevenueAccessScope(prismaRead, actor);
  await assertProgramAccess(prismaRead, scope, programId);
}
