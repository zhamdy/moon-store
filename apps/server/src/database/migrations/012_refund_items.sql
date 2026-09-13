-- Gives refunded lines a table, so the cumulative refund cap is a query rather than a
-- JSON parse in a loop.
--
-- `refunds.items` is a TEXT column holding JSON and has been the only record of how much
-- of each sale line has been refunded -- there is no refund_items table, unlike
-- `exchange_returned_items`, which is a real table with real columns. Two modules ended
-- up decoding the same blob: `SalesService.executeRefund` to cap a refund against prior
-- refunds (#120), and `ExchangesRepository.findRefundedQuantitiesBySaleId` to cap an
-- exchange against them (#122). Nothing constrained the shape either parser expected.
--
-- `unit_price` is recorded per line because that is what the refund was actually valued
-- at, and rows written before #120 landed were valued from the request rather than the
-- sale. Keeping the figure the refund used means a later reconciliation can see what
-- happened rather than recompute what should have happened.
CREATE TABLE IF NOT EXISTS refund_items (
  id SERIAL PRIMARY KEY,
  refund_id INTEGER NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refund_items_refund_id ON refund_items(refund_id);
CREATE INDEX IF NOT EXISTS idx_refund_items_product ON refund_items(product_id, variant_id);

-- Backfill from the blob every existing refund carries.
--
-- Rows whose product no longer exists are skipped rather than failing the migration: the
-- FK above is RESTRICT, and a historical refund naming a deleted product is a real thing
-- to find in a database this old. The blob stays in place, so nothing is lost by skipping
-- -- and #120's guard already treats an unparseable prior refund as a reason to refuse a
-- new one rather than to count zero.
--
-- `jsonb_array_elements` needs the column cast, since it is TEXT. A row whose items are
-- not a JSON array would raise here, which is the loud failure we want: it would mean the
-- cumulative cap has been reading something it could not have understood either.
-- Wrapped in a tagged DO block so the pg-mem shim can strip it, the same way it stubs
-- 009's catalog repair block. The backfill uses CROSS JOIN LATERAL and
-- `jsonb_array_elements`, which pg-mem's parser cannot handle -- and every pg-mem suite
-- runs the whole migration set at startup. Stubbing it there costs nothing: a pg-mem
-- database is always freshly created, so it has no refunds to backfill. Real PostgreSQL
-- runs it exactly as written, and `migration012.test.ts` proves the backfill there.
DO $backfill_012$
BEGIN
  INSERT INTO refund_items (refund_id, product_id, variant_id, quantity, unit_price)
  SELECT
    r.id,
    (item->>'product_id')::int,
    NULLIF(item->>'variant_id', 'null')::int,
    (item->>'quantity')::int,
    COALESCE((item->>'unit_price')::numeric, 0)
  FROM refunds r
  CROSS JOIN LATERAL jsonb_array_elements(r.items::jsonb) AS item
  WHERE (item->>'quantity')::int > 0
    AND EXISTS (SELECT 1 FROM products p WHERE p.id = (item->>'product_id')::int)
    AND (
      item->>'variant_id' IS NULL
      OR item->>'variant_id' = 'null'
      OR EXISTS (
        SELECT 1 FROM product_variants v WHERE v.id = NULLIF(item->>'variant_id', 'null')::int
      )
    );
END
$backfill_012$;
