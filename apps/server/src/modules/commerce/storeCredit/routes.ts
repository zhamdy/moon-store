import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { storeCreditController } from './controller';

const router: Router = Router();

// GET /api/v1/store-credit/:id — a customer's balance and its entries
router.get('/:id', verifyToken, (req, res, next) =>
  storeCreditController.getBalance(req, res, next)
);

// POST /api/v1/store-credit/:id/redeem — spend credit against a sale
router.post('/:id/redeem', verifyToken, (req, res, next) =>
  storeCreditController.redeem(req, res, next)
);

// POST /api/v1/store-credit/:id/issue — Admin correction; exchanges issue their own
router.post('/:id/issue', verifyToken, requireRole('Admin'), (req, res, next) =>
  storeCreditController.issue(req, res, next)
);

export default router;
