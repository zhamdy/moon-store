-- Gives the catalog what a public storefront needs to address and present it.
--
-- Three things, all additive (plan 2026-09-14-002, Unit 1):
--
-- 1. `slug` on products, categories and collections (KD-6). Nullable with a UNIQUE index
--    rather than NOT NULL: the legacy product create and CSV import, the seed and dozens
--    of raw test-fixture inserts write rows without one, and a collection's id-based
--    fallback is not known until its row exists. The public catalog only returns rows
--    whose slug IS NOT NULL. The slug pattern (`^[a-z0-9]+(?:-[a-z0-9]+)*$`, 1-80
--    characters) lives in the Zod request schemas, not a CHECK: pg-mem has no regex
--    support, and every pg-mem suite runs this file.
-- 2. `name_en` on all three and `description_en` on categories and collections (KD-7).
--    `name` stays the primary (Arabic) field; two locales do not justify a translations
--    table.
-- 3. `product_images` (KD-8): additional gallery images. `products.image_url` stays the
--    primary image, because POS, lookup and the dashboard already read it.
--
-- Plus the listing indexes the public catalog queries lean on (KD-17).

ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS name_en TEXT;

ALTER TABLE categories ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS description_en TEXT;

ALTER TABLE collections ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS description_en TEXT;

-- Backfill every existing row's slug, before the UNIQUE indexes exist.
--
-- Products and categories slugify `sku` / `code`: lowercase, every run of non-[a-z0-9]
-- becomes one hyphen, hyphens trimmed from both ends, cut to 70 characters and trimmed
-- again (the cut can land on a hyphen). Then:
--   * an empty result (an Arabic-only or punctuation-only code) becomes `product-<id>` /
--     `category-<id>`;
--   * a result shared by more than one row (`ABC-1`, `abc 1` and `ABC_1` all give
--     `abc-1`) gets `-<id>` appended on EVERY row that shares it, so no row silently wins
--     the readable form by id order.
-- Collections have no code, so they get `collection-<id>`.
--
-- The suffixed forms can still, in principle, equal another row's natural slug (a SKU of
-- `abc-1-7` beside a suffixed `abc-1` on row 7). The loop after each backfill resolves any
-- such leftover by suffixing the higher ids again, and raises rather than guessing if it
-- cannot converge -- a migration that half-succeeds would fail later on the UNIQUE index
-- with a message that names neither the row nor the cause.
--
-- Product slugs taken from SKUs republish an internal code in URLs. Accepted as
-- temporary: the pre-launch content pass (B-6) replaces them with name_en-derived slugs.
--
-- Wrapped in a tagged DO block so the pg-mem shim can strip it, the BACKFILL_012 pattern:
-- `regexp_replace`, window functions and PL/pgSQL loops are beyond pg-mem, and a pg-mem
-- database is always freshly created, so there is nothing to backfill there. The
-- backfill is proven on real PostgreSQL in
-- `tests/concurrency/storefrontCatalogMigration.realpg.test.ts`.
DO $backfill_014$
DECLARE
  leftover INTEGER;
  renamed INTEGER;
  lifted RECORD;
  lifted_tables TEXT[] := '{}';
  lifted_defs TEXT[] := '{}';
  i INTEGER;
