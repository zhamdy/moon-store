import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { parseLayawayListQuery } from '../src/modules/pos/layaway/types';
import { LayawayController } from '../src/modules/pos/layaway/controller';
import type { ILayawayService } from '../src/modules/pos/layaway/service';

describe('Layaway list contract', () => {
  it('strictly parses canonical pagination, filters, and sorting', () => {
    expect(
      parseLayawayListQuery({
        page: '2',
        pageSize: '50',
        status: 'active',
        search: 'Sarah',
        sortBy: 'dueDate',
        sortOrder: 'asc',
      })
    ).toEqual({
      page: 2,
      pageSize: 50,
      status: 'active',
      search: 'Sarah',
      sortBy: 'dueDate',
      sortOrder: 'asc',
    });
    expect(() => parseLayawayListQuery({ limit: '20' })).toThrow();
    expect(() => parseLayawayListQuery({ status: 'overdue' })).toThrow();
  });

  it('returns canonical pagination metadata', async () => {
    const service = {
      listPlans: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    } as unknown as ILayawayService;
    const json = vi.fn();
    await new LayawayController(service).getPlans(
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
