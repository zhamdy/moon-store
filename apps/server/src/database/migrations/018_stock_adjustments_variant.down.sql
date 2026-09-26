-- Reverses 018. A real reversal, and lossy in one direction worth naming: dropping the
-- column discards the variant attribution on every row written since it was added. The
-- adjustments themselves survive; only which size they belonged to is lost, which is the
-- state the table was in before 018.

DROP INDEX IF EXISTS idx_stock_adjustments_variant_id;

ALTER TABLE stock_adjustments
  DROP COLUMN IF EXISTS variant_id;
