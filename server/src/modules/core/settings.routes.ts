import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../../database/pool';
import { withTransaction } from '../../database/transaction';
import { verifyToken, requireRole } from '../../../middleware/auth';

const router: Router = Router();

// GET /api/settings
router.get('/', verifyToken, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query<{ key: string; value: string }>(
      'SELECT key, value FROM settings'
    );
    const settings: Record<string, string> = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings
const updateSettingsSchema = z.record(z.string(), z.string());

router.put(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Invalid settings format' });
      }

      await withTransaction(async (client) => {
        for (const [key, value] of Object.entries(parsed.data)) {
          await client.query(
            `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
             ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [key, value]
          );
        }
      });

      // Return updated settings
      const result = await db.query<{ key: string; value: string }>(
        'SELECT key, value FROM settings'
      );
      const settings: Record<string, string> = {};
      for (const row of result.rows) {
        settings[row.key] = row.value;
      }

      res.json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
