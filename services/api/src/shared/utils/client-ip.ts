// src/shared/utils/client-ip.ts
import { BlockList, isIP, isIPv6 } from 'net';

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
 * Otherwise fall back to the LAST x-forwarded-for entry — the address our own
 * edge appended. A client can prepend anything it likes, but those values land
 * to the LEFT of what our edge observed, so the rightmost entry is the one it
 * is safe to read. Taking the FIRST entry let any caller name themselves.
 *
 * `req.ip` is the last resort (a local or in-cluster call with no proxy in
 * front). `req.ips` is deliberately NOT consulted: Express only populates it
 * when `trust proxy` is set, which main.ts explains why we do not do, and the
 * moment anyone did the value would be attacker-chosen.
 *
 * Returns null when nothing usable is available, so callers decide what an
 * unknown address means rather than inheriting a magic string.
 */
export function resolveClientIp(req: ClientAddressedRequest): string | null {
  const forwarded = req.headers?.['x-forwarded-for'];
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
    const cfConnectingIp = firstHeaderValue(req.headers?.['cf-connecting-ip']);
    // Malformed or absent: fall through to the x-forwarded-for entry rather
    // than treating every such request as one shared unknown caller.
    if (cfConnectingIp && isIP(cfConnectingIp)) {
      return cfConnectingIp;
    }
  }

  return lastForwarded || req.ip || null;
}
