import { Router } from 'express';
import { verifyToken } from '../../../../middleware/auth';
import { notificationsController } from './controller';

const router: Router = Router();

// GET /api/notifications
router.get('/', verifyToken, (req, res, next) =>
  notificationsController.getNotifications(req, res, next)
);

// GET /api/notifications/unread-count
router.get('/unread-count', verifyToken, (req, res, next) =>
  notificationsController.getUnreadCount(req, res, next)
);

// PUT /api/notifications/:id/read
router.put('/:id/read', verifyToken, (req, res, next) =>
  notificationsController.markAsRead(req, res, next)
);

// PUT /api/notifications/read-all
router.put('/read-all', verifyToken, (req, res, next) =>
  notificationsController.markAllAsRead(req, res, next)
);

export default router;
