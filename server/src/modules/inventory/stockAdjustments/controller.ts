import { Request, Response, NextFunction } from 'express';
import { stockAdjustmentsService } from './service';

export class StockAdjustmentsController {
  async getStockAdjustments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 50 } = req.query;
      const pageNum = Number(page);
      const limitNum = Number(limit);

      const result = await stockAdjustmentsService.list({
        page: pageNum,
        limit: limitNum,
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
}

export const stockAdjustmentsController = new StockAdjustmentsController();
