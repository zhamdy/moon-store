-- 004_concurrency_and_idempotency.down.sql
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_stock_non_negative;
ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS product_variants_stock_non_negative;
ALTER TABLE gift_cards DROP CONSTRAINT IF EXISTS gift_cards_balance_non_negative;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_loyalty_points_non_negative;

DROP TABLE IF EXISTS idempotency_keys;
