import { Router, Request, Response, NextFunction } from 'express';
import db from '../../database/pool';
import { verifyToken, requireRole } from '../../../middleware/auth';
import { distributorSchema } from '../../../validators/distributorSchema';
import { logAuditFromReq } from '../../../middleware/auditLogger';

const router: Router = Router();

// GET /api/distributors
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT d.*,
                (SELECT COUNT(*)::int FROM products p WHERE p.distributor_id = d.id AND p.status = 'active') as product_count
         FROM distributors d
         ORDER BY d.name`
      );
      res.json({ success: true, data: result.rows });
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
        `INSERT INTO distributors (name, contact_info, phone, email, address, notes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [name, contact_person || null, phone || null, email || null, address || null, notes || null]
      );

      logAuditFromReq(req, 'create', 'distributor', result.rows[0].id as number, { name });
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
        `UPDATE distributors SET name = $1, contact_info = $2, phone = $3, email = $4, address = $5, notes = $6, updated_at = NOW()
         WHERE id = $7 RETURNING *`,
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
      // Check if distributor has products
      const countResult = await db.query<{ count: string | number }>(
        'SELECT COUNT(*)::int as count FROM products WHERE distributor_id = $1',
        [req.params.id]
      );
      if (Number(countResult.rows[0]?.count || 0) > 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete distributor with associated products',
        });
      }

      const result = await db.query('DELETE FROM distributors WHERE id = $1 RETURNING id', [
        req.params.id,
      ]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Distributor not found' });
      }

      logAuditFromReq(req, 'delete', 'distributor', req.params.id as string);
      res.json({ success: true, data: { message: 'Distributor deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
