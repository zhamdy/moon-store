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

  describe('DELETE /branches/:id', () => {
    it('refuses to delete the main branch with a 409, not a 200', async () => {
      vi.spyOn(branchesService, 'delete').mockRejectedValue(
        new PublicError('CONFLICT', 'Cannot delete the main branch')
      );
      const next = vi.fn();

      await new BranchesController().deleteBranch(
        { params: { id: '1' } } as unknown as Request,
        { status: vi.fn().mockReturnThis(), send: vi.fn() } as unknown as Response,
        next
      );

      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.code).toBe('CONFLICT');
    });

    it('sends a bare 204 once the service confirms the delete', async () => {
      vi.spyOn(branchesService, 'delete').mockResolvedValue(undefined);
      const send = vi.fn();
      const status = vi.fn().mockReturnValue({ send });

      await new BranchesController().deleteBranch(
        { params: { id: '7' } } as unknown as Request,
        { status } as unknown as Response,
        vi.fn()
      );

      expect(status).toHaveBeenCalledWith(204);
      expect(send).toHaveBeenCalled();
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

    it('deletes the branch row and reports whether one existed', async () => {
      const query = vi.fn().mockResolvedValue({ rows: [{ id: 5 }] });
      const deleted = await new BranchesRepository().delete(5, { query } as unknown as Queryable);
      expect(deleted).toBe(true);
      expect(query.mock.calls[0][0]).toContain('DELETE FROM branches');
    });
  });
});
