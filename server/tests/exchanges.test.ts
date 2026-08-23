import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { parseExchangeListQuery } from '../src/modules/pos/exchanges/types';
import { ExchangesController } from '../src/modules/pos/exchanges/controller';
import type { IExchangesService } from '../src/modules/pos/exchanges/service';

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
