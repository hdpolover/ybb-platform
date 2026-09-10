import { Injectable, UnauthorizedException, BadRequestException, Logger, Optional } from '@nestjs/common';
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
  getRegisteredPrograms,
  toProgramRegistrationInfo,
} from '../../services/auth-program-linking.util';
import { recordFailedAttempt, isLockedOut, LOCKED_OUT_MESSAGE } from '../../services/account-lockout.util';
import { hashToken } from '@shared/utils/hash-token.util';
import { MetaCapiService } from '@modules/meta/meta-capi.service';

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
    // MetaModule is @Global() — see meta.module.ts for why AuthModule doesn't
    // (and shouldn't) list it in `imports`. @Optional() so a missing MetaModule
    // degrades to "no conversion tracking" instead of failing login.
    @Optional() private readonly metaCapiService?: MetaCapiService,
  ) { }

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

    // Locked out from prior failed attempts
    if (isLockedOut(user)) {
      throw new UnauthorizedException(LOCKED_OUT_MESSAGE);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      command.password,
      user.passwordHash || '',
    );

    if (!isPasswordValid) {
      // Update failed login attempts
      await recordFailedAttempt(this.prisma, user.id);

      await this.authLoggingService.logFailedLogin(user.id, user.email, command.ipAddress, command.userAgent, 'Invalid Password');

      this.metricsService.loginTotal.inc({ method: 'email', result: 'failure' });

      throw new UnauthorizedException('Invalid credentials');
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

    // Session id is minted BEFORE the token so the access token can carry it
    // as `sid`. Without it logout has no session to name (see LogoutHandler).
    const sessionToken = randomUUID();

    // Generate JWT tokens with unique JTI for blacklisting support
    const accessTokenPayload = {
      sub: user.id,
      email: user.email,
      brandId: user.brandId,
      jti: randomUUID(), // Unique token ID for blacklisting
      roles: roles,
      sid: sessionToken,
      type: 'access' as const,
    };

    const refreshTokenPayload = {
      sub: user.id,
      email: user.email,
      brandId: user.brandId,
      jti: randomUUID(), // Different JTI for refresh token
      type: 'refresh' as const,
    };

    const accessToken = this.jwtService.sign(accessTokenPayload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '1h'),
    });

    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    // Session bookkeeping computed up front (all synchronous) so
    // userSession.create below has everything it needs to join the
    // Promise.all group rather than waiting on it.
    const agentInfo = this.parseUserAgent(command.userAgent);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration
    const geoCtx = this.geoIpService.lookup(command.ipAddress);

    // audit M128: these five post-auth writes were previously awaited one at
    // a time. Four are genuinely independent and now run concurrently:
    //   - resetting the failed-login counters
    //   - participant + program-application linking (kept sequential
    //     INTERNALLY — ensureProgramApplication needs participant.id from
    //     ensureParticipantExists, a real dependency, not parallelised)
    //   - the local identity's lastUsedAt stamp
    //   - the session row itself
    // logSuccessfulLogin is deliberately NOT a hard Promise.all member: a
    // logging failure must never fail a login, so its rejection is caught
    // and only logged, never rethrown.
    //
    // Known, accepted tradeoff: userSession.create now runs in the same
    // Promise.all as the other three writes, so if a sibling (the counter
    // reset or the participant/application chain) rejects, the session row
    // can still have been written for a login that ultimately throws and
    // returns 500. The client never receives the signed refresh token in
    // that case, so the exposure is an orphaned, unusable row, not a live
    // credential, and it self-expires in 7 days (`expiresAt` below). Do NOT
    // "fix" this by pulling userSession.create back into a serial chain —
    // user_sessions is already ~109MB in prod; the goal here is fewer
    // sequential round trips, not more rows written.
    const [, { participant, applicationResult }] = await Promise.all([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lastLoginAt: new Date(),
          lockedUntil: null,
        },
      }),
      (async () => {
        const participant = await ensureParticipantExists(this.prisma, user.id);
        const applicationResult = await ensureProgramApplication(this.prisma, {
          participantId: participant.id,
          brandId,
          programId: command.programId,
          programSlug: command.programSlug,
          metaCapiService: this.metaCapiService,
          userEmail: user.email,
          userId: user.id,
        });
        return { participant, applicationResult };
      })(),
      localIdentity
        ? this.prisma.userIdentity.update({
            where: { id: localIdentity.id },
            data: { lastUsedAt: new Date() },
          })
        : Promise.resolve(undefined),
      // Audit M144 (widened): userSession.refreshToken is stored hashed, not
      // as the raw JWT. admin-refresh.handler.ts is the only place that
      // looks this column up, and it dual-reads (hash first, plaintext
      // fallback) so sessions created before this deploy keep working and
      // self-migrate on their next refresh - see that handler for the
      // migration path.
      this.prisma.userSession.create({
        data: {
          userId: user.id,
          sessionToken,
          refreshToken: hashToken(refreshToken),
          deviceType: agentInfo.deviceType,
          deviceName: `${agentInfo.browser} on ${agentInfo.os}`,
          browser: agentInfo.browser,
          operatingSystem: agentInfo.os,
          ipAddress: command.ipAddress,
          expiresAt,
          country: geoCtx.country,
          city: geoCtx.city,
        }
      }),
      this.authLoggingService
        .logSuccessfulLogin(user.id, command.ipAddress, command.userAgent)
        .catch((err: unknown) => {
          this.logger.warn(
            `Failed to log successful login for user ${user.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }),
    ]);

    if (applicationResult.status === 'closed') {
      this.logger.warn(
        `Registration closed for program ${applicationResult.program.id} at login time (userId: ${user.id})`,
      );
    }

    this.metricsService.loginTotal.inc({ method: 'email', result: 'success' });

    const registeredPrograms = await getRegisteredPrograms(this.prisma, participant.id, user.brandId);

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
