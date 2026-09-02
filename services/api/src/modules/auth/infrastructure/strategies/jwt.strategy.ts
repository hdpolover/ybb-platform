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
  iat?: number; // Issued-at timestamp (seconds)
  exp?: number; // Token expiration timestamp
  roles?: string[]; // Roles from token
  adminId?: string; // Admin ID
  sid?: string; // Session ID for refresh/logout coordination
  type?: 'access' | 'refresh'; // Which half of the pair this token is
}

/**
 * Fallbacks for the ACCESS-token TTLs, matching the defaults every sign site
 * already passes to jwtService.sign().
 */
const DEFAULT_ACCESS_TTL_SECONDS = 3600; // JWT_EXPIRES_IN
const DEFAULT_ADMIN_ACCESS_TTL_SECONDS = 28800; // JWT_ADMIN_EXPIRES_IN, 8h

/** Allowance for clock drift between the signer and this process. */
const CLOCK_SKEW_SECONDS = 300;

/**
 * Parse the `1h` / `8h` / `7d` duration strings the TTL env vars use.
 *
 * Same grammar jsonwebtoken accepts for `expiresIn`, minus the aliases nothing
 * in this repo uses. A bare number means seconds, as it does there. Returns
 * undefined for anything unparseable so the caller can fall back rather than
 * compute a nonsense threshold from a typo.
 */
export function parseTtlSeconds(value?: string): number | undefined {
  const match = /^(\d+)\s*(s|m|h|d)?$/i.exec((value ?? '').trim());
  if (!match) return undefined;
  const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[match[2]?.toLowerCase() ?? 's'] ?? 1;
  return Number(match[1]) * multiplier;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  /** Longest lifetime an ACCESS token can legitimately have, plus clock skew. */
  private readonly maxAccessLifetimeSeconds: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });

    this.maxAccessLifetimeSeconds =
      Math.max(
        parseTtlSeconds(configService.get<string>('JWT_EXPIRES_IN')) ?? DEFAULT_ACCESS_TTL_SECONDS,
        parseTtlSeconds(configService.get<string>('JWT_ADMIN_EXPIRES_IN')) ??
          DEFAULT_ADMIN_ACCESS_TTL_SECONDS,
      ) + CLOCK_SKEW_SECONDS;
  }

  async validate(payload: JwtPayload) {
    // Refresh tokens are signed with the same secret as access tokens and were
    // otherwise indistinguishable, so anyone holding one could send it as a
    // Bearer and get full API access for its whole 7-day life — surviving
    // logout, which only blacklists the access token's jti.
    //
    // Tokens minted before the `type` claim shipped carry no type at all, so a
    // strict `type !== 'access'` check would log out every signed-in user at
    // once. We do not need one: a token's LIFETIME already identifies its
    // class. Every sign site stamps iat and exp, and no ACCESS token is ever
    // issued for longer than JWT_ADMIN_EXPIRES_IN, so an untyped token that
    // lives longer than the longest configured access TTL can only be a legacy
    // refresh token. That closes the window on its own, today, without anyone
    // having to remember to come back and edit this file.
    //
    // The threshold is read from config rather than hardcoded because some
    // non-prod env files set JWT_EXPIRES_IN=7d; hardcoding 8h would log out
    // every developer. An untyped token with neither iat nor exp is still
    // accepted — that shape cannot be classified, and inventing a lockout for
    // it buys nothing.
    if (payload.type === 'refresh') {
      throw new UnauthorizedException('Refresh token cannot be used as an access token');
    }

    if (
      payload.type === undefined &&
      typeof payload.iat === 'number' &&
      typeof payload.exp === 'number' &&
      payload.exp - payload.iat > this.maxAccessLifetimeSeconds
    ) {
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
