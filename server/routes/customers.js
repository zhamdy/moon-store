const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { customerSchema } = require('../validators/customerSchema');

const router = express.Router();

// GET /api/customers — list with optional search
router.get('/', verifyToken, requireRole('Admin'), async (req, res, next) => {
  try {
    const { search } = req.query;

    let sql = 'SELECT * FROM customers';
    let params = [];

    if (search) {
      sql += ' WHERE name LIKE ? OR phone LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY name ASC';

    const result = await db.query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/customers
router.post('/', verifyToken, requireRole('Admin'), async (req, res, next) => {
  try {
    const parsed = customerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const { name, phone, address, notes } = parsed.data;

    const result = await db.query(
      `INSERT INTO customers (name, phone, address, notes) VALUES (?, ?, ?, ?) RETURNING *`,
      [name, phone, address || null, notes || null]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/customers/:id
router.put('/:id', verifyToken, requireRole('Admin'), async (req, res, next) => {
  try {
    const parsed = customerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const { name, phone, address, notes } = parsed.data;

    const result = await db.query(
      `UPDATE customers SET name=?, phone=?, address=?, notes=?, updated_at=datetime('now') WHERE id=? RETURNING *`,
      [name, phone, address || null, notes || null, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/customers/:id
router.delete('/:id', verifyToken, requireRole('Admin'), async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM customers WHERE id = ? RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    res.json({ success: true, data: { message: 'Customer deleted' } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
