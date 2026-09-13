import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { salesController } from './controller';

const router: Router = Router();

// GET /api/v1/sales — had no role check at all (#172)
router.get('/', verifyToken, requireRole('Admin', 'Cashier'), (req, res, next) =>
  salesController.getSales(req, res, next)
);
router.get('/:id', verifyToken, (req, res, next) => salesController.getSaleById(req, res, next));
router.post('/', verifyToken, requireRole('Admin', 'Cashier'), (req, res, next) =>
  salesController.createSale(req, res, next)
);
router.post('/:id/refund', verifyToken, requireRole('Admin', 'Cashier'), (req, res, next) =>
  salesController.refundSale(req, res, next)
);

export default router;
