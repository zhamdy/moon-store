import { Request, Response, NextFunction } from 'express';
import { stockAdjustmentsService } from './service';
import { parseStockAdjustmentListQuery } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';

export class StockAdjustmentsController {
  async getStockAdjustments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseStockAdjustmentListQuery(req.query);
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
