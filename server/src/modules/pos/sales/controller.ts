import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { notifySale } from '../../../../services/notifications';
import { saleSchema, refundSchema } from '../../../../validators/saleSchema';
import { salesService } from './service';
import { salesRepository } from './repository';
import { parseSaleListQuery, SalesValidationError, InsufficientStockError } from './types';
import { stockConflictDetails } from '../stockConflict';
import { CouponError } from '../../commerce/coupons/types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';
import {
  IDEMPOTENCY_REPLAY_HEADER,
  readIdempotencyKey,
  toIdempotencyPublicError,
  withIdempotency,
} from '../../../http/idempotency';

export class SalesController {
  async getSales(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseSaleListQuery(req.query);
      const result = await salesRepository.listSales(query);
      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
          aggregates: { totalRevenue: result.totalRevenue, totalSales: result.total },
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async getSaleById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const saleId = Number(req.params.id);
      const sale = await salesRepository.findById(saleId);
      if (!sale) {
        throw new PublicError('NOT_FOUND', 'Sale not found');
      }

      const items = await salesRepository.findItemsBySaleId(saleId);
      const payments = await salesRepository.findPaymentsBySaleId(saleId);
      const refunds = await salesRepository.findRefundsBySaleId(saleId);

      res.json(
        success({
          ...sale,
          items,
          payments,
          refunds,
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async createSale(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = saleSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const authReq = req as AuthRequest;
      const cashierId = authReq.user!.id;
      const cashierName = authReq.user!.name;

      const outcome = await withIdempotency({
        key: readIdempotencyKey(req),
        endpoint: 'POST /api/v1/sales',
        userId: cashierId,
        // The VALIDATED body, so key order, whitespace, and stripped unknown
        // fields cannot make two identical requests look different.
        payload: parsed.data,
        run: async (client) => {
          // Cash-register movement is recorded INSIDE executeSale's checkout
          // transaction (Unit 4), derived from the confirmed/validated split --
          // not here, and not from unchecked request values. Passing the client
          // makes the sale and the idempotency claim share one transaction, so
          // they commit or roll back together.
          const sale = await salesService.executeSale(parsed.data, cashierId, client);

          // Additive cashier metadata (R6): `sale` from `repo.createSale`'s
          // RETURNING * has no join, so attach the display name the request
          // already carries; every other confirmed-response field (calculation,
          // items, payments) is attached by SalesService itself.
          return {
            status: 201,
            body: success({ ...sale, cashier_name: cashierName }),
            result: sale,
            resourceType: 'sale',
            resourceId: Number(sale.id),
          };
        },
      });

      if (outcome.replayed) {
        // A replay must not fire the side effects again -- no second audit
        // entry, and no second SMS to the customer.
        res.setHeader(IDEMPOTENCY_REPLAY_HEADER, 'true');
      } else {
        const sale = outcome.result!;
        logAuditFromReq(req, 'create', 'sale', sale.id, {
          total: sale.total,
          payment_method: sale.payment_method,
          item_count: parsed.data.items.length,
        });
        notifySale(Number(sale.total), sale.id, cashierName);
      }

      res.status(outcome.status).json(outcome.body);
    } catch (err: any) {
      const conflict = toIdempotencyPublicError(err);
      if (conflict) {
        next(conflict);
        return;
      }
      if (err instanceof SalesValidationError) {
        next(
          new PublicError('VALIDATION_ERROR', err.message, [
            { field: 'payments', code: err.code, message: err.message },
          ])
        );
        return;
      }
      if (err instanceof InsufficientStockError) {
        // Same 400 and same wording as before. The typed code and the numbers ride in
        // `details[]`, where every other domain code rides: the envelope's code stays
        // one of the seven public ones so a client never has to widen that union.
        next(
          new PublicError(
            'VALIDATION_ERROR',
            err.message,
            stockConflictDetails(err.conflicts, err.message)
          )
        );
        return;
      }
      if (err instanceof CouponError) {
        next(new PublicError('VALIDATION_ERROR', err.message));
        return;
      }
      if (
        err.message?.includes('Insufficient stock') ||
        err.message?.includes('Insufficient loyalty points') ||
        err.message?.includes('Product not found') ||
        err.message?.includes('Variant not found') ||
        err.message?.includes('Customer not found') ||
        err.message?.includes('A customer must be selected to redeem loyalty points') ||
        err.message?.includes('Loyalty program is disabled') ||
        err.message?.includes('Bundle')
      ) {
        next(new PublicError('VALIDATION_ERROR', err.message));
        return;
      }
      next(err);
    }
  }

  async refundSale(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const saleId = Number(req.params.id);
      const parsed = refundSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const authReq = req as AuthRequest;
      const cashierId = authReq.user!.id;

      const outcome = await withIdempotency({
        key: readIdempotencyKey(req),
        // Stable label. The key's scope is validated rather than keyed, so the sale id
        // must NOT be interpolated here; it goes into the fingerprinted payload below so
        // that one key reused across two different sales conflicts instead of replaying
        // the wrong refund.
        endpoint: 'POST /api/v1/sales/:id/refund',
        userId: cashierId,
        payload: { saleId, body: parsed.data },
        run: async (client) => {
          // The cash-register movement is recorded INSIDE executeRefund's transaction,
          // not here: a refund that rolls back must leave no drawer movement behind.
          // Passing the client makes the refund and the idempotency claim share one
          // transaction, so they commit or roll back together.
          const result = await salesService.executeRefund(saleId, parsed.data, cashierId, client);

          return {
            status: 201,
            body: success({
              refund: result.refund,
              refund_status: result.refundStatus,
              refunded_amount: result.newRefundedTotal,
            }),
            result,
            resourceType: 'refund',
            resourceId: Number(result.refund.id),
          };
        },
      });

      if (outcome.replayed) {
        // A replay must not write a second audit entry.
        res.setHeader(IDEMPOTENCY_REPLAY_HEADER, 'true');
      } else {
        logAuditFromReq(req, 'refund', 'sale', req.params.id as string, {
          refund_amount: outcome.result!.refund.amount,
        });
      }

      res.status(outcome.status).json(outcome.body);
    } catch (err: any) {
      const conflict = toIdempotencyPublicError(err);
      if (conflict) {
        next(conflict);
        return;
      }
      if (
        err.message === 'Sale not found' ||
        err.message === 'Sale already fully refunded' ||
        err.message?.includes('not in this sale') ||
        err.message?.includes('exceeds sold quantity') ||
        err.message === 'Refund amount exceeds sale total'
      ) {
        const code = err.message === 'Sale not found' ? 'NOT_FOUND' : 'VALIDATION_ERROR';
        next(new PublicError(code, err.message));
        return;
      }
      next(err);
    }
  }
}

export const salesController = new SalesController();
