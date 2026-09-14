/**
 * Migration 014 — the slug backfill, on real PostgreSQL.
 *
 * pg-mem cannot run the backfill (`regexp_replace`, window functions, a PL/pgSQL loop),
 * so the shim strips it there and its behaviour on existing rows is only observable here.
 * The cases are the ones production data is most likely to hold: SKUs that differ only in
 * case or punctuation, codes with no ASCII at all, and codes longer than a slug may be.
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import path from 'path';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from '../support/realPostgres';
import {
  getAppliedMigrations,
  runMigrationsDown,
  runMigrationsUp,
} from '../../src/database/migrate';

const MIGRATIONS_DIR = path.join(__dirname, '../../src/database/migrations');
const MIGRATION = '014_storefront_catalog.sql';
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ARABIC_SKU = 'فستان';
const ARABIC_CODE = 'عبايات';
const LONG_SKU = 'LONG-' + 'x'.repeat(95);

/**
 * Explicit ids, so the suffixed forms are known in advance. `abc-1-101` is a real SKU
 * whose natural slug equals the suffixed slug `ABC-1` (id 101) receives: the leftover
 * collision the backfill's loop exists to resolve.
 */
const PRODUCTS: ReadonlyArray<readonly [number, string]> = [
  [100, 'SILK-DRESS'],
  [101, 'ABC-1'],
  [102, 'abc 1'],
  [103, 'ABC_1'],
  [104, ARABIC_SKU],
  [105, '---'],
  [106, LONG_SKU],
  [107, 'abc-1-101'],
];

type Pool = RealPostgresHarness['pool'];

async function rollBack014(pool: Pool): Promise<void> {
  const applied = await getAppliedMigrations(pool);
  await runMigrationsDown(applied.length - applied.indexOf(MIGRATION), pool, MIGRATIONS_DIR);
  expect(await getAppliedMigrations(pool)).not.toContain(MIGRATION);
}

async function productSlugs(pool: Pool): Promise<Map<number, string>> {
  const { rows } = await pool.query<{ id: number; slug: string }>(
    'SELECT id, slug FROM products ORDER BY id'
  );
  return new Map(rows.map((r) => [r.id, r.slug]));
}

