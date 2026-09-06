import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { stockCountsService } from './service';
import {
  stockCountsRequestContracts,
  type CreateStockCountBody,
  type UpdateCountItemBody,
} from './schemas';
import { normalizeStockCountListQuery } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = stockCountsRequestContracts;

export class StockCountsController {
  async getStockCounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = normalizeStockCountListQuery(contracts.listStockCounts.parseQuery(req.query));
      const result = await stockCountsService.list(query);
      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async createStockCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = contracts.createStockCount.parseBody<CreateStockCountBody>(req.body);

      const authReq = req as AuthRequest;
      const result = await stockCountsService.createCount(parsed, authReq.user!.id);

      if (!result.success) {
        throw new PublicError('VALIDATION_ERROR', result.error);
      }

      logAuditFromReq(req, 'create', 'stock_count', result.data!.id);
      res.status(201).json(success(result.data));
    } catch (err) {
      next(err);
    }
  }

  async getStockCountById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.getStockCount.parseParams<{ id: string }>(req.params);
      const stockCount = await stockCountsService.findById(id);
      if (!stockCount) {
        throw new PublicError('NOT_FOUND', 'Stock count not found');
      }

      res.json(success(stockCount));
    } catch (err) {
      next(err);
    }
  }

  async updateCountItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = contracts.updateCountItem.parseBody<UpdateCountItemBody>(req.body);
      const { id, itemId } = contracts.updateCountItem.parseParams<{
        id: string;
        itemId: string;
      }>(req.params);

      const result = await stockCountsService.updateCountItem(id, itemId, parsed);

      if (!result.success) {
        const code = result.error === 'Count item not found' ? 'NOT_FOUND' : 'VALIDATION_ERROR';
        throw new PublicError(code, result.error);
      }

      res.json(success(result.data));
    } catch (err) {
      next(err);
    }
  }

  async completeStockCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.completeStockCount.parseParams<{ id: string }>(req.params);
      const authReq = req as AuthRequest;
      const { apply_adjustments = true } = req.body;

      const result = await stockCountsService.completeCount(
        id,
        authReq.user!.id,
        apply_adjustments
      );

      if (!result.success) {
        const code = result.status === 404 ? 'NOT_FOUND' : 'CONFLICT';
        throw new PublicError(code, result.error);
      }

      logAuditFromReq(req, 'complete', 'stock_count', id, {
        appliedAdjustments: apply_adjustments,
      });

      res.json(success({ status: 'completed' }));
    } catch (err) {
      next(err);
    }
  }

  async cancelStockCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.cancelStockCount.parseParams<{ id: string }>(req.params);
      const result = await stockCountsService.cancelCount(id);
      if (!result.success) {
        throw new PublicError('CONFLICT', result.error);
      }

      logAuditFromReq(req, 'cancel', 'stock_count', id);
      res.json(success({ status: 'cancelled' }));
    } catch (err) {
      next(err);
    }
  }
}

export const stockCountsController = new StockCountsController();
