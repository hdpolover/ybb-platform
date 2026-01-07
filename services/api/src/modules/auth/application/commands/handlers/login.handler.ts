import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LoginCommand } from '../login.command';
import { AuthResponseDto } from '../../../presentation/dto/auth-response.dto';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class LoginHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) { }

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
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is not active');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      command.password,
      user.passwordHash,
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

    // Generate JWT tokens with unique JTI for blacklisting support
    const accessTokenPayload = {
      sub: user.id,
      email: user.email,
      programCategoryId: user.programCategoryId,
      jti: randomUUID(), // Unique token ID for blacklisting
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
}
