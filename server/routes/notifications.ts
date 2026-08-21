import { Router, Request, Response, NextFunction } from 'express';
import db from '../src/database/pool';
import { verifyToken, AuthRequest } from '../middleware/auth';

const router: Router = Router();

// GET /api/notifications
router.get('/', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const { limit = 50, unread_only } = req.query;

    let query = 'SELECT * FROM notifications WHERE user_id = $1';
    const params: unknown[] = [authReq.user!.id];

    if (unread_only === 'true') {
      query += ' AND read = 0';
    }

    params.push(Number(limit));
    query += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const notifications = await db.query(query, params);

    const unreadCount = await db.query<{ count: string | number }>(
      `SELECT COUNT(*)::int as count FROM notifications WHERE user_id = $1 AND read = 0`,
      [authReq.user!.id]
    );

    res.json({
      success: true,
      data: notifications.rows,
      meta: { unread_count: Number(unreadCount.rows[0].count) },
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
      const result = await db.query<{ count: string | number }>(
        `SELECT COUNT(*)::int as count FROM notifications WHERE user_id = $1 AND read = 0`,
        [authReq.user!.id]
      );
      res.json({ success: true, data: { count: Number(result.rows[0].count) } });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/notifications/:id/read
router.put('/:id/read', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    await db.query(`UPDATE notifications SET read = 1 WHERE id = $1 AND user_id = $2`, [
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
    await db.query(`UPDATE notifications SET read = 1 WHERE user_id = $1 AND read = 0`, [
      authReq.user!.id,
    ]);
    res.json({ success: true, data: { read_all: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
