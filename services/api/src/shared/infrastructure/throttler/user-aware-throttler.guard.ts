// src/shared/infrastructure/throttler/user-aware-throttler.guard.ts
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

type MaybeAuthedRequest = {
  user?: { userId?: string } | undefined;
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
