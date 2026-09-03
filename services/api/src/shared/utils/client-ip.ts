// src/shared/utils/client-ip.ts
import { BlockList, isIP, isIPv6, SocketAddress } from 'net';

/**
 * TWO INFRA ASSUMPTIONS THIS FILE IS LOAD-BEARING ON. Nothing in code pins
 * either of them, and no test fails if one breaks — so they are written down
 * here, where the next person to touch this reads them.
 *
 * 1. Traefik must run WITHOUT `forwardedHeaders.trustedIPs` / `insecure`.
 *    We rely on Traefik APPENDING the peer it actually saw to
 *    x-forwarded-for, which makes the rightmost entry the one entry a caller
 *    cannot write. If anyone sets `forwardedHeaders.insecure: true`, a
 *    client-supplied x-forwarded-for survives to the origin untouched, the
 *    rightmost entry becomes attacker-chosen, and the Cloudflare trust check
 *    below inverts into a total bypass (send `x-forwarded-for: 172.64.0.1`
 *    and any `cf-connecting-ip` you like). Silently, with every test still
 *    green.
 *
 * 2. `isCloudflareEdge` proves "some Cloudflare customer", NOT "our zone".
 *    The published ranges are shared by every Cloudflare tenant, so an
 *    attacker who points their own Cloudflare zone at our origin address
 *    lands a genuine CF edge as the peer and gets `cf-connecting-ip` trusted.
 *    The real fix is proving the hop is OUR edge: Cloudflare Authenticated
 *    Origin Pulls (mTLS terminated at Traefik), or a shared secret header set
 *    by a Cloudflare Transform Rule and required alongside the range check.
 *    Neither is implemented; both are infra work, not code work here.
 *
 * Also worth knowing: not every brand is behind the CDN. ybbfoundation.com is
 * NOT Cloudflare-proxied (194.163.42.126, LiteSpeed, Niagahoster nameservers) —
 * though note that is the legacy PHP stack on separate infrastructure, not this
 * platform's origin, so that brand does not reach this API at all. The live
 * example of a non-CDN path into THIS service is a direct hit on the origin
 * address, which is reachable (see the audit's N1). On that path the
 * cf-connecting-ip branch is dead and the x-forwarded-for fallback is what
 * runs. Any change here has to stay correct on both paths, because both are
 * live today.
 */

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

/** The shape of an Express request this resolver reads. */
export type ClientAddressedRequest = {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
};

/**
 * The caller's address, as far as it can be trusted.
 *
 * The topology is two hops, not one: client -> Cloudflare -> Traefik -> API.
 * Traefik appends the peer it actually saw, which is a Cloudflare EDGE
 * address, and Cloudflare rotates edges between connections — so reading the
 * last x-forwarded-for entry spreads one client across several values and
 * lumps unrelated clients into the same one.
 *
 * Cloudflare puts the real client in cf-connecting-ip, but that header is just
 * as forgeable as any other, and the origin is reachable directly (a caller
 * who knows the origin address skips Cloudflare entirely). So trusting it
 * unconditionally would let every direct caller name themselves.
 *
 * The rule that is correct on BOTH paths: trust cf-connecting-ip only when the
 * hop that reached us is genuinely inside a published Cloudflare range.
 * Otherwise fall back to the RIGHTMOST VALID x-forwarded-for entry — the
 * address our own edge appended. A client can prepend anything it likes, but
 * those values land to the LEFT of what our edge observed, so the rightmost
 * entry is the one it is safe to read. Taking the FIRST entry let any caller
 * name themselves.
 *
 * EVERY return path is isIP()-validated. That is not cosmetic: this value is
 * written to `UserSession.ipAddress` (`@db.Inet`) and `DataChangeLog.ipAddress`
 * (`@db.VarChar(45)`), so a bracketed `[2001:db8::1]:443`, a ported
 * `203.0.113.9:51234` or an oversized junk string raises Postgres 22P02 / 22001
 * and 500s login. Before this resolver existed the parameter was `req.ip`,
 * which is structurally always valid; reading headers removed that guarantee,
 * so the validation has to be put back explicitly. Same defect class as the
 * three VarChar-overflow incidents already on record in this codebase.
 *
 * `req.ip` is the last resort (a local or in-cluster call with no proxy in
 * front). `req.ips` is deliberately NOT consulted: Express only populates it
 * when `trust proxy` is set, which main.ts explains why we do not do, and the
 * moment anyone did the value would be attacker-chosen.
 *
 * Returns null when nothing usable is available, so callers decide what an
 * unknown address means rather than inheriting a magic string.
 *
 * The address is returned VERBATIM — full, unfolded, uncanonicalised — because
 * its job here is to identify one caller in a log or a session row. Throttle
 * keys want the opposite (see ipThrottleKey below); do not merge the two.
 */
