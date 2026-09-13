import { Request, Response, NextFunction } from 'express';
import { deliveryRequestContracts } from './schemas';
import { z } from 'zod';
import { deliverySchema, statusUpdateSchema } from '../../../../validators/deliverySchema';
import type { DeliveryHistoryFilters, DeliveryOrderFilters } from './types';
import { AuthRequest } from '../../../../middleware/auth';
import { deliveryService } from './service';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = deliveryRequestContracts;

export class DeliveryController {
  async getDeliveryOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.listDeliveries.parseQuery<DeliveryOrderFilters>(req.query);
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
      const { id } = contracts.getDelivery.parseParams<{ id: string }>(req.params);
      const order = await deliveryService.getDeliveryOrder(id);
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
      const parsed = contracts.createDelivery.parseBody<z.infer<typeof deliverySchema>>(req.body);

      // The service says what kind of refusal a failure was (#47), so there is nothing
      // to catch and re-map here; the outer handler passes it to `next` as it is.
      const order = await deliveryService.createDeliveryOrder(parsed);
      res.status(201).json(success(order));
    } catch (err) {
      next(err);
    }
  }

  async updateDeliveryOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = contracts.updateDelivery.parseBody<z.infer<typeof deliverySchema>>(req.body);

      const { id } = contracts.updateDelivery.parseParams<{ id: string }>(req.params);
      const order = await deliveryService.updateDeliveryOrder(id, parsed);
      res.json(success(order));
    } catch (err) {
      next(err);
    }
  }

  async updateDeliveryStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = contracts.updateDeliveryStatus.parseBody<z.infer<typeof statusUpdateSchema>>(
        req.body
      );
      const { id } = contracts.updateDeliveryStatus.parseParams<{ id: string }>(req.params);

      const authReq = req as AuthRequest;
      const order = await deliveryService.updateDeliveryStatus(id, parsed, authReq.user!.id);

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
      const query = contracts.getDeliveryHistory.parseQuery<DeliveryHistoryFilters>(req.query);
      const { id } = contracts.getDeliveryHistory.parseParams<{ id: string }>(req.params);
      const result = await deliveryService.getOrderStatusHistory(id, query);
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
