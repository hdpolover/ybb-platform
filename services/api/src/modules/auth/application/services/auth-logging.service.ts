import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RiskLevel } from '@prisma/client';

@Injectable()
export class AuthLoggingService {
  private readonly logger = new Logger(AuthLoggingService.name);

  constructor(private readonly prisma: PrismaService) {}

  public parseUserAgent(ua: string) {
    let browser = 'Unknown';
    let os = 'Unknown';
    let deviceType = 'Desktop';

    if (!ua) return { browser, os, deviceType };

    if (/mobile/i.test(ua)) deviceType = 'Mobile';
    if (/tablet/i.test(ua)) deviceType = 'Tablet';

    if (/windows/i.test(ua)) os = 'Windows';
    else if (/mac os/i.test(ua)) os = 'macOS';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/ios|iphone|ipad/i.test(ua)) os = 'iOS';
    else if (/linux/i.test(ua)) os = 'Linux';

    if (/chrome/i.test(ua)) browser = 'Chrome';
    else if (/firefox/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
    else if (/edge/i.test(ua)) browser = 'Edge';

    return { browser, os, deviceType };
  }

  async logSuccessfulLogin(userId: string, ipAddress: string, userAgent: string) {
    // 1. Log Security Event
    await this.prisma.userSecurityLog.create({
      data: {
        userId,
        eventType: 'LOGIN_SUCCESS',
        eventStatus: 'SUCCESS',
        eventDescription: 'User logged in successfully',
        ipAddress,
        userAgent,
        riskLevel: RiskLevel.low,
      },
    });

    this.logger.log({
        message: 'User logged in successfully',
        userId,
        ipAddress,
        userAgent,
    });

    // 2. Log Activity
    const agentInfo = this.parseUserAgent(userAgent);
    await this.prisma.userActivityLog.create({
      data: {
        userId,
        activityType: 'LOGIN',
        activityCategory: 'AUTH',
        activityData: {
          ip: ipAddress,
          browser: agentInfo.browser,
          os: agentInfo.os,
        },
        ipAddress,
        userAgent,
        deviceType: agentInfo.deviceType,
      },
    });
  }

  // Audit M138: this used to re-derive the user via an unscoped,
  // case-sensitive findFirst(email) with no orderBy, so the attributed
  // userId was nondeterministic whenever duplicate-case emails existed and
  // could silently miss a match entirely on case mismatch. Every caller
  // (login.handler, admin-login.handler, ambassador-login.handler) already
  // has the loaded user row in scope at the call site, so userId is passed
  // in directly instead of re-derived by lookup.
  async logFailedLogin(userId: string | null, email: string, ipAddress: string, userAgent: string, reason: string) {
    await this.prisma.userSecurityLog.create({
      data: {
        userId: userId ?? undefined,
        eventType: 'LOGIN_FAILED',
        eventStatus: 'FAILURE',
        eventDescription: `Failed login attempt: ${reason}`,
        ipAddress,
        userAgent,
        riskLevel: RiskLevel.medium,
        flagged: false, // Could flag if repeated
      },
    });

    this.logger.warn({
        message: 'Failed login attempt',
        reason,
        email,
        ipAddress,
        userAgent,
    });
  }

  async logRegistration(userId: string, method: string, ipAddress: string, userAgent: string) {
    await this.prisma.userActivityLog.create({
        data: {
            userId,
            activityType: 'REGISTER',
            activityCategory: 'AUTH',
            activityData: {
                method,
                ip: ipAddress,
            },
            ipAddress,
            userAgent,
            deviceType: this.parseUserAgent(userAgent).deviceType,
        }
    });

    await this.prisma.userSecurityLog.create({
        data: {
            userId,
            eventType: 'REGISTER',
            eventStatus: 'SUCCESS',
            eventDescription: `User registered via ${method}`,
            ipAddress,
            userAgent,
            riskLevel: RiskLevel.low,
        }
    });
  }

  async logEmailVerification(userId: string, ipAddress: string = '0.0.0.0', userAgent: string = 'unknown') {
    const agentInfo = this.parseUserAgent(userAgent);
    await this.prisma.userActivityLog.create({
      data: {
        userId,
        activityType: 'VERIFY_EMAIL',
        activityCategory: 'AUTH',
        activityData: {},
        ipAddress,
        userAgent,
        deviceType: agentInfo.deviceType,
      },
    });

    await this.prisma.userSecurityLog.create({
      data: {
        userId,
        eventType: 'EMAIL_VERIFIED',
        eventStatus: 'SUCCESS',
        eventDescription: 'Email address verified successfully',
        ipAddress,
        userAgent,
        riskLevel: RiskLevel.low,
      },
    });
  }

