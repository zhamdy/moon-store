import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../db';
import { verifyToken, requireRole } from '../middleware/auth';

const router: Router = Router();

// --- Zod Schemas ---

const bundleItemSchema = z.object({
  product_id: z.number().int().positive(),
  variant_id: z.number().int().positive().optional().nullable(),
  quantity: z.number().int().positive('Quantity must be at least 1'),
});

const bundleSchema = z.object({
  name: z.string().min(1, 'Bundle name required').max(255),
  description: z.string().optional().nullable(),
  price: z.number().positive('Price must be positive'),
  status: z.enum(['active', 'inactive']).default('active'),
  items: z.array(bundleItemSchema).min(1, 'At least one item required'),
});

// --- Routes ---

// GET /api/bundles
router.get(
  '/',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bundles = (await db.query(`SELECT b.* FROM bundles b ORDER BY b.created_at DESC`))
        .rows as Record<string, any>[];

      // Fetch items for each bundle and compute savings
      for (const bundle of bundles) {
        const items = (
          await db.query(
            `SELECT bi.*, p.name as product_name, p.price as product_price
             FROM bundle_items bi
             JOIN products p ON bi.product_id = p.id
             WHERE bi.bundle_id = ?`,
            [bundle.id]
          )
        ).rows as Record<string, any>[];

        const originalPrice = items.reduce(
          (sum: number, item: Record<string, any>) => sum + item.product_price * item.quantity,
          0
        );
        const savings = originalPrice - bundle.price;
        const savingsPercent = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;

        bundle.items = items;
        bundle.original_price = originalPrice;
        bundle.savings = savings;
        bundle.savings_percent = savingsPercent;
      }

      res.json({ success: true, data: bundles });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/bundles/:id
router.get(
  '/:id',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(`SELECT b.* FROM bundles b WHERE b.id = ?`, [req.params.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Bundle not found' });
      }

      const bundle = result.rows[0] as Record<string, any>;

      const items = (
        await db.query(
          `SELECT bi.*, p.name as product_name, p.price as product_price
           FROM bundle_items bi
           JOIN products p ON bi.product_id = p.id
           WHERE bi.bundle_id = ?`,
          [req.params.id]
        )
      ).rows as Record<string, any>[];

      const originalPrice = items.reduce(
        (sum: number, item: Record<string, any>) => sum + item.product_price * item.quantity,
        0
      );
      const savings = originalPrice - bundle.price;
      const savingsPercent = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;

      res.json({
        success: true,
        data: {
          ...bundle,
          items,
          original_price: originalPrice,
          savings,
          savings_percent: savingsPercent,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/bundles
router.post(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = bundleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { name, description, price, status, items } = parsed.data;

      const rawDb = db.db;
      const txn = rawDb.transaction(() => {
        const bundle = rawDb
          .prepare(
            `INSERT INTO bundles (name, description, price, status)
             VALUES (?, ?, ?, ?) RETURNING *`
          )
          .get(name, description || null, price, status) as Record<string, any>;

        for (const item of items) {
          rawDb
            .prepare(
              `INSERT INTO bundle_items (bundle_id, product_id, variant_id, quantity)
               VALUES (?, ?, ?, ?)`
            )
            .run(bundle.id, item.product_id, item.variant_id || null, item.quantity);
        }

        return bundle;
      });

      const bundle = txn();
      res.status(201).json({ success: true, data: bundle });
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) {
        return res.status(409).json({ success: false, error: 'Bundle name already exists' });
      }
      next(err);
    }
  }
);

// PUT /api/bundles/:id
router.put(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = bundleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { name, description, price, status, items } = parsed.data;

      const rawDb = db.db;
      const txn = rawDb.transaction(() => {
        const bundle = rawDb
          .prepare(
            `UPDATE bundles SET name=?, description=?, price=?, status=?, updated_at=datetime('now')
             WHERE id=? RETURNING *`
          )
          .get(name, description || null, price, status, req.params.id) as
          | Record<string, any>
          | undefined;

        if (!bundle) throw new Error('Bundle not found');

        // Replace all items: delete existing, insert new
        rawDb.prepare('DELETE FROM bundle_items WHERE bundle_id = ?').run(req.params.id);

        for (const item of items) {
          rawDb
            .prepare(
              `INSERT INTO bundle_items (bundle_id, product_id, variant_id, quantity)
               VALUES (?, ?, ?, ?)`
            )
            .run(bundle.id, item.product_id, item.variant_id || null, item.quantity);
        }

        return bundle;
      });

      try {
        const bundle = txn();
        res.json({ success: true, data: bundle });
      } catch (err: any) {
        if (err.message === 'Bundle not found') {
          return res.status(404).json({ success: false, error: 'Bundle not found' });
        }
        throw err;
      }
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) {
        return res.status(409).json({ success: false, error: 'Bundle name already exists' });
      }
      next(err);
    }
  }
);

// DELETE /api/bundles/:id
router.delete(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawDb = db.db;
      const txn = rawDb.transaction(() => {
        // Delete child items first
        rawDb.prepare('DELETE FROM bundle_items WHERE bundle_id = ?').run(req.params.id);

        const result = rawDb
          .prepare('DELETE FROM bundles WHERE id = ? RETURNING id')
          .get(req.params.id) as Record<string, any> | undefined;

        if (!result) throw new Error('Bundle not found');

        return result;
      });

      try {
        txn();
        res.json({ success: true, data: { message: 'Bundle deleted' } });
      } catch (err: any) {
        if (err.message === 'Bundle not found') {
          return res.status(404).json({ success: false, error: 'Bundle not found' });
        }
        throw err;
      }
    } catch (err) {
      next(err);
    }
  }
);

export default router;
