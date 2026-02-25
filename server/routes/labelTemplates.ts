import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken, requireRole } from '../middleware/auth';
import { z } from 'zod';

const router: Router = Router();

const templateSchema = z.object({
  name: z.string().min(1),
  template_json: z.string(),
  is_default: z.boolean().optional(),
});

// GET /api/label-templates
router.get('/', verifyToken, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query('SELECT * FROM label_templates ORDER BY is_default DESC, name');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/label-templates
router.post(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = templateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { name, template_json, is_default } = parsed.data;
      const rawDb = db.db;

      if (is_default) {
        rawDb.prepare('UPDATE label_templates SET is_default = 0').run();
      }

      const result = rawDb
        .prepare(
          'INSERT INTO label_templates (name, template_json, is_default) VALUES (?, ?, ?) RETURNING *'
        )
        .get(name, template_json, is_default ? 1 : 0) as Record<string, any>;

      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/label-templates/:id
router.put(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = templateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { name, template_json, is_default } = parsed.data;
      const rawDb = db.db;

      if (is_default) {
        rawDb.prepare('UPDATE label_templates SET is_default = 0').run();
      }

      const result = await db.query(
        'UPDATE label_templates SET name = ?, template_json = ?, is_default = ? WHERE id = ? RETURNING *',
        [name, template_json, is_default ? 1 : 0, req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/label-templates/:id
router.delete(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query('DELETE FROM label_templates WHERE id = ? RETURNING id', [
        req.params.id,
      ]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }
      res.json({ success: true, data: { message: 'Template deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
