import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../../middleware/auth';
import { notificationsService } from './service';
import { parseNotificationListQuery } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';

export class NotificationsController {
  async getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const query = parseNotificationListQuery(req.query);
      const { rows, total, unreadCount } = await notificationsService.list(authReq.user!.id, query);
      res.json(
        success(rows, {
          pagination: paginationMeta(query.page, query.pageSize, total),
          unreadCount,
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const count = await notificationsService.getUnreadCount(authReq.user!.id);
      res.json(success({ count }));
    } catch (err) {
      next(err);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      await notificationsService.markAsRead(req.params.id as string, authReq.user!.id);
      res.json(success({ read: true }));
    } catch (err) {
      next(err);
    }
  }

  async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      await notificationsService.markAllAsRead(authReq.user!.id);
      res.json(success({ readAll: true }));
    } catch (err) {
      next(err);
    }
  }
}

export const notificationsController = new NotificationsController();
