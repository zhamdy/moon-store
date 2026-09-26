import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';
import type { Pool as PgPool } from 'pg';
import { createPgMemPool } from './support/pgMem';
import { setPool, closePool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import { ProductsController } from '../src/modules/inventory/products/controller';
import {
  parseProductListQuery,
  parseProductLookupQuery,
} from '../src/modules/inventory/products/types';
import { productsRepository } from '../src/modules/inventory/products/repository';
import { productsService } from '../src/modules/inventory/products/service';
import productsRouter from '../src/modules/inventory/products/routes';
import { startHttpApp, type HttpHarness } from './support/httpApp';

/**
 * `discontinue` writes an audit row through the module pool. The write is
 * fire-and-forget and its failure is swallowed by the audit logger, so without an
 * injected pool this file quietly opened a real PostgreSQL connection instead of
 * failing — hermetic only by accident of that catch.
 */
let testPool: PgPool;

beforeAll(async () => {
  testPool = createPgMemPool();
  setPool(testPool);
  await runMigrationsUp(testPool, path.join(__dirname, '../src/database/migrations'));
});

afterAll(async () => {
  await closePool();
});

function response() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.send = vi.fn(() => res);
  return res;
}

describe('product collection query contract', () => {
  it('normalizes canonical defaults and rejects retired compatibility aliases', () => {
    expect(parseProductListQuery({})).toMatchObject({
      page: 1,
      pageSize: 25,
      sortBy: 'name',
      sortOrder: 'asc',
    });
    expect(() => parseProductListQuery({ pageSize: '200' })).toThrow();
    for (const query of [
      { limit: '25' },
      { sort: 'name' },
      { order: 'asc' },
      { category_id: '1' },
    ]) {
      expect(() => parseProductListQuery(query)).toThrow();
    }
  });

  it.each([
    { page: '0' },
    { page: '-1' },
    { page: '1.5' },
    { pageSize: '11' },
    { pageSize: '101' },
    { lowStock: 'yes' },
    { sortBy: 'sku' },
    { extra: 'x' },
    { page: ['1', '2'] },
    { search: 'x'.repeat(101) },
    { pageSize: '25', limit: '25' },
    { categoryId: '1', category_id: '1' },
    { lowStock: 'true', status: 'all' },
    { lowStock: 'true', status: 'inactive' },
  ])('strictly rejects invalid query %#', (query) => {
    expect(() => parseProductListQuery(query)).toThrow();
  });

  it('preserves absent-status active default and explicit all', () => {
    expect(parseProductListQuery({}).status).toBeUndefined();
    expect(parseProductListQuery({ status: 'all' }).status).toBe('all');
  });
});

describe('product routes', () => {
  it('does not expose the retired low-stock compatibility route', () => {
    const paths = (
      productsRouter as unknown as { stack: Array<{ route?: { path: string } }> }
    ).stack.map((layer) => layer.route?.path);
    expect(paths).not.toContain('/low-stock');
  });
});

describe('product lookup contract', () => {
  it('deduplicates IDs and applies strict raw/count bounds', () => {
    expect(parseProductLookupQuery({ ids: '3,1,3' })).toEqual({ ids: [1, 3] });
    expect(() =>
      parseProductLookupQuery({ ids: Array.from({ length: 101 }, (_, i) => i + 1).join(',') })
    ).toThrow();
    expect(() => parseProductLookupQuery({ ids: '1,nope' })).toThrow();
    expect(() => parseProductLookupQuery({ ids: ['1', '2'] })).toThrow();
  });

  it('forbids low-stock reads before hitting the repository', async () => {
    const list = vi.spyOn(productsRepository, 'list');
    const req: any = { query: { lowStock: 'true' }, user: { role: 'Cashier' } };
    const res = response();
    const next = vi.fn();
    await new ProductsController().getProducts(req, res, next);
    expect(list).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
    list.mockRestore();
  });

  it('preserves Cashier access to explicit all-status listings', async () => {
    const list = vi.spyOn(productsService, 'list').mockResolvedValue({ rows: [], total: 0 });
    const req: any = { query: { status: 'all' }, user: { role: 'Cashier' } };
    const res = response();
    const next = vi.fn();
    await new ProductsController().getProducts(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ status: 'all' }));
    expect(res.json).toHaveBeenCalled();
    list.mockRestore();
  });

  it('passes duplicate conflicts to next instead of rejecting the async handler', async () => {
    const create = vi
      .spyOn(productsService, 'createProduct')
      // A real unique violation, as PostgreSQL reports it: SQLSTATE 23505. The controller
      // reads the code now rather than the message (#47) — the old check also looked for
      // 'UNIQUE', which is SQLite wording and had been dead since the migration.
      .mockRejectedValue(Object.assign(new Error('duplicate key value'), { code: '23505' }));
    const req: any = {
      body: { name: 'Dress', sku: 'D-1', price: 100, cost_price: 50, stock: 1 },
      socket: {},
    };
    const next = vi.fn();
    await expect(
      new ProductsController().createProduct(req, response(), next)
    ).resolves.toBeUndefined();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'CONFLICT' }));
    create.mockRestore();
  });

  it('returns a bodyless 204 when discontinuing succeeds', async () => {
    const update = vi.spyOn(productsRepository, 'updateStatus').mockResolvedValue({ id: 1 });
    const req: any = { params: { id: '1' }, socket: {} };
    const res = response();
    await new ProductsController().discontinue(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
    expect(res.json).not.toHaveBeenCalled();
    update.mockRestore();
  });
});

