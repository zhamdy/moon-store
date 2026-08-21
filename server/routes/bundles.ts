import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../src/database/pool';
import { withTransaction } from '../src/database/transaction';
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
  async (_req: Request, res: Response, next: NextFunction) => {
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
             WHERE bi.bundle_id = $1`,
            [bundle.id]
          )
        ).rows as Record<string, any>[];

        const originalPrice = items.reduce(
          (sum: number, item: Record<string, any>) =>
            sum + Number(item.product_price) * item.quantity,
          0
        );
        const savings = originalPrice - Number(bundle.price);
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
      const result = await db.query(`SELECT b.* FROM bundles b WHERE b.id = $1`, [req.params.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Bundle not found' });
      }

      const bundle = result.rows[0] as Record<string, any>;

      const items = (
        await db.query(
          `SELECT bi.*, p.name as product_name, p.price as product_price
           FROM bundle_items bi
           JOIN products p ON bi.product_id = p.id
           WHERE bi.bundle_id = $1`,
          [req.params.id]
        )
      ).rows as Record<string, any>[];

      const originalPrice = items.reduce(
        (sum: number, item: Record<string, any>) =>
          sum + Number(item.product_price) * item.quantity,
        0
      );
      const savings = originalPrice - Number(bundle.price);
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

      try {
        const bundle = await withTransaction(async (client) => {
          const bundleRes = await client.query(
            `INSERT INTO bundles (name, description, price, status)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [name, description || null, price, status]
          );
          const bundleRow = bundleRes.rows[0];

          for (const item of items) {
            await client.query(
              `INSERT INTO bundle_items (bundle_id, product_id, variant_id, quantity)
               VALUES ($1, $2, $3, $4)`,
              [bundleRow.id, item.product_id, item.variant_id || null, item.quantity]
            );
          }

          return bundleRow;
        });

        res.status(201).json({ success: true, data: bundle });
      } catch (err: any) {
        if (
          err.code === '23505' ||
          err.message?.includes('unique') ||
          err.message?.includes('UNIQUE')
        ) {
          return res.status(409).json({ success: false, error: 'Bundle name already exists' });
        }
        throw err;
      }
    } catch (err) {
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

      try {
        const bundle = await withTransaction(async (client) => {
          const bundleRes = await client.query(
            `UPDATE bundles SET name=$1, description=$2, price=$3, status=$4, updated_at=NOW()
             WHERE id=$5 RETURNING *`,
            [name, description || null, price, status, req.params.id]
          );

          if (bundleRes.rows.length === 0) {
            const notFoundErr = new Error('Bundle not found');
            (notFoundErr as any).statusCode = 404;
            throw notFoundErr;
          }

          // Replace all items: delete existing, insert new
          await client.query('DELETE FROM bundle_items WHERE bundle_id = $1', [req.params.id]);

          for (const item of items) {
            await client.query(
              `INSERT INTO bundle_items (bundle_id, product_id, variant_id, quantity)
               VALUES ($1, $2, $3, $4)`,
              [req.params.id, item.product_id, item.variant_id || null, item.quantity]
            );
          }

          return bundleRes.rows[0];
        });

        res.json({ success: true, data: bundle });
      } catch (err: any) {
        if (err.statusCode === 404 || err.message === 'Bundle not found') {
          return res.status(404).json({ success: false, error: 'Bundle not found' });
        }
        if (
          err.code === '23505' ||
          err.message?.includes('unique') ||
          err.message?.includes('UNIQUE')
        ) {
          return res.status(409).json({ success: false, error: 'Bundle name already exists' });
        }
        throw err;
      }
    } catch (err) {
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
      await withTransaction(async (client) => {
        // Delete child items first
        await client.query('DELETE FROM bundle_items WHERE bundle_id = $1', [req.params.id]);

        const delRes = await client.query('DELETE FROM bundles WHERE id = $1 RETURNING id', [
          req.params.id,
        ]);

        if (delRes.rows.length === 0) {
          const notFoundErr = new Error('Bundle not found');
          (notFoundErr as any).statusCode = 404;
          throw notFoundErr;
        }

        return delRes.rows[0];
      });

      res.json({ success: true, data: { message: 'Bundle deleted' } });
    } catch (err: any) {
      if (err.statusCode === 404 || err.message === 'Bundle not found') {
        return res.status(404).json({ success: false, error: 'Bundle not found' });
      }
      next(err);
    }
  }
);

export default router;
