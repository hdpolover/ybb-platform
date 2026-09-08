// src/modules/auth/infrastructure/guards/optional-jwt-auth.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TokenBlacklistService } from '../services/token-blacklist.service';

/**
 * Same JWT verification as JwtAuthGuard, but for routes that must stay
 * reachable anonymously while still recognizing an admin caller when one is
 * present (audit finding M13: public program routes couldn't tell an
 * anonymous caller from an admin one, so the admin's full-control query
 * params leaked to everyone).
 *
 * canActivate NEVER returns false and NEVER throws: a missing, malformed, or
 * expired token just leaves req.user undefined, exactly like a route with no
 * guard at all. Only a validly-signed, non-blacklisted token populates
 * req.user, so downstream code can treat req.user as "caller is
 * authenticated" without also having to defend against a bad token forging
 * that fact.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly tokenBlacklistService: TokenBlacklistService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);

    // Passport's default handleRequest (invoked by super.canActivate above)
    // would throw on a missing/invalid token; ours below swallows that by
    // returning null instead, so we always reach this point.
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user?.jti) {
      const isBlacklisted = await this.tokenBlacklistService.isBlacklisted(user.jti);
      if (isBlacklisted) {
        // Drop the caller to anonymous. A revoked token must not still read as
        // an admin here: these routes widen what they return for admins, so a
        // logged-out admin's stolen token would otherwise keep seeing drafts
        // and private resources on the one pair of routes that never rejects
        // it. Anonymous is the safe direction — it returns strictly less.
        request.user = undefined;
      }
    }

    return true;
  }

  handleRequest<TUser = unknown>(err: unknown, user: unknown): TUser {
    // Swallow auth failures instead of throwing (the base AuthGuard throws
    // UnauthorizedException here). Returning null leaves req.user unset so
    // the route falls back to anonymous behavior.
    return (err ? null : user ?? null) as TUser;
  }
}
