import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import path from 'path';
import { Pool as PgPool } from 'pg';
import { createPgMemPool } from './support/pgMem';
import { setPool, closePool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import { adjustStock } from '../services/productService';
import { CategoriesController } from '../src/modules/inventory/categories/controller';
import { categoriesService } from '../src/modules/inventory/categories/service';
import { DistributorsController } from '../src/modules/inventory/distributors/controller';
import { distributorsService } from '../src/modules/inventory/distributors/service';
import { LabelTemplatesController } from '../src/modules/inventory/labelTemplates/controller';
import { labelTemplatesService } from '../src/modules/inventory/labelTemplates/service';
import { parseBundleListQuery } from '../src/modules/inventory/bundles/types';
import { parseCollectionListQuery } from '../src/modules/inventory/collections/types';
import { parseStockCountListQuery } from '../src/modules/inventory/stockCounts/types';
import { parseStockAdjustmentListQuery } from '../src/modules/inventory/stockAdjustments/types';

function response() {
  const res = {} as Response;
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.send = vi.fn(() => res);
  return res;
}

/**
 * File-scoped, not scoped to the stock-adjustment describe that needs the tables: the
 * category-deletion contract above writes an audit row through the module pool, and a
 * pool installed further down would still be uninstalled when that test runs — leaving
 * it to open a real PostgreSQL connection whose failure the audit logger swallows.
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

describe('bounded inventory contracts', () => {
  afterEach(() => vi.restoreAllMocks());

  async function expectCanonicalList(
    handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
  ) {
    const res = response();
    const next = vi.fn();
    await handler({} as Request, res, next as NextFunction);
    expect(res.json).toHaveBeenCalledWith({ data: [] });
    expect(next).not.toHaveBeenCalled();
  }

  it('wraps category list data canonically', async () => {
    vi.spyOn(categoriesService, 'findAll').mockResolvedValueOnce([]);
    const controller = new CategoriesController();
    await expectCanonicalList(controller.getCategories.bind(controller));
  });

  it('wraps distributor list data canonically', async () => {
    vi.spyOn(distributorsService, 'findAll').mockResolvedValueOnce([]);
    const controller = new DistributorsController();
    await expectCanonicalList(controller.getDistributors.bind(controller));
  });

  it('wraps label-template list data canonically', async () => {
    vi.spyOn(labelTemplatesService, 'findAll').mockResolvedValueOnce([]);
    const controller = new LabelTemplatesController();
    await expectCanonicalList(controller.getLabelTemplates.bind(controller));
  });

  it('returns 204 for successful category deletion', async () => {
    vi.spyOn(categoriesService, 'delete').mockResolvedValueOnce({ success: true });
    const res = response();
    await new CategoriesController().deleteCategory(
      { params: { id: '1' }, socket: { remoteAddress: '127.0.0.1' } } as unknown as Request,
      res,
      vi.fn() as NextFunction
    );
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });
});

describe('paginated inventory query contracts', () => {
  it('parses canonical bundle pagination and rejects legacy limit', () => {
    expect(parseBundleListQuery({ page: '2', pageSize: '25', status: 'active' })).toEqual({
      page: 2,
      pageSize: 25,
      status: 'active',
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
    expect(() => parseBundleListQuery({ limit: '20' })).toThrow();
  });

  it('parses canonical collection filters and rejects unknown input', () => {
    expect(parseCollectionListQuery({ page: '1', pageSize: '50', featured: 'true' })).toMatchObject(
      {
        page: 1,
        pageSize: 50,
        featured: true,
      }
    );
    expect(() => parseCollectionListQuery({ featured: 'yes' })).toThrow();
  });

  it('uses canonical pagination for stock collections', () => {
    expect(parseStockCountListQuery({ page: '2', pageSize: '10', status: 'completed' })).toEqual({
      page: 2,
      pageSize: 10,
      status: 'completed',
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
    expect(parseStockAdjustmentListQuery({ page: '3', pageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
    expect(() => parseStockCountListQuery({ limit: '20' })).toThrow();
    expect(() => parseStockAdjustmentListQuery({ limit: '50' })).toThrow();
  });
});

describe('manual stock adjustment invariants', () => {
  let userId: number;
  let productId: number;

  beforeEach(async () => {
    await testPool.query('DELETE FROM stock_adjustments');
    await testPool.query('DELETE FROM products');
    await testPool.query('DELETE FROM users');

    const users = await testPool.query<{ id: number }>(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ('Admin', 'adj@moon.com', 'x', 'Admin') RETURNING id`
    );
    userId = users.rows[0].id;

    const products = await testPool.query<{ id: number }>(
      `INSERT INTO products (name, sku, price, stock, min_stock)
       VALUES ('Scarf', 'SKU-ADJ', 100, 10, 0) RETURNING id`
    );
    productId = products.rows[0].id;
  });

  async function stockOf(): Promise<number> {
    const { rows } = await testPool.query<{ stock: number }>(
      'SELECT stock FROM products WHERE id = $1',
      [productId]
    );
    return Number(rows[0].stock);
  }

  async function adjustmentRows(): Promise<Array<{ previous_qty: number; new_qty: number }>> {
    const { rows } = await testPool.query<{ previous_qty: number; new_qty: number }>(
      'SELECT previous_qty, new_qty FROM stock_adjustments'
    );
    return rows;
  }

  it('applies a positive delta and records both quantities', async () => {
    const result = await adjustStock(productId, { delta: 5, reason: 'Restock' }, userId);

    expect(result).toEqual({ previous_qty: 10, new_qty: 15, delta: 5 });
    expect(await stockOf()).toBe(15);
    expect(await adjustmentRows()).toEqual([{ previous_qty: 10, new_qty: 15 }]);
  });

  it('allows a delta that lands exactly on zero', async () => {
    const result = await adjustStock(productId, { delta: -10, reason: 'Shrinkage' }, userId);

    expect(result.new_qty).toBe(0);
    expect(await stockOf()).toBe(0);
  });

  it('refuses a delta below zero with the existing message and writes nothing', async () => {
    await expect(
      adjustStock(productId, { delta: -11, reason: 'Shrinkage' }, userId)
    ).rejects.toThrow('Stock cannot go below zero');

    expect(await stockOf()).toBe(10);
    expect(await adjustmentRows()).toEqual([]);
  });
});
