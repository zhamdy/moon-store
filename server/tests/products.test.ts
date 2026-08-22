import { describe, expect, it, vi } from 'vitest';
import { ProductsController } from '../src/modules/inventory/products/controller';
import {
  parseProductListQuery,
  parseProductLookupQuery,
} from '../src/modules/inventory/products/types';
import { productsRepository } from '../src/modules/inventory/products/repository';
import { productsService } from '../src/modules/inventory/products/service';

function response() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.send = vi.fn(() => res);
  return res;
}

describe('product collection query contract', () => {
  it('normalizes canonical defaults and temporary legacy limit', () => {
    expect(parseProductListQuery({})).toMatchObject({
      page: 1,
      pageSize: 25,
      sortBy: 'name',
      sortOrder: 'asc',
    });
    expect(parseProductListQuery({ limit: '500' }).pageSize).toBe(500);
    expect(() => parseProductListQuery({ pageSize: '200' })).toThrow();
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
      .mockRejectedValue(new Error('duplicate key value'));
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
