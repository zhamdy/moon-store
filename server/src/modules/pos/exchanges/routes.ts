import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { exchangesController } from './controller';

const router: Router = Router();

// POST /api/exchanges
router.post(
  '/',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  (req, res, next) => exchangesController.createExchange(req, res, next)
);

// GET /api/exchanges
router.get('/', verifyToken, (req, res, next) =>
  exchangesController.getExchanges(req, res, next)
);

// GET /api/exchanges/:id
router.get('/:id', verifyToken, (req, res, next) =>
  exchangesController.getExchangeById(req, res, next)
);

export default router;
