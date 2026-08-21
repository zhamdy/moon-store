import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { deliverySchema, statusUpdateSchema } from '../../../validators/deliverySchema';
import { deliveryService } from './service';

export class DeliveryController {
  async getDeliveryOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, status, search } = req.query;
      const result = await deliveryService.getDeliveryOrders({
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

  async getPerformance(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await deliveryService.getDeliveryPerformance();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getDeliveryOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await deliveryService.getDeliveryOrder(req.params.id as string);
      if (!order) {
        res.status(404).json({ success: false, error: 'Delivery order not found' });
        return;
      }
      res.json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }

  async createDeliveryOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = deliverySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      try {
        const order = await deliveryService.createDeliveryOrder(parsed.data);
        res.status(201).json({ success: true, data: order });
      } catch (err: any) {
        if (err.message === 'Customer not found') {
          res.status(400).json({ success: false, error: 'Customer not found' });
          return;
        }
        throw err;
      }
    } catch (err) {
      next(err);
    }
  }

  async updateDeliveryOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = deliverySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      try {
        const order = await deliveryService.updateDeliveryOrder(
          req.params.id as string,
          parsed.data
        );
        res.json({ success: true, data: order });
      } catch (err: any) {
        if (err.message === 'Order not found') {
          res.status(404).json({ success: false, error: 'Order not found' });
          return;
        }
        throw err;
      }
    } catch (err) {
      next(err);
    }
  }

  async updateDeliveryStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = statusUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const authReq = req as AuthRequest;
      const order = await deliveryService.updateDeliveryStatus(
        req.params.id as string,
        parsed.data,
        authReq.user!.id
      );

      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }

      res.json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }

  async getStatusHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await deliveryService.getOrderStatusHistory(req.params.id as string);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const deliveryController = new DeliveryController();
