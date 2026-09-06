import { Request, Response, NextFunction } from 'express';
import { stockAdjustmentsService } from './service';
import { stockAdjustmentsRequestContracts } from './schemas';
import type { StockAdjustmentFilters } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';

export class StockAdjustmentsController {
  async getStockAdjustments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query =
        stockAdjustmentsRequestContracts.listStockAdjustments.parseQuery<StockAdjustmentFilters>(
          req.query
        );
      const result = await stockAdjustmentsService.list(query);
      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }
}

export const stockAdjustmentsController = new StockAdjustmentsController();
