// src/shared/infrastructure/throttler/user-aware-throttler.guard.ts
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

type MaybeAuthedRequest = {
  user?: { userId?: string } | undefined;
  body?: { email?: unknown } | undefined;
  ip?: string;
  ips?: string[];
  headers?: Record<string, string | string[] | undefined>;
};

/**
 * Rate limit an authenticated request by WHO it is, not where it comes from.
 *
 * The default tracker is the client IP, which means every participant behind
 * one NAT shares a single bucket and throttles their neighbours. Many of these
 * participants are on university or carrier grade NAT, so on a deadline day a
 * few active users could exhaust the window for everyone on that address. That
 * is the shape of the ThrottlerException reports on 2026-08-31.
 *
 * Anonymous traffic still tracks by IP, so this does not weaken protection
 * against the case rate limiting actually exists for: an unauthenticated
 * flood. It only stops real, signed in users from competing with each other.
 */
@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as MaybeAuthedRequest;
    const userId = request.user?.userId;
    if (userId) return `user:${userId}`;

    // Anonymous but addressed to a specific mailbox (register, login,
    // forgot-password, resend-verification): key on that address.
    //
    // The IP fallback below is not the participant's IP for these routes.
    // ybb-program-next proxies them server-side and its route handlers do not
    // forward x-forwarded-for, so the API sees the Next container for every
    // one of them — a single bucket shared by the whole site. Registration is
    // capped at 3 per hour, so the fourth person to sign up in an hour was
    // refused because three strangers signed up first, and had no way to tell
    // why. Keying on the address gives each person the budget the limit was
    // always meant to express.
    //
    // It also keeps the protection the limit exists for. Cycling addresses
    // buys an attacker nothing: each address already costs one request, and
    // the per-address cap still bounds mail sent to any single mailbox.
    const email = request.body?.email;
    if (typeof email === 'string' && email.trim().length > 0) {
      return `email:${email.trim().toLowerCase()}`;
    }

    // Fall back to the IP exactly as the base guard would.
    const forwarded = request.headers?.['x-forwarded-for'];
    const firstForwarded = Array.isArray(forwarded)
      ? forwarded[0]
      : typeof forwarded === 'string'
        ? forwarded.split(',')[0]?.trim()
        : undefined;
    return `ip:${firstForwarded || request.ips?.[0] || request.ip || 'unknown'}`;
  }
}
