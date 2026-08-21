import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { onlineOrdersController } from './controller';

const router: Router = Router();

// POST /api/online-orders — Public checkout
router.post('/', (req, res, next) => onlineOrdersController.createOrder(req, res, next));

// GET /api/online-orders (Admin)
router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  onlineOrdersController.listOrders(req, res, next)
);

// GET /api/online-orders/:id
router.get('/:id', verifyToken, (req, res, next) =>
  onlineOrdersController.getOrder(req, res, next)
);

// PUT /api/online-orders/:id/status (Admin)
router.put('/:id/status', verifyToken, requireRole('Admin'), (req, res, next) =>
  onlineOrdersController.updateStatus(req, res, next)
);

export default router;
