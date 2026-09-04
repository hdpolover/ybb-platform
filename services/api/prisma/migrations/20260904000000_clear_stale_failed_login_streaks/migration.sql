-- Clear failure streaks left behind by the old one-way lockout counter.
--
-- `failed_login_attempts` only ever incremented. Nothing reset it but a
-- SUCCESSFUL login, and `isLockedOut()` is evaluated BEFORE the credential is
-- compared on every login route, so a locked user could never produce the
-- success that was the only reset. When `locked_until` expired the count was
-- still sitting at the threshold, so the next single failure re-locked
-- immediately: one bad password every 15 minutes held any known address locked
-- forever, unauthenticated, from any IP.
--
-- The code fix (account-lockout.util.ts: the lock now consumes the streak) is
-- prospective only. At the time of writing 30 production accounts were at or
-- over the threshold with an expired lock -- each one bad password away from a
-- lock it could not escape -- and 115 carried a stale streak. This clears them.
--
-- Deliberately scoped to accounts that are NOT currently locked. A live lock is
-- a control doing its job and this must not lift it; the new code will consume
-- that streak when the lock is stamped.
UPDATE users
SET failed_login_attempts = 0
WHERE failed_login_attempts > 0
  AND (locked_until IS NULL OR locked_until <= now());
