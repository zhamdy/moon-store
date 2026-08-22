import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { parseTransferListQuery } from '../src/modules/core/branches/types';
import { BranchesController } from '../src/modules/core/branches/controller';
import { branchesService } from '../src/modules/core/branches/service';

describe('Branches HTTP contract', () => {
  it('strictly parses canonical transfer pagination and filtering', () => {
    expect(
      parseTransferListQuery({
        page: '2',
        pageSize: '50',
        status: 'completed',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })
    ).toEqual({
      page: 2,
      pageSize: 50,
      status: 'completed',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    expect(() => parseTransferListQuery({ limit: '20' })).toThrow();
    expect(() => parseTransferListQuery({ status: 'unknown' })).toThrow();
  });

  it('returns transfer rows with canonical pagination metadata', async () => {
    vi.spyOn(branchesService, 'listTransfers').mockResolvedValue({ rows: [], total: 0 });
    const json = vi.fn();

    await new BranchesController().getTransfers(
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
