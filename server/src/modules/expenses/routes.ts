import { Router } from 'express';
import { verifyToken, requireRole } from '../../../middleware/auth';
import { expensesController } from './controller';

const router: Router = Router();

router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  expensesController.getExpenses(req, res, next)
);
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  expensesController.createExpense(req, res, next)
);
router.put('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  expensesController.updateExpense(req, res, next)
);
router.delete('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  expensesController.deleteExpense(req, res, next)
);
router.get('/pnl', verifyToken, requireRole('Admin'), (req, res, next) =>
  expensesController.getPnL(req, res, next)
);

export default router;
