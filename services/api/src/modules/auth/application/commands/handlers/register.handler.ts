import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { RegisterCommand } from '../register.command';
import { AuthResponseDto } from '../../../presentation/dto/auth-response.dto';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class RegisterHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async execute(command: RegisterCommand): Promise<AuthResponseDto> {
    // Check if program category exists
    const programCategory = await this.prisma.programCategory.findUnique({
      where: { id: command.programCategoryId },
    });

    if (!programCategory || !programCategory.isActive) {
      throw new BadRequestException('Invalid program category');
    }

    // Check if user already exists (email + programCategoryId combination)
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email_programCategoryId: {
          email: command.email,
          programCategoryId: command.programCategoryId,
        },
      },
    });

    if (existingUser) {
      throw new ConflictException('User already exists for this brand');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(command.password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: command.email,
        passwordHash,
        programCategoryId: command.programCategoryId,
        isActive: true,
        emailVerified: false,
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
