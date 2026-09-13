import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { Queryable } from '../src/database/transaction';
import { PublicError } from '../src/http/errors';
import { parseTransferListQuery } from '../src/modules/core/branches/types';
import { BranchesController } from '../src/modules/core/branches/controller';
import { BranchesRepository } from '../src/modules/core/branches/repository';
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

  describe('POST /branches/:id/deactivate', () => {
    it('passes the service refusal for the main branch through as a 409', async () => {
      vi.spyOn(branchesService, 'deactivate').mockRejectedValue(
        new PublicError('CONFLICT', 'Cannot deactivate the main branch')
      );
      const next = vi.fn();

      await new BranchesController().deactivateBranch(
        { params: { id: '1' } } as unknown as Request,
        { json: vi.fn() } as unknown as Response,
        next
      );

      expect(next.mock.calls[0][0].code).toBe('CONFLICT');
    });

    it('returns the deactivated branch under the canonical envelope', async () => {
      const branch = { id: 7, name: 'Zamalek', code: 'ZMLK', is_main: 0, status: 'inactive' };
      vi.spyOn(branchesService, 'deactivate').mockResolvedValue(branch);
      const json = vi.fn();

      await new BranchesController().deactivateBranch(
        { params: { id: '7' } } as unknown as Request,
        { json } as unknown as Response,
        vi.fn()
      );

      expect(branchesService.deactivate).toHaveBeenCalledWith(7);
      expect(json).toHaveBeenCalledWith({ data: branch });
    });
  });

  describe('PUT /branches/:id/settings', () => {
    it('stores the value the service returns under the canonical envelope', async () => {
      vi.spyOn(branchesService, 'updateSetting').mockResolvedValue({
        id: 3,
        setting_key: 'receipt_footer',
        setting_value: 'Thank you!',
      });
      const json = vi.fn();

      await new BranchesController().updateBranchSetting(
        {
          params: { id: '3' },
          body: { setting_key: 'receipt_footer', setting_value: 'Thank you!' },
        } as unknown as Request,
        { json } as unknown as Response,
        vi.fn()
      );

      expect(branchesService.updateSetting).toHaveBeenCalledWith(3, 'receipt_footer', 'Thank you!');
      expect(json).toHaveBeenCalledWith({
        data: { id: 3, setting_key: 'receipt_footer', setting_value: 'Thank you!' },
      });
    });

    it('rejects a setting_key the store settings dialog does not offer', async () => {
      const next = vi.fn();

      await new BranchesController().updateBranchSetting(
        {
          params: { id: '3' },
          body: { setting_key: 'not_a_real_setting', setting_value: 'x' },
        } as unknown as Request,
        { json: vi.fn() } as unknown as Response,
        next
      );

      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].name).toBe('ZodError');
    });
  });

  describe('BranchesRepository per-branch settings', () => {
    it('namespaces the write under branch_<id>_<key>, never the bare settings key', async () => {
      const query = vi.fn().mockResolvedValue({ rows: [] });

      await new BranchesRepository().upsertSetting(5, 'receipt_footer', 'Thanks!', {
        query,
      } as unknown as Queryable);

      expect(query.mock.calls[0][0]).toContain('INSERT INTO settings');
      expect(query.mock.calls[0][1]).toEqual(['branch_5_receipt_footer', 'Thanks!']);
    });

    it('deactivates with an UPDATE, never a DELETE', async () => {
      const query = vi.fn().mockResolvedValue({ rows: [{ id: 5, status: 'inactive' }] });
      const branch = await new BranchesRepository().deactivate(5, {
        query,
      } as unknown as Queryable);
      expect(branch).toEqual({ id: 5, status: 'inactive' });
      expect(query.mock.calls[0][0]).toContain("SET status = 'inactive'");
      expect(query.mock.calls[0][0]).not.toContain('DELETE');
    });
  });
});
