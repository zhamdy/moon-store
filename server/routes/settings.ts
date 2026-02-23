import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../db';
import { verifyToken, requireRole } from '../middleware/auth';

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
const updateSettingsSchema = z.object({
  tax_enabled: z.enum(['true', 'false']).optional(),
  tax_rate: z.string().optional(),
  tax_mode: z.enum(['inclusive', 'exclusive']).optional(),
  loyalty_enabled: z.enum(['true', 'false']).optional(),
  loyalty_earn_rate: z.string().optional(),
  loyalty_redeem_value: z.string().optional(),
});

router.put(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const rawDb = db.db;
      const upsert = rawDb.prepare(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')"
      );

      const txn = rawDb.transaction(() => {
        for (const [key, value] of Object.entries(parsed.data)) {
          if (value !== undefined) {
            upsert.run(key, value, value);
          }
        }
      });

      txn();

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
