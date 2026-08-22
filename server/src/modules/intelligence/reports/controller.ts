import { Request, Response, NextFunction } from 'express';
import { reportsService } from './service';
import { parseInventoryReportQuery, parseProfitLossQuery, parseSalesReportQuery } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';

export class ReportsController {
  async getSalesReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseSalesReportQuery(req.query);
      const result = await reportsService.getSalesReport(query);
      res.json(
        success(result.data, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async getInventoryReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await reportsService.getInventoryReport(parseInventoryReportQuery(req.query));
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }

  async getProfitLossReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await reportsService.getProfitLossReport(parseProfitLossQuery(req.query));
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }
}

export const reportsController = new ReportsController();
