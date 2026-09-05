import { Request, Response, NextFunction } from 'express';
import { categorySchema } from '../../../../validators/categorySchema';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { categoriesService } from './service';
import { success } from '../../../http/responses';
import { PublicError } from '../../../http/errors';
import { isUniqueViolation } from '../../../database/constraintErrors';

export class CategoriesController {
  async getCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await categoriesService.findAll();
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }

  async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = categorySchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const { name, code } = parsed.data;
      const category = await categoriesService.create({ name, code });

      logAuditFromReq(req, 'create', 'category', category.id, { name, code });
      res.status(201).json(success(category));
    } catch (err: any) {
      if (isUniqueViolation(err)) {
        next(new PublicError('CONFLICT', 'Category code already exists'));
        return;
      }
      next(err);
    }
  }

  async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = categorySchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const { name, code } = parsed.data;
      const category = await categoriesService.update(req.params.id as string, { name, code });

      if (!category) {
        throw new PublicError('NOT_FOUND', 'Category not found');
      }

      res.json(success(category));
    } catch (err: any) {
      if (isUniqueViolation(err)) {
        next(new PublicError('CONFLICT', 'Category code already exists'));
        return;
      }
      next(err);
    }
  }

  async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await categoriesService.delete(req.params.id as string);
      if (!result.success) {
        const code = result.error === 'Category not found' ? 'NOT_FOUND' : 'CONFLICT';
        throw new PublicError(code, result.error);
      }

      logAuditFromReq(req, 'delete', 'category', req.params.id as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export const categoriesController = new CategoriesController();
