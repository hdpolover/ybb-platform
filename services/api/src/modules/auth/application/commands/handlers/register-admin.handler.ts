import {
  Injectable,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { RegisterAdminCommand } from '../register-admin.command';
import { AuthResponseDto } from '../../../presentation/dto/auth-response.dto';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { UnitOfWork } from '../../../../../shared/infrastructure/database/unit-of-work.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

/**
 * The only roles this route may hand out, mapped to the AdminRole rows the
 * seed actually creates.
 *
 * Two different vocabularies meet here. AdminRole.name is the unique key and
 * prisma/seeds/seed-auth.ts writes DISPLAY names ('Super Admin', 'Program
 * Admin', ...); the slugs on the left are what admin_brands.role_in_brand
 * stores and what the request body sends, matching prisma/seeds/seed-admins.ts.
 * Looking a slug up as a role name missed on every seeded database, so the old
 * auto-create branch fired every time and produced a duplicate,
 * permission-less AdminRole that the new roleId link then pointed at.
 *
 * A Map rather than an object literal so a body of "constructor" or
 * "__proto__" cannot resolve to something inherited.
 */
const ADMIN_ROLE_CATALOG = new Map<string, { roleName: string; accessLevel: number }>([
  ['super_admin', { roleName: 'Super Admin', accessLevel: 10 }],
  ['super-admin', { roleName: 'Super Admin', accessLevel: 10 }],
  ['owner', { roleName: 'Super Admin', accessLevel: 10 }],
  ['program_coordinator', { roleName: 'Program Admin', accessLevel: 5 }],
  ['manager', { roleName: 'Program Admin', accessLevel: 5 }],
  ['news_writer', { roleName: 'News Writer', accessLevel: 3 }],
  ['editor', { roleName: 'Editor', accessLevel: 3 }],
]);

/**
 * Constant-time secret comparison.
 *
 * timingSafeEqual throws on unequal lengths, which would both leak the secret's
 * length and turn a wrong guess into a 500. Comparing SHA-256 digests makes
 * both inputs 32 bytes whatever the caller sends, so the length check never
 * fires and the compare stays constant time.
 */
function secretMatches(candidate: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(candidate), digest(expected));
}

@Injectable()
export class RegisterAdminHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly unitOfWork: UnitOfWork,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: RegisterAdminCommand): Promise<AuthResponseDto> {
    // 0. Off unless someone deliberately turned it on.
    //
    // Nothing calls this route. First-admin bootstrap is done by
    // prisma/seeds/seed-admins.ts at container start (docker-entrypoint.sh),
    // and day-to-day admin creation is POST /v1/admins, which is behind
    // JwtAuthGuard + RolesGuard and is what the dashboard uses. This is kept
    // only as a break-glass path for a fresh local/staging database, so it
    // stays dark until ADMIN_REGISTRATION_ENABLED is explicitly 'true'.
    // NotFound rather than Forbidden so a probe learns nothing about whether a
    // secret exists to be guessed. It is not a perfect impersonation of a
    // missing route — the global ValidationPipe runs first, so a malformed
    // body still 400s, and a genuine 404 names the /v1 prefix — and it is not
    // worth contorting the code to make it one.
    if (this.configService.get<string>('ADMIN_REGISTRATION_ENABLED') !== 'true') {
      throw new NotFoundException('Cannot POST /auth/register-admin');
    }

    // 1. Verify Secret Key (constant time)
    const validSecret = this.configService.get<string>('ADMIN_REGISTRATION_SECRET');
    if (!validSecret || !secretMatches(command.secretKey ?? '', validSecret)) {
      throw new ForbiddenException('Invalid admin registration secret');
    }

    // 1b. Reject any role outside the catalog BEFORE touching the database.
    const catalogEntry = ADMIN_ROLE_CATALOG.get(command.role);
    if (!catalogEntry) {
      throw new BadRequestException('Invalid admin role');
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

    // 4. Resolve the seeded AdminRole this slug maps to.
    //
    // No create branch: if the row is missing the database has not been
    // seeded, and inventing a permission-less role here would silently hand
    // the new admin an account that 403s on every role-guarded route.
    const role = await this.prisma.adminRole.findUnique({
      where: { name: catalogEntry.roleName },
    });

    if (!role) {
      throw new BadRequestException(
        `Admin role "${catalogEntry.roleName}" does not exist. Run prisma/seeds/seed-auth.ts first.`,
      );
    }

    const accessLevel = catalogEntry.accessLevel;

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

        // Update access level and permissions, and LINK THE ROLE.
        //
        // roleId was never written here, so admins.role_id stayed NULL. That is
        // not cosmetic: admin-login.handler rebuilds `roles` from the DB on the
        // next login, and with a NULL role it emits only ['admin'] plus
        // brand-scoped strings, so every @Roles(SUPER_ADMIN) route 403s from
        // then on even though the token this handler returned worked fine.
        await repos.tx.admin.update({
          where: { id: newAdmin.id },
          data: {
            roleId: role.id,
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

    // 6. Generate Tokens.
    //
    // These used to be signed from ONE payload object with no jti at all, so
    // the two tokens were byte-identical apart from exp, the logout blacklist
    // could not track them, and the refresh token was accepted as a bearer.
    const basePayload = {
      sub: user.id,
      email: user.email,
      brandId: user.brandId,
      adminId: admin.id,
    };

    const accessToken = this.jwtService.sign(
      { ...basePayload, jti: randomUUID(), roles: ['admin', command.role], type: 'access' },
      { expiresIn: this.configService.get<string>('JWT_ADMIN_EXPIRES_IN', '8h') },
    );

    const refreshToken = this.jwtService.sign(
      { ...basePayload, jti: randomUUID(), type: 'refresh' },
      { expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') },
    );

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
