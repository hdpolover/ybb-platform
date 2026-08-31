import { UserAwareThrottlerGuard } from './user-aware-throttler.guard';

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

  it('prefers the first x-forwarded-for entry when present', async () => {
    const t = await guard.getTracker({
      headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
      ip: '10.0.0.1',
    });
    expect(t).toBe('ip:203.0.113.9');
  });

  it('never returns an empty tracker', async () => {
    expect(await guard.getTracker({})).toBe('ip:unknown');
  });
});
