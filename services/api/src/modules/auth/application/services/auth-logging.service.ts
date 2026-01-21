import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RiskLevel } from '@prisma/client';

@Injectable()
export class AuthLoggingService {
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

  async logFailedLogin(email: string, ipAddress: string, userAgent: string, reason: string) {
    // Find user ID if possible, otherwise null
    const user = await this.prisma.user.findFirst({
        where: { email },
        select: { id: true }
    });

    await this.prisma.userSecurityLog.create({
      data: {
        userId: user?.id,
        eventType: 'LOGIN_FAILED',
        eventStatus: 'FAILURE',
        eventDescription: `Failed login attempt: ${reason}`,
        ipAddress,
        userAgent,
        riskLevel: RiskLevel.medium,
        flagged: false, // Could flag if repeated
      },
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
}
