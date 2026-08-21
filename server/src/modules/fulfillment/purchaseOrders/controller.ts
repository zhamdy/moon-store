import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import {
  purchaseOrderSchema,
  receiveSchema,
} from '../../../../validators/purchaseOrderSchema';
import { purchaseOrdersService } from './service';

export class PurchaseOrdersController {
  async getPurchaseOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 25, distributor_id, status } = req.query;
      const result = await purchaseOrdersService.list({
        page: Number(page),
        limit: Number(limit),
        distributor_id: distributor_id ? (distributor_id as string) : undefined,
        status: status as string | undefined,
      });

      res.json({
        success: true,
        data: result.rows,
        meta: { total: result.total, page: Number(page), limit: Number(limit) },
      });
    } catch (err) {
      next(err);
    }
  }

  async getPurchaseOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await purchaseOrdersService.findById(req.params.id as string);
      if (!order) {
        res.status(404).json({ success: false, error: 'Purchase order not found' });
        return;
      }

      res.json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }

  async createPurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = purchaseOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const authReq = req as AuthRequest;
      const created = await purchaseOrdersService.create(parsed.data, authReq.user!.id);

      logAuditFromReq(req, 'create', 'purchase_order', created.id, {
        po_number: created.po_number,
      });

      res.status(201).json({
        success: true,
        data: created,
      });
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

      const updated = await purchaseOrdersService.updateStatus(req.params.id as string, status);
      if (!updated) {
        res.status(404).json({ success: false, error: 'Purchase order not found' });
        return;
      }

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async receiveItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = receiveSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const authReq = req as AuthRequest;
      try {
        const newStatus = await purchaseOrdersService.receiveItems(
          req.params.id as string,
          parsed.data,
          authReq.user!.id
        );

        res.json({
          success: true,
          data: { id: Number(req.params.id), status: newStatus },
        });
      } catch (err: any) {
        if (err.message === 'Purchase order not found') {
          res.status(404).json({ success: false, error: err.message });
          return;
        }
        if (err.message?.startsWith('Cannot receive items')) {
          res.status(400).json({ success: false, error: err.message });
          return;
        }
        throw err;
      }
    } catch (err) {
      next(err);
    }
  }

  async deletePurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await purchaseOrdersService.delete(req.params.id as string);
      if (!result.success) {
        if (result.error === 'Purchase order not found') {
          res.status(404).json({ success: false, error: result.error });
          return;
        }
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      res.json({ success: true, data: { deleted: true } });
    } catch (err) {
      next(err);
    }
  }
}

export const purchaseOrdersController = new PurchaseOrdersController();
