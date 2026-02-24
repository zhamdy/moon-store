import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router: Router = Router();

const locationSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional().nullable(),
  type: z.enum(['Store', 'Warehouse']).default('Store'),
});

const transferSchema = z.object({
  from_location_id: z.number().int().positive(),
  to_location_id: z.number().int().positive(),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
  notes: z.string().optional().nullable(),
});

// GET /api/locations
router.get('/', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query("SELECT * FROM locations WHERE status = 'active' ORDER BY name");
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/locations
router.post(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = locationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }
      const { name, address, type } = parsed.data;
      const result = await db.query(
        'INSERT INTO locations (name, address, type) VALUES (?, ?, ?) RETURNING *',
        [name, address || null, type]
      );
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/locations/:id
router.put(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = locationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }
      const { name, address, type } = parsed.data;
      const result = await db.query(
        'UPDATE locations SET name = ?, address = ?, type = ? WHERE id = ? RETURNING *',
        [name, address || null, type, req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Location not found' });
      }
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/locations/transfers
router.post(
  '/transfers',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const parsed = transferSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { from_location_id, to_location_id, items, notes } = parsed.data;
      if (from_location_id === to_location_id) {
        return res
          .status(400)
          .json({ success: false, error: 'Cannot transfer to the same location' });
      }

      const rawDb = db.db;
      const txn = rawDb.transaction(() => {
        const transfer = rawDb
          .prepare(
            'INSERT INTO stock_transfers (from_location_id, to_location_id, status, notes, user_id) VALUES (?, ?, ?, ?, ?) RETURNING *'
          )
          .get(
            from_location_id,
            to_location_id,
            'completed',
            notes || null,
            authReq.user!.id
          ) as Record<string, any>;

        for (const item of items) {
          rawDb
            .prepare(
              'INSERT INTO stock_transfer_items (transfer_id, product_id, quantity) VALUES (?, ?, ?)'
            )
            .run(transfer.id, item.product_id, item.quantity);

          // Deduct from source
          const fromStock = rawDb
            .prepare('SELECT stock FROM product_locations WHERE product_id = ? AND location_id = ?')
            .get(item.product_id, from_location_id) as { stock: number } | undefined;

          if (!fromStock || fromStock.stock < item.quantity) {
            throw new Error(`Insufficient stock at source for product ${item.product_id}`);
          }

          rawDb
            .prepare(
              'UPDATE product_locations SET stock = stock - ? WHERE product_id = ? AND location_id = ?'
            )
            .run(item.quantity, item.product_id, from_location_id);

          // Add to destination (upsert)
          rawDb
            .prepare(
              'INSERT INTO product_locations (product_id, location_id, stock) VALUES (?, ?, ?) ON CONFLICT(product_id, location_id) DO UPDATE SET stock = stock + ?'
            )
            .run(item.product_id, to_location_id, item.quantity, item.quantity);
        }

        rawDb
          .prepare("UPDATE stock_transfers SET completed_at = datetime('now') WHERE id = ?")
          .run(transfer.id);
        return transfer;
      });

      try {
        const transfer = txn();
        res.status(201).json({ success: true, data: transfer });
      } catch (err: any) {
        return res.status(400).json({ success: false, error: err.message });
      }
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/locations/transfers
router.get(
  '/transfers',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT t.*, fl.name as from_location_name, tl.name as to_location_name, u.name as user_name
         FROM stock_transfers t
         LEFT JOIN locations fl ON t.from_location_id = fl.id
         LEFT JOIN locations tl ON t.to_location_id = tl.id
         LEFT JOIN users u ON t.user_id = u.id
         ORDER BY t.created_at DESC LIMIT 100`
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
