import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { purchaseOrderSchema, receiveSchema } from '../../../validators/purchaseOrderSchema';
import { purchaseOrdersService } from './service';

export class PurchaseOrdersController {
  async getOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 25, status, distributor_id, search } = req.query;
      const result = await purchaseOrdersService.list({
        page: Number(page),
        limit: Number(limit),
        status: status as string | undefined,
        distributor_id: distributor_id ? Number(distributor_id) : undefined,
        search: search as string | undefined,
      });

      res.json({
        success: true,
        data: result.orders,
        meta: { total: result.total, page: Number(page), limit: Number(limit) },
      });
    } catch (err) {
      next(err);
    }
  }

  async getAutoGenerate(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await purchaseOrdersService.getAutoGenerateSuggestions();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await purchaseOrdersService.getOrder(req.params.id as string);
      if (!order) {
        res.status(404).json({ success: false, error: 'Purchase order not found' });
        return;
      }
      res.json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }

  async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = purchaseOrderSchema.parse(req.body);
      const authReq = req as AuthRequest;

      const result = await purchaseOrdersService.createOrder(parsed, authReq.user!.id);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.body;
      const validStatuses = ['Draft', 'Sent', 'Partially Received', 'Received', 'Cancelled'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ success: false, error: 'Invalid status' });
        return;
      }

      const result = await purchaseOrdersService.updateStatus(req.params.id as string, status);
      if (!result) {
        res.status(404).json({ success: false, error: 'Purchase order not found' });
        return;
      }

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async receiveOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = receiveSchema.parse(req.body);
      const authReq = req as AuthRequest;

      const result = await purchaseOrdersService.receiveOrder(
        req.params.id as string,
        parsed,
        authReq.user!.id
      );

      res.json({ success: true, data: result });
    } catch (err: any) {
      if (err.statusCode) {
        res.status(err.statusCode).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }

  async deleteOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await purchaseOrdersService.deleteOrder(req.params.id as string);
      res.json({ success: true, data: { deleted: true } });
    } catch (err: any) {
      if (err.statusCode) {
        res.status(err.statusCode).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }
}

export const purchaseOrdersController = new PurchaseOrdersController();
