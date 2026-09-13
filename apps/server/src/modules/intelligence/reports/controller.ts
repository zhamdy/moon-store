import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { inventoryReportQuerySchema, profitLossQuerySchema, salesReportQuerySchema } from './types';
import { reportsRequestContracts } from './schemas';
import { reportsService } from './service';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = reportsRequestContracts;

export class ReportsController {
  async getSalesReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.getSalesReport.parseQuery<z.infer<typeof salesReportQuerySchema>>(
        req.query
      );
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
      const data = await reportsService.getInventoryReport(
        contracts.getInventoryReport.parseQuery<z.infer<typeof inventoryReportQuerySchema>>(
          req.query
        )
      );
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }

  async getProfitLossReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await reportsService.getProfitLossReport(
        contracts.getProfitLossReport.parseQuery<z.infer<typeof profitLossQuerySchema>>(req.query)
      );
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }
}

export const reportsController = new ReportsController();
