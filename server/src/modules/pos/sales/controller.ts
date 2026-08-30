import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { notifySale } from '../../../../services/notifications';
import { recordRefundMovement } from '../register';
import { saleSchema, refundSchema } from '../../../../validators/saleSchema';
import { salesService } from './service';
import { salesRepository } from './repository';
import { parseSaleListQuery, SalesValidationError, InsufficientStockError } from './types';
import { CouponError } from '../../commerce/coupons/types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

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

      // Cash-register movement is now recorded INSIDE executeSale's checkout
      // transaction (Unit 4), derived from the confirmed/validated split --
      // not here, and not from unchecked request values.
      const sale = await salesService.executeSale(parsed.data, cashierId);

      logAuditFromReq(req, 'create', 'sale', sale.id, {
        total: sale.total,
        payment_method: sale.payment_method,
        item_count: parsed.data.items.length,
      });

      notifySale(Number(sale.total), sale.id, cashierName);

      // Additive cashier metadata (R6): `sale` from `repo.createSale`'s
      // RETURNING * has no join, so attach the display name the request
      // already carries; every other confirmed-response field (calculation,
      // items, payments) is attached by SalesService itself.
      res.status(201).json(success({ ...sale, cashier_name: cashierName }));
    } catch (err: any) {
      if (err instanceof SalesValidationError) {
        next(
          new PublicError('VALIDATION_ERROR', err.message, [
            { field: 'payments', code: err.code, message: err.message },
          ])
        );
        return;
      }
      if (err instanceof InsufficientStockError) {
        // Same 400 and same wording as before; the error is merely typed now, so the
        // string-matching list below stops growing.
        next(new PublicError('VALIDATION_ERROR', err.message));
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

      const result = await salesService.executeRefund(saleId, parsed.data, cashierId);

      logAuditFromReq(req, 'refund', 'sale', req.params.id as string, {
        refund_amount: result.refund.amount,
      });
      recordRefundMovement(cashierId, Number(result.refund.amount));

      res.status(201).json(
        success({
          refund: result.refund,
          refund_status: result.refundStatus,
          refunded_amount: result.newRefundedTotal,
        })
      );
    } catch (err: any) {
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
