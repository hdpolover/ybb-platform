-- Audit 2026-09-02 backlog: M115/M105 — applications export keyset
-- pagination orders by (submitted_at DESC, id ASC) with no supporting
-- index; every export batch previously re-sorted on an unindexed
-- column via OFFSET. This index backs the new keyset scan directly.
CREATE INDEX IF NOT EXISTS "participant_applications_submitted_at_id_idx"
ON "participant_applications" ("submission_date" DESC, "id" ASC);
