/**
 * Migration 014 on pg-mem: the schema the storefront catalog builds on.
 *
 * The slug backfill itself is stripped here (see `toPgMemCompatibleSql`) and proven on
 * real PostgreSQL in `tests/concurrency/storefrontCatalogMigration.realpg.test.ts`. What
 * this file proves is that every pg-mem suite still migrates through 014, and that the
 * columns, constraints and cascade the next units rely on behave as declared.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'path';
import type { Pool } from 'pg';
import { createPgMemPool } from '../support/pgMem';
import { runMigrationsUp } from '../../src/database/migrate';

const MIGRATIONS_DIR = path.join(__dirname, '../../src/database/migrations');

async function columnsOf(pool: Pool, table: string): Promise<string[]> {
  const { rows } = await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return rows.map((r) => r.column_name);
}

const INSERT_WITH_SLUG: Record<string, string> = {
  products: `INSERT INTO products (name, sku, price, slug) VALUES ($1, $1, 100, 'silk-dress')`,
  categories: `INSERT INTO categories (name, code, slug) VALUES ($1, $1, 'silk-dress')`,
  collections: `INSERT INTO collections (name, slug) VALUES ($1, 'silk-dress')`,
};

describe('migration 014 — storefront catalog (pg-mem)', () => {
  let pool: Pool;

  beforeEach(async () => {
    pool = createPgMemPool();
    const applied = await runMigrationsUp(pool, MIGRATIONS_DIR);
    expect(applied).toContain('014_storefront_catalog.sql');
  });

  afterEach(async () => {
    await pool.end();
  });

  it('adds slug and the English fields to the three catalog tables, and the gallery table', async () => {
    expect(await columnsOf(pool, 'products')).toEqual(expect.arrayContaining(['slug', 'name_en']));
    for (const table of ['categories', 'collections']) {
      expect(await columnsOf(pool, table)).toEqual(
        expect.arrayContaining(['slug', 'name_en', 'description_en'])
      );
    }
    expect(await columnsOf(pool, 'product_images')).toEqual(
      expect.arrayContaining(['id', 'product_id', 'image_url', 'position', 'created_at'])
    );
  });

  it('still accepts rows without a slug, so legacy inserts and fixtures keep working', async () => {
    await pool.query(
      `INSERT INTO products (name, sku, price) VALUES ('A', 'SKU-A', 100), ('B', 'SKU-B', 100)`
    );
    await pool.query(
      `INSERT INTO categories (name, code) VALUES ('Dresses', 'DR'), ('Tops', 'TP')`
    );
    await pool.query(`INSERT INTO collections (name) VALUES ('Evening'), ('Resort')`);

    const { rows } = await pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM products WHERE slug IS NULL`
    );
    expect(rows[0].n).toBe(2);
  });

  it.each(Object.keys(INSERT_WITH_SLUG))('refuses a duplicate slug on %s', async (table) => {
    await pool.query(INSERT_WITH_SLUG[table], ['first']);
    await expect(pool.query(INSERT_WITH_SLUG[table], ['second'])).rejects.toMatchObject({
      code: '23505',
    });
  });

  it('refuses two gallery images on one position of the same product', async () => {
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO products (name, sku, price) VALUES ('A', 'SKU-A', 100) RETURNING id`
    );
    const productId = rows[0].id;
    await pool.query(
      `INSERT INTO product_images (product_id, image_url, position) VALUES ($1, '/a.jpg', 0)`,
      [productId]
    );
    await expect(
      pool.query(
        `INSERT INTO product_images (product_id, image_url, position) VALUES ($1, '/b.jpg', 0)`,
        [productId]
      )
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('deletes the gallery rows with their product', async () => {
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO products (name, sku, price) VALUES ('A', 'SKU-A', 100) RETURNING id`
    );
    const productId = rows[0].id;
    await pool.query(
      `INSERT INTO product_images (product_id, image_url, position)
       VALUES ($1, '/a.jpg', 0), ($1, '/b.jpg', 1)`,
      [productId]
    );

    await pool.query('DELETE FROM products WHERE id = $1', [productId]);

    const left = await pool.query('SELECT id FROM product_images');
    expect(left.rows).toHaveLength(0);
  });
});
