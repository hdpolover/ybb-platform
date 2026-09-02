import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  brandId: string;
  jti?: string; // JWT unique token ID for blacklisting
  exp?: number; // Token expiration timestamp
  roles?: string[]; // Roles from token
  adminId?: string; // Admin ID
  sid?: string; // Session ID for refresh/logout coordination
  type?: 'access' | 'refresh'; // Which half of the pair this token is
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    // Refresh tokens are signed with the same secret as access tokens and were
    // otherwise indistinguishable, so anyone holding one could send it as a
    // Bearer and get full API access for its whole 7-day life — surviving
    // logout, which only blacklists the access token's jti.
    //
    // MIGRATION GRACE WINDOW: reject only an EXPLICIT type === 'refresh'. A
    // missing type is still accepted as an access token, because every token
    // minted before this deploy has no type claim at all and a strict check
    // would log out every signed-in user at once (participants have no refresh
    // endpoint, so they would have no way back in but re-login).
    //
    // Tighten to a strict allowlist (`if (payload.type !== 'access') throw`)
    // once the longest ACCESS-token TTL has elapsed since deploy: that is
    // JWT_ADMIN_EXPIRES_IN, 8h in production (JWT_EXPIRES_IN is 1h there, but
    // check it in the target env first — some non-prod .env files set it to
    // 7d). After that window a no-type bearer can only be a legacy refresh
    // token, which is exactly what we want to reject.
    if (payload.type === 'refresh') {
      throw new UnauthorizedException('Refresh token cannot be used as an access token');
    }

    // Verify user still exists and is active
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Return user info to be attached to request object
    // Include jti and exp for token blacklisting support
    return {
      id: payload.sub, // Standardize on 'id'
      userId: payload.sub, // Keep for backward compatibility
      sub: payload.sub, // Keep for backward compatibility
      email: payload.email,
      brandId: payload.brandId,
      jti: payload.jti,
      exp: payload.exp,
      sid: payload.sid,
      role: payload.roles || [], // Map roles to role for RolesGuard compatibility
      adminId: payload.adminId,
    };
  }
}
