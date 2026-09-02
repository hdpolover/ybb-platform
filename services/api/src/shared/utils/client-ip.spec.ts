// src/shared/utils/client-ip.spec.ts
import { resolveClientIp } from './client-ip';

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

  it('falls back to the socket peer, then to null', () => {
    expect(resolveClientIp({ ip: '10.0.0.1' })).toBe('10.0.0.1');
    expect(resolveClientIp({})).toBeNull();
  });
});
