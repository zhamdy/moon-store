import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { stockCountsService } from './service';
import { parseStockCountListQuery } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

const createStockCountSchema = z.object({
  category_id: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
});

const updateCountItemSchema = z.object({
  counted_qty: z.number().int().min(0),
  notes: z.string().max(255).optional(),
});

export class StockCountsController {
  async getStockCounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseStockCountListQuery(req.query);
      const result = await stockCountsService.list(query);
      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async createStockCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createStockCountSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const authReq = req as AuthRequest;
      const result = await stockCountsService.createCount(parsed.data, authReq.user!.id);

      if (!result.success) {
        throw new PublicError('VALIDATION_ERROR', result.error);
      }

      logAuditFromReq(req, 'create', 'stock_count', result.data!.id);
      res.status(201).json(success(result.data));
    } catch (err) {
      next(err);
    }
  }

  async getStockCountById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stockCount = await stockCountsService.findById(req.params.id as string);
      if (!stockCount) {
        throw new PublicError('NOT_FOUND', 'Stock count not found');
      }

      res.json(success(stockCount));
    } catch (err) {
      next(err);
    }
  }

  async updateCountItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = updateCountItemSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const result = await stockCountsService.updateCountItem(
        req.params.id as string,
        req.params.itemId as string,
        parsed.data
      );

      if (!result.success) {
        const code = result.error === 'Count item not found' ? 'NOT_FOUND' : 'VALIDATION_ERROR';
        throw new PublicError(code, result.error);
      }

      res.json(success(result.data));
    } catch (err) {
      next(err);
    }
  }

  async completeStockCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const { apply_adjustments = true } = req.body;

      const result = await stockCountsService.completeCount(
        req.params.id as string,
        authReq.user!.id,
        apply_adjustments
      );

      if (!result.success) {
        const code = result.status === 404 ? 'NOT_FOUND' : 'CONFLICT';
        throw new PublicError(code, result.error);
      }

      logAuditFromReq(req, 'complete', 'stock_count', req.params.id as string, {
        appliedAdjustments: apply_adjustments,
      });

      res.json(success({ status: 'completed' }));
    } catch (err) {
      next(err);
    }
  }

  async cancelStockCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await stockCountsService.cancelCount(req.params.id as string);
      if (!result.success) {
        throw new PublicError('CONFLICT', result.error);
      }

      logAuditFromReq(req, 'cancel', 'stock_count', req.params.id as string);
      res.json(success({ status: 'cancelled' }));
    } catch (err) {
      next(err);
    }
  }
}

export const stockCountsController = new StockCountsController();
