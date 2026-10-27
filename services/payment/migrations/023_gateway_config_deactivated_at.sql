-- Migration: 023_gateway_config_deactivated_at.sql
-- Description: Record when a gateway config was deactivated. Scoped webhooks keep
-- verifying against a rotated-out config for a short grace window (so in-flight
-- payments still settle) and are refused afterwards, so a revoked callback token
-- stops being trusted. updated_at cannot serve: any edit bumps it.
-- Rows already inactive stay NULL, which the webhook path treats as past grace.

ALTER TABLE payment_gateway_configs ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
