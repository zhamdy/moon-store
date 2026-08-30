-- 003_sale_calculation_snapshot.sql
-- Unit 2 of the checkout total-parity fix (see
-- docs/plans/2026-08-30-001-fix-pos-checkout-total-parity-plan.md, "Unit 2").
--
-- Persist an IMMUTABLE snapshot of the authoritative server calculation used
-- to create a sale, linked 1:1 to `sales`. Existing `sales` columns
-- (discount, tax_amount, tip_amount, coupon_id, coupon_discount,
-- points_redeemed, total) already cover part of the breakdown but are not a
-- contract-versioned, complete record (no points_discount amount, no
-- tax mode/rate, no earned points, no contract version) and are not
-- guaranteed immutable against future column reuse. A dedicated table lets
-- historical receipts and reads reproduce the exact confirmed breakdown even
-- if settings or formulas change later.
--
-- All monetary columns here are EGP (major units, NUMERIC), matching every
-- other monetary column in this schema; conversion to/from integer minor
-- units happens only inside the calculation boundary
-- (see server/src/modules/pos/sales/service.ts).

CREATE TABLE IF NOT EXISTS sale_calculations (
  sale_id INTEGER PRIMARY KEY REFERENCES sales(id) ON DELETE CASCADE,
  contract_version TEXT NOT NULL,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  manual_discount NUMERIC NOT NULL DEFAULT 0,
  coupon_id INTEGER REFERENCES coupons(id) ON DELETE SET NULL,
  coupon_discount NUMERIC NOT NULL DEFAULT 0,
  points_redeemed INTEGER NOT NULL DEFAULT 0,
  points_discount NUMERIC NOT NULL DEFAULT 0,
  taxable_base NUMERIC NOT NULL DEFAULT 0,
  tax_mode TEXT NOT NULL DEFAULT 'exclusive',
  tax_rate_percent NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  tip_amount NUMERIC NOT NULL DEFAULT 0,
  amount_due NUMERIC NOT NULL DEFAULT 0,
  earned_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
