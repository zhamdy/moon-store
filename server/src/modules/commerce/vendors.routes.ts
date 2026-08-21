import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../../database/pool';
import { verifyToken, requireRole } from '../../../middleware/auth';
import { logAuditFromReq } from '../../../middleware/auditLogger';

const router: Router = Router();

const vendorSchema = z.object({
  name: z.string().min(1).max(100),
  contact_person: z.string().max(100).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(30).optional(),
  address: z.string().max(255).optional(),
  tax_number: z.string().max(50).optional(),
  commission_rate: z.number().min(0).max(100).default(0),
  status: z.enum(['active', 'inactive']).default('active'),
});

// GET /api/vendors
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, page = '1', limit = '20', search } = req.query;
      const offset = (Number(page) - 1) * Number(limit);
      const params: unknown[] = [];
      let where = 'WHERE 1=1';

      if (status && status !== 'all') {
        params.push(status);
        where += ` AND v.status = $${params.length}`;
      }
      if (search) {
        params.push(`%${search}%`);
        where += ` AND (v.name ILIKE $${params.length} OR v.contact_person ILIKE $${params.length} OR v.phone ILIKE $${params.length})`;
      }

      const countResult = await db.query<{ total: number }>(
        `SELECT COUNT(*)::int as total FROM vendors v ${where}`,
        params
      );

      const limitIdx = params.length + 1;
      const offsetIdx = params.length + 2;

      const vendors = await db.query(
        `SELECT v.*,
          (SELECT COUNT(*)::int FROM products WHERE distributor_id = v.id) as product_count
         FROM vendors v
         ${where}
         ORDER BY v.name ASC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        [...params, Number(limit), offset]
      );

      res.json({
        success: true,
        data: vendors.rows,
        meta: {
          total: Number(countResult.rows[0]?.total || 0),
          page: Number(page),
          limit: Number(limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/vendors
router.post(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = vendorSchema.parse(req.body);

      const result = await db.query(
        `INSERT INTO vendors (name, contact_person, email, phone, address, tax_number, commission_rate, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          parsed.name,
          parsed.contact_person || null,
          parsed.email || null,
          parsed.phone || null,
          parsed.address || null,
          parsed.tax_number || null,
          parsed.commission_rate,
          parsed.status,
        ]
      );

      logAuditFromReq(req, 'create', 'vendor', result.rows[0].id as number, { name: parsed.name });
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// PUT /api/vendors/:id
router.put(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const parsed = vendorSchema.parse(req.body);

      const result = await db.query(
        `UPDATE vendors SET name = $1, contact_person = $2, email = $3, phone = $4, address = $5,
                tax_number = $6, commission_rate = $7, status = $8, updated_at = NOW()
         WHERE id = $9 RETURNING *`,
        [
          parsed.name,
          parsed.contact_person || null,
          parsed.email || null,
          parsed.phone || null,
          parsed.address || null,
          parsed.tax_number || null,
          parsed.commission_rate,
          parsed.status,
          id,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Vendor not found' });
      }

      logAuditFromReq(req, 'update', 'vendor', Number(id));
      res.json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// GET /api/vendors/:id/payouts
router.get(
  '/:id/payouts',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const payouts = await db.query(
        `SELECT vp.*, u.name as created_by_name
         FROM vendor_payouts vp
         JOIN users u ON vp.created_by = u.id
         WHERE vp.vendor_id = $1
         ORDER BY vp.created_at DESC`,
        [id]
      );
      res.json({ success: true, data: payouts.rows });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/vendors/:id/payouts
router.post(
  '/:id/payouts',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as any;
      const { id } = req.params;
      const { amount, period_start, period_end, notes } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, error: 'Valid payout amount required' });
      }

      const result = await db.query(
        `INSERT INTO vendor_payouts (vendor_id, amount, period_start, period_end, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [id, amount, period_start || null, period_end || null, notes || null, authReq.user?.id]
      );

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
