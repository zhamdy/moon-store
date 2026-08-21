import { Router } from 'express';
import { verifyToken, requireRole } from '../../../middleware/auth';
import { customersController } from './controller';

const router: Router = Router();

router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  customersController.getCustomers(req, res, next)
);
router.post('/', verifyToken, requireRole('Admin', 'Cashier'), (req, res, next) =>
  customersController.createCustomer(req, res, next)
);
router.put('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  customersController.updateCustomer(req, res, next)
);
router.get('/:id/stats', verifyToken, requireRole('Admin'), (req, res, next) =>
  customersController.getStats(req, res, next)
);
router.get('/:id/sales', verifyToken, requireRole('Admin'), (req, res, next) =>
  customersController.getSales(req, res, next)
);
router.get('/:id/loyalty', verifyToken, requireRole('Admin', 'Cashier'), (req, res, next) =>
  customersController.getLoyalty(req, res, next)
);
router.post('/:id/loyalty/adjust', verifyToken, requireRole('Admin'), (req, res, next) =>
  customersController.adjustLoyalty(req, res, next)
);
router.delete('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  customersController.deleteCustomer(req, res, next)
);

export default router;
