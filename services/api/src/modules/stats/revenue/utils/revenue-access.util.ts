// src/modules/stats/revenue/utils/revenue-access.util.ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';
import { getAdminProgramAccessScope } from '../../../../shared/admin-access-response';

export interface RevenueAccessScope {
  kind: 'platform' | 'brand_scope' | 'assigned';
  /** null = no brand-level restriction (platform admin). */
  allowedBrandIds: string[] | null;
  /** null = no explicit program-level restriction. Only set for 'assigned' scope. */
  allowedProgramIds: string[] | null;
}

/**
 * Resolves the caller's revenue-reporting access scope off their Admin record
 * (accessLevel/role/adminBrands/adminPrograms). Reuses the same
 * getAdminProgramAccessScope() classifier the admin-login flow already uses
 * (see shared/admin-access-response.ts) so "who can see what" here stays in
 * sync with the rest of the admin console instead of inventing a second,
 * divergent notion of "platform admin" (no such helper existed pre-Phase-3b).
 */
export async function resolveRevenueAccessScope(
  prisma: PrismaReadService,
  user: CurrentUserData,
): Promise<RevenueAccessScope> {
  if (!user.adminId) {
    // Admin-guarded routes should never be reached without adminId (RolesGuard
    // already requires the admin/super_admin role), but fail closed just in case.
    return { kind: 'assigned', allowedBrandIds: [], allowedProgramIds: [] };
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
    return { kind: 'assigned', allowedBrandIds: [], allowedProgramIds: [] };
  }

  // getAdminProgramAccessScope's parameter type (AdminAccessLike) additionally requires a
  // nested `brand`/`program` summary on each assignment (for building UI-facing summaries
  // elsewhere) that this classifier never actually reads — only accessLevel/role/
  // permissions/adminBrands.length are used. Casting avoids joining brand/program rows on
  // every revenue request just to satisfy a shape we don't need here.
  const scope = getAdminProgramAccessScope(admin as unknown as Parameters<typeof getAdminProgramAccessScope>[0]);

  if (scope === 'platform') {
    return { kind: 'platform', allowedBrandIds: null, allowedProgramIds: null };
  }

  if (scope === 'brand_scope') {
    return {
      kind: 'brand_scope',
      allowedBrandIds: admin.adminBrands.map((assignment) => assignment.brandId),
      allowedProgramIds: null,
    };
  }

  return {
    kind: 'assigned',
    allowedBrandIds: null,
    allowedProgramIds: admin.adminPrograms.map((assignment) => assignment.programId),
  };
}

/**
 * Builds the ApplicationInvoice `where` clause enforcing the caller's scope, honoring an
 * optional client-supplied brandId query param.
 *
 * - platform: any brandId (or none, for "all brands").
 * - brand_scope: brandId must be one of the caller's own adminBrands, or omitted (defaults to
 *   all of the caller's brands). Anything else is REJECTED (ForbiddenException) rather than
 *   silently ignored, so a scoped admin can't probe another brand's revenue by guessing an id.
 * - assigned: no brand-level grant at all; scoped straight to the caller's adminPrograms.
 *   Supplying any brandId here is rejected.
 */
export function buildInvoiceScopeWhere(
  scope: RevenueAccessScope,
  requestedBrandId?: string,
): Prisma.ApplicationInvoiceWhereInput {
  if (scope.kind === 'platform') {
    return requestedBrandId ? { application: { program: { brandId: requestedBrandId } } } : {};
  }

  if (scope.kind === 'brand_scope') {
    const allowed = scope.allowedBrandIds ?? [];
    if (requestedBrandId) {
      if (!allowed.includes(requestedBrandId)) {
        throw new ForbiddenException('You do not have access to this brand.');
      }
      return { application: { program: { brandId: requestedBrandId } } };
    }
    return { application: { program: { brandId: { in: allowed } } } };
  }

  // scope.kind === 'assigned'
  if (requestedBrandId) {
    throw new ForbiddenException('You do not have access to this brand.');
  }
  return { application: { programId: { in: scope.allowedProgramIds ?? [] } } };
}

/** Same scoping rule as buildInvoiceScopeWhere, expressed as a Program `where` clause
 * (used for the byProgram/byBrand rollup queries). */
export function buildProgramScopeWhere(
  scope: RevenueAccessScope,
  requestedBrandId?: string,
): Prisma.ProgramWhereInput {
  if (scope.kind === 'platform') {
    return requestedBrandId ? { brandId: requestedBrandId } : {};
  }

  if (scope.kind === 'brand_scope') {
    const allowed = scope.allowedBrandIds ?? [];
    if (requestedBrandId) {
      if (!allowed.includes(requestedBrandId)) {
        throw new ForbiddenException('You do not have access to this brand.');
      }
      return { brandId: requestedBrandId };
    }
    return { brandId: { in: allowed } };
  }

  if (requestedBrandId) {
    throw new ForbiddenException('You do not have access to this brand.');
  }
  return { id: { in: scope.allowedProgramIds ?? [] } };
}

/** Throws NotFoundException/ForbiddenException if programId is outside the caller's scope;
 * otherwise returns the program's id/brandId/name for use by the caller. */
export async function assertProgramAccess(
  prisma: PrismaReadService,
  scope: RevenueAccessScope,
  programId: string,
): Promise<{ id: string; brandId: string; name: string }> {
  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: { id: true, brandId: true, name: true, deletedAt: true },
  });

  const missing = !program || program.deletedAt;

  // A platform admin may be told the truth: they can see every programme, so
  // "not found" from them means the programme really does not exist, and there
  // is nothing for the answer to leak.
  if (scope.kind === 'platform') {
    if (missing) {
      throw new NotFoundException(`Program ${programId} not found`);
    }
    return program;
  }

  const inScope =
    !missing &&
    (scope.kind === 'brand_scope'
      ? !!scope.allowedBrandIds?.includes(program!.brandId)
      : !!scope.allowedProgramIds?.includes(program!.id));

  // Everyone else gets the SAME answer for "does not exist" and "exists but is
  // not yours". Distinguishing them let an admin scoped to brand A probe ids and
  // learn from the status code alone which programmes exist in brand B - no data
  // disclosed, but exactly the existence oracle the id-keyed routes were built to
  // avoid. assertAmbassadorAccess already answers 404 for both for this reason;
  // this brings the shared helper in line.
  if (!inScope) {
    throw new NotFoundException(`Program ${programId} not found`);
  }

  return program!;
}
