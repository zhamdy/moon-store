import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { exportsController } from './controller';

const router: Router = Router();

// GET /api/exports/products — Export products as CSV
router.get('/products', verifyToken, requireRole('Admin'), (req, res, next) =>
  exportsController.exportProducts(req, res, next)
);

// GET /api/exports/sales — Export sales transactions as CSV
router.get('/sales', verifyToken, requireRole('Admin'), (req, res, next) =>
  exportsController.exportSales(req, res, next)
);

// GET /api/exports/customers — Export customer list as CSV
router.get('/customers', verifyToken, requireRole('Admin'), (req, res, next) =>
  exportsController.exportCustomers(req, res, next)
);

export default router;
