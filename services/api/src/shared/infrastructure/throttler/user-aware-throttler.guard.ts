// src/shared/infrastructure/throttler/user-aware-throttler.guard.ts
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { BlockList, isIP, isIPv6 } from 'net';

type MaybeAuthedRequest = {
  user?: { userId?: string } | undefined;
  body?: { email?: unknown } | undefined;
  ip?: string;
  ips?: string[];
  headers?: Record<string, string | string[] | undefined>;
};

/**
 * Cloudflare's published edge ranges.
 *
 * Source: https://www.cloudflare.com/ips-v4 and https://www.cloudflare.com/ips-v6
 * Fetched 2026-09-03. Cloudflare adds ranges from time to time, so this needs a
 * periodic re-check against those two URLs. A stale list is not a security
 * hole — an unrecognised edge address just falls back to the x-forwarded-for
 * behaviour below, which is safe everywhere, only coarser behind the CDN.
 */
const CLOUDFLARE_CIDRS = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

// net.BlockList does the CIDR matching for both families, so there is no
// hand-rolled bit arithmetic and no new dependency. It returns false rather
// than throwing on a malformed address, which is exactly what we want for a
// header value a client controls.
const CLOUDFLARE_EDGES = CLOUDFLARE_CIDRS.reduce((list, cidr) => {
  const [address, prefix] = cidr.split('/');
  list.addSubnet(address, Number(prefix), isIPv6(address) ? 'ipv6' : 'ipv4');
  return list;
}, new BlockList());

const isCloudflareEdge = (address: string): boolean =>
  isIPv6(address) ? CLOUDFLARE_EDGES.check(address, 'ipv6') : CLOUDFLARE_EDGES.check(address, 'ipv4');

const firstHeaderValue = (value: string | string[] | undefined): string | undefined =>
  (Array.isArray(value) ? value[0] : value)?.trim() || undefined;

/**
 * Key a throttle bucket on the client IP, ignoring identity and body.
 *
 * The topology is two hops, not one: client -> Cloudflare -> Traefik -> API.
 * Traefik appends the peer it actually saw, which is a Cloudflare EDGE
 * address, and Cloudflare rotates edges between connections — so billing the
 * last x-forwarded-for entry spreads one client across several buckets and
 * lumps unrelated clients into the same one.
 *
 * Cloudflare puts the real client in cf-connecting-ip, but that header is just
 * as forgeable as any other, and the origin is reachable directly (a caller
 * who knows the origin address skips Cloudflare entirely). So trusting it
 * unconditionally would hand every direct caller a free choice of bucket.
 *
 * The rule that is correct on BOTH paths: trust cf-connecting-ip only when the
 * hop that reached us is genuinely inside a published Cloudflare range.
 * Otherwise fall back to the LAST x-forwarded-for entry — the address our own
 * edge appended. A client can prepend anything it likes, but those values land
 * to the LEFT of what our edge observed, so the rightmost entry is the one it
 * is safe to bill. Taking the FIRST entry let any caller pick its own bucket.
 *
 * Exported so a route can opt OUT of the email keying below via
 * `@Throttle({ default: { limit, ttl, getTracker: clientIpTracker } })`.
 * Email keying is right for routes where the address is the thing being
 * protected (one mailbox, one budget). It is exactly wrong for a route that
 * guards a shared secret: the caller picks the email, so every guess can buy a
 * fresh bucket and the cap stops bounding anything.
 */
export const clientIpTracker = (req: Record<string, unknown>): string => {
  const request = req as MaybeAuthedRequest;
  const forwarded = request.headers?.['x-forwarded-for'];
  const chain = Array.isArray(forwarded) ? forwarded.join(',') : forwarded;
  const lastForwarded =
    typeof chain === 'string'
      ? chain
          .split(',')
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0)
          .pop()
      : undefined;

  if (lastForwarded && isCloudflareEdge(lastForwarded)) {
    const cfConnectingIp = firstHeaderValue(request.headers?.['cf-connecting-ip']);
    // Malformed or absent: fall through to the x-forwarded-for entry rather
    // than keying every such request on one shared garbage bucket.
    if (cfConnectingIp && isIP(cfConnectingIp)) {
      return `ip:${cfConnectingIp}`;
    }
  }

  return `ip:${lastForwarded || request.ips?.[0] || request.ip || 'unknown'}`;
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

    // Fall back to the client IP.
    return clientIpTracker(req);
  }
}
