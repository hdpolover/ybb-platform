-- Migration: rename_loa_batch_window_to_payment
-- Created: 2026-09-05

-- The loa_release_batches window columns were named after submission date but
-- have matched the participant's PAYMENT date since the payment-window fix
-- (see buildLoaEligibleApplicationWhere). Renaming to match reality. Pure
-- rename: no data movement, no defaults, no drops. Postgres automatically
-- updates the existing indexes (idx_loa_release_batches_program_range) to
-- reference the renamed columns, so they need no separate ALTER.

ALTER TABLE "loa_release_batches" RENAME COLUMN "submission_from" TO "payment_from";
ALTER TABLE "loa_release_batches" RENAME COLUMN "submission_to" TO "payment_to";
