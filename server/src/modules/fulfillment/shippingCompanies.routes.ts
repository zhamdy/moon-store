import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../../database/pool';
import { verifyToken, requireRole } from '../../../middleware/auth';
import { logAuditFromReq } from '../../../middleware/auditLogger';

const router: Router = Router();

const shippingCompanySchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().nullable(),
  tracking_url_template: z.string().max(255).optional(),
  is_active: z.boolean().default(true),
});

// GET /api/shipping-companies
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const companies = await db.query(
        `SELECT sc.*,
          (SELECT COUNT(*)::int FROM delivery_orders WHERE shipping_company_id = sc.id) as order_count
         FROM shipping_companies sc
         ORDER BY sc.is_active DESC, sc.name ASC`
      );
      res.json({ success: true, data: companies.rows });
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
      const parsed = shippingCompanySchema.parse(req.body);

      const result = await db.query(
        `INSERT INTO shipping_companies (name, phone, email, tracking_url_template, is_active)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [
          parsed.name,
          parsed.phone || null,
          parsed.email || null,
          parsed.tracking_url_template || null,
          parsed.is_active ? 1 : 0,
        ]
      );

      logAuditFromReq(req, 'create', 'shipping_company', result.rows[0].id as number, {
        name: parsed.name,
      });
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
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
      const { id } = req.params;
      const parsed = shippingCompanySchema.parse(req.body);

      const result = await db.query(
        `UPDATE shipping_companies SET name = $1, phone = $2, email = $3, tracking_url_template = $4, is_active = $5, updated_at = NOW()
         WHERE id = $6 RETURNING *`,
        [
          parsed.name,
          parsed.phone || null,
          parsed.email || null,
          parsed.tracking_url_template || null,
          parsed.is_active ? 1 : 0,
          id,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Shipping company not found' });
      }

      logAuditFromReq(req, 'update', 'shipping_company', Number(id));
      res.json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
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
      const { id } = req.params;
      const result = await db.query('DELETE FROM shipping_companies WHERE id = $1 RETURNING id', [
        id,
      ]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Shipping company not found' });
      }
      logAuditFromReq(req, 'delete', 'shipping_company', Number(id));
      res.json({ success: true, data: { message: 'Shipping company deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
