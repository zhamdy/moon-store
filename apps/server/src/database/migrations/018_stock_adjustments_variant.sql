-- Records which variant a stock movement belonged to (MED-13 / MED-14).
--
-- `stock_adjustments` predates variants, so every row names a product and nothing else.
-- For a variant product that makes the ledger unreconcilable against either column: a
-- variant sale and a variant stock-count both wrote {product_id: 4, previous_qty: 4, ...}
-- while `products.stock` sat at 6 the whole time, and three sizes of one product write
-- rows that look identical. The same gap made `POST /products/:id/adjust-stock` unable
-- to touch a variant at all, so shrinkage, damage and receiving corrections on a variant
-- product had no audited route.
--
-- Nullable, because a non-variant product legitimately has none and so does every row
-- written before this migration. Existing rows are deliberately **not** backfilled: which
-- variant a historic row meant is not recoverable, and guessing would manufacture false
-- audit data. Rows from here on carry it.
--
-- ON DELETE SET NULL rather than CASCADE: deleting a variant must not delete the history
-- of stock that moved through it, which is the point of an audit table.
--
-- Adds a column and an index; rewrites no rows, so the 014 NOT VALID CHECK caveat does
-- not apply.

ALTER TABLE stock_adjustments
  ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_variant_id
  ON stock_adjustments(variant_id);
