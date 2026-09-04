// src/modules/auth/application/services/account-lockout.util.ts
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { MAX_FAILED_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MINUTES } from './account-lockout.constants';

/**
 * The two halves of account lockout, in one place.
 *
 * They were inlined identically in login.handler and admin-login.handler and
 * MISSING ENTIRELY from ambassador-login.handler — which is the whole finding:
 * a route that authenticates on email + referral code with no password, and
 * hands back full access and refresh tokens, had no per-account guessing budget
 * at all. Three copies is how the fourth caller ends up forgetting one.
 */

/** True while the account is inside an active lockout window. */
export function isLockedOut(user: { lockedUntil?: Date | null }): boolean {
  return !!user.lockedUntil && user.lockedUntil > new Date();
}

/** Message every locked-out rejection uses, so they stay indistinguishable. */
export const LOCKED_OUT_MESSAGE = 'Too many failed attempts. Try again later.';

/**
 * Record ONE failed credential attempt against a user, and lock the account
 * when that attempt reaches the threshold.
 *
 * THE COUNTER IS INCREMENTED IN THE DATABASE, not read into JS and written
 * back. Every caller has already loaded the user for other reasons, so the
 * obvious `failedLoginAttempts: user.failedLoginAttempts + 1` reads a value
 * that N concurrent guesses all share: N attempts all write the same n+1, the
 * counter advances by one for the whole burst and lockedUntil never trips.
 * That is the entire lockout defeated by opening N connections — and on
 * /auth/ambassador-login the whole credential is a short digit code.
 *
 * The lock is stamped as a SECOND write, driven by the value the increment
 * actually returned, so it fires on whichever request genuinely crossed the
 * threshold rather than on whatever each request happened to have read. The
 * gap between the two writes lets a burst that crosses the line together
 * spend its in-flight guesses before the lock lands; the next attempt is
 * refused, and the counter is exact either way.
 *
 * A below-threshold failure deliberately does NOT write `lockedUntil: null`.
 * Clearing the lock on a failure is how a request holding a stale read
 * un-locks an account another request just locked. Locks are cleared on
 * SUCCESSFUL login (all three handlers do) and expire on their own via
 * isLockedOut.
 *
 * THE LOCK CONSUMES THE STREAK, and that is load-bearing rather than tidy.
 * The counter used to be a one-way latch: nothing reset it but a SUCCESSFUL
 * login, and isLockedOut() is evaluated BEFORE the credential is compared on
 * all three routes (login.handler.ts:231, admin-login.handler.ts:128,
 * ambassador-login.handler.ts:85), so a locked victim could never produce the
 * success that was the only reset. lockedUntil expiring left the count sitting
 * at the threshold, so the NEXT single failure re-locked immediately. One bad
 * password every 15 minutes held any known address locked forever, from any
 * IP, unauthenticated, with no self-service escape — reset-password did not
 * clear either field either (it does now).
 *
 * Zeroing here rather than on lock EXPIRY is deliberate: expiry is not an
 * event anything runs code on, and a scheduled sweep would be a second moving
 * part for a value we already have in hand at the only moment it matters.
 *
 * ponytail: flat window, and a rolling lock is still a lock. Account lockout
 * remains a denial-of-service primitive against a known address by design —
 * that is inherent to lockout, not to this change, and it is bounded and
 * self-healing now rather than permanent. Escalating backoff, or scoping the
 * lock to (account, IP), is the upgrade path if that ever matters. Sizing and
 * the cheapest arming path are recorded in the private audit backlog rather
 * than here; this repo is public.
 *
 * Residual, accepted: a below-threshold streak still has no decay, so failures
 * months apart accumulate and a user who typos twice today and three times in
 * June is locked on the third. Self-healing after 15 minutes, and cheaper to
 * live with than a second query plus a window constant whose only correct
 * value is LOCKOUT_DURATION_MINUTES.
 *
 * Returns the new attempt count.
 */
export async function recordFailedAttempt(
  prisma: PrismaService,
  userId: string,
): Promise<number> {
  const { failedLoginAttempts } = await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: { increment: 1 }, lastFailedLogin: new Date() },
    select: { failedLoginAttempts: true },
  });

  if (failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60_000),
        // Spend the streak that earned this lock. Without it the counter is a
        // latch and every post-expiry failure re-locks on its own — see the
        // docblock. Safe to reset here: the only reader of the raw count is
        // firebase-login.handler.ts's skip-the-write check, and no caller uses
        // this function's return value for anything but logging.
        failedLoginAttempts: 0,
      },
    });
  }

  return failedLoginAttempts;
}
