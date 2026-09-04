// src/modules/auth/application/services/account-lockout.util.spec.ts
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { MAX_FAILED_LOGIN_ATTEMPTS } from './account-lockout.constants';
import { isLockedOut, recordFailedAttempt } from './account-lockout.util';

/**
 * A user row that behaves like the database does: `{ increment: 1 }` is applied
 * to whatever the row currently holds, and there is a real yield point in the
 * middle so concurrent callers interleave. A read-modify-write implementation
 * cannot pass the concurrency test against this; the old one did
 * `user.failedLoginAttempts + 1` from a value every caller had already read.
 */
const fakeUserRow = () => {
  const row = { failedLoginAttempts: 0, lockedUntil: null as Date | null };
  const update = jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
    await Promise.resolve();
    const attempts = data.failedLoginAttempts;
    if (typeof attempts === 'number') {
      row.failedLoginAttempts = attempts;
    } else if (attempts && typeof attempts === 'object') {
      row.failedLoginAttempts += (attempts as { increment: number }).increment;
    }
    if ('lockedUntil' in data) row.lockedUntil = data.lockedUntil as Date | null;
    return { failedLoginAttempts: row.failedLoginAttempts };
  });
  return { row, prisma: { user: { update } } as unknown as PrismaService, update };
};

describe('recordFailedAttempt', () => {
  it('counts one failure and does not lock below the threshold', async () => {
    const { row, prisma, update } = fakeUserRow();

    await expect(recordFailedAttempt(prisma, 'user-1')).resolves.toBe(1);

    expect(row.failedLoginAttempts).toBe(1);
    expect(row.lockedUntil).toBeNull();
    // One write, and it carries no lockedUntil at all: writing `null` here is
    // how a request holding a stale read clears a lock another request set.
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].data).not.toHaveProperty('lockedUntil');
  });

  it('locks on the attempt that REACHES the threshold, not one later', async () => {
    const { row, prisma } = fakeUserRow();

    for (let i = 1; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
      await recordFailedAttempt(prisma, 'user-1');
      expect(row.lockedUntil).toBeNull();
    }
    await recordFailedAttempt(prisma, 'user-1');

    expect(isLockedOut(row)).toBe(true);
    // ...and the lock CONSUMES the streak that earned it. See the latch
    // regression below for why that matters.
    expect(row.failedLoginAttempts).toBe(0);
  });

  it('REGRESSION: an expired lock does not leave the account one failure from re-locking', async () => {
    // THE DEFECT: failedLoginAttempts only ever incremented. The single reset
    // was a SUCCESSFUL login, and isLockedOut() is evaluated BEFORE the
    // credential is compared on all three login routes, so a locked victim
    // could never produce that success. When lockedUntil expired the count was
    // still at the threshold, so the very next failure re-locked at once.
    // One bad password every 15 minutes held any known address locked forever,
    // unauthenticated, from any IP, with no self-service escape.
    //
    // Against the OLD code this test fails on the final assertion: the count
    // would still read MAX_FAILED_LOGIN_ATTEMPTS, so one more failure takes it
    // to MAX+1 and re-locks.
    const { row, prisma } = fakeUserRow();

    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
      await recordFailedAttempt(prisma, 'user-1');
    }
    expect(isLockedOut(row)).toBe(true);

    // The lock runs out on its own.
    row.lockedUntil = new Date(Date.now() - 1000);
    expect(isLockedOut(row)).toBe(false);

    // One more bad password must cost ONE attempt, not re-arm the whole lock.
    await recordFailedAttempt(prisma, 'user-1');

    expect(row.failedLoginAttempts).toBe(1);
    expect(isLockedOut(row)).toBe(false);
  });

  it('REGRESSION: N simultaneous failures advance the counter by N, not by 1', async () => {
    // The defect this replaces: every caller had already loaded the user, so
    // `user.failedLoginAttempts + 1` was computed from a value they all shared.
    // Ten concurrent guesses all wrote 1, the counter never reached the
    // threshold and lockedUntil never tripped — the whole lockout defeated by
    // opening ten connections. On /auth/ambassador-login the credential being
    // guessed is a short digit code.
    const { row, prisma, update } = fakeUserRow();
    const N = 10;

    await Promise.all(Array.from({ length: N }, () => recordFailedAttempt(prisma, 'user-1')));

    // The lock tripping IS the assertion. Under the read-modify-write defect
    // all N callers wrote the same n+1, the counter never reached the
    // threshold and lockedUntil stayed null — so a locked account here proves
    // the increments were not lost. The final COUNT is deliberately not
    // asserted: crossing the threshold now zeroes the streak, so its value
    // depends on how the burst interleaves around that write, and pinning it
    // would test the fake's scheduling rather than the behaviour.
    expect(isLockedOut(row)).toBe(true);
    const increments = update.mock.calls.filter(
      (c) => typeof c[0].data.failedLoginAttempts === 'object',
    );
    expect(increments).toHaveLength(N);
  });
});
