import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { vendorsController } from './controller';

const router: Router = Router();

// GET /api/vendors
router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  vendorsController.listVendors(req, res, next)
);

// POST /api/vendors
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  vendorsController.createVendor(req, res, next)
);

// PUT /api/vendors/:id
router.put('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  vendorsController.updateVendor(req, res, next)
);

// GET /api/vendors/:id/payouts
router.get('/:id/payouts', verifyToken, requireRole('Admin'), (req, res, next) =>
  vendorsController.getPayouts(req, res, next)
);

// POST /api/vendors/:id/payouts
router.post('/:id/payouts', verifyToken, requireRole('Admin'), (req, res, next) =>
  vendorsController.createPayout(req, res, next)
);

export default router;
