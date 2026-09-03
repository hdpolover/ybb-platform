// src/shared/infrastructure/throttler/user-aware-throttler.guard.ts
import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ipThrottleKey, resolveClientIp } from '../../utils/client-ip';

type ThrottledRequest = {
  body?: { email?: unknown } | undefined;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
};

/**
 * Key a throttle bucket on the client IP.
 *
 * This is the guard's tracker for ALL traffic and the only one that bounds an
 * attacker, because it is the only input the caller cannot choose. See
 * resolveClientIp for how the address survives the Cloudflare + Traefik chain;
 * the important half is that it reads the RIGHTMOST x-forwarded-for entry, the
 * one our own edge appended, so a prepended value buys nothing.
 *
 * The address is folded by ipThrottleKey before it becomes a key: canonicalised
 * so one host cannot spell itself several ways for several ceilings, and cut to
 * a /64 on IPv6 so it cannot walk its own routed prefix for an unlimited supply
 * of them.
 *
 * Exported so a route can pin a tier to it explicitly.
 */
export const clientIpTracker = (req: Record<string, unknown>): string =>
  `ip:${ipThrottleKey(resolveClientIp(req as ThrottledRequest))}`;

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
 * A `+tag` is stripped from the local part FOR THE KEY ONLY. Every major
 * provider delivers `victim+1@gmail.com` … `victim+60@gmail.com` to one inbox,
 * so without this a caller multiplies a 10-per-hour mail budget by however many
 * tags they can be bothered to type. Never do this for storage, lookup or
 * delivery — the tag is part of the address the user actually gave us.
 *
 * When there is no email-shaped value, the request gets its OWN key, unique to
 * that request. It deliberately does NOT fall back onto the shared IP bucket:
 * on the 5-per-15-min mailbox tier, five typo'd logins from one office or
 * carrier NAT (`ada@gmail,com`, `admin@ybbhub`, an empty field) would lock
 * every user on that address out of login — self-inflicted by accident and
 * trivially griefable on purpose. A per-request key is safe because junk is
 * still bounded elsewhere: the global short (1s) and medium (10s) tiers key on
 * the IP for every route, and every route pinning this tracker also pins a
 * clientIpTracker tier that has to pass too. Verified route by route in
 * auth.controller.ts — do not pin emailTracker anywhere without an IP tier
 * beside it.
 */
export const emailTracker = (req: Record<string, unknown>): string => {
  const email = (req as ThrottledRequest).body?.email;
  if (typeof email === 'string') {
    const normalised = email.trim().toLowerCase();
    if (normalised.length <= 254 && EMAIL_SHAPE.test(normalised)) {
      const at = normalised.lastIndexOf('@');
      const local = normalised.slice(0, at);
      const plus = local.indexOf('+');
      const mailbox = plus === -1 ? normalised : local.slice(0, plus) + normalised.slice(at);
      return `email:${mailbox}`;
    }
  }
  return `email:unresolved:${randomUUID()}`;
};

/**
 * Track every request by client IP, resolved through the proxy chain.
 *
 * The library's own default is `req.ip`, which behind Traefik and Cloudflare is
 * a load balancer — one bucket shared by the entire internet. This guard exists
 * to swap that for resolveClientIp; that is its whole job.
 *
 * It briefly keyed on `request.body.email` instead, to stop the whole site
 * sharing one bucket back when ybb-program-next's auth proxy routes did not
 * forward x-forwarded-for. They do now (lib/server/forwardedFor.ts, nine auth
 * routes, plus cf-connecting-ip since 96f0f83), so the address here is the real
 * caller and the workaround is not needed — which matters, because the
 * workaround was worse than the problem: guards run before pipes, so that email
 * was the RAW unvalidated body, and any caller on any anonymous POST route
 * could mint a fresh bucket per request just by varying a JSON field. The cap
 * bounded nothing.
 *
 * NOT per-user, despite the class name and despite what commit e233af76 claimed
 * to ship. This guard is registered as an APP_GUARD (throttler.module.ts, the
 * only one in the app) and JwtAuthGuard is route/controller-scoped, and Nest
 * runs global guards BEFORE controller guards. So `req.user` is always
 * undefined at this point — verified empirically, not assumed — and the
 * `if (userId) return \`user:${userId}\`` branch that used to sit here could
 * never execute. Rate limiting authenticated traffic by identity instead of
 * address is therefore still UNIMPLEMENTED. Doing it properly means running
 * after authentication (an interceptor, or a guard ordered behind JwtAuthGuard)
 * — not a line in getTracker.
 *
 * Mailbox protection is separate and real. The routes that genuinely need
 * per-address budgeting (register, forgot-password, resend-verification) pin
 * one tier to emailTracker and another to clientIpTracker, and both have to
 * pass — see auth.controller.ts.
 */
@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    return clientIpTracker(req);
  }
}
