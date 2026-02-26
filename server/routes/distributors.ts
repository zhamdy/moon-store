import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken, requireRole } from '../middleware/auth';
import { distributorSchema } from '../validators/distributorSchema';
import { cacheControl } from '../middleware/cache';

const router: Router = Router();

// GET /api/distributors
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  cacheControl(300),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search } = req.query;
      let query = 'SELECT * FROM distributors';
      const params: unknown[] = [];

      if (search) {
        query += ' WHERE name LIKE ? OR contact_person LIKE ? OR email LIKE ?';
        const s = `%${search}%`;
        params.push(s, s, s);
      }

      query += ' ORDER BY name';

      const result = await db.query(query, params);
      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/distributors/:id
router.get(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query('SELECT * FROM distributors WHERE id = ?', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Distributor not found' });
      }
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/distributors
router.post(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = distributorSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { name, contact_person, phone, email, address, notes } = parsed.data;
      const result = await db.query(
        `INSERT INTO distributors (name, contact_person, phone, email, address, notes)
         VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
        [name, contact_person || null, phone || null, email || null, address || null, notes || null]
      );

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/distributors/:id
router.put(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = distributorSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { name, contact_person, phone, email, address, notes } = parsed.data;
      const result = await db.query(
        `UPDATE distributors SET name=?, contact_person=?, phone=?, email=?, address=?, notes=?, updated_at=datetime('now')
         WHERE id=? RETURNING *`,
        [
          name,
          contact_person || null,
          phone || null,
          email || null,
          address || null,
          notes || null,
          req.params.id,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Distributor not found' });
      }
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/distributors/:id
router.delete(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if any products reference this distributor
      const refs = await db.query<{ count: number }>(
        'SELECT COUNT(*) as count FROM products WHERE distributor_id = ?',
        [req.params.id]
      );
      if (refs.rows[0].count > 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot delete: ${refs.rows[0].count} product(s) reference this distributor`,
        });
      }

      const result = await db.query('DELETE FROM distributors WHERE id = ? RETURNING id', [
        req.params.id,
      ]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Distributor not found' });
      }
      res.json({ success: true, data: { message: 'Distributor deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
