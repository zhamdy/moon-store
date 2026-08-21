import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../../middleware/auth';
import { createUserSchema, updateUserSchema } from '../../../../validators/userSchema';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { usersService } from './service';

export class UsersController {
  async getUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await usersService.list();
      res.json({ success: true, data: users });
    } catch (err) {
      next(err);
    }
  }

  async getDeliveryUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deliveryUsers = await usersService.listDeliveryUsers();
      res.json({ success: true, data: deliveryUsers });
    } catch (err) {
      next(err);
    }
  }

  async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const createdUser = await usersService.create(parsed.data);
      logAuditFromReq(req, 'create', 'user', createdUser.id, {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
      });

      res.status(201).json({ success: true, data: createdUser });
    } catch (err: any) {
      if (
        err.code === '23505' ||
        err.message?.includes('UNIQUE') ||
        err.message?.includes('duplicate key')
      ) {
        res.status(409).json({ success: false, error: 'Email already exists' });
        return;
      }
      if (err.statusCode) {
        res.status(err.statusCode).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }

  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = updateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const updatedUser = await usersService.update(req.params.id as string, parsed.data);
      res.json({ success: true, data: updatedUser });
    } catch (err: any) {
      if (
        err.code === '23505' ||
        err.message?.includes('UNIQUE') ||
        err.message?.includes('duplicate key')
      ) {
        res.status(409).json({ success: false, error: 'Email already exists' });
        return;
      }
      if (err.statusCode) {
        res.status(err.statusCode).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }

  async getFavorites(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const favorites = await usersService.getFavorites(authReq.user!.id);
      res.json({ success: true, data: favorites });
    } catch (err) {
      next(err);
    }
  }

  async updateFavorites(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const { favorites } = req.body;
      if (!Array.isArray(favorites)) {
        res.status(400).json({ success: false, error: 'Favorites must be an array' });
        return;
      }

      const updated = await usersService.updateFavorites(authReq.user!.id, favorites);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      await usersService.delete(req.params.id as string, authReq.user!.id);
      logAuditFromReq(req, 'delete', 'user', req.params.id as string);
      res.json({ success: true, data: { message: 'User deleted' } });
    } catch (err: any) {
      if (err.statusCode) {
        res.status(err.statusCode).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }
}

export const usersController = new UsersController();
