// src/modules/auth/application/commands/handlers/refresh.handler.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { hashToken } from '@shared/utils/hash-token.util';
import { RefreshResponseDto } from '../../../presentation/dto/refresh-response.dto';

type RefreshPayload = {
  sub: string;
  email: string;
  brandId: string;
  type?: 'access' | 'refresh';
};

@Injectable()
export class RefreshHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async execute(refreshToken: string): Promise<RefreshResponseDto> {
    let payload: RefreshPayload;

    try {
      payload = this.jwtService.verify<RefreshPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Mirror of the grace window in JwtStrategy.validate (and
    // admin-refresh.handler.ts): reject only an EXPLICIT access token here,
    // and keep accepting a missing type, because participant refresh tokens
    // issued before this deploy carry no type claim and demanding one would
    // bounce every participant to the login screen. Drop the undefined
    // branch once the longest REFRESH TTL has elapsed (JWT_REFRESH_EXPIRES_IN,
    // 7d) - not the 1h access window, since a participant returning after a
    // long weekend still holds an un-rotated legacy token.
    if (payload.type === 'access') {
      throw new UnauthorizedException('Access token cannot be used to refresh');
    }

    // Audit M144 (widened): userSession.refreshToken moved from storing the
    // raw JWT to storing its sha256 hash, so a leaked DB dump can no longer
    // be replayed as working refresh tokens directly. Rows written before
    // this deploy still hold the raw JWT, so the lookup matches EITHER the
    // hash (new rows) OR the raw value (legacy rows still mid-migration) -
    // this is a live, zero-forced-logout migration, not a hard cutover. See
    // admin-refresh.handler.ts for the same pattern.
    //
    // Unlike the admin token, the participant refresh payload carries no
    // `sid` (login.handler.ts signs it without one), so the session cannot
    // be keyed on sessionToken here. userId + the presented refresh token
    // (hash-or-legacy) is the only handle available.
    const presentedTokenHash = hashToken(refreshToken);
    const session = await this.prisma.userSession.findFirst({
      where: {
        userId: payload.sub,
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
                adminBrands: true,
              },
            },
          },
        },
      },
    });

    const user = session?.user;

    if (!session || !user || !user.isActive) {
      throw new UnauthorizedException('Refresh session is not valid');
    }

    // Reproduce login.handler.ts's role computation exactly, so a refreshed
    // access token carries the same roles the original login token did. Do
    // NOT reuse admin-refresh.handler.ts's role logic here - that handler
    // requires user.admin to exist and expands admin.role, which participant
    // logins never populate the same way.
    const roles: string[] = [];
    if (user.admin) {
      roles.push('admin');
      const brandRole = user.admin.adminBrands.find(
        (apc) => apc.brandId === user.brandId,
      );
      if (brandRole && brandRole.roleInBrand) {
        roles.push(brandRole.roleInBrand);
      }
    }

    const nextAccessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        brandId: user.brandId,
        jti: randomUUID(),
        roles,
        // The access token needs `sid` even though the refresh payload that
        // got us here has none - LogoutHandler keys revocation off it (see
        // logout.handler.ts). Read from the session row, not the payload.
        sid: session.sessionToken,
        type: 'access' as const,
      },
      { expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '1h') },
    );

    const nextRefreshToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        brandId: user.brandId,
        jti: randomUUID(),
        type: 'refresh' as const,
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
    // token, same reasoning as admin-refresh.handler.ts.
    //
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

    return {
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
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
