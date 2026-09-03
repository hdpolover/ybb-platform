// src/shared/infrastructure/throttler/user-aware-throttler.guard.spec.ts
import { JwtService } from '@nestjs/jwt';
import { clientIpTracker, emailTracker, UserAwareThrottlerGuard } from './user-aware-throttler.guard';

// getTracker is protected; the tests exercise it the way the guard does.
type TrackerAccess = { getTracker(req: Record<string, unknown>): Promise<string> };

// Real signing and real verification. Mocking the JwtService here would mock
// out the only thing that makes per-user keying safe.
const SECRET = 'throttler-test-secret';
const jwtService = new JwtService({ secret: SECRET });
const bearer = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });
const accessTokenFor = (sub: string, options: Record<string, unknown> = {}) =>
  jwtService.sign({ sub, type: 'access' }, { expiresIn: '1h', ...options });

describe('UserAwareThrottlerGuard', () => {
  const guard = new UserAwareThrottlerGuard(
    {} as never,
    {} as never,
    {} as never,
    jwtService,
  ) as unknown as TrackerAccess;

  it('tracks by IP, which is what rate limiting is for', async () => {
    const a = await guard.getTracker({ ip: '10.0.0.1' });
    const b = await guard.getTracker({ ip: '10.0.0.1' });
    expect(a).toBe('ip:10.0.0.1');
    expect(a).toBe(b);
  });

  it('ignores req.user, because it is always undefined here', async () => {
    // This guard is the app's only APP_GUARD and JwtAuthGuard is route-scoped;
    // Nest runs global guards BEFORE controller guards, so authentication has
    // not run yet at this point. A `user:` branch reading req.user (commit
    // e233af76) was unreachable; identity has to come from the token itself,
    // and a request that merely CLAIMS one in a property must not get a bucket.
    const authed = await guard.getTracker({ user: { userId: 'u1' }, ip: '10.0.0.1' });
    expect(authed).toBe('ip:10.0.0.1');
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

  it('does not let a malformed cf-connecting-ip become an unbilled request', async () => {
    // A Cloudflare-fronted request whose cf-connecting-ip we cannot parse still
    // has to land in SOME bucket, and the only value left is the edge hop. This
    // asserts the fallback fires, NOT that a CF edge is a sensible identity for
    // a client — it is not, which is exactly why the header is forwarded now
    // (ybb-program-next 96f0f83). Junk here must not buy a free pass.
    const junk = await guard.getTracker({
      headers: { 'x-forwarded-for': '198.51.100.7, 172.68.1.1', 'cf-connecting-ip': 'not-an-ip' },
    });
    const alsoJunk = await guard.getTracker({
      headers: { 'x-forwarded-for': '198.51.100.7, 172.68.1.1', 'cf-connecting-ip': '[::1]:80' },
    });
    expect(junk).toBe('ip:172.68.1.1');
    expect(junk).toBe(alsoJunk);
    expect(junk).not.toBe('ip:unknown');
  });

  it('handles IPv6 on both paths, keyed on the /64', async () => {
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
    expect(viaCloudflare).toBe('ip:2001:db8:0:0::/64');
    expect(direct).toBe('ip:2001:db8:ffff:0::/64');
  });

  it('gives one IPv6 host ONE bucket, not a routed /64 worth of them', async () => {
    // Every VPS ships a /64 and residential ISPs a /56, so keying the full /128
    // handed an attacker an unlimited supply of fresh ceilings.
    const first = await guard.getTracker({ headers: { 'cf-connecting-ip': '2001:db8:1:2::1' }, ip: '2001:db8:1:2::1' });
    const walked = await guard.getTracker({ ip: '2001:db8:1:2:ffff:ffff:ffff:ffff' });
    expect(first).toBe(walked);
  });

  it('gives one address ONE bucket however it is spelled', async () => {
    const keys = new Set(
      [
        '2001:db8::1',
        '2001:DB8::1',
        '2001:0db8:0000:0000:0000:0000:0000:0001',
        '2001:db8::0.0.0.1',
      ].map((ip) => clientIpTracker({ ip })),
    );
    expect(keys.size).toBe(1);

    // An IPv4-mapped v6 address is the same host as its IPv4 form.
    expect(clientIpTracker({ ip: '::ffff:198.51.100.7' })).toBe(clientIpTracker({ ip: '198.51.100.7' }));
    expect(clientIpTracker({ ip: '::ffff:c633:6407' })).toBe('ip:198.51.100.7');
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

  it('never returns an empty tracker', async () => {
    expect(await guard.getTracker({})).toBe('ip:unknown');
  });

  it('ignores req.ips, which only exists when trust proxy is on and would then be caller-chosen', async () => {
    expect(await guard.getTracker({ ips: ['1.2.3.4'], ip: '10.0.0.1' })).toBe('ip:10.0.0.1');
  });
});

describe('per-user throttle keying', () => {
  const guard = new UserAwareThrottlerGuard(
    {} as never,
    {} as never,
    {} as never,
    jwtService,
  ) as unknown as TrackerAccess;

  const IP = '203.0.113.9';
  const ipKey = clientIpTracker({ ip: IP });

  it('bills a valid access token to its subject', async () => {
    const key = await guard.getTracker({ ...bearer(accessTokenFor('user-1')), ip: IP });
    expect(key).toBe('user:user-1');
  });

  it('REGRESSION 2026-08-31: two users behind one NAT get two buckets', async () => {
    // A school lab, a university and an Indonesian carrier's CGNAT all present
    // as one address. Keying signed-in traffic on the IP meant the Nth
    // participant through the door inherited an exhausted bucket and got a
    // ThrottlerException for doing nothing wrong. This is the whole point of
    // the feature; if it ever regresses, this is the test that says so.
    const ada = await guard.getTracker({ ...bearer(accessTokenFor('ada')), ip: IP });
    const grace = await guard.getTracker({ ...bearer(accessTokenFor('grace')), ip: IP });
    expect(ada).not.toBe(grace);
    expect(ada).toBe('user:ada');
    expect(grace).toBe('user:grace');
  });

  it('separates an authenticated request from an anonymous one on the same IP', async () => {
    const authed = await guard.getTracker({ ...bearer(accessTokenFor('ada')), ip: IP });
    const anonymous = await guard.getTracker({ ip: IP });
    expect(authed).not.toBe(anonymous);
    expect(anonymous).toBe(ipKey);
  });

  it('FORGERY: a token signed with the wrong secret gets no bucket of its own', async () => {
    // The single most important assertion in this file. If the implementation
    // ever decodes instead of verifying — jwt.decode(), or splitting on '.' —
    // any caller writes their own `sub` and mints unlimited fresh ceilings,
    // which is strictly worse than the shared IP bucket it replaced.
    const forged = new JwtService({ secret: 'not-the-app-secret' }).sign(
      { sub: 'victim', type: 'access' },
      { expiresIn: '1h' },
    );
    expect(await guard.getTracker({ ...bearer(forged), ip: IP })).toBe(ipKey);

    // Nor does hand-assembled unsigned garbage of the right SHAPE.
    const unsigned = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${Buffer.from(
      JSON.stringify({ sub: 'victim', type: 'access' }),
    ).toString('base64url')}.`;
    expect(await guard.getTracker({ ...bearer(unsigned), ip: IP })).toBe(ipKey);
  });

  it('falls back to IP for an expired token', async () => {
    const expired = accessTokenFor('ada', { expiresIn: '-1s' });
    expect(await guard.getTracker({ ...bearer(expired), ip: IP })).toBe(ipKey);
  });

  it('falls back to IP for a refresh token, which is signed with the same secret', async () => {
    // Valid signature, wrong half of the pair. jwt.strategy.ts already refuses
    // it as a bearer; it must not buy a bucket here either.
    const refresh = jwtService.sign({ sub: 'ada', type: 'refresh' }, { expiresIn: '7d' });
    expect(await guard.getTracker({ ...bearer(refresh), ip: IP })).toBe(ipKey);
  });

  it('falls back to IP for an untyped legacy token', async () => {
    // Pre-`type`-claim tokens cannot be classified, so they stay on the status
    // quo and expire on their own. Never a bucket on a guess.
    const untyped = jwtService.sign({ sub: 'ada' }, { expiresIn: '1h' });
    expect(await guard.getTracker({ ...bearer(untyped), ip: IP })).toBe(ipKey);
  });

  it('falls back to IP for a valid token with no usable subject', async () => {
    for (const payload of [{ type: 'access' }, { sub: '', type: 'access' }, { sub: 42, type: 'access' }]) {
      const token = jwtService.sign(payload as object, { expiresIn: '1h' });
      expect(await guard.getTracker({ ...bearer(token), ip: IP })).toBe(ipKey);
    }
  });

  it('falls back to IP for an absent, malformed or non-Bearer header', async () => {
    const token = accessTokenFor('ada');
    const headers = [
      undefined,
      '',
      '   ',
      token, // no scheme
      `Basic ${token}`,
      `Bearer${token}`, // no separator
      'Bearer',
      'Bearer ',
      `Bearer ${token} extra`,
      'Bearer not.a.jwt',
      ['Bearer nonsense'] as unknown as string,
      42 as unknown as string,
    ];
    for (const authorization of headers) {
      expect(await guard.getTracker({ headers: { authorization }, ip: IP })).toBe(ipKey);
    }
  });

  it('accepts the scheme case-insensitively, the way HTTP does', async () => {
    const token = accessTokenFor('ada');
    expect(await guard.getTracker({ headers: { authorization: `bearer ${token}` }, ip: IP })).toBe(
      'user:ada',
    );
  });

  it('never throws, whatever the request looks like', async () => {
    // A rate limiter that 500s a request is a worse outage than the one it
    // prevents, so every path here has to end in a key.
    await expect(guard.getTracker({})).resolves.toBe('ip:unknown');
    await expect(guard.getTracker({ headers: null as never })).resolves.toBe('ip:unknown');
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

  it('strips a +tag, because those all land in one inbox', () => {
    // Otherwise victim+1@ … victim+60@ is 60 buckets delivering 60 mails an
    // hour to one person, on a tier that allows 10.
    expect(emailTracker({ body: { email: 'victim+1@gmail.com' } })).toBe('email:victim@gmail.com');
    expect(emailTracker({ body: { email: 'victim+1@gmail.com' } })).toBe(
      emailTracker({ body: { email: 'victim+anything+else@gmail.com' } }),
    );
    // A '+' in the DOMAIN is not a tag and must not truncate the address.
    expect(emailTracker({ body: { email: 'ada@ex+ample.com' } })).toBe('email:ada@ex+ample.com');
  });

  it('strips dots on gmail only, because gmail ignores them and other domains do not', () => {
    // ~64 spellings of one 8-char local part, all delivering to one inbox, on a
    // tier that allows 10 mails an hour.
    expect(emailTracker({ body: { email: 'v.i.ctim@gmail.com' } })).toBe('email:victim@gmail.com');
    expect(emailTracker({ body: { email: 'v.ictim+2@googlemail.com' } })).toBe(
      'email:victim@gmail.com',
    );
    // Everywhere else a dot is part of the address and two people keep two budgets.
    expect(emailTracker({ body: { email: 'a.b@example.com' } })).not.toBe(
      emailTracker({ body: { email: 'ab@example.com' } }),
    );
  });

  it('gives an unresolved email its OWN key, never the shared IP bucket', () => {
    // Falling back to the IP meant five typo'd logins from one office or
    // carrier NAT ('ada@gmail,com', 'admin@ybbhub', a blank field) burned the
    // 5-per-15-min mailbox tier for EVERY user on that address. Self-inflicted
    // by accident, griefable on purpose. Junk is still bounded: the global
    // short/medium tiers key on IP for every route, and every route pinning
    // emailTracker also pins a clientIpTracker tier that must pass.
    const ip = '10.0.0.1';
    const keys = ['   ', 42, {}, [], null, 'no-at-sign', 'a@b', undefined].map((email) =>
      emailTracker({ body: { email }, ip }),
    );
    for (const key of keys) {
      expect(key).toMatch(/^email:unresolved:/);
      expect(key).not.toBe(clientIpTracker({ ip }));
    }
    // Distinct per request, so one junk sender cannot evict another.
    expect(new Set(keys).size).toBe(keys.length);
    expect(emailTracker({ ip })).not.toBe(emailTracker({ ip }));
  });
});
