-- 006_collection_product_position.down.sql
-- Drops the curated order. The positions themselves are not recoverable afterwards; a
-- re-applied 006 backfills by product_id again, exactly as it does on a legacy database.
ALTER TABLE collection_products DROP CONSTRAINT IF EXISTS collection_products_position_unique;
ALTER TABLE collection_products DROP COLUMN IF EXISTS position;
