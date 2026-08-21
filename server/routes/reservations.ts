import { Router, Request, Response, NextFunction } from 'express';
import db from '../src/database/pool';
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

    // Check available stock
    let currentStock: number;
    if (variant_id) {
      const v = await db.query<{ stock: number }>(
        'SELECT stock FROM product_variants WHERE id = $1',
        [variant_id]
      );
      currentStock = Number(v.rows[0]?.stock || 0);
    } else {
      const p = await db.query<{ stock: number }>('SELECT stock FROM products WHERE id = $1', [
        product_id,
      ]);
      currentStock = Number(p.rows[0]?.stock || 0);
    }

    // Get existing reservations
    const reservedRes = variant_id
      ? await db.query<{ total: string | number }>(
          `SELECT COALESCE(SUM(quantity), 0) as total
           FROM stock_reservations
           WHERE product_id = $1 AND variant_id = $2 AND expires_at > NOW()`,
          [product_id, variant_id]
        )
      : await db.query<{ total: string | number }>(
          `SELECT COALESCE(SUM(quantity), 0) as total
           FROM stock_reservations
           WHERE product_id = $1 AND variant_id IS NULL AND expires_at > NOW()`,
          [product_id]
        );

    const reservedTotal = Number(reservedRes.rows[0]?.total || 0);
    const available = currentStock - reservedTotal;
    if (available < quantity) {
      return res.status(400).json({ success: false, error: 'Insufficient available stock' });
    }

    const result = await db.query(
      `INSERT INTO stock_reservations (product_id, variant_id, quantity, source_type, source_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '${expiryMinutes} minutes')
       RETURNING *`,
      [product_id, variant_id || null, quantity, source_type, source_id || null]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/reservations/:id
router.delete('/:id', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query('DELETE FROM stock_reservations WHERE id = $1 RETURNING id', [
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
      const result = await db.query(
        'DELETE FROM stock_reservations WHERE source_id = $1 RETURNING id',
        [req.params.sourceId]
      );
      res.json({ success: true, data: { released: result.rowCount || 0 } });
    } catch (err) {
      next(err);
    }
  }
);

// Cleanup expired reservations (called periodically)
export async function cleanupExpiredReservations(): Promise<void> {
  try {
    const result = await db.query('DELETE FROM stock_reservations WHERE expires_at <= NOW()');
    if ((result.rowCount ?? 0) > 0) {
      logger.info('Cleaned up expired reservations', { count: result.rowCount });
    }
  } catch (err) {
    logger.error('Reservation cleanup failed', { error: (err as Error).message });
  }
}

export default router;
