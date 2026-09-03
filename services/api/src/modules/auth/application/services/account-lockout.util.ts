// src/modules/auth/application/services/account-lockout.util.ts
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
 * The `data` for the user row after ONE failed credential attempt.
 *
 * The lock is stamped on the attempt that REACHES the threshold, so the caller
 * gets MAX_FAILED_LOGIN_ATTEMPTS tries and the next request is refused before
 * the credential is even compared.
 */
export function failedAttemptUpdate(user: { failedLoginAttempts: number }) {
  const failedLoginAttempts = user.failedLoginAttempts + 1;
  return {
    failedLoginAttempts,
    lastFailedLogin: new Date(),
    lockedUntil:
      failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60_000)
        : null,
  };
}
