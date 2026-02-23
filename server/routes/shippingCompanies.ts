import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken, requireRole } from '../middleware/auth';
import { shippingCompanySchema } from '../validators/shippingCompanySchema';

const router: Router = Router();

// GET /api/shipping-companies
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search } = req.query;
      let query = 'SELECT * FROM shipping_companies';
      const params: unknown[] = [];

      if (search) {
        query += ' WHERE name LIKE ?';
        params.push(`%${search}%`);
      }

      query += ' ORDER BY name';

      const result = await db.query(query, params);
      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/shipping-companies
router.post(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = shippingCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { name, phone, website } = parsed.data;
      const result = await db.query(
        `INSERT INTO shipping_companies (name, phone, website) VALUES (?, ?, ?) RETURNING *`,
        [name, phone || null, website || null]
      );

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/shipping-companies/:id
router.put(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = shippingCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { name, phone, website } = parsed.data;
      const result = await db.query(
        `UPDATE shipping_companies SET name=?, phone=?, website=? WHERE id=? RETURNING *`,
        [name, phone || null, website || null, req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Shipping company not found' });
      }
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/shipping-companies/:id
router.delete(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refs = await db.query<{ count: number }>(
        'SELECT COUNT(*) as count FROM delivery_orders WHERE shipping_company_id = ?',
        [req.params.id]
      );
      if (refs.rows[0].count > 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot delete: ${refs.rows[0].count} order(s) reference this shipping company`,
        });
      }

      const result = await db.query('DELETE FROM shipping_companies WHERE id = ? RETURNING id', [
        req.params.id,
      ]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Shipping company not found' });
      }
      res.json({ success: true, data: { message: 'Shipping company deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
