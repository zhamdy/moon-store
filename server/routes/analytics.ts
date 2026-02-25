import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, requireRole } from '../middleware/auth';
import {
  getDashboardKpis,
  getRevenueByDate,
  getTopProducts,
  getPaymentMethodBreakdown,
  getOrdersPerDay,
  getCashierPerformance,
  getSalesByCategory,
  getSalesByDistributor,
  getAbcClassification,
  getReorderSuggestions,
  createInventorySnapshot,
  getInventorySnapshots,
} from '../services/analyticsService';

const router: Router = Router();

// GET /api/analytics/dashboard
router.get(
  '/dashboard',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getDashboardKpis();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/analytics/revenue
router.get(
  '/revenue',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query;
      const data = await getRevenueByDate(from, to);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/analytics/top-products
router.get(
  '/top-products',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query;
      const data = await getTopProducts(from, to);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/analytics/payment-methods
router.get(
  '/payment-methods',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query;
      const data = await getPaymentMethodBreakdown(from, to);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/analytics/orders-per-day
router.get(
  '/orders-per-day',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query;
      const data = await getOrdersPerDay(from, to);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/analytics/cashier-performance
router.get(
  '/cashier-performance',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query;
      const data = await getCashierPerformance(from, to);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/analytics/sales-by-category
router.get(
  '/sales-by-category',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query;
      const data = await getSalesByCategory(from, to);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/analytics/sales-by-distributor
router.get(
  '/sales-by-distributor',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query;
      const data = await getSalesByDistributor(from, to);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/analytics/abc-classification — ABC/Pareto analysis
router.get(
  '/abc-classification',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getAbcClassification();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/analytics/reorder-suggestions — Auto reorder point suggestions
router.get(
  '/reorder-suggestions',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getReorderSuggestions();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/analytics/inventory-snapshot — Create inventory snapshot
router.post(
  '/inventory-snapshot',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createInventorySnapshot();
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/analytics/inventory-snapshots — List snapshots
router.get(
  '/inventory-snapshots',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getInventorySnapshots();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
