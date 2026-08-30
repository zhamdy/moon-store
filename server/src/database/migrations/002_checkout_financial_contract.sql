-- 002_checkout_financial_contract.sql
-- Canonicalize loyalty settings to the direct units used by the checkout
-- financial contract (see
-- docs/plans/2026-08-30-001-fix-pos-checkout-total-parity-plan.md and
-- server/src/modules/core/settings/types.ts):
--   - loyalty_enabled          (unchanged key name; no legacy alias)
--   - loyalty_points_per_egp   points earned per 1 EGP of confirmed sale total
--   - loyalty_egp_per_point    EGP value redeemed per 1 point spent
--
-- `settings` is a plain key/value table, so this is a data migration, not a
-- schema change. Rules, applied in order:
--   1. Never overwrite a canonical key that already exists, under any
--      circumstance -- this migration only ever INSERTs a canonical key that
--      is entirely absent, never UPDATEs one.
--   2. If a canonical key is absent but its same-unit legacy alias
--      (loyalty_earn_rate / loyalty_redeem_value) is present, adopt the
--      alias's configured value verbatim -- no reciprocal/unit conversion is
--      needed because the alias already used the same direct units.
--   3. If neither the canonical key nor its alias is present, insert the
--      documented safe default (see LOYALTY_SETTINGS_DEFAULTS).
-- Numeric/range validation (zero, negative, non-numeric) of whatever value
-- lands in a canonical key is the responsibility of the typed settings
-- boundary (parseLoyaltySettings) at read time, not this migration.

-- loyalty_enabled has no legacy alias; only ensure it exists with a safe
-- default (disabled) so absence can never be silently read as "on".
INSERT INTO settings (key, value)
SELECT 'loyalty_enabled', 'false'
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'loyalty_enabled');

-- loyalty_points_per_egp <- loyalty_earn_rate (both: points earned per EGP).
INSERT INTO settings (key, value)
SELECT 'loyalty_points_per_egp', legacy.value
FROM settings legacy
WHERE legacy.key = 'loyalty_earn_rate'
  AND NOT EXISTS (SELECT 1 FROM settings WHERE key = 'loyalty_points_per_egp');

INSERT INTO settings (key, value)
SELECT 'loyalty_points_per_egp', '1'
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'loyalty_points_per_egp');

-- loyalty_egp_per_point <- loyalty_redeem_value (both: EGP redeemed per point).
INSERT INTO settings (key, value)
SELECT 'loyalty_egp_per_point', legacy.value
FROM settings legacy
WHERE legacy.key = 'loyalty_redeem_value'
  AND NOT EXISTS (SELECT 1 FROM settings WHERE key = 'loyalty_egp_per_point');

INSERT INTO settings (key, value)
SELECT 'loyalty_egp_per_point', '0.1'
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'loyalty_egp_per_point');
