import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { onlineOrdersRequestContracts, createOnlineOrderSchema } from './schemas';
import type { OnlineOrderFilters } from './types';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { onlineOrdersService } from './service';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = onlineOrdersRequestContracts;

export class OnlineOrdersController {
  async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = contracts.createOnlineOrder.parseBody<z.infer<typeof createOnlineOrderSchema>>(
        req.body
      );

      const order = await onlineOrdersService.createOrder(parsed);
      res.status(201).json(success(order));
    } catch (err) {
      next(err);
    }
  }

  async listOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.listOnlineOrders.parseQuery<OnlineOrderFilters>(req.query);
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
      const { id } = contracts.getOnlineOrder.parseParams<{ id: string }>(req.params);
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
      const { id } = contracts.updateOnlineOrderStatus.parseParams<{ id: string }>(req.params);
      const { status } = contracts.updateOnlineOrderStatus.parseBody<{ status: string }>(req.body);

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
