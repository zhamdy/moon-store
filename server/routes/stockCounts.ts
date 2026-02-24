import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../db';
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT sc.*,
                u.name as started_by_name,
                c.name as category_name,
                (SELECT COUNT(*) FROM stock_count_items WHERE count_id = sc.id) as item_count,
                (SELECT COUNT(*) FROM stock_count_items WHERE count_id = sc.id AND actual_qty IS NOT NULL) as counted
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

      const rawDb = db.db;
      const txn = rawDb.transaction(() => {
        // Create the stock count record
        const count = rawDb
          .prepare(
            `INSERT INTO stock_counts (category_id, notes, started_by) VALUES (?, ?, ?) RETURNING *`
          )
          .get(category_id || null, notes || null, authReq.user!.id) as Record<string, any>;

        // Build product filter
        const where: string[] = ["status = 'active'"];
        const params: unknown[] = [];

        if (category_id) {
          where.push('category_id = ?');
          params.push(category_id);
        }

        const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

        // Get all matching products
        const products = rawDb
          .prepare(`SELECT id, stock FROM products ${whereClause}`)
          .all(...params) as Array<{ id: number; stock: number }>;

        // Pre-populate stock_count_items with current stock as expected_qty
        const insertItem = rawDb.prepare(
          `INSERT INTO stock_count_items (count_id, product_id, expected_qty) VALUES (?, ?, ?)`
        );

        for (const product of products) {
          insertItem.run(count.id, product.id, product.stock);
        }

        return { ...count, item_count: products.length };
      });

      const count = txn();

      logAuditFromReq(req, 'create', 'stock_count', (count as any).id, {
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
         WHERE sc.id = ?`,
        [req.params.id]
      );

      if (countResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Stock count not found' });
      }

      const items = await db.query(
        `SELECT sci.*, p.name as product_name, p.sku as product_sku
         FROM stock_count_items sci
         JOIN products p ON sci.product_id = p.id
         WHERE sci.count_id = ?
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
        `SELECT status FROM stock_counts WHERE id = ?`,
        [req.params.id]
      );
      if (countResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Stock count not found' });
      }
      if (countResult.rows[0].status !== 'in_progress') {
        return res.status(400).json({ success: false, error: 'Stock count is not in progress' });
      }

      const result = await db.query(
        `UPDATE stock_count_items SET actual_qty = ? WHERE id = ? AND count_id = ? RETURNING *`,
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
        `SELECT status FROM stock_counts WHERE id = ?`,
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
         SET approved = CASE WHEN approved = 0 THEN 1 ELSE 0 END
         WHERE id = ? AND count_id = ?
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

      const rawDb = db.db;

      // Verify stock count exists and is in_progress
      const count = rawDb.prepare(`SELECT * FROM stock_counts WHERE id = ?`).get(countId) as
        | Record<string, any>
        | undefined;

      if (!count) {
        return res.status(404).json({ success: false, error: 'Stock count not found' });
      }
      if (count.status !== 'in_progress') {
        return res.status(400).json({ success: false, error: 'Stock count is not in progress' });
      }

      const txn = rawDb.transaction(() => {
        // Get all approved items where actual_qty differs from expected_qty
        const items = rawDb
          .prepare(
            `SELECT sci.*, p.stock as current_stock
             FROM stock_count_items sci
             JOIN products p ON sci.product_id = p.id
             WHERE sci.count_id = ? AND sci.approved = 1 AND sci.actual_qty IS NOT NULL AND sci.actual_qty != sci.expected_qty`
          )
          .all(countId) as Array<Record<string, any>>;

        let adjustmentsCreated = 0;

        for (const item of items) {
          const previousQty = item.current_stock as number;
          const delta = (item.actual_qty as number) - (item.expected_qty as number);
          const newQty = previousQty + delta;

          // Update product stock
          rawDb
            .prepare("UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?")
            .run(newQty < 0 ? 0 : newQty, item.product_id);

          // Create stock adjustment record
          rawDb
            .prepare(
              `INSERT INTO stock_adjustments (product_id, previous_qty, new_qty, delta, reason, user_id)
               VALUES (?, ?, ?, ?, ?, ?)`
            )
            .run(
              item.product_id,
              previousQty,
              newQty < 0 ? 0 : newQty,
              delta,
              'Stock Count',
              authReq.user!.id
            );

          adjustmentsCreated++;
        }

        // Mark the count as completed
        rawDb
          .prepare(
            `UPDATE stock_counts SET status = 'completed', completed_at = datetime('now') WHERE id = ?`
          )
          .run(countId);

        return adjustmentsCreated;
      });

      const adjustmentsCreated = txn();

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
        `SELECT status FROM stock_counts WHERE id = ?`,
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

      await db.query(`UPDATE stock_counts SET status = 'cancelled' WHERE id = ?`, [req.params.id]);

      logAuditFromReq(req, 'cancel', 'stock_count', req.params.id);

      res.json({ success: true, data: { id: Number(req.params.id), status: 'cancelled' } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
