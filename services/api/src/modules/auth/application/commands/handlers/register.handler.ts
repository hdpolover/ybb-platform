import { Injectable, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { RegisterCommand } from '../register.command';
import { AuthResponseDto } from '../../../presentation/dto/auth-response.dto';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { UnitOfWork } from '../../../../../shared/infrastructure/database/unit-of-work.service';
import { RabbitMQProducerService } from '../../../../../shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { Ambassador } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthLoggingService } from '../../services/auth-logging.service';
import { normalizeReferralCode } from '@modules/participants/application/utils/referral-code.util';
import { MetricsService } from '../../../../../shared/infrastructure/monitoring/metrics.service';
import { GeoIpService } from '@shared/infrastructure/geoip/geoip.service';
import {
  ensureProgramApplication,
  resolveAuthTargetProgram,
  toProgramRegistrationInfo,
} from '../../services/auth-program-linking.util';

@Injectable()
export class RegisterHandler {
  private readonly logger = new Logger(RegisterHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly unitOfWork: UnitOfWork,
    private readonly jwtService: JwtService,
    private readonly rabbitmqProducer: RabbitMQProducerService,
    private readonly authLoggingService: AuthLoggingService,
    private readonly metricsService: MetricsService,
    private readonly geoIpService: GeoIpService,
    private readonly configService: ConfigService,
  ) {}

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
   * Similar logic to login handler
   */
  private async resolveBrandId(brandId?: string, domain?: string): Promise<string> {
    // If brandId is explicitly provided, use it
    if (brandId) {
      return brandId;
    }

    // If no brandId and no domain, try to get default category
    if (!domain) {
      const defaultCategory = await this.prisma.brand.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true }
      });

      if (!defaultCategory) {
        throw new BadRequestException('No active program category found. Please provide brandId or use a valid domain.');
      }

      return defaultCategory.id;
    }

    // Try to find category by domain
    // First try exact match
    let category = await this.prisma.brand.findFirst({
      where: { 
        websiteUrl: domain,
        isActive: true 
      },
      select: { id: true }
    });

    // If not found, try contains match (handles subdomains and protocols)
    if (!category) {
      category = await this.prisma.brand.findFirst({
        where: {
          websiteUrl: { contains: domain, mode: 'insensitive' },
          isActive: true
        },
        select: { id: true }
      });
    }

    if (!category) {
      throw new BadRequestException(`No program category found for domain: ${domain}. Please provide brandId.`);
    }

    return category.id;
  }

  async execute(command: RegisterCommand, domain?: string): Promise<AuthResponseDto> {
    // Validate provider exists and is active
    const authProvider = await this.prisma.authProvider.findUnique({
      where: { id: command.providerId },
    });

    if (!authProvider || !authProvider.isActive) {
      throw new BadRequestException(`Authentication provider is not available or inactive`);
    }

    // Resolve brandId from command or domain
    const brandId = await this.resolveBrandId(command.brandId, domain);

    // Check if program category exists
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
      include: {
        settings: true
      }
    });

    if (!brand || !brand.isActive) {
      throw new BadRequestException('Invalid program category');
    }

    // Resolve Target Program ID
    const targetProgram = await resolveAuthTargetProgram(this.prisma, {
      brandId,
      programId: command.programId,
      programSlug: command.programSlug,
      fallbackToLatestOpenProgram: true,
    });
    const targetProgramId = targetProgram?.id;

    // Check Ambassador Referral
    let ambassador: Ambassador | null = null;
    if (command.referralCode) {
        // Ambassadors belong to exactly one program, so a code only earns credit for
        // a referral into that program. Scope the lookup when the target program is
        // known; when it is not, stay unscoped rather than silently dropping a
        // legitimate referral (registration must proceed either way).
        ambassador = await this.prisma.ambassador.findFirst({
            where: {
                referralCode: normalizeReferralCode(command.referralCode),
                deletedAt: null,
                ...(targetProgramId ? { programId: targetProgramId } : {}),
            },
        });

        // If ambassador not found or inactive, we generally ignore or log warning,
        // but typically registration should proceed without referral.
        if (!ambassador || !ambassador.isActive) {
            this.logger.warn(
                `Referral code not applied: ${command.referralCode} `
                + `(unknown, inactive, or not an ambassador for program ${targetProgramId ?? 'unknown'})`,
            );
            ambassador = null;
        }
    }

    // Check if user already exists by email + brandId (case-insensitive)
    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: command.email, mode: 'insensitive' },
        brandId: brandId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
      include: {
        identities: {
          include: {
            provider: true,
          },
        },
      },
    });

    // For OAuth providers, check if identity already exists
    if (authProvider.name !== 'local' && command.providerUserId) {
      const existingIdentity = await this.prisma.userIdentity.findFirst({
        where: {
          brandId,
          providerId: authProvider.id,
          providerUserId: command.providerUserId,
        },
        include: {
          user: true,
        },
      });

      if (existingIdentity) {
        // The provider identity is already attached to an account. No ID token is
        // verified here, so returning tokens would hand that account to any caller
        // who can guess a providerUserId. OAuth sign-in goes through firebase-login,
        // which does verify the ID token.
        throw new ConflictException('An account with this email already exists. Please sign in.');
      }
    }

    // Fallback for providerUserId (Email usually for local, or if not provided)
    const providerUserIdToUse = command.providerUserId || command.email;

    if (user) {
      // An account already exists for this email in this brand. This endpoint is
      // unauthenticated and proves nothing about who is calling, so it must not
      // attach an identity to that account, overwrite its password, register it
      // into a program, or mint tokens for it. Sign-in is the only way in.
      throw new ConflictException('An account with this email already exists. Please sign in.');
    }

    // New user registration
    // Validate password for local authentication
    if (authProvider.name === 'local' && !command.password) {
      throw new BadRequestException('Password is required for local authentication');
    }

    // Hash password only for local authentication
    const passwordHash = authProvider.name === 'local' && command.password
      ? await bcrypt.hash(command.password, 10)
      : null;

    // Email Verification Logic
    let emailVerificationToken: string | null = null;
    let emailVerificationExpires: Date | null = null;
    
    // Default: OAuth verified, Local depends on setting
    let emailVerified = authProvider.isOAuth; 

    if (authProvider.name === 'local') {
      // Program-level setting wins when a program is in scope; brand-level is
      // the fallback. Read uncached — if a cache is added later, invalidate on
      // PUT /v1/brands/:id/settings and PUT /v1/programs/:id.
      const requiresEmailVerification = targetProgram
        ? targetProgram.requireEmailVerification
        : brand.requireEmailVerification;

      if (requiresEmailVerification) {
        emailVerified = false;
        emailVerificationToken = crypto.randomBytes(32).toString('hex');
        emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      } else {
        emailVerified = true;
      }
    }

    // ========================================
    // Unit of Work: User Registration with Full Profile Setup
    // All user creation, participant setup, and referral linking must succeed together
    // or rollback completely to prevent orphaned records
    // ========================================
    const newUser = await this.unitOfWork.execute(async (repos) => {
      const tx = repos.tx;
      
      // Create user with identity
      const user = await tx.user.create({
        data: {
          email: command.email,
          passwordHash,
          brandId: brandId,
          isActive: true,
          isOnboardingCompleted: false,
          emailVerified: emailVerified,
          emailVerificationToken,
          emailVerificationExpires,
          identities: {
            create: {
              brandId: brandId,
              providerId: authProvider.id,
              providerUserId: providerUserIdToUse,
              providerEmail: command.email,
              isPrimary: true,
              lastUsedAt: new Date(),
            },
          },
        },
      });

      // Create participant profile
      const participant = await tx.participant.create({
        data: {
          userId: user.id,
          // Blank until onboarding — see the note on the other participant
          // create in this handler.
          fullName: '',
          referralCode: ambassador?.referralCode, // Store valid referral code
        },
      });

      // Link ambassador referral if valid
      if (ambassador) {
        try {
          await repos.createAmbassadorReferral({
            participantId: participant.id,
            ambassadorId: ambassador.id,
            referredAt: new Date(),
          });

          // Increment ambassador stats
          await repos.incrementAmbassadorReferrals(ambassador.id);
        } catch (e) {
          // Log but don't fail the transaction for referral issues
          this.logger.error(`Failed to link ambassador: ${e.message}`);
          // Still continue - user registration is more important than referral
        }
      }

      return user;
    }, { name: 'user-registration', timeout: 10000 });

    const newParticipant = await this.prisma.participant.findUnique({
      where: { userId: newUser.id },
      select: { id: true },
    });

    let applicationResult: Awaited<ReturnType<typeof ensureProgramApplication>> | undefined;

    if (newParticipant) {
      applicationResult = await ensureProgramApplication(this.prisma, {
        participantId: newParticipant.id,
        brandId,
        programId: targetProgramId,
        applicationCategory: command.applicationCategory,
      });

      if (applicationResult.status === 'closed') {
        this.logger.warn(
          `Registration closed for program ${applicationResult.program.id} at auth time (userId: ${newUser.id})`,
        );
      }
    }

    // Send notifications
    if (authProvider.name === 'local' && emailVerificationToken) {
      // No name is collected at registration — onboarding does that — so send
      // none. The email local part is not a name: it addressed people as
      // "Hi owaiskhalifa56,". The notification service falls back to a
      // generic salutation when this is absent.
      this.rabbitmqProducer.emit('user.verify-email', {
        email: newUser.email,
        token: emailVerificationToken,
        brand: brand,
      });
    } else if (authProvider.isOAuth) {
      this.rabbitmqProducer.emit('user.registered', {
        email: newUser.email,
        brand: brand,
      });
    }

    // Generate JWT tokens with session tracking
    const accessTokenJti = crypto.randomUUID();
    const refreshTokenJti = crypto.randomUUID();

    const payload = {
      sub: newUser.id,
      email: newUser.email,
      brandId: newUser.brandId,
      jti: accessTokenJti,
      type: 'access' as const,
    };

    const refreshTokenPayload = {
        ...payload,
        jti: refreshTokenJti,
        type: 'refresh' as const,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '1h'),
    });

    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    // Create initial user session
    if (command.ipAddress && command.userAgent) {
        const agentInfo = this.authLoggingService.parseUserAgent(command.userAgent);
        const sessionToken = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        
        try {
          const geoCtx = this.geoIpService.lookup(command.ipAddress);
          await this.prisma.userSession.create({
              data: {
                  userId: newUser.id,
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
        } catch (error) {
           console.error('Failed to create user session', error);
           // Non-blocking error
        }
    }

    // Log Registration
    if (command.ipAddress && command.userAgent) {
        await this.authLoggingService.logRegistration(
            newUser.id, 
            authProvider.name, 
            command.ipAddress, 
            command.userAgent
        );
    }
// Record Metric
    this.metricsService.userRegistrationsTotal
        .labels(authProvider.name, brand.name)
        .inc();

    const registeredPrograms = await this.getRegisteredPrograms(newUser.id, newUser.brandId);
    
    return {
      accessToken,
      refreshToken,
      user: {
        id: newUser.id,
        email: newUser.email,
        brandId: newUser.brandId,
        isActive: newUser.isActive,
        isOnboardingCompleted: newUser.isOnboardingCompleted ?? false,
        registeredPrograms,
      },
      programRegistration: applicationResult ? toProgramRegistrationInfo(applicationResult) : undefined,
    };
  }
}
