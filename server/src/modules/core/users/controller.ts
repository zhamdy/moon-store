import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../../middleware/auth';
import { createUserSchema, updateUserSchema } from '../../../../validators/userSchema';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { usersService } from './service';
import { parseUserListQuery } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';
import { z } from 'zod';
import { isUniqueViolation } from '../../../database/constraintErrors';

const favoritesSchema = z.object({ favorites: z.array(z.unknown()).max(100) }).strict();

export class UsersController {
  async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseUserListQuery(req.query);
      const result = await usersService.list(query);
      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async getDeliveryUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deliveryUsers = await usersService.listDeliveryUsers();
      res.json(success(deliveryUsers));
    } catch (err) {
      next(err);
    }
  }

  async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const createdUser = await usersService.create(parsed.data);
      logAuditFromReq(req, 'create', 'user', createdUser.id, {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
      });

      res.status(201).json(success(createdUser));
    } catch (err: any) {
      if (isUniqueViolation(err)) {
        next(new PublicError('CONFLICT', 'Email already exists'));
        return;
      }
      if (err.statusCode) {
        next(
          new PublicError(err.statusCode === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', err.message)
        );
        return;
      }
      next(err);
    }
  }

  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = updateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const updatedUser = await usersService.update(req.params.id as string, parsed.data);
      res.json(success(updatedUser));
    } catch (err: any) {
      if (isUniqueViolation(err)) {
        next(new PublicError('CONFLICT', 'Email already exists'));
        return;
      }
      if (err.statusCode) {
        next(
          new PublicError(err.statusCode === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', err.message)
        );
        return;
      }
      next(err);
    }
  }

  async getFavorites(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const favorites = await usersService.getFavorites(authReq.user!.id);
      res.json(success(favorites));
    } catch (err) {
      next(err);
    }
  }

  async updateFavorites(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const { favorites } = favoritesSchema.parse(req.body);

      const updated = await usersService.updateFavorites(authReq.user!.id, favorites);
      res.json(success(updated));
    } catch (err) {
      next(err);
    }
  }

  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      await usersService.delete(req.params.id as string, authReq.user!.id);
      logAuditFromReq(req, 'delete', 'user', req.params.id as string);
      res.status(204).send();
    } catch (err: any) {
      if (err.statusCode) {
        next(
          new PublicError(err.statusCode === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', err.message)
        );
        return;
      }
      next(err);
    }
  }
}

export const usersController = new UsersController();
