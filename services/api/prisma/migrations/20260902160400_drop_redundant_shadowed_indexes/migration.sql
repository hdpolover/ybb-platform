-- Two indexes that are fully shadowed by an existing unique index on the same
-- leading column, both with zero scans in production:
--  - participant_applications_participant_id_idx is a strict prefix of
--    participant_applications_participant_id_program_id_key.
--  - users_email_idx is a strict prefix of users_email_brand_id_key; ILIKE
--    lookups are served by idx_users_email_trgm.
-- Dropping them removes write amplification on the two hottest tables.

DROP INDEX IF EXISTS "participant_applications_participant_id_idx";
DROP INDEX IF EXISTS "users_email_idx";
