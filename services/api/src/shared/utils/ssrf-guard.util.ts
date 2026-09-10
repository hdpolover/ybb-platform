// src/shared/utils/ssrf-guard.util.ts
import { isIPv4, isIPv6 } from 'net';
import { lookup } from 'node:dns/promises';

// Audit M211: shared SSRF guard for any outbound request whose target host
// comes from admin/user-settable data (brand.landingUrl / brand.websiteUrl
// today - landing-revalidation.service.ts). Two independent checks, both
// required:
//   1. isOriginAllowed  - the origin (scheme+host+port) must be in an
//      env-configured allowlist. String-only, cheap, and closes the door on
//      a URL that simply isn't one of the platform's real landing domains.
//   2. resolvesToPublicAddressesOnly - the hostname is actually RESOLVED and
//      every returned address is checked against private/loopback/link-local/
//      reserved ranges. This is the part a hostname string check alone
//      cannot do: DNS rebinding (a hostname that resolves to a public IP at
//      allowlist-check time and a private one at request time) and a
//      hostname that simply resolves straight to 169.254.169.254 or
//      127.0.0.1 are both only caught by resolving and checking the IP, not
//      by looking at the hostname string.
// Both must pass before a secret-bearing request is allowed to go out.

/** Parses a comma-separated env var into a set of lowercased, trimmed origins (scheme+host[:port], no trailing slash/path). */
export function parseAllowedOrigins(raw: string | undefined | null): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0)
      .map((entry) => entry.replace(/\/+$/, '')),
  );
}

/** Origin is scheme+host+port, e.g. "https://landing.ybbfoundation.com" - never the full URL/path. */
export function toOrigin(url: URL): string {
  return `${url.protocol}//${url.host}`.toLowerCase();
}

export function isOriginAllowed(url: URL, allowedOrigins: ReadonlySet<string>): boolean {
  return allowedOrigins.has(toOrigin(url));
}

// IPv4 ranges that must never be treated as a legitimate public revalidation
// target: current network, loopback, link-local (incl. the cloud metadata
// address 169.254.169.254), RFC1918 private space, carrier-grade NAT,
// documentation/test-net ranges, multicast, and reserved/broadcast.
function isPrivateIpv4(ip: string): boolean {
  const octets = ip.split('.').map(Number);
  if (octets.length !== 4 || octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    // Not a well-formed IPv4 literal - fail closed (treat as unsafe) rather
    // than let a malformed address slip through as "not private".
    return true;
  }
  const [a, b] = octets;

  if (a === 0) return true; // "this network"
  if (a === 10) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (RFC6598)
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local, incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 0 && octets[2] === 0) return true; // IETF protocol assignments
  if (a === 192 && b === 0 && octets[2] === 2) return true; // TEST-NET-1
  if (a === 192 && b === 88 && octets[2] === 99) return true; // 6to4 relay anycast
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 198 && b >= 18 && b <= 19) return true; // benchmarking
  if (a === 198 && b === 51 && octets[2] === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && octets[2] === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast (224-239) + reserved/broadcast (240-255)

  return false;
}

// IPv6: loopback, unspecified, link-local, unique-local, multicast, and an
// IPv4-mapped/IPv4-compatible address unwrapped and re-checked as IPv4 (a
// resolver can hand back ::ffff:169.254.169.254 for a dual-stack lookup).
function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  if (normalized === '::1') return true; // loopback
  if (normalized === '::') return true; // unspecified

  const v4Mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) return isPrivateIpv4(v4Mapped[1]);

  const firstGroup = normalized.split(':')[0];
  // fe80::/10 link-local: first 10 bits 1111111010 -> first hextet fe80-febf
  if (/^fe[89ab][0-9a-f]$/.test(firstGroup)) return true;
  // fc00::/7 unique local: first 7 bits 1111110 -> first hextet fc00-fdff
  if (/^f[cd][0-9a-f]{2}$/.test(firstGroup)) return true;
  // ff00::/8 multicast
  if (firstGroup.startsWith('ff')) return true;

  return false;
}

export function isPublicIpAddress(ip: string): boolean {
  if (isIPv4(ip)) return !isPrivateIpv4(ip);
  if (isIPv6(ip)) return !isPrivateIpv6(ip);
  // Not a recognizable IP literal at all - fail closed.
  return false;
}

/**
 * Resolves `hostname` and returns true only if DNS returned at least one
 * address AND every address it returned is public. A single private/
 * loopback/link-local address anywhere in the answer fails the whole
 * hostname closed - a multi-A-record host cannot use a public "decoy"
 * address to smuggle a private one past this check.
 *
 * Resolution failures (NXDOMAIN, timeout, etc.) also fail closed (false):
 * an unresolvable host is never a safe request target.
 */
export async function resolvesToPublicAddressesOnly(hostname: string): Promise<boolean> {
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0) return false;
    return records.every((record) => isPublicIpAddress(record.address));
  } catch {
    return false;
  }
}
