import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { stockCountsService } from './service';

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
      const { page = 1, limit = 20, status } = req.query;
      const pageNum = Number(page);
      const limitNum = Number(limit);

      const result = await stockCountsService.list({
        page: pageNum,
        limit: limitNum,
        status: status as string | undefined,
      });

      res.json({
        success: true,
        data: result.rows,
        meta: { total: result.total, page: pageNum, limit: limitNum },
      });
    } catch (err) {
      next(err);
    }
  }

  async createStockCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createStockCountSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const authReq = req as AuthRequest;
      const result = await stockCountsService.createCount(parsed.data, authReq.user!.id);

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      logAuditFromReq(req, 'create', 'stock_count', result.data!.id);
      res.status(201).json({ success: true, data: result.data });
    } catch (err) {
      next(err);
    }
  }

  async getStockCountById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stockCount = await stockCountsService.findById(req.params.id as string);
      if (!stockCount) {
        res.status(404).json({ success: false, error: 'Stock count not found' });
        return;
      }

      res.json({ success: true, data: stockCount });
    } catch (err) {
      next(err);
    }
  }

  async updateCountItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = updateCountItemSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const result = await stockCountsService.updateCountItem(
        req.params.id as string,
        req.params.itemId as string,
        parsed.data
      );

      if (!result.success) {
        const statusCode = result.error === 'Count item not found' ? 404 : 400;
        res.status(statusCode).json({ success: false, error: result.error });
        return;
      }

      res.json({ success: true, data: result.data });
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
        res.status(result.status || 400).json({ success: false, error: result.error });
        return;
      }

      logAuditFromReq(req, 'complete', 'stock_count', req.params.id as string, {
        appliedAdjustments: apply_adjustments,
      });

      res.json({ success: true, data: { status: 'completed' } });
    } catch (err) {
      next(err);
    }
  }

  async cancelStockCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await stockCountsService.cancelCount(req.params.id as string);
      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      logAuditFromReq(req, 'cancel', 'stock_count', req.params.id as string);
      res.json({ success: true, data: { status: 'cancelled' } });
    } catch (err) {
      next(err);
    }
  }
}

export const stockCountsController = new StockCountsController();
