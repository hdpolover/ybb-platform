// src/shared/utils/resolve-acting-admin-id.ts
import { ForbiddenException } from '@nestjs/common';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';

/**
 * Resolves the acting ADMIN id (admins.id) from the authenticated principal.
 *
 * ApplicationReview.reviewerId, ApplicationReview.overrideById, and
 * ScoringSchema.createdById are foreign keys to admins(id), which is NOT the
 * same row as users(id) (CurrentUserData.userId). admins.id is only related
 * to users.id via admins.user_id. Passing user.userId into any of those
 * columns throws a Postgres foreign key violation as soon as it does not
 * happen to collide with a real admins.id.
 *
 * There is deliberately no fallback to user.userId here: a silent fallback
 * is exactly what caused that outage (see audit-trail.interceptor.ts:87 for
 * a case where userId IS an acceptable fallback, because that call site
 * writes to a column with no FK to admins). Any caller that needs an admin
 * id must get a real one or fail loudly.
 */
export function resolveActingAdminId(user: CurrentUserData): string {
  if (!user.adminId) {
    throw new ForbiddenException('Authenticated user is not an admin.');
  }

  return user.adminId;
}
