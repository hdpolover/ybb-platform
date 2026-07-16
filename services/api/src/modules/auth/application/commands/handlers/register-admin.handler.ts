import { Injectable, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { RegisterAdminCommand } from '../register-admin.command';
import { AuthResponseDto } from '../../../presentation/dto/auth-response.dto';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { UnitOfWork } from '../../../../../shared/infrastructure/database/unit-of-work.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RegisterAdminHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly unitOfWork: UnitOfWork,
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
    const brand = await this.prisma.brand.findUnique({
      where: { id: command.brandId },
    });

    if (!brand || !brand.isActive) {
      throw new BadRequestException('Invalid program category');
    }

    // 3. Check if user already exists (case-insensitive)
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: { equals: command.email, mode: 'insensitive' },
        brandId: command.brandId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
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
    const { user, admin } = await this.unitOfWork.execute(
      async (repos) => {
        // Hash password
        const passwordHash = await bcrypt.hash(command.password, 10);

        // Create User
        const newUser = await repos.tx.user.create({
          data: {
            email: command.email,
            passwordHash,
            brandId: command.brandId,
            isActive: true,
            emailVerified: true, // Auto-verify admin emails
          },
        });

        // Create Admin Profile
        const newAdmin = await repos.createAdmin({
          userId: newUser.id,
          fullName: command.fullName,
          phoneNumber: undefined,
        });

        // Update access level and permissions separately if needed
        await repos.tx.admin.update({
          where: { id: newAdmin.id },
          data: {
            accessLevel: accessLevel,
            canManageAdmins: accessLevel >= 10,
            canAssignRoles: accessLevel >= 10,
          }
        });

        // NEW: Assign to Primary Category
        await repos.tx.adminBrand.create({
          data: {
            adminId: newAdmin.id,
            brandId: command.brandId,
            roleInBrand: command.role,
          },
        });

        // NEW: Assign to Additional Categories
        if (command.additionalCategoryIds && command.additionalCategoryIds.length > 0) {
          await repos.tx.adminBrand.createMany({
            data: command.additionalCategoryIds.map((catId) => ({
              adminId: newAdmin.id,
              brandId: catId,
              roleInBrand: command.role,
            })),
          });
        }

        return { user: newUser, admin: newAdmin };
      },
      { name: 'register-admin', timeout: 5000 }
    );

    // 6. Generate Tokens
    const payload = {
      sub: user.id,
      email: user.email,
      brandId: user.brandId,
      roles: ['admin', command.role],
      adminId: admin.id,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_ADMIN_EXPIRES_IN', '8h'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        brandId: user.brandId,
        isActive: user.isActive,
        isOnboardingCompleted: user.isOnboardingCompleted ?? false,
      },
    };
  }
}
