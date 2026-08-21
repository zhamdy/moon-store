import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { reportsController } from './controller';

const router: Router = Router();

// GET /api/reports/sales — Detailed sales report with grouping
router.get('/sales', verifyToken, requireRole('Admin'), (req, res, next) =>
  reportsController.getSalesReport(req, res, next)
);

// GET /api/reports/inventory — Current inventory valuation and status report
router.get('/inventory', verifyToken, requireRole('Admin'), (req, res, next) =>
  reportsController.getInventoryReport(req, res, next)
);

// GET /api/reports/profit-loss — Profit & Loss statement
router.get('/profit-loss', verifyToken, requireRole('Admin'), (req, res, next) =>
  reportsController.getProfitLossReport(req, res, next)
);

export default router;
