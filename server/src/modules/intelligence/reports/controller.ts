import { Request, Response, NextFunction } from 'express';
import { reportsService } from './service';

export class ReportsController {
  async getSalesReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to, groupBy, cashierId, paymentMethod, page, limit } = req.query;
      const result = await reportsService.getSalesReport({
        from,
        to,
        groupBy: groupBy as string | undefined,
        cashierId,
        paymentMethod,
        page: page as string | undefined,
        limit: limit as string | undefined,
      });
      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  }

  async getInventoryReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { categoryId, distributorId, lowStockOnly } = req.query;
      const data = await reportsService.getInventoryReport({
        categoryId,
        distributorId,
        lowStockOnly: lowStockOnly as string | undefined,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getProfitLossReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = req.query;
      const data = await reportsService.getProfitLossReport({ from, to });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const reportsController = new ReportsController();
