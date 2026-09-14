/**
 * Slug generation under genuine concurrency (plan 2026-09-14-002, Unit 2, KD-6).
 *
 * Generation picks the first candidate no committed row holds. Two writers can both pick
 * the same one: neither sees the other's uncommitted row, so the UNIQUE index referees and
 * the loser gets a 23505. The service retries that statement inside a SAVEPOINT, narrowed
 * to the slug index by constraint name. None of this can be shown on pg-mem: it has no
 * MVCC (the race never happens), reports no `err.constraint` (the narrowing never
 * matches), and cannot parse SAVEPOINT (its shim no-ops them).
 *
 * The deterministic cases hold a slug in an open transaction, start the writer, wait until
 * PostgreSQL reports that writer blocked on a lock, then commit. That forces the 23505
 * path on every run instead of hoping two promises interleave. Without the SAVEPOINT the
 * retry would run on an aborted transaction and fail with 25P02.
 */
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from '../support/realPostgres';
import {
  createProduct,
  importProducts,
  type CreateProductInput,
} from '../../services/productService';
import { CollectionsService } from '../../src/modules/inventory/collections/service';
import { PublicError } from '../../src/http/errors';
import { isSlugViolation } from '../../src/modules/inventory/shared/slug';

/** Resolves once some backend is waiting on a lock while running a query containing `needle`. */
async function waitForLockWait(pool: Pool, needle: string): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_stat_activity
        WHERE wait_event_type = 'Lock' AND query LIKE $1 AND pid <> pg_backend_pid()`,
      [`%${needle}%`]
    );
    if (rows[0].n > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`No backend ever blocked on a query containing: ${needle}`);
}

const product = (over: Partial<CreateProductInput>): CreateProductInput => ({
  name: 'test product',
  sku: 'SKU-X',
  price: 100,
  cost_price: 10,
  stock: 1,
  min_stock: 0,
  ...over,
});

describeWithPostgres('catalog slug generation under concurrency', () => {
  let harness: RealPostgresHarness;

  beforeAll(async () => {
    // A held transaction, the writer under test and the lock monitor, plus margin.
    harness = await setupRealPostgres('catalog-slug', { maxConnections: 8 });
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(async () => {
    await harness.truncate();
  });

  /** Opens a transaction that holds `slug` on an uncommitted row. */
  async function holdSlug(table: 'products' | 'collections', slug: string): Promise<PoolClient> {
    const client = await harness.connect();
    await client.query('BEGIN');
    if (table === 'products') {
      await client.query(
        "INSERT INTO products (name, sku, price, stock, slug) VALUES ('holder', 'HOLD-1', 10, 1, $1)",
        [slug]
      );
    } else {
      await client.query("INSERT INTO collections (name, slug) VALUES ('holder', $1)", [slug]);
    }
    return client;
  }

  async function slugsOf(skus: string[]): Promise<Record<string, string>> {
    const { rows } = await harness.pool.query<{ sku: string; slug: string }>(
      'SELECT sku, slug FROM products WHERE sku = ANY($1::text[])',
      [skus]
    );
    return Object.fromEntries(rows.map((r) => [r.sku, r.slug]));
  }

  it('retries a create that loses its candidate to a concurrent commit, and takes -2', async () => {
    const holder = await holdSlug('products', 'silk-slip-dress');
    try {
      const pending = createProduct(product({ sku: 'B-1', name_en: 'Silk Slip Dress' }));
      await waitForLockWait(harness.pool, 'UPDATE products SET slug = CASE');
      await holder.query('COMMIT');

      const created = await pending;
      expect(created.slug).toBe('silk-slip-dress-2');
    } finally {
      holder.release();
    }
  });

  it('lets four simultaneous creates with the same name_en all succeed with distinct slugs', async () => {
    const results = await Promise.allSettled(
      [1, 2, 3, 4].map((n) => createProduct(product({ sku: `C-${n}`, name_en: 'Silk Slip Dress' })))
    );
    expect(results.map((r) => r.status)).toEqual([
      'fulfilled',
      'fulfilled',
      'fulfilled',
      'fulfilled',
    ]);
    const slugs = Object.values(await slugsOf(['C-1', 'C-2', 'C-3', 'C-4'])).sort();
    expect(slugs).toEqual([
      'silk-slip-dress',
      'silk-slip-dress-2',
      'silk-slip-dress-3',
      'silk-slip-dress-4',
    ]);
  });

  it('imports two rows whose name_en collide, with distinct slugs and no aborted row', async () => {
    const result = await importProducts([
      product({ sku: 'I-1', name_en: 'Linen Shirt' }),
      product({ sku: 'I-2', name_en: 'Linen Shirt' }),
    ]);
    expect(result).toEqual({ imported: 2, errors: [] });
    expect(await slugsOf(['I-1', 'I-2'])).toEqual({ 'I-1': 'linen-shirt', 'I-2': 'linen-shirt-2' });
  });

  it('keeps an import going when a row loses its slug race mid-import', async () => {
    const holder = await holdSlug('products', 'linen-shirt');
    try {
      const pending = importProducts([
        product({ sku: 'I-1', name_en: 'Linen Shirt' }),
        product({ sku: 'I-2', name_en: 'Linen Shirt' }),
      ]);
      await waitForLockWait(harness.pool, 'UPDATE products SET slug = CASE');
      await holder.query('COMMIT');

      expect(await pending).toEqual({ imported: 2, errors: [] });
      expect(await slugsOf(['I-1', 'I-2'])).toEqual({
        'I-1': 'linen-shirt-2',
        'I-2': 'linen-shirt-3',
      });
    } finally {
      holder.release();
    }
  });

  it('answers a lost race on an explicit slug with the typed 409 on the slug field', async () => {
    const holder = await holdSlug('products', 'held');
    try {
      // The pre-check cannot see the uncommitted row, so only the index can refuse this.
      const pending = createProduct(product({ sku: 'E-1', slug: 'held' }));
      const outcome = pending.then(
        () => null,
        (error: unknown) => error
      );
      await waitForLockWait(harness.pool, 'INSERT INTO products (name, sku, barcode');
      await holder.query('COMMIT');

      const error = await outcome;
      expect(error).toBeInstanceOf(PublicError);
      expect((error as PublicError).code).toBe('CONFLICT');
      expect((error as PublicError).details?.[0]).toMatchObject({
        field: 'slug',
        code: 'SLUG_TAKEN',
      });
      expect(await slugsOf(['E-1'])).toEqual({});
    } finally {
      holder.release();
    }
  });

  it('rolls the product back when all ten candidates are taken', async () => {
    for (let i = 1; i <= 10; i += 1) {
      await createProduct(
        product({ sku: `W-${i}`, slug: i === 1 ? 'wrap-dress' : `wrap-dress-${i}` })
      );
    }
    const error = await createProduct(product({ sku: 'W-NEW', name_en: 'Wrap Dress' })).then(
      () => null,
      (e: unknown) => e
    );
    expect((error as PublicError).details?.[0]).toMatchObject({
      field: 'slug',
      code: 'SLUG_UNAVAILABLE',
    });
    // Insert and slug assignment share one transaction, so the refusal leaves no slugless row.
    expect(await slugsOf(['W-NEW'])).toEqual({});
    const { rows } = await harness.pool.query("SELECT id FROM products WHERE sku = 'W-NEW'");
    expect(rows).toHaveLength(0);
  });

  it('narrows by constraint name: a duplicate SKU is not reported as a slug collision', async () => {
    await createProduct(product({ sku: 'DUP-1' }));
    const error = await createProduct(product({ sku: 'DUP-1', name_en: 'Other' })).then(
      () => null,
      (e: unknown) => e
    );
    expect((error as { code?: string }).code).toBe('23505');
    expect(isSlugViolation(error, 'products')).toBe(false);

    const slugDup = await harness.pool
      .query(
        "INSERT INTO products (name, sku, price, stock, slug) VALUES ('x', 'DUP-2', 1, 1, 'dup-1')"
      )
      .then(
        () => null,
        (e: unknown) => e
      );
    expect(isSlugViolation(slugDup, 'products')).toBe(true);
  });

  it('retries a collection create inside its own transaction and keeps its product set', async () => {
    const { rows } = await harness.pool.query<{ id: number }>(
      "INSERT INTO products (name, sku, price, stock) VALUES ('p', 'P-1', 10, 1) RETURNING id"
    );
    const holder = await holdSlug('collections', 'evening-edit');
    try {
      const pending = new CollectionsService().create({
        name: 'Evening AR',
        name_en: 'Evening Edit',
        product_ids: [rows[0].id],
      });
      await waitForLockWait(harness.pool, 'UPDATE collections SET slug = CASE');
      await holder.query('COMMIT');

      const created = await pending;
      expect(created.slug).toBe('evening-edit-2');
      const members = await harness.pool.query(
        'SELECT product_id FROM collection_products WHERE collection_id = $1',
        [created.id]
      );
      expect(members.rows).toEqual([{ product_id: rows[0].id }]);
    } finally {
      holder.release();
    }
  });
});
