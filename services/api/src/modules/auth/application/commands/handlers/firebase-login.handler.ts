import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { FirebaseLoginCommand } from '../firebase-login.command';
import { AuthResponseDto } from '../../../presentation/dto/auth-response.dto';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { FirebaseAuthService } from '../../../infrastructure/services/firebase-auth.service';
import { AuthLoggingService } from '../../services/auth-logging.service';
import { GeoIpService } from '@shared/infrastructure/geoip/geoip.service';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';

@Injectable()
export class FirebaseLoginHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly firebaseAuthService: FirebaseAuthService,
    private readonly authLoggingService: AuthLoggingService,
    private readonly geoIpService: GeoIpService,
    private readonly metricsService: MetricsService,
  ) { }

  private async resolveProgramCategoryId(programCategoryId?: string, domain?: string): Promise<string> {
    if (programCategoryId) {
      return programCategoryId;
    }
    // Default fallback to first active category if nothing provided
    // Ideally this logic should be shared or more robust
    const defaultCategory = await this.prisma.programCategory.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true }
    });
    
    if (!defaultCategory) {
      throw new BadRequestException('No active program category found.');
    }
    return defaultCategory.id;
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

  async execute(command: FirebaseLoginCommand, domain?: string): Promise<AuthResponseDto> {
    // 1. Verify Token
    const decodedToken = await this.firebaseAuthService.verifyIdToken(command.idToken);
    const { email, uid, picture, firebase } = decodedToken;
    const providerName = firebase.sign_in_provider.split('.')[0]; // e.g. 'google.com' -> 'google'

    if (!email) {
      throw new BadRequestException('Email is required from OAuth provider.');
    }

    // 2. Resolve Program Category
    const programCategoryId = await this.resolveProgramCategoryId(command.programCategoryId, domain);

    // 3. Find Auth Provider
    const authProvider = await this.prisma.authProvider.findUnique({
      where: { name: providerName },
    });

    if (!authProvider) {
      // Create if doesn't exist or throw? Better to assume seed created it, but helper creation is nice.
      // For now, fail if not supported
      // Or fallback to 'google' if generic
      throw new BadRequestException(`Authentication provider '${providerName}' is not supported.`);
    }

    // 4. Check for existing User Identity
    let userIdentity = await this.prisma.userIdentity.findFirst({
        where: {
            providerId: authProvider.id,
            providerUserId: uid
        },
        include: { user: true }
    });

    let user = userIdentity?.user;

    // 5. If no identity linked, check if user exists by email (Auto-link)
    if (!user) {
        const existingUser = await this.prisma.user.findFirst({
            where: {
                email: email,
                programCategoryId: programCategoryId
            }
        });

        if (existingUser) {
            user = existingUser;
            // Auto-link existing user
            userIdentity = await this.prisma.userIdentity.create({
                data: {
                    userId: user.id,
                    providerId: authProvider.id,
                    providerUserId: uid,
                    providerEmail: email,
                    isPrimary: false,
                },
                include: { user: true }
            });
        }
    }

    // 6. If still no user, REGISTER new user
    if (!user) {
        user = await this.prisma.user.create({
            data: {
                email: email,
                programCategoryId: programCategoryId,
                emailVerified: decodedToken.email_verified || false,
                emailVerifiedAt: decodedToken.email_verified ? new Date() : null,
                isActive: true,
                identities: {
                    create: {
                        providerId: authProvider.id,
                        providerUserId: uid,
                        providerEmail: email,
                        isPrimary: true,
                    }
                }
            }
        });
        
        // Log registration
        this.metricsService.userRegistrationsTotal.inc({ provider: providerName, program_category: programCategoryId });
    }

    // 7. Login Logic (Generate Tokens)
    
    // Reset failed attempts if any
    if (user.failedLoginAttempts > 0) {
        await this.prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lastLoginAt: new Date() }
        });
    } else {
        await this.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() }
        });
    }

    await this.authLoggingService.logSuccessfulLogin(user.id, command.ipAddress, command.userAgent);
    this.metricsService.loginTotal.inc({ method: providerName, result: 'success' });

    // Generate JWT
    const accessTokenPayload = {
      sub: user.id,
      email: user.email,
      programCategoryId: user.programCategoryId,
      jti: randomUUID(),
    };

    const refreshTokenPayload = {
      sub: user.id,
      email: user.email,
      programCategoryId: user.programCategoryId,
      jti: randomUUID(),
    };

    const accessToken = this.jwtService.sign(accessTokenPayload, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(refreshTokenPayload, { expiresIn: '7d' });

    // Create Session
    const agentInfo = this.parseUserAgent(command.userAgent);
    const sessionToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
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

    // 8. Fetch Registered Programs (User Participation)
    // We fetch this fresh from DB to be sure
    const userData = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        participant: {
          include: {
            applications: {
              where: {
                program: {
                  programCategoryId: programCategoryId // Scope to current category context
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

    const registeredPrograms = userData?.participant?.applications.map(app => ({
      programId: app.programId,
      programName: app.program.name,
      programSlug: app.program.slug,
      year: app.program.year,
      applicationId: app.id,
      applicationStatus: app.status
    })) || [];

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        programCategoryId: user.programCategoryId,
        isActive: user.isActive,
        isOnboardingCompleted: user.isOnboardingCompleted ?? false,
        registeredPrograms,
      },
    };
  }
}
