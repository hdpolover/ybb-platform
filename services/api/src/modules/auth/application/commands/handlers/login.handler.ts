import { Injectable, UnauthorizedException } from '@nestjs/common';
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
  ) {}

  async execute(command: LoginCommand): Promise<AuthResponseDto> {
    // Find user by email and programCategoryId (brand-scoped)
    const user = await this.prisma.user.findUnique({
      where: {
        email_programCategoryId: {
          email: command.email,
          programCategoryId: command.programCategoryId,
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

    // Generate JWT tokens
    const payload = {
      sub: user.id,
      email: user.email,
      programCategoryId: user.programCategoryId,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '1h',
    });

    const refreshToken = this.jwtService.sign(payload, {
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
