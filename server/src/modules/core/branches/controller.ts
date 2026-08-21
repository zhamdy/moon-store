import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { branchesService } from './service';

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
      res.json({ success: true, data: branches });
    } catch (err) {
      next(err);
    }
  }

  async createBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = branchSchema.parse(req.body);
      const branch = await branchesService.create(parsed);
      logAuditFromReq(req, 'create', 'branch', branch.id, { name: parsed.name });
      res.status(201).json({ success: true, data: branch });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      if (
        err.code === '23505' ||
        err.message?.includes('UNIQUE') ||
        err.message?.includes('duplicate key')
      ) {
        res.status(409).json({ success: false, error: 'Branch code already exists' });
        return;
      }
      if (err.statusCode) {
        res.status(err.statusCode).json({ success: false, error: err.message });
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
      res.json({ success: true, data: branch });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      if (
        err.code === '23505' ||
        err.message?.includes('UNIQUE') ||
        err.message?.includes('duplicate key')
      ) {
        res.status(409).json({ success: false, error: 'Branch code already exists' });
        return;
      }
      if (err.statusCode) {
        res.status(err.statusCode).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }

  async getConsolidated(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await branchesService.getConsolidated();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getTransfers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, page = '1', limit = '20' } = req.query;
      const transfers = await branchesService.listTransfers({
        status: status as string | undefined,
        page: Number(page),
        limit: Number(limit),
      });
      res.json({ success: true, data: transfers });
    } catch (err) {
      next(err);
    }
  }

  async createTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const parsed = transferSchema.parse(req.body);
      const transfer = await branchesService.createTransfer(parsed, authReq.user!.id);
      res.status(201).json({ success: true, data: transfer });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      if (err.statusCode) {
        res.status(err.statusCode).json({ success: false, error: err.message });
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
      res.json({ success: true, data: result });
    } catch (err: any) {
      if (err.statusCode) {
        res.status(err.statusCode).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }
}

export const branchesController = new BranchesController();
