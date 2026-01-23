import { Injectable, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { RegisterAdminCommand } from '../register-admin.command';
import { AuthResponseDto } from '../../../presentation/dto/auth-response.dto';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RegisterAdminHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: RegisterAdminCommand): Promise<AuthResponseDto> {
    // 1. Verify Secret Key
    const validSecret = this.configService.get<string>('ADMIN_REGISTRATION_SECRET');
    if (!validSecret || command.secretKey !== validSecret) {
      throw new ForbiddenException('Invalid admin registration secret');
    }

    // 2. Check if program category exists
    const programCategory = await this.prisma.programCategory.findUnique({
      where: { id: command.programCategoryId },
    });

    if (!programCategory || !programCategory.isActive) {
      throw new BadRequestException('Invalid program category');
    }

    // 3. Check if user already exists
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

    // 4. Resolve or Create Admin Role
    let role = await this.prisma.adminRole.findUnique({
      where: { name: command.role },
    });

    if (!role) {
      // Create role if it doesn't exist (Auto-provisioning for simplicity)
      role = await this.prisma.adminRole.create({
        data: {
          name: command.role,
          description: `Auto-generated role for ${command.role}`,
          isActive: true,
        },
      });
    }

    // Determine Access Level based on role
    let accessLevel = 1;
    if (['super_admin', 'super-admin', 'owner'].includes(command.role)) accessLevel = 10;
    else if (['program_coordinator', 'manager'].includes(command.role)) accessLevel = 5;
    else if (['news_writer', 'editor'].includes(command.role)) accessLevel = 3;

    // 5. Create User and Admin in transaction
    const { user, admin } = await this.prisma.$transaction(async (tx) => {
      // Hash password
      const passwordHash = await bcrypt.hash(command.password, 10);

      // Create User
      const newUser = await tx.user.create({
        data: {
          email: command.email,
          passwordHash,
          programCategoryId: command.programCategoryId,
          isActive: true,
          emailVerified: true, // Auto-verify admin emails
        },
      });

      // Create Admin Profile
      const newAdmin = await tx.admin.create({
        data: {
          userId: newUser.id,
          fullName: command.fullName,
          accessLevel: accessLevel,
          canManageAdmins: accessLevel >= 10,
          canAssignRoles: accessLevel >= 10,
          roleId: role.id,
        },
      });

      // NEW: Assign to Primary Category
      await tx.adminProgramCategory.create({
        data: {
          adminId: newAdmin.id,
          programCategoryId: command.programCategoryId,
          roleInBrand: command.role,
        },
      });

      // NEW: Assign to Additional Categories
      if (command.additionalCategoryIds && command.additionalCategoryIds.length > 0) {
        await tx.adminProgramCategory.createMany({
          data: command.additionalCategoryIds.map((catId) => ({
            adminId: newAdmin.id,
            programCategoryId: catId,
            roleInBrand: command.role,
          })),
        });
      }

      return { user: newUser, admin: newAdmin };
    });

    // 6. Generate Tokens
    const payload = {
      sub: user.id,
      email: user.email,
      programCategoryId: user.programCategoryId,
      roles: ['admin', command.role],
      adminId: admin.id,
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
        // @ts-ignore
        isOnboardingCompleted: user.isOnboardingCompleted ?? false,
      },
    };
  }
}
