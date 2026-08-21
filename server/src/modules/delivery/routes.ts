import { Router } from 'express';
import { verifyToken, requireRole } from '../../../middleware/auth';
import { deliveryController } from './controller';

const router: Router = Router();

router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  deliveryController.getDeliveryOrders(req, res, next)
);
router.get('/analytics/performance', verifyToken, requireRole('Admin'), (req, res, next) =>
  deliveryController.getPerformance(req, res, next)
);
router.get('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  deliveryController.getDeliveryOrder(req, res, next)
);
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  deliveryController.createDeliveryOrder(req, res, next)
);
router.put('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  deliveryController.updateDeliveryOrder(req, res, next)
);
router.put('/:id/status', verifyToken, requireRole('Admin'), (req, res, next) =>
  deliveryController.updateDeliveryStatus(req, res, next)
);
router.get('/:id/history', verifyToken, requireRole('Admin'), (req, res, next) =>
  deliveryController.getStatusHistory(req, res, next)
);

export default router;
