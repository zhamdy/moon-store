import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { distributorsController } from './controller';

const router: Router = Router();

// GET /api/distributors
router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  distributorsController.getDistributors(req, res, next)
);

// POST /api/distributors
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  distributorsController.createDistributor(req, res, next)
);

// PUT /api/distributors/:id
router.put('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  distributorsController.updateDistributor(req, res, next)
);

// DELETE /api/distributors/:id
router.delete('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  distributorsController.deleteDistributor(req, res, next)
);

export default router;
