import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { stockCountsController } from './controller';

const router: Router = Router();

// GET /api/stock-counts
router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  stockCountsController.getStockCounts(req, res, next)
);

// POST /api/stock-counts
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  stockCountsController.createStockCount(req, res, next)
);

// GET /api/stock-counts/:id
router.get('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  stockCountsController.getStockCountById(req, res, next)
);

// PUT /api/stock-counts/:id/items/:itemId
router.put('/:id/items/:itemId', verifyToken, requireRole('Admin'), (req, res, next) =>
  stockCountsController.updateCountItem(req, res, next)
);

// POST /api/stock-counts/:id/complete
router.post('/:id/complete', verifyToken, requireRole('Admin'), (req, res, next) =>
  stockCountsController.completeStockCount(req, res, next)
);

// POST /api/stock-counts/:id/cancel
router.post('/:id/cancel', verifyToken, requireRole('Admin'), (req, res, next) =>
  stockCountsController.cancelStockCount(req, res, next)
);

export default router;
