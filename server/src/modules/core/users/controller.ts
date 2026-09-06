import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { usersService } from './service';
import type { CreateUserDTO, UpdateUserDTO, UserListQuery } from './types';
import { usersRequestContracts } from './schemas';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';
import { isUniqueViolation } from '../../../database/constraintErrors';

/**
 * Requests are parsed through the contracts, not through schemas this file reaches for
 * directly (#102). The object the document is generated from is therefore the object that
 * decides what is accepted: there is no second description to drift.
 */
const contracts = usersRequestContracts;

export class UsersController {
  async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.listUsers.parseQuery<UserListQuery>(req.query);
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
      const body = contracts.createUser.parseBody<CreateUserDTO>(req.body);

      const createdUser = await usersService.create(body);
      logAuditFromReq(req, 'create', 'user', createdUser.id, {
        name: body.name,
        email: body.email,
        role: body.role,
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
      const body = contracts.updateUser.parseBody<UpdateUserDTO>(req.body);

      const updatedUser = await usersService.update(req.params.id as string, body);
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
      const { favorites } = contracts.updateFavorites.parseBody<{ favorites: unknown[] }>(req.body);

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
