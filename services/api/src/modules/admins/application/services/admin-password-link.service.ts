// services/api/src/modules/admins/application/services/admin-password-link.service.ts
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { hashToken } from '@shared/utils/hash-token.util';

/** Invites outlive the 1h self-service reset: the invitee may not open the mail today. */
export const ADMIN_PASSWORD_LINK_TTL_MS = 72 * 60 * 60 * 1000;

// Bound by the existing 'user.#' binding in services/notification/src/main.ts.
export const ADMIN_PASSWORD_LINK_EVENT = 'user.admin-password-link';

export type AdminPasswordLinkKind = 'invite' | 'reset';

export type IssueAdminPasswordLinkParams = {
  userId: string;
  email: string;
  fullName: string;
  kind: AdminPasswordLinkKind;
  roleName: string | null;
  /** "Send password link" on an existing admin: kill the old credential and every session first. */
  invalidateCredentials?: boolean;
};

/**
 * Issues the single-use set-password link for an admin. The token rides the
 * existing reset-token columns (stored sha256-hashed, consumed by POST
 * /auth/reset-password, which clears it and revokes sessions), only with a
 * longer expiry. No password is ever generated, stored in clear or mailed.
 */
@Injectable()
export class AdminPasswordLinkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly producer: RabbitMQProducerService,
  ) {}

  async issue(params: IssueAdminPasswordLinkParams): Promise<void> {
    const token = randomBytes(32).toString('hex');
    const now = new Date();

    const writes = [
      this.prisma.user.update({
        where: { id: params.userId },
        data: {
          passwordResetToken: hashToken(token),
          passwordResetExpires: new Date(now.getTime() + ADMIN_PASSWORD_LINK_TTL_MS),
          ...(params.invalidateCredentials
            ? { passwordHash: null, failedLoginAttempts: 0, lockedUntil: null }
            : {}),
        },
      }),
      // Same revocation as reset-password.handler.ts: admin refresh tokens read these rows.
      ...(params.invalidateCredentials
        ? [
            this.prisma.userSession.updateMany({
              where: { userId: params.userId, revokedAt: null },
              data: { isActive: false, revokedAt: now },
            }),
          ]
        : []),
    ];
    await this.prisma.$transaction(writes);

    await this.producer.emit(ADMIN_PASSWORD_LINK_EVENT, {
      email: params.email,
      name: params.fullName,
      token,
      kind: params.kind,
      roleName: params.roleName,
      // Platform brand block: without one the notification falls back to FRONTEND_URL links.
      brand: { name: 'YBB Platform' },
    });
  }
}
