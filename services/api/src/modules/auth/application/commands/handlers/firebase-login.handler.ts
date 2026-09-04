import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Ambassador, ApplicationCategory } from '@prisma/client';
import { FirebaseLoginCommand } from '../firebase-login.command';
import { AuthResponseDto } from '../../../presentation/dto/auth-response.dto';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { UnitOfWork } from '../../../../../shared/infrastructure/database/unit-of-work.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { FirebaseAuthService } from '../../../infrastructure/services/firebase-auth.service';
import { AuthLoggingService } from '../../services/auth-logging.service';
import { GeoIpService } from '@shared/infrastructure/geoip/geoip.service';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';
import { isLockedOut } from '../../services/account-lockout.util';
import {
  ensureProgramApplication,
  resolveAuthTargetProgram,
  toProgramRegistrationInfo,
} from '../../services/auth-program-linking.util';
import { normalizeReferralCode } from '@modules/participants/application/utils/referral-code.util';

@Injectable()
export class FirebaseLoginHandler {
  private readonly logger = new Logger(FirebaseLoginHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly unitOfWork: UnitOfWork,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly firebaseAuthService: FirebaseAuthService,
    private readonly authLoggingService: AuthLoggingService,
    private readonly geoIpService: GeoIpService,
    private readonly metricsService: MetricsService,
  ) { }

