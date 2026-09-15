/**
 * Cart quote behaviour pg-mem cannot prove (plan 2026-09-15-001, Unit 1, R4).
 *
 * - node-postgres returns NUMERIC as a string ("2850.00"); pg-mem returns a number. A NULL
 *   variant price must fall back to the product price as a JS number, never 0 and never a
 *   string, and line arithmetic must be numeric, at the HTTP boundary.
 * - The batched product and variant reads run on the real engine.
 * - A read past the statement timeout is a 503.
 */
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from '../support/realPostgres';
import { resetEnvCache } from '../../src/config/env';
import { createApp } from '../../src/app';
import { CatalogService } from '../../src/modules/commerce/catalog/service';
import { CatalogRepository } from '../../src/modules/commerce/catalog/repository';
import type { Queryable } from '../../src/database/transaction';
import type { CartQuoteDto } from '../../src/modules/commerce/catalog/types';

const ENV_KEYS = ['MEDIA_PUBLIC_BASE_URL', 'CART_QUOTE_RATE_LIMIT_MAX'] as const;

describeWithPostgres('cart quote on real PostgreSQL', () => {
  let harness: RealPostgresHarness;
  let server: Server;
  let port: number;
  const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  beforeAll(async () => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
    process.env.MEDIA_PUBLIC_BASE_URL = 'https://media.example.com/uploads';
    process.env.CART_QUOTE_RATE_LIMIT_MAX = '100000';
    resetEnvCache();
    harness = await setupRealPostgres('catalog_cart_quote');

    await harness.pool.query(
      `INSERT INTO products (id, name, sku, slug, price, stock, has_variants, status) VALUES
         (1, 'silk', 'S1', 'silk-midi-dress', 2850.00, 0, 1, 'active'),
         (2, 'tote', 'S2', 'leather-tote', 1250.50, 3, 0, 'active'),
         (3, 'hidden', 'S3', 'hidden-coat', 900, 5, 0, 'inactive')`
    );
    await harness.pool.query(
      `INSERT INTO product_variants (id, product_id, sku, stock, price, attributes) VALUES
         (1, 1, 'V-S', 4, NULL, '{"size":"S"}'),
         (2, 1, 'V-M', 2, 1399.50, '{"size":"M"}')`
    );

    const app = createApp();
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve()))
      );
    }
    await harness.teardown();
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    resetEnvCache();
  });

  async function quote(lines: unknown): Promise<{ status: number; body: { data: CartQuoteDto } }> {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/catalog/cart/quote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lines }),
    });
    return { status: res.status, body: (await res.json()) as { data: CartQuoteDto } };
  }

  it('prices a NULL-price variant at the NUMERIC product price, as a number', async () => {
    const raw = await harness.pool.query<{ price: unknown }>(
      'SELECT price FROM products WHERE id = 1'
    );
    expect(typeof raw.rows[0].price).toBe('string');

    const r = await quote([{ slug: 'silk-midi-dress', options: { size: 'S' }, quantity: 3 }]);
    expect(r.status).toBe(200);
    const [line] = r.body.data.lines;
    expect(line).toMatchObject({ status: 'ok', unitPrice: 2850, quantity: 3, lineTotal: 8550 });
    expect(typeof line.unitPrice).toBe('number');
    expect(r.body.data.subtotal).toBe(8550);
  });

  it('does numeric arithmetic on decimal variant and product prices across lines', async () => {
    const r = await quote([
      { slug: 'silk-midi-dress', options: { size: 'm' }, quantity: 3 },
      { slug: 'leather-tote', options: {}, quantity: 2 },
      { slug: 'hidden-coat', options: {}, quantity: 1 },
    ]);
    expect(r.status).toBe(200);
    const [variant, plain, hidden] = r.body.data.lines;
    expect(variant).toMatchObject({
      status: 'reduced',
      unitPrice: 1399.5,
      quantity: 2,
      maxQuantity: 2,
      lineTotal: 2799,
      options: [{ key: 'size', label: 'size', value: 'M' }],
    });
    expect(plain).toMatchObject({ status: 'ok', unitPrice: 1250.5, lineTotal: 2501 });
    expect(hidden).toMatchObject({ status: 'productUnavailable', product: null });
    expect(r.body.data.subtotal).toBe(5300);
    expect(r.body.data.itemCount).toBe(4);
  });

  it('maps a read past the statement timeout to 503', async () => {
    class SlowRepository extends CatalogRepository {
      override async findPublicProductsBySlugs(_slugs: readonly string[], db: Queryable) {
        await db.query('SELECT pg_sleep(3)');
        return [];
      }
    }
    await expect(
      new CatalogService(new SlowRepository()).quoteCart([
        { slug: 'leather-tote', options: {}, quantity: 1 },
      ])
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  }, 20_000);
});
