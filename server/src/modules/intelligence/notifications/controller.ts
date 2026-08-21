import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../../middleware/auth';
import { notificationsService } from './service';

export class NotificationsController {
  async getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const { limit, unread_only } = req.query;

      const { rows, unreadCount } = await notificationsService.list(authReq.user!.id, {
        limit: limit as string | undefined,
        unread_only: unread_only as string | undefined,
      });

      res.json({
        success: true,
        data: rows,
        meta: { unread_count: unreadCount },
      });
    } catch (err) {
      next(err);
    }
  }

  async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const count = await notificationsService.getUnreadCount(authReq.user!.id);
      res.json({ success: true, data: { count } });
    } catch (err) {
      next(err);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      await notificationsService.markAsRead(req.params.id as string, authReq.user!.id);
      res.json({ success: true, data: { read: true } });
    } catch (err) {
      next(err);
    }
  }

  async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      await notificationsService.markAllAsRead(authReq.user!.id);
      res.json({ success: true, data: { read_all: true } });
    } catch (err) {
      next(err);
    }
  }
}

export const notificationsController = new NotificationsController();
