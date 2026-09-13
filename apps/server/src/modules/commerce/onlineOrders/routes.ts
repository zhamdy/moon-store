import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { onlineOrdersController } from './controller';

const router: Router = Router();

// POST /api/online-orders (Admin)
// Admin-only until Storefront ships; lift only with a named abuse control (rate limit or hold cap), never back to anonymous stock holds.
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  onlineOrdersController.createOrder(req, res, next)
);

// GET /api/online-orders (Admin)
router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  onlineOrdersController.listOrders(req, res, next)
);

// GET /api/online-orders/:id (Admin)
// Admin-only until Storefront ships; lift only with a named abuse control (rate limit or hold cap), never back to anonymous stock holds.
router.get('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  onlineOrdersController.getOrder(req, res, next)
);

// PUT /api/online-orders/:id/status (Admin)
router.put('/:id/status', verifyToken, requireRole('Admin'), (req, res, next) =>
  onlineOrdersController.updateStatus(req, res, next)
);

export default router;
