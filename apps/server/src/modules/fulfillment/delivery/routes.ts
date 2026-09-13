import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { deliveryController } from './controller';

const router: Router = Router();

// GET /api/delivery — Delivery sees every delivery, not just its own (#172)
router.get('/', verifyToken, requireRole('Admin', 'Delivery'), (req, res, next) =>
  deliveryController.getDeliveryOrders(req, res, next)
);

// GET /api/delivery/analytics/performance
router.get(
  '/analytics/performance',
  verifyToken,
  requireRole('Admin', 'Delivery'),
  (req, res, next) => deliveryController.getDeliveryPerformance(req, res, next)
);

// GET /api/delivery/:id
router.get('/:id', verifyToken, requireRole('Admin', 'Delivery'), (req, res, next) =>
  deliveryController.getDeliveryOrder(req, res, next)
);

// POST /api/delivery
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  deliveryController.createDeliveryOrder(req, res, next)
);

// PUT /api/delivery/:id
router.put('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  deliveryController.updateDeliveryOrder(req, res, next)
);

// PUT /api/delivery/:id/status — a driver needs to update the delivery they are carrying
router.put('/:id/status', verifyToken, requireRole('Admin', 'Delivery'), (req, res, next) =>
  deliveryController.updateDeliveryStatus(req, res, next)
);

// GET /api/delivery/:id/history
router.get('/:id/history', verifyToken, requireRole('Admin', 'Delivery'), (req, res, next) =>
  deliveryController.getOrderStatusHistory(req, res, next)
);

export default router;
