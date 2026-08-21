import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { layawayController } from './controller';

const router: Router = Router();

// POST /api/layaway
router.post(
  '/',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  (req, res, next) => layawayController.createPlan(req, res, next)
);

// GET /api/layaway
router.get('/', verifyToken, (req, res, next) =>
  layawayController.getPlans(req, res, next)
);

// GET /api/layaway/:id
router.get('/:id', verifyToken, (req, res, next) =>
  layawayController.getPlanById(req, res, next)
);

// POST /api/layaway/:id/pay
router.post(
  '/:id/pay',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  (req, res, next) => layawayController.payInstallment(req, res, next)
);

// POST /api/layaway/:id/cancel
router.post(
  '/:id/cancel',
  verifyToken,
  requireRole('Admin'),
  (req, res, next) => layawayController.cancelPlan(req, res, next)
);

export default router;
