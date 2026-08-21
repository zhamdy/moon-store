import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { categoriesController } from './controller';

const router: Router = Router();

// GET /api/categories
router.get('/', verifyToken, (req, res, next) => categoriesController.getCategories(req, res, next));

// POST /api/categories
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  categoriesController.createCategory(req, res, next)
);

// PUT /api/categories/:id
router.put('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  categoriesController.updateCategory(req, res, next)
);

// DELETE /api/categories/:id
router.delete('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  categoriesController.deleteCategory(req, res, next)
);

export default router;
