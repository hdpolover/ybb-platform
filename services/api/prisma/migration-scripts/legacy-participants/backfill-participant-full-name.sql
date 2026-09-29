-- services/api/prisma/migration-scripts/legacy-participants/backfill-participant-full-name.sql
--
-- Fills ONLY blank participants.full_name ('' or NULL) from the most recent
-- application's non-empty personal_data->>'full_name', so the existing
-- idx_participants_full_name_trgm serves admin name search. Column stays NOT NULL;
-- participants with no name anywhere are left as ''.
--
-- Idempotent: only touches rows still blank; a rerun updates 0 rows.
-- Reversible: pre-image kept in participants_full_name_backfill_bak (restore with
-- UPDATE participants p SET full_name = coalesce(b.old_full_name, '') FROM
-- participants_full_name_backfill_bak b WHERE p.id = b.id).
-- Size: ~66 rows on prod at time of writing, so a single statement (no batching)
-- holds row locks for milliseconds. If the count ever grows past ~50k, add a LIMIT
-- to the CTE and loop until UPDATE 0.
--
-- Usage: psql -v ON_ERROR_STOP=1 -f backfill-participant-full-name.sql
-- Review the "would change" count, then the script commits (or ROLLBACK by editing the last line).

\set ON_ERROR_STOP on
SET statement_timeout = '120s';

BEGIN;

CREATE TABLE IF NOT EXISTS participants_full_name_backfill_bak (
  id            uuid PRIMARY KEY,
  old_full_name varchar(255),
  new_full_name varchar(255) NOT NULL,
  backed_up_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TEMP TABLE _fn_candidates ON COMMIT DROP AS
SELECT DISTINCT ON (p.id)
       p.id,
       p.full_name AS old_full_name,
       left(btrim(a.personal_data->>'full_name'), 255) AS new_full_name
FROM participants p
JOIN participant_applications a ON a.participant_id = p.id
WHERE (p.full_name IS NULL OR btrim(p.full_name) = '')
  AND btrim(coalesce(a.personal_data->>'full_name', '')) <> ''
ORDER BY p.id, a.created_at DESC, a.id DESC;

SELECT count(*) AS would_change FROM _fn_candidates;

INSERT INTO participants_full_name_backfill_bak (id, old_full_name, new_full_name)
SELECT id, old_full_name, new_full_name FROM _fn_candidates
ON CONFLICT (id) DO NOTHING;

UPDATE participants p
SET full_name = c.new_full_name,
    updated_at = now()
FROM _fn_candidates c
WHERE p.id = c.id
  AND (p.full_name IS NULL OR btrim(p.full_name) = '');

COMMIT;
