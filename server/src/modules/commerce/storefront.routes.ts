import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../../database/pool';
import { verifyToken, requireRole } from '../../../middleware/auth';
import { cacheControl } from '../../../middleware/cache';

const router: Router = Router();

const bannerSchema = z.object({
  title: z.string().min(1).max(100),
  subtitle: z.string().max(255).optional(),
  image_url: z.string().url().or(z.string().startsWith('/uploads/')),
  link_url: z.string().max(255).optional(),
  position: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

// GET /api/storefront/banners (Public)
router.get(
  '/banners',
  cacheControl(60),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const banners = await db.query(
        `SELECT * FROM storefront_banners WHERE is_active = 1 ORDER BY position ASC, created_at DESC`
      );
      res.json({ success: true, data: banners.rows });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/storefront/banners/all (Admin)
router.get(
  '/banners/all',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const banners = await db.query(
        `SELECT * FROM storefront_banners ORDER BY position ASC, created_at DESC`
      );
      res.json({ success: true, data: banners.rows });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/storefront/banners (Admin)
router.post(
  '/banners',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = bannerSchema.parse(req.body);

      const result = await db.query(
        `INSERT INTO storefront_banners (title, subtitle, image_url, link_url, position, is_active)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          parsed.title,
          parsed.subtitle || null,
          parsed.image_url,
          parsed.link_url || null,
          parsed.position,
          parsed.is_active ? 1 : 0,
        ]
      );

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// PUT /api/storefront/banners/:id (Admin)
router.put(
  '/banners/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const parsed = bannerSchema.parse(req.body);

      const result = await db.query(
        `UPDATE storefront_banners SET title = $1, subtitle = $2, image_url = $3, link_url = $4, position = $5, is_active = $6
         WHERE id = $7 RETURNING *`,
        [
          parsed.title,
          parsed.subtitle || null,
          parsed.image_url,
          parsed.link_url || null,
          parsed.position,
          parsed.is_active ? 1 : 0,
          id,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Banner not found' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// DELETE /api/storefront/banners/:id (Admin)
router.delete(
  '/banners/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await db.query('DELETE FROM storefront_banners WHERE id = $1 RETURNING id', [
        id,
      ]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Banner not found' });
      }
      res.json({ success: true, data: { message: 'Banner deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
