import { Router } from 'express';
import { verifyToken, requireRole } from '../../../middleware/auth';
import { purchaseOrdersController } from './controller';

const router: Router = Router();

router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  purchaseOrdersController.getOrders(req, res, next)
);
router.get('/auto-generate', verifyToken, requireRole('Admin'), (req, res, next) =>
  purchaseOrdersController.getAutoGenerate(req, res, next)
);
router.get('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  purchaseOrdersController.getOrderById(req, res, next)
);
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  purchaseOrdersController.createOrder(req, res, next)
);
router.put('/:id/status', verifyToken, requireRole('Admin'), (req, res, next) =>
  purchaseOrdersController.updateStatus(req, res, next)
);
router.post('/:id/receive', verifyToken, requireRole('Admin'), (req, res, next) =>
  purchaseOrdersController.receiveOrder(req, res, next)
);
router.delete('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  purchaseOrdersController.deleteOrder(req, res, next)
);

export default router;
