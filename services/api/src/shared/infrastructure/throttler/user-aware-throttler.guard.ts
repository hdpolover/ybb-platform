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
 * DOTS are stripped too, but ONLY on gmail.com / googlemail.com, which are one
 * inbox and ignore dots in the local part. `v.ictim@`, `vi.ctim@`, `v.i.ctim@`
 * are the same person: an 8-character local part yields ~64 same-inbox spellings
 * and /auth/register accepted 301 requests for one inbox from one host against
 * an intended 10, every one of them a real verification mail whose bounce and
 * spam-complaint damage lands on OUR sending domain. googlemail.com folds to
 * gmail.com for the same reason — same inbox, and otherwise it is a free 2x.
 *
 * This is PROVIDER-SPECIFIC behaviour and is deliberately not generalised.
 * On most domains a dot is significant, so `a.b@example.com` and `ab@example.com`
 * are two different people and must keep two different budgets. Do not extend
 * this list without checking that the provider genuinely ignores dots.
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
      const plus = normalised.slice(0, at).indexOf('+');
      const local = normalised.slice(0, plus === -1 ? at : plus);
      const domain = normalised.slice(at + 1);
      if (domain === 'gmail.com' || domain === 'googlemail.com') {
        return `email:${local.split('.').join('')}@gmail.com`;
      }
      return `email:${local}@${domain}`;
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
 * forward x-forwarded-for. That workaround is gone, and had to be: guards run
 * before pipes, so that email was the RAW unvalidated body, and any caller on
 * any anonymous POST route could mint a fresh bucket per request just by
 * varying a JSON field. The cap bounded nothing.
 *
 * But be honest about how far the replacement reaches. This guard is GLOBAL,
 * and there are TWO cases:
 *
 *   - The 9 auth routes that call forwardedForHeader (lib/server/forwardedFor.ts).
 *     Those forward x-forwarded-for, which is merged and deployed.
 *     DEPLOY ORDER MATTERS HERE: they only forward cf-connecting-ip once
 *     ybb-program-next's fix/forward-cf-connecting-ip ships. Until it does,
 *     the last forwarded hop is a Cloudflare EDGE and there is no
 *     cf-connecting-ip to read, so resolveClientIp returns that edge — which
 *     Cloudflare rotates between connections. The per-IP tiers below are then
 *     coarser than they look: several participants share an edge bucket and
 *     one attacker gets a fresh one per rotation. Ship that branch with or
 *     before this one, and only then do these tiers mean what they say.
 *   - The other ~52 route.ts handlers under ybb-program-next/app/api, which
 *     forward nothing. resolveClientIp finds no trustworthy header and falls
 *     through to req.ip — the Next container. Every one of those routes keys
 *     into ONE constant bucket shared by the whole internet, exactly the
 *     failure this guard was written to remove. Their limits are effectively a
 *     global cap, not a per-caller one: useless against an attacker and a
 *     denial-of-service against everyone else if it ever trips.
 *
 * Closing the second case means forwarding the header from those handlers, not
 * changing anything here. Filed separately; do not read the per-IP sizing in
 * auth.controller.ts as applying to routes outside that list of 9.
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
