import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool as PgPool } from 'pg';
import path from 'path';
import { createPgMemPool } from '../support/pgMem';
import { runMigrationsUp } from '../../src/database/migrate';
import { seedDatabase } from '../../src/database/seed';

/**
 * The storefront homepage links to these category and collection slugs, so a dev database
 * seeded from scratch must serve every one of them.
 *
 * String-coupling twin: `REQUIRED_CATALOG_KEYS` in
 * `apps/storefront/features/collections/data/required-catalog-keys.ts`. The storefront
 * cannot import server code (nor the reverse), so the list is duplicated by hand; change
 * both together (docs/CONVENTIONS.md, global string-coupling contract).
 */
const REQUIRED_CATALOG_KEYS = {
  categories: ['dresses', 'tops', 'knitwear', 'bags', 'abayas'],
  collections: ['evening', 'linen', 'silk'],
} as const;

describe('seeded catalog keys', () => {
  let pool: PgPool;

  beforeAll(async () => {
    pool = createPgMemPool();
    await runMigrationsUp(pool, path.join(__dirname, '../../src/database/migrations'));
    await seedDatabase(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('creates every homepage category key', async () => {
    const { rows } = await pool.query<{ slug: string }>(
      'SELECT slug FROM categories WHERE slug IS NOT NULL'
    );
    const slugs = rows.map((row) => row.slug);
    for (const key of REQUIRED_CATALOG_KEYS.categories) expect(slugs).toContain(key);
  });

  it('creates every homepage collection key as a public collection with products', async () => {
    const { rows } = await pool.query<{ slug: string; status: string; product_count: number }>(
      // A join, not a correlated subquery: pg-mem cannot resolve the outer alias.
      `SELECT c.slug, c.status, COUNT(cp.product_id) AS product_count
         FROM collections c
         LEFT JOIN collection_products cp ON cp.collection_id = c.id
        WHERE c.slug IS NOT NULL
        GROUP BY c.slug, c.status`
    );
    for (const key of REQUIRED_CATALOG_KEYS.collections) {
      const row = rows.find((r) => r.slug === key);
      expect(row, key).toBeDefined();
      expect(row?.status).toBe('active');
      expect(Number(row?.product_count)).toBeGreaterThan(0);
    }
  });
});