BEGIN
  -- An UPDATE re-checks every CHECK on the new row, including one added NOT VALID. 004
  -- added `products_stock_non_negative` NOT VALID precisely so legacy negative-stock
  -- rows could survive it, and setting a slug on such a row would abort this migration.
  -- So every unvalidated CHECK on the two tables being rewritten is lifted for the
  -- backfill and re-added from its own `pg_get_constraintdef` (which carries the
  -- NOT VALID) inside the same transaction: the constraint ends exactly as it was.
  FOR lifted IN
    SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
     WHERE conrelid IN ('products'::regclass, 'categories'::regclass)
       AND contype = 'c'
       AND NOT convalidated
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', lifted.tbl, lifted.conname);
    lifted_tables := lifted_tables || lifted.tbl;
    lifted_defs := lifted_defs || format('ADD CONSTRAINT %I %s', lifted.conname, lifted.def);
  END LOOP;

  WITH based AS (
    SELECT id,
           btrim(left(btrim(regexp_replace(lower(sku), '[^a-z0-9]+', '-', 'g'), '-'), 70), '-') AS base
      FROM products
     WHERE slug IS NULL
  ), counted AS (
    SELECT id, base, count(*) OVER (PARTITION BY base) AS shared FROM based
  )
  UPDATE products p
     SET slug = CASE
                  WHEN c.base = '' THEN 'product-' || c.id
                  WHEN c.shared > 1 THEN c.base || '-' || c.id
                  ELSE c.base
                END
    FROM counted c
   WHERE p.id = c.id;

  WITH based AS (
    SELECT id,
           btrim(left(btrim(regexp_replace(lower(code), '[^a-z0-9]+', '-', 'g'), '-'), 70), '-') AS base
      FROM categories
     WHERE slug IS NULL
  ), counted AS (
    SELECT id, base, count(*) OVER (PARTITION BY base) AS shared FROM based
  )
  UPDATE categories t
     SET slug = CASE
                  WHEN c.base = '' THEN 'category-' || c.id
                  WHEN c.shared > 1 THEN c.base || '-' || c.id
                  ELSE c.base
                END
    FROM counted c
   WHERE t.id = c.id;

  UPDATE collections SET slug = 'collection-' || id WHERE slug IS NULL;

  -- Leftover collisions: keep the lowest id's slug, re-suffix the rest. The cut to
  -- 80 - length('-<id>') keeps every slug within the 80-character pattern. Bounded: a
  -- collision that survives five passes is raised, never looped on or guessed at.
  FOR pass IN 1..5 LOOP
    WITH ranked AS (
      SELECT id, slug, row_number() OVER (PARTITION BY slug ORDER BY id) AS rn
        FROM products WHERE slug IS NOT NULL
    )
    UPDATE products p
       SET slug = btrim(left(r.slug, 80 - length('-' || r.id)), '-') || '-' || r.id
      FROM ranked r
     WHERE p.id = r.id AND r.rn > 1;
    GET DIAGNOSTICS leftover = ROW_COUNT;

    WITH ranked AS (
      SELECT id, slug, row_number() OVER (PARTITION BY slug ORDER BY id) AS rn
        FROM categories WHERE slug IS NOT NULL
    )
    UPDATE categories t
       SET slug = btrim(left(r.slug, 80 - length('-' || r.id)), '-') || '-' || r.id
      FROM ranked r
     WHERE t.id = r.id AND r.rn > 1;
    GET DIAGNOSTICS renamed = ROW_COUNT;

    EXIT WHEN leftover + renamed = 0;
  END LOOP;

  IF leftover + renamed > 0 THEN
    RAISE EXCEPTION '014: product or category slugs still collide after 5 passes; resolve the SKUs/codes by hand';
  END IF;

  FOR i IN 1..coalesce(array_length(lifted_tables, 1), 0) LOOP
    EXECUTE format('ALTER TABLE %s %s', lifted_tables[i], lifted_defs[i]);
  END LOOP;
END
$backfill_014$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_slug ON collections(slug);

-- Additional gallery images, ordered by `position` per product. The UNIQUE constraint
-- doubles as the (product_id, position) lookup index.
CREATE TABLE IF NOT EXISTS product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT product_images_position_unique UNIQUE (product_id, position)
);

-- Listing indexes (KD-17): newest-first and price-ordered listings of active products,
-- keyset-stable on id; category filtering; and the in-stock filter, which is an EXISTS
-- over variants that still have stock.
CREATE INDEX IF NOT EXISTS idx_products_status_created ON products(status, created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_products_status_price ON products(status, price, id);
CREATE INDEX IF NOT EXISTS idx_products_category_status ON products(category_id, status);
CREATE INDEX IF NOT EXISTS idx_product_variants_in_stock ON product_variants(product_id) WHERE stock > 0;
