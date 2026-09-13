import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { stockAdjustmentsController } from './controller';

const router: Router = Router();

// GET /api/stock-adjustments
router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  stockAdjustmentsController.getStockAdjustments(req, res, next)
);

export default router;