export function resolveClientIp(req: ClientAddressedRequest): string | null {
  const forwarded = req.headers?.['x-forwarded-for'];
  const chain = Array.isArray(forwarded) ? forwarded.join(',') : forwarded;
  // The LAST non-empty entry, and only if it is an address. Empty segments are
  // formatting noise from a repeated header, so they are dropped; anything
  // else is not. Deliberately NOT "the rightmost entry that happens to parse":
  // skipping over a malformed final entry would promote the value to its left,
  // which is one the CALLER wrote. An unusable last entry means we do not know
  // who called, so we say so and fall back to the socket peer.
  const last =
    typeof chain === 'string'
      ? chain
          .split(',')
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0)
          .pop()
      : undefined;
  const lastForwarded = last && isIP(last) ? last : undefined;

  if (lastForwarded && isCloudflareEdge(lastForwarded)) {
    const cfConnectingIp = firstHeaderValue(req.headers?.['cf-connecting-ip']);
    // Malformed or absent: fall through to the x-forwarded-for entry rather
    // than treating every such request as one shared unknown caller.
    if (cfConnectingIp && isIP(cfConnectingIp)) {
      return cfConnectingIp;
    }
  }

  if (lastForwarded) return lastForwarded;
  return req.ip && isIP(req.ip) ? req.ip : null;
}

// `::ffff:198.51.100.7` and `198.51.100.7` are the same host. SocketAddress
// already folds the hex spelling (`::ffff:c633:6407`) onto this dotted one, so
// one pattern catches every encoding of a v4-mapped address.
const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/;

/** First four groups of an IPv6 address, i.e. its /64 prefix. */
function ipv6Prefix64(canonical: string): string {
  const [head, tail = ''] = canonical.split('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail ? tail.split(':') : [];
  const elided = canonical.includes('::') ? 8 - headGroups.length - tailGroups.length : 0;
  const groups = [...headGroups, ...Array(Math.max(elided, 0)).fill('0'), ...tailGroups];
  return groups.slice(0, 4).join(':');
}

/**
 * Fold an address to the unit a THROTTLE BUCKET should cover.
 *
 * Two things happen here that must NOT happen in resolveClientIp:
 *
 * 1. Canonicalisation. The guard string-keys whatever it is handed, so
 *    `2001:db8::1`, `2001:DB8::1`, the fully expanded form and
 *    `2001:db8::0.0.0.1` were four buckets for one address, and
 *    `::ffff:198.51.100.7` was a second bucket for `198.51.100.7`. Free extra
 *    ceilings for anyone who noticed.
 *
 * 2. IPv6 keys on the /64, not the /128. Every VPS ships a routed /64 and
 *    residential ISPs hand out a /56, so keying the full address let one host
 *    iterate source addresses for an unlimited supply of fresh ceilings, with
 *    no aggregate cap anywhere. /64 is the smallest block a single subscriber
 *    is reliably given, so it is the honest unit of "one caller". Coarser than
 *    /128 by design — that is the point.
 *
 * IPv4 keys unchanged: one address is already one subscriber there.
 */
export function ipThrottleKey(address: string | null | undefined): string {
  if (!address || !isIP(address)) return 'unknown';

  let canonical: string;
  try {
    canonical = new SocketAddress({
      address,
      family: isIPv6(address) ? 'ipv6' : 'ipv4',
    }).address;
  } catch {
    return 'unknown';
  }

  const mapped = IPV4_MAPPED.exec(canonical);
  if (mapped) return mapped[1];
  if (!isIPv6(canonical)) return canonical;

  return `${ipv6Prefix64(canonical)}::/64`;
}
