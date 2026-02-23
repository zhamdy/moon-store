import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { purchaseOrderSchema, receiveSchema } from '../validators/purchaseOrderSchema';

const router: Router = Router();

function generatePONumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `PO-${y}${m}${d}-${rand}`;
}

// GET /api/purchase-orders
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 25, status, distributor_id, search } = req.query;
      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      const where: string[] = [];
      const params: unknown[] = [];

      if (status && status !== 'All') {
        where.push(`po.status = ?`);
        params.push(status);
      }
      if (distributor_id) {
        where.push(`po.distributor_id = ?`);
        params.push(Number(distributor_id));
      }
      if (search) {
        where.push(`(po.po_number LIKE ? OR d.name LIKE ?)`);
        params.push(`%${search}%`, `%${search}%`);
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const countResult = await db.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM purchase_orders po
         LEFT JOIN distributors d ON po.distributor_id = d.id
         ${whereClause}`,
        params
      );
      const total = countResult[0].count;

      const orders = await db.query(
        `SELECT po.*, d.name as distributor_name, u.name as created_by_name,
                (SELECT COUNT(*) FROM purchase_order_items WHERE po_id = po.id) as item_count
         FROM purchase_orders po
         LEFT JOIN distributors d ON po.distributor_id = d.id
         LEFT JOIN users u ON po.created_by = u.id
         ${whereClause}
         ORDER BY po.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limitNum, offset]
      );

      res.json({
        success: true,
        data: orders,
        meta: { total, page: pageNum, limit: limitNum },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/purchase-orders/auto-generate
router.get(
  '/auto-generate',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // Find low-stock products grouped by distributor
      const lowStock = await db.query(
        `SELECT p.id as product_id, p.name, p.sku, p.cost_price, p.stock, p.min_stock,
                p.distributor_id, d.name as distributor_name,
                (p.min_stock * 2 - p.stock) as suggested_qty
         FROM products p
         LEFT JOIN distributors d ON p.distributor_id = d.id
         WHERE p.stock <= p.min_stock AND p.distributor_id IS NOT NULL
         ORDER BY d.name, p.name`
      );

      res.json({ success: true, data: lowStock });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/purchase-orders/:id
router.get(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await db.query(
        `SELECT po.*, d.name as distributor_name, u.name as created_by_name
         FROM purchase_orders po
         LEFT JOIN distributors d ON po.distributor_id = d.id
         LEFT JOIN users u ON po.created_by = u.id
         WHERE po.id = ?`,
        [req.params.id]
      );

      if (order.length === 0) {
        return res.status(404).json({ success: false, error: 'Purchase order not found' });
      }

      const items = await db.query(
        `SELECT poi.*, p.name as product_name, p.sku as product_sku,
                pv.sku as variant_sku,
                pv.attributes as variant_attributes
         FROM purchase_order_items poi
         LEFT JOIN products p ON poi.product_id = p.id
         LEFT JOIN product_variants pv ON poi.variant_id = pv.id
         WHERE poi.po_id = ?`,
        [req.params.id]
      );

      const parsedItems = items.map((item: Record<string, unknown>) => ({
        ...item,
        variant_attributes: item.variant_attributes
          ? JSON.parse(item.variant_attributes as string)
          : null,
      }));

      res.json({ success: true, data: { ...order[0], items: parsedItems } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/purchase-orders
router.post(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = purchaseOrderSchema.parse(req.body);
      const authReq = req as AuthRequest;
      const poNumber = generatePONumber();

      const total = parsed.items.reduce((sum, item) => sum + item.cost_price * item.quantity, 0);

      const result = await db.query(
        `INSERT INTO purchase_orders (po_number, distributor_id, notes, total, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [poNumber, parsed.distributor_id, parsed.notes || null, total, authReq.user!.id]
      );

      const poId = (result as unknown as { lastInsertRowid: number }).lastInsertRowid;

      for (const item of parsed.items) {
        await db.query(
          `INSERT INTO purchase_order_items (po_id, product_id, variant_id, quantity, cost_price)
           VALUES (?, ?, ?, ?, ?)`,
          [poId, item.product_id, item.variant_id || null, item.quantity, item.cost_price]
        );
      }

      res.status(201).json({
        success: true,
        data: { id: poId, po_number: poNumber },
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/purchase-orders/:id/status
router.put(
  '/:id/status',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = req.body;
      const validStatuses = ['Draft', 'Sent', 'Partially Received', 'Received', 'Cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }

      const existing = await db.query(`SELECT * FROM purchase_orders WHERE id = ?`, [
        req.params.id,
      ]);
      if (existing.length === 0) {
        return res.status(404).json({ success: false, error: 'Purchase order not found' });
      }

      await db.query(
        `UPDATE purchase_orders SET status = ?, updated_at = datetime('now') WHERE id = ?`,
        [status, req.params.id]
      );

      res.json({ success: true, data: { id: Number(req.params.id), status } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/purchase-orders/:id/receive
router.post(
  '/:id/receive',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = receiveSchema.parse(req.body);
      const authReq = req as AuthRequest;

      const order = await db.query(`SELECT * FROM purchase_orders WHERE id = ?`, [req.params.id]);
      if (order.length === 0) {
        return res.status(404).json({ success: false, error: 'Purchase order not found' });
      }

      const po = order[0] as Record<string, unknown>;
      if (po.status === 'Cancelled' || po.status === 'Received') {
        return res.status(400).json({
          success: false,
          error: `Cannot receive items for ${po.status} order`,
        });
      }

      const txn = db.db.transaction(() => {
        for (const receiveItem of parsed.items) {
          if (receiveItem.quantity <= 0) continue;

          // Get PO item
          const poItem = db.db
            .prepare(`SELECT * FROM purchase_order_items WHERE id = ? AND po_id = ?`)
            .get(receiveItem.item_id, req.params.id) as Record<string, unknown> | undefined;

          if (!poItem) continue;

          const maxReceivable = (poItem.quantity as number) - (poItem.received_quantity as number);
          const actualReceive = Math.min(receiveItem.quantity, maxReceivable);
          if (actualReceive <= 0) continue;

          // Update received quantity
          db.db
            .prepare(
              `UPDATE purchase_order_items SET received_quantity = received_quantity + ? WHERE id = ?`
            )
            .run(actualReceive, receiveItem.item_id);

          // Update stock
          if (poItem.variant_id) {
            db.db
              .prepare(`UPDATE product_variants SET stock = stock + ? WHERE id = ?`)
              .run(actualReceive, poItem.variant_id);
          } else {
            db.db
              .prepare(
                `UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?`
              )
              .run(actualReceive, poItem.product_id);
          }

          // Log stock adjustment
          db.db
            .prepare(
              `INSERT INTO stock_adjustments (product_id, type, quantity, reason, adjusted_by)
               VALUES (?, 'add', ?, ?, ?)`
            )
            .run(
              poItem.product_id,
              actualReceive,
              `PO receive: ${(po as Record<string, unknown>).po_number}`,
              authReq.user!.id
            );
        }

        // Determine new PO status
        const allItems = db.db
          .prepare(`SELECT quantity, received_quantity FROM purchase_order_items WHERE po_id = ?`)
          .all(req.params.id) as Array<{ quantity: number; received_quantity: number }>;

        const allReceived = allItems.every((i) => i.received_quantity >= i.quantity);
        const someReceived = allItems.some((i) => i.received_quantity > 0);

        let newStatus = po.status as string;
        if (allReceived) {
          newStatus = 'Received';
        } else if (someReceived) {
          newStatus = 'Partially Received';
        }

        db.db
          .prepare(
            `UPDATE purchase_orders SET status = ?, updated_at = datetime('now') WHERE id = ?`
          )
          .run(newStatus, req.params.id);

        return newStatus;
      });

      const newStatus = txn();

      res.json({
        success: true,
        data: { id: Number(req.params.id), status: newStatus },
      });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/purchase-orders/:id
router.delete(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await db.query(`SELECT * FROM purchase_orders WHERE id = ?`, [
        req.params.id,
      ]);
      if (existing.length === 0) {
        return res.status(404).json({ success: false, error: 'Purchase order not found' });
      }

      const po = existing[0] as Record<string, unknown>;
      if (po.status !== 'Draft') {
        return res.status(400).json({
          success: false,
          error: 'Only Draft purchase orders can be deleted',
        });
      }

      await db.query(`DELETE FROM purchase_orders WHERE id = ?`, [req.params.id]);

      res.json({ success: true, data: { deleted: true } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
