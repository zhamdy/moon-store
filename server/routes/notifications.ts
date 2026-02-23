import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken, AuthRequest } from '../middleware/auth';

const router: Router = Router();

// GET /api/notifications
router.get('/', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const { limit = 50, unread_only } = req.query;

    let whereExtra = '';
    if (unread_only === 'true') {
      whereExtra = ' AND read = 0';
    }

    const notifications = await db.query(
      `SELECT * FROM notifications
         WHERE user_id = ?${whereExtra}
         ORDER BY created_at DESC
         LIMIT ?`,
      [authReq.user!.id, Number(limit)]
    );

    const unreadCount = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0`,
      [authReq.user!.id]
    );

    res.json({
      success: true,
      data: notifications.rows,
      meta: { unread_count: unreadCount.rows[0].count },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/notifications/unread-count
router.get(
  '/unread-count',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const result = await db.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0`,
        [authReq.user!.id]
      );
      res.json({ success: true, data: { count: result.rows[0].count } });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/notifications/:id/read
router.put('/:id/read', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    await db.query(`UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?`, [
      req.params.id,
      authReq.user!.id,
    ]);
    res.json({ success: true, data: { read: true } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    await db.query(`UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0`, [
      authReq.user!.id,
    ]);
    res.json({ success: true, data: { read_all: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
