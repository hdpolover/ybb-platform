-- Claim marker for the post-payment submission-nudge cron
-- (PostPaymentFollowupService): stamped the moment the one-shot H+3 email is
-- sent, so an hourly tick can never re-nudge the same application twice.
ALTER TABLE "participant_applications"
  ADD COLUMN IF NOT EXISTS "post_payment_followup_sent_at" TIMESTAMPTZ(6);
