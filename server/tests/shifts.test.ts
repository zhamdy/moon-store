import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { parseShiftListQuery } from '../src/modules/pos/shifts/types';
import { ShiftsController } from '../src/modules/pos/shifts/controller';
import type { IShiftsService } from '../src/modules/pos/shifts/service';

describe('Shifts list contract', () => {
  it('strictly parses canonical pagination and filters', () => {
    expect(
      parseShiftListQuery({
        page: '2',
        pageSize: '50',
        userId: '7',
        status: 'completed',
        sortBy: 'clockIn',
        sortOrder: 'desc',
      })
    ).toEqual({
      page: 2,
      pageSize: 50,
      userId: 7,
      status: 'completed',
      sortBy: 'clockIn',
      sortOrder: 'desc',
    });
    expect(() => parseShiftListQuery({ limit: '20' })).toThrow();
    expect(() => parseShiftListQuery({ user_id: '7' })).toThrow();
  });

  it('returns canonical pagination metadata', async () => {
    const service = {
      listShifts: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    } as unknown as IShiftsService;
    const json = vi.fn();

    await new ShiftsController(service).getShifts(
      {
        user: { id: 1, role: 'Admin' },
        query: { page: '2', pageSize: '10' },
      } as unknown as Request,
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
