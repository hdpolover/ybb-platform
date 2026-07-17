import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LoginCommand } from '../login.command';
import { AuthResponseDto } from '../../../presentation/dto/auth-response.dto';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { AuthLoggingService } from '../../services/auth-logging.service';
import { GeoIpService } from '@shared/infrastructure/geoip/geoip.service';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';
import {
  ensureParticipantExists,
  ensureProgramApplication,
  toProgramRegistrationInfo,
} from '../../services/auth-program-linking.util';

@Injectable()
export class LoginHandler {
  private readonly logger = new Logger(LoginHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authLoggingService: AuthLoggingService,
    private readonly geoIpService: GeoIpService,
    private readonly metricsService: MetricsService,
  ) { }

  /**
   * Helper to fetch Registered Programs
   */
  private async getRegisteredPrograms(userId: string, brandId: string) {
    const userData = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        participant: {
          include: {
            applications: {
              where: {
                program: {
                  brandId: brandId 
                }
              },
              include: {
                program: true
              }
            }
          }
        }
      }
    });

    return userData?.participant?.applications.map(app => ({
      programId: app.programId,
      programName: app.program.name,
      programSlug: app.program.slug,
      year: app.program.year,
      applicationId: app.id,
      applicationStatus: app.status
    })) || [];
  }

  /**
   * Resolve domain to brandId
   * Similar logic to landing.service.ts resolveBrand method
   */
  private async resolveBrandId(brandId?: string, domain?: string): Promise<string> {
    // If brandId is explicitly provided, use it
    if (brandId) {
      return brandId;
    }

    // If no brandId and no domain, try to get default brand
    if (!domain) {
      const defaultBrand = await this.prisma.brand.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true }
      });

      if (!defaultBrand) {
        throw new BadRequestException('No active brand found. Please provide brandId or use a valid domain.');
      }

      return defaultBrand.id;
    }

    // Try to find brand by domain
    // First try exact match
    let brand = await this.prisma.brand.findFirst({
      where: { 
        websiteUrl: domain,
        isActive: true 
      },
      select: { id: true }
    });

    // If not found, try contains match (handles subdomains and protocols)
    if (!brand) {
      brand = await this.prisma.brand.findFirst({
        where: {
          websiteUrl: { contains: domain, mode: 'insensitive' },
          isActive: true
        },
        select: { id: true }
      });
    }

    if (!brand) {
      throw new BadRequestException(`No brand found for domain: ${domain}. Please provide brandId.`);
    }

    return brand.id;
  }

  private parseUserAgent(ua: string) {
    let browser = 'Unknown';
    let os = 'Unknown';
    let deviceType = 'Desktop';

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

  async execute(command: LoginCommand, domain?: string): Promise<AuthResponseDto> {
    // Resolve brandId from command or domain
    const brandId = await this.resolveBrandId(command.brandId, domain);
    
    // Find user by email and brandId (brand-scoped, case-insensitive)
    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: command.email, mode: 'insensitive' },
        brandId: brandId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
      include: {
        brand: true,
        identities: {
          include: {
            provider: true,
          },
        },
        admin: {
          include: {
            adminBrands: true
          }
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is not active');
    }

    // Email verification policy: program-level is authoritative when a program
    // is in scope (programId or programSlug resolved to a brand-matched program);
    // brand-level is the fallback for brand-wide auth flows with no program.
    // NOTE: this field is read uncached from Prisma. If a cache layer is added
    // later, invalidate on PUT /v1/brands/:id/settings and PUT /v1/programs/:id.
    let programInScope: { requireEmailVerification: boolean } | null = null;

    if (command.programId) {
      const selectedProgram = await this.prisma.program.findUnique({
        where: { id: command.programId },
        select: {
          brandId: true,
          requireEmailVerification: true,
        },
      });

      if (selectedProgram && selectedProgram.brandId === brandId) {
        programInScope = { requireEmailVerification: selectedProgram.requireEmailVerification };
      }
    } else if (command.programSlug) {
      const selectedProgram = await this.prisma.program.findUnique({
        where: {
          brandId_slug: {
            brandId,
            slug: command.programSlug,
          },
        },
        select: {
          requireEmailVerification: true,
        },
      });

      if (selectedProgram) {
        programInScope = { requireEmailVerification: selectedProgram.requireEmailVerification };
      }
    }

    const requiresEmailVerification = programInScope
      ? programInScope.requireEmailVerification
      : user.brand.requireEmailVerification;

    // Check if email is verified (if required by effective policy)
    if (requiresEmailVerification && !user.emailVerified) {
      throw new UnauthorizedException('Email not verified. Please verify your email before logging in.');
    }

    // Check if user has local auth identity
    const localIdentity = user.identities.find(i => i.provider.name === 'local');
    
    if (!localIdentity && !user.passwordHash) {
      throw new UnauthorizedException('Local authentication not configured. Please use OAuth provider.');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      command.password,
      user.passwordHash || '',
    );

    if (!isPasswordValid) {
      // Update failed login attempts
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: user.failedLoginAttempts + 1,
          lastFailedLogin: new Date(),
        },
      });

      await this.authLoggingService.logFailedLogin(user.email, command.ipAddress, command.userAgent, 'Invalid Password');

      this.metricsService.loginTotal.inc({ method: 'email', result: 'failure' });

      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed login attempts on successful login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lastLoginAt: new Date(),
      },
    });

    const participant = await ensureParticipantExists(this.prisma, user.id, user.email);
    const applicationResult = await ensureProgramApplication(this.prisma, {
      participantId: participant.id,
      brandId,
      programId: command.programId,
      programSlug: command.programSlug,
    });

    if (applicationResult.status === 'closed') {
      this.logger.warn(
        `Registration closed for program ${applicationResult.program.id} at login time (userId: ${user.id})`,
      );
    }

    // Log success
    await this.authLoggingService.logSuccessfulLogin(user.id, command.ipAddress, command.userAgent);
    
    this.metricsService.loginTotal.inc({ method: 'email', result: 'success' });

    // Update identity last used
    if (localIdentity) {
      await this.prisma.userIdentity.update({
        where: { id: localIdentity.id },
        data: { lastUsedAt: new Date() },
      });
    }

    // Determine roles
    const roles: string[] = [];
    if (user.admin) {
      roles.push('admin');
      const brandRole = user.admin.adminBrands.find(
        (apc) => apc.brandId === user.brandId,
      );
      if (brandRole && brandRole.roleInBrand) {
        roles.push(brandRole.roleInBrand);
      }
    }

    // Generate JWT tokens with unique JTI for blacklisting support
    const accessTokenPayload = {
      sub: user.id,
      email: user.email,
      brandId: user.brandId,
      jti: randomUUID(), // Unique token ID for blacklisting
      roles: roles,
    };

    const refreshTokenPayload = {
      sub: user.id,
      email: user.email,
      brandId: user.brandId,
      jti: randomUUID(), // Different JTI for refresh token
    };

    const accessToken = this.jwtService.sign(accessTokenPayload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '1h'),
    });

    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    // Create User Session
    const agentInfo = this.parseUserAgent(command.userAgent);
    const sessionToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    const geoCtx = this.geoIpService.lookup(command.ipAddress);

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        sessionToken,
        refreshToken,
        deviceType: agentInfo.deviceType,
        deviceName: `${agentInfo.browser} on ${agentInfo.os}`,
        browser: agentInfo.browser,
        operatingSystem: agentInfo.os,
        ipAddress: command.ipAddress,
        expiresAt,
        country: geoCtx.country,
        city: geoCtx.city,
      }
    });

    const registeredPrograms = await this.getRegisteredPrograms(user.id, user.brandId);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        brandId: user.brandId,
        isActive: user.isActive,
        isOnboardingCompleted: user.isOnboardingCompleted ?? false,
        registeredPrograms,
      },
      programRegistration: toProgramRegistrationInfo(applicationResult),
    };
  }
}
