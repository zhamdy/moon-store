import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { branchesService } from './service';
import { PublicError } from '../../../http/errors';
import { paginationMeta } from '../../../http/pagination';
import { success } from '../../../http/responses';
import { parseTransferListQuery } from './types';
import { isUniqueViolation } from '../../../database/constraintErrors';

const branchSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20),
  address: z.string().max(255).optional(),
  phone: z.string().max(30).optional(),
  is_main: z.boolean().optional(),
});

const transferSchema = z.object({
  source_branch_id: z.number().int().positive(),
  target_branch_id: z.number().int().positive(),
  product_id: z.number().int().positive(),
  variant_id: z.number().int().positive().optional().nullable(),
  quantity: z.number().int().positive(),
  notes: z.string().max(255).optional(),
});

export class BranchesController {
  async getBranches(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branches = await branchesService.list();
      res.json(success(branches));
    } catch (err) {
      next(err);
    }
  }

  async createBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = branchSchema.parse(req.body);
      const branch = await branchesService.create(parsed);
      logAuditFromReq(req, 'create', 'branch', branch.id, { name: parsed.name });
      res.status(201).json(success(branch));
    } catch (err: any) {
      if (err.name === 'ZodError') {
        next(err);
        return;
      }
      if (isUniqueViolation(err)) {
        next(new PublicError('CONFLICT', 'Branch code already exists'));
        return;
      }
      if (err.statusCode) {
        next(
          new PublicError(err.statusCode === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', err.message)
        );
        return;
      }
      next(err);
    }
  }

  async updateBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = branchSchema.parse(req.body);
      const id = Number(req.params.id);
      const branch = await branchesService.update(id, parsed);
      res.json(success(branch));
    } catch (err: any) {
      if (err.name === 'ZodError') {
        next(err);
        return;
      }
      if (isUniqueViolation(err)) {
        next(new PublicError('CONFLICT', 'Branch code already exists'));
        return;
      }
      if (err.statusCode) {
        next(
          new PublicError(err.statusCode === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', err.message)
        );
        return;
      }
      next(err);
    }
  }

  async getConsolidated(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await branchesService.getConsolidated();
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }

  async getTransfers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseTransferListQuery(req.query);
      const transfers = await branchesService.listTransfers(query);
      res.json(
        success(transfers.rows, {
          pagination: paginationMeta(query.page, query.pageSize, transfers.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async createTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const parsed = transferSchema.parse(req.body);
      const transfer = await branchesService.createTransfer(parsed, authReq.user!.id);
      res.status(201).json(success(transfer));
    } catch (err: any) {
      if (err.name === 'ZodError') {
        next(err);
        return;
      }
      if (err.statusCode) {
        next(
          new PublicError(err.statusCode === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', err.message)
        );
        return;
      }
      next(err);
    }
  }

  async updateTransferStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      const { status } = req.body;
      const result = await branchesService.updateTransferStatus(id, status);
      res.json(success(result));
    } catch (err: any) {
      if (err.statusCode) {
        next(
          new PublicError(err.statusCode === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', err.message)
        );
        return;
      }
      next(err);
    }
  }
}

export const branchesController = new BranchesController();
