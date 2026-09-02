import { clientIpTracker, emailTracker, UserAwareThrottlerGuard } from './user-aware-throttler.guard';

// getTracker is protected; the tests exercise it the way the guard does.
type TrackerAccess = { getTracker(req: Record<string, unknown>): Promise<string> };

describe('UserAwareThrottlerGuard', () => {
  const guard = new UserAwareThrottlerGuard(
    {} as never,
    {} as never,
    {} as never,
  ) as unknown as TrackerAccess;

  it('tracks an authenticated request by user, so people behind one NAT do not throttle each other', async () => {
    const a = await guard.getTracker({ user: { userId: 'u1' }, ip: '10.0.0.1' });
    const b = await guard.getTracker({ user: { userId: 'u2' }, ip: '10.0.0.1' });
    expect(a).toBe('user:u1');
    expect(b).toBe('user:u2');
    expect(a).not.toBe(b);
  });

  it('still tracks anonymous traffic by IP, which is what rate limiting is for', async () => {
    const a = await guard.getTracker({ ip: '10.0.0.1' });
    const b = await guard.getTracker({ ip: '10.0.0.1' });
    expect(a).toBe('ip:10.0.0.1');
    expect(a).toBe(b);
  });

  it('bills the last x-forwarded-for entry when the request did not come through Cloudflare', async () => {
    // Direct-to-origin: nothing in the chain is a Cloudflare edge, so the
    // rightmost entry — the one our own Traefik appended — is what we bill.
    const t = await guard.getTracker({
      headers: { 'x-forwarded-for': '10.0.0.1, 203.0.113.9' },
      ip: '10.0.0.1',
    });
    expect(t).toBe('ip:203.0.113.9');
  });

  it('ignores a spoofed leading entry, so a caller cannot pick its own bucket', async () => {
    // The client sent "1.2.3.4"; our edge appended what it actually saw.
    const spoofed = await guard.getTracker({
      headers: { 'x-forwarded-for': '1.2.3.4, 203.0.113.9' },
    });
    const honest = await guard.getTracker({
      headers: { 'x-forwarded-for': '203.0.113.9' },
    });
    expect(spoofed).toBe('ip:203.0.113.9');
    expect(spoofed).toBe(honest);
  });

  it('bills the real client when the last hop is a Cloudflare edge', async () => {
    // The live chain is client -> Cloudflare -> Traefik -> API, so the last
    // x-forwarded-for entry is a CF edge address and CF rotates those between
    // connections. Billing it split one client across several buckets and put
    // unrelated clients in the same one.
    const a = await guard.getTracker({
      headers: { 'x-forwarded-for': '198.51.100.7, 172.68.1.1', 'cf-connecting-ip': '198.51.100.7' },
    });
    const b = await guard.getTracker({
      // Same client, different CF edge on the next connection.
      headers: { 'x-forwarded-for': '198.51.100.7, 104.16.9.9', 'cf-connecting-ip': '198.51.100.7' },
    });
    expect(a).toBe('ip:198.51.100.7');
    expect(a).toBe(b);
  });

  it('ignores cf-connecting-ip when the request reached the origin directly', async () => {
    // The origin is reachable without going through Cloudflare, and on that
    // path cf-connecting-ip is just a header the attacker typed. Trusting it
    // unconditionally would have handed every direct caller a free bucket per
    // request, which is worse than the bug it was meant to fix.
    const spoofed = await guard.getTracker({
      headers: { 'x-forwarded-for': '203.0.113.9', 'cf-connecting-ip': '9.9.9.9' },
    });
    const alsoSpoofed = await guard.getTracker({
      headers: { 'x-forwarded-for': '203.0.113.9', 'cf-connecting-ip': '8.8.8.8' },
    });
    expect(spoofed).toBe('ip:203.0.113.9');
    expect(spoofed).toBe(alsoSpoofed);
  });

  it('falls back to the forwarded hop when a Cloudflare request has a malformed cf-connecting-ip', async () => {
    const t = await guard.getTracker({
      headers: { 'x-forwarded-for': '198.51.100.7, 172.68.1.1', 'cf-connecting-ip': 'not-an-ip' },
    });
    expect(t).toBe('ip:172.68.1.1');
  });

  it('handles IPv6 on both paths', async () => {
    // Cloudflare's IPv6 edges are recognised the same way, and an IPv6 client
    // that reaches the origin directly still keys on the appended hop.
    const viaCloudflare = await guard.getTracker({
      headers: {
        'x-forwarded-for': '2001:db8::1, 2606:4700::1111',
        'cf-connecting-ip': '2001:db8::1',
      },
    });
    const direct = await guard.getTracker({
      headers: { 'x-forwarded-for': '2001:db8::1, 2001:db8:ffff::9', 'cf-connecting-ip': '2001:db8::1' },
    });
    expect(viaCloudflare).toBe('ip:2001:db8::1');
    expect(direct).toBe('ip:2001:db8:ffff::9');
  });

  it('handles a repeated header and stray padding', async () => {
    const t = await guard.getTracker({
      headers: { 'x-forwarded-for': ['1.2.3.4', ' 203.0.113.9 , '] },
    });
    expect(t).toBe('ip:203.0.113.9');
  });

  it('ignores the request body entirely, so a caller cannot mint a bucket per request', async () => {
    // The guard runs BEFORE the validation pipe, so `body.email` is the raw,
    // unvalidated body. While the default keyed on it, any caller on any
    // anonymous POST route bought a fresh bucket by varying a JSON field —
    // the cap bounded nothing. Routes that genuinely need per-mailbox
    // budgeting opt in with emailTracker AND keep an IP ceiling.
    const a = await guard.getTracker({ body: { email: 'ada@example.com' }, ip: '10.0.0.1' });
    const b = await guard.getTracker({ body: { email: 'grace@example.com' }, ip: '10.0.0.1' });
    expect(a).toBe('ip:10.0.0.1');
    expect(a).toBe(b);
  });

  it('prefers the authenticated user over everything else', async () => {
    const t = await guard.getTracker({ user: { userId: 'u1' }, body: { email: 'ada@example.com' } });
    expect(t).toBe('user:u1');
  });

  it('never returns an empty tracker', async () => {
    expect(await guard.getTracker({})).toBe('ip:unknown');
  });

  it('ignores req.ips, which only exists when trust proxy is on and would then be caller-chosen', async () => {
    expect(await guard.getTracker({ ips: ['1.2.3.4'], ip: '10.0.0.1' })).toBe('ip:10.0.0.1');
  });
});

