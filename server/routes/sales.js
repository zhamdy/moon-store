const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { saleSchema } = require('../validators/saleSchema');

const router = express.Router();

// GET /api/sales/stats/summary  (must be before /:id)
router.get('/stats/summary', verifyToken, requireRole('Admin', 'Cashier'), async (req, res, next) => {
  try {
    const today = await db.query(
      `SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as count
       FROM sales WHERE date(created_at) = date('now')`
    );
    const month = await db.query(
      `SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as count
       FROM sales WHERE created_at >= date('now', 'start of month')`
    );

    res.json({
      success: true,
      data: {
        today_revenue: today.rows[0].revenue,
        today_sales: today.rows[0].count,
        month_revenue: month.rows[0].revenue,
        month_sales: month.rows[0].count,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/sales
router.post('/', verifyToken, requireRole('Admin', 'Cashier'), async (req, res, next) => {
  try {
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const { items, discount, discount_type, payment_method } = parsed.data;

    // Calculate total
    let subtotal = 0;
    for (const item of items) {
      subtotal += item.unit_price * item.quantity;
    }

    let discountAmount = discount;
    if (discount_type === 'percentage') {
      discountAmount = (subtotal * discount) / 100;
    }
    const total = Math.max(0, subtotal - discountAmount);

    // Use raw db for transaction
    const rawDb = db.db;
    const txn = rawDb.transaction(() => {
      const saleResult = rawDb.prepare(
        `INSERT INTO sales (total, discount, discount_type, payment_method, cashier_id)
         VALUES (?, ?, ?, ?, ?) RETURNING *`
      ).get(total, discount, discount_type, payment_method, req.user.id);

      for (const item of items) {
        rawDb.prepare(
          'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)'
        ).run(saleResult.id, item.product_id, item.quantity, item.unit_price);

        const updated = rawDb.prepare(
          "UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ? AND stock >= ?"
        ).run(item.quantity, item.product_id, item.quantity);

        if (updated.changes === 0) {
          throw new Error(`Insufficient stock for product ID ${item.product_id}`);
        }
      }

      return saleResult;
    });

    let sale;
    try {
      sale = txn();
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    // Fetch full sale with items
    const saleItems = (await db.query(
      `SELECT si.*, p.name as product_name
       FROM sale_items si JOIN products p ON si.product_id = p.id
       WHERE si.sale_id = ?`,
      [sale.id]
    )).rows;

    const cashier = (await db.query('SELECT name FROM users WHERE id = ?', [req.user.id])).rows[0];

    res.status(201).json({
      success: true,
      data: { ...sale, cashier_name: cashier?.name, items: saleItems },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/sales
router.get('/', verifyToken, requireRole('Admin', 'Cashier'), async (req, res, next) => {
  try {
    const { page = 1, limit = 25, from, to, payment_method, cashier_id, search } = req.query;
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];

    if (from) {
      where.push(`s.created_at >= ?`);
      params.push(from);
    }
    if (to) {
      where.push(`s.created_at <= ?`);
      params.push(to + ' 23:59:59');
    }
    if (payment_method) {
      where.push(`s.payment_method = ?`);
      params.push(payment_method);
    }
    if (cashier_id) {
      where.push(`s.cashier_id = ?`);
      params.push(cashier_id);
    }
    if (search) {
      where.push(`CAST(s.id AS TEXT) LIKE ?`);
      params.push(`%${search}%`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM sales s ${whereClause}`, params
    );
    const total = countResult.rows[0].count;

    const revenueResult = await db.query(
      `SELECT COALESCE(SUM(total), 0) as total_revenue FROM sales s ${whereClause}`, params
    );

    const result = await db.query(
      `SELECT s.*, u.name as cashier_name,
        (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as items_count
       FROM sales s
       LEFT JOIN users u ON s.cashier_id = u.id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        total_revenue: revenueResult.rows[0].total_revenue,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/sales/:id
router.get('/:id', verifyToken, requireRole('Admin', 'Cashier'), async (req, res, next) => {
  try {
    const saleResult = await db.query(
      `SELECT s.*, u.name as cashier_name
       FROM sales s LEFT JOIN users u ON s.cashier_id = u.id
       WHERE s.id = ?`,
      [req.params.id]
    );

    if (saleResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Sale not found' });
    }

    const items = await db.query(
      `SELECT si.*, p.name as product_name
       FROM sale_items si JOIN products p ON si.product_id = p.id
       WHERE si.sale_id = ?`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...saleResult.rows[0], items: items.rows } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
