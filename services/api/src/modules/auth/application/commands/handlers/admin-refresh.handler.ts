import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { hashToken } from '@shared/utils/hash-token.util';
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

    // Audit M144 (widened): userSession.refreshToken moved from storing the
    // raw JWT to storing its sha256 hash, so a leaked DB dump can no longer
    // be replayed as working refresh tokens directly. Rows written before
    // this deploy still hold the raw JWT, so the lookup matches EITHER the
    // hash (new rows) OR the raw value (legacy rows still mid-migration) -
    // this is a live, zero-forced-logout migration, not a hard cutover.
    // Whichever form actually matched gets read back into
    // matchedRefreshTokenValue below, and the rotation write always stores
    // the hash going forward, so a legacy row is upgraded the very next time
    // it is used to refresh.
    const presentedTokenHash = hashToken(refreshToken);
    const session = await this.prisma.userSession.findFirst({
      where: {
        userId: payload.sub,
        sessionToken: payload.sid,
        OR: [{ refreshToken: presentedTokenHash }, { refreshToken }],
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

    // Rotate atomically, guarded on the refreshToken this request presented
    // (not just the session id): find-then-update let two tabs refreshing at
    // nearly the same instant both pass the findFirst above and both write,
    // last write wins, so the loser silently carried a now-dead refreshToken
    // until it happened to refresh again. updateMany + a refreshToken guard
    // in the where clause makes only ONE of the two writes succeed.
    //
    // count === 0 means someone else already rotated this session between
    // our findFirst read and this write - fail closed with the same
    // "Refresh session is not valid" 401 as any other invalid/reused refresh
    // token. There is no reuse-detection / session-revocation cascade
    // elsewhere in this codebase for this to weaken (grep confirms this is
    // the only userSession refresh-token rotation site); sibling writers
    // (reset-password.handler.ts, logout.handler.ts) already guard their
    // updateMany with a predicate the same way. Tolerating count===0 instead
    // (silently returning the OLD tokens) would let the loser keep operating
    // on a refreshToken the DB no longer recognizes, deferring the same
    // logout to its own next refresh with no way for the client to tell the
    // difference from a genuine expiry - deterministic-now is strictly
    // better than probabilistic-later for an auth surface.
    // Guarded on session.refreshToken (the exact value the findFirst above
    // actually matched - hash or legacy plaintext), not the presented
    // refreshToken/presentedTokenHash, so the concurrency guard still works
    // for a row that hasn't migrated yet. The write always stores the hash
    // of the new token, so every row is on the hashed format after its first
    // rotation post-deploy.
    const rotated = await this.prisma.userSession.updateMany({
      where: { id: session.id, refreshToken: session.refreshToken },
      data: {
        refreshToken: hashToken(nextRefreshToken),
        expiresAt,
        lastActivity: new Date(),
      },
    });

    if (rotated.count === 0) {
      throw new UnauthorizedException('Refresh session is not valid');
    }

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