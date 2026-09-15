-- Indexes `collection_products` by `product_id` (#199).
--
-- The public product detail read (`listProductCollections`) filters this table by
-- `product_id` alone. Its only index is the primary key `(collection_id, product_id)`
-- from 001, whose leading column is `collection_id`, so PostgreSQL could not seek by
-- product and scanned the table on every uncached product page.
--
-- Plain `CREATE INDEX`, not `CONCURRENTLY`: the runner applies each migration inside a
-- transaction, where `CONCURRENTLY` is not allowed. The table is a small join table, so
-- the brief write lock is acceptable. Rewrites no rows, so the 014 NOT VALID CHECK caveat
-- does not apply.

CREATE INDEX IF NOT EXISTS idx_collection_products_product_id ON collection_products(product_id);
