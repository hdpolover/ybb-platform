import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AmbassadorLoginCommand } from '../ambassador-login.command';
import { AuthResponseDto } from '../../../presentation/dto/auth-response.dto';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthLoggingService } from '../../services/auth-logging.service';
import { GeoIpService } from '@shared/infrastructure/geoip/geoip.service';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';
import { normalizeReferralCode } from '@modules/participants/application/utils/referral-code.util';

@Injectable()
export class AmbassadorLoginHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authLoggingService: AuthLoggingService,
    private readonly geoIpService: GeoIpService,
    private readonly metricsService: MetricsService,
  ) {}

  private async resolveBrandId(brandId?: string, domain?: string): Promise<string> {
    if (brandId) return brandId;

    if (!domain) {
      const defaultBrand = await this.prisma.brand.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!defaultBrand) throw new BadRequestException('No active brand found.');
      return defaultBrand.id;
    }

    const brand = await this.prisma.brand.findFirst({
      where: { websiteUrl: { contains: domain, mode: 'insensitive' }, isActive: true },
      select: { id: true },
    });
    if (!brand) throw new BadRequestException(`No brand found for domain: ${domain}`);
    return brand.id;
  }

  private parseUserAgent(ua: string) {
    let browser = 'Unknown', os = 'Unknown', deviceType = 'Desktop';
    if (/mobile/i.test(ua)) deviceType = 'Mobile';
    if (/windows/i.test(ua)) os = 'Windows';
    else if (/mac os/i.test(ua)) os = 'macOS';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/ios|iphone|ipad/i.test(ua)) os = 'iOS';
    if (/chrome/i.test(ua)) browser = 'Chrome';
    else if (/firefox/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
    else if (/edge/i.test(ua)) browser = 'Edge';
    return { browser, os, deviceType };
  }

  async execute(command: AmbassadorLoginCommand, domain?: string): Promise<AuthResponseDto> {
    const brandId = await this.resolveBrandId(command.brandId, domain);

    // Find user by email and brand (case-insensitive)
    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: command.email, mode: 'insensitive' },
        brandId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
      include: { brand: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify this user has an active ambassador record with matching referral code
    const ambassador = await this.prisma.ambassador.findFirst({
      where: {
        userId: user.id,
        referralCode: normalizeReferralCode(command.referralCode),
        isActive: true,
        deletedAt: null,
      },
    });

    if (!ambassador) {
      await this.authLoggingService.logFailedLogin(
        user.email,
        command.ipAddress,
        command.userAgent,
        'Invalid ambassador referral code',
      );
      this.metricsService.loginTotal.inc({ method: 'ambassador', result: 'failure' });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Log success
    await this.authLoggingService.logSuccessfulLogin(user.id, command.ipAddress, command.userAgent);
    this.metricsService.loginTotal.inc({ method: 'ambassador', result: 'success' });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lastLoginAt: new Date() },
    });

    // Generate JWT tokens
    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, brandId: user.brandId, jti: randomUUID(), roles: [], type: 'access' },
      { expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '1h') },
    );
    const refreshToken = this.jwtService.sign(
      { sub: user.id, email: user.email, brandId: user.brandId, jti: randomUUID(), type: 'refresh' },
      { expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') },
    );

    // Create session
    const agentInfo = this.parseUserAgent(command.userAgent);
    const geoCtx = this.geoIpService.lookup(command.ipAddress);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        sessionToken: randomUUID(),
        refreshToken,
        deviceType: agentInfo.deviceType,
        deviceName: `${agentInfo.browser} on ${agentInfo.os}`,
        browser: agentInfo.browser,
        operatingSystem: agentInfo.os,
        ipAddress: command.ipAddress,
        expiresAt,
        country: geoCtx.country,
        city: geoCtx.city,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        brandId: user.brandId,
        isActive: user.isActive,
        isOnboardingCompleted: user.isOnboardingCompleted ?? true,
        registeredPrograms: [],
      },
    };
  }
}
