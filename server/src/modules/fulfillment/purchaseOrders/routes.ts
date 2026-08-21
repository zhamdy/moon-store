import { Router, Request, Response, NextFunction } from 'express';
import db from '../../../database/pool';
import { withTransaction } from '../../../database/transaction';
import { verifyToken, requireRole, AuthRequest } from '../../../../middleware/auth';
import {
  purchaseOrderSchema,
  receiveSchema,
  POItem,
  ReceiveItems,
} from '../../../../validators/purchaseOrderSchema';
import { logAuditFromReq } from '../../../../middleware/auditLogger';

const router: Router = Router();

function generatePONumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `PO-${y}${m}${d}-${rand}`;
}

// GET /api/purchase-orders — List all POs
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 25, distributor_id, status } = req.query;
      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      const where: string[] = [];
      const params: unknown[] = [];
      let paramIdx = 1;

      if (distributor_id) {
        where.push(`po.distributor_id = $${paramIdx++}`);
        params.push(Number(distributor_id));
      }
      if (status && status !== 'all') {
        where.push(`po.status = $${paramIdx++}`);
        params.push(status);
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const countResult = await db.query<{ count: string | number }>(
        `SELECT COUNT(*) as count FROM purchase_orders po ${whereClause}`,
        params
      );
      const total = Number(countResult.rows[0]?.count || 0);

      const queryParams = [...params, limitNum, offset];
      const limitIdx = paramIdx++;
      const offsetIdx = paramIdx++;

      const orders = await db.query(
        `SELECT po.*, d.name as distributor_name, u.name as created_by_name,
                (SELECT COUNT(*)::int FROM purchase_order_items WHERE po_id = po.id) as item_count
         FROM purchase_orders po
         LEFT JOIN distributors d ON po.distributor_id = d.id
         LEFT JOIN users u ON po.created_by = u.id
         ${whereClause}
         ORDER BY po.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        queryParams
      );

      res.json({
        success: true,
        data: orders.rows,
        meta: { total, page: pageNum, limit: limitNum },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/purchase-orders/:id — Get PO details with items
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
         WHERE po.id = $1`,
        [req.params.id]
      );

      if (order.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Purchase order not found' });
      }

      const items = await db.query(
        `SELECT poi.*, p.name as product_name, p.sku as product_sku,
                pv.sku as variant_sku,
                pv.attributes as variant_attributes
         FROM purchase_order_items poi
         LEFT JOIN products p ON poi.product_id = p.id
         LEFT JOIN product_variants pv ON poi.variant_id = pv.id
         WHERE poi.po_id = $1`,
        [req.params.id]
      );

      const parsedItems = items.rows.map((item: any) => ({
        ...item,
        variant_attributes: item.variant_attributes
          ? typeof item.variant_attributes === 'string'
            ? JSON.parse(item.variant_attributes)
            : item.variant_attributes
          : null,
      }));

      res.json({ success: true, data: { ...order.rows[0], items: parsedItems } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/purchase-orders — Create a new PO
router.post(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = purchaseOrderSchema.parse(req.body);
      const authReq = req as AuthRequest;
      const poNumber = generatePONumber();

      const total = parsed.items.reduce(
        (sum: number, item: POItem) => sum + item.cost_price * item.quantity,
        0
      );

      const poId = await withTransaction(async (client: any) => {
        const poRes = await client.query(
          `INSERT INTO purchase_orders (po_number, distributor_id, notes, total, created_by, status)
           VALUES ($1, $2, $3, $4, $5, 'Draft') RETURNING id`,
          [poNumber, parsed.distributor_id, parsed.notes || null, total, authReq.user!.id]
        );
        const newPoId = poRes.rows[0].id;

        for (const item of parsed.items) {
          await client.query(
            `INSERT INTO purchase_order_items (po_id, product_id, variant_id, quantity, cost_price)
             VALUES ($1, $2, $3, $4, $5)`,
            [newPoId, item.product_id, item.variant_id || null, item.quantity, item.cost_price]
          );
        }

        return newPoId;
      });

      logAuditFromReq(req, 'create', 'purchase_order', poId, { po_number: poNumber });
      res.status(201).json({
        success: true,
        data: { id: poId, po_number: poNumber },
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/purchase-orders/:id/status — Update PO status
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

      const existing = await db.query('SELECT * FROM purchase_orders WHERE id = $1', [
        req.params.id,
      ]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Purchase order not found' });
      }

      await db.query(`UPDATE purchase_orders SET status = $1, updated_at = NOW() WHERE id = $2`, [
        status,
        req.params.id,
      ]);

      res.json({ success: true, data: { id: Number(req.params.id), status } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/purchase-orders/:id/receive — Receive items
router.post(
  '/:id/receive',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = receiveSchema.parse(req.body) as ReceiveItems;
      const authReq = req as AuthRequest;

      const order = await db.query('SELECT * FROM purchase_orders WHERE id = $1', [req.params.id]);
      if (order.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Purchase order not found' });
      }

      const po = order.rows[0];
      if (po.status === 'Cancelled' || po.status === 'Received') {
        return res.status(400).json({
          success: false,
          error: `Cannot receive items for ${po.status} order`,
        });
      }

      const newStatus = await withTransaction(async (client: any) => {
        for (const receiveItem of parsed.items) {
          if (receiveItem.quantity <= 0) continue;

          const poItemRes = await client.query(
            'SELECT * FROM purchase_order_items WHERE id = $1 AND po_id = $2',
            [receiveItem.item_id, req.params.id]
          );
          const poItem = poItemRes.rows[0];
          if (!poItem) continue;

          const maxReceivable = Number(poItem.quantity) - Number(poItem.received_quantity || 0);
          const actualReceive = Math.min(receiveItem.quantity, maxReceivable);
          if (actualReceive <= 0) continue;

          // Update received quantity
          await client.query(
            'UPDATE purchase_order_items SET received_quantity = COALESCE(received_quantity, 0) + $1 WHERE id = $2',
            [actualReceive, receiveItem.item_id]
          );

          // Update stock
          if (poItem.variant_id) {
            await client.query('UPDATE product_variants SET stock = stock + $1 WHERE id = $2', [
              actualReceive,
              poItem.variant_id,
            ]);
          } else {
            await client.query(
              'UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2',
              [actualReceive, poItem.product_id]
            );
          }

          // Log stock adjustment
          const pRes = await client.query('SELECT stock FROM products WHERE id = $1', [
            poItem.product_id,
          ]);
          const newStock = Number(pRes.rows[0]?.stock || 0);
          await client.query(
            `INSERT INTO stock_adjustments (product_id, previous_qty, new_qty, delta, reason, user_id)
             VALUES ($1, $2, $3, $4, 'Import', $5)`,
            [poItem.product_id, newStock - actualReceive, newStock, actualReceive, authReq.user!.id]
          );
        }

        // Determine new PO status
        const allItemsRes = await client.query(
          'SELECT quantity, COALESCE(received_quantity, 0) as received_quantity FROM purchase_order_items WHERE po_id = $1',
          [req.params.id]
        );

        const allReceived = allItemsRes.rows.every((i: any) => i.received_quantity >= i.quantity);
        const someReceived = allItemsRes.rows.some((i: any) => i.received_quantity > 0);

        let status = po.status as string;
        if (allReceived) {
          status = 'Received';
        } else if (someReceived) {
          status = 'Partially Received';
        }

        await client.query(
          'UPDATE purchase_orders SET status = $1, updated_at = NOW() WHERE id = $2',
          [status, req.params.id]
        );

        return status;
      });

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
      const existing = await db.query('SELECT * FROM purchase_orders WHERE id = $1', [
        req.params.id,
      ]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Purchase order not found' });
      }

      const po = existing.rows[0];
      if (po.status !== 'Draft') {
        return res.status(400).json({
          success: false,
          error: 'Only Draft purchase orders can be deleted',
        });
      }

      await db.query('DELETE FROM purchase_orders WHERE id = $1', [req.params.id]);

      res.json({ success: true, data: { deleted: true } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
