-- Migration: 014_drop_legacy_payments_table.sql
-- Description: Remove the legacy v1 payments table. The v2 schema
-- (payment_intents + payment_transactions) has been authoritative since
-- migration 005. The Go entities.Payment struct is retained as an
-- in-memory DTO for gateway responses; it is no longer persisted.

DROP TABLE IF EXISTS payments CASCADE;
