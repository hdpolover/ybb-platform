import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import * as ms from 'ms';

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
 * Fallbacks for the TTL env vars, using the exact default STRINGS every sign
 * site already passes to jwtService.sign(), so this file and the signer can
 * never disagree about what "unset" means.
 */
const DEFAULT_ACCESS_TTL = '1h'; // JWT_EXPIRES_IN
const DEFAULT_ADMIN_ACCESS_TTL = '8h'; // JWT_ADMIN_EXPIRES_IN
const DEFAULT_REFRESH_TTL = '7d'; // JWT_REFRESH_EXPIRES_IN

/**
 * Parse a TTL the way the SIGNER parses it.
 *
 * `ms` is jsonwebtoken's own duration parser — it is literally what an
 * `expiresIn` string is fed to — so delegating here means the two can never
 * disagree. The hand-rolled regex this replaces accepted only `1h`/`7d`-shaped
 * values, so `1w`, `12 hours`, `2 days` and `10.5h` (all valid to the signer)
 * parsed as "unknown", and a bare `3600` came out as 3600 SECONDS where the
 * signer reads it as 3600 MILLISECONDS. Either way the threshold computed
 * below was wrong, and a wrong threshold rejects valid tokens for their whole
 * life.
 *
 * Returns undefined for anything unparseable so the caller can DISABLE the
 * check rather than fall back to a small number and lock everyone out. `ms`
 * throws on an empty/non-string input and returns undefined on a bad one.
 */
export function parseTtlSeconds(value?: string): number | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  let milliseconds: number | undefined;
  try {
    milliseconds = ms(value.trim() as ms.StringValue);
  } catch {
    return undefined;
  }
  return typeof milliseconds === 'number' && Number.isFinite(milliseconds) && milliseconds > 0
    ? milliseconds / 1000
    : undefined;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private static readonly logger = new Logger(JwtStrategy.name);

  /**
   * Longest lifetime an ACCESS token can legitimately have, or undefined when
   * the configured TTLs cannot be parsed — in which case the legacy-token
   * check below turns ITSELF OFF. Guessing a threshold from an unreadable
   * config rejects tokens that are perfectly valid, for their entire life,
   * with a message that blames the wrong thing. Failing open here costs us
   * only the untyped-legacy-token window, which closes on its own as those
   * tokens expire; failing closed costs everyone their session.
   *
   * No clock skew is added. Both iat and exp are stamped by the same signer in
   * one call, so the difference between them is a duration, not a comparison
   * against our own clock, and no amount of drift can enter it.
   */
  private readonly maxAccessLifetimeSeconds?: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });

    this.maxAccessLifetimeSeconds = this.resolveMaxAccessLifetime();
  }

  private resolveMaxAccessLifetime(): number | undefined {
    const read = (key: string, fallback: string) => ({
      key,
      raw: this.configService.get<string>(key) ?? fallback,
      seconds: parseTtlSeconds(this.configService.get<string>(key) ?? fallback),
    });

    const access = read('JWT_EXPIRES_IN', DEFAULT_ACCESS_TTL);
    const adminAccess = read('JWT_ADMIN_EXPIRES_IN', DEFAULT_ADMIN_ACCESS_TTL);
    const refresh = read('JWT_REFRESH_EXPIRES_IN', DEFAULT_REFRESH_TTL);

    const unreadable = [access, adminAccess].filter((ttl) => ttl.seconds === undefined);
    if (unreadable.length > 0) {
      JwtStrategy.logger.error(
        `Cannot parse ${unreadable
          .map((ttl) => `${ttl.key}="${ttl.raw}"`)
          .join(' and ')} as a duration. The legacy untyped-token check is DISABLED, so a ` +
          'pre-`type`-claim refresh token would still be accepted as a bearer. Fix the value ' +
          '(e.g. "1h", "8h", "7d") to switch it back on.',
      );
      return undefined;
    }

    const maxAccess = Math.max(access.seconds!, adminAccess.seconds!);

    // The check works by lifetime: an untyped token that outlives every access
    // token can only be a legacy refresh token. If the longest access TTL
    // reaches the refresh TTL there is no gap left to detect, so the check is
    // live but can never fire.
    //
    // No environment is in that state today. .env, .env.staging and .env.prod
    // all set JWT_EXPIRES_IN=1h and JWT_REFRESH_EXPIRES_IN=7d; only .env.prod
    // sets JWT_ADMIN_EXPIRES_IN (8h), so the other two take the 8h default
    // here. 8h < 7d either way, and this warning stays quiet. It is here to
    // catch someone widening an access TTL later without noticing they turned
    // the check into decoration.
    if (refresh.seconds === undefined || maxAccess >= refresh.seconds) {
      JwtStrategy.logger.warn(
        `JWT_EXPIRES_IN/JWT_ADMIN_EXPIRES_IN (longest ${maxAccess}s) is not shorter than ` +
          `JWT_REFRESH_EXPIRES_IN ("${refresh.raw}"), so the untyped-legacy-refresh-token check ` +
          'cannot discriminate and will never reject anything. Access tokens should be short ' +
          '(1h); only the refresh token should live for days.',
      );
    }

    return maxAccess;
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
    // The threshold is read from config rather than hardcoded because the TTLs
    // differ per environment; hardcoding 8h would log out every developer on
    // an env that sets a longer one. An untyped token with neither iat nor exp
    // is still accepted — that shape cannot be classified, and inventing a
    // lockout for it buys nothing. Same for an unparseable TTL: the
    // constructor logs and leaves maxAccessLifetimeSeconds undefined, and this
    // check stands down rather than guessing.
    if (payload.type === 'refresh') {
      throw new UnauthorizedException('Refresh token cannot be used as an access token');
    }

    if (
      payload.type === undefined &&
      this.maxAccessLifetimeSeconds !== undefined &&
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
