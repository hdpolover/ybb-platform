import { Inject, Injectable, ConflictException, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { RegisterCommand } from '../register.command';
import { AuthResponseDto } from '../../../presentation/dto/auth-response.dto';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '../../../../../shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { Ambassador, ApplicationCategory } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthLoggingService } from '../../services/auth-logging.service';
import { MetricsService } from '../../../../../shared/infrastructure/monitoring/metrics.service';
import { GeoIpService } from '@shared/infrastructure/geoip/geoip.service';

@Injectable()
export class RegisterHandler {
  private readonly logger = new Logger(RegisterHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly rabbitmqProducer: RabbitMQProducerService,
    private readonly authLoggingService: AuthLoggingService,
    private readonly metricsService: MetricsService,
    private readonly geoIpService: GeoIpService,
  ) {}

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
   * Similar logic to login handler
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

  async execute(command: RegisterCommand, domain?: string): Promise<AuthResponseDto> {
    // Validate provider exists and is active
    const authProvider = await this.prisma.authProvider.findUnique({
      where: { id: command.providerId },
    });

    if (!authProvider || !authProvider.isActive) {
      throw new BadRequestException(`Authentication provider is not available or inactive`);
    }

    // Resolve programCategoryId from command or domain
    const programCategoryId = await this.resolveProgramCategoryId(command.programCategoryId, domain);

    // Check if program category exists
    const programCategory = await this.prisma.programCategory.findUnique({
      where: { id: programCategoryId },
    });

    if (!programCategory || !programCategory.isActive) {
      throw new BadRequestException('Invalid program category');
    }

    // Resolve Target Program ID
    let targetProgramId = command.programId;

    if (command.programSlug) {
        const programBySlug = await this.prisma.program.findUnique({
          where: {
            programCategoryId_slug: {
              programCategoryId: programCategoryId,
              slug: command.programSlug,
            }
          }
        });

        if (!programBySlug) {
          throw new BadRequestException(`Invalid program slug '${command.programSlug}' for the current brand domain.`);
        }
        targetProgramId = programBySlug.id;
    }

    // Automatic registration to latest active program if no specific program requested
    if (!targetProgramId) {
      const latestProgram = await this.prisma.program.findFirst({
        where: {
          programCategoryId: programCategoryId,
          isActive: true,
        },
        orderBy: {
          startDate: 'desc',
        },
      });

      if (latestProgram) {
        targetProgramId = latestProgram.id;
      }
    }

    // Compatibility check (if ID was manually provided)
    if (targetProgramId && command.programId) {
       const confirmProgram = await this.prisma.program.findUnique({ where: { id: targetProgramId }});
       if (confirmProgram && confirmProgram.programCategoryId !== programCategoryId) {
           throw new BadRequestException('Program does not belong to the selected category');
       }
    }

    // Check Ambassador Referral
    let ambassador: Ambassador | null = null;
    if (command.referralCode) {
        ambassador = await this.prisma.ambassador.findUnique({
            where: { referralCode: command.referralCode },
        });
        
        // If ambassador not found or inactive, we generally ignore or log warning, 
        // but typically registration should proceed without referral.
        if (!ambassador || !ambassador.isActive) {
            this.logger.warn(`Invalid or inactive referral code used: ${command.referralCode}`);
            ambassador = null;
        }
    }

    // Check if user already exists by email + programCategoryId
    let user = await this.prisma.user.findUnique({
      where: {
        email_programCategoryId: {
          email: command.email,
          programCategoryId: programCategoryId,
        },
      },
      include: {
        identities: {
          include: {
            provider: true,
          },
        },
      },
    });

    // Function to handle program registration & referrals
    const handleProgramRegistration = async (userId: string, email: string) => {
      // Create participant profile if not exists
      let participant = await this.prisma.participant.findUnique({
        where: { userId },
      });

      if (!participant) {
        participant = await this.prisma.participant.create({
          data: {
            userId,
            fullName: email.split('@')[0], // Default name from email prefix
            referralCode: command.referralCode, // Store what they entered even if invalid? Or only valid? 
                                                // Storing valid one if ambassador exists, else maybe null or raw string.
                                                // Schema has referralCode on Participant (String).
          },
        });
        
        // If this is a new participant and we have a valid ambassador, link them
        if (ambassador) {
             try {
                 await this.prisma.ambassadorReferral.create({
                     data: {
                         ambassadorId: ambassador.id,
                         participantId: participant.id,
                         status: 'referred', // Default
                     }
                 });

                 // Increment stats
                 await this.prisma.ambassador.update({
                     where: { id: ambassador.id },
                     data: {
                         totalReferrals: { increment: 1 },
                         lastReferralAt: new Date(),
                     }
                 });
             } catch (e) {
                 // Ignore unique constraint violation if retry
                 this.logger.error(`Failed to link ambassador: ${e.message}`);
             }
        }
      }

      if (!targetProgramId) return;

      // Check if already registered for this program
      const existingApplication = await this.prisma.participantApplication.findFirst({
        where: {
          participantId: participant.id,
          programId: targetProgramId,
        },
      });

      // Create application if not exists
      if (!existingApplication) {
        // Determine Default Category from Active Participation Infos
        const participationInfos = await this.prisma.programParticipationInfo.findMany({
            where: {
                programId: targetProgramId,
                isActive: true
            }
        });

        // Default priority: Fully Funded -> Self Funded -> Other/First Available
        let applicationCategory: ApplicationCategory = ApplicationCategory.self_funded;

        const hasFullyFunded = participationInfos.some(pi => pi.category === ApplicationCategory.fully_funded);
        const hasSelfFunded = participationInfos.some(pi => pi.category === ApplicationCategory.self_funded);

        if (hasFullyFunded) {
            applicationCategory = ApplicationCategory.fully_funded;
        } else if (hasSelfFunded) {
             applicationCategory = ApplicationCategory.self_funded;
        } else if (participationInfos.length > 0) {
             applicationCategory = participationInfos[0].category;
        }

        await this.prisma.participantApplication.create({
          data: {
            participantId: participant.id,
            programId: targetProgramId,
            status: 'draft',
            applicationCategory: applicationCategory
          },
        });
      }
    };

    // For OAuth providers, check if identity already exists
    if (authProvider.name !== 'local' && command.providerUserId) {
      const existingIdentity = await this.prisma.userIdentity.findUnique({
        where: {
          providerId_providerUserId: {
            providerId: authProvider.id,
            providerUserId: command.providerUserId,
          },
        },
        include: {
          user: true,
        },
      });

      if (existingIdentity) {
        await handleProgramRegistration(existingIdentity.user.id, existingIdentity.user.email);

        // User with this provider already exists, return login tokens
        const payload = {
          sub: existingIdentity.user.id,
          email: existingIdentity.user.email,
          programCategoryId: existingIdentity.user.programCategoryId,
        };

        const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
        const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

        // Update last used
        await this.prisma.userIdentity.update({
          where: { id: existingIdentity.id },
          data: { lastUsedAt: new Date() },
        });

        const registeredPrograms = await this.getRegisteredPrograms(existingIdentity.user.id, existingIdentity.user.programCategoryId);

        return {
          accessToken,
          refreshToken,
          user: {
            id: existingIdentity.user.id,
            email: existingIdentity.user.email,
            programCategoryId: existingIdentity.user.programCategoryId,
            isActive: existingIdentity.user.isActive,
            isOnboardingCompleted: existingIdentity.user.isOnboardingCompleted ?? false,
            registeredPrograms,
          },
        };
      }
    }

    // Fallback for providerUserId (Email usually for local, or if not provided)
    const providerUserIdToUse = command.providerUserId || command.email;

    if (user) {
      // User exists, handle program registration first just in case
      await handleProgramRegistration(user.id, user.email);

      // User exists, check if they can add this provider
      const existingIdentity = user.identities.find(i => i.providerId === authProvider.id);
      
      if (existingIdentity) {
        throw new ConflictException(`User already has ${authProvider.displayName} authentication configured`);
      }

      // Add new identity to existing user
      await this.prisma.userIdentity.create({
        data: {
          userId: user.id,
          providerId: authProvider.id,
          providerUserId: providerUserIdToUse,
          providerEmail: command.email,
          isPrimary: user.identities.length === 0, // First identity is primary
          lastUsedAt: new Date(),
        },
      });

      // If adding local auth, update password hash
      if (authProvider.name === 'local' && command.password) {
        const passwordHash = await bcrypt.hash(command.password, 10);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { passwordHash },
        });
      }

      // Return login tokens
      const payload = {
        sub: user.id,
        email: user.email,
        programCategoryId: user.programCategoryId,
      };

      const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
      const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

      const registeredPrograms = await this.getRegisteredPrograms(user.id, user.programCategoryId);

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
      if (programCategory.requireEmailVerification) {
        // Verification Required
        emailVerified = false;
        emailVerificationToken = crypto.randomBytes(32).toString('hex');
        emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      } else {
        // No Verification Required
        emailVerified = true;
      }
    }

    // Create user with identity
    const newUser = await this.prisma.user.create({
      data: {
        email: command.email,
        passwordHash,
        programCategoryId: programCategoryId,
        isActive: true,
        isOnboardingCompleted: false,
        emailVerified: emailVerified,
        emailVerificationToken,
        emailVerificationExpires,
        identities: {
          create: {
            providerId: authProvider.id,
            providerUserId: providerUserIdToUse,
            providerEmail: command.email,
            isPrimary: true,
            lastUsedAt: new Date(),
          },
        },
      },
    });

    await handleProgramRegistration(newUser.id, newUser.email);

    // Send notifications
    if (authProvider.name === 'local' && emailVerificationToken) {
      this.rabbitmqProducer.emit('user.verify-email', {
        email: newUser.email,
        name: newUser.email.split('@')[0], // Use part of email as name since we don't have it yet
        token: emailVerificationToken,
        programCategory: {
          name: programCategory.name,
          logoUrl: programCategory.logoUrl,
          primaryColor: programCategory.primaryColor,
          websiteUrl: programCategory.websiteUrl,
          socialMediaLinks: programCategory.socialMediaLinks,
          contactEmail: programCategory.contactEmail,
        },
      });
    } else if (authProvider.isOAuth) {
      this.rabbitmqProducer.emit('user.registered', {
        email: newUser.email,
        name: newUser.email.split('@')[0],
        programCategory: {
          name: programCategory.name,
          logoUrl: programCategory.logoUrl,
          primaryColor: programCategory.primaryColor,
          websiteUrl: programCategory.websiteUrl,
        },
      });
    }

    // Generate JWT tokens with session tracking
    const accessTokenJti = crypto.randomUUID();
    const refreshTokenJti = crypto.randomUUID();

    const payload = {
      sub: newUser.id,
      email: newUser.email,
      programCategoryId: newUser.programCategoryId,
      jti: accessTokenJti,
    };

    const refreshTokenPayload = {
        ...payload,
        jti: refreshTokenJti,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '1h',
    });

    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      expiresIn: '7d',
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
        .labels(authProvider.name, programCategory.name)
        .inc();

    const registeredPrograms = await this.getRegisteredPrograms(newUser.id, newUser.programCategoryId);
    
    return {
      accessToken,
      refreshToken,
      user: {
        id: newUser.id,
        email: newUser.email,
        programCategoryId: newUser.programCategoryId,
        isActive: newUser.isActive,
        isOnboardingCompleted: newUser.isOnboardingCompleted ?? false,
        registeredPrograms,
      },
    };
  }
}
