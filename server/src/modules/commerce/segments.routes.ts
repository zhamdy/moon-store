import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../../database/pool';
import { verifyToken, requireRole } from '../../../middleware/auth';
import { logAuditFromReq } from '../../../middleware/auditLogger';

const router: Router = Router();

const segmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  rules_json: z.string().min(2),
});

// GET /api/segments
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const segments = await db.query(
        `SELECT s.*,
          (SELECT COUNT(*)::int FROM customer_segment_members WHERE segment_id = s.id) as member_count
         FROM customer_segments s
         ORDER BY s.name ASC`
      );
      res.json({ success: true, data: segments.rows });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/segments
router.post(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = segmentSchema.parse(req.body);

      const result = await db.query(
        `INSERT INTO customer_segments (name, description, rules_json)
         VALUES ($1, $2, $3) RETURNING *`,
        [parsed.name, parsed.description || null, parsed.rules_json]
      );

      logAuditFromReq(req, 'create', 'segment', result.rows[0].id as number, { name: parsed.name });
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// PUT /api/segments/:id
router.put(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const parsed = segmentSchema.parse(req.body);

      const result = await db.query(
        `UPDATE customer_segments SET name = $1, description = $2, rules_json = $3, updated_at = NOW()
         WHERE id = $4 RETURNING *`,
        [parsed.name, parsed.description || null, parsed.rules_json, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Segment not found' });
      }

      logAuditFromReq(req, 'update', 'segment', Number(id));
      res.json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// DELETE /api/segments/:id
router.delete(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await db.query('DELETE FROM customer_segments WHERE id = $1 RETURNING id', [
        id,
      ]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Segment not found' });
      }
      logAuditFromReq(req, 'delete', 'segment', Number(id));
      res.json({ success: true, data: { message: 'Segment deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
