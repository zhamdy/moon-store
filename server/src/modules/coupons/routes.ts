import { Router } from 'express';
import { verifyToken, requireRole } from '../../../middleware/auth';
import { couponsController } from './controller';

const router: Router = Router();

router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  couponsController.getCoupons(req, res, next)
);
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  couponsController.createCoupon(req, res, next)
);
router.put('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  couponsController.updateCoupon(req, res, next)
);
router.delete('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  couponsController.deleteCoupon(req, res, next)
);
router.post('/validate', verifyToken, (req, res, next) =>
  couponsController.validateCoupon(req, res, next)
);

export default router;
