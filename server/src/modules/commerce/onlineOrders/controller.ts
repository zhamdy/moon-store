import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { onlineOrdersService } from './service';

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
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const order = await onlineOrdersService.createOrder(parsed.data);
      res.status(201).json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }

  async listOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, page = '1', limit = '20', search } = req.query;

      const result = await onlineOrdersService.list({
        status: status as string | undefined,
        page: Number(page),
        limit: Number(limit),
        search: search as string | undefined,
      });

      res.json({
        success: true,
        data: result.rows,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async getOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const order = await onlineOrdersService.findById(id as string);
      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }

      res.json({
        success: true,
        data: order,
      });
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
        res.status(400).json({ success: false, error: 'Invalid status' });
        return;
      }

      const updated = await onlineOrdersService.updateStatus(id as string, status);
      if (!updated) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }

      logAuditFromReq(req, 'status_change', 'online_order', Number(id), { status });
      res.json({ success: true, data: { id, status } });
    } catch (err) {
      next(err);
    }
  }
}

export const onlineOrdersController = new OnlineOrdersController();
