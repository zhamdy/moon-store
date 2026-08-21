import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { bundlesController } from './controller';

const router: Router = Router();

// GET /api/bundles
router.get('/', verifyToken, (req, res, next) => bundlesController.getBundles(req, res, next));

// GET /api/bundles/:id
router.get('/:id', verifyToken, (req, res, next) =>
  bundlesController.getBundleById(req, res, next)
);

// POST /api/bundles
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  bundlesController.createBundle(req, res, next)
);

// PUT /api/bundles/:id
router.put('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  bundlesController.updateBundle(req, res, next)
);

// DELETE /api/bundles/:id
router.delete('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  bundlesController.deleteBundle(req, res, next)
);

export default router;
