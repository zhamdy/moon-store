import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../../database/pool';
import { verifyToken, requireRole } from '../../../middleware/auth';

const router: Router = Router();

const labelTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  width_mm: z.number().positive(),
  height_mm: z.number().positive(),
  layout_json: z.string().min(2, 'Layout JSON is required'),
  is_default: z.boolean().optional(),
});

// GET /api/label-templates — List templates
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const templates = await db.query(
        'SELECT * FROM label_templates ORDER BY is_default DESC, name ASC'
      );
      res.json({ success: true, data: templates.rows });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/label-templates — Create template
router.post(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = labelTemplateSchema.parse(req.body);

      if (parsed.is_default) {
        await db.query('UPDATE label_templates SET is_default = 0');
      }

      const result = await db.query(
        `INSERT INTO label_templates (name, width_mm, height_mm, layout_json, is_default)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [
          parsed.name,
          parsed.width_mm,
          parsed.height_mm,
          parsed.layout_json,
          parsed.is_default ? 1 : 0,
        ]
      );

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// PUT /api/label-templates/:id — Update template
router.put(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const parsed = labelTemplateSchema.parse(req.body);

      const existing = await db.query('SELECT id FROM label_templates WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }

      if (parsed.is_default) {
        await db.query('UPDATE label_templates SET is_default = 0 WHERE id != $1', [id]);
      }

      const result = await db.query(
        `UPDATE label_templates SET name = $1, width_mm = $2, height_mm = $3, layout_json = $4, is_default = $5
         WHERE id = $6 RETURNING *`,
        [
          parsed.name,
          parsed.width_mm,
          parsed.height_mm,
          parsed.layout_json,
          parsed.is_default ? 1 : 0,
          id,
        ]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// DELETE /api/label-templates/:id — Delete template
router.delete(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const existing = await db.query('SELECT id FROM label_templates WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }

      await db.query('DELETE FROM label_templates WHERE id = $1', [id]);
      res.json({ success: true, data: { message: 'Template deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
