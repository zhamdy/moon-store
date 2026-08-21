import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { expensesController } from './controller';

const router: Router = Router();

// GET /api/expenses — List expenses
router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  expensesController.getExpenses(req, res, next)
);

// POST /api/expenses — Create expense
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  expensesController.createExpense(req, res, next)
);

// GET /api/expenses/pnl — Profit & Loss statement
router.get('/pnl', verifyToken, requireRole('Admin'), (req, res, next) =>
  expensesController.getPnl(req, res, next)
);

// PUT /api/expenses/:id — Update expense
router.put('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  expensesController.updateExpense(req, res, next)
);

// DELETE /api/expenses/:id — Delete expense
router.delete('/:id', verifyToken, requireRole('Admin'), (req, res, next) =>
  expensesController.deleteExpense(req, res, next)
);

export default router;
