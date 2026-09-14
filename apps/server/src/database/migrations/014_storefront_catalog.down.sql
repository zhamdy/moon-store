-- Reverses 014. A real reversal, not a no-op.
--
-- This one IS lossy, like 013: nothing derives these values from anywhere else once
-- admins have edited them. A rollback discards authored slugs (a re-applied 014
-- backfills fresh ones from SKUs/codes, so published URLs change), every English name
-- and description, and every gallery row in `product_images`. The gallery's image
-- objects stay in storage and become orphans for the media sweep. Take a dump of
-- `product_images` and the slug/name_en/description_en columns before running it in
-- production.
DROP INDEX IF EXISTS idx_product_variants_in_stock;
DROP INDEX IF EXISTS idx_products_category_status;
DROP INDEX IF EXISTS idx_products_status_price;
DROP INDEX IF EXISTS idx_products_status_created;

DROP TABLE IF EXISTS product_images;

DROP INDEX IF EXISTS idx_collections_slug;
DROP INDEX IF EXISTS idx_categories_slug;
DROP INDEX IF EXISTS idx_products_slug;

ALTER TABLE collections DROP COLUMN IF EXISTS description_en;
ALTER TABLE collections DROP COLUMN IF EXISTS name_en;
ALTER TABLE collections DROP COLUMN IF EXISTS slug;

ALTER TABLE categories DROP COLUMN IF EXISTS description_en;
ALTER TABLE categories DROP COLUMN IF EXISTS name_en;
ALTER TABLE categories DROP COLUMN IF EXISTS slug;

ALTER TABLE products DROP COLUMN IF EXISTS name_en;
ALTER TABLE products DROP COLUMN IF EXISTS slug;