  /**
   * `userId` is the account the caller already resolved for this email, or null
   * when it resolved to none. The email lookup below is a fallback for callers
   * that have neither: it is case-insensitive but NOT brand-scoped, so with the
   * same address registered under two brands it attributes the request to
   * whichever account is older (audit M138). Pass the id when you have it.
   */
  async logForgotPasswordRequest(
    email: string,
    ipAddress: string = '0.0.0.0',
    userAgent: string = 'unknown',
    userId?: string | null,
  ) {
    const user = userId !== undefined
      ? (userId === null ? null : { id: userId })
      : await this.prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    const agentInfo = this.parseUserAgent(userAgent);

    if (user) {
      await this.prisma.userActivityLog.create({
        data: {
          userId: user.id,
          activityType: 'FORGOT_PASSWORD_REQUEST',
          activityCategory: 'AUTH',
          activityData: { email },
          ipAddress,
          userAgent,
          deviceType: agentInfo.deviceType,
        },
      });
    }

    await this.prisma.userSecurityLog.create({
      data: {
        userId: user?.id,
        eventType: 'FORGOT_PASSWORD',
        eventStatus: 'SUCCESS',
        eventDescription: `Password reset requested for ${email}`,
        ipAddress,
        userAgent,
        riskLevel: RiskLevel.medium,
      },
    });
  }

  async logPasswordReset(userId: string, ipAddress: string = '0.0.0.0', userAgent: string = 'unknown') {
    const agentInfo = this.parseUserAgent(userAgent);
    await this.prisma.userActivityLog.create({
      data: {
        userId,
        activityType: 'PASSWORD_RESET',
        activityCategory: 'AUTH',
        activityData: {},
        ipAddress,
        userAgent,
        deviceType: agentInfo.deviceType,
      },
    });

    await this.prisma.userSecurityLog.create({
      data: {
        userId,
        eventType: 'PASSWORD_RESET',
        eventStatus: 'SUCCESS',
        eventDescription: 'Password successfully reset',
        ipAddress,
        userAgent,
        riskLevel: RiskLevel.high,
      },
    });
  }

  async logResendVerification(userId: string, ipAddress: string = '0.0.0.0', userAgent: string = 'unknown') {
    const agentInfo = this.parseUserAgent(userAgent);
    await this.prisma.userActivityLog.create({
      data: {
        userId,
        activityType: 'RESEND_VERIFICATION',
        activityCategory: 'AUTH',
        activityData: {},
        ipAddress,
        userAgent,
        deviceType: agentInfo.deviceType,
      },
    });
  }

  // Audit M125: resend-verification now returns one constant response
  // regardless of whether the email is registered or already verified (no
  // enumeration oracle), which means the handler can no longer log via
  // logResendVerification's userId-only signature on the miss path — there is
  // no user to attach it to. This mirrors logForgotPasswordRequest's shape:
  // looked up by email, logged on the hit AND miss/already-verified paths, so
  // an enumeration sweep against this endpoint stays visible in
  // userSecurityLog even though the HTTP response no longer reveals it.
  async logResendVerificationRequest(
    email: string,
    outcome: 'sent' | 'already-verified' | 'not-found',
    ipAddress: string = '0.0.0.0',
    userAgent: string = 'unknown',
  ) {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const agentInfo = this.parseUserAgent(userAgent);

    if (user) {
      await this.prisma.userActivityLog.create({
        data: {
          userId: user.id,
          activityType: 'RESEND_VERIFICATION',
          activityCategory: 'AUTH',
          activityData: { email, outcome },
          ipAddress,
          userAgent,
          deviceType: agentInfo.deviceType,
        },
      });
    }

    await this.prisma.userSecurityLog.create({
      data: {
        userId: user?.id,
        eventType: 'RESEND_VERIFICATION',
        eventStatus: 'SUCCESS',
        eventDescription: `Verification email resend requested for ${email} (${outcome})`,
        ipAddress,
        userAgent,
        riskLevel: RiskLevel.medium,
      },
    });
  }
}
