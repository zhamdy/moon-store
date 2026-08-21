import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../src/database/pool';
import { withTransaction } from '../src/database/transaction';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { logAuditFromReq } from '../middleware/auditLogger';

const router: Router = Router();

// --- Zod schemas ---

const createStockCountSchema = z.object({
  category_id: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
});

const updateActualQtySchema = z.object({
  actual_qty: z.number().int().min(0, 'actual_qty must be a non-negative integer'),
});

// GET /api/stock-counts — List all stock counts with summary
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT sc.*,
                u.name as started_by_name,
                c.name as category_name,
                (SELECT COUNT(*)::int FROM stock_count_items WHERE count_id = sc.id) as item_count,
                (SELECT COUNT(*)::int FROM stock_count_items WHERE count_id = sc.id AND actual_qty IS NOT NULL) as counted
         FROM stock_counts sc
         LEFT JOIN users u ON sc.started_by = u.id
         LEFT JOIN categories c ON sc.category_id = c.id
         ORDER BY sc.started_at DESC`
      );

      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/stock-counts — Create a new stock count
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

      const count = await withTransaction(async (client) => {
        // Create the stock count record
        const countRes = await client.query(
          `INSERT INTO stock_counts (category_id, notes, started_by, started_at, status)
           VALUES ($1, $2, $3, NOW(), 'in_progress')
           RETURNING *`,
          [category_id || null, notes || null, authReq.user!.id]
        );
        const countRow = countRes.rows[0];

        // Build product filter
        const where: string[] = ["status = 'active'"];
        const params: unknown[] = [];

        if (category_id) {
          params.push(category_id);
          where.push(`category_id = $${params.length}`);
        }

        const whereClause = `WHERE ${where.join(' AND ')}`;

        // Get all matching products
        const productsRes = await client.query<{ id: number; stock: number }>(
          `SELECT id, stock FROM products ${whereClause}`,
          params
        );
        const products = productsRes.rows;

        // Pre-populate stock_count_items with current stock as expected_qty
        for (const product of products) {
          await client.query(
            `INSERT INTO stock_count_items (count_id, product_id, expected_qty) VALUES ($1, $2, $3)`,
            [countRow.id, product.id, product.stock]
          );
        }

        return { ...countRow, item_count: products.length };
      });

      logAuditFromReq(req, 'create', 'stock_count', Number((count as Record<string, unknown>).id), {
        category_id: category_id || null,
        item_count: count.item_count,
      });

      res.status(201).json({ success: true, data: count });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/stock-counts/:id — Get count with all items
router.get(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const countResult = await db.query(
        `SELECT sc.*,
                u.name as started_by_name,
                c.name as category_name
         FROM stock_counts sc
         LEFT JOIN users u ON sc.started_by = u.id
         LEFT JOIN categories c ON sc.category_id = c.id
         WHERE sc.id = $1`,
        [req.params.id]
      );

      if (countResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Stock count not found' });
      }

      const items = await db.query(
        `SELECT sci.*, p.name as product_name, p.sku as product_sku
         FROM stock_count_items sci
         JOIN products p ON sci.product_id = p.id
         WHERE sci.count_id = $1
         ORDER BY p.name`,
        [req.params.id]
      );

      res.json({ success: true, data: { ...countResult.rows[0], items: items.rows } });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/stock-counts/:id/items/:itemId — Update actual_qty for a count item
router.put(
  '/:id/items/:itemId',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateActualQtySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { actual_qty } = parsed.data;

      // Verify the stock count exists and is in_progress
      const countResult = await db.query<{ status: string }>(
        `SELECT status FROM stock_counts WHERE id = $1`,
        [req.params.id]
      );
      if (countResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Stock count not found' });
      }
      if (countResult.rows[0].status !== 'in_progress') {
        return res.status(400).json({ success: false, error: 'Stock count is not in progress' });
      }

      const result = await db.query(
        `UPDATE stock_count_items SET actual_qty = $1 WHERE id = $2 AND count_id = $3 RETURNING *`,
        [actual_qty, req.params.itemId, req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Stock count item not found' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/stock-counts/:id/items/:itemId/approve — Toggle approved flag on a count item
router.put(
  '/:id/items/:itemId/approve',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Verify the stock count exists and is in_progress
      const countResult = await db.query<{ status: string }>(
        `SELECT status FROM stock_counts WHERE id = $1`,
        [req.params.id]
      );
      if (countResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Stock count not found' });
      }
      if (countResult.rows[0].status !== 'in_progress') {
        return res.status(400).json({ success: false, error: 'Stock count is not in progress' });
      }

      // Toggle: if approved=0 set to 1, if approved=1 set to 0
      const result = await db.query(
        `UPDATE stock_count_items
         SET approved = CASE WHEN approved = 0 OR approved IS NULL THEN 1 ELSE 0 END
         WHERE id = $1 AND count_id = $2
         RETURNING *`,
        [req.params.itemId, req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Stock count item not found' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/stock-counts/:id/approve — Approve a stock count and apply adjustments
router.post(
  '/:id/approve',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const countId = Number(req.params.id);

      // Verify stock count exists and is in_progress
      const countRes = await db.query<{ id: number; status: string }>(
        `SELECT * FROM stock_counts WHERE id = $1`,
        [countId]
      );
      const count = countRes.rows[0];

      if (!count) {
        return res.status(404).json({ success: false, error: 'Stock count not found' });
      }
      if (count.status !== 'in_progress') {
        return res.status(400).json({ success: false, error: 'Stock count is not in progress' });
      }

      const adjustmentsCreated = await withTransaction(async (client) => {
        // Get all approved items where actual_qty differs from expected_qty
        const itemsRes = await client.query<Record<string, any>>(
          `SELECT sci.*, p.stock as current_stock
           FROM stock_count_items sci
           JOIN products p ON sci.product_id = p.id
           WHERE sci.count_id = $1 AND sci.approved = 1 AND sci.actual_qty IS NOT NULL AND sci.actual_qty != sci.expected_qty`,
          [countId]
        );
        const items = itemsRes.rows;

        let createdCount = 0;

        for (const item of items) {
          const previousQty = Number(item.current_stock);
          const delta = Number(item.actual_qty) - Number(item.expected_qty);
          const newQty = previousQty + delta;
          const clampedQty = newQty < 0 ? 0 : newQty;

          // Update product stock
          await client.query(`UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2`, [
            clampedQty,
            item.product_id,
          ]);

          // Create stock adjustment record
          await client.query(
            `INSERT INTO stock_adjustments (product_id, previous_qty, new_qty, delta, reason, user_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [item.product_id, previousQty, clampedQty, delta, 'Stock Count', authReq.user!.id]
          );

          createdCount++;
        }

        // Mark the count as completed
        await client.query(
          `UPDATE stock_counts SET status = 'completed', completed_at = NOW() WHERE id = $1`,
          [countId]
        );

        return createdCount;
      });

      logAuditFromReq(req, 'approve', 'stock_count', countId, {
        adjustments_created: adjustmentsCreated,
      });

      res.json({
        success: true,
        data: { id: countId, status: 'completed', adjustments_created: adjustmentsCreated },
      });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/stock-counts/:id — Cancel a stock count (only if in_progress)
router.delete(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await db.query<{ status: string }>(
        `SELECT status FROM stock_counts WHERE id = $1`,
        [req.params.id]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Stock count not found' });
      }

      if (existing.rows[0].status !== 'in_progress') {
        return res.status(400).json({
          success: false,
          error: 'Only in-progress stock counts can be cancelled',
        });
      }

      await db.query(`UPDATE stock_counts SET status = 'cancelled' WHERE id = $1`, [req.params.id]);

      logAuditFromReq(req, 'cancel', 'stock_count', Number(req.params.id));

      res.json({ success: true, data: { id: Number(req.params.id), status: 'cancelled' } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
