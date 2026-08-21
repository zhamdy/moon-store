import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../../database/pool';
import { verifyToken, requireRole } from '../../../middleware/auth';
import { logAuditFromReq } from '../../../middleware/auditLogger';

const router: Router = Router();

const warrantyClaimSchema = z.object({
  sale_id: z.number().int().positive().optional(),
  product_id: z.number().int().positive(),
  customer_id: z.number().int().positive().optional(),
  customer_name: z.string().min(1).max(100),
  customer_phone: z.string().min(1).max(30),
  issue_description: z.string().min(1).max(500),
  resolution: z.string().max(500).optional(),
});

// GET /api/warranty
router.get(
  '/',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, page = '1', limit = '20' } = req.query;
      const offset = (Number(page) - 1) * Number(limit);
      const params: unknown[] = [];
      let where = 'WHERE 1=1';

      if (status && status !== 'all') {
        params.push(status);
        where += ` AND w.status = $${params.length}`;
      }

      const countResult = await db.query<{ total: number }>(
        `SELECT COUNT(*)::int as total FROM warranty_claims w ${where}`,
        params
      );

      const limitIdx = params.length + 1;
      const offsetIdx = params.length + 2;

      const claims = await db.query(
        `SELECT w.*, p.name as product_name, p.sku as product_sku
         FROM warranty_claims w
         JOIN products p ON w.product_id = p.id
         ${where}
         ORDER BY w.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        [...params, Number(limit), offset]
      );

      res.json({
        success: true,
        data: claims.rows,
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

// POST /api/warranty
router.post(
  '/',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = warrantyClaimSchema.parse(req.body);

      const result = await db.query(
        `INSERT INTO warranty_claims (sale_id, product_id, customer_id, customer_name, customer_phone, issue_description, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
        [
          parsed.sale_id || null,
          parsed.product_id,
          parsed.customer_id || null,
          parsed.customer_name,
          parsed.customer_phone,
          parsed.issue_description,
        ]
      );

      logAuditFromReq(req, 'create', 'warranty_claim', result.rows[0].id as number);
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// PUT /api/warranty/:id
router.put(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status, resolution } = req.body;

      const result = await db.query(
        `UPDATE warranty_claims SET status = COALESCE($1, status), resolution = COALESCE($2, resolution),
                resolved_at = CASE WHEN $1 IN ('resolved', 'replaced', 'refunded') THEN NOW() ELSE resolved_at END,
                updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [status || null, resolution || null, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Warranty claim not found' });
      }

      logAuditFromReq(req, 'update', 'warranty_claim', Number(id));
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
