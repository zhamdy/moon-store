import { Router } from 'express';
import { verifyToken, requireRole } from '../../../../middleware/auth';
import { analyticsController } from './controller';

const router: Router = Router();

// GET /api/analytics/dashboard-all — combined endpoint (8-in-1)
router.get('/dashboard-all', verifyToken, requireRole('Admin'), (req, res, next) =>
  analyticsController.getDashboardAll(req, res, next)
);

// GET /api/analytics/dashboard
router.get('/dashboard', verifyToken, requireRole('Admin'), (req, res, next) =>
  analyticsController.getDashboard(req, res, next)
);

// GET /api/analytics/revenue
router.get('/revenue', verifyToken, requireRole('Admin'), (req, res, next) =>
  analyticsController.getRevenue(req, res, next)
);

// GET /api/analytics/top-products
router.get('/top-products', verifyToken, requireRole('Admin'), (req, res, next) =>
  analyticsController.getTopProducts(req, res, next)
);

// GET /api/analytics/payment-methods
router.get('/payment-methods', verifyToken, requireRole('Admin'), (req, res, next) =>
  analyticsController.getPaymentMethods(req, res, next)
);

// GET /api/analytics/orders-per-day
router.get('/orders-per-day', verifyToken, requireRole('Admin'), (req, res, next) =>
  analyticsController.getOrdersPerDay(req, res, next)
);

// GET /api/analytics/cashier-performance
router.get('/cashier-performance', verifyToken, requireRole('Admin'), (req, res, next) =>
  analyticsController.getCashierPerformance(req, res, next)
);

// GET /api/analytics/sales-by-category
router.get('/sales-by-category', verifyToken, requireRole('Admin'), (req, res, next) =>
  analyticsController.getSalesByCategory(req, res, next)
);

// GET /api/analytics/sales-by-distributor
router.get('/sales-by-distributor', verifyToken, requireRole('Admin'), (req, res, next) =>
  analyticsController.getSalesByDistributor(req, res, next)
);

// GET /api/analytics/dead-stock — Products with no sales in X days
router.get('/dead-stock', verifyToken, requireRole('Admin'), (req, res, next) =>
  analyticsController.getDeadStock(req, res, next)
);

// GET /api/analytics/customer-ltv — Customer lifetime value
router.get('/customer-ltv', verifyToken, requireRole('Admin'), (req, res, next) =>
  analyticsController.getCustomerLtv(req, res, next)
);

// GET /api/analytics/hourly-heatmap — Sales by day-of-week and hour
router.get('/hourly-heatmap', verifyToken, requireRole('Admin'), (req, res, next) =>
  analyticsController.getHourlyHeatmap(req, res, next)
);

// GET /api/analytics/abc-classification — ABC/Pareto analysis
router.get('/abc-classification', verifyToken, requireRole('Admin'), (req, res, next) =>
  analyticsController.getAbcClassification(req, res, next)
);

// GET /api/analytics/reorder-suggestions — Auto reorder point suggestions
router.get('/reorder-suggestions', verifyToken, requireRole('Admin'), (req, res, next) =>
  analyticsController.getReorderSuggestions(req, res, next)
);

// POST /api/analytics/inventory-snapshot — Create inventory snapshot
router.post('/inventory-snapshot', verifyToken, requireRole('Admin'), (req, res, next) =>
  analyticsController.createInventorySnapshot(req, res, next)
);

// GET /api/analytics/inventory-snapshots — List snapshots
router.get('/inventory-snapshots', verifyToken, requireRole('Admin'), (req, res, next) =>
  analyticsController.getInventorySnapshots(req, res, next)
);

export default router;
