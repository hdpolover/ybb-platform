-- Add preview_checklist_items to programs table.
-- Stores configurable checklist items shown on the preview & confirmation step.
-- Participants must check all items before submitting their application.
-- Defaults to empty array so existing programs are unaffected.

ALTER TABLE "programs" ADD COLUMN "preview_checklist_items" TEXT[] NOT NULL DEFAULT '{}';
