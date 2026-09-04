// src/shared/infrastructure/throttler/user-aware-throttler.guard.ts
import { createHash, randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  ThrottlerGenerateKeyFunction,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { ipThrottleKey, resolveClientIp } from '../../utils/client-ip';

type ThrottledRequest = {
  body?: { email?: unknown } | undefined;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
};

/**
 * Key a throttle bucket on the client IP.
 *
 * This is the guard's tracker for all ANONYMOUS traffic, and the only one that
 * bounds a caller who has no account, because it is the only input they cannot
 * choose. Signed-in requests key on the verified token subject instead — see
 * the guard below, and the trade that comes with it. See
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
 * one mail budget, no matter who asks or from where. That guarantee is PER
 * ROUTE unless the tier also pins a generateKey — the library hashes the
 * handler name into the storage key (throttler.guard.js:149), so N sibling
 * routes pinning the same tier give one inbox N budgets. See
 * recoveryMailboxBucket below, and auth.controller.ts for which routes share a
 * bucket and which deliberately do not. Wrong everywhere else,
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
 * Collapse the sibling ACCOUNT-RECOVERY routes onto one shared mailbox bucket.
 *
 * @nestjs/throttler hashes `ClassName-HandlerName-tierName` into every storage
 * key (throttler.guard.js:148-150), so a tier pinned to three handlers is three
 * independent budgets for the same tracker. /auth/forgot-password and
 * /auth/resend-verification each held their own 10-per-hour allowance against
 * one inbox, so the real ceiling was 20 where the comment advertised 10 — and
 * the damage that ceiling exists to bound is delivered mail, whose bounce and
 * spam-complaint cost lands on OUR sending domain.
 *
 * TWO TRAPS, both load-bearing:
 *
 * 1. NEVER reference `this`. throttler.guard.js:115 calls this function bare
 *    (`generateKey(context, tracker, throttler.name)`), not as a method, so a
 *    `this` would be undefined and every request on these routes would 500 —
 *    turning a rate limiter into an outage.
 *
 * 2. IT MUST HASH. throttler.guard.js:116 hands the return value straight to
 *    storage as the Redis key. The library default hashes for us; a custom one
 *    that returns the tracker verbatim would write plaintext user mailboxes
 *    into Redis keys, visible to anything that can run KEYS.
 *
 * The cluster name is baked in rather than parameterised: there is exactly one,
 * and a second caller sharing this function would silently merge two unrelated
 * budgets. Credential routes must NEVER use it — a login and a password reset
 * are different questions, and sharing a bucket would let either deny the
 * other. /auth/register is deliberately NOT in this cluster either; see
 * auth.controller.ts for why.
 */
export const recoveryMailboxBucket: ThrottlerGenerateKeyFunction = (
  _context,
  trackerString,
  throttlerName,
) => createHash('sha256').update(`mail-recovery-${throttlerName}-${trackerString}`).digest('hex');

/**
 * Track a request by the AUTHENTICATED USER when there is one, else by client
 * IP resolved through the proxy chain.
 *
 * WHY NOT JUST THE IP. An IP is a building. A 40-seat school lab, a university
 * and an Indonesian carrier's CGNAT pool all present as one address, so on a
 * deadline day the Nth participant through the door ate the whole bucket and
 * got a ThrottlerException for doing nothing wrong — the 2026-08-31 incident.
 * Signed-in traffic carries a better identity than its address, so it should
 * be billed to that identity and stop colliding with the neighbours.
 *
 * WHY THE TOKEN IS VERIFIED, NOT DECODED. This guard is the app's only
 * APP_GUARD and JwtAuthGuard is route/controller-scoped; Nest runs global
 * guards BEFORE controller guards, so `req.user` is always undefined here.
 * That is exactly why commit e233af76's `if (userId) return user:${userId}`
 * branch could never execute. The fix is to read the Bearer token ourselves —
 * and then the ONLY thing standing between an attacker and a bucket of their
 * choosing is the signature. jwt.decode(), or splitting the token on '.', would
 * let any caller write `{"sub":"whatever"}` and mint unlimited fresh ceilings:
 * strictly worse than the shared IP bucket it replaces. So it goes through
 * JwtService.verify with the app's signing secret, and every failure — no
 * header, wrong scheme, bad signature, expired, wrong type, no subject — falls
 * back to the IP key. This method never throws: a rate limiter that 500s a
 * request is a worse outage than the one it prevents.
 *
 * Only `type: 'access'` earns a user bucket. A refresh token is signed with the
 * same secret and is rejected downstream as a bearer (jwt.strategy.ts), so it
 * must not buy a bucket here either. Untyped legacy tokens fall back to IP too:
 * they are simply status quo, and they expire on their own.
 *
 * THE TRADE, STATED PLAINLY. Once authenticated traffic keys per user, the
 * per-IP tiers no longer bound a caller who holds N valid accounts — N accounts
 * is N buckets, from one host. That is inherent to per-user limiting and it is
 * the intent, not an oversight: the per-IP ceiling exists to stop ANONYMOUS
 * abuse and to keep one host from sweeping, and the anonymous credential routes
 * (login, register, forgot-password, register-admin) pin
 * clientIpTracker/emailTracker explicitly, so they are unaffected by this
 * change — you cannot present a
 * valid access token before you have logged in. What an attacker gains is
 * proportional to how many real accounts they can create and keep, which is
 * bounded by registration throttling and account lockout, not by this guard.
 * The alternative — leaving every signed-in participant sharing their
 * building's bucket — was a live denial of service against legitimate users.
 *
 * Reach caveat, unchanged by this commit: only the 9 auth routes in
 * ybb-program-next that call forwardedForHeader forward x-forwarded-for. The
 * other ~52 route.ts handlers forward nothing, so resolveClientIp falls through
 * to req.ip (the Next container) and they all key into ONE bucket shared by the
 * whole internet. Closing that means forwarding the header from those handlers,
 * not changing anything here. Per-user keying does soften it for signed-in
 * traffic on those routes, which is a side benefit, not the fix.
 *
 * Mailbox protection is separate and real: register, forgot-password and
 * resend-verification pin one tier to emailTracker and another to
 * clientIpTracker, and both have to pass — see auth.controller.ts. Note the
 * mailbox tier aggregates only across the two RECOVERY routes, via
 * recoveryMailboxBucket; register keeps its own budget on purpose.
 */
/**
 * Where a request's resolved tracker is cached for the life of that request.
 *
 * @nestjs/throttler calls getTracker ONCE PER CONFIGURED THROTTLER and four
 * tiers are registered (short/medium/long/default), so without this every
 * request paid four jwt.verify calls. The failing branch is the expensive one
 * — jsonwebtoken constructs and stack-captures a JsonWebTokenError per call —
 * so the attacker's input selects the cost: a bad signature measured 425us of
 * canActivate against a 36us no-token baseline, ~2350 rps to saturate a core.
 * And the tracker is computed BEFORE storageService.increment, so the bill is
 * paid even on a request that is about to be refused with a 429: the rate
 * limiter could not rate-limit its own cost.
 *
 * A Symbol so it cannot collide with anything else hung off the request, and
 * so it never appears in JSON, logs or Object.keys.
 *
 * It cannot leak a key across trackers. throttler.guard.js resolves
 * `routeOrClassGetTracker || namedThrottler.getTracker || commonOptions.getTracker`
 * per tier, so a tier pinned to clientIpTracker or emailTracker with @Throttle
 * calls that function directly and never enters this method — verified against
 * @nestjs/throttler 6.5.0, and asserted in the spec.
 */
const TRACKER_MEMO: unique symbol = Symbol('ybb.throttler.tracker');

@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const memo = req as { [TRACKER_MEMO]?: string };
    return (memo[TRACKER_MEMO] ??= this.userTracker(req) ?? clientIpTracker(req));
  }

  /**
   * `user:<sub>` for a genuinely valid access token, null for everything else.
   * Never throws — every rejection is a fall-through to IP keying.
   */
  private userTracker(req: Record<string, unknown>): string | null {
    const header = (req as ThrottledRequest).headers?.authorization;
    const raw = Array.isArray(header) ? header[0] : header;
    if (typeof raw !== 'string') return null;

    const match = /^Bearer\s+(\S+)$/i.exec(raw.trim());
    if (!match) return null;

    try {
      // verify(), not decode(): the signature is the only reason a caller
      // cannot pick their own bucket. It also enforces exp, so an expired
      // token lands back on the IP key.
      const payload = this.jwtService.verify(match[1]) as { sub?: unknown; type?: unknown };
      if (payload.type !== 'access') return null;
      return typeof payload.sub === 'string' && payload.sub.length > 0
        ? `user:${payload.sub}`
        : null;
    } catch {
      return null;
    }
  }
}
