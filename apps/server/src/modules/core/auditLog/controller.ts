import { Request, Response, NextFunction } from 'express';
import { auditLogService } from './service';
import { auditLogRequestContracts } from './schemas';
import type { AuditLogFilters } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';

export class AuditLogController {
  async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = auditLogRequestContracts.listAuditLogs.parseQuery<AuditLogFilters>(req.query);
      const result = await auditLogService.list(query);
      res.json(
        success(result.logs, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async getActions(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await auditLogService.getActions();
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }

  async getEntityTypes(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(success(await auditLogService.getEntityTypes()));
    } catch (err) {
      next(err);
    }
  }
}

export const auditLogController = new AuditLogController();