/**
 * Slugs and English names through the real app (plan 2026-09-14-002, Unit 2).
 *
 * Over HTTP rather than the service, because Zod strips unknown keys: a `name_en` the
 * schema never declared would pass every service-level test and still be dropped here.
 */
describe('storefront fields on the product write paths (HTTP boundary)', () => {
  let http: HttpHarness;
  const ARABIC_NAME = '\u0641\u0633\u062a\u0627\u0646 \u0633\u0647\u0631\u0629';

  beforeAll(async () => {
    http = await startHttpApp();
  });

  afterAll(async () => {
    await http.close();
  });

  beforeEach(async () => {
    await testPool.query('DELETE FROM price_history');
    await testPool.query('DELETE FROM products');
  });

  const productBody = (over: Record<string, unknown> = {}) => ({
    name: ARABIC_NAME,
    sku: 'MN-DR-001',
    price: 1250,
    cost_price: 400,
    stock: 3,
    ...over,
  });
  const create = (over: Record<string, unknown> = {}) =>
    http.request('POST', '/api/v1/products', productBody(over));

  it('persists name_en and generates the slug from it, both visible on the admin GET', async () => {
    const created = await create({ name_en: 'Silk Slip Dress' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      slug: 'silk-slip-dress',
      name_en: 'Silk Slip Dress',
    });

    const read = await http.request('GET', `/api/v1/products/${created.body.data.id}`);
    expect(read.status).toBe(200);
    expect(read.body.data).toMatchObject({ slug: 'silk-slip-dress', name_en: 'Silk Slip Dress' });
  });

  it('gives a second product with the same name_en the -2 slug', async () => {
    await create({ name_en: 'Silk Slip Dress' });
    const second = await create({ sku: 'MN-DR-002', name_en: 'Silk Slip Dress' });
    expect(second.status).toBe(201);
    expect(second.body.data.slug).toBe('silk-slip-dress-2');
  });

  it('falls back to the SKU when name_en is absent', async () => {
    const created = await create({ sku: 'MN-DR-003' });
    expect(created.status).toBe(201);
    expect(created.body.data.slug).toBe('mn-dr-003');
    expect(created.body.data.name_en).toBeNull();
  });

  it.each([
    ['Arabic only', ARABIC_NAME],
    ['punctuation only', '!!! ---'],
  ])('falls back to the SKU when name_en is %s', async (_label, nameEn) => {
    const created = await create({ sku: 'AB-77', name_en: nameEn });
    expect(created.status).toBe(201);
    expect(created.body.data.slug).toBe('ab-77');
  });

  it('uses an explicit slug as given', async () => {
    const created = await create({ name_en: 'Silk Slip Dress', slug: 'evening-silk' });
    expect(created.status).toBe(201);
    expect(created.body.data.slug).toBe('evening-silk');
  });

  it('rejects a malformed slug with a 400 on the slug field', async () => {
    const created = await create();
    const res = await http.request(
      'PUT',
      `/api/v1/products/${created.body.data.id}`,
      productBody({ slug: 'Silk Dress' })
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain('slug');
  });

  it('refuses an explicit slug already in use with a 409 on the slug field, not a suffix', async () => {
    const first = await create({ slug: 'silk-slip-dress' });
    const other = await create({ sku: 'MN-DR-002' });

    const onCreate = await create({ sku: 'MN-DR-009', slug: 'silk-slip-dress' });
    expect(onCreate.status).toBe(409);
    expect(onCreate.body.error.details[0]).toMatchObject({ field: 'slug', code: 'SLUG_TAKEN' });

    const onUpdate = await http.request(
      'PUT',
      `/api/v1/products/${other.body.data.id}`,
      productBody({ sku: 'MN-DR-002', slug: 'silk-slip-dress' })
    );
    expect(onUpdate.status).toBe(409);
    expect(onUpdate.body.error.details[0].field).toBe('slug');

    // Re-sending a product's own slug is not a collision.
    const own = await http.request(
      'PUT',
      `/api/v1/products/${first.body.data.id}`,
      productBody({ slug: 'silk-slip-dress' })
    );
    expect(own.status).toBe(200);
  });

  it('leaves slug and name_en alone when a PUT omits them, and clears name_en on null', async () => {
    const created = await create({ name_en: 'Silk Slip Dress' });
    const id = created.body.data.id;

    // Stock, not price: a price change writes price_history, whose user FK this fixture has no row for.
    const untouched = await http.request(
      'PUT',
      `/api/v1/products/${id}`,
      productBody({ stock: 7 })
    );
    expect(untouched.status).toBe(200);
    expect(untouched.body.data).toMatchObject({
      slug: 'silk-slip-dress',
      name_en: 'Silk Slip Dress',
    });

    const renamed = await http.request(
      'PUT',
      `/api/v1/products/${id}`,
      productBody({ slug: 'slip-dress', name_en: null })
    );
    expect(renamed.status).toBe(200);
    expect(renamed.body.data).toMatchObject({ slug: 'slip-dress', name_en: null });
  });

  /**
   * HIGH-3 / MED-11. `stock` used to be required on update, so no caller could edit a
   * name without also asserting an absolute stock: a form opened before a sale and saved
   * after it silently resurrected the sold unit, unaudited. `cost_price` and `min_stock`
   * carried schema defaults that overwrote stored data on a partial body, and `barcode`
   * and `distributor_id` were written as `x || null`, so omitting them cleared them.
   *
   * Tested at the HTTP boundary on purpose: Zod decides what reaches the service, so a
   * service-level test proves nothing about what the wire accepts (the `bundle_id`
   * lesson, root CLAUDE.md).
   */
  it('keeps stock, cost_price, min_stock, barcode and distributor_id when a PUT omits them', async () => {
    const created = await create({
      barcode: '6221002001',
      cost_price: 444,
      min_stock: 9,
      stock: 30,
    });
    const id = created.body.data.id;

    // A cashier sells one between the form opening and the operator saving.
    await testPool.query('UPDATE products SET stock = stock - 1 WHERE id = $1', [id]);

    const renamed = await http.request('PUT', `/api/v1/products/${id}`, {
      name: ARABIC_NAME,
      sku: 'MN-DR-001',
      price: 1250,
    });

    expect(renamed.status).toBe(200);
    expect(renamed.body.data).toMatchObject({
      stock: 29,
      min_stock: 9,
      barcode: '6221002001',
    });
    // NUMERIC by value, not representation: pg-mem returns a JS number where
    // node-postgres returns a string (root CLAUDE.md -> Learnings).
    expect(Number(renamed.body.data.cost_price)).toBe(444);
  });

  it('still writes stock when a PUT sends it, so the field is kept, not ignored', async () => {
    const created = await create({ stock: 30 });
    const id = created.body.data.id;

    const written = await http.request('PUT', `/api/v1/products/${id}`, {
      name: ARABIC_NAME,
      sku: 'MN-DR-001',
      price: 1250,
      stock: 12,
    });

    expect(written.status).toBe(200);
    expect(written.body.data).toMatchObject({ stock: 12 });
  });

  it('accepts a PUT with no stock, which used to be a 400', async () => {
    const created = await create();
    const res = await http.request('PUT', `/api/v1/products/${created.body.data.id}`, {
      name: ARABIC_NAME,
      sku: 'MN-DR-001',
      price: 1250,
    });
    expect(res.status).toBe(200);
  });

  it('persists description and description_en on create and update, both visible on the admin GET', async () => {
    const created = await create({
      description: 'فستان حريري',
      description_en: 'A silk slip dress.',
    });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      description: 'فستان حريري',
      description_en: 'A silk slip dress.',
    });

    const read = await http.request('GET', `/api/v1/products/${created.body.data.id}`);
    expect(read.status).toBe(200);
    expect(read.body.data).toMatchObject({ description_en: 'A silk slip dress.' });

    const updated = await http.request(
      'PUT',
      `/api/v1/products/${created.body.data.id}`,
      productBody({ description_en: 'An updated description.' })
    );
    expect(updated.status).toBe(200);
    expect(updated.body.data.description_en).toBe('An updated description.');
  });

  it('leaves description and description_en alone when a PUT omits them, and clears them on null', async () => {
    const created = await create({ description: 'Arabic copy', description_en: 'English copy' });
    const id = created.body.data.id;

    const untouched = await http.request(
      'PUT',
      `/api/v1/products/${id}`,
      productBody({ stock: 7 })
    );
    expect(untouched.status).toBe(200);
    expect(untouched.body.data).toMatchObject({
      description: 'Arabic copy',
      description_en: 'English copy',
    });

    const cleared = await http.request(
      'PUT',
      `/api/v1/products/${id}`,
      productBody({ description: null, description_en: null })
    );
    expect(cleared.status).toBe(200);
    expect(cleared.body.data).toMatchObject({ description: null, description_en: null });
  });

  it('answers 409 when all ten candidates are taken', async () => {
    for (let i = 1; i <= 10; i += 1) {
      const slug = i === 1 ? 'wrap-dress' : `wrap-dress-${i}`;
      expect((await create({ sku: `W-${i}`, slug })).status).toBe(201);
    }

    const res = await create({ sku: 'W-NEW', name_en: 'Wrap Dress' });
    expect(res.status).toBe(409);
    expect(res.body.error.details[0]).toMatchObject({ field: 'slug', code: 'SLUG_UNAVAILABLE' });
    // That the row rolls back with it is asserted on real PostgreSQL: pg-mem does not roll back.
  });

  it('persists slug and name_en columns from a CSV import, generating for rows without a slug', async () => {
    const res = await http.request('POST', '/api/v1/products/import', {
      products: [
        productBody({ sku: 'I-1', name_en: 'Linen Shirt' }),
        productBody({ sku: 'I-2', name_en: 'Linen Shirt' }),
        productBody({ sku: 'I-3', name_en: 'Linen Trousers', slug: 'custom-linen' }),
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ imported: 3, errors: [] });

    const { rows } = await testPool.query(
      "SELECT sku, slug, name_en FROM products WHERE sku IN ('I-1', 'I-2', 'I-3') ORDER BY sku"
    );
    expect(rows).toEqual([
      { sku: 'I-1', slug: 'linen-shirt', name_en: 'Linen Shirt' },
      { sku: 'I-2', slug: 'linen-shirt-2', name_en: 'Linen Shirt' },
      { sku: 'I-3', slug: 'custom-linen', name_en: 'Linen Trousers' },
    ]);
  });

  it('persists descriptions from a CSV import and keeps them when a re-import omits them', async () => {
    const first = await http.request('POST', '/api/v1/products/import', {
      products: [
        productBody({ sku: 'D-1', description: 'حرير طبيعي', description_en: 'Natural silk.' }),
      ],
    });
    expect(first.body.data).toEqual({ imported: 1, errors: [] });

    const again = await http.request('POST', '/api/v1/products/import', {
      products: [productBody({ sku: 'D-1', stock: 7 })],
    });
    expect(again.body.data).toEqual({ imported: 1, errors: [] });

    const { rows } = await testPool.query(
      "SELECT stock, description, description_en FROM products WHERE sku = 'D-1'"
    );
    expect(rows).toEqual([
      { stock: 7, description: 'حرير طبيعي', description_en: 'Natural silk.' },
    ]);
  });

  const DETAILS = {
    material: 'حرير طبيعي ١٠٠٪',
    material_en: '100% silk',
    care: 'تنظيف جاف فقط',
    care_en: 'Dry clean only',
    fit: 'قصة واسعة',
    fit_en: 'Relaxed fit',
  };
  const NO_DETAILS = {
    material: null,
    material_en: null,
    care: null,
    care_en: null,
    fit: null,
    fit_en: null,
  };

  it('persists material, care and fit on create, keeps them when a PUT omits them, clears them on null', async () => {
    const created = await create(DETAILS);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject(DETAILS);
    const id = created.body.data.id;

    const read = await http.request('GET', `/api/v1/products/${id}`);
    expect(read.status).toBe(200);
    expect(read.body.data).toMatchObject(DETAILS);

    const untouched = await http.request(
      'PUT',
      `/api/v1/products/${id}`,
      productBody({ stock: 7 })
    );
    expect(untouched.status).toBe(200);
    expect(untouched.body.data).toMatchObject(DETAILS);

    const cleared = await http.request(
      'PUT',
      `/api/v1/products/${id}`,
      productBody({ ...NO_DETAILS, care_en: 'Hand wash' })
    );
    expect(cleared.status).toBe(200);
    expect(cleared.body.data).toMatchObject({ ...NO_DETAILS, care_en: 'Hand wash' });
  });

  it.each(Object.keys(DETAILS))('rejects a %s longer than 2000 characters', async (field) => {
    const res = await create({ [field]: 'a'.repeat(2001) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts material, care and fit at exactly 2000 characters', async () => {
    const res = await create({ material: 'a'.repeat(2000) });
    expect(res.status).toBe(201);
  });

  it('persists material, care and fit from a CSV import and keeps them when a re-import omits them', async () => {
    const first = await http.request('POST', '/api/v1/products/import', {
      products: [productBody({ sku: 'M-1', ...DETAILS })],
    });
    expect(first.body.data).toEqual({ imported: 1, errors: [] });

    const again = await http.request('POST', '/api/v1/products/import', {
      products: [productBody({ sku: 'M-1', stock: 7 })],
    });
    expect(again.body.data).toEqual({ imported: 1, errors: [] });

    const { rows } = await testPool.query(
      "SELECT stock, material, material_en, care, care_en, fit, fit_en FROM products WHERE sku = 'M-1'"
    );
    expect(rows).toEqual([{ stock: 7, ...DETAILS }]);
  });

  it('rejects a description longer than 5000 characters on create', async () => {
    const res = await create({ description: 'a'.repeat(5001) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('fails only the import row whose explicit slug another SKU holds, and keeps a re-imported slug', async () => {
    await create({ sku: 'HELD', slug: 'held-slug' });

    const res = await http.request('POST', '/api/v1/products/import', {
      products: [
        productBody({ sku: 'I-1', slug: 'held-slug' }),
        productBody({ sku: 'I-2' }),
        // The same SKU re-imported with its own slug is an update, not a collision.
        productBody({ sku: 'HELD', slug: 'held-slug', stock: 9 }),
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.imported).toBe(2);
    expect(res.body.data.errors).toEqual([{ row: 1, error: 'Slug is already in use' }]);

    const again = await http.request('POST', '/api/v1/products/import', {
      products: [productBody({ sku: 'I-2', name_en: 'Later Name' })],
    });
    expect(again.body.data).toEqual({ imported: 1, errors: [] });
    const { rows } = await testPool.query(
      "SELECT sku, slug, stock FROM products WHERE sku IN ('I-1', 'I-2', 'HELD') ORDER BY sku"
    );
    expect(rows).toEqual([
      { sku: 'HELD', slug: 'held-slug', stock: 9 },
      { sku: 'I-2', slug: 'i-2', stock: 3 },
    ]);
  });

  it('keeps bulk update working on products that carry slugs', async () => {
    const a = await create({ sku: 'B-1', name_en: 'Bulk One' });
    const b = await create({ sku: 'B-2' });
    const res = await http.request('PUT', '/api/v1/products/bulk-update', {
      ids: [a.body.data.id, b.body.data.id],
      // Status only: pg-mem has no round(float, int), so price_percent cannot run here.
      updates: { status: 'inactive' },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBe(2);

    const { rows } = await testPool.query(
      "SELECT sku, slug, status FROM products WHERE sku IN ('B-1', 'B-2') ORDER BY sku"
    );
    expect(rows).toEqual([
      { sku: 'B-1', slug: 'bulk-one', status: 'inactive' },
      { sku: 'B-2', slug: 'b-2', status: 'inactive' },
    ]);
  });
});
