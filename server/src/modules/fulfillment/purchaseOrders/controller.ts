import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { purchaseOrderSchema, receiveSchema } from '../../../../validators/purchaseOrderSchema';
import { purchaseOrdersService } from './service';
import { parsePurchaseOrderListQuery } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

export class PurchaseOrdersController {
  async getPurchaseOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parsePurchaseOrderListQuery(req.query);
      const result = await purchaseOrdersService.list(query);
      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async getPurchaseOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await purchaseOrdersService.findById(req.params.id as string);
      if (!order) {
        throw new PublicError('NOT_FOUND', 'Purchase order not found');
      }

      res.json(success(order));
    } catch (err) {
      next(err);
    }
  }

  async createPurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = purchaseOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const authReq = req as AuthRequest;
      const created = await purchaseOrdersService.create(parsed.data, authReq.user!.id);

      logAuditFromReq(req, 'create', 'purchase_order', created.id, {
        po_number: created.po_number,
      });

      res.status(201).json(success(created));
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.body;
      const validStatuses = ['Draft', 'Sent', 'Partially Received', 'Received', 'Cancelled'];
      if (!validStatuses.includes(status)) {
        throw new PublicError('VALIDATION_ERROR', 'Invalid status');
      }

      const updated = await purchaseOrdersService.updateStatus(req.params.id as string, status);
      if (!updated) {
        throw new PublicError('NOT_FOUND', 'Purchase order not found');
      }

      res.json(success(updated));
    } catch (err) {
      next(err);
    }
  }

  async receiveItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = receiveSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const authReq = req as AuthRequest;
      // Typed at the throw site now (#47), so no message inspection here.
      const newStatus = await purchaseOrdersService.receiveItems(
        req.params.id as string,
        parsed.data,
        authReq.user!.id
      );

      res.json(success({ id: Number(req.params.id), status: newStatus }));
    } catch (err) {
      next(err);
    }
  }

  async deletePurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await purchaseOrdersService.delete(req.params.id as string);
      if (!result.success) {
        if (result.error === 'Purchase order not found') {
          throw new PublicError('NOT_FOUND', result.error);
        }
        throw new PublicError('CONFLICT', result.error);
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export const purchaseOrdersController = new PurchaseOrdersController();
