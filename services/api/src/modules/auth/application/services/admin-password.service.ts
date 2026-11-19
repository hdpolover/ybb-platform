// services/api/src/modules/auth/application/services/admin-password.service.ts
import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import {
  ADMIN_SELF_RESET_TTL_MS,
  AdminPasswordLinkService,
} from '../../../admins/application/services/admin-password-link.service';
import { AuthLoggingService } from './auth-logging.service';
import { isLockedOut, LOCKED_OUT_MESSAGE, recordFailedAttempt } from './account-lockout.util';

@Injectable()
export class AdminPasswordService {
  private readonly logger = new Logger(AdminPasswordService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly links: AdminPasswordLinkService,
    private readonly authLogging: AuthLoggingService,
  ) {}

  /**
   * Admin changes their own password. 400 (not 401) on a wrong current password: the dashboard
   * treats a 401 as an expired session and would bounce the admin to the login screen.
   */
  async changeOwnPassword(
    actor: CurrentUserData,
    currentPassword: string,
    newPassword: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ ok: true }> {
    // Impersonation tokens carry no adminId, so they are refused here too.
    if (!actor.adminId) throw new UnauthorizedException('Admin access required');

    const user = await this.prisma.user.findFirst({
      where: { id: actor.userId, isActive: true, deletedAt: null, admin: { isNot: null } },
      select: { id: true, passwordHash: true, lockedUntil: true },
    });
    if (!user?.passwordHash) throw new BadRequestException('Current password is incorrect');
    if (isLockedOut(user)) throw new BadRequestException(LOCKED_OUT_MESSAGE);

    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      // Counts toward the same lockout as login, so this form is not a free guessing oracle.
      await recordFailedAttempt(this.prisma, user.id);
      await this.authLogging.logFailedLogin(user.id, actor.email, ipAddress, userAgent, 'Wrong current password (admin change-password)');
      throw new BadRequestException('Current password is incorrect');
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw new BadRequestException('New password must be different from the current one');
    }

    const passwordHash = await bcrypt.hash(newPassword, await bcrypt.genSalt());
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          lastPasswordChange: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
          // A reset link requested before this change must not outlive it.
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      }),
      // Same revocation as reset-password.handler.ts, minus the session making this call.
      this.prisma.userSession.updateMany({
        where: { userId: user.id, revokedAt: null, ...(actor.sid ? { sessionToken: { not: actor.sid } } : {}) },
        data: { isActive: false, revokedAt: now },
      }),
    ]);

    await this.authLogging.logPasswordChange(user.id, ipAddress, userAgent);
    return { ok: true };
  }

  /**
   * Self-service reset request. Never throws on a miss. The only awaited work is the lookup; the
   * security-log write (2 rows on a hit, 1 on a miss) and the mail both run in the background, so
   * nothing awaited differs between hit and miss.
   */
  async requestReset(email: string, ipAddress: string, userAgent: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        isActive: true,
        deletedAt: null,
        admin: { is: { deactivatedAt: null, deletedAt: null } },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        passwordResetExpires: true,
        admin: { select: { fullName: true, role: { select: { name: true } } } },
      },
    });

    // Same trail as the participant forgot-password, on hit AND miss: it is what makes an
    // enumeration sweep visible. Not awaited: a hit writes more rows than a miss.
    void this.authLogging
      .logForgotPasswordRequest(email, ipAddress, userAgent, user?.id ?? null)
      .catch((err: unknown) => this.logger.warn(`Admin forgot-password audit log failed: ${String(err)}`));

    if (!user?.admin) return;
    // An anonymous request must not clobber a live token (a 72h invite would be replaced by a 1h
    // link). The owner waits for expiry, or an admin uses "Send password link".
    if (user.passwordResetExpires && user.passwordResetExpires > new Date()) return;

    void this.links
      .issue({
        userId: user.id,
        email: user.email,
        fullName: user.admin.fullName,
        kind: 'reset',
        roleName: user.admin.role?.name ?? null,
        // The old password keeps working until the link is used, so spamming this cannot lock anyone out.
        invalidateCredentials: false,
        ttlMs: ADMIN_SELF_RESET_TTL_MS,
        // Drives the "your current password still works" wording: untrue for a pending invitee.
        selfRequested: user.passwordHash !== null,
      })
      .catch((err: unknown) => this.logger.error(`Admin self-reset link failed for user ${user.id}: ${String(err)}`));
  }
}
