-- Repair existing LOA release batches whose submission_to was stored as the
-- START of the day (midnight UTC) instead of the END of the day. This
-- excluded any participant who submitted later that same UTC day from
-- eligibility (e.g. a batch meant to cover "12 Jul" only matched submissions
-- at exactly 2026-07-12T00:00:00Z). Application-side normalization now
-- writes day-inclusive windows going forward; this backfills prior rows.
UPDATE loa_release_batches
SET submission_from = date_trunc('day', submission_from),
    submission_to   = date_trunc('day', submission_to) + interval '1 day' - interval '1 millisecond'
WHERE deleted_at IS NULL;
