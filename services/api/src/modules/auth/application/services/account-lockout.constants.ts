// src/modules/auth/application/services/account-lockout.constants.ts

/** Consecutive bad passwords before an account is locked. */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;

/** How long an account stays locked once the threshold is hit. */
export const LOCKOUT_DURATION_MINUTES = 15;
