// services/api/src/modules/auth/infrastructure/guards/turnstile.guard.ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { resolveClientIp } from '../../../../shared/utils/client-ip';
import { TurnstileService } from '../../../../shared/infrastructure/turnstile/turnstile.service';

export const TURNSTILE_HEADER = 'x-turnstile-token';
// Cloudflare caps tokens at 2048 chars; anything longer is junk, skip the round trip.
const MAX_TOKEN_LENGTH = 2048;

const headerValue = (value: string | string[] | undefined): string | undefined =>
  (Array.isArray(value) ? value[0] : value) || undefined;

/**
 * Cloudflare Turnstile on the anonymous mail/credential routes (register, login,
 * forgot-password, resend-verification).
 *
 * The token rides in a header, not the body: the global ValidationPipe uses
 * forbidNonWhitelisted, so a body field would 400 every client not yet updated.
 *
 * Rollout is a flag: with AUTH_TURNSTILE_ENFORCE !== 'true' (or no secret) the
 * guard never blocks. A token that IS sent is still verified and a failure is
 * logged, which is the dry-run signal before enforcement is switched on.
 *
 * Runs after the global throttler (global guards go first), so a flood is
 * throttled before it costs a siteverify call.
 */
@Injectable()
export class TurnstileGuard implements CanActivate {
  private readonly logger = new Logger(TurnstileGuard.name);

  constructor(
    private readonly config: ConfigService,
    private readonly turnstile: TurnstileService,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const enforce =
      this.config.get<string>('AUTH_TURNSTILE_ENFORCE') === 'true' && this.turnstile.isConfigured();
    const token = headerValue(req.headers?.[TURNSTILE_HEADER]);

    if (!enforce) {
      // Dry run: only a configured deployment can verify, and nothing here may block.
      if (token && this.turnstile.isConfigured()) {
        const ok = await this.verifyQuietly(token, req);
        if (!ok) this.logger.warn(`Turnstile token rejected on ${req.method} ${req.path} (not enforcing)`);
      }
      return true;
    }

    if (this.isAdminRequest(req)) return true;
    if (!token || token.length > MAX_TOKEN_LENGTH) throw new ForbiddenException(CHALLENGE_MESSAGE);
    // A siteverify outage throws 503 from the service: fail closed, don't blame the user.
    if (!(await this.turnstile.verify(token, resolveClientIp(req) ?? undefined))) {
      throw new ForbiddenException(CHALLENGE_MESSAGE);
    }
    return true;
  }

  private async verifyQuietly(token: string, req: unknown): Promise<boolean> {
    try {
      return await this.turnstile.verify(token, resolveClientIp(req as never) ?? undefined);
    } catch {
      return false; // service already logged the outage
    }
  }

  /**
   * The admin dashboard calls /auth/resend-verification from the browser with its
   * admin bearer. VERIFIED, never decoded: anyone can write {"roles":["admin"]}.
   * Mirrors admin-login.handler's claims (type 'access', roles incl. 'admin', adminId).
   */
  private isAdminRequest(req: { headers?: Record<string, string | string[] | undefined> }): boolean {
    const raw = headerValue(req.headers?.authorization);
    const match = raw ? /^Bearer\s+(\S+)$/i.exec(raw.trim()) : null;
    if (!match) return false;
    try {
      const payload = this.jwtService.verify(match[1]) as {
        type?: unknown;
        roles?: unknown;
        adminId?: unknown;
      };
      return (
        payload.type === 'access' &&
        Array.isArray(payload.roles) &&
        payload.roles.includes('admin') &&
        typeof payload.adminId === 'string' &&
        payload.adminId.length > 0
      );
    } catch {
      return false;
    }
  }
}

const CHALLENGE_MESSAGE = 'Please complete the security check and try again.';
