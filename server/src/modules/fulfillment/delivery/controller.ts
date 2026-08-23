import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../../middleware/auth';
import { deliverySchema, statusUpdateSchema } from '../../../../validators/deliverySchema';
import { deliveryService } from './service';
import { parseDeliveryHistoryQuery, parseDeliveryListQuery } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

export class DeliveryController {
  async getDeliveryOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseDeliveryListQuery(req.query);
      const result = await deliveryService.getDeliveryOrders(query);
      res.json(
        success(result.orders, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async getDeliveryPerformance(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await deliveryService.getDeliveryPerformance();
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }

  async getDeliveryOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await deliveryService.getDeliveryOrder(req.params.id as string);
      if (!order) {
        throw new PublicError('NOT_FOUND', 'Delivery order not found');
      }
      res.json(success(order));
    } catch (err) {
      next(err);
    }
  }

  async createDeliveryOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = deliverySchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      try {
        const order = await deliveryService.createDeliveryOrder(parsed.data);
        res.status(201).json(success(order));
      } catch (err: any) {
        if (err.message === 'Customer not found') {
          throw new PublicError('VALIDATION_ERROR', 'Customer not found');
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
        throw parsed.error;
      }

      try {
        const order = await deliveryService.updateDeliveryOrder(
          req.params.id as string,
          parsed.data
        );
        res.json(success(order));
      } catch (err: any) {
        if (err.message === 'Order not found') {
          throw new PublicError('NOT_FOUND', 'Order not found');
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
        throw parsed.error;
      }

      const authReq = req as AuthRequest;
      const order = await deliveryService.updateDeliveryStatus(
        req.params.id as string,
        parsed.data,
        authReq.user!.id
      );

      if (!order) {
        throw new PublicError('NOT_FOUND', 'Order not found');
      }

      res.json(success(order));
    } catch (err) {
      next(err);
    }
  }

  async getOrderStatusHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseDeliveryHistoryQuery(req.query);
      const result = await deliveryService.getOrderStatusHistory(req.params.id as string, query);
      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }
}

export const deliveryController = new DeliveryController();
