import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { warrantyController } from './controller';

const router: Router = Router();

// GET /api/warranty
router.get('/', verifyToken, requireRole('Admin', 'Cashier'), (req, res, next) =>
  warrantyController.listClaims(req, res, next)
);

// POST /api/warranty
router.post('/', verifyToken, requireRole('Admin', 'Cashier'), (req, res, next) =>
  warrantyController.createClaim(req, res, next)
);

// PUT /api/warranty/:id
router.put('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  warrantyController.updateClaim(req, res, next)
);

export default router;
