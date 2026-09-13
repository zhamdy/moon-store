/**
 * Bundles: one wire name for the price, and a list that returns what was written
 * (#123, #124).
 *
 * The write path has always written the `bundle_price` column while the list projected
 * the `price` column nothing writes, so every row came back at that column's default of
 * 0. The request schema meanwhile demanded `bundle_price`, a field the Bundles page has
 * never sent -- so creating a bundle from the UI failed validation outright, and the two
 * halves of the defect hid each other: nothing could be created, so nothing was listed
 * at the wrong price.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import path from 'path';
import type { Pool as PgPool } from 'pg';
import { createPgMemPool } from './support/pgMem';
import { setPool, closePool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import { BundlesRepository } from '../src/modules/inventory/bundles/repository';
import { BundlesService } from '../src/modules/inventory/bundles/service';
import { bundleSchema } from '../src/modules/inventory/bundles/schemas';

const MIGRATIONS_DIR = path.join(__dirname, '../src/database/migrations');

/** Exactly what the Bundles page submits: `price` and `status`, never `bundle_price`. */
const pagePayload = (overrides: Record<string, unknown> = {}) => ({
  name: 'Winter capsule',
  description: 'Coat and scarf',
  price: 500,
  status: 'active',
  items: [
    { product_id: 1, product_name: 'Silk Dress', product_price: 400, quantity: 1 },
    { product_id: 2, product_name: 'Cotton Shirt', product_price: 200, quantity: 1 },
  ],
  ...overrides,
});

const listFilters = {
  page: 1,
  pageSize: 25,
  sortBy: 'createdAt' as const,
  sortOrder: 'desc' as const,
};

describe('bundle price contract (#123, #124)', () => {
  let testPool: PgPool;
  const repo = new BundlesRepository();
  const service = new BundlesService(repo);

  beforeAll(async () => {
    testPool = createPgMemPool();
    setPool(testPool);
    await runMigrationsUp(testPool, MIGRATIONS_DIR);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await testPool.query('DELETE FROM bundle_items');
    await testPool.query('DELETE FROM product_bundles');
    await testPool.query('DELETE FROM products');

    await testPool.query(
      `INSERT INTO products (id, name, sku, price, cost_price, stock)
       VALUES (1, 'Silk Dress', 'SKU-001', 400, 200, 10),
              (2, 'Cotton Shirt', 'SKU-002', 200, 100, 10)`
    );
  });

  describe('the request contract', () => {
    it("accepts the Bundles page's own payload (#123 repro)", () => {
      const parsed = bundleSchema.safeParse(pagePayload());
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.price).toBe(500);
        expect(parsed.data.status).toBe('active');
      }
    });

    it('rejects a status outside the column CHECK as a 400, not a database error', () => {
      const parsed = bundleSchema.safeParse(pagePayload({ status: 'archived' }));
      expect(parsed.success).toBe(false);
    });

    it('rejects a missing or non-positive price, naming the field', () => {
      expect(bundleSchema.safeParse(pagePayload({ price: undefined })).success).toBe(false);
      const zero = bundleSchema.safeParse(pagePayload({ price: 0 }));
      expect(zero.success).toBe(false);
      if (!zero.success) {
        expect(zero.error.issues[0].path).toContain('price');
      }
    });

    it('still requires at least two products', () => {
      expect(
        bundleSchema.safeParse(pagePayload({ items: [{ product_id: 1, quantity: 1 }] })).success
      ).toBe(false);
    });
  });

  describe('the round trip', () => {
    it('persists the submitted price to bundle_price and reads it back as price (#124 repro)', async () => {
      const parsed = bundleSchema.parse(pagePayload());
      const created = await service.create(parsed);

      expect(Number(created.price)).toBe(500);

      // The column the writer actually wrote, checked directly: an alias that agreed
      // with itself on both sides would prove nothing.
      const stored = await testPool.query<{ bundle_price: string; status: string }>(
        'SELECT bundle_price, status FROM product_bundles WHERE id = $1',
        [created.id]
      );
      expect(Number(stored.rows[0].bundle_price)).toBe(500);
      expect(stored.rows[0].status).toBe('active');

      const { rows } = await service.list(listFilters);
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].price)).toBe(500);
    });

    it('returns the derived figures the client declares non-optional', async () => {
      const created = await service.create(bundleSchema.parse(pagePayload()));

      const { rows } = await service.list(listFilters);
      // 400 + 200 sold separately, 500 as a set.
      expect(Number(rows[0].original_price)).toBe(600);
      expect(Number(rows[0].savings)).toBe(100);
      expect(Number(rows[0].savings_percent)).toBe(17);
      expect(rows[0].items).toHaveLength(2);
      expect(rows[0].items?.[0]).toMatchObject({ product_name: expect.any(String) });

      const detail = await service.findById(created.id);
      expect(Number(detail?.price)).toBe(500);
      expect(Number(detail?.original_price)).toBe(600);
      expect(Number(detail?.savings_percent)).toBe(17);
    });

    it("carries each line's catalog price as product_price, the name the client reads", async () => {
      const created = await service.create(bundleSchema.parse(pagePayload()));

      const detail = await service.findById(created.id);
      const dress = detail?.items.find((item) => item.product_id === 1);
      expect(Number(dress?.product_price)).toBe(400);
      expect(dress?.product_name).toBe('Silk Dress');
    });

    it('edits the price and the status, and the list reflects both', async () => {
      const created = await service.create(bundleSchema.parse(pagePayload()));

      const updated = await service.update(
        created.id,
        bundleSchema.parse(pagePayload({ price: 450, status: 'inactive' }))
      );
      expect(updated.success).toBe(true);
      expect(Number(updated.data?.price)).toBe(450);
      expect(updated.data?.status).toBe('inactive');

      const { rows } = await service.list(listFilters);
      expect(Number(rows[0].price)).toBe(450);
      expect(rows[0].status).toBe('inactive');
    });

    it('defaults status to active when the payload omits it', async () => {
      const created = await service.create(bundleSchema.parse(pagePayload({ status: undefined })));
      expect(created.status).toBe('active');
    });

    it('never returns the dead price column alongside the aliased one', async () => {
      const created = await service.create(bundleSchema.parse(pagePayload()));

      // The legacy `price` column is gone as of migration 011 (#139) -- this used to read
      // it and assert it was still 0. The contract it protects is unchanged: `price` on
      // the wire is `bundle_price` in the table, and no response carries two answers for
      // one question. Now the schema is what guarantees it.
      await expect(
        testPool.query('SELECT price FROM product_bundles WHERE id = $1', [created.id])
      ).rejects.toThrow(/price/);

      const detail = await service.findById(created.id);
      expect(Number(detail?.price)).toBe(500);
    });
  });
});
