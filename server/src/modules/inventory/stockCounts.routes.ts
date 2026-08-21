import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../../database/pool';
import { withTransaction } from '../../database/transaction';
import { verifyToken, requireRole, AuthRequest } from '../../../middleware/auth';
import { logAuditFromReq } from '../../../middleware/auditLogger';

const router: Router = Router();

const createStockCountSchema = z.object({
  category_id: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
});

const updateCountItemSchema = z.object({
  counted_qty: z.number().int().min(0),
  notes: z.string().max(255).optional(),
});

// GET /api/stock-counts
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      const where: string[] = [];
      const params: unknown[] = [];

      if (status && status !== 'all') {
        params.push(status);
        where.push(`sc.status = $${params.length}`);
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const countResult = await db.query<{ count: number }>(
        `SELECT COUNT(*)::int as count FROM stock_counts sc ${whereClause}`,
        params
      );
      const total = Number(countResult.rows[0]?.count || 0);

      const limitIdx = params.length + 1;
      const offsetIdx = params.length + 2;

      const result = await db.query(
        `SELECT sc.*, u.name as created_by_name, c.name as category_name,
                (SELECT COUNT(*)::int FROM stock_count_items WHERE count_id = sc.id) as total_items,
                (SELECT COUNT(*)::int FROM stock_count_items WHERE count_id = sc.id AND counted_qty IS NOT NULL) as counted_items,
                (SELECT COALESCE(SUM(variance), 0)::int FROM stock_count_items WHERE count_id = sc.id) as total_variance
         FROM stock_counts sc
         LEFT JOIN users u ON sc.created_by = u.id
         LEFT JOIN categories c ON sc.category_id = c.id
         ${whereClause}
         ORDER BY sc.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        [...params, limitNum, offset]
      );

      res.json({
        success: true,
        data: result.rows,
        meta: { total, page: pageNum, limit: limitNum },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/stock-counts — Start a new stock count session
router.post(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createStockCountSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const authReq = req as AuthRequest;
      const { category_id, notes } = parsed.data;

      // Select active products to count
      const productQuery = category_id
        ? `SELECT p.id, p.stock, pv.id as variant_id, pv.stock as variant_stock
           FROM products p
           LEFT JOIN product_variants pv ON pv.product_id = p.id
           WHERE p.category_id = $1 AND p.status = 'active'`
        : `SELECT p.id, p.stock, pv.id as variant_id, pv.stock as variant_stock
           FROM products p
           LEFT JOIN product_variants pv ON pv.product_id = p.id
           WHERE p.status = 'active'`;

      const productParams = category_id ? [category_id] : [];
      const products = await db.query(productQuery, productParams);

      if (products.rows.length === 0) {
        return res.status(400).json({ success: false, error: 'No active products found to count' });
      }

      const countId = await withTransaction(async (client) => {
        const scResult = await client.query<{ id: number }>(
          `INSERT INTO stock_counts (category_id, notes, status, created_by)
           VALUES ($1, $2, 'in_progress', $3) RETURNING id`,
          [category_id || null, notes || null, authReq.user!.id]
        );
        const newCountId = scResult.rows[0].id;

        for (const row of products.rows) {
          const expectedQty = row.variant_id ? row.variant_stock : row.stock;
          await client.query(
            `INSERT INTO stock_count_items (count_id, product_id, variant_id, expected_qty)
             VALUES ($1, $2, $3, $4)`,
            [newCountId, row.id, row.variant_id || null, expectedQty]
          );
        }

        return newCountId;
      });

      logAuditFromReq(req, 'create', 'stock_count', countId);
      res.status(201).json({ success: true, data: { id: countId } });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/stock-counts/:id — Get details + items
router.get(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const countRes = await db.query(
        `SELECT sc.*, u.name as created_by_name, c.name as category_name
         FROM stock_counts sc
         LEFT JOIN users u ON sc.created_by = u.id
         LEFT JOIN categories c ON sc.category_id = c.id
         WHERE sc.id = $1`,
        [req.params.id]
      );

      if (countRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Stock count not found' });
      }

      const itemsRes = await db.query(
        `SELECT sci.*, p.name as product_name, p.sku as product_sku, p.barcode as product_barcode,
                p.price, p.cost_price,
                pv.sku as variant_sku, pv.barcode as variant_barcode, pv.attributes as variant_attributes
         FROM stock_count_items sci
         JOIN products p ON sci.product_id = p.id
         LEFT JOIN product_variants pv ON sci.variant_id = pv.id
         WHERE sci.count_id = $1
         ORDER BY p.name ASC`,
        [req.params.id]
      );

      const items = itemsRes.rows.map((row: any) => ({
        ...row,
        variant_attributes:
          typeof row.variant_attributes === 'string'
            ? JSON.parse(row.variant_attributes)
            : row.variant_attributes,
      }));

      res.json({
        success: true,
        data: { ...countRes.rows[0], items },
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/stock-counts/:id/items/:itemId — Record counted quantity
router.put(
  '/:id/items/:itemId',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateCountItemSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { counted_qty, notes } = parsed.data;

      // Fetch existing item
      const itemRes = await db.query<Record<string, any>>(
        'SELECT * FROM stock_count_items WHERE id = $1 AND count_id = $2',
        [req.params.itemId, req.params.id]
      );
      if (itemRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Count item not found' });
      }

      const item = itemRes.rows[0];
      const variance = counted_qty - item.expected_qty;

      const result = await db.query(
        `UPDATE stock_count_items SET counted_qty = $1, variance = $2, notes = $3
         WHERE id = $4 RETURNING *`,
        [counted_qty, variance, notes || null, req.params.itemId]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/stock-counts/:id/complete — Finalize count & optionally apply adjustments
router.post(
  '/:id/complete',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { apply_adjustments = true } = req.body;

      const countRes = await db.query<Record<string, any>>(
        'SELECT * FROM stock_counts WHERE id = $1',
        [req.params.id]
      );
      if (countRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Stock count not found' });
      }

      const stockCount = countRes.rows[0];
      if (stockCount.status === 'completed') {
        return res.status(400).json({ success: false, error: 'Stock count is already completed' });
      }

      await withTransaction(async (client) => {
        if (apply_adjustments) {
          const itemsRes = await client.query<Record<string, any>>(
            `SELECT * FROM stock_count_items
             WHERE count_id = $1 AND counted_qty IS NOT NULL AND variance != 0`,
            [req.params.id]
          );

          for (const item of itemsRes.rows) {
            if (item.variant_id) {
              await client.query('UPDATE product_variants SET stock = $1 WHERE id = $2', [
                item.counted_qty,
                item.variant_id,
              ]);
            } else {
              await client.query(
                'UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2',
                [item.counted_qty, item.product_id]
              );
            }

            await client.query(
              `INSERT INTO stock_adjustments (product_id, previous_qty, new_qty, delta, reason, user_id)
               VALUES ($1, $2, $3, $4, 'Stock Count', $5)`,
              [
                item.product_id,
                item.expected_qty,
                item.counted_qty,
                item.variance,
                authReq.user!.id,
              ]
            );
          }
        }

        await client.query(
          `UPDATE stock_counts SET status = 'completed', completed_at = NOW() WHERE id = $1`,
          [req.params.id]
        );
      });

      logAuditFromReq(req, 'complete', 'stock_count', req.params.id as string, {
        appliedAdjustments: apply_adjustments,
      });

      res.json({ success: true, data: { status: 'completed' } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/stock-counts/:id/cancel
router.post(
  '/:id/cancel',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `UPDATE stock_counts SET status = 'cancelled' WHERE id = $1 AND status = 'in_progress' RETURNING id`,
        [req.params.id]
      );
      if (result.rows.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: 'Only in-progress counts can be cancelled' });
      }

      logAuditFromReq(req, 'cancel', 'stock_count', req.params.id as string);
      res.json({ success: true, data: { status: 'cancelled' } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
