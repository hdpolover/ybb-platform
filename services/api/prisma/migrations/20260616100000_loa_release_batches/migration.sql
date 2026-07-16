-- Migration: loa_release_batches
-- Created: 2026-06-16

CREATE TABLE IF NOT EXISTS loa_release_batches (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id      UUID        NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  submission_from TIMESTAMPTZ(6) NOT NULL,
  submission_to   TIMESTAMPTZ(6) NOT NULL,
  released_at     TIMESTAMPTZ(6) NULL,
  created_by      UUID        NOT NULL,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ(6) NULL
);

CREATE INDEX IF NOT EXISTS idx_loa_release_batches_program_id
  ON loa_release_batches(program_id);

CREATE INDEX IF NOT EXISTS idx_loa_release_batches_program_range
  ON loa_release_batches(program_id, submission_from, submission_to)
  WHERE deleted_at IS NULL;
