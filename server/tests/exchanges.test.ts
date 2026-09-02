import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { Pool as PgPool } from 'pg';
import path from 'path';
import { createPgMemPool } from './support/pgMem';
import { setPool, closePool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import { parseExchangeListQuery } from '../src/modules/pos/exchanges/types';
import { ExchangesController } from '../src/modules/pos/exchanges/controller';
import {
  ExchangesService,
  ExchangeStockError,
  type IExchangesService,
} from '../src/modules/pos/exchanges/service';
import type { IExchangesRepository } from '../src/modules/pos/exchanges/repository';
import type { Queryable } from '../src/database/transaction';

/**
 * The controller wraps its mutation in `withIdempotency`, which opens a transaction on
 * the module pool before the (mocked) service ever runs. With no pool injected here that
 * resolves to a real PostgreSQL connection, which is why this file used to pass only on a
 * checkout that happened to have a working `server/.env` (issue #69).
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

describe('Exchanges list contract', () => {
  it('strictly parses canonical pagination, search, and sorting', () => {
    expect(
      parseExchangeListQuery({
        page: '2',
        pageSize: '50',
        search: 'EXC-2026',
        sortBy: 'difference',
        sortOrder: 'asc',
      })
    ).toEqual({
      page: 2,
      pageSize: 50,
      search: 'EXC-2026',
      sortBy: 'difference',
      sortOrder: 'asc',
    });
    expect(() => parseExchangeListQuery({ limit: '20' })).toThrow();
    expect(() => parseExchangeListQuery({ page: '0' })).toThrow();
  });

  it('returns canonical pagination metadata', async () => {
    const service = {
      listExchanges: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    } as unknown as IExchangesService;
    const json = vi.fn();

    await new ExchangesController(service).getExchanges(
      { query: { page: '2', pageSize: '10' } } as unknown as Request,
      { json } as unknown as Response,
      vi.fn()
    );

    expect(json).toHaveBeenCalledWith({
      data: [],
      meta: {
        pagination: {
          page: 2,
          pageSize: 10,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
    });
  });
});

describe('Exchange stock invariants', () => {
  const client = {} as Queryable;

  function fakeRepo(
    overrides: Partial<IExchangesRepository> = {}
  ): IExchangesRepository & { deducted: Array<{ productId: number; variantId: number | null }> } {
    const deducted: Array<{ productId: number; variantId: number | null }> = [];

    const repo = {
      findSaleById: vi.fn().mockResolvedValue({ id: 1, customer_id: null }),
      createExchange: vi.fn().mockResolvedValue({ id: 10, exchange_number: 'EXC-1' }),
      createReturnedItem: vi.fn().mockResolvedValue(undefined),
      createNewItem: vi.fn().mockResolvedValue(undefined),
      restockVariant: vi.fn().mockResolvedValue(undefined),
      restockProduct: vi.fn().mockResolvedValue(undefined),
      deductVariantStock: vi.fn(async (variantId: number) => {
        deducted.push({ productId: 0, variantId });
        return 1;
      }),
      deductProductStock: vi.fn(async (productId: number) => {
        deducted.push({ productId, variantId: null });
        return 1;
      }),
      listExchanges: vi.fn(),
      findById: vi.fn(),
      findReturnedItems: vi.fn(),
      findNewItems: vi.fn(),
      ...overrides,
    } as unknown as IExchangesRepository;

    return Object.assign(repo, { deducted });
  }

  function newItem(productId: number) {
    return { product_id: productId, quantity: 1, price: 10 };
  }

  const returnedItem = {
    product_id: 1,
    quantity: 1,
    price: 10,
    reason: 'size',
    condition: 'damaged' as const,
  };

  it('deducts new-item stock in canonical ascending order, not request order', async () => {
    const repo = fakeRepo();

    await new ExchangesService(repo).createExchange(
      {
        original_sale_id: 1,
        returned_items: [returnedItem],
        new_items: [newItem(9), newItem(3), newItem(6)],
      },
      1,
      client
    );

    // Two concurrent exchanges naming the same rows in opposite order would otherwise
    // lock them in opposite order and deadlock.
    expect(repo.deducted.map((d) => d.productId)).toEqual([3, 6, 9]);
  });

  it('raises a typed stock error when the guarded deduction matches nothing', async () => {
    const repo = fakeRepo({ deductProductStock: vi.fn().mockResolvedValue(null) });

    await expect(
      new ExchangesService(repo).createExchange(
        { original_sale_id: 1, returned_items: [returnedItem], new_items: [newItem(4)] },
        1,
        client
      )
    ).rejects.toMatchObject({
      name: 'ExchangeStockError',
      message: 'Insufficient stock for product ID 4',
      productId: 4,
    });
  });

  it('maps a stock error to a 400 rather than an unhandled 500', async () => {
    const service = {
      createExchange: vi
        .fn()
        .mockRejectedValue(new ExchangeStockError('Insufficient stock for product ID 4', 4, null)),
    } as unknown as IExchangesService;
    const next = vi.fn();

    await new ExchangesController(service).createExchange(
      {
        body: {
          original_sale_id: 1,
          returned_items: [{ ...returnedItem }],
          new_items: [newItem(4)],
        },
        user: { id: 1 },
        headers: {},
      } as unknown as Request,
      {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        setHeader: vi.fn(),
      } as unknown as Response,
      next
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        message: 'Insufficient stock for product ID 4',
      })
    );
  });
});
