-- One-off data correction: China Youth Summit 2026 validity-period timezone fix
--
-- Background
--   Before the WIB-pinned datetime helpers landed, the admin dashboard converted
--   datetime-local input using the admin's ambient browser timezone. These three
--   CYS registration periods were authored from a UTC context, so the admin's
--   intended WIB wall-clock (e.g. "15 Jul 23:59") was stored verbatim as UTC
--   ("2026-07-15 23:59:00+00") instead of the correct WIB instant
--   ("2026-07-15 16:59:00+00"). Rendered back in WIB that pushed deadlines 7h
--   forward, so end-of-day "15 Jul 23:59" displayed as "16 Jul 06:59".
--
--   Correction: shift these rows back by 7h so the stored instant matches the
--   intended WIB wall-clock. Only rows authored in the UTC context are touched;
--   rows already stored correctly (e.g. 08:47 UTC = 15:47 WIB) are left alone.
--
-- Scope: an explicit id allowlist (verified by inspection on 2026-06-20). The
--   cross-program scan found CYS to be the only affected program.
--
-- Safe to dry-run: BEGIN ... ROLLBACK shows the before/after without committing.
-- To apply: change ROLLBACK to COMMIT.

BEGIN;

-- Affected rows (explicit allowlist)
\set fully_funded '''e5712e97-3249-4a3d-9724-6611995959f6'''
\set self_funded  '''bd7444f0-50ea-4f55-bba5-3c9aa1d7bc2e'''
\set extention     '''9c4a3bed-e490-4b67-a2de-32c42f7ca756'''

-- BEFORE
SELECT 'BEFORE' AS phase, id,
       to_char(start_date,'YYYY-MM-DD HH24:MI"Z"') AS start_utc,
       to_char(start_date AT TIME ZONE 'Asia/Jakarta','YYYY-MM-DD HH24:MI') AS start_wib,
       to_char(end_date,'YYYY-MM-DD HH24:MI"Z"')   AS end_utc,
       to_char(end_date AT TIME ZONE 'Asia/Jakarta','YYYY-MM-DD HH24:MI')   AS end_wib
FROM pricing_tier_validity_periods
WHERE id IN (:fully_funded, :self_funded, :extention)
ORDER BY id;

UPDATE pricing_tier_validity_periods
SET start_date = start_date - interval '7 hours',
    end_date   = end_date   - interval '7 hours',
    updated_at = now()
WHERE id IN (:fully_funded, :self_funded, :extention);

-- AFTER
SELECT 'AFTER' AS phase, id,
       to_char(start_date,'YYYY-MM-DD HH24:MI"Z"') AS start_utc,
       to_char(start_date AT TIME ZONE 'Asia/Jakarta','YYYY-MM-DD HH24:MI') AS start_wib,
       to_char(end_date,'YYYY-MM-DD HH24:MI"Z"')   AS end_utc,
       to_char(end_date AT TIME ZONE 'Asia/Jakarta','YYYY-MM-DD HH24:MI')   AS end_wib
FROM pricing_tier_validity_periods
WHERE id IN (:fully_funded, :self_funded, :extention)
ORDER BY id;

-- Dry-run by default. Change to COMMIT to apply.
ROLLBACK;
