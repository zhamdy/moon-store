import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { purchaseOrdersRequestContracts, type PurchaseOrderStatusBody } from './schemas';
import type { PurchaseOrderFilters } from './types';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { purchaseOrderSchema, receiveSchema } from '../../../../validators/purchaseOrderSchema';
import { purchaseOrdersService } from './service';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = purchaseOrdersRequestContracts;

export class PurchaseOrdersController {
  async getPurchaseOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.listPurchaseOrders.parseQuery<PurchaseOrderFilters>(req.query);
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
      const { id } = contracts.getPurchaseOrder.parseParams<{ id: string }>(req.params);
      const order = await purchaseOrdersService.findById(id);
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
      const parsed = contracts.createPurchaseOrder.parseBody<z.infer<typeof purchaseOrderSchema>>(
        req.body
      );

      const authReq = req as AuthRequest;
      const created = await purchaseOrdersService.create(parsed, authReq.user!.id);

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
      const { status } = contracts.updatePurchaseOrderStatus.parseBody<PurchaseOrderStatusBody>(
        req.body
      );
      const { id } = contracts.updatePurchaseOrderStatus.parseParams<{ id: string }>(req.params);

      const updated = await purchaseOrdersService.updateStatus(id, status);
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
      const parsed = contracts.receivePurchaseOrder.parseBody<z.infer<typeof receiveSchema>>(
        req.body
      );
      const { id } = contracts.receivePurchaseOrder.parseParams<{ id: string }>(req.params);

      const authReq = req as AuthRequest;
      // Typed at the throw site now (#47), so no message inspection here.
      const newStatus = await purchaseOrdersService.receiveItems(id, parsed, authReq.user!.id);

      res.json(success({ id: Number(id), status: newStatus }));
    } catch (err) {
      next(err);
    }
  }

  async deletePurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.deletePurchaseOrder.parseParams<{ id: string }>(req.params);
      const result = await purchaseOrdersService.delete(id);
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
