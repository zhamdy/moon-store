const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { createUserSchema, updateUserSchema } = require('../validators/userSchema');

const router = express.Router();

// GET /api/users
router.get('/', verifyToken, requireRole('Admin'), async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, role, created_at, last_login FROM users ORDER BY created_at DESC'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/delivery
router.get('/delivery', verifyToken, requireRole('Admin'), async (req, res, next) => {
  try {
    const result = await db.query(
      "SELECT id, name, email FROM users WHERE role = 'Delivery' ORDER BY name"
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/users
router.post('/', verifyToken, requireRole('Admin'), async (req, res, next) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const { name, email, password, role } = parsed.data;
    const hash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES (?, ?, ?, ?)
       RETURNING id, name, email, role, created_at`,
      [name, email, hash, role]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }
    next(err);
  }
});

// PUT /api/users/:id
router.put('/:id', verifyToken, requireRole('Admin'), async (req, res, next) => {
  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const { name, email, password, role } = parsed.data;

    // Build update dynamically
    const current = (await db.query('SELECT * FROM users WHERE id = ?', [req.params.id])).rows[0];
    if (!current) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const newName = name || current.name;
    const newEmail = email || current.email;
    const newRole = role || current.role;
    let newHash = current.password_hash;
    if (password) {
      newHash = await bcrypt.hash(password, 10);
    }

    const result = await db.query(
      `UPDATE users SET name=?, email=?, password_hash=?, role=? WHERE id=?
       RETURNING id, name, email, role, created_at, last_login`,
      [newName, newEmail, newHash, newRole, req.params.id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }
    next(err);
  }
});

// DELETE /api/users/:id
router.delete('/:id', verifyToken, requireRole('Admin'), async (req, res, next) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
    }

    const result = await db.query('DELETE FROM users WHERE id = ? RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: { message: 'User deleted' } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
