// src/shared/infrastructure/throttler/user-aware-throttler.guard.ts
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { resolveClientIp } from '../../utils/client-ip';

type MaybeAuthedRequest = {
  user?: { userId?: string } | undefined;
  body?: { email?: unknown } | undefined;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
};

/**
 * Key a throttle bucket on the client IP.
 *
 * This is the guard's default for anonymous traffic and the only tracker that
 * bounds an attacker, because it is the only input the caller cannot choose.
 * See resolveClientIp for how the address survives the Cloudflare + Traefik
 * chain; the important half is that it reads the RIGHTMOST x-forwarded-for
 * entry, the one our own edge appended, so a prepended value buys nothing.
 *
 * Exported so a route can pin a tier to it explicitly.
 */
export const clientIpTracker = (req: Record<string, unknown>): string =>
  `ip:${resolveClientIp(req as MaybeAuthedRequest) ?? 'unknown'}`;

// Deliberately loose: the guard runs BEFORE the validation pipe, so this sees
// the raw body. It only has to be tight enough that an attacker cannot mint
// unbounded distinct buckets out of junk — the mailbox itself is validated
// downstream by the DTO.
const EMAIL_SHAPE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

/**
 * Key a throttle bucket on the mailbox the request is addressed to.
 *
 * Correct only where the ADDRESS is the resource being protected: one mailbox,
 * one mail budget, no matter who asks or from where. Wrong everywhere else,
 * because the caller writes the body — on a credential route it hands an
 * attacker a fresh bucket per account and no aggregate ceiling at all, which
 * is the exact shape credential stuffing wants.
 *
 * So it is opt-in per route, never the guard's default, and every route that
 * opts in also pins a second tier to clientIpTracker: the two limits are ANDed
 * (the guard evaluates every configured throttler and requires all of them to
 * pass), so a mailbox stays protected AND one host stays bounded.
 *
 * Falls back to the client IP when there is no email-shaped value, which is
 * the strict direction — you cannot dodge into an unlimited bucket by sending
 * junk, you just land in the shared one.
 */
export const emailTracker = (req: Record<string, unknown>): string => {
  const email = (req as MaybeAuthedRequest).body?.email;
  if (typeof email === 'string') {
    const normalised = email.trim().toLowerCase();
    if (normalised.length <= 254 && EMAIL_SHAPE.test(normalised)) return `email:${normalised}`;
  }
  return clientIpTracker(req);
};

/**
 * Rate limit an authenticated request by WHO it is, not where it comes from.
 *
 * The library default is the client IP, which means every participant behind
 * one NAT shares a single bucket and throttles their neighbours. Many of these
 * participants are on university or carrier grade NAT, so on a deadline day a
 * few active users could exhaust the window for everyone on that address. That
 * is the shape of the ThrottlerException reports on 2026-08-31.
 *
 * Anonymous traffic tracks by IP, full stop. It briefly keyed on
 * `request.body.email` instead, to stop the whole site sharing one bucket
 * back when ybb-program-next's auth proxy routes did not forward
 * x-forwarded-for. They do now (lib/server/forwardedFor.ts, nine auth routes),
 * so the address here is the real caller and the workaround is not needed —
 * which matters, because the workaround was worse than the problem: guards run
 * before pipes, so that email was the RAW unvalidated body, and any caller on
 * any anonymous POST route could mint a fresh bucket per request just by
 * varying a JSON field. The cap bounded nothing.
 *
 * Mailbox protection did not go away with it. The routes that genuinely need
 * per-address budgeting (register, forgot-password, resend-verification) pin
 * one tier to emailTracker and another to clientIpTracker, and both have to
 * pass — see auth.controller.ts.
 */
@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const userId = (req as MaybeAuthedRequest).user?.userId;
    if (userId) return `user:${userId}`;

    return clientIpTracker(req);
  }
}
