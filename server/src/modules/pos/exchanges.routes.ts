import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../../database/pool';
import { withTransaction } from '../../database/transaction';
import { verifyToken, requireRole, AuthRequest } from '../../../middleware/auth';
import { logAuditFromReq } from '../../../middleware/auditLogger';

const router: Router = Router();

const exchangeSchema = z.object({
  original_sale_id: z.number().int().positive(),
  returned_items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        variant_id: z.number().int().positive().optional().nullable(),
        quantity: z.number().int().positive(),
        price: z.number().min(0),
        reason: z.string().min(1),
        condition: z.enum(['good', 'damaged', 'defective']).default('good'),
      })
    )
    .min(1),
  new_items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        variant_id: z.number().int().positive().optional().nullable(),
        quantity: z.number().int().positive(),
        price: z.number().min(0),
      })
    )
    .min(1),
  payment_method: z.enum(['cash', 'card', 'store_credit']).optional(),
  notes: z.string().max(500).optional(),
});

function generateExchangeNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `EXC-${y}${m}${d}-${rand}`;
}

// POST /api/exchanges
router.post(
  '/',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const parsed = exchangeSchema.parse(req.body);

      // Verify original sale exists
      const originalSale = await db.query('SELECT * FROM sales WHERE id = $1', [
        parsed.original_sale_id,
      ]);
      if (originalSale.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Original sale not found' });
      }

      // Calculate totals
      const returnTotal = parsed.returned_items.reduce((s, i) => s + i.price * i.quantity, 0);
      const newTotal = parsed.new_items.reduce((s, i) => s + i.price * i.quantity, 0);
      const difference = newTotal - returnTotal; // > 0: customer pays, < 0: refund/credit

      const exchangeNumber = generateExchangeNumber();

      const result = await withTransaction(async (client) => {
        // Insert exchange
        const excResult = await client.query(
          `INSERT INTO exchanges (exchange_number, original_sale_id, customer_id, cashier_id, return_total, new_total, difference, payment_method, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [
            exchangeNumber,
            parsed.original_sale_id,
            originalSale.rows[0].customer_id || null,
            authReq.user!.id,
            returnTotal,
            newTotal,
            difference,
            parsed.payment_method || (difference >= 0 ? 'cash' : 'store_credit'),
            parsed.notes || null,
          ]
        );
        const exchange = excResult.rows[0];

        // Insert returned items + restock if good
        for (const item of parsed.returned_items) {
          await client.query(
            `INSERT INTO exchange_returned_items (exchange_id, product_id, variant_id, quantity, price, reason, condition)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              exchange.id,
              item.product_id,
              item.variant_id || null,
              item.quantity,
              item.price,
              item.reason,
              item.condition,
            ]
          );

          if (item.condition === 'good') {
            if (item.variant_id) {
              await client.query(`UPDATE product_variants SET stock = stock + $1 WHERE id = $2`, [
                item.quantity,
                item.variant_id,
              ]);
            } else {
              await client.query(
                `UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2`,
                [item.quantity, item.product_id]
              );
            }
          }
        }

        // Insert new items + deduct stock
        for (const item of parsed.new_items) {
          await client.query(
            `INSERT INTO exchange_new_items (exchange_id, product_id, variant_id, quantity, price)
             VALUES ($1, $2, $3, $4, $5)`,
            [exchange.id, item.product_id, item.variant_id || null, item.quantity, item.price]
          );

          if (item.variant_id) {
            await client.query(`UPDATE product_variants SET stock = stock - $1 WHERE id = $2`, [
              item.quantity,
              item.variant_id,
            ]);
          } else {
            await client.query(
              `UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2`,
              [item.quantity, item.product_id]
            );
          }
        }

        return exchange;
      });

      logAuditFromReq(req, 'create', 'exchange', result.id as number, {
        exchange_number: exchangeNumber,
        difference,
      });

      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// GET /api/exchanges
router.get('/', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20', search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params: unknown[] = [];
    let where = '';

    if (search) {
      params.push(`%${search}%`);
      where = `WHERE e.exchange_number ILIKE $${params.length}`;
    }

    const countResult = await db.query<{ total: number }>(
      `SELECT COUNT(*)::int as total FROM exchanges e ${where}`,
      params
    );

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const exchanges = await db.query(
      `SELECT e.*, u.name as cashier_name, c.name as customer_name
         FROM exchanges e
         JOIN users u ON e.cashier_id = u.id
         LEFT JOIN customers c ON e.customer_id = c.id
         ${where}
         ORDER BY e.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, Number(limit), offset]
    );

    res.json({
      success: true,
      data: exchanges.rows,
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

// GET /api/exchanges/:id
router.get('/:id', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const exchange = await db.query(
      `SELECT e.*, u.name as cashier_name, c.name as customer_name, s.receipt_number as original_receipt
         FROM exchanges e
         JOIN users u ON e.cashier_id = u.id
         LEFT JOIN customers c ON e.customer_id = c.id
         LEFT JOIN sales s ON e.original_sale_id = s.id
         WHERE e.id = $1`,
      [id]
    );

    if (exchange.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Exchange not found' });
    }

    const returnedItems = await db.query(
      `SELECT eri.*, p.name as product_name, p.sku
         FROM exchange_returned_items eri
         JOIN products p ON eri.product_id = p.id
         WHERE eri.exchange_id = $1`,
      [id]
    );

    const newItems = await db.query(
      `SELECT eni.*, p.name as product_name, p.sku
         FROM exchange_new_items eni
         JOIN products p ON eni.product_id = p.id
         WHERE eni.exchange_id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...exchange.rows[0],
        returned_items: returnedItems.rows,
        new_items: newItems.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
