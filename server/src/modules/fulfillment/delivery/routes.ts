import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { deliveryController } from './controller';

const router: Router = Router();

// GET /api/delivery
router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  deliveryController.getDeliveryOrders(req, res, next)
);

// GET /api/delivery/analytics/performance
router.get('/analytics/performance', verifyToken, requireRole('Admin'), (req, res, next) =>
  deliveryController.getDeliveryPerformance(req, res, next)
);

// GET /api/delivery/:id
router.get('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
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

// PUT /api/delivery/:id/status
router.put('/:id/status', verifyToken, requireRole('Admin'), (req, res, next) =>
  deliveryController.updateDeliveryStatus(req, res, next)
);

// GET /api/delivery/:id/history
router.get('/:id/history', verifyToken, requireRole('Admin'), (req, res, next) =>
  deliveryController.getOrderStatusHistory(req, res, next)
);

export default router;
