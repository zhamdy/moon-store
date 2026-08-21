import { Request, Response, NextFunction } from 'express';
import { exportsService } from './service';

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
      const { from, to } = req.query;
      const { csv, filename } = await exportsService.exportSales({ from, to });
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
