import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { onlineOrdersService } from './service';
import { parseOnlineOrderListQuery } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

export const createOnlineOrderSchema = z.object({
  customer_name: z.string().min(1).max(100),
  customer_phone: z.string().min(1).max(30),
  customer_email: z.string().email().optional().nullable(),
  shipping_address: z.string().min(1).max(255),
  city: z.string().min(1).max(50),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        variant_id: z.number().int().positive().optional().nullable(),
        quantity: z.number().int().positive(),
        price: z.number().positive(),
      })
    )
    .min(1),
  shipping_fee: z.number().min(0).default(0),
});

export class OnlineOrdersController {
  async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createOnlineOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const order = await onlineOrdersService.createOrder(parsed.data);
      res.status(201).json(success(order));
    } catch (err) {
      next(err);
    }
  }

  async listOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseOnlineOrderListQuery(req.query);
      const result = await onlineOrdersService.list(query);
      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async getOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const order = await onlineOrdersService.findById(id as string);
      if (!order) {
        throw new PublicError('NOT_FOUND', 'Order not found');
      }

      res.json(success(order));
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        throw new PublicError('VALIDATION_ERROR', 'Invalid status');
      }

      const updated = await onlineOrdersService.updateStatus(id as string, status);
      if (!updated) {
        throw new PublicError('NOT_FOUND', 'Order not found');
      }

      logAuditFromReq(req, 'status_change', 'online_order', Number(id), { status });
      res.json(success({ id, status }));
    } catch (err) {
      next(err);
    }
  }
}

export const onlineOrdersController = new OnlineOrdersController();
