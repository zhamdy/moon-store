import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../../database/pool';
import { withTransaction } from '../../database/transaction';
import { verifyToken, requireRole } from '../../../middleware/auth';
import { logAuditFromReq } from '../../../middleware/auditLogger';

const router: Router = Router();

const bundleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  bundle_price: z.number().positive(),
  starts_at: z.string().optional().nullable(),
  expires_at: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        quantity: z.number().int().positive().default(1),
      })
    )
    .min(2, 'A bundle must contain at least 2 products'),
});

// GET /api/bundles
router.get('/', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params: unknown[] = [];
    let where = 'WHERE 1=1';

    if (status && status !== 'all') {
      params.push(status);
      where += ` AND b.status = $${params.length}`;
    }

    const countResult = await db.query<{ total: number }>(
      `SELECT COUNT(*)::int as total FROM product_bundles b ${where}`,
      params
    );

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const bundles = await db.query(
      `SELECT b.*,
        (SELECT COUNT(*)::int FROM bundle_items WHERE bundle_id = b.id) as item_count,
        (SELECT COALESCE(SUM(p.price * bi.quantity), 0)
         FROM bundle_items bi JOIN products p ON bi.product_id = p.id
         WHERE bi.bundle_id = b.id) as original_price
       FROM product_bundles b
       ${where}
       ORDER BY b.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, Number(limit), offset]
    );

    res.json({
      success: true,
      data: bundles.rows,
      meta: {
        total: Number(countResult.rows[0]?.total || 0),
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/bundles/:id
router.get('/:id', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const bundle = await db.query('SELECT * FROM product_bundles WHERE id = $1', [id]);
    if (bundle.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Bundle not found' });
    }

    const items = await db.query(
      `SELECT bi.*, p.name as product_name, p.sku, p.price as original_price, p.stock, p.image_url
       FROM bundle_items bi
       JOIN products p ON bi.product_id = p.id
       WHERE bi.bundle_id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...bundle.rows[0],
        items: items.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/bundles
router.post(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = bundleSchema.parse(req.body);

      const result = await withTransaction(async (client) => {
        const bResult = await client.query(
          `INSERT INTO product_bundles (name, description, bundle_price, starts_at, expires_at, status)
           VALUES ($1, $2, $3, $4, $5, 'active') RETURNING *`,
          [
            parsed.name,
            parsed.description || null,
            parsed.bundle_price,
            parsed.starts_at || null,
            parsed.expires_at || null,
          ]
        );
        const bundle = bResult.rows[0];

        for (const item of parsed.items) {
          await client.query(
            `INSERT INTO bundle_items (bundle_id, product_id, quantity)
             VALUES ($1, $2, $3)`,
            [bundle.id, item.product_id, item.quantity]
          );
        }

        return bundle;
      });

      logAuditFromReq(req, 'create', 'bundle', result.id as number, { name: parsed.name });
      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ success: false, error: err.errors[0].message });
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
      const { id } = req.params;
      const parsed = bundleSchema.parse(req.body);

      const existing = await db.query('SELECT * FROM product_bundles WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Bundle not found' });
      }

      const result = await withTransaction(async (client) => {
        const bResult = await client.query(
          `UPDATE product_bundles SET name = $1, description = $2, bundle_price = $3, starts_at = $4, expires_at = $5, updated_at = NOW()
           WHERE id = $6 RETURNING *`,
          [
            parsed.name,
            parsed.description || null,
            parsed.bundle_price,
            parsed.starts_at || null,
            parsed.expires_at || null,
            id,
          ]
        );

        await client.query('DELETE FROM bundle_items WHERE bundle_id = $1', [id]);

        for (const item of parsed.items) {
          await client.query(
            `INSERT INTO bundle_items (bundle_id, product_id, quantity)
             VALUES ($1, $2, $3)`,
            [id, item.product_id, item.quantity]
          );
        }

        return bResult.rows[0];
      });

      logAuditFromReq(req, 'update', 'bundle', Number(id));
      res.json({ success: true, data: result });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ success: false, error: err.errors[0].message });
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
      const { id } = req.params;
      const result = await db.query('DELETE FROM product_bundles WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Bundle not found' });
      }
      logAuditFromReq(req, 'delete', 'bundle', Number(id));
      res.json({ success: true, data: { message: 'Bundle deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