describe('emailTracker', () => {
  it('keys on the mailbox, normalised, so casing and padding buy no extra attempts', () => {
    expect(emailTracker({ body: { email: '  Ada@Example.COM ' } })).toBe('email:ada@example.com');
    expect(emailTracker({ body: { email: 'ada@example.com' } })).toBe('email:ada@example.com');
  });

  it('separates two mailboxes, which is the whole point on a mail-sending route', () => {
    expect(emailTracker({ body: { email: 'ada@example.com' } })).not.toBe(
      emailTracker({ body: { email: 'grace@example.com' } }),
    );
  });

  it('falls back to the client IP for anything that is not email-shaped', () => {
    // The STRICT direction: junk lands you in the shared IP bucket rather than
    // an unlimited private one. Guards run before pipes, so this really is the
    // raw body — `{ email: {} }` and friends are reachable.
    for (const email of ['   ', 42, {}, [], null, 'no-at-sign', 'a@b', undefined]) {
      expect(emailTracker({ body: { email }, ip: '10.0.0.1' })).toBe('ip:10.0.0.1');
    }
    expect(emailTracker({ ip: '10.0.0.1' })).toBe('ip:10.0.0.1');
  });

  it('resolves that IP fallback through the proxy chain, same as clientIpTracker', () => {
    const req = { body: { email: 42 }, headers: { 'x-forwarded-for': '1.2.3.4, 203.0.113.9' } };
    expect(emailTracker(req)).toBe(clientIpTracker(req));
    expect(emailTracker(req)).toBe('ip:203.0.113.9');
  });
});
