import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { AdminAuthResponseDto } from '../../../presentation/dto/admin-auth-response.dto';
import {
  buildAccessiblePrograms,
  getAdminProgramAccessScope,
  mapAdminBrandAssignment,
  mapAdminProgramAssignment,
  normalizePermissions,
} from '../../../../../shared/admin-access-response';

type RefreshPayload = {
  sub: string;
  email: string;
  brandId: string;
  adminId?: string;
  sid?: string;
  isAdmin?: boolean;
  type?: 'access' | 'refresh';
};

@Injectable()
export class AdminRefreshHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async execute(refreshToken: string): Promise<AdminAuthResponseDto> {
    let payload: RefreshPayload;

    try {
      payload = this.jwtService.verify<RefreshPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Mirror of the grace window in JwtStrategy.validate: reject only an
    // EXPLICIT access token here, and keep accepting a missing type, because
    // admin refresh tokens issued before this deploy carry no type claim and
    // demanding one would bounce every admin to the login screen. Drop the
    // undefined branch once the longest REFRESH TTL has elapsed
    // (JWT_REFRESH_EXPIRES_IN, 7d) — not the 8h access window, since an admin
    // returning after a long weekend still holds an un-rotated legacy token.
    if (payload.type === 'access') {
      throw new UnauthorizedException('Access token cannot be used to refresh');
    }

    if (!payload.isAdmin || !payload.adminId || !payload.sid) {
      throw new UnauthorizedException('Invalid admin refresh token');
    }

    const session = await this.prisma.userSession.findFirst({
      where: {
        userId: payload.sub,
        sessionToken: payload.sid,
        refreshToken,
        isActive: true,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: {
            admin: {
              include: {
                adminBrands: {
                  include: {
                    brand: {
                      select: {
                        id: true,
                        name: true,
                        slug: true,
                        isActive: true,
                        logoUrl: true,
                        logoWhiteUrl: true,
                        logoColorUrl: true,
                        logoIconUrl: true,
                      },
                    },
                  },
                },
                adminPrograms: {
                  include: {
                    program: {
                      select: {
                        id: true,
                        brandId: true,
                        name: true,
                        slug: true,
                        year: true,
                        status: true,
                        isActive: true,
                        startDate: true,
                        endDate: true,
                        logoUrl: true,
                        logoWhiteUrl: true,
                        logoColorUrl: true,
                        logoIconUrl: true,
                        brand: {
                          select: {
                            id: true,
                            name: true,
                            slug: true,
                            isActive: true,
                            logoUrl: true,
                            logoWhiteUrl: true,
                            logoColorUrl: true,
                            logoIconUrl: true,
                          },
                        },
                      },
                    },
                  },
                },
                role: true,
              },
            },
          },
        },
      },
    });

    const user = session?.user;

    if (!session || !user || !user.admin || !user.isActive) {
      throw new UnauthorizedException('Refresh session is not valid');
    }

    if (user.admin.role && !user.admin.role.isActive) {
      throw new UnauthorizedException('Admin role is not active');
    }

    const roles: string[] = ['admin'];
    if (user.admin.role) {
      roles.push(user.admin.role.name);
      const slug = user.admin.role.name.toLowerCase().replace(/\s+/g, '_');
      if (slug !== user.admin.role.name) roles.push(slug);
    }
    user.admin.adminBrands.forEach((assignment) => {
      if (assignment.roleInBrand) {
        roles.push(`brand:${assignment.brandId}:${assignment.roleInBrand}`);
      }
    });

    const nextAccessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        brandId: user.brandId,
        jti: randomUUID(),
        roles,
        isAdmin: true,
        adminId: user.admin.id,
        sid: session.sessionToken,
        type: 'access',
      },
      { expiresIn: this.configService.get<string>('JWT_ADMIN_EXPIRES_IN', '8h') },
    );

    const nextRefreshToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        brandId: user.brandId,
        jti: randomUUID(),
        adminId: user.admin.id,
        isAdmin: true,
        sid: session.sessionToken,
        type: 'refresh',
      },
      { expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') },
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshToken: nextRefreshToken,
        expiresAt,
        lastActivity: new Date(),
      },
    });

    const accessScope = getAdminProgramAccessScope(user.admin);
    const accessiblePrograms = accessScope === 'assigned'
      ? user.admin.adminPrograms.map((assignment) => mapAdminProgramAssignment(assignment))
      : buildAccessiblePrograms({
          availablePrograms: await this.prisma.program.findMany({
            where: {
              deletedAt: null,
              ...(accessScope === 'brand_scope'
                ? { brandId: { in: user.admin.adminBrands.map((assignment) => assignment.brandId) } }
                : {}),
            },
            select: {
              id: true,
              brandId: true,
              name: true,
              slug: true,
              year: true,
              status: true,
              isActive: true,
              startDate: true,
              endDate: true,
              logoUrl: true,
              logoWhiteUrl: true,
              logoColorUrl: true,
              logoIconUrl: true,
              brand: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  isActive: true,
                  logoUrl: true,
                  logoWhiteUrl: true,
                  logoColorUrl: true,
                  logoIconUrl: true,
                },
              },
            },
            orderBy: [{ isActive: 'desc' }, { year: 'desc' }, { name: 'asc' }],
          }),
          assignments: user.admin.adminPrograms,
          unassignedAccessType: accessScope,
        });

    return {
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        brandId: user.brandId,
        isActive: user.isActive,
        isOnboardingCompleted: user.isOnboardingCompleted,
      },
      admin: {
        id: user.admin.id,
        fullName: user.admin.fullName,
        avatarUrl: user.admin.avatarUrl || undefined,
        roleId: user.admin.roleId || '',
        role: user.admin.role?.name || 'No Role',
        accessLevel: user.admin.accessLevel,
        permissions: normalizePermissions(user.admin.role?.permissions),
        customPermissions: normalizePermissions(user.admin.customPermissions),
        canManageAdmins: user.admin.canManageAdmins,
        canAssignRoles: user.admin.canAssignRoles,
        programs: user.admin.adminPrograms.map((assignment) => mapAdminProgramAssignment(assignment)),
        accessiblePrograms,
        brands: user.admin.adminBrands.map((assignment) => mapAdminBrandAssignment(assignment)),
      },
    };
  }
}