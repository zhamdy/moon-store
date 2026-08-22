import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { parseSessionHistoryQuery } from '../src/modules/pos/register/types';
import { RegisterController } from '../src/modules/pos/register/controller';
import type { IRegisterService } from '../src/modules/pos/register/service';

describe('Register history contract', () => {
  it('strictly parses canonical pagination, filters, and sorting', () => {
    expect(
      parseSessionHistoryQuery({
        page: '2',
        pageSize: '50',
        cashierId: '7',
        from: '2026-08-01',
        to: '2026-08-22',
        sortBy: 'openedAt',
        sortOrder: 'desc',
      })
    ).toEqual({
      page: 2,
      pageSize: 50,
      cashierId: 7,
      from: '2026-08-01',
      to: '2026-08-22',
      sortBy: 'openedAt',
      sortOrder: 'desc',
    });
    expect(() => parseSessionHistoryQuery({ limit: '25' })).toThrow();
    expect(() => parseSessionHistoryQuery({ cashier_id: '7' })).toThrow();
  });

  it('returns canonical pagination metadata', async () => {
    const service = {
      getSessionHistory: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    } as unknown as IRegisterService;
    const json = vi.fn();

    await new RegisterController(service).getSessionHistory(
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
