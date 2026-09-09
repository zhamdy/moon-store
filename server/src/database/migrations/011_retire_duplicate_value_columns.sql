-- Drops two columns that held a value nothing read.
--
-- Both arrived with 009's legacy alignment, which added the new column beside the old one
-- rather than replacing it, leaving each table with two columns for one value -- written
-- through one and read through the other:
--
--   purchase_orders.total  (written by create)  /  .total_amount  (was read by the list)
--   product_bundles.bundle_price (written)      /  .price         (was read by the list)
--
-- So each read side returned a column no writer sets: the purchase-order list rendered
-- `NaN EG` (#129) and every bundle listed at 0 (#124). Those PRs corrected the projections
-- to select the written column and deliberately left the dead ones in place, because
-- dropping a column is a schema change whose rollback cannot bring the data back and
-- belongs on its own (#139).
--
-- Nothing reads either column as of this migration: the only remaining mentions in the
-- codebase are the comments in those two repositories explaining which column to use.
-- Note that `total_amount` is a real, live column on `expenses` and `layaway_plans`; only
-- the `purchase_orders` one is dead.
ALTER TABLE purchase_orders DROP COLUMN IF EXISTS total_amount;

ALTER TABLE product_bundles DROP COLUMN IF EXISTS price;
