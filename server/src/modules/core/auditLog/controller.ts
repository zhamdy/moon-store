import { Request, Response, NextFunction } from 'express';
import { auditLogService } from './service';

export class AuditLogController {
  async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        userId,
        action,
        entityType,
        entityId,
        startDate,
        endDate,
        page = '1',
        limit = '50',
      } = req.query;

      const result = await auditLogService.list({
        userId: userId as string | undefined,
        action: action as string | undefined,
        entityType: entityType as string | undefined,
        entityId: entityId as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        page: Number(page),
        limit: Number(limit),
      });

      res.json({
        success: true,
        data: result.logs,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async getActions(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await auditLogService.getActions();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const auditLogController = new AuditLogController();
