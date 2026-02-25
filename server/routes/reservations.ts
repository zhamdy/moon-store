import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken } from '../middleware/auth';
import { z } from 'zod';
import logger from '../lib/logger';

const router: Router = Router();

const reserveSchema = z.object({
  product_id: z.number().int().positive(),
  variant_id: z.number().int().positive().optional().nullable(),
  quantity: z.number().int().positive(),
  source_type: z.enum(['cart', 'delivery', 'held']),
  source_id: z.string().optional(),
});

// POST /api/reservations
router.post('/', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = reserveSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const { product_id, variant_id, quantity, source_type, source_id } = parsed.data;

    // Calculate expiry based on source type
    const expiryMinutes = source_type === 'cart' ? 15 : source_type === 'held' ? 480 : 1440;

    const rawDb = db.db;

    // Check available stock
    let currentStock: number;
    if (variant_id) {
      const v = rawDb.prepare('SELECT stock FROM product_variants WHERE id = ?').get(variant_id) as
        | { stock: number }
        | undefined;
      currentStock = v?.stock || 0;
    } else {
      const p = rawDb.prepare('SELECT stock FROM products WHERE id = ?').get(product_id) as
        | { stock: number }
        | undefined;
      currentStock = p?.stock || 0;
    }

    // Get existing reservations
    const reserved = rawDb
      .prepare(
        "SELECT COALESCE(SUM(quantity), 0) as total FROM stock_reservations WHERE product_id = ? AND (variant_id IS ? OR variant_id = ?) AND expires_at > datetime('now')"
      )
      .get(product_id, variant_id || null, variant_id || null) as { total: number };

    const available = currentStock - reserved.total;
    if (available < quantity) {
      return res.status(400).json({ success: false, error: 'Insufficient available stock' });
    }

    const result = rawDb
      .prepare(
        `INSERT INTO stock_reservations (product_id, variant_id, quantity, source_type, source_id, expires_at)
         VALUES (?, ?, ?, ?, ?, datetime('now', '+${expiryMinutes} minutes')) RETURNING *`
      )
      .get(product_id, variant_id || null, quantity, source_type, source_id || null) as Record<
      string,
      any
    >;

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/reservations/:id
router.delete('/:id', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query('DELETE FROM stock_reservations WHERE id = ? RETURNING id', [
      req.params.id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reservation not found' });
    }
    res.json({ success: true, data: { message: 'Reservation released' } });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/reservations/source/:sourceId - Release all reservations for a source
router.delete(
  '/source/:sourceId',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawDb = db.db;
      const result = rawDb
        .prepare('DELETE FROM stock_reservations WHERE source_id = ?')
        .run(req.params.sourceId);
      res.json({ success: true, data: { released: result.changes } });
    } catch (err) {
      next(err);
    }
  }
);

// Cleanup expired reservations (called periodically)
export function cleanupExpiredReservations(): void {
  try {
    const rawDb = db.db;
    rawDb.prepare("DELETE FROM stock_reservations WHERE expires_at <= datetime('now')").run();
  } catch (err) {
    logger.error('Reservation cleanup failed', { error: (err as Error).message });
  }
}

export default router;
