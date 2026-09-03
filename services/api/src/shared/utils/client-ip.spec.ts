// src/shared/utils/client-ip.spec.ts
import { isIP } from 'net';
import { ipThrottleKey, resolveClientIp } from './client-ip';

describe('resolveClientIp', () => {
  it('returns the RIGHTMOST forwarded entry, the one our own edge appended', () => {
    // Anything to the left of it is whatever the caller typed.
    expect(resolveClientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 203.0.113.9' } })).toBe(
      '203.0.113.9',
    );
  });

  it('prefers cf-connecting-ip only when the hop that reached us is a Cloudflare edge', () => {
    // Cloudflare rotates edges between connections, so the appended hop is a
    // different address each time for the same client.
    expect(
      resolveClientIp({
        headers: { 'x-forwarded-for': '198.51.100.7, 172.68.1.1', 'cf-connecting-ip': '198.51.100.7' },
      }),
    ).toBe('198.51.100.7');

    // Direct-to-origin: cf-connecting-ip is just a header the caller typed.
    expect(
      resolveClientIp({
        headers: { 'x-forwarded-for': '203.0.113.9', 'cf-connecting-ip': '9.9.9.9' },
      }),
    ).toBe('203.0.113.9');
  });

  // The shape that actually runs in production, on the nine proxied auth routes
  // of ybb-program-next: browser -> Cloudflare -> Traefik -> Next route handler
  // -> API. The route handler passes x-forwarded-for through verbatim (so the
  // chain ends at a CF edge) and forwards cf-connecting-ip alongside it.
  describe('the live proxied shape: XFF ending at a Cloudflare edge', () => {
    it('bills the client named in cf-connecting-ip', () => {
      expect(
        resolveClientIp({
          headers: {
            'x-forwarded-for': '203.0.113.9, 172.68.245.1',
            'cf-connecting-ip': '203.0.113.9',
          },
          ip: '10.0.0.5',
        }),
      ).toBe('203.0.113.9');
    });

    it('is stable across the edge rotation that made this necessary', () => {
      const client = '203.0.113.9';
      const seen = ['172.68.245.1', '104.16.9.9', '2606:4700::1111'].map((edge) =>
        resolveClientIp({
          headers: { 'x-forwarded-for': `${client}, ${edge}`, 'cf-connecting-ip': client },
        }),
      );
      expect(new Set(seen)).toEqual(new Set([client]));
    });

    it('falls back to the edge address when cf-connecting-ip is missing', () => {
      // This is what shipped before ybb-program-next 96f0f83 started forwarding
      // the header, and what still happens for any caller that omits it. It is
      // the documented fallback, not a good identity: the edge rotates, so one
      // client spreads across buckets and strangers share one.
      expect(
        resolveClientIp({
          headers: { 'x-forwarded-for': '203.0.113.9, 172.68.245.1' },
          ip: '10.0.0.5',
        }),
      ).toBe('172.68.245.1');
    });
  });

  it('never returns a value Postgres would reject for an inet column', () => {
    // This lands in UserSession.ipAddress (@db.Inet) and DataChangeLog.ipAddress
    // (@db.VarChar(45)); a bracketed, ported or oversized value raises 22P02 /
    // 22001 and 500s login. Falling back to the socket peer keeps the column
    // happy AND keeps the caller in a real bucket.
    for (const junk of ['[2001:db8::1]:443', '203.0.113.9:51234', 'x'.repeat(200), 'unknown']) {
      const resolved = resolveClientIp({ headers: { 'x-forwarded-for': `1.2.3.4, ${junk}` }, ip: '10.0.0.1' });
      expect(resolved).toBe('10.0.0.1');
    }
    // A malformed cf-connecting-ip behind a real edge falls through to the hop.
    const viaEdge = resolveClientIp({
      headers: { 'x-forwarded-for': '172.68.1.1', 'cf-connecting-ip': '203.0.113.9:443' },
    });
    expect(isIP(viaEdge!)).toBeGreaterThan(0);
  });

  it('does not skip past a malformed last entry onto a caller-written one', () => {
    // Dropping junk and taking "the rightmost that parses" would promote
    // 1.2.3.4 — a value the client wrote — into the trusted position.
    expect(
      resolveClientIp({ headers: { 'x-forwarded-for': '1.2.3.4, not-an-ip' }, ip: '10.0.0.1' }),
    ).toBe('10.0.0.1');
  });

  it('falls back to the socket peer, then to null', () => {
    expect(resolveClientIp({ ip: '10.0.0.1' })).toBe('10.0.0.1');
    expect(resolveClientIp({})).toBeNull();
    expect(resolveClientIp({ ip: 'not-an-ip' })).toBeNull();
  });
});

describe('ipThrottleKey', () => {
  it('collapses every spelling of one address onto one key', () => {
    const spellings = [
      '2001:db8::1',
      '2001:DB8::1',
      '2001:0db8:0000:0000:0000:0000:0000:0001',
      '2001:db8::0.0.0.1',
    ];
    expect(new Set(spellings.map(ipThrottleKey)).size).toBe(1);
    expect(ipThrottleKey('::ffff:198.51.100.7')).toBe(ipThrottleKey('198.51.100.7'));
    expect(ipThrottleKey('::ffff:c633:6407')).toBe('198.51.100.7');
  });

  it('keys IPv6 on the /64, so one host cannot walk its own prefix for free ceilings', () => {
    expect(ipThrottleKey('2001:db8:1:2::1')).toBe(ipThrottleKey('2001:db8:1:2:ffff:ffff:ffff:ffff'));
    expect(ipThrottleKey('2001:db8:1:2::1')).not.toBe(ipThrottleKey('2001:db8:1:3::1'));
  });

  it('leaves IPv4 alone, where one address is already one subscriber', () => {
    expect(ipThrottleKey('203.0.113.9')).toBe('203.0.113.9');
    expect(ipThrottleKey('203.0.113.9')).not.toBe(ipThrottleKey('203.0.113.10'));
  });

  it('buckets anything unusable together rather than minting a key for it', () => {
    for (const junk of [null, undefined, '', 'not-an-ip', '203.0.113.9:443']) {
      expect(ipThrottleKey(junk)).toBe('unknown');
    }
  });
});
