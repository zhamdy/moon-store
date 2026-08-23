import { describe, expect, it, vi, afterEach } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
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
