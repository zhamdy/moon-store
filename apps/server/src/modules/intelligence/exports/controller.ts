import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CsvExportResult, exportSalesQuerySchema } from './types';
import { exportsRequestContracts } from './schemas';
import { exportsService } from './service';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = exportsRequestContracts;

/** The BOM is what makes Excel read the file as UTF-8 rather than the system code page. */
function sendCsv(res: Response, { csv, filename }: CsvExportResult): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.send(`\uFEFF${csv}`);
}

export class ExportsController {
  async exportProducts(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendCsv(res, await exportsService.exportProducts());
    } catch (err) {
      next(err);
    }
  }

  async exportSales(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = contracts.exportSales.parseQuery<z.infer<typeof exportSalesQuerySchema>>(
        req.query
      );
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${exportsService.salesExportFilename()}`
      );
      for await (const chunk of exportsService.exportSalesChunks(filters)) {
        res.write(chunk);
      }
      res.end();
    } catch (err) {
      // Headers (and possibly rows) may already be on the wire once streaming starts, so the
      // response can no longer carry an error status — end the connection rather than hang it.
      if (res.headersSent) {
        res.end();
      } else {
        next(err);
      }
    }
  }

  async exportCustomers(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendCsv(res, await exportsService.exportCustomers());
    } catch (err) {
      next(err);
    }
  }
}

export const exportsController = new ExportsController();
