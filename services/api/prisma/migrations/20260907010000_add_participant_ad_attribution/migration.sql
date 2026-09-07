-- Ad click identifiers (fbp/fbc/ttp/ttclid + capturedAt) captured at signup so
-- server-side conversion events (Purchase/ProgramFeePaid/ApplicationCreated)
-- can be replayed with the click id that actually drove the signup — see
-- MetaCapiService.emitServerEvent.
ALTER TABLE "participants"
  ADD COLUMN IF NOT EXISTS "ad_attribution" JSON;
