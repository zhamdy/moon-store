import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { couponsController } from './controller';

const router: Router = Router();

// GET /api/coupons — List all coupons with usage count (Admin only)
router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  couponsController.listCoupons(req, res, next)
);

// POST /api/coupons — Create coupon (Admin only)
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  couponsController.createCoupon(req, res, next)
);

// PUT /api/coupons/:id — Update coupon (Admin only)
router.put('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  couponsController.updateCoupon(req, res, next)
);

// DELETE /api/coupons/:id — Soft delete (set status='inactive') (Admin only)
router.delete('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  couponsController.deleteCoupon(req, res, next)
);

// POST /api/coupons/validate — Validate a coupon code at checkout
router.post('/validate', verifyToken, (req, res, next) =>
  couponsController.validateCoupon(req, res, next)
);

export default router;
