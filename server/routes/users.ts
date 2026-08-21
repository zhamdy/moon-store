import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import db from '../src/database/pool';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { createUserSchema, updateUserSchema } from '../validators/userSchema';
import { logAuditFromReq } from '../middleware/auditLogger';
import { cacheControl } from '../middleware/cache';

const router: Router = Router();

// GET /api/users
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        'SELECT id, name, email, role, created_at, last_login FROM users ORDER BY created_at DESC'
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/users/delivery
router.get(
  '/delivery',
  verifyToken,
  requireRole('Admin'),
  cacheControl(60),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        "SELECT id, name, email FROM users WHERE role = 'Delivery' ORDER BY name"
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/users
router.post(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { name, email, password, role } = parsed.data;
      const hash = await bcrypt.hash(password, 10);

      const result = await db.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, role, created_at`,
        [name, email, hash, role]
      );

      const createdUser = result.rows[0];
      logAuditFromReq(req, 'create', 'user', createdUser.id as number, { name, email, role });
      res.status(201).json({ success: true, data: createdUser });
    } catch (err: any) {
      if (
        err.code === '23505' ||
        err.message?.includes('UNIQUE') ||
        err.message?.includes('duplicate key')
      ) {
        return res.status(409).json({ success: false, error: 'Email already exists' });
      }
      next(err);
    }
  }
);

// PUT /api/users/:id
router.put(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { name, email, password, role } = parsed.data;

      // Build update dynamically
      const current = (await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]))
        .rows[0] as Record<string, any> | undefined;
      if (!current) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const newName = name || current.name;
      const newEmail = email || current.email;
      const newRole = role || current.role;
      let newHash = current.password_hash as string;
      if (password) {
        newHash = await bcrypt.hash(password, 10);
      }

      const result = await db.query(
        `UPDATE users SET name = $1, email = $2, password_hash = $3, role = $4 WHERE id = $5
         RETURNING id, name, email, role, created_at, last_login`,
        [newName, newEmail, newHash, newRole, req.params.id]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      if (
        err.code === '23505' ||
        err.message?.includes('UNIQUE') ||
        err.message?.includes('duplicate key')
      ) {
        return res.status(409).json({ success: false, error: 'Email already exists' });
      }
      next(err);
    }
  }
);

// GET /api/users/me/favorites
router.get(
  '/me/favorites',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const result = await db.query('SELECT favorites FROM users WHERE id = $1', [
        authReq.user!.id,
      ]);
      const rawFav = result.rows[0]?.favorites;
      const favorites = typeof rawFav === 'string' ? JSON.parse(rawFav) : rawFav || [];
      res.json({ success: true, data: favorites });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/users/me/favorites
router.put(
  '/me/favorites',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { favorites } = req.body;
      if (!Array.isArray(favorites)) {
        return res.status(400).json({ success: false, error: 'Favorites must be an array' });
      }
      await db.query('UPDATE users SET favorites = $1 WHERE id = $2', [
        JSON.stringify(favorites),
        authReq.user!.id,
      ]);
      res.json({ success: true, data: favorites });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/users/:id
router.delete(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      if (parseInt(req.params.id as string) === authReq.user!.id) {
        return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
      }

      const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [
        req.params.id,
      ]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      logAuditFromReq(req, 'delete', 'user', req.params.id as string);
      res.json({ success: true, data: { message: 'User deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
