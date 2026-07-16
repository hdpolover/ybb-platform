-- Migration: add_signatures
-- Created: 2026-07-12

CREATE TABLE IF NOT EXISTS signatures (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id   UUID         NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  title      VARCHAR(255) NULL,
  image_url  TEXT         NOT NULL,
  is_active  BOOLEAN      NOT NULL DEFAULT true,
  sort_order INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ(6) NULL
);

CREATE INDEX IF NOT EXISTS idx_signatures_brand_id
  ON signatures(brand_id);
