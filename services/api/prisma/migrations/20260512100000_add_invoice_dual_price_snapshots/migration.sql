-- Snapshot the USD and IDR price of the chosen pricing tier on each invoice
-- at intent creation. Frozen at the moment the participant takes action so
-- later tier price edits or rate adjustments don't retroactively alter what
-- they owed. Manual transfers settle in IDR, so `amount`/`currency` flip to
-- the IDR snapshot on confirm; gateway flows keep the USD canonical.

ALTER TABLE "application_invoices"
  ADD COLUMN "amount_usd" DECIMAL(10, 2),
  ADD COLUMN "amount_idr" DECIMAL(15, 0);
