import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { exportSalesQuerySchema } from './types';
import { exportsRequestContracts } from './schemas';
import { exportsService } from './service';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = exportsRequestContracts;

export class ExportsController {
  async exportProducts(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { csv, filename } = await exportsService.exportProducts();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.send(csv);
    } catch (err) {
      next(err);
    }
  }

  async exportSales(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { csv, filename } = await exportsService.exportSales(
        contracts.exportSales.parseQuery<z.infer<typeof exportSalesQuerySchema>>(req.query)
      );
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.send(csv);
    } catch (err) {
      next(err);
    }
  }

  async exportCustomers(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { csv, filename } = await exportsService.exportCustomers();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.send(csv);
    } catch (err) {
      next(err);
    }
  }
}

export const exportsController = new ExportsController();
