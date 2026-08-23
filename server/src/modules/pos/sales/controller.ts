import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { notifySale } from '../../../../services/notifications';
import { recordSaleMovement, recordRefundMovement } from '../register';
import { saleSchema, refundSchema } from '../../../../validators/saleSchema';
import { salesService } from './service';
import { salesRepository } from './repository';
import { parseSaleListQuery } from './types';
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

      const sale = await salesService.executeSale(parsed.data, cashierId);

      const isCash =
        parsed.data.payment_method === 'Cash' ||
        parsed.data.payments?.some((p) => p.method === 'Cash');
      if (isCash) {
        const cashAmount =
          parsed.data.payment_method === 'Cash'
            ? Number(sale.total)
            : Number(parsed.data.payments?.find((p) => p.method === 'Cash')?.amount || 0);
        recordSaleMovement(cashierId, sale.id, cashAmount);
      }

      logAuditFromReq(req, 'create', 'sale', sale.id, {
        total: sale.total,
        payment_method: sale.payment_method,
        item_count: parsed.data.items.length,
      });

      notifySale(Number(sale.total), sale.id, cashierName);

      res.status(201).json(success(sale));
    } catch (err: any) {
      if (
        err.message?.includes('Insufficient stock') ||
        err.message?.includes('Insufficient loyalty points') ||
        err.message?.includes('Product not found') ||
        err.message?.includes('Variant not found')
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
