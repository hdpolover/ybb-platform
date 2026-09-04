// src/shared/guards/admin-scope.guard.ts
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
import {
  RevenueAccessScope,
  resolveRevenueAccessScope,
  assertProgramAccess,
} from '@modules/stats/revenue/utils/revenue-access.util';

/**
 * The caller's admin scope: platform (unrestricted), brand_scope (limited to
 * their admin_brands rows) or assigned (limited to their admin_programs rows).
 *
 * Deliberately the SAME shape and the SAME resolver the revenue/media endpoints
 * already use (revenue-access.util), which in turn wraps
 * getAdminProgramAccessScope() from shared/admin-access-response.ts — the
 * classifier the admin-login flow uses to build the dashboard's `accessType`.
 * One classifier, so a route's answer to "can this admin touch this?" can never
 * drift from what the dashboard showed the admin they can reach.
 */
export type AdminScope = RevenueAccessScope;

export { assertProgramAccess };

export const ADMIN_SCOPE_KEY = 'adminScope';

export interface ScopedByMetadata {
  target: 'platform' | 'brand' | 'program';
  paramName: string;
}

/**
 * Declares that a route may only be reached for a brand/program the caller is
 * scoped to, checked against the named route param. `platform` marks a route
 * that is not scopeable at all (an unfiltered, cross-brand export) and so is
 * restricted to platform-scope admins.
 *
 * Only usable when the id in the route IS the brand/program id. Where the param
 * is a child entity (a pricing tier, a validity period), resolve the parent
 * program server-side in the handler and call assertProgramAccess() there — the
 * id in the request body is never a valid substitute.
 */
export const ScopedBy = (target: ScopedByMetadata['target'], paramName = 'id') =>
  SetMetadata(ADMIN_SCOPE_KEY, { target, paramName } satisfies ScopedByMetadata);

/**
 * Resolves the caller's scope once per request and memoizes it on the request
 * object, so a guard check plus any number of in-handler child-entity checks
 * cost a single admin lookup.
 */
export async function getRequestAdminScope(
  prisma: PrismaReadService,
  request: { user?: { adminId?: string }; adminScope?: AdminScope },
): Promise<AdminScope> {
  if (!request.adminScope) {
    request.adminScope = await resolveRevenueAccessScope(
      prisma,
      (request.user ?? {}) as CurrentUserData,
    );
  }

  return request.adminScope;
}

/** Throws unless the caller may act on this brand. Platform scope always passes;
 * 'assigned' scope carries no brand-level grant at all and never passes. */
export function assertBrandAccess(scope: AdminScope, brandId: string): void {
  if (scope.kind === 'platform') {
    return;
  }

  if (scope.kind === 'brand_scope' && scope.allowedBrandIds?.includes(brandId)) {
    return;
  }

  throw new ForbiddenException('You do not have access to this brand.');
}

/**
 * Runs `fn`; whatever it throws is discarded and `notFound()` is thrown in its
 * place.
 *
 * For a child-entity scope check the row's own existence is already settled
 * by the caller before `fn` runs, so the only way `fn` can still throw is
 * "exists, but not yours" - assertProgramAccess's own NotFoundException
 * (which names the OWNING programme's id) or assertBrandAccess's
 * ForbiddenException. Rethrowing the caller's own not-found error instead
 * makes "missing" and "not yours" byte-identical, closing the response off as
 * a cross-tenant existence oracle - the same rule assertChildEntityScope
 * (program-application.controller.ts) already applies inline.
 */
export async function orNotFound<T>(fn: () => Promise<T>, notFound: () => Error): Promise<T> {
  try {
    return await fn();
  } catch {
    throw notFound();
  }
}

/**
 * Enforces @ScopedBy() on admin routes. Routes without the decorator are left
 * alone (and cost no lookup), so this guard is safe to stack onto a controller
 * that mixes scoped and unscoped endpoints.
 */
@Injectable()
export class AdminScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prismaRead: PrismaReadService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.getAllAndOverride<ScopedByMetadata | undefined>(
      ADMIN_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!metadata) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const scope = await getRequestAdminScope(this.prismaRead, request);

    if (scope.kind === 'platform') {
      return true;
    }

    if (metadata.target === 'platform') {
      throw new ForbiddenException('This action is restricted to platform administrators.');
    }

    const targetId = request.params?.[metadata.paramName];
    if (!targetId) {
      // Fail closed: a scoped route whose id is missing cannot be checked.
      throw new ForbiddenException('You do not have access to this resource.');
    }

    if (metadata.target === 'brand') {
      assertBrandAccess(scope, targetId);
      return true;
    }

    await assertProgramAccess(this.prismaRead, scope, targetId);
    return true;
  }
}
