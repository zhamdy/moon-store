import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { deliverySchema, statusUpdateSchema } from '../validators/deliverySchema';
import {
  getDeliveryOrders,
  getDeliveryPerformance,
  getDeliveryOrder,
  createDeliveryOrder,
  updateDeliveryOrder,
  updateDeliveryStatus,
  getOrderStatusHistory,
} from '../services/deliveryService';

const router: Router = Router();

// GET /api/delivery
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, status, search } = req.query;
      const result = await getDeliveryOrders({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        status: status as string | undefined,
        search: search as string | undefined,
      });

      res.json({
        success: true,
        data: result.orders,
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/delivery/analytics/performance
router.get(
  '/analytics/performance',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getDeliveryPerformance();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/delivery/:id
router.get(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await getDeliveryOrder(req.params.id as string);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Delivery order not found' });
      }
      res.json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/delivery
router.post(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = deliverySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      try {
        const order = createDeliveryOrder(parsed.data);
        res.status(201).json({ success: true, data: order });
      } catch (err: any) {
        if (err.message === 'Customer not found') {
          return res.status(400).json({ success: false, error: 'Customer not found' });
        }
        throw err;
      }
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/delivery/:id
router.put(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = deliverySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      try {
        const order = updateDeliveryOrder(req.params.id as string, parsed.data);
        res.json({ success: true, data: order });
      } catch (err: any) {
        if (err.message === 'Order not found') {
          return res.status(404).json({ success: false, error: 'Order not found' });
        }
        throw err;
      }
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/delivery/:id/status
router.put(
  '/:id/status',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = statusUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const authReq = req as AuthRequest;
      const order = await updateDeliveryStatus(
        req.params.id as string,
        parsed.data,
        authReq.user!.id
      );

      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      res.json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/delivery/:id/history
router.get(
  '/:id/history',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getOrderStatusHistory(req.params.id as string);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
