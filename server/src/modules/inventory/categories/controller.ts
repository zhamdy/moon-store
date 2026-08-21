import { Request, Response, NextFunction } from 'express';
import { categorySchema } from '../../../../validators/categorySchema';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { categoriesService } from './service';

export class CategoriesController {
  async getCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await categoriesService.findAll();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = categorySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const { name, code } = parsed.data;
      const category = await categoriesService.create({ name, code });

      logAuditFromReq(req, 'create', 'category', category.id, { name, code });
      res.status(201).json({ success: true, data: category });
    } catch (err: any) {
      if (
        err.code === '23505' ||
        err.message?.includes('UNIQUE') ||
        err.message?.includes('duplicate key')
      ) {
        res.status(409).json({ success: false, error: 'Category code already exists' });
        return;
      }
      next(err);
    }
  }

  async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = categorySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const { name, code } = parsed.data;
      const category = await categoriesService.update(req.params.id as string, { name, code });

      if (!category) {
        res.status(404).json({ success: false, error: 'Category not found' });
        return;
      }

      res.json({ success: true, data: category });
    } catch (err: any) {
      if (
        err.code === '23505' ||
        err.message?.includes('UNIQUE') ||
        err.message?.includes('duplicate key')
      ) {
        res.status(409).json({ success: false, error: 'Category code already exists' });
        return;
      }
      next(err);
    }
  }

  async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await categoriesService.delete(req.params.id as string);
      if (!result.success) {
        const statusCode = result.error === 'Category not found' ? 404 : 400;
        res.status(statusCode).json({ success: false, error: result.error });
        return;
      }

      logAuditFromReq(req, 'delete', 'category', req.params.id as string);
      res.json({ success: true, data: { message: 'Category deleted' } });
    } catch (err) {
      next(err);
    }
  }
}

export const categoriesController = new CategoriesController();