  private async resolveBrandId(brandId?: string, domain?: string): Promise<string> {
    if (brandId) {
      return brandId;
    }

        if (!domain) {
            const defaultCategory = await this.prisma.brand.findFirst({
                where: { isActive: true },
                orderBy: { createdAt: 'asc' },
                select: { id: true },
            });

            if (!defaultCategory) {
                throw new BadRequestException('No active program category found.');
            }

            return defaultCategory.id;
        }

        let brand = await this.prisma.brand.findFirst({
            where: {
                websiteUrl: domain,
                isActive: true,
            },
            select: { id: true },
        });

        if (!brand) {
            brand = await this.prisma.brand.findFirst({
                where: {
                    websiteUrl: { contains: domain, mode: 'insensitive' },
                    isActive: true,
                },
                select: { id: true },
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

  /**
   * Attribute an ambassador referral to a participant that ALREADY exists.
   * Covers returning users who click a share link, then log in via OAuth — the
   * new-participant branch never runs for them, so without this they lose attribution.
   *
   * Mirrors the attribution logic in complete-onboarding.handler.ts:
   *  - only attribute if the participant has NO ambassador referral yet (idempotent)
   *  - validate the ambassador by referralCode + isActive
   *  - create the link, increment totalReferrals/lastReferralAt, persist the code
   * The create + increment + code-update run in a single $transaction, so the
   * unique [ambassadorId, participantId] constraint rolls everything back on a
   * race/retry — never a double-create or double-increment.
   */
  private async attributeExistingParticipantReferral(
    participantId: string,
    referralCode: string,
  ): Promise<void> {
    // Idempotency guard: a participant gets at most one referral, ever.
    const existingReferral = await this.prisma.ambassadorReferral.findFirst({
      where: { participantId },
      select: { id: true },
    });
    if (existingReferral) {
      return;
    }

    // Codes are STORED uppercase and the column is a plain VarChar with no
    // citext, so Postgres compares them case-sensitively: a participant who
    // types their code in lower case matches zero rows and the referral is
    // silently dropped. register.handler.ts has always normalised here; the
    // OAuth path never did.
    const ambassador = await this.prisma.ambassador.findUnique({
      where: { referralCode: normalizeReferralCode(referralCode), isActive: true },
    });
    if (!ambassador) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.ambassadorReferral.create({
        data: {
          ambassadorId: ambassador.id,
          participantId,
          status: 'referred',
        },
      }),
      this.prisma.ambassador.update({
        where: { id: ambassador.id },
        data: {
          totalReferrals: { increment: 1 },
          lastReferralAt: new Date(),
        },
      }),
      this.prisma.participant.update({
        where: { id: participantId },
        // The ambassador's own code, not the raw typed one, so the stored value
        // matches the ambassador actually credited.
        data: { referralCode: ambassador.referralCode },
      }),
    ]);
  }

  async execute(command: FirebaseLoginCommand, domain?: string): Promise<AuthResponseDto> {
    // 1. Verify Token
    const decodedToken = await this.firebaseAuthService.verifyIdToken(command.idToken);
    const { email, uid, picture, firebase } = decodedToken;
    let providerName = firebase.sign_in_provider.split('.')[0]; // e.g. 'google.com' -> 'google'

    // Map 'password' provider from Firebase to 'local'
    if (providerName === 'password') {
        providerName = 'local';
    }

    if (!email) {
      throw new BadRequestException('Email is required from OAuth provider.');
    }

    // 2. Resolve Program Category
    const brandId = await this.resolveBrandId(command.brandId, domain);

    // 3. Find Auth Provider (By ID or Name from token)
    let authProvider;
    if (command.providerId) {
        authProvider = await this.prisma.authProvider.findUnique({
            where: { id: command.providerId },
        });
    } else {
        // Fallback: Resolve from token's provider name
        authProvider = await this.prisma.authProvider.findUnique({
            where: { name: providerName },
        });
    }

    if (!authProvider) {
      throw new BadRequestException(`Authentication provider ${command.providerId || providerName} not found or unsupported.`);
    }

    // Optional: Validate that the token provider matches the DB provider name if necessary
    // e.g. if providerName === 'google' but authProvider.name !== 'google' -> Warning?
    // For now we trust the ID token verification + the explicit provider ID intent.
    
    // 4. Check for existing User Identity
    let userIdentity = await this.prisma.userIdentity.findFirst({
        where: {
            brandId,
            providerId: authProvider.id,
            providerUserId: uid
        },
        include: { user: true }
    });

    let user = userIdentity?.user;

    // 5. If no identity linked, check if user exists by email (Auto-link)
    // existingUser is resolved but NOT yet assigned into `user` / auto-linked
    // here - see the guard immediately below, which must run before the
    // auto-link side effect (userIdentity.create), not after it.
    let existingUser: typeof user | null = null;
    if (!user) {
        existingUser = await this.prisma.user.findFirst({
            where: {
                email: { equals: email, mode: 'insensitive' },
                brandId: brandId,
                deletedAt: null,
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    // A soft-deleted or deactivated account must not be able to complete a
    // login at all - checked before either resolved-user side effect below
    // (auto-link identity creation, or new-user registration never running
    // because a real account was found). Two lookups can produce a `user`
    // here:
    //  - the identity lookup above (userIdentity.findFirst with
    //    include: { user: true }), which bypasses the soft-delete extension
    //    entirely - Prisma rejects a `where` on a to-one relation include, so
    //    PrismaService deliberately skips injecting deletedAt there (see
    //    prisma.service.ts) - a deleted user's identity still resolves to
    //    their real user row.
    //  - the by-email fallback just above, which filters deletedAt but not
    //    isActive (an admin-deactivated or approved-for-deletion account is
    //    not soft-deleted yet, only isActive:false, until the purge job runs).
    // Without this check either path would mint a fully valid JWT below and
    // only get rejected on the NEXT request, by JwtStrategy.validate. Mirrors
    // reset-password.handler.ts, which folds the same check into its lookup
    // rather than as an afterthought.
    const resolvedUser = user ?? existingUser;
    if (resolvedUser && (resolvedUser.deletedAt || !resolvedUser.isActive)) {
        throw new UnauthorizedException('Account is not active');
    }

    if (existingUser) {
        user = existingUser;
        // Auto-link existing user
        userIdentity = await this.prisma.userIdentity.create({
            data: {
                userId: user.id,
                brandId,
                providerId: authProvider.id,
                providerUserId: uid,
                providerEmail: email,
                isPrimary: false,
            },
            include: { user: true }
        });
    }

    // 6. If still no user, REGISTER new user
    if (!user) {
        try {
            user = await this.prisma.user.create({
                data: {
                    email: email,
                    brandId: brandId,
                    emailVerified: decodedToken.email_verified || false,
                    emailVerifiedAt: decodedToken.email_verified ? new Date() : null,
                    isActive: true,
                    identities: {
                        create: {
                            brandId,
                            providerId: authProvider.id,
                            providerUserId: uid,
                            providerEmail: email,
                            isPrimary: true,
                        }
                    }
                }
            });
        } catch (error) {
            if (error.code === 'P2003') { // Prisma Foreign Key Constraint failed
                 throw new BadRequestException(`Invalid Program Category ID: ${brandId}. Please provide a valid ID or leave it empty to use the default.`);
            }
            throw error;
        }
        
        // Log registration
        this.metricsService.userRegistrationsTotal.inc({ provider: providerName, brand: brandId });
    }

    // 6.5. Ensure Participant Exists & Handle Program Linking (Auto-Registration Logic for ALL users)
    let applicationResult: Awaited<ReturnType<typeof ensureProgramApplication>> | undefined;

    try {
        // Check for existing participant profile
        let participant = await this.prisma.participant.findUnique({
             where: { userId: user.id }
        });

        // Create Participant Profile if missing
        if (!participant) {
            // Check for Referral Code
            let ambassador: Ambassador | null = null;
            if (command.referralCode) {
                const foundAmbassador = await this.prisma.ambassador.findUnique({
                    where: { referralCode: normalizeReferralCode(command.referralCode) }
                });
                
                if (foundAmbassador && foundAmbassador.isActive) {
                    ambassador = foundAmbassador;
                }
            }

            // The provider's display name is a real name and worth keeping.
            // Falling back to the email local part is not: it fails the
            // onboarding validators (@IsEnglishName forbids digits) and the
            // onboarding form prefills from this column, so it deadlocks the
            // submit. Leave it blank for onboarding to fill instead.
            const fullName = decodedToken.name || '';

            // ========================================
            // Unit of Work: Participant Creation with Referral
            // Participant creation + ambassador referral must be atomic
            // ========================================
            participant = await this.unitOfWork.execute(async (repos) => {
                const newParticipant = await repos.tx.participant.create({
                    data: {
                        userId: user.id,
                        fullName: fullName,
                        // Normalised, not raw: keeps the record of what was typed
                        // (so an unmatched code is still visible to support) while
                        // making the column joinable against ambassadors.
                        referralCode: normalizeReferralCode(command.referralCode) || null,
                        profileCompletionPercentage: 0,
                        knowledgeSource: 'Other',
                    }
                });

                // Link Ambassador Relationship
                if (ambassador) {
                    await repos.createAmbassadorReferral({
                        participantId: newParticipant.id,
                        ambassadorId: ambassador.id,
                        referredAt: new Date(),
                    });

                    await repos.incrementAmbassadorReferrals(ambassador.id);
                }

                return newParticipant;
            }, { name: 'firebase-login-participant-creation', timeout: 5000 });
        } else if (command.referralCode) {
            // Returning user with an existing participant profile: the new-participant
            // branch above never runs, so attribute the referral here. Idempotent +
            // best-effort — a failure must not break login OR the program linking below.
            try {
                await this.attributeExistingParticipantReferral(participant.id, command.referralCode);
            } catch (e) {
                this.logger.warn(`Failed to attribute referral for existing participant ${participant.id}: ${e.message}`);
            }
        }

        // Handle Program Auto-Registration
        // We only auto-register if the participant has NO applications for this Program Category
        // OR if a specific program was requested.

        const requestedProgram = await resolveAuthTargetProgram(this.prisma, {
            brandId,
            programId: command.programId,
            programSlug: command.programSlug,
        });

        const existingBrandApplication = await this.prisma.participantApplication.findFirst({
            where: {
                participantId: participant.id,
                program: {
                    brandId,
                },
            },
            select: { id: true },
        });

        applicationResult = await ensureProgramApplication(this.prisma, {
            participantId: participant.id,
            brandId,
            programId: requestedProgram?.id,
            applicationCategory: command.applicationCategory,
            fallbackToLatestOpenProgram: !requestedProgram && !existingBrandApplication,
        });

        if (applicationResult.status === 'created') {
            this.logger.log(
                `Auto-linked user ${user.id} to program ${applicationResult.program.name} (${applicationResult.program.id})`,
            );
        } else if (applicationResult.status === 'closed') {
            this.logger.warn(
                `Registration closed for program ${applicationResult.program.id} at auth time (userId: ${user.id})`,
            );
        }

    } catch (e) {
        this.logger.error(`Failed to handle post-auth logic for user ${user.id}: ${e.message}`, e.stack);
        // Non-blocking, return auth success even if referral/program link fails
    }

    // 7. Login Logic (Generate Tokens)

    // Reset failed attempts if any — but NOT while a lockout is running.
    // A Firebase sign-in is not a password guess, so no failures are counted
    // here; it must still not be a way to wipe the counter that /login and
    // /ambassador-login are busy accumulating. Clearing it mid-lockout hands
    // the guesser a fresh MAX_FAILED_LOGIN_ATTEMPTS the moment lockedUntil
    // expires, which is the control quietly refunding itself. lockedUntil is
    // deliberately left alone either way: only a successful password login
    // clears the lock.
    if (user.failedLoginAttempts > 0 && !isLockedOut(user)) {
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

    // Session id is minted BEFORE the token so the access token can carry it
    // as `sid`. Without it logout has no session to name (see LogoutHandler).
    const sessionToken = randomUUID();

    // Generate JWT
    const accessTokenPayload = {
      sub: user.id,
      email: user.email,
      brandId: user.brandId,
      jti: randomUUID(),
      sid: sessionToken,
      type: 'access' as const,
    };

    const refreshTokenPayload = {
      sub: user.id,
      email: user.email,
      brandId: user.brandId,
      jti: randomUUID(),
      type: 'refresh' as const,
    };

    const accessToken = this.jwtService.sign(accessTokenPayload, { expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '1h') });
    const refreshToken = this.jwtService.sign(refreshTokenPayload, { expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') });

    // Create Session
    const agentInfo = this.parseUserAgent(command.userAgent);
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
                  brandId: brandId // Scope to current category context
                }
              },
              include: {
                program: true
              },
              // Deterministic pick for availableIds[0] on the frontend's
              // program selector: without an order, Postgres returns rows in
              // whatever order it pleases, which can flip which program a
              // multi-program participant lands on between requests.
              orderBy: { createdAt: 'desc' }
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
        brandId: user.brandId,
        isActive: user.isActive,
        isOnboardingCompleted: user.isOnboardingCompleted ?? false,
        registeredPrograms,
      },
      programRegistration: applicationResult ? toProgramRegistrationInfo(applicationResult) : undefined,
    };
  }
}
