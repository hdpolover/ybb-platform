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

    expect(row.failedLoginAttempts).toBe(MAX_FAILED_LOGIN_ATTEMPTS);
    expect(isLockedOut(row)).toBe(true);
  });

  it('REGRESSION: N simultaneous failures advance the counter by N, not by 1', async () => {
    // The defect this replaces: every caller had already loaded the user, so
    // `user.failedLoginAttempts + 1` was computed from a value they all shared.
    // Ten concurrent guesses all wrote 1, the counter never reached the
    // threshold and lockedUntil never tripped — the whole lockout defeated by
    // opening ten connections. On /auth/ambassador-login the credential being
    // guessed is a short digit code.
    const { row, prisma } = fakeUserRow();
    const N = 10;

    await Promise.all(Array.from({ length: N }, () => recordFailedAttempt(prisma, 'user-1')));

    expect(row.failedLoginAttempts).toBe(N);
    expect(isLockedOut(row)).toBe(true);
  });
});
