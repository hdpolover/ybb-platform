import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LoginCommand } from '../login.command';
import { AuthResponseDto } from '../../../presentation/dto/auth-response.dto';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthLoggingService } from '../../services/auth-logging.service';
import { GeoIpService } from '@shared/infrastructure/geoip/geoip.service';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';

@Injectable()
export class LoginHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly authLoggingService: AuthLoggingService,
    private readonly geoIpService: GeoIpService,
    private readonly metricsService: MetricsService,
  ) { }

  /**
   * Helper to fetch Registered Programs
   */
  private async getRegisteredPrograms(userId: string, programCategoryId: string) {
    const userData = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        participant: {
          include: {
            applications: {
              where: {
                program: {
                  programCategoryId: programCategoryId 
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
   * Resolve domain to programCategoryId
   * Similar logic to landing.service.ts resolveCategory method
   */
  private async resolveProgramCategoryId(programCategoryId?: string, domain?: string): Promise<string> {
    // If programCategoryId is explicitly provided, use it
    if (programCategoryId) {
      return programCategoryId;
    }

    // If no programCategoryId and no domain, try to get default category
    if (!domain) {
      const defaultCategory = await this.prisma.programCategory.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true }
      });

      if (!defaultCategory) {
        throw new BadRequestException('No active program category found. Please provide programCategoryId or use a valid domain.');
      }

      return defaultCategory.id;
    }

    // Try to find category by domain
    // First try exact match
    let category = await this.prisma.programCategory.findFirst({
      where: { 
        websiteUrl: domain,
        isActive: true 
      },
      select: { id: true }
    });

    // If not found, try contains match (handles subdomains and protocols)
    if (!category) {
      category = await this.prisma.programCategory.findFirst({
        where: {
          websiteUrl: { contains: domain, mode: 'insensitive' },
          isActive: true
        },
        select: { id: true }
      });
    }

    if (!category) {
      throw new BadRequestException(`No program category found for domain: ${domain}. Please provide programCategoryId.`);
    }

    return category.id;
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
    // Resolve programCategoryId from command or domain
    const programCategoryId = await this.resolveProgramCategoryId(command.programCategoryId, domain);
    
    // Find user by email and programCategoryId (brand-scoped)
    const user = await this.prisma.user.findUnique({
      where: {
        email_programCategoryId: {
          email: command.email,
          programCategoryId: programCategoryId,
        },
      },
      include: {
        programCategory: true,
        identities: {
          include: {
            provider: true,
          },
        },
        admin: {
          include: {
            adminProgramCategories: true
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

    // Check if email is verified (if required by program category)
    if (user.programCategory.requireEmailVerification && !user.emailVerified) {
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
      const brandRole = user.admin.adminProgramCategories.find(
        (apc) => apc.programCategoryId === user.programCategoryId,
      );
      if (brandRole && brandRole.roleInBrand) {
        roles.push(brandRole.roleInBrand);
      }
    }

    // Generate JWT tokens with unique JTI for blacklisting support
    const accessTokenPayload = {
      sub: user.id,
      email: user.email,
      programCategoryId: user.programCategoryId,
      jti: randomUUID(), // Unique token ID for blacklisting
      roles: roles,
    };

    const refreshTokenPayload = {
      sub: user.id,
      email: user.email,
      programCategoryId: user.programCategoryId,
      jti: randomUUID(), // Different JTI for refresh token
    };

    const accessToken = this.jwtService.sign(accessTokenPayload, {
      expiresIn: '1h',
    });

    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      expiresIn: '7d',
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

    const registeredPrograms = await this.getRegisteredPrograms(user.id, user.programCategoryId);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        programCategoryId: user.programCategoryId,
        isActive: user.isActive,
        // @ts-ignore
        isOnboardingCompleted: user.isOnboardingCompleted ?? false,
        registeredPrograms,
      },
    };
  }
}
