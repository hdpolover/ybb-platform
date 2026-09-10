// src/shared/utils/ssrf-guard.util.spec.ts
import { lookup } from 'node:dns/promises';
import {
  parseAllowedOrigins,
  isOriginAllowed,
  toOrigin,
  isPublicIpAddress,
  resolvesToPublicAddressesOnly,
} from './ssrf-guard.util';

jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}));

describe('parseAllowedOrigins', () => {
  it('parses a comma-separated list into a lowercased, trimmed set with no trailing slash', () => {
    const set = parseAllowedOrigins(' https://Landing.YbbFoundation.com/ , https://icy.ybbfoundation.com ');
    expect(set).toEqual(new Set(['https://landing.ybbfoundation.com', 'https://icy.ybbfoundation.com']));
  });

  it('returns an empty set for undefined/null/empty input, not a wildcard', () => {
    expect(parseAllowedOrigins(undefined)).toEqual(new Set());
    expect(parseAllowedOrigins(null)).toEqual(new Set());
    expect(parseAllowedOrigins('')).toEqual(new Set());
  });

  it('drops empty entries from stray commas', () => {
    expect(parseAllowedOrigins('https://a.example.com,,https://b.example.com,')).toEqual(
      new Set(['https://a.example.com', 'https://b.example.com']),
    );
  });
});

describe('isOriginAllowed / toOrigin', () => {
  const allowed = parseAllowedOrigins('https://landing.ybbfoundation.com,https://icy.ybbfoundation.com');

  it('allows an exact scheme+host match', () => {
    expect(isOriginAllowed(new URL('https://landing.ybbfoundation.com/api/home/revalidate'), allowed)).toBe(true);
  });

  it('rejects a host not in the allowlist, even a plausible-looking one', () => {
    expect(isOriginAllowed(new URL('https://attacker.example.com'), allowed)).toBe(false);
  });

  it('rejects a scheme mismatch (http vs https) against an https-only entry', () => {
    expect(isOriginAllowed(new URL('http://landing.ybbfoundation.com'), allowed)).toBe(false);
  });

  it('rejects a subdomain that was not itself allow-listed', () => {
    expect(isOriginAllowed(new URL('https://evil.landing.ybbfoundation.com'), allowed)).toBe(false);
  });

  it('toOrigin ignores path and query', () => {
    expect(toOrigin(new URL('https://landing.ybbfoundation.com/some/path?x=1'))).toBe(
      'https://landing.ybbfoundation.com',
    );
  });
});

describe('isPublicIpAddress', () => {
  it.each([
    ['127.0.0.1', false], // loopback
    ['169.254.169.254', false], // cloud metadata
    ['10.0.0.5', false], // RFC1918
    ['172.16.0.1', false], // RFC1918
    ['172.31.255.255', false], // RFC1918 upper bound
    ['192.168.1.1', false], // RFC1918
    ['100.64.0.1', false], // CGNAT
    ['0.0.0.0', false], // this network
    ['224.0.0.1', false], // multicast
    ['255.255.255.255', false], // broadcast/reserved
    ['192.0.2.1', false], // TEST-NET-1
    ['8.8.8.8', true], // public
    ['1.1.1.1', true], // public
    ['203.0.113.5', false], // TEST-NET-3
    ['172.15.255.255', true], // just below RFC1918 172.16/12 - must stay public
    ['172.32.0.0', true], // just above RFC1918 172.16/12 - must stay public
  ])('classifies %s as public=%s', (ip, expected) => {
    expect(isPublicIpAddress(ip)).toBe(expected);
  });

  it.each([
    ['::1', false], // loopback
    ['::', false], // unspecified
    ['fe80::1', false], // link-local
    ['fc00::1', false], // unique local
    ['fd12:3456:789a::1', false], // unique local
    ['ff02::1', false], // multicast
    ['::ffff:169.254.169.254', false], // IPv4-mapped metadata address
    ['::ffff:8.8.8.8', true], // IPv4-mapped public address
    ['2001:4860:4860::8888', true], // public (Google DNS v6)
  ])('classifies IPv6 %s as public=%s', (ip, expected) => {
    expect(isPublicIpAddress(ip)).toBe(expected);
  });

  it('fails closed on a malformed IP literal', () => {
    expect(isPublicIpAddress('not-an-ip')).toBe(false);
  });
});

describe('resolvesToPublicAddressesOnly', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns true when every resolved address is public', async () => {
    (lookup as jest.Mock).mockResolvedValue([
      { address: '8.8.8.8', family: 4 },
      { address: '1.1.1.1', family: 4 },
    ]);

    await expect(resolvesToPublicAddressesOnly('landing.ybbfoundation.com')).resolves.toBe(true);
  });

  it('returns false when ANY resolved address is private - no decoy public record can smuggle one through', async () => {
    (lookup as jest.Mock).mockResolvedValue([
      { address: '8.8.8.8', family: 4 },
      { address: '169.254.169.254', family: 4 },
    ]);

    await expect(resolvesToPublicAddressesOnly('rebind.attacker.example.com')).resolves.toBe(false);
  });

  it('returns false when the hostname resolves straight to a private address', async () => {
    (lookup as jest.Mock).mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);

    await expect(resolvesToPublicAddressesOnly('localhost.attacker.example.com')).resolves.toBe(false);
  });

  it('fails closed when DNS resolution throws (NXDOMAIN, timeout, etc.)', async () => {
    (lookup as jest.Mock).mockRejectedValue(new Error('ENOTFOUND'));

    await expect(resolvesToPublicAddressesOnly('does-not-exist.example.com')).resolves.toBe(false);
  });

  it('fails closed when DNS returns zero addresses', async () => {
    (lookup as jest.Mock).mockResolvedValue([]);

    await expect(resolvesToPublicAddressesOnly('no-records.example.com')).resolves.toBe(false);
  });
});
