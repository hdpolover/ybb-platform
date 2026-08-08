-- Migration: 021_payment_method_unique_ignores_soft_deleted.sql
-- Description: Make the payment_methods name/code uniqueness respect soft
--              deletes. 006_fix_gorm_mismatch.sql added plain
--              UNIQUE (name) / UNIQUE (code) constraints, but
--              016_add_soft_delete_to_payment_methods.sql later gave the
--              table a deleted_at column. A deleted method therefore keeps
--              squatting on its name forever: "Delete for all programs" then
--              re-create the same method is impossible, and the failure
--              surfaced as an opaque 500 with no way to diagnose it from the
--              admin dashboard.
--
--              Replaces both constraints with partial unique indexes scoped
--              to live rows. Live-row uniqueness is unchanged, so this only
--              widens what is allowed and cannot break existing data.
--
--              Safe to apply as-is: prod currently has no two live rows
--              sharing a name or code. The trailing-space pair
--              ("Credit / Debit Card (Mastercard / Visa / JCB)" with and
--              without a trailing space) are distinct strings and both
--              survive the index build. They are deliberately NOT normalised
--              here — collapsing them would silently merge two rows an admin
--              created on purpose. The handler now trims on write, so no new
--              whitespace twins can appear; cleaning up the existing pair is
--              a data decision, not a schema one.

ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS uni_payment_methods_name;
ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS payment_methods_code_key;

-- Older environments may carry these as bare indexes rather than constraints.
DROP INDEX IF EXISTS uni_payment_methods_name;
DROP INDEX IF EXISTS payment_methods_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_methods_name_live
    ON payment_methods (name)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_methods_code_live
    ON payment_methods (code)
    WHERE deleted_at IS NULL;