describeWithPostgres('migration 014 — storefront catalog slug backfill', () => {
  let db: RealPostgresHarness;

  beforeAll(async () => {
    db = await setupRealPostgres('migration-014', { installAsAppPool: false, maxConnections: 2 });
    await rollBack014(db.pool);

    for (const [id, sku] of PRODUCTS) {
      await db.pool.query(`INSERT INTO products (id, name, sku, price) VALUES ($1, $2, $2, 100)`, [
        id,
        sku,
      ]);
    }
    await db.pool.query(
      `INSERT INTO categories (id, name, code) VALUES
         (200, 'Dresses', 'DRESSES'), (201, 'Tops', 'tops'), (202, 'Abayas', $1),
         (203, 'Knit A', 'KNIT'), (204, 'Knit B', 'knit!')`,
      [ARABIC_CODE]
    );
    await db.pool.query(
      `INSERT INTO collections (id, name) VALUES (300, 'Evening'), (301, 'Resort')`
    );

    // A legacy negative-stock row, the kind 004's NOT VALID constraint exists to tolerate.
    // Inserted the way such a row came to exist: before the constraint did.
    await db.pool.query('ALTER TABLE products DROP CONSTRAINT products_stock_non_negative');
    await db.pool.query(
      `INSERT INTO products (id, name, sku, price, stock) VALUES (108, 'Legacy', 'NEG-STOCK', 100, -3)`
    );
    await db.pool.query(
      'ALTER TABLE products ADD CONSTRAINT products_stock_non_negative CHECK (stock >= 0) NOT VALID'
    );

    expect(await runMigrationsUp(db.pool, MIGRATIONS_DIR)).toContain(MIGRATION);
  });

  afterAll(async () => {
    await db.teardown();
  });

  it('gives every existing row a slug matching the pattern, unique per table', async () => {
    for (const table of ['products', 'categories', 'collections']) {
      const { rows } = await db.pool.query<{ slug: string | null }>(`SELECT slug FROM ${table}`);
      expect(rows.length, table).toBeGreaterThan(0);
      for (const { slug } of rows) {
        expect(slug, table).toMatch(SLUG_PATTERN);
        expect(slug!.length, table).toBeLessThanOrEqual(80);
      }
      expect(new Set(rows.map((r) => r.slug)).size, `${table} slugs unique`).toBe(rows.length);
    }
  });

  it('keeps a unique SKU readable', async () => {
    expect((await productSlugs(db.pool)).get(100)).toBe('silk-dress');
  });

  it('suffixes every SKU that slugifies to the same value with its own id', async () => {
    const slugs = await productSlugs(db.pool);
    expect([slugs.get(101), slugs.get(102), slugs.get(103)]).toEqual([
      'abc-1-101',
      'abc-1-102',
      'abc-1-103',
    ]);
  });

  it('re-suffixes a natural slug that collides with a suffixed one, keeping the lower id', async () => {
    expect((await productSlugs(db.pool)).get(107)).toBe('abc-1-101-107');
  });

  it('slugs a legacy negative-stock row and leaves its NOT VALID constraint as it was', async () => {
    expect((await productSlugs(db.pool)).get(108)).toBe('neg-stock');

    const { rows } = await db.pool.query<{ convalidated: boolean; def: string }>(
      `SELECT convalidated, pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conname = 'products_stock_non_negative'
          AND conrelid = 'products'::regclass`
    );
    expect(rows).toEqual([{ convalidated: false, def: 'CHECK ((stock >= 0)) NOT VALID' }]);
  });

  it('falls back to product-<id> when a SKU has no ASCII to slug', async () => {
    const slugs = await productSlugs(db.pool);
    expect(slugs.get(104)).toBe('product-104');
    expect(slugs.get(105)).toBe('product-105');
  });

  it('cuts a 100-character SKU to at most 80 characters', async () => {
    const slug = (await productSlugs(db.pool)).get(106)!;
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug).toBe('long-' + 'x'.repeat(65));
  });

  it('slugs categories from their code, with the same fallbacks', async () => {
    const { rows } = await db.pool.query<{ id: number; slug: string }>(
      'SELECT id, slug FROM categories ORDER BY id'
    );
    expect(rows.map((r) => r.slug)).toEqual([
      'dresses',
      'tops',
      'category-202',
      'knit-203',
      'knit-204',
    ]);
  });

  it('gives collections collection-<id>', async () => {
    const { rows } = await db.pool.query<{ slug: string }>(
      'SELECT slug FROM collections ORDER BY id'
    );
    expect(rows.map((r) => r.slug)).toEqual(['collection-300', 'collection-301']);
  });

  it('refuses a duplicate slug and still accepts rows without one', async () => {
    await expect(
      db.pool.query(
        `INSERT INTO products (id, name, sku, price, slug) VALUES (400, 'Dup', 'DUP-1', 100, 'silk-dress')`
      )
    ).rejects.toMatchObject({ code: '23505' });

    await db.pool.query(
      `INSERT INTO products (id, name, sku, price) VALUES (401, 'N1', 'NOSLUG-1', 100), (402, 'N2', 'NOSLUG-2', 100)`
    );
    const { rows } = await db.pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM products WHERE slug IS NULL`
    );
    expect(rows[0].n).toBe(2);
  });

  it('cascades a product delete to its gallery rows', async () => {
    await db.pool.query(
      `INSERT INTO product_images (product_id, image_url, position)
       VALUES (100, '/a.jpg', 0), (100, '/b.jpg', 1)`
    );
    await db.pool.query('DELETE FROM products WHERE id = 100');
    const { rows } = await db.pool.query('SELECT 1 FROM product_images WHERE product_id = 100');
    expect(rows).toHaveLength(0);
  });

  it('rolls back and re-applies, slugging every row again', async () => {
    await rollBack014(db.pool);
    await expect(db.pool.query('SELECT 1 FROM product_images')).rejects.toThrow(/product_images/);

    expect(await runMigrationsUp(db.pool, MIGRATIONS_DIR)).toContain(MIGRATION);
    const { rows } = await db.pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM products WHERE slug IS NULL`
    );
    expect(rows[0].n).toBe(0);
  });
});
