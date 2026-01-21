import { Inject, Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { RegisterCommand } from '../register.command';
import { AuthResponseDto } from '../../../presentation/dto/auth-response.dto';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '../../../../../shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthLoggingService } from '../../services/auth-logging.service';

@Injectable()
export class RegisterHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly rabbitmqProducer: RabbitMQProducerService,
    private readonly authLoggingService: AuthLoggingService,
  ) {}

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
      where: { name: command.provider || 'local' },
    });

    if (!authProvider || !authProvider.isActive) {
      throw new BadRequestException(`Authentication provider '${command.provider}' is not available`);
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

    // If this is a registration for a specific program
    if (command.programId) {
      const program = await this.prisma.program.findUnique({
        where: { id: command.programId },
      });

      if (!program) {
        throw new BadRequestException('Invalid program ID');
      }

      if (program.programCategoryId !== programCategoryId) {
        throw new BadRequestException('Program does not belong to the selected category');
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

    // Function to handle program registration
    const handleProgramRegistration = async (userId: string, email: string) => {
      if (!command.programId) return;

      // Check if participant profile exists
      let participant = await this.prisma.participant.findUnique({
        where: { userId },
      });

      // Create participant profile if not exists
      if (!participant) {
        participant = await this.prisma.participant.create({
          data: {
            userId,
            fullName: email.split('@')[0], // Default name from email prefix
          },
        });
      }

      // Check if already registered for this program
      const existingApplication = await this.prisma.participantApplication.findFirst({
        where: {
          participantId: participant.id,
          programId: command.programId,
        },
      });

      // Create application if not exists
      if (!existingApplication) {
        await this.prisma.participantApplication.create({
          data: {
            participantId: participant.id,
            programId: command.programId,
            status: 'draft',
          },
        });
      }
    };

    // For OAuth providers, check if identity already exists
    if (command.provider !== 'local' && command.providerId) {
      const existingIdentity = await this.prisma.userIdentity.findUnique({
        where: {
          providerId_providerUserId: {
            providerId: authProvider.id,
            providerUserId: command.providerId,
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

        return {
          accessToken,
          refreshToken,
          user: {
            id: existingIdentity.user.id,
            email: existingIdentity.user.email,
            programCategoryId: existingIdentity.user.programCategoryId,
            isActive: existingIdentity.user.isActive,
          },
        };
      }
    }

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
          providerUserId: command.providerId,
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

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          programCategoryId: user.programCategoryId,
          isActive: user.isActive,
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

    // Generate verification token for local registration
    let emailVerificationToken: string | null = null;
    let emailVerificationExpires: Date | null = null;

    if (authProvider.name === 'local') {
      emailVerificationToken = crypto.randomBytes(32).toString('hex');
      emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    }

    // Create user with identity
    const newUser = await this.prisma.user.create({
      data: {
        email: command.email,
        passwordHash,
        programCategoryId: programCategoryId,
        isActive: true,
        // OAuth providers usually verify email automatically
        emailVerified: authProvider.isOAuth,
        emailVerificationToken,
        emailVerificationExpires,
        identities: {
          create: {
            providerId: authProvider.id,
            providerUserId: command.providerId,
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
                country: 'XX', // TODO: GeoIP
                city: 'Unknown',
            }
        });
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

    return {
      accessToken,
      refreshToken,
      user: {
        id: newUser.id,
        email: newUser.email,
        programCategoryId: newUser.programCategoryId,
        isActive: newUser.isActive,
      },
    };
  }
}
