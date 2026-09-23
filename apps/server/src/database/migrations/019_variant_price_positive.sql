-- A variant price is either absent or a real price (LOW-1).
--
-- `product_variants.price` is the override seam: NULL means "inherit the product price",
-- which the catalog resolves as `variant.price ?? product.price` and POS as
-- `COALESCE(pv.price, p.price)`. A stored **zero** is neither, and it divides the two
-- readings — the dashboard and POS used `||`, so a 0 fell through to the product price
-- and the till charged one figure while the catalog quoted 0. The `||` is now `??` in
-- both places, but that only fixes the reading; this stops the value existing.
--
-- The Zod schema already refuses `price: 0` and negatives on create and update, so the
-- API cannot produce one. The gap this closes is everything that does not go through it:
-- an import, a backfill, a restored dump, a manual UPDATE.
--
-- Added **validated**, not NOT VALID: checked first, and `product_variants` holds no row
-- with `price <= 0` in any database this repo knows about, so there is nothing to
-- grandfather. That also keeps it clear of the 004 caveat, where an unvalidated CHECK is
-- re-checked by any later UPDATE and can abort a backfill.

ALTER TABLE product_variants
  DROP CONSTRAINT IF EXISTS product_variants_price_positive;

ALTER TABLE product_variants
  ADD CONSTRAINT product_variants_price_positive
  CHECK (price IS NULL OR price > 0);
